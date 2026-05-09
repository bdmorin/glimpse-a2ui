# a2glimpse Dev Log

Append-only narrative log. Captures *why* and *what was considered*, not *what changed* — that's what `git log` is for. New entries go at the bottom. Never edit or reorder past entries; correct them with a follow-up entry that references the prior one.

## Format

```
## YYYY-MM-DD HH:MM — Short title
**Author:** human or agent (model / role)
**Context:** what triggered this entry (request, finding, blocker)
**Did:** terse list of actions
**Considered / rejected:** alternatives and why not
**Open / next:** what remains
```

Keep entries short. Link out to `knowledge/*.md` files for depth.

---

## 2026-05-09 ~13:20 — Post-POC orientation pass

**Author:** Claude (Opus 4.7), with Brian
**Context:** POC just finished (commits db74c1b, 95c3b0f). New session, fresh on the repo. Asked to rewrite `AGENTS.md` to reflect post-POC reality.

**Did:**
- Read `knowledge/INDEX.md` and all six referenced knowledge files plus current `AGENTS.md`, `README.md`, `package.json`, source headers.
- Rewrote `AGENTS.md` from upstream-Glimpse conventions to a2glimpse orientation: explicit non-goals, the trust-boundary rule (no `html`/`file`/`eval` on the public stdin), supported wire protocol, file map, reading order pointing at `knowledge/INDEX.md`.
- Renamed `src/glimpse.swift` → `src/a2glimpse.swift` via `git mv`. Updated `scripts/build.mjs`, `package.json` `files` array, `src/a2glimpse.mjs` build hint, AGENTS.md prose + diagram. Verified `npm run build:macos` still produces `src/a2glimpse`.

**Considered / rejected:**
- Leaving `src/glimpse.swift` named as-is to preserve a visible breadcrumb to the upstream fork point. Rejected — Brian: "this is a hard-fork, I don't want crosstalk with Origin's work." `git log --follow` retains lineage; the cosmetic confusion isn't worth the symbolic tie.
- Putting full retrospective content into `AGENTS.md`. Rejected — duplicating `knowledge/20260509-130112.poc-retrospective.retrospective.md` would create a dual source of truth that rots. AGENTS.md orients; knowledge/ owns depth.
- Editing knowledge files to swap "glimpse.swift" → "a2glimpse.swift" mentions. Rejected — those references are inside *upstream-snapshot* documents describing the pre-fork baseline. They're correct as-is.
- Touching `src/linux/`, `src/chromium-backend.mjs`, `native/windows/`, `examples/companion/`, `skills/glimpse/`. Skipped — these are upstream residue; AGENTS.md now documents them as unmaintained.

**Open / next:**
- Changes are staged/unstaged but uncommitted.
- Next-iteration backlog (from POC retrospective, not this session's scope): drop cwd renderer fallback, gate test-only synthetic-click path, wait for renderer-host ready (not just WebKit ready), define an "agent control surface" component subset, MCP server wrapper, agent skill.

---

## 2026-05-09 ~14:00 — Phase 0 maintenance + polish/hardening plan

**Author:** Claude (Opus 4.7), orchestrator, with Brian
**Context:** Brian asked to prepare for polishing the interface window and enhancing the A2UI implementation framework. Visual regression via `/snap-happy` (routed through mcporter, per the skill-as-MCP-shim retro). Plan calls for git worktrees and parallel implementation agents.

**Did:**
- Reflected scope/decisions back: framework-hardening first, v0.8 pinned, whole-component-set goal with bail-and-log pragma, host-targeted (not cross-host), main session owns merges.
- Phase 0 repo maintenance: `git rm` on `src/linux/`, `src/chromium-backend.mjs`, `native/`, `examples/`, `skills/`. Updated `AGENTS.md` references. Trimmed `webview2`/`gtk` keywords from `package.json`. Smoke test green pre- and post-delete.
- Created `knowledge/AUDIT_LOG.md` as the who/what/where ledger (sister to this file).
- Wrote `knowledge/20260509-140000.polish-and-hardening-plan.plan.md` as the self-contained brief for worktree agents (phases, conventions, bail rules).
- Updated `knowledge/INDEX.md` to point at AUDIT_LOG and the active plan.

**Considered / rejected:**
- Quarantining residue under `_upstream-archive/` instead of deleting. Rejected — Brian's hardfork stance and the existence of `git log --follow` make outright deletion cleaner.
- Doing framework hardening (Brian's stated "first thread") before the visual-regression harness. Reordered to do harness first within the same priority because hardening worktrees need the visual safety net to avoid silent regressions. Confirmed with Brian.
- v0.8 → v0.9 pivot. Rejected — Brian wants stable target; v0.8 retro work first.
- Cross-host visual parity. Out of scope; this work is optimized for Brian's machine specifically.

**Open / next:**
- Phase 0 changes uncommitted; will commit when Brian green-lights.
- Phase 1 (visual-regression harness) is next, sequential, single agent.
- Phase 2 hardening worktrees (`wt/harden-renderer-load`, `wt/harden-test-gating`, `wt/harden-ready-signal`) ready to dispatch once harness exists.

---

## 2026-05-09 ~14:17 — Phase 1 visual-regression harness

**Author:** Claude (Opus 4.7), worktree agent in `wt/visual-harness` (worktree branch `worktree-agent-ace4a890f72f16fb8`)
**Context:** Dispatched to build the visual-regression harness per Phase 1 of the polish-and-hardening plan. Worktree branched off `main` before commit d44b78a; first action was `git merge --ff-only main` to pull in the plan + AUDIT_LOG that the brief required me to read.

**Did:**
- Added `--test-mode` flag (and `A2GLIMPSE_TEST_MODE=1` env-var fallback) to `src/a2glimpse.swift`. Locks geometry to 480x320 default, forces follow-cursor/transparent/frameless/click-through/status-item/no-dock/hidden off, and makes `resize`/`follow-cursor` commands no-ops while in test mode. Geometry/timing only — no new command surface, trust boundary unchanged. Smoke test (`npm test`) green pre- and post-change.
- Wrote six A2UI v0.8 fixtures under `test/fixtures/`: `button-only`, `card-text`, `modal`, `multiple-choice`, `text-field-form`, `tabs`. Each is three-line JSONL (`surfaceUpdate` + `dataModelUpdate` + `beginRendering`). Schema-validated against `src/a2glimpse-host.html` Zod schemas.
- Wrote `test/visual.mjs`: spawn binary in test mode with unique title → wait `ready` → dispatch fixture lines → 1.5s settle → `mcporter call snap-happy.ListWindows` parsed for windowId by exact title match → `mcporter call snap-happy.TakeScreenshot windowId:<id> --save-images <tmp>`. Snapshot path uses first-12-chars sha256 of `src/a2glimpse-host.html` (currently `5bf7bad3e1dc`).
- Added `test:visual` and `test:visual:update` npm scripts.
- Blessed goldens. Visual inspection: Button, Card+Text, Modal trigger, TextField+Button form all render as expected. Tabs + MultipleChoice render thinly (no tabs visible, options not visible). Those are pre-existing renderer-host theme issues called out in the POC retrospective; Phase 1's job is to lock down current state, Phase 3 polish is where they get fixed.

**Considered / rejected:**
- **Silently upgrading byte-equal to pixel-diff when byte-equal failed.** Rejected. The plan's "byte-equal acceptable for v1" assumption is empirically false on this host (3 back-to-back runs produced 2–5 spurious failures with 10–100 byte deltas from PNG encoder non-determinism + sub-pixel AA + caret blink). Plan revision is not my call. SOFT_BLOCK with retro: `knowledge/20260509-141700.phase1-visual-harness.retrospective.md`.
- **Editing `src/a2glimpse-host.html` to disable animations / focus rings for deterministic capture.** Rejected — brief explicitly forbids ("Vendored renderer is read-only ... if you find yourself wanting to, STOP and report it as a HARD_BLOCK").
- **Saving the actual capture via the path snap-happy already wrote to `~/Desktop/snaphappy/`.** Rejected — `--save-images` to a per-run scratch dir is cleaner and isolates from desktop noise.
- **Synthesizing a fixture-controlled "no focus" state to defeat caret blink.** Possible but not enough by itself — sub-pixel AA also varies. Pixel-diff with tolerance is the actual fix.

**Open / next:**
- SOFT_BLOCK: comparison mode acceptance criterion fails because byte-equal is not deterministic for WKWebView captures on this host. Goldens are blessed and visibly correct; capture pipeline is verified. Need orchestrator/Brian decision on tolerance + dep stance (shell out to `magick compare` vs add a tiny dev dep like pngjs+pixelmatch). Recommendation in retro.
- One run captured iTerm instead of a2glimpse for `text-field-form` (370KB instead of ~17KB). Did not reproduce. Likely small race between window creation and snap-happy ListWindows visibility. Worth a retry-on-size-anomaly hardening pass once pixel-diff is in.
- Tabs and MultipleChoice fixtures captured almost-empty surfaces. Real visual issues, but they're pre-existing and Phase 3's job. Goldens lock current behavior so regressions are detectable.

---
