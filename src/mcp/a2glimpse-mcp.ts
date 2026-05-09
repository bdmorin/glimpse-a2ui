import { spawn } from "node:child_process";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ────────────────────────────────────────────────────────────────────────────
// Trust boundary: hand-rolled v0.8 message validator.
//
// Strategy: top-level key allowlist + recursive rejection of upstream-glimpse
// HTML/file/eval shapes. We do NOT validate the full A2UI v0.8 schema —
// the renderer owns spec semantics. We validate only what would breach the
// trust boundary if forwarded.
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
  // Override for tests / packaging.
  const env = process.env.A2GLIMPSE_BINARY_PATH;
  if (env && existsSync(env)) return env;

  // Bundle-relative: the .app bundle places binary at Contents/MacOS/a2glimpse;
  // when this script is at <repo>/src/mcp/, the binary is at <repo>/src/a2glimpse.
  const repoBin = resolve(__dirname, "..", "a2glimpse");
  if (existsSync(repoBin)) return repoBin;

  // Last-resort PATH lookup.
  return "a2glimpse";
}

interface PendingAction {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout;
}

class A2glimpseChild {
  private proc: ChildProcessWithoutNullStreams | null = null;
  private stdoutBuffer = "";
  private actionQueue: unknown[] = [];
  private pending: PendingAction[] = [];
  private readyPromise: Promise<void> | null = null;
  private lastInfo: unknown = null;

  start(): Promise<void> {
    if (this.readyPromise) return this.readyPromise;
    const bin = resolveA2glimpseBinary();
    const args = process.env.A2GLIMPSE_ARGS ? process.env.A2GLIMPSE_ARGS.split(/\s+/) : [];
    this.proc = spawn(bin, args, { stdio: ["pipe", "pipe", "pipe"] });

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
        const m = msg as { type?: string; userAction?: unknown; error?: unknown };
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
          if (this.pending.length > 0) {
            const next = this.pending.shift()!;
            clearTimeout(next.timer);
            next.resolve(m.userAction);
          } else {
            this.actionQueue.push(m.userAction);
          }
          return;
        }
        if (m.type === "closed") {
          // Child shut down; reject pending awaits.
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

      // 5s ready timeout — generous; renderer warmup is the slow path.
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          rejectReady(new Error("a2glimpse child did not emit ready within 5s"));
        }
      }, 5000);
    });

    return this.readyPromise;
  }

  send(envelope: unknown): void {
    if (!this.proc || this.proc.killed) {
      throw new Error("a2glimpse child not running");
    }
    this.proc.stdin.write(JSON.stringify(envelope) + "\n");
  }

  awaitAction(timeoutMs: number): Promise<unknown> {
    if (this.actionQueue.length > 0) {
      return Promise.resolve(this.actionQueue.shift());
    }
    return new Promise((resolveAction, rejectAction) => {
      const timer = setTimeout(() => {
        const idx = this.pending.findIndex((p) => p.timer === timer);
        if (idx >= 0) this.pending.splice(idx, 1);
        rejectAction(new Error(`await_action timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      this.pending.push({ resolve: resolveAction, reject: rejectAction, timer });
    });
  }

  getInfo(): unknown {
    return this.lastInfo;
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
  }
}

// ────────────────────────────────────────────────────────────────────────────
// MCP server: tool registration.
// ────────────────────────────────────────────────────────────────────────────

const child = new A2glimpseChild();

const server = new McpServer({
  name: "a2glimpse",
  version: "0.8.0",
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
  if (!v.ok) return errorContent(`trust-boundary validation failed: ${v.reason}`);
  try {
    child.send(envelope);
    return asContent({ forwarded: topKey });
  } catch (e) {
    return errorContent((e as Error).message);
  }
}

server.tool(
  "surface_update",
  "Forward an A2UI v0.8 surfaceUpdate to a2glimpse. Replaces the current surface contents.",
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
  "Forward an A2UI v0.8 dataModelUpdate. Updates the bound data model the surface reads from.",
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
  "Forward an A2UI v0.8 beginRendering. Tells the renderer the surface is ready to display.",
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
  "Forward an A2UI v0.8 deleteSurface. Removes the surface from the renderer.",
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
  "Block until the next userAction event arrives from the surface. Returns the action payload (name, surfaceId, sourceComponentId, context). Times out after timeoutMs (default 60000).",
  {
    timeoutMs: z.number().int().positive().max(600000).optional(),
  },
  async (args) => {
    const ready = await ensureChild();
    if (!ready.ok) return errorContent(ready.reason);
    try {
      const action = await child.awaitAction(args.timeoutMs ?? 60000);
      return asContent({ userAction: action });
    } catch (e) {
      return errorContent((e as Error).message);
    }
  }
);

server.tool(
  "get_info",
  "Return the last 'ready' / 'info' payload emitted by the a2glimpse child (geometry, system info).",
  async () => {
    const ready = await ensureChild();
    if (!ready.ok) return errorContent(ready.reason);
    try {
      child.send({ type: "get-info" });
    } catch (e) {
      return errorContent((e as Error).message);
    }
    // Brief settle before returning latest info.
    await new Promise((r) => setTimeout(r, 50));
    return asContent({ info: child.getInfo() });
  }
);

server.tool(
  "close",
  "Close the a2glimpse window and tear down the child process. The bridge stays alive; next tool call will respawn.",
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

// Best-effort cleanup.
process.on("SIGTERM", () => {
  child.close();
  process.exit(0);
});
process.on("SIGINT", () => {
  child.close();
  process.exit(0);
});
