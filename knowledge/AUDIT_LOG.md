# a2glimpse Audit Log

Append-only ledger of agent dispatches, worktree work, blockers, and deferrals. Use this to trace **who/what/where** for any change. Sister file to `DEV_LOG.md`: DEV_LOG captures *why* and *what was considered*, AUDIT_LOG captures *who acted, where, and what the outcome was*.

## Format

```
## YYYY-MM-DD HH:MM — short title
**Agent:** model / role (e.g. Claude Opus 4.7, orchestrator | sub-agent general-purpose)
**Worktree:** wt/<slice> (or `main` if direct)
**Lineage:** parent agent / dispatching session / prior audit entry
**Action:** terse verb summary
**Outcome:** OK | SOFT_BLOCK | HARD_BLOCK | FAIL | DEFERRED
**Artifacts:** files touched, fixtures added, knowledge entries written
**Notes:** anything a future reader needs to interpret the entry
```

If `Outcome` is `SOFT_BLOCK` / `HARD_BLOCK` / `FAIL`, also write a retrospective in `knowledge/` using the standard timestamped retro filename and link it from the entry's `Artifacts:` line.

If `Outcome` is `DEFERRED`, log the bail reason in `DEV_LOG.md` per the AGENTS.md "bail-and-log" rule and reference the DEV_LOG section here.

Never edit past entries. Correct with a follow-up entry that references the prior one by timestamp.

---

## 2026-05-09 ~14:00 — Audit log scaffold created
**Agent:** Claude Opus 4.7, orchestrator
**Worktree:** main
**Lineage:** Phase 0 of polish + framework-hardening plan (this session)
**Action:** Initialize `knowledge/AUDIT_LOG.md`. No prior entries to preserve.
**Outcome:** OK
**Artifacts:** `knowledge/AUDIT_LOG.md`
**Notes:** Ledger is now ready for worktree-agent dispatches in subsequent phases.

---

## 2026-05-09 ~14:17 — Phase 1 visual-regression harness
**Agent:** Claude Opus 4.7 (1M ctx), worktree sub-agent
**Worktree:** `worktree-agent-ace4a890f72f16fb8` (off `main` @ 351775c, fast-forwarded to d44b78a before work)
**Lineage:** Phase 1 of `knowledge/20260509-140000.polish-and-hardening-plan.plan.md`; dispatched by orchestrator session 2026-05-09
**Action:** Built `--test-mode` flag in Swift host, six A2UI v0.8 fixtures, `test/visual.mjs` capture+compare CLI, mcporter-routed snap-happy capture, renderer-hash-keyed snapshot dir, npm scripts, blessed goldens.
**Outcome:** SOFT_BLOCK
**Artifacts:**
- `src/a2glimpse.swift` (added `--test-mode` flag + env-var fallback, geometry lock, no-op of resize/follow-cursor in test mode)
- `test/fixtures/{button-only,card-text,modal,multiple-choice,text-field-form,tabs}.jsonl`
- `test/visual.mjs`
- `test/__snapshots__/5bf7bad3e1dc/{button-only,card-text,modal,multiple-choice,text-field-form,tabs}.png` (six blessed goldens)
- `package.json` (added `test:visual`, `test:visual:update` scripts)
- `knowledge/DEV_LOG.md` (new entry 2026-05-09 ~14:17)
- Retro: `knowledge/20260509-141700.phase1-visual-harness.retrospective.md`
**Notes:** Capture pipeline works end-to-end; goldens are visually correct (4/6 components render as expected; Tabs and MultipleChoice render thinly per pre-existing POC-retro findings — Phase 3's job). The plan's byte-equal-comparison assumption is empirically false on this host: WKWebView captures vary 10–100 bytes run-to-run from PNG-encoder + sub-pixel AA + caret-blink jitter. Did NOT silently swap in pixel-diff — that's a plan revision. Recommendation in retro: decide tolerance + tooling (shell out to ImageMagick `compare` vs add a tiny dev dep), then re-bless. Smoke test (`npm test`) green throughout.

---

## 2026-05-09 ~14:35 — Phase 1 follow-up: pixel-diff + test-mode CSS
**Agent:** Claude Opus 4.7 (1M ctx), worktree sub-agent (resumed)
**Worktree:** `worktree-agent-ace4a890f72f16fb8` (continued from prior entry)
**Lineage:** continuation of 2026-05-09 ~14:17 SOFT_BLOCK; retro `knowledge/20260509-141700.phase1-visual-harness.retrospective.md`. Decisions provided by Brian via orchestrator on resume: ImageMagick `compare` at 0.1% threshold, host-page CSS scaffolding for test-mode determinism, 3-run stability gate, cap-1 window-size retry.
**Action:** Implemented pixel-diff via shelling out to `/opt/homebrew/bin/compare`. Added test-mode CSS scaffold to `src/a2glimpse-host.html` head (wrapper region only — vendored Lit IIFE untouched). Wired activation via WKUserScript in `src/a2glimpse.swift` that sets `body.dataset.testMode` when `--test-mode`. Added titlebar-crop step (the 262-px residual jitter localized entirely to the titlebar's traffic-light controls; cropping to the 480x320 content area drops the noise floor to ≤8 px / 0.0052%). Added window-size verify with one retry. Re-blessed goldens at new renderer hash `a0ce316e1b7e`. Ran compare 3x back-to-back: 6/6 PASS each run.
**Outcome:** OK
**Artifacts:**
- `src/a2glimpse-host.html` (added `<style id="a2glimpse-test-mode">` block, wrapper region only)
- `src/a2glimpse.swift` (`makeWebViewConfiguration`: register testMode-activation `WKUserScript` when `config.testMode`)
- `test/visual.mjs` (ImageMagick `compare` integration, `THRESHOLD_PERCENT = 0.1`, titlebar crop, window-size retry)
- `test/__snapshots__/a0ce316e1b7e/{button-only,card-text,modal,multiple-choice,text-field-form,tabs}.png` (re-blessed goldens, 480x320 content-only)
- `test/__snapshots__/5bf7bad3e1dc/` (deleted — stale renderer hash)
- `knowledge/20260509-140000.polish-and-hardening-plan.plan.md` (Phase 1 prose updated: pixel-diff via `compare` at 0.1%, host-page CSS scaffolding, 3-run acceptance)
- `knowledge/DEV_LOG.md` (new entry 2026-05-09 ~14:35)
**Notes:** Trust boundary intact — no new public stdin commands, no new `glimpse.*` bridge functions. The vendored Lit IIFE in `a2glimpse-host.html` (script block from line ~11 onward) was not touched; only the wrapper head/body region got CSS additions. Stability runs: worst-run noise 0.0052%, best 0.0000% — fully clear of the 0.1% threshold. The iTerm-capture race from the prior session did not reproduce; window-size verification was added defensively per the brief.

---

## 2026-05-09 ~19:40 — Phase 2a: harden renderer-host load
**Agent:** Claude Opus 4.7 (1M ctx), worktree sub-agent
**Worktree:** `worktree-agent-a2c9866b899106cca` (rebased onto `main` @ 096d310 before work to pull in Phase 1 plan + harness)
**Lineage:** Phase 2a of `knowledge/20260509-140000.polish-and-hardening-plan.plan.md`; dispatched by orchestrator session 2026-05-09. Implements POC-retro recommendation #1 (drop cwd renderer fallback).
**Action:** Collapsed `loadRendererHost()` to a single deterministic path (`<dir-of-binary>/a2glimpse-host.html`). Removed cwd `src/a2glimpse-host.html` fallback and the silent `loadHTMLString("Missing a2glimpse renderer host.")` last-ditch case. Missing host → explanatory stderr line (`[a2glimpse] FATAL: ...`) + `exit(2)`. Resolution uses `standardizedFileURL.resolvingSymlinksInPath()` so symlinked launches still find the real install dir.
**Outcome:** OK
**Artifacts:**
- `src/a2glimpse.swift` (`loadRendererHost()` rewritten; ~17 lines → ~17 lines, three branches → one)
- `knowledge/DEV_LOG.md` (entry 2026-05-09 ~19:40)
**Notes:** Trust boundary intact — no new stdin commands, no new bridge functions, host HTML and vendored Lit untouched. Pre- and post-change `npm test` (smoke) green. `npm run test:visual` green at unchanged renderer hash `a0ce316e1b7e` (no re-bless). Manual fail-path verified by temporarily renaming the host file: stderr line printed, exit code 2, then file restored before any commit.

---

## 2026-05-09 ~19:40 — Phase 2b: test-only command gating
**Agent:** Claude Opus 4.7 (1M ctx), worktree sub-agent
**Worktree:** `worktree-agent-a646e99e1c9b45bba` (rebased onto `main` @ 096d310 to pick up Phase 1)
**Lineage:** Phase 2b of `knowledge/20260509-140000.polish-and-hardening-plan.plan.md`; row `wt/harden-test-gating`. Concern originates in `knowledge/20260509-130112.poc-retrospective.retrospective.md`.
**Action:** Gate `__test-click` synthetic-click path in `handleCommand` behind `config.testMode` (i.e. `--test-mode` flag or `A2GLIMPSE_TEST_MODE=1` env). Add `testMode` option to Node wrapper `open()`. Update smoke test to opt in.
**Outcome:** OK
**Artifacts:**
- `src/a2glimpse.swift` (gate added in `__test-click` case with rationale comment)
- `src/a2glimpse.mjs` (new `testMode` option in `open()`)
- `test/test.mjs` (passes `testMode: true`)
- `knowledge/DEV_LOG.md` (entry 2026-05-09 ~19:40)
**Notes:** Audit confirmed `__test-click` is the only test-only command in the dispatcher. Default-dispatch rejection emits the unknown-command error shape — no path disclosure. Acceptance: `npm test` 7/7 ✓; `npm run test:visual` 6/6 ✓ (worst diff 0.0052%, threshold 0.1%); manual rejection verified with `(printf '{"type":"__test-click","id":"button"}\n{"type":"close"}\n'; sleep 1) | ./src/a2glimpse --hidden --title rejection-test` → `{"error":{"message":"Unknown command type: __test-click"}}`. Trust-boundary grep clean: no `"html"`/`"file"`/`"eval"` cases reintroduced.

---

## 2026-05-09 ~14:43 — Phase 2c renderer-host ready signal
**Agent:** Claude Opus 4.7 (1M ctx), worktree sub-agent
**Worktree:** `worktree-agent-aa247821a8108b3c7` (off `main` @ 351775c, fast-forwarded to 096d310 before work)
**Lineage:** Phase 2c of `knowledge/20260509-140000.polish-and-hardening-plan.plan.md` (`wt/harden-ready-signal`); addresses POC-retro finding "ready has two meanings" (`knowledge/20260509-130112.poc-retrospective.retrospective.md`).
**Action:** Added wrapper-shim `<script id="a2glimpse-host-ready-shim">` (outside the vendored Lit IIFE) in `src/a2glimpse-host.html` that listens for the IIFE's existing `a2glimpse-host-ready` CustomEvent and posts `{__a2glimpse_host_ready: true}` via `webkit.messageHandlers.glimpse`. In `src/a2glimpse.swift` added `webkitNavFinished` / `hostReady` / `readyEmitted` state and a `maybeEmitReady()` helper; stdout `ready` now emits only when both signals are true, idempotent. WebKit `didFinish` no longer emits `ready` directly. `src/a2glimpse.mjs` needs no change — same JSONL shape, just later. Re-blessed visual goldens at new renderer hash `936f54cfb1c3` (host-html edit shifts the hash key; cross-hash compare vs prior `a0ce316e1b7e` goldens shows 0–8 px out of 153,600 — visuals are unchanged, only the bucket moved).
**Outcome:** OK
**Artifacts:**
- `src/a2glimpse-host.html` (added wrapper-shim script after IIFE close; vendored IIFE untouched)
- `src/a2glimpse.swift` (ready coordination state + `maybeEmitReady()` + `__a2glimpse_host_ready` message handler; refactored `didFinish`)
- `test/__snapshots__/936f54cfb1c3/{button-only,card-text,modal,multiple-choice,text-field-form,tabs}.png` (re-blessed goldens, hash bump only)
- `test/__snapshots__/a0ce316e1b7e/` (deleted — stale renderer hash)
- `knowledge/DEV_LOG.md` (entry 2026-05-09 ~14:43)
**Notes:** Trust boundary unchanged — the new bridge message is a one-way page→Swift signal inside the trusted process, not exposed on stdin. Vendored Lit IIFE remained read-only; it already dispatched `a2glimpse-host-ready` after `customElements.define` and `window.a2glimpse` wiring (line 10701), which is exactly the contract Phase 2c needed. Acceptance: `npm test` green; `npm run test:visual` green 6/6 across 3 back-to-back runs (all 0.0000% noise — `ready` is now tighter, capture-time variance dropped from 0–8 px to 0 px); CLI probe sent a valid fixture immediately after `ready` and the renderer accepted it without error (and a separate probe with a malformed payload produced an immediate schema-validation error from the renderer, proving the surface is genuinely live at `ready`-time, not merely navigated). Optional harness-settle reduction NOT taken — visual harness is already 100% stable at 0.0000%, value-neutral to change; left for a future tightening pass.

---
