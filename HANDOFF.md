# a2glimpse Handoff — Forward Inventory

**Last updated:** 2026-05-10 (design-track session — mad-scientist garage theme + shadow-DOM scoping fix + minority-report mode shipped on `design-track` branch, awaiting merge)

If you're a fresh agent or a future-Brian session: **read `AGENTS.md` and `knowledge/INDEX.md` first.** This file is the durable, cross-session "what's next" list — the canonical source of truth for outstanding work. It supersedes any session-scoped todo lists.

## Where We Are

| Tag / Branch | Milestone |
|---|---|
| `v0.8.0` | POC complete (initial spike) |
| `v0.8.1-phase3` | Polish + hardening Phase 1-4 |
| `v0.8.2-arc-complete` | Polish/hardening arc closed |
| `v0.8.3-cluster-handoff` | A1 catalog + B1 filings + B2 runbook + C1 unsigned `.app` (parallel slice fan-out) |
| `v0.8.4-mcp-bridge` | A2: `a2glimpse-mcp` MCP bridge over mcporter daemon |
| `v0.8.5-menubar-pet` | Menubar pet mode (Petdex-format compat, Finder-launch is fun, not a stub) |
| `v0.8.6-…` (head of `main`) | A3 agent skill, HUMANS/LLMS rebrand, MCP resize tool, slim titlebar, B1 fourth filing |
| `design-track` (unmerged) | Mad-scientist garage theme + shadow-DOM scoping fix + investigation methodology knowledge + minority-report mode |
| `worktree-agent-a3ded460ceddc815f` (unmerged) | Iconography cheatsheet (~330 Material Symbols) + SKILL.md update |

The appliance ships. MCP bridge is wired and verified end-to-end. Menubar mode gives the `.app` a graceful direct-launch behavior. Trust boundary holds.

## Branch state — what's queued for merge

Two unmerged branches diverged from `main` at `0507ab6`. Both are ready to merge; orchestrator owns the merge per `knowledge/20260509-160946.agent-dispatch-procedure.knowledge.md`.

### `design-track` (4 commits ahead)

```
49d010b feat(theme): minority-report mode — wire --frameless --transparent for floating-on-workspace controls
14bb829 docs(knowledge): three-round CSS investigation method + corrected five-lever vocabulary
67774ae fix(theme): inject pseudo-class CSS into shadow scope where it can match — primary/secondary actually differentiate now
3a0dece feat(theme): mad-scientist garage — chunky buttons, hazard amber, brutalist shadows
```

Touches `src/a2glimpse-host.html` (theme + shadow injection) and `src/a2glimpse.swift` (transparent-mode body attribute push). Adds two knowledge docs.

### `worktree-agent-a3ded460ceddc815f` (2 commits ahead)

Adds `skills/a2glimpse/MATERIAL-ICONS.md` (curated ~330-icon cheatsheet across 10 intent categories) and updates `skills/a2glimpse/SKILL.md` with an Iconography section. No conflicts expected with design-track.

## Outstanding Work — durable cross-session todo list

Each item below is **actionable in a future session**. Status reflects what's true on `origin/main` as of this update. Update this file when you complete an item; treat it as the authoritative project todo list.

---

### [ ] DT — Design-track merge + follow-ups

**Status:** four commits on `design-track` (see "Branch state" above) — visually verified, MCP integration test green, no conflicts with `main`. Unmerged by choice so visual goldens can re-bless cumulatively after merge.

**What needs to happen, in order:**

1. **Merge `design-track` to main** — fast-forward fine; rebase first if main has moved.
2. **Re-bless visual goldens cumulatively.** All `test/__snapshots__/<old-hash>/*.png` will diff because the rendered chrome legitimately changed (button weight, brutalist shadows, hazard amber chips, primary/secondary differentiation, slim titlebar interaction with new tokens). Per `knowledge/20260509-160946.agent-dispatch-procedure.knowledge.md` cumulative-rebless protocol:
   ```
   npm run test:visual:update
   git rm -r test/__snapshots__/<old-hash>/
   git add test/__snapshots__/<new-hash>/
   git commit -m "test(visual): re-bless goldens at <new-hash>"
   ```
3. **Audit prior wrapperPatches** against the corrected lever vocabulary in `knowledge/20260509-220000.investigation-methodology-and-lever-vocabulary.knowledge.md`. Tabs and Modal patches predate this knowledge — verify their light-DOM CSS expectations weren't silently broken by the same shadow-scoping issue. If yes, upgrade to surface-shadow injection.
4. **Tag `v0.8.7-mad-scientist-garage`** after re-bless.

**Optional follow-ups, defer-friendly:**

- **Pre-block content rendering bug** — fenced ` ``` ` blocks inside Cards sometimes render an empty gray rectangle instead of the diff text. Reproduced once, not always. Likely an interaction between the markdown engine's parsing of literal `\n` in JSON-emitted `literalString` and the renderer's Card-wrapping. Investigation queued.
- **Dark-mode body bg verification** — diagnostic in this session showed `body_bg: rgb(15, 17, 21)` (correct dark token), but screenshots intermittently rendered with a lighter body. Either screencapture quirk or a Swift KVO race. Worth a small repro session.
- **Hazard-amber callouts** — the inline-code chip treatment looks great. Could extend the same channel to `additionalStyles` for a generic "callout" Component or `usageHint="warn"`/`"danger"` variants. Designerly improvement, not blocking.

### [x] A3 — Agent Skill — shipped 2026-05-09

**Path:** [`skills/a2glimpse/SKILL.md`](skills/a2glimpse/SKILL.md)

Cross-platform SKILL.md (Claude Code + Codex + any harness that loads the open skills format). Teaches agents:
- When to reach for `a2glimpse` (multi-step asks, diff/command approval, persistent status surfaces) and when NOT to (single-shot text, non-macOS, mcporter not wired).
- Compact `mcporter call a2glimpse.<tool>` reference table mapping to the live MCP bridge.
- A minimum-viable round-trip (surface_update → data_model_update → begin_rendering → await_action → close).
- All seven patterns from the A1 catalog as copy-paste-modify JSONL recipes with expected `userAction` shapes.
- Failure modes (mcporter-not-wired, ready-timeout, await timeout, trust-boundary rejection).

Architectural decision recorded in slice devlog: skill-only, no custom tool wrapper. The MCP bridge already exposes the right surface — agents call `mcporter call a2glimpse.<tool>` via Bash.

Devlog: `knowledge/log/20260509-182643.a3.devlog.md`. Personal best-practices synthesis at `~/src/gitlab.com/bdmorin/obsidian/_raw/20260509-182643.skills-best-practices.knowledge.md`.

---

### [ ] B1 — File four GitHub issues against `google/A2UI`

**Status:** filing-ready bodies exist at `knowledge/filings/`. **Blocked on Google CLA approval** (Brian applied; in queue as of 2026-05-09).

**What:** Paste-and-file the four filing bodies once the CLA clears. Order matters — file Tabs first because the others cross-reference it:

1. `knowledge/filings/20260509-172158.tabs-theme-gap.filing.md`
2. `knowledge/filings/20260509-172158.multiplechoice-type-variant.filing.md`
3. `knowledge/filings/20260509-172158.multiplechoice-empty-selections.filing.md`
4. `knowledge/filings/20260509-192800.checkbox-stretched-input.filing.md` *(added 2026-05-09 after the screenshot session — `input { width: 100% }` in CheckBox shadow CSS stretches the native checkbox into a full-row bar)*

Each file's body from H1 down is paste-ready into https://github.com/google/A2UI/issues/new. Frontmatter has the proposed `issue_title`. After filing, update each filing's frontmatter with the assigned issue number for cross-referencing.

**Effort:** ~20 minutes once CLA is cleared.

**Pre-conditions:** CLA approval.

---

### [ ] C1 — Sign and notarize the `.app`

**Status:** unsigned `.app` ships via `npm run build:app` (`v0.8.3` slice C1). Apple Developer onboarding tutorial already at `knowledge/20260509-172625.apple-developer-onboarding.knowledge.md`.

**What:** Walk through the onboarding doc:
1. Apple Developer enrollment ($99/yr)
2. Generate "Developer ID Application" cert
3. Store team-id + app-specific password via `fnox`
4. `codesign --sign "..." --options runtime --timestamp --deep dist/a2glimpse.app`
5. `xcrun notarytool submit ... --wait`
6. `xcrun stapler staple dist/a2glimpse.app`
7. Verify: `spctl -a -vv dist/a2glimpse.app`

**Effort:** 2-3 sessions, mostly fighting Apple's signing tooling.

**Pre-conditions:** Apple Developer enrollment must be active.

---

### [ ] B2 — First real renderer re-vendor

**Status:** Runbook exists at `knowledge/20260509-172345.renderer-revendor-runbook.knowledge.md` (`v0.8.3` slice B2). Confidence **LIKELY** — unproven until first execution. Bundle-pin ledger at `knowledge/renderer-bundle-pins.md`.

**What:** When `google/A2UI` ships v0.8.x updates, follow the runbook. **First operator must edit the runbook in place** to record what actually happened — confidence upgrades to VERIFIED on first successful re-vendor.

**Effort:** First time, 2 sessions to characterize and document. Subsequent re-vendors ~1 session.

**Pre-conditions:** Upstream v0.8.x update lands.

---

### [ ] D — Polish remainders

Cosmetic; non-blocking. No order; pick by mood.

- **Test-mode visible chrome.** Test-mode windows keep standard chrome (titlebar with title text) by design — geometry is tuned to 480×352 with the harness cropping y=0..32 for pixel-diff. Path to unified-titlebar in test-mode: drop the `!config.testMode` gate, set window size to 480×320, update `cropTitlebar` to no-op, re-bless all goldens. ~30-45 min.
- **Dark mode `additionalStyles` color review.** Phase 4b ships dark-mode CSS-token-driven theming, but `defaultTheme.additionalStyles` (Button blue background, Card outline color, etc.) are baked into the IIFE. Either route those colors through CSS variables (wrapper edit + `var(--name)` references in `additionalStyles` strings) or accept the slight light-bias.
- **Visual harness production-mode goldens.** Today the harness runs in `--test-mode` only. A separate suite of production-mode fixtures could capture unified-titlebar + dark-mode rendering. Out of scope for now.
- **Slider label rendering.** Phase 3 textfield-slider noted that the renderer's `<label>` doesn't appear above the slider track. Cosmetic. Documented in that slice's devlog.

---

### [ ] Menubar pet — v2 polish (optional)

**Status:** v1 shipped (`v0.8.5`). Single pet, idle row only, 5fps, 8 frames hardcoded.

**What (any of these, à la carte):**
- Pet picker submenu listing all installed pets across the three search dirs
- Map agent runtime states (no MCP connection / MCP active / error) onto rows 5/7/8 via a tiny IPC channel from the bridge
- Variable frame counts per pet (read from `pet-states.ts`-style metadata if it ever lands in `pet.json`)
- "Open Petdex…" menu item linking to https://petdex.crafter.run/
- Floating pet window (openpets-style) as a tray-menu toggle

**Effort:** 1 session per item.

**Pre-conditions:** none.

---

### [ ] C2 — Multi-surface support

**Status:** deliberate POC scope; defer until A3 ships.

**What:** Currently single-surface only. A2UI's native concept supports N surfaces per process; the renderer Lit components can render multiple `<a2ui-surface>` elements. Adding multi-surface means:
- Removing single-surface enforcement in `src/a2glimpse.swift`
- Tabbed or stacked surface presentation in the host page
- Action routing by `surfaceId` (already part of the wire shape — would need bridge changes)
- A close-individual-surface command on the public stdin

**Effort:** 2 sessions.

**Pre-conditions:** A3 should ship first; coding-agent UX rarely needs concurrent surfaces in v1.

---

### [ ] E — Dispatch-runtime improvements (file these to whoever maintains the Agent tool, when there's a channel)

These are runtime concerns, not code in *this* repo. Capturing them here so they don't get lost.

- **E1. `Agent({isolation: "worktree"})` Mode A drift.** Runtime caches `main` HEAD at session start; worktrees fork from cache, not current HEAD. Mitigated by `git rebase origin/main` as agent's second action.
- **E2. `Agent({isolation: "worktree"})` Mode B silent fallback.** Under high concurrency (~7 simultaneous), some `git worktree add` calls fail; runtime runs the agent in parent's CWD without surfacing an error. Caught from inside agents via the HARD_FAIL convention (`knowledge/20260509-152436.worktree-isolation-verification.knowledge.md`).
- **E3. `additionalStyles` sub-element keys.** ✓ DONE — captured inline in `knowledge/20260509-154525.vendored-renderer-pathologies.knowledge.md`.
- **mcporter / snap-happy parallelism.** Multiple agents running the visual harness simultaneously can race over windowId picking. Mitigated via cap-1 retry + agents serializing their own `--update` runs. A more principled fix is a system-wide file lock on `mcporter call snap-happy.*`.

---

## Out-of-Scope For The Foreseeable Future

Deliberately deprioritized:

- **Linux / Windows backends.** Hardfork dropped both. Recovery is one `git log --follow` away. Don't, unless cross-platform demand emerges.
- **v0.9 / v0.10 spec pivot.** v0.8 is closed (no longer evolving) but stable. Pivoting churns the renderer bundle and re-baselines the visual harness wholesale. Wait for a real reason.
- **Cross-host visual parity.** Visual harness is host-targeted. Goldens are not portable. If a second developer joins, they re-bless on their host once and accept that.
- **npm publishing.** Brian's tool, local-clone install path. Not on the registry; not planning to be. See README.

---

## How To Read This Repo Cold

1. `AGENTS.md` — orientation, conventions, wire protocol summary.
2. `knowledge/INDEX.md` — knowledge catalog with reading order.
3. `knowledge/20260509-160946.agent-dispatch-procedure.knowledge.md` — if you'll be dispatching sub-agents.
4. `knowledge/DEV_LOG.md` — recent entries first; understand current state.
5. `knowledge/AUDIT_LOG.md` — who did what, where, with what outcome.
6. `HANDOFF.md` (this file) — what's next.

## Note on Session-Scoped Todos

Claude Code's `TaskCreate` / `TaskList` tools are **session-scoped**. They do NOT persist across sessions, and other agents (Codex, Cursor, etc.) cannot see them. **This file is the durable artifact.** When you finish an item, mark its `[ ]` as `[x]` in this file and commit. When you discover new work that doesn't fit an existing section, append it here.
