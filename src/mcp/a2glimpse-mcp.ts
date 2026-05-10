import { spawn } from "node:child_process";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const __dirname = dirname(fileURLToPath(import.meta.url));

const BRIDGE_VERSION = "0.8.7";
const VALIDATOR_VERSION = "0.8.0";
const RING_BUFFER_SIZE = 16;

// ────────────────────────────────────────────────────────────────────────────
// Trust boundary: hand-rolled v0.8 message validator.
// Top-level key allowlist + recursive rejection of html/file/eval at any depth.
// We do NOT validate the full A2UI v0.8 schema — the renderer owns spec
// semantics. We validate only what would breach the trust boundary if forwarded.
// ────────────────────────────────────────────────────────────────────────────

const ALLOWED_TOP_LEVEL_KEYS = new Set([
  "surfaceUpdate",
  "dataModelUpdate",
  "beginRendering",
  "deleteSurface",
]);

const FORBIDDEN_KEYS_AT_ANY_DEPTH = new Set(["html", "file", "eval"]);

function deepRejectForbidden(value: unknown, path = "$"): string | null {
  if (value === null || typeof value !== "object") return null;
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const err = deepRejectForbidden(value[i], `${path}[${i}]`);
      if (err) return err;
    }
    return null;
  }
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN_KEYS_AT_ANY_DEPTH.has(k)) {
      return `forbidden key '${k}' at ${path}.${k} — public surface does not accept html/file/eval`;
    }
    const err = deepRejectForbidden(v, `${path}.${k}`);
    if (err) return err;
  }
  return null;
}

function validateA2uiMessage(envelope: unknown): { ok: true } | { ok: false; reason: string } {
  if (!envelope || typeof envelope !== "object" || Array.isArray(envelope)) {
    return { ok: false, reason: "envelope must be a non-array object" };
  }
  const keys = Object.keys(envelope as object);
  if (keys.length !== 1) {
    return { ok: false, reason: `envelope must have exactly one top-level key, got ${keys.length}` };
  }
  const [topKey] = keys;
  if (!ALLOWED_TOP_LEVEL_KEYS.has(topKey)) {
    return { ok: false, reason: `top-level key '${topKey}' not in allowlist {${[...ALLOWED_TOP_LEVEL_KEYS].join(", ")}}` };
  }
  const forbidden = deepRejectForbidden(envelope);
  if (forbidden) return { ok: false, reason: forbidden };
  return { ok: true };
}

// ────────────────────────────────────────────────────────────────────────────
// Child process: spawn a2glimpse and hold its stdio.
// ────────────────────────────────────────────────────────────────────────────

function resolveA2glimpseBinary(): string {
  const env = process.env.A2GLIMPSE_BINARY_PATH;
  if (env && existsSync(env)) return env;
  const repoBin = resolve(__dirname, "..", "a2glimpse");
  if (existsSync(repoBin)) return repoBin;
  return "a2glimpse";
}

interface PendingAction {
  surfaceId: string | null;  // null = match any surface
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout;
  startedAt: number;
}

interface UserActionLike {
  name?: string;
  surfaceId?: string;
  sourceComponentId?: string;
  timestamp?: string;
  context?: Record<string, unknown>;
}

class RingBuffer<T> {
  private items: T[] = [];
  private capacity: number;
  constructor(capacity: number) {
    this.capacity = capacity;
  }
  push(item: T): void {
    this.items.push(item);
    if (this.items.length > this.capacity) this.items.shift();
  }
  snapshot(): T[] {
    return this.items.slice();
  }
}

class A2glimpseChild {
  private proc: ChildProcessWithoutNullStreams | null = null;
  private stdoutBuffer = "";
  // Per-surface FIFO queues. surfaceId "@default" is the fallback bucket
  // for actions that arrive without a surfaceId attribution.
  private actionQueues: Map<string, unknown[]> = new Map();
  private pending: PendingAction[] = [];
  private readyPromise: Promise<void> | null = null;
  private lastInfo: unknown = null;

  // Telemetry — populated for self_check.
  private startedAt = 0;
  private messagesSent = 0;
  private actionsReceived = 0;
  private trustRejections = new RingBuffer<{ at: string; reason: string; topKey: string }>(RING_BUFFER_SIZE);
  private lastActions = new RingBuffer<UserActionLike>(RING_BUFFER_SIZE);

  start(): Promise<void> {
    if (this.readyPromise) return this.readyPromise;
    const bin = resolveA2glimpseBinary();
    const args = process.env.A2GLIMPSE_ARGS ? process.env.A2GLIMPSE_ARGS.split(/\s+/) : [];
    this.proc = spawn(bin, args, { stdio: ["pipe", "pipe", "pipe"] });
    this.startedAt = Date.now();

    this.readyPromise = new Promise<void>((resolveReady, rejectReady) => {
      let resolved = false;
      const onLine = (line: string) => {
        if (!line.trim()) return;
        let msg: unknown;
        try {
          msg = JSON.parse(line);
        } catch {
          process.stderr.write(`[a2glimpse-mcp] non-JSON child stdout: ${line}\n`);
          return;
        }
        const m = msg as { type?: string; userAction?: UserActionLike; error?: unknown };
        if (m.type === "ready" && !resolved) {
          resolved = true;
          this.lastInfo = msg;
          resolveReady();
          return;
        }
        if (m.type === "info") {
          this.lastInfo = msg;
          return;
        }
        if (m.userAction !== undefined) {
          this.actionsReceived++;
          this.lastActions.push(m.userAction);
          this.routeUserAction(m.userAction);
          return;
        }
        if (m.type === "closed") {
          for (const p of this.pending) {
            clearTimeout(p.timer);
            p.reject(new Error("a2glimpse child closed"));
          }
          this.pending = [];
        }
      };

      this.proc!.stdout.on("data", (chunk: Buffer) => {
        this.stdoutBuffer += chunk.toString("utf8");
        let nl: number;
        while ((nl = this.stdoutBuffer.indexOf("\n")) >= 0) {
          const line = this.stdoutBuffer.slice(0, nl);
          this.stdoutBuffer = this.stdoutBuffer.slice(nl + 1);
          onLine(line);
        }
      });

      this.proc!.stderr.on("data", (chunk: Buffer) => {
        process.stderr.write(`[a2glimpse-child] ${chunk.toString("utf8")}`);
      });

      this.proc!.on("exit", (code, signal) => {
        if (!resolved) {
          rejectReady(new Error(`a2glimpse exited before ready (code=${code} signal=${signal})`));
        }
      });

      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          rejectReady(new Error("a2glimpse child did not emit ready within 5s"));
        }
      }, 5000);
    });

    return this.readyPromise;
  }

  /**
   * Route an incoming userAction to the first matching pending await
   * (FIFO; awaiters with a surfaceId filter only match that surface,
   * unfiltered awaiters match anything). If nothing is waiting, queue
   * under the action's surfaceId for a later filtered or unfiltered drain.
   */
  private routeUserAction(action: UserActionLike): void {
    const surfaceId = action.surfaceId ?? "@default";
    for (let i = 0; i < this.pending.length; i++) {
      const p = this.pending[i];
      if (p.surfaceId === null || p.surfaceId === surfaceId) {
        this.pending.splice(i, 1);
        clearTimeout(p.timer);
        p.resolve(action);
        return;
      }
    }
    if (!this.actionQueues.has(surfaceId)) this.actionQueues.set(surfaceId, []);
    this.actionQueues.get(surfaceId)!.push(action);
  }

  send(envelope: unknown): void {
    if (!this.proc || this.proc.killed) {
      throw new Error("a2glimpse child not running");
    }
    this.proc.stdin.write(JSON.stringify(envelope) + "\n");
    this.messagesSent++;
  }

  awaitAction(timeoutMs: number, surfaceId?: string): Promise<unknown> {
    // Filtered drain: pull head of the named queue if non-empty.
    if (surfaceId !== undefined) {
      const q = this.actionQueues.get(surfaceId);
      if (q && q.length > 0) return Promise.resolve(q.shift());
    } else {
      // Unfiltered drain: any non-empty queue, insertion order.
      for (const [, q] of this.actionQueues) {
        if (q.length > 0) return Promise.resolve(q.shift());
      }
    }
    return new Promise((resolveAction, rejectAction) => {
      const timer = setTimeout(() => {
        const idx = this.pending.findIndex((p) => p.timer === timer);
        if (idx >= 0) this.pending.splice(idx, 1);
        rejectAction(new Error(`await_action timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      this.pending.push({
        surfaceId: surfaceId ?? null,
        resolve: resolveAction,
        reject: rejectAction,
        timer,
        startedAt: Date.now(),
      });
    });
  }

  recordRejection(topKey: string, reason: string): void {
    this.trustRejections.push({ at: new Date().toISOString(), topKey, reason });
  }

  getInfo(): unknown {
    return this.lastInfo;
  }

  selfCheck(): unknown {
    const queues: Record<string, number> = {};
    for (const [sid, q] of this.actionQueues) queues[sid] = q.length;
    const now = Date.now();
    return {
      bridge: {
        version: BRIDGE_VERSION,
        validator_version: VALIDATOR_VERSION,
      },
      child: {
        alive: this.proc !== null && !this.proc.killed,
        pid: this.proc?.pid ?? null,
        uptime_ms: this.startedAt ? now - this.startedAt : 0,
        messages_sent: this.messagesSent,
        actions_received: this.actionsReceived,
      },
      host: this.lastInfo,
      queues,
      pending_awaits: this.pending.map((p) => ({
        surfaceId: p.surfaceId,
        age_ms: now - p.startedAt,
      })),
      last_actions: this.lastActions.snapshot(),
      last_rejections: this.trustRejections.snapshot(),
      trust_boundary: {
        allowed_top_keys: [...ALLOWED_TOP_LEVEL_KEYS],
        forbidden_keys: [...FORBIDDEN_KEYS_AT_ANY_DEPTH],
      },
    };
  }

  close(): void {
    if (this.proc && !this.proc.killed) {
      try {
        this.proc.stdin.write(JSON.stringify({ type: "close" }) + "\n");
      } catch {
        /* child may already be gone */
      }
      this.proc.kill("SIGTERM");
    }
    this.proc = null;
    this.readyPromise = null;
    this.actionQueues = new Map();
    for (const p of this.pending) {
      clearTimeout(p.timer);
      p.reject(new Error("a2glimpse child closed"));
    }
    this.pending = [];
    this.stdoutBuffer = "";
    this.lastInfo = null;
    this.startedAt = 0;
    this.messagesSent = 0;
    this.actionsReceived = 0;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// MCP server: tool registration.
// ────────────────────────────────────────────────────────────────────────────

const child = new A2glimpseChild();

const server = new McpServer({
  name: "a2glimpse",
  version: BRIDGE_VERSION,
});

function asContent(payload: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload) }],
  };
}

function errorContent(reason: string) {
  return {
    isError: true,
    content: [{ type: "text" as const, text: JSON.stringify({ error: reason }) }],
  };
}

async function ensureChild(): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    await child.start();
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: (e as Error).message };
  }
}

function forwardEnvelope(topKey: string, body: unknown) {
  const envelope = { [topKey]: body };
  const v = validateA2uiMessage(envelope);
  if (!v.ok) {
    child.recordRejection(topKey, v.reason);
    return errorContent(`trust-boundary validation failed: ${v.reason}`);
  }
  try {
    child.send(envelope);
    return asContent({ forwarded: topKey });
  } catch (e) {
    return errorContent((e as Error).message);
  }
}

server.tool(
  "surface_update",
  "Forward an A2UI v0.8 surfaceUpdate to a2glimpse. Replaces the named surface's contents. Multiple surfaceIds coexist in the stack.",
  {
    surfaceId: z.string(),
    components: z.array(z.unknown()),
  },
  async (args) => {
    const ready = await ensureChild();
    if (!ready.ok) return errorContent(ready.reason);
    return forwardEnvelope("surfaceUpdate", args);
  }
);

server.tool(
  "data_model_update",
  "Forward an A2UI v0.8 dataModelUpdate. Updates the bound data model the named surface reads from.",
  {
    surfaceId: z.string(),
    contents: z.array(z.unknown()),
    path: z.string().optional(),
  },
  async (args) => {
    const ready = await ensureChild();
    if (!ready.ok) return errorContent(ready.reason);
    return forwardEnvelope("dataModelUpdate", args);
  }
);

server.tool(
  "begin_rendering",
  "Forward an A2UI v0.8 beginRendering. Tells the renderer the named surface is ready to display. Surfaces stack vertically; window auto-grows to fit.",
  {
    surfaceId: z.string(),
    root: z.string(),
    catalogId: z.string().optional(),
    styles: z.record(z.string(), z.unknown()).optional(),
  },
  async (args) => {
    const ready = await ensureChild();
    if (!ready.ok) return errorContent(ready.reason);
    return forwardEnvelope("beginRendering", args);
  }
);

server.tool(
  "delete_surface",
  "Forward an A2UI v0.8 deleteSurface. Removes the named surface from the stack. Window auto-shrinks.",
  {
    surfaceId: z.string(),
  },
  async (args) => {
    const ready = await ensureChild();
    if (!ready.ok) return errorContent(ready.reason);
    return forwardEnvelope("deleteSurface", args);
  }
);

server.tool(
  "await_action",
  "Block until the next userAction event. If surfaceId is provided, only matches actions from that surface (other surfaces' actions queue separately). If omitted, returns the next action from any surface in insertion order. Times out after timeoutMs (default 60000).",
  {
    timeoutMs: z.number().int().positive().max(600000).optional(),
    surfaceId: z.string().optional(),
  },
  async (args) => {
    const ready = await ensureChild();
    if (!ready.ok) return errorContent(ready.reason);
    try {
      const action = await child.awaitAction(args.timeoutMs ?? 60000, args.surfaceId);
      return asContent({ userAction: action });
    } catch (e) {
      return errorContent((e as Error).message);
    }
  }
);

server.tool(
  "resize",
  "Manually resize the a2glimpse window. The window auto-grows to content height by default; use this only when you want to override width or pin a specific size. Width/height in points, bounded 240×160 to 2000×1500.",
  {
    width: z.number().int().min(240).max(2000),
    height: z.number().int().min(160).max(1500),
  },
  async (args) => {
    const ready = await ensureChild();
    if (!ready.ok) return errorContent(ready.reason);
    try {
      child.send({ type: "resize", width: args.width, height: args.height });
      return asContent({ resized: { width: args.width, height: args.height } });
    } catch (e) {
      return errorContent((e as Error).message);
    }
  }
);

server.tool(
  "get_info",
  "Return the last 'ready' / 'info' payload from the a2glimpse child (geometry, system info).",
  async () => {
    const ready = await ensureChild();
    if (!ready.ok) return errorContent(ready.reason);
    try {
      child.send({ type: "get-info" });
    } catch (e) {
      return errorContent((e as Error).message);
    }
    await new Promise((r) => setTimeout(r, 50));
    return asContent({ info: child.getInfo() });
  }
);

server.tool(
  "self_check",
  "Bridge introspection — like /doctor for a2glimpse. Returns bridge version, child state (pid, uptime, message counts), host info, per-surface queue depths, pending awaits, last actions, last trust-boundary rejections, and the validator allowlist. Use when something looks wrong before guessing — this is the cold-context dump.",
  async () => {
    return asContent(child.selfCheck());
  }
);

server.tool(
  "close",
  "Close the a2glimpse window and tear down the child process. The bridge stays alive; next tool call respawns.",
  async () => {
    child.close();
    return asContent({ closed: true });
  }
);

// ────────────────────────────────────────────────────────────────────────────
// Wire up stdio and go.
// ────────────────────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write("[a2glimpse-mcp] ready on stdio\n");
}

main().catch((e) => {
  process.stderr.write(`[a2glimpse-mcp] fatal: ${(e as Error).stack ?? e}\n`);
  process.exit(1);
});

process.on("SIGTERM", () => {
  child.close();
  process.exit(0);
});
process.on("SIGINT", () => {
  child.close();
  process.exit(0);
});
