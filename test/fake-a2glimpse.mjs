#!/usr/bin/env node
// Stand-in for the real a2glimpse binary. Used by test/mcp.mjs to exercise
// the bridge in isolation without spawning a WKWebView.
//
// Protocol contract we honor:
// - emit {"type":"ready", ...info} on startup
// - on {"type":"get-info"}: emit {"type":"info", ...same info}
// - on {"beginRendering": ...}: emit a synthetic userAction so await_action resolves
// - on {"type":"close"}: emit {"type":"closed"} and exit 0
// - log everything to stderr for test debugging

import readline from "node:readline";

const info = {
  type: "ready",
  pid: process.pid,
  geometry: { width: 480, height: 352 },
  fake: true,
};

process.stdout.write(JSON.stringify(info) + "\n");

const rl = readline.createInterface({ input: process.stdin });
rl.on("line", (line) => {
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    process.stderr.write(`[fake] bad JSON: ${line}\n`);
    return;
  }
  process.stderr.write(`[fake] got ${Object.keys(msg).join(",")}\n`);
  if (msg.type === "get-info") {
    process.stdout.write(JSON.stringify({ ...info, type: "info" }) + "\n");
    return;
  }
  if (msg.beginRendering) {
    process.stdout.write(
      JSON.stringify({
        userAction: {
          name: "fake.confirmed",
          surfaceId: msg.beginRendering.surfaceId ?? "test",
          sourceComponentId: "fake-button",
          timestamp: new Date().toISOString(),
          context: { source: "fake-a2glimpse" },
        },
      }) + "\n"
    );
    return;
  }
  if (msg.type === "close") {
    process.stdout.write(JSON.stringify({ type: "closed" }) + "\n");
    process.exit(0);
  }
});
