# a2glimpse Handoff — End of Polish & Hardening Arc

**Date:** 2026-05-09 (replaces the pre-POC handoff that lived at this path through the polish/hardening arc).

If you're a fresh agent or a future-Brian session: **read `AGENTS.md` and `knowledge/INDEX.md` first.** This file is a forward-looking inventory of what remains, not the orientation.

## Where We Are

The polish and hardening arc has shipped. The repo went from "POC plumbing proven" to "deliberate appliance with hardened trust boundaries, comprehensive visual regression, polished components across the supported v0.8 surface, system-mode-aware window chrome, and a documented agent-dispatch protocol."

`v0.8.1-phase3` tag marks the Phase 1-4 milestone on `origin/main`. `v0.8.2-arc-complete` (forthcoming after the closing-arc agents merge) closes the arc.

## What's Outstanding (Inventory)

### A. Agent-Facing Surface (the next-iteration cluster)

The cluster the original plan deliberately punted, still the right next bet. All four items reinforce each other; do them in this order.

#### A1. Agent Control Surface — supported component subset

**What:** Define the small set of A2UI v0.8 patterns coding agents should use, with worked examples. Confirm dialog, choice prompt, multi-choice, free-text capture, status surface, diff review, command approval. The current visual harness fixtures already cover most of these; this slice is about codifying them as *guidance* with a fixture-per-pattern naming convention agents can pattern-match on.

**Why first:** The MCP server wrapper (A2) and the agent skill (A3) both need a stable subset to expose / teach. Without it, both downstream pieces drift.

**Effort estimate:** 1 session if scoped tight (just the catalog), 2 if also adding fixtures for missing patterns.

**Pre-conditions:** None — could ship today on top of current Phase 1-4 work.

#### A2. MCP Bridge — `a2glimpse-mcp` over `mcporter daemon`

**Architecture (refined 2026-05-09 after re-reading mcporter docs):** Lifetime management is handled by **mcporter's daemon mode** (`lifecycle: "keep-alive"` in the server definition — see `/Users/brahn/src/github.com/openclaw/mcporter/docs/daemon.md`). What we build is a **thin stateless-by-MCP-protocol, stateful-by-child-process MCP server** — no socket management, no PID files, no restart logic. mcporter's daemon owns those concerns and is shared across agents.

**Layering, end-to-end:**

```
agent (any: Claude Code, Codex, Gemini, Cursor, …)
  └─ shells out to → mcporter call a2glimpse.<tool>
       └─ proxied through → mcporter daemon (per-config, auto-spawned)
            └─ holds warm stdio transport to → a2glimpse-mcp (the bridge we build)
                 └─ owns child process → a2glimpse (the binary that already exists)
                      └─ in-process → WKWebView with A2UI v0.8 renderer
```

**What `a2glimpse-mcp` does:** Tiny stdio MCP server. On MCP `initialize`, spawns `a2glimpse` as a child and keeps it alive for the daemon's session. Exposes MCP tools:

- `a2glimpse.surface_update` (forward A2UI v0.8 surfaceUpdate)
- `a2glimpse.data_model_update`
- `a2glimpse.begin_rendering`
- `a2glimpse.delete_surface`
- `a2glimpse.await_action(timeoutMs?)` — blocks reading child stdout until next `userAction`, returns it
- `a2glimpse.close`
- `a2glimpse.get_info`

Action correlation (matching `await_action` to incoming `userAction` events) lives in the bridge, not in `a2glimpse`.

**Trust-boundary stance (unchanged):** The bridge IS the trust boundary for MCP-driven flows. It must validate every A2UI message against the v0.8 schema before forwarding to the child's stdin. Reject `html` / `file` / `eval` shapes loudly. mcporter sees the calls but doesn't know A2UI semantics — schema validation has to live here.

**mcporter config (user-side):**

```json
"a2glimpse": {
  "command": "a2glimpse-mcp",
  "lifecycle": "keep-alive"
}
```

That's the entire registration story. Native MCP server count remains zero — same skill-as-MCP-shim pattern as snap-happy (see `/Users/brahn/src/gitlab.com/bdmorin/obsidian/_raw/20260509-184000.snap-happy-mcporter-skill-shim.retrospective.md`), just with a stateful keep-alive server underneath.

**Why this shape beats the original "MCP Server Wrapper" framing:** That framing implied building a session manager from scratch (FIFO/socket lifecycle, restart logic, per-session id management). All of that already exists in mcporter daemon — we'd be reinventing it. By delegating long-lived-host duties to mcporter, the bridge stays small, single-purpose, and protocol-translation-only.

**Cross-agent portability:** Any agent that can shell out to `mcporter call …` can drive this. No hooks, no Claude-Code-specific MCP plugin manifests. Skill file (A3) is Claude-Code-shaped, but the *capability* is agent-agnostic.

**Effort estimate (revised):** 1-2 sessions. ~150 lines of TypeScript for the bridge (MCP server scaffolding from the official SDK + a child-process manager + per-tool JSONL translation + schema validation), plus tests against a fake `a2glimpse` stdin/stdout, plus a tiny README on the mcporter config snippet. Down from the original 2-3 because lifetime management drops out.

**Pre-conditions:** A1 (so the bridge's tool surface mirrors the documented patterns) and `mcporter` installed system-wide (already true on Brian's host).

#### A3. Agent Skill

**What:** A Claude Code skill that teaches coding agents:
- When to use a2glimpse (criteria: long-lived UI, multi-step interaction, user choice required, etc.)
- How to phrase the MCP tool calls
- How to interpret returned userActions
- How to clean up surfaces

**Effort estimate:** 1 session once A2 ships. The skill is mostly documentation and examples; the heavy lifting is in the wrapper.

**Pre-conditions:** A1 + A2.

### B. Vendored Renderer — Upstream Pathway

#### B1. File renderer-bug findings upstream to `google/A2UI`

Two confirmed bugs identified during Phase 3, currently worked around in the wrapper but worth filing:

1. **Tabs theme-gap.** `Tabs.render()` calls `classMap(this.theme.components.Tabs.element)` but `defaultTheme.components.Tabs` lacks an `element` key. lit-html `classMap` does `Object.keys(undefined)` → throws → shadow-DOM commit aborts → component renders blank. Workaround in `src/a2glimpse-host.html` is a `customElements.whenDefined('a2ui-tabs').then(...)` prototype patch on `update`. Documented in `knowledge/20260509-154525.vendored-renderer-pathologies.knowledge.md`.

2. **MultipleChoice schema/element mismatch.** A2UI v0.8 spec accepts `MultipleChoice.type`; Lit element reads `.variant`. Field set via spec is silently dropped. No wrapper-side workaround shipped — documented as DEFERRED.

3. **MultipleChoice empty-array selections crash.** `selections.literalArray:[]` triggers `getCurrentSelections()` to call `processor.getData(comp, undefined, ...)` and throw. Worked around at the fixture level (use `selections.path:"<...>"` form).

**Effort estimate:** 1 session. Each is a clear repro + minimal patch suggestion. Filing process is GitHub-issue-shaped.

**Pre-conditions:** None.

#### B2. Renderer bundle freshness

When `google/A2UI` ships v0.8.x updates, we should re-vendor the renderer. Process is undocumented; capture it as a runbook the first time we do it:

- Where the source bundle lives (likely `google/A2UI/renderers/lit/`)
- Build command (`npm run build` in that subtree?)
- Verification: re-run our visual harness; expect the renderer-content-hash to change; investigate any visual regressions before re-blessing.
- Trust-boundary check: diff the new bundle for new `eval` / `unsafeHTML` / runtime fetch patterns.

**Effort estimate:** First time, 2 sessions to characterize and document. Subsequent re-vendors should be ~1 session.

### C. Productization

#### C1. `.app` packaging, signing, notarization

Documented as out of scope for the POC. Now that the appliance exists and is polished, this is the path to "Brian double-clicks an icon and it just works."

**Effort estimate:** 2-3 sessions, mostly fighting Apple's signing tooling.

**Pre-conditions:** None, but doing this BEFORE the agent skill (A3) means the skill can recommend a binary install path (e.g. Homebrew tap, signed installer) instead of `npm install`.

#### C2. Multi-surface support

Currently single-surface only (deliberate POC scope). A2UI's native concept supports N surfaces per process; the renderer Lit components can render multiple `<a2ui-surface>` elements. Adding multi-surface means:

- Removing the single-surface enforcement in `src/a2glimpse.swift`
- Tabbed or stacked surface presentation in the host page
- Action routing by `surfaceId`
- A close-individual-surface command on the public stdin

**Effort estimate:** 2 sessions.

**Pre-conditions:** Probably worth deferring until A1-A3 ship; coding-agent UX rarely needs multiple concurrent surfaces in one window.

### D. Polish Remainders (Non-Blocking)

Cosmetic / nice-to-have items that aren't load-bearing for the appliance shape:

- **Test-mode visible chrome.** Test-mode windows keep standard chrome (titlebar with title text) by design — geometry is tuned to 480×352 with the harness cropping y=0..32 for pixel-diff. If this ever feels wrong, the path to unified-titlebar in test-mode is: drop the `!config.testMode` gate, set window size to 480×320 (no titlebar reservation), update `cropTitlebar` to no-op (or remove it), re-bless all goldens. ~30-45 min if it matters.
- **Dark mode `additionalStyles` color review.** Phase 4b ships dark-mode CSS-token-driven theming, but `defaultTheme.additionalStyles` (Button blue background, Card outline color, etc.) are baked into the IIFE and don't theme-swap. Either route those colors through CSS variables (wrapper edit, then reference `var(--name)` from the `additionalStyles` strings) or live with the slight light-bias in dark mode.
- **Visual harness production-mode goldens.** Today the harness runs in `--test-mode` only. A separate suite of *production-mode* fixtures could capture the unified-titlebar treatment + dark-mode rendering. Out of scope for now; consider when the agent skill needs to demo what a2glimpse looks like in real use.
- **Slider label rendering.** Phase 3 textfield-slider noted that the renderer's `<label>` doesn't appear above the slider track in captures. Cosmetic. Documented in that slice's devlog.

### E. Dispatch-Runtime Improvements (Self-Awareness)

Items captured during this session that would improve future orchestrator runs:

#### E1. `Agent({isolation: "worktree"})` reliability

Two failure modes observed (documented in `knowledge/20260509-152436.worktree-isolation-verification.knowledge.md`):

- **Mode A** (stale-ref worktree): runtime caches `main` HEAD at session start; worktrees fork from that cache, not current HEAD. Agents handle this with `git rebase main` as their second action; the procedure doc requires it. Worth filing as a runtime improvement request.
- **Mode B** (worktree creation silently fails): under high parallel concurrency (~7 simultaneous), some `git worktree add` calls fail; the runtime falls back to running the agent in the parent's CWD without surfacing an error. The HARD_FAIL convention catches this from inside the agent. Also worth filing.

These are runtime concerns, not code in *this* repo. If we ever talk to whoever maintains the `Agent` tool, surface both.

#### E2. snap-happy / mcporter parallelism

Multiple agents running the visual harness simultaneously can race over windowId picking. Phase 3 had agents reporting "process exited before ready" / "mcporter timeout" cluster events. Mitigations so far: cap-1 retry on size anomaly, agents serialize their own `--update` runs. A more principled fix would serialize `mcporter call snap-happy.*` system-wide via a file lock — out of scope for this iteration.

#### E3. `defaultTheme.additionalStyles` sub-element keys

Modal retry showed `additionalStyles.Modal` reaches an *inner* shadow element (the `<section class="...Modal.element">`), not just the outer wrapper. The vendored-renderer-pathologies knowledge entry should be updated with this nuance: "additionalStyles can target sub-elements via key naming when the renderer's shadow CSS uses class names like `${theme.Component.element}`." Worth a one-line addendum after the closing arc lands.

## Recommended Order For Next Session

1. **A1 — Agent Control Surface subset.** Foundation for A2 + A3. ~1 session.
2. **A2 — MCP Server Wrapper.** ~2-3 sessions.
3. **A3 — Agent Skill.** ~1 session.
4. **B1 — Upstream filings.** ~1 session, can run in parallel with A2.
5. **C1 — `.app` packaging.** Whenever convenient. ~2-3 sessions.

## Out-of-Scope For The Foreseeable Future

These are deliberately deprioritized:

- **Linux / Windows backends.** The hardfork dropped Linux/Windows; recovery is one `git log --follow` away. Unless cross-platform demand emerges, don't.
- **v0.9 / v0.10 spec pivot.** v0.8 is closed (no longer evolving) but stable. Pivoting churns the renderer bundle and re-baselines the visual harness wholesale. Wait for a real reason.
- **Cross-host visual parity.** The visual harness is host-targeted to Brian's machine. Goldens are not portable. If a second developer joins, they should re-bless on their host once and accept that.

## How To Read This Repo Cold

1. `AGENTS.md` — orientation, conventions, wire protocol summary.
2. `knowledge/INDEX.md` — knowledge catalog with reading order.
3. `knowledge/20260509-160946.agent-dispatch-procedure.knowledge.md` — if you'll be dispatching sub-agents.
4. `knowledge/DEV_LOG.md` — recent entries first; understand current state.
5. `knowledge/AUDIT_LOG.md` — who did what, where, with what outcome.
6. `HANDOFF.md` (this file) — what's next.

Welcome back. The plumbing is solid, the polish is real, the documentation is durable. Take your time on the next move.

— End of session 2026-05-09
