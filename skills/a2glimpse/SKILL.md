---
name: a2glimpse
description: Render a native macOS window with declarative A2UI v0.8 components and read the user's response — confirm dialogs, single/multi choice pickers, text forms, live status surfaces, diff review, and command-approval prompts. Use instead of AskUserQuestion when the ask is multi-step, needs persistent state across tool calls, presents a diff or shell command for approval, or wants the user to glance at progress while you keep working. Drives the a2glimpse appliance via the a2glimpse MCP server (mcporter). macOS only.
---

# a2glimpse — agent UI surface

You can put a real native window in front of the user. JSON in, click out. Use it when a question deserves more than a one-shot text prompt.

## When to reach for this

Fire this skill when ANY of these are true:

- You need approval for a destructive or expensive action (apply diff, run shell command, deploy).
- The question has more than two answers and a list-in-text would be ugly.
- You're asking for several inputs at once (a form), not a single string.
- You're going to be working for a while and want the user to see progress without you spamming the chat.
- The user is going to glance, click, and go back to what they were doing — don't make them type "yes" into a terminal.

## When NOT to reach

- "Should I continue?" mid-conversation. Just ask. AskUserQuestion is fine.
- Linux or Windows. This is macOS only — the binary is Swift/WKWebView. No fallback. If you're not on a Mac, use AskUserQuestion.
- The MCP server isn't registered. Check first: `mcporter list 2>/dev/null | grep a2glimpse`. If absent, fall back to AskUserQuestion and tell the user `a2glimpse-mcp` isn't wired into mcporter.
- Anything where latency matters more than UX. Spawning the window costs ~300ms on first call.

## How it works (one paragraph)

The MCP server `a2glimpse` (registered in mcporter as `a2glimpse`, lifecycle `keep-alive`) holds a long-lived child process — the native renderer. You drive it by calling tools that forward A2UI v0.8 JSON to its stdin. The renderer paints components in a Lit-based WebView. When the user clicks, you call `await_action` and get back a `userAction` payload with `name`, `sourceComponentId`, and a `context` object you control. You discriminate on `context`, not on which button was clicked.

## Tools (call via `mcporter call a2glimpse.<tool> '<args-json>'`)

| Tool | What it does |
|---|---|
| `surface_update` | Replace a surface's component tree. Takes `{surfaceId, components}`. Multiple surfaceIds coexist in a vertical stack. |
| `data_model_update` | Push/replace bound data values. Takes `{surfaceId, contents, path?}`. |
| `begin_rendering` | Tell the renderer to display the named surface. Takes `{surfaceId, root}`. Adds the surface to the visible stack. |
| `await_action` | Block until a userAction arrives. Takes `{timeoutMs?, surfaceId?}`. With `surfaceId`, only matches actions from that surface (others queue separately). Without, returns the next from any surface. Default 60000 ms, max 600000. |
| `delete_surface` | Remove a surface from the stack (`{surfaceId}`). Window auto-shrinks. |
| `resize` | **Optional override.** The window auto-grows vertically to fit content; you only need this to widen the window or pin a fixed size. `{width, height}` in points, 240×160 to 2000×1500. |
| `get_info` | Window geometry and system info. |
| `self_check` | **Bridge introspection — like /doctor.** Returns a JSON snapshot: bridge version, child PID/uptime/message counts, host info, per-surface queue depths, pending awaits, last actions, last trust-boundary rejections, validator allowlist. Use when something looks wrong before guessing. |
| `close` | Tear down the window. Always call this when you're done. |

The bridge validates everything: `html`, `file`, and `eval` keys at any depth are rejected. Don't try.

## The minimum viable round-trip

```bash
# 1. Define the surface
mcporter call a2glimpse.surface_update '{"surfaceId":"s1","components":[
  {"id":"root","component":{"Column":{"children":{"explicitList":["q","row"]}}}},
  {"id":"q","component":{"Text":{"text":{"literalString":"Apply 3 file changes?"}}}},
  {"id":"row","component":{"Row":{"children":{"explicitList":["no","yes"]}}}},
  {"id":"no_label","component":{"Text":{"text":{"literalString":"Cancel"}}}},
  {"id":"no","component":{"Button":{"child":"no_label","action":{"name":"confirm","context":[{"key":"answer","value":{"literalString":"no"}}]}}}},
  {"id":"yes_label","component":{"Text":{"text":{"literalString":"Apply"}}}},
  {"id":"yes","component":{"Button":{"child":"yes_label","primary":true,"action":{"name":"confirm","context":[{"key":"answer","value":{"literalString":"yes"}}]}}}}
]}'

# 2. (Optional) seed bound data
mcporter call a2glimpse.data_model_update '{"surfaceId":"s1","contents":[]}'

# 3. Show it
mcporter call a2glimpse.begin_rendering '{"surfaceId":"s1","root":"root"}'

# 4. Wait for the click
mcporter call a2glimpse.await_action '{"timeoutMs":60000}'
# → {"userAction":{"name":"confirm","surfaceId":"s1","sourceComponentId":"yes","timestamp":"...","context":{"answer":"yes"}}}

# 5. Always close
mcporter call a2glimpse.close '{}'
```

That is the entire mental model. Everything below is "which component tree for which question."

## Seven patterns — pick one and copy

The seven patterns below cover the realistic agent-UX surface. Pick by name. Substitute your labels and `action.name`. Read `userAction.context` on the way back. Pattern names are stable — use them in your `action.name` field and your reasoning.

For full background on the catalog and the renderer caveats, see `knowledge/20260509-180000.agent-control-surface.knowledge.md` in this repo.

### 1. `confirm` — yes/no go/no-go

Use when you've decided what to do and need a one-click human green-light.

See the minimum viable round-trip above — that IS the confirm pattern. Read `context.answer` (`"yes"` or `"no"`). Don't discriminate on `sourceComponentId`.

### 2. `choice` — pick one of 2-7

Use for "which environment", "which strategy", "which file". Above 7 options it's a UX smell — split or fall back to free-text.

```jsonl
{"surfaceUpdate":{"surfaceId":"s1","components":[
  {"id":"root","component":{"Column":{"children":{"explicitList":["q","pick","submit"]}}}},
  {"id":"q","component":{"Text":{"text":{"literalString":"Which environment should I deploy to?"}}}},
  {"id":"pick","component":{"MultipleChoice":{"selections":{"path":"/env"},"maxAllowedSelections":1,"options":[
    {"label":{"literalString":"staging"},"value":"staging"},
    {"label":{"literalString":"production"},"value":"production"},
    {"label":{"literalString":"canary"},"value":"canary"}]}}},
  {"id":"submit_label","component":{"Text":{"text":{"literalString":"Deploy"}}}},
  {"id":"submit","component":{"Button":{"child":"submit_label","primary":true,"action":{"name":"choice","context":[{"key":"env","value":{"path":"/env"}}]}}}}]}}
{"dataModelUpdate":{"surfaceId":"s1","contents":[{"key":"env","valueString":"staging"}]}}
{"beginRendering":{"surfaceId":"s1","root":"root"}}
```

Returned: `userAction.context.env` is the chosen value.

**Renderer gotcha:** the v0.8 spec accepts `MultipleChoice.type:"radio"` for radio-button visuals, but the vendored Lit element drops `.type`. The visual may render as checkboxes. Functionally fine — `maxAllowedSelections:1` is what enforces single-pick. Filed upstream (HANDOFF.md B1).

### 3. `multi-choice` — pick zero or more

Use for "which files to refactor", "which lints to auto-fix". Answer is a list (possibly empty).

```jsonl
{"surfaceUpdate":{"surfaceId":"s1","components":[
  {"id":"root","component":{"Column":{"children":{"explicitList":["q","pick","submit"]}}}},
  {"id":"q","component":{"Text":{"text":{"literalString":"Which files should I refactor?"}}}},
  {"id":"pick","component":{"MultipleChoice":{"selections":{"path":"/files"},"type":"checkbox","options":[
    {"label":{"literalString":"src/auth.ts"},"value":"src/auth.ts"},
    {"label":{"literalString":"src/db.ts"},"value":"src/db.ts"},
    {"label":{"literalString":"src/util.ts"},"value":"src/util.ts"}]}}},
  {"id":"submit_label","component":{"Text":{"text":{"literalString":"Refactor"}}}},
  {"id":"submit","component":{"Button":{"child":"submit_label","primary":true,"action":{"name":"multi-choice","context":[{"key":"files","value":{"path":"/files"}}]}}}}]}}
{"dataModelUpdate":{"surfaceId":"s1","contents":[{"key":"files","valueArray":[]}]}}
{"beginRendering":{"surfaceId":"s1","root":"root"}}
```

**Critical gotcha:** Always seed `selections` via `{"path":"/files"}` against an explicit `valueArray:[]` data-model entry. Do NOT use `selections:{literalArray:[]}` — the renderer crashes in `getCurrentSelections()`. Filed upstream.

Returned: `userAction.context.files` is the array of chosen values.

### 4. `free-text` — capture freeform input

Use for commit messages, search queries, names, descriptions. One TextField per string; a Column of TextFields for a small form.

```jsonl
{"surfaceUpdate":{"surfaceId":"s1","components":[
  {"id":"root","component":{"Column":{"children":{"explicitList":["q","field","submit"]}}}},
  {"id":"q","component":{"Text":{"text":{"literalString":"Commit message:"}}}},
  {"id":"field","component":{"TextField":{"label":{"literalString":"Subject"},"text":{"path":"/subject"},"textFieldType":"shortText"}}},
  {"id":"submit_label","component":{"Text":{"text":{"literalString":"Commit"}}}},
  {"id":"submit","component":{"Button":{"child":"submit_label","primary":true,"action":{"name":"free-text","context":[{"key":"subject","value":{"path":"/subject"}}]}}}}]}}
{"dataModelUpdate":{"surfaceId":"s1","contents":[{"key":"subject","valueString":""}]}}
{"beginRendering":{"surfaceId":"s1","root":"root"}}
```

Use `textFieldType:"longText"` for a multiline area.

Returned: `userAction.context.subject` is the typed string.

### 5. `status` — read-only progress

Use for multi-step work the user will glance at. No input expected; you push updates with `data_model_update`.

```jsonl
{"surfaceUpdate":{"surfaceId":"s1","components":[
  {"id":"root","component":{"Card":{"child":"col"}}},
  {"id":"col","component":{"Column":{"children":{"explicitList":["title","step","detail"]}}}},
  {"id":"title","component":{"Text":{"usageHint":"h3","text":{"literalString":"Refactoring auth module"}}}},
  {"id":"step","component":{"Text":{"text":{"path":"/step"}}}},
  {"id":"detail","component":{"Text":{"text":{"path":"/detail"}}}}]}}
{"dataModelUpdate":{"surfaceId":"s1","contents":[{"key":"step","valueString":"1 of 4"},{"key":"detail","valueString":"Scanning imports…"}]}}
{"beginRendering":{"surfaceId":"s1","root":"root"}}
```

To advance: emit additional `data_model_update` calls overwriting `/step` and `/detail`. No buttons, no `await_action` needed (it would just hang). Call `close` when done.

Returned: nothing. This pattern is one-way by design.

### 6. `diff-review` — accept/reject a code change

Like `confirm` but the body shows the diff. Differs from `confirm` in that the body has substance, not just a question.

```jsonl
{"surfaceUpdate":{"surfaceId":"s1","components":[
  {"id":"root","component":{"Column":{"children":{"explicitList":["heading","path","diff_card","row"]}}}},
  {"id":"heading","component":{"Text":{"usageHint":"h3","text":{"literalString":"Apply this change?"}}}},
  {"id":"path","component":{"Text":{"text":{"literalString":"src/auth.ts"}}}},
  {"id":"diff_card","component":{"Card":{"child":"diff_text"}}},
  {"id":"diff_text","component":{"Text":{"text":{"literalString":"- function login(u, p) {\n+ async function login(user: string, password: string) {\n  // ...\n}"}}}},
  {"id":"row","component":{"Row":{"children":{"explicitList":["reject","accept"]}}}},
  {"id":"reject_label","component":{"Text":{"text":{"literalString":"Reject"}}}},
  {"id":"reject","component":{"Button":{"child":"reject_label","action":{"name":"diff-review","context":[{"key":"answer","value":{"literalString":"reject"}}]}}}},
  {"id":"accept_label","component":{"Text":{"text":{"literalString":"Accept"}}}},
  {"id":"accept","component":{"Button":{"child":"accept_label","primary":true,"action":{"name":"diff-review","context":[{"key":"answer","value":{"literalString":"accept"}}]}}}}]}}
{"dataModelUpdate":{"surfaceId":"s1","contents":[]}}
{"beginRendering":{"surfaceId":"s1","root":"root"}}
```

Returned: `context.answer` is `"accept"` or `"reject"`.

**Limitation:** diff renders as plain text. No syntax/diff coloring (no markdown-in-Text yet). Acceptable; revisit when the renderer ships markdown.

### 7. `command-approval` — approve/deny a shell command

Same shape as `diff-review`, body is the command, verbs are `approve`/`deny`. Use this when the trust gradient says "ask first."

```jsonl
{"surfaceUpdate":{"surfaceId":"s1","components":[
  {"id":"root","component":{"Column":{"children":{"explicitList":["heading","cmd_card","reason","row"]}}}},
  {"id":"heading","component":{"Text":{"usageHint":"h3","text":{"literalString":"Run this command?"}}}},
  {"id":"cmd_card","component":{"Card":{"child":"cmd_text"}}},
  {"id":"cmd_text","component":{"Text":{"text":{"literalString":"$ rm -rf node_modules && npm install"}}}},
  {"id":"reason","component":{"Text":{"text":{"literalString":"Reason: dependency tree is corrupted; clean reinstall is the standard fix."}}}},
  {"id":"row","component":{"Row":{"children":{"explicitList":["deny","approve"]}}}},
  {"id":"deny_label","component":{"Text":{"text":{"literalString":"Deny"}}}},
  {"id":"deny","component":{"Button":{"child":"deny_label","action":{"name":"command-approval","context":[{"key":"answer","value":{"literalString":"deny"}}]}}}},
  {"id":"approve_label","component":{"Text":{"text":{"literalString":"Approve"}}}},
  {"id":"approve","component":{"Button":{"child":"approve_label","primary":true,"action":{"name":"command-approval","context":[{"key":"answer","value":{"literalString":"approve"}}]}}}}]}}
{"dataModelUpdate":{"surfaceId":"s1","contents":[]}}
{"beginRendering":{"surfaceId":"s1","root":"root"}}
```

Returned: `context.answer` is `"approve"` or `"deny"`.

## Multi-surface — stack patterns concurrently

You are not limited to one surface at a time. The window is a vertical stack — each `begin_rendering` adds a surface, each `delete_surface` removes one, and the window auto-grows / auto-shrinks to fit. Use this when one round-trip needs more than one role:

- **Status + diff-review.** A persistent `status` surface ticks at the top while `diff-review` waits for an answer below.
- **Command-approval + sub-status.** Show what you're about to run AND a stream of "why" context next to it.
- **Form + live preview.** A `free-text` form on top, a status surface below mirroring how the eventual output will look.

Two rules and one new tool surface:

1. **Per-surface action queues.** Each surface has its own FIFO. `await_action {surfaceId: "diff"}` only matches actions from `"diff"` — the status surface's actions queue up until you ask for them (or never, if status doesn't have buttons).
2. **Insertion order = stack order.** First `begin_rendering` is on top; subsequent ones append below. Use `delete_surface` to remove; the window shrinks. Don't re-`begin_rendering` an already-visible surface to "move" it — it's a no-op.
3. **`await_action` without a `surfaceId`** falls back to "give me the next action from any surface in insertion order" — useful when you genuinely don't care which surface the user touched first.

Minimal stacked example:

```bash
# Top: status
mcporter call a2glimpse.surface_update '{"surfaceId":"status","components":[
  {"id":"root","component":{"Card":{"child":"col"}}},
  {"id":"col","component":{"Column":{"children":{"explicitList":["t","s"]}}}},
  {"id":"t","component":{"Text":{"usageHint":"h3","text":{"literalString":"Refactoring auth module"}}}},
  {"id":"s","component":{"Text":{"text":{"path":"/step"}}}}
]}'
mcporter call a2glimpse.data_model_update '{"surfaceId":"status","contents":[{"key":"step","valueString":"1 of 3 — scanning"}]}'
mcporter call a2glimpse.begin_rendering '{"surfaceId":"status","root":"root"}'

# Bottom: diff approval
mcporter call a2glimpse.surface_update '{"surfaceId":"diff","components":[ /* diff-review pattern */ ]}'
mcporter call a2glimpse.begin_rendering '{"surfaceId":"diff","root":"root"}'

# While we wait for the user's diff click, keep ticking status
mcporter call a2glimpse.data_model_update '{"surfaceId":"status","contents":[{"key":"step","valueString":"2 of 3 — building"}]}'

# Filtered await: only return when the user touches "diff"
mcporter call a2glimpse.await_action '{"surfaceId":"diff","timeoutMs":600000}'

# When done, peel surfaces away
mcporter call a2glimpse.delete_surface '{"surfaceId":"diff"}'
mcporter call a2glimpse.delete_surface '{"surfaceId":"status"}'
mcporter call a2glimpse.close '{}'
```

## Debug surface — `__a2glimpse_debug` and `self_check`

When the visual is wrong or the bridge feels stuck, two introspection paths exist:

- **`self_check`** is for *you*. Returns a JSON snapshot of bridge state — child PID/uptime, host info, queue depths per surface, pending awaits, last 16 actions, last 16 trust-boundary rejections, the validator allowlist. Read it before guessing. This is the cold-context dump for "what's actually happening right now."
- **`__a2glimpse_debug`** is a reserved surfaceId you can render *into*. Send any A2UI components there and it appears in the stack inside a dashed monospace-styled wrapper labeled "debug · __a2glimpse_debug". Useful when you want the *user* to see your internal state alongside the working surfaces — e.g. surfacing the path you're about to write to, or echoing the data model you've bound. The bridge doesn't gate it; it's a convention. Render normal A2UI components into it; it just gets distinct chrome so it reads as "behind the curtain."

Order of operations when debugging:

1. Call `self_check` — covers 80% of "WTF is happening" without rendering anything.
2. If the visual itself is the bug, render a `__a2glimpse_debug` surface alongside the broken one and have it echo the data model / surface id / last-known state.
3. If the renderer crashed (blank surface, no error), check `self_check.last_rejections` and `self_check.host` — host info reflects the renderer's last successful ready.

## Conventions you must follow

- **`action.name` mirrors the pattern name** — `confirm`, `choice`, `multi-choice`, `free-text`, `diff-review`, `command-approval`. (`status` has no action.) Future-you reading the JSONL log appreciates this.
- **Discriminate on `context`, not on `sourceComponentId`.** Component ids are scaffolding. The contract is `context.answer`, `context.env`, `context.files`, etc.
- **Bind inputs via data-model paths** (`{"path":"/x"}`). Carry values out via `context: [{key:"x", value:{path:"/x"}}]` on the submit button. Don't try to poll the renderer for intermediate state.
- **One pattern per surface.** Don't compose two patterns into one surface — the catalog patterns are designed standalone. To run two patterns at once, use *two surfaces* and stack them (see Multi-surface above).
- **`surfaceId` is opaque.** Use a stable per-flow id so subsequent updates target the right surface.
- **Always call `close` when done.** The bridge keeps the child warm between calls — but you own when the user's window goes away.

## Failure modes — read these before you debug

- **`mcporter call ...` errors with "tool not found"** → the `a2glimpse` MCP server isn't registered. Check `mcporter list`. Fall back to AskUserQuestion.
- **`begin_rendering` returns OK but no window appears** → the renderer host page hasn't booted yet. The bridge waits up to 5s for `ready`; if it didn't, you'll get a "did not emit ready" error on the first tool call. macOS WindowServer issue or missing display.
- **`await_action` times out** → the user closed the window or walked away. The default is 60s; bump to 600000 (10 min) for `status`-like flows where the user is reading. After timeout, the surface is still alive — call again or `close`.
- **`await_action` returns immediately on first call** → an action was already queued (the user clicked while you were doing something else). This is correct behavior. Read it.
- **Trust-boundary rejection** → if you tried to send `html`, `file`, or `eval` at any depth, the bridge bounces it. Don't try; this is the whole point of the fork.
- **Window-closed during await** → bridge rejects pending awaits with "a2glimpse child closed". Treat as user-cancel.

## The wire shape (compact reference)

A2UI v0.8 components nest under `{"id":"<id>","component":{"<Type>":{...}}}`. The submit-button form is the load-bearing pattern: bind input components to `/path`, mirror values out via `action.context: [{key, value:{path}}]`. Strings are `{"literalString":"x"}`; bound text is `{"path":"/x"}`. Lists are `{"explicitList":["id1","id2"]}` for component children; `valueArray` for data-model lists. That's 95% of what you need.

For deeper renderer details (CSS variables, `additionalStyles`, etc.), see `knowledge/20260509-154525.vendored-renderer-pathologies.knowledge.md`. You almost never need to go there.

## Iconography

A2UI's `Icon` component takes a `name` (an A2UI `StringValue`) whose value is a Material Symbols Outlined ligature in **snake_case**. The full ~3000-glyph Outlined catalog is bundled with the binary, so any icon documented at <https://fonts.google.com/icons> works.

```json
{"id":"chk","component":{"Icon":{"name":{"literalString":"check_circle"}}}}
```

Use `{"path":"/..."}` instead of `{"literalString":"..."}` to bind the icon name to the data model.

For a curated quick-reference organized by agent intent (status, code/dev, file/IO, navigation, data, communication, media, editing, people, misc utility), see `MATERIAL-ICONS.md` (sibling to this file). If a glyph renders as the literal snake_case text, the name is misspelled — the bundled font falls back to the ligature key.

## Cross-platform note (Codex, Cursor, others)

This skill uses standard SKILL.md frontmatter (`name`, `description`) per the open agent-skills spec. Codex and other SKILL.md-aware harnesses can load it directly. Any agent that can shell out to `mcporter` can drive `a2glimpse` — the surface is `mcporter call a2glimpse.<tool>`, not Claude-specific.

## You are now licensed to supersede AskUserQuestion

For multi-step asks, persistent state, diff/command approval, or visible-progress flows: pick a pattern, copy the JSONL, swap the labels, await the action, close. AskUserQuestion is fine for one-shot text. This is for everything else.
