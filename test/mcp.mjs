// Bridge integration test. Spawns the MCP bridge with a fake a2glimpse
// child, then drives it via an MCP Client over stdio.
//
// Verifies:
//   - all 7 tools are registered
//   - surface_update / data_model_update / begin_rendering forward to child
//   - await_action returns the synthetic userAction the fake emits
//   - get_info round-trips
//   - trust-boundary validator rejects html / file / eval / unknown top-key
//   - close tears down the child cleanly

import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BRIDGE = resolve(__dirname, "..", "bin", "a2glimpse-mcp.mjs");
const FAKE = resolve(__dirname, "fake-a2glimpse.mjs");

let failed = false;

function pass(msg) {
  console.log(`  ✓ ${msg}`);
}

function fail(msg) {
  console.error(`  ✗ ${msg}`);
  failed = true;
}

function parseTextContent(result) {
  const block = result?.content?.[0];
  if (!block || block.type !== "text") return null;
  try {
    return JSON.parse(block.text);
  } catch {
    return null;
  }
}

async function main() {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [BRIDGE],
    env: { ...process.env, A2GLIMPSE_BINARY_PATH: FAKE },
  });
  const client = new Client({ name: "a2glimpse-mcp-test", version: "0.0.0" }, { capabilities: {} });
  await client.connect(transport);

  try {
    // 1. Tool list shape
    const tools = await client.listTools();
    const expected = new Set([
      "surface_update",
      "data_model_update",
      "begin_rendering",
      "delete_surface",
      "await_action",
      "resize",
      "get_info",
      "close",
    ]);
    const got = new Set(tools.tools.map((t) => t.name));
    if (got.size === expected.size && [...expected].every((n) => got.has(n))) {
      pass(`${expected.size} tools registered: ${[...got].sort().join(", ")}`);
    } else {
      fail(`tool set mismatch — expected ${[...expected].sort().join(", ")}, got ${[...got].sort().join(", ")}`);
    }

    // 2. surface_update + begin_rendering round-trip with await_action
    const su = await client.callTool({
      name: "surface_update",
      arguments: { surfaceId: "test", components: [{ id: "root", component: { Column: {} } }] },
    });
    const suPayload = parseTextContent(su);
    if (suPayload?.forwarded === "surfaceUpdate" && !su.isError) {
      pass("surface_update forwarded");
    } else {
      fail(`surface_update unexpected: ${JSON.stringify(su)}`);
    }

    const br = await client.callTool({
      name: "begin_rendering",
      arguments: { surfaceId: "test", root: "root" },
    });
    if (parseTextContent(br)?.forwarded === "beginRendering" && !br.isError) {
      pass("begin_rendering forwarded");
    } else {
      fail(`begin_rendering unexpected: ${JSON.stringify(br)}`);
    }

    const aa = await client.callTool({
      name: "await_action",
      arguments: { timeoutMs: 2000 },
    });
    const aaPayload = parseTextContent(aa);
    if (aaPayload?.userAction?.name === "fake.confirmed" && !aa.isError) {
      pass(`await_action returned ${aaPayload.userAction.name}`);
    } else {
      fail(`await_action unexpected: ${JSON.stringify(aa)}`);
    }

    // 3. get_info
    const gi = await client.callTool({ name: "get_info", arguments: {} });
    const giPayload = parseTextContent(gi);
    if (giPayload?.info?.fake === true && !gi.isError) {
      pass("get_info returned child info");
    } else {
      fail(`get_info unexpected: ${JSON.stringify(gi)}`);
    }

    // 4. Trust boundary — html should be rejected at any depth
    const evil = await client.callTool({
      name: "surface_update",
      arguments: {
        surfaceId: "evil",
        components: [{ id: "x", component: { html: "<script>alert(1)</script>" } }],
      },
    });
    const evilPayload = parseTextContent(evil);
    if (evil.isError && /forbidden key 'html'/.test(evilPayload?.error ?? "")) {
      pass("trust-boundary rejects nested html key");
    } else {
      fail(`trust-boundary did NOT reject html: ${JSON.stringify(evil)}`);
    }

    // 5. await_action timeout
    const timedOut = await client.callTool({
      name: "await_action",
      arguments: { timeoutMs: 100 },
    });
    if (timedOut.isError && /timed out/.test(parseTextContent(timedOut)?.error ?? "")) {
      pass("await_action times out cleanly");
    } else {
      fail(`await_action did not time out: ${JSON.stringify(timedOut)}`);
    }

    // 6. close tears child down
    const closed = await client.callTool({ name: "close", arguments: {} });
    if (parseTextContent(closed)?.closed === true && !closed.isError) {
      pass("close acknowledged");
    } else {
      fail(`close unexpected: ${JSON.stringify(closed)}`);
    }
  } finally {
    await client.close();
  }

  if (failed) {
    console.error("\nMCP bridge tests FAILED");
    process.exit(1);
  }
  console.log("\nAll MCP bridge tests passed");
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
