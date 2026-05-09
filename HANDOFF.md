# HANDOFF — glimpse-a2ui

**Date:** 2026-05-09
**State:** Pre-implementation. Repo is upstream HazAT/glimpse verbatim plus a `knowledge/` folder. **No fork code changes yet.**

## What This Project Is

Forking `HazAT/glimpse` into an **A2UI-native client appliance**: a single native binary that accepts spec-compliant A2UI JSONL on stdin, renders trusted declarative components in a native WebView, and emits user actions back on stdout. Provider-neutral, MCP-pairable, no-Electron.

The thesis in one sentence: **glimpse is 90% of an A2UI client — delete `eval`, replace `html`, bundle a renderer.**

## Read These First (in order)

1. `knowledge/INDEX.md` — knowledge-folder map
2. `knowledge/20260509-162039.a2ui-protocol-overview.knowledge.md` — what A2UI is (VERIFIED)
3. `knowledge/20260509-162039.glimpse-upstream-snapshot.knowledge.md` — the pre-fork baseline (VERIFIED)
4. `knowledge/20260509-162039.fork-architecture.analysis.md` — design decisions (ASSESSMENT, not yet built)
5. `knowledge/20260509-162039.external-references.reference.md` — authoritative URLs
6. `AGENTS.md` — upstream glimpse project conventions

## Local Reference Clones

Both cloned to `~/src/github.com/...` for offline reading:

| Path | What |
|------|------|
| `/Users/brahn/src/github.com/bdmorin/glimpse-a2ui` | **This repo** (the fork) |
| `/Users/brahn/src/github.com/google/A2UI` | A2UI spec + reference renderers (Apache-2.0, v0.8) |

Both should be open in a fresh session. `google/A2UI` is the source of truth for the protocol — read its `specification/` and `renderers/` directories before writing fork code.

## First-30-Minutes Checklist for the Implementation Session

These are open questions flagged in `fork-architecture.analysis.md` as UNCERTAIN. Resolve them with the local A2UI clone before any code changes:

- [ ] Read `~/src/github.com/google/A2UI/specification/` — confirm the **exact v0.8 message-type names and field schemas** (the overview file uses `surfaceUpdate` / `dataModelUpdate` provisionally; verify).
- [ ] Read `~/src/github.com/google/A2UI/renderers/` — identify the **Lit web renderer entry point** and its **dispatch API** (`window.a2ui.dispatch(...)` is provisional; verify).
- [ ] Determine if the Lit renderer can run **fully offline** from a custom URL scheme (no CDN fetches, no network globals). Critical — glimpse's existing `glimpse-resource://` style scheme depends on this.
- [ ] Check `~/src/github.com/google/A2UI/eval/` — is it reusable as a v0.8 compliance test harness, or do we hand-roll?
- [ ] Inspect Lit renderer **bundle size** when minified — informs whether we embed in-binary or ship alongside.

Write findings into a new file: `knowledge/YYYYMMDD-HHMMSS.a2ui-spec-grounding.knowledge.md`.

## Scrappy MVP Path (from fork-architecture.analysis.md)

1. Mac-only. Defer Linux/Windows.
2. Vendor the Lit renderer from `google/A2UI/renderers/`.
3. Wire **one** A2UI surface end-to-end: `surfaceUpdate` → render Button → user click → action JSONL on stdout. Just one component before adding more.
4. Wrap binary in an MCP server (~150 lines TS) that holds it alive across tool calls.
5. Test from Claude Code: "show me a confirm dialog with three options" round-trips.

Estimate to step 5: a weekend.

## What Stays vs. What Changes (summary — full version in fork-architecture.analysis.md)

**Keep:** native binary model, JSONL stdio framing, lifecycle events, custom URL scheme, single-file Swift, zero-dep philosophy, compile-on-install.

**Swap:** `{type:"html", ...}` → A2UI message types. `{type:"eval", ...}` → removed from public surface (optional `--unsafe-eval` dev flag). `{type:"message", data:...}` → A2UI `action` events.

**Add:** bundled A2UI ref renderer, multi-surface support, v0.8 compliance suite.

## Non-Goals (For Now)

- Linux/Windows parity. Mac-first.
- A2UI v0.9. Pin to v0.8.
- Upstreaming to HazAT. File an issue eventually if Mac MVP works; not blocking.
- Replacing the existing `--unsafe-eval` path entirely (kept for renderer dev/debug).

## Open Architectural Decisions

- **Binary name:** `glimpse` (rename retained), `a2g`, or `a2glimpse`? Decide at first commit. Leaning `glimpse` — boring + obvious.
- **Renderer delivery:** baked into binary as resource, or shipped as sibling asset? Depends on bundle size finding above.
- **Multi-surface UX:** stacked panels in one window vs. tabs vs. multiple windows? Defer until we read the renderer source.

## What Would Make This Project Wrong

If A2UI v0.8's message format is materially different from the streaming-JSON-with-component-IDs description we relied on, parts of `fork-architecture.analysis.md` need revision before any code lands. **Verify against the local spec clone first** — that's why the first-30-minutes checklist exists.

## Don't Do This

- Do not start writing Swift before resolving the first-30-minutes checklist. Premature implementation against an assumed schema = rework.
- Do not delete `src/glimpse.swift`'s structure — single-file discipline is upstream convention and worth preserving even after diverging.
- Do not add Linux/Windows changes in the same commits as the A2UI refactor. Mac-only first; cross-platform is a separate later concern.
- Do not paper over `eval` removal with a wrapper that just translates A2UI → eval underneath. That defeats the security thesis.
