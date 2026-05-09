# a2glimpse

Mac-first proof-of-concept A2UI v0.8 appliance forked from [HazAT/glimpse](https://github.com/HazAT/glimpse).

`a2glimpse` keeps Glimpse's native WKWebView shell and JSON Lines stdio framing, but removes the public HTML/eval interface. It accepts A2UI v0.8 JSONL, renders one trusted Lit-rendered surface, and emits user actions back on stdout.

This is a spike, not a finished product. It is intentionally allowed to fail in public.

## Install / Build

```bash
git clone https://github.com/bdmorin/glimpse-a2ui
cd glimpse-a2ui
npm install              # postinstall compiles src/a2glimpse via swiftc
npm link                 # puts `a2glimpse` and `a2glimpse-mcp` on PATH
```

The native binary is built to:

```bash
src/a2glimpse
```

Local-clone is the only supported install path. Not on npm; not planning to be.

## CLI

```bash
npx a2glimpse --demo
```

Or pipe A2UI v0.8 JSON Lines:

```bash
cat <<'JSONL' | npx a2glimpse --width 420 --height 260
{"surfaceUpdate":{"surfaceId":"demo","components":[{"id":"root","component":{"Column":{"children":{"explicitList":["title","button"]}}}},{"id":"title","component":{"Text":{"usageHint":"h3","text":{"literalString":"a2glimpse"}}}},{"id":"button_text","component":{"Text":{"text":{"literalString":"Confirm"}}}},{"id":"button","component":{"Button":{"child":"button_text","primary":true,"action":{"name":"confirm.clicked","context":[{"key":"answer","value":{"literalString":"yes"}}]}}}}]}}
{"dataModelUpdate":{"surfaceId":"demo","contents":[]}}
{"beginRendering":{"surfaceId":"demo","root":"root"}}
JSONL
```

Clicking the button emits:

```json
{"userAction":{"name":"confirm.clicked","surfaceId":"demo","sourceComponentId":"button","timestamp":"...","context":{"answer":"yes"}}}
```

## Node API

```js
import { open } from 'a2glimpse';

const win = open({ width: 420, height: 260 });
win.on('ready', () => {
  win.dispatch({ surfaceUpdate: { surfaceId: 'demo', components: [] } });
});
win.on('userAction', action => console.log(action));
win.on('clientError', error => console.error(error));
```

## Protocol

Stdin accepts:

- A2UI v0.8 messages: `surfaceUpdate`, `dataModelUpdate`, `beginRendering`, `deleteSurface`
- lifecycle/control commands: `{ "type": "get-info" }`, `{ "type": "close" }`
- retained window commands for the spike: `show`, `title`, `resize`, `follow-cursor`

Stdout emits:

- `{ "type": "ready", ...systemInfo }`
- `{ "type": "info", ...systemInfo }`
- `{ "userAction": { ... } }`
- `{ "error": { "message": "..." } }`
- `{ "type": "closed" }`

## Current Constraints

- macOS only.
- A2UI v0.8 only.
- Single surface only.
- No public HTML, file, or eval command.
- The Lit renderer host is vendored as `src/a2glimpse-host.html` for the POC.

## MCP Bridge (`a2glimpse-mcp`)

`a2glimpse` is a stdin-driven appliance, not a long-lived MCP server. The bridge `a2glimpse-mcp` (in `bin/`) wraps the binary so any MCP-aware agent can drive it via tool calls. Lifetime is delegated to [`mcporter`](https://github.com/openclaw/mcporter)'s daemon (`lifecycle: "keep-alive"`) — the bridge stays warm across calls; the binary is held as the bridge's child process.

### Tools

| Tool | Purpose |
|---|---|
| `surface_update` | Forward an A2UI v0.8 surfaceUpdate |
| `data_model_update` | Forward a dataModelUpdate |
| `begin_rendering` | Forward a beginRendering |
| `delete_surface` | Forward a deleteSurface |
| `await_action` | Block until next userAction (or timeout) |
| `get_info` | Return child geometry / system info |
| `close` | Tear down the child window |

### mcporter config

```json
"a2glimpse": {
  "command": "a2glimpse-mcp",
  "lifecycle": "keep-alive"
}
```

That's the entire registration story. Any agent that can shell out to `mcporter call a2glimpse.<tool>` can drive this.

### Agent skill

For coding agents (Claude Code, Codex, anything SKILL.md-aware): a ready-to-load skill at [`skills/a2glimpse/SKILL.md`](skills/a2glimpse/SKILL.md) teaches when to reach for `a2glimpse` and how to compose the seven canonical A2UI v0.8 patterns (`confirm`, `choice`, `multi-choice`, `free-text`, `status`, `diff-review`, `command-approval`).

### Trust boundary

The bridge IS the trust boundary for MCP-driven flows. Every A2UI message is validated before forwarding to the child's stdin: top-level key must be one of `{surfaceUpdate, dataModelUpdate, beginRendering, deleteSurface}`, and any `html` / `file` / `eval` key at any depth is rejected loudly. The renderer owns the rest of v0.8 schema semantics.

### Implementation

- `src/mcp/a2glimpse-mcp.ts` — single-file TypeScript, ~330 lines. Node 22.18+ strips types natively at runtime.
- `bin/a2glimpse-mcp.mjs` — entry shim.
- `test/mcp.mjs` — integration test against a fake-a2glimpse stdin/stdout child. Run with `npm run test:mcp`.

## Packaging (`.app` bundle)

`a2glimpse` can be packaged as a Mac `.app` bundle for distribution and future
code-signing. The bundle is *not* a clickable launcher — it's an MCP appliance
spawned over stdin/stdout. Double-clicking the `.app` shows a friendly alert
and exits.

```bash
npm run build:app
# → dist/a2glimpse.app
```

Layout:

```
a2glimpse.app/
  Contents/
    Info.plist                       (com.bdmorin.a2glimpse, LSUIElement)
    MacOS/a2glimpse                  (compiled Swift binary)
    Resources/
      a2glimpse-host.html
      MaterialSymbolsOutlined.woff2
      AppIcon.icns                   (placeholder)
```

The bundle is **unsigned**. To sign and notarize for distribution see
[`knowledge/20260509-172625.apple-developer-onboarding.knowledge.md`](knowledge/20260509-172625.apple-developer-onboarding.knowledge.md)
— a from-zero walkthrough of the Apple Developer enrollment, certificate
hierarchy, `codesign` invocation, and `notarytool` flow.

The bridge spawns `Contents/MacOS/a2glimpse` directly; the wrapper around
it is purely for distribution identity.

## Lineage

This hardfork starts from upstream Glimpse v0.8.0. The fork point is tagged:

```bash
glimpse-upstream-v0.8.0-forkpoint
```

Glimpse's native-shell idea is doing the heavy lifting here; `a2glimpse` is an experiment in swapping the trust boundary from arbitrary HTML/JS to declarative A2UI.
