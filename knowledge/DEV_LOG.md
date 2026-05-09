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

## 2026-05-09 ~14:35 — Phase 1 follow-up: pixel-diff + test-mode CSS

**Author:** Claude (Opus 4.7), worktree agent in `worktree-agent-ace4a890f72f16fb8`
**Context:** Resumed after the SOFT_BLOCK report (prior DEV_LOG entry 2026-05-09 ~14:17). Brian made the calls: shell out to ImageMagick `compare` at 0.1% threshold, inject test-mode CSS via the *host page wrapper* (head/body region — not the vendored Lit blob), wire activation through Swift via WKUserScript when `--test-mode`/`A2GLIMPSE_TEST_MODE` is on. Re-bless goldens, then verify stability across 3 back-to-back compare runs.

**Did:**
- `src/a2glimpse-host.html`: added a second `<style id="a2glimpse-test-mode">` block scoped to `body[data-test-mode]` — animations/transitions off, caret transparent, focus rings/box-shadows neutralized. Inert when the attribute is absent. Edited only the wrapper head; the vendored Lit IIFE (lines 11+) is untouched.
- `src/a2glimpse.swift::makeWebViewConfiguration()`: when `config.testMode` is on, register a second `WKUserScript` (atDocumentStart) that sets `document.body.dataset.testMode = ''`. One-way Swift→page signal; no new public stdin command, trust boundary intact.
- `test/visual.mjs`: replaced byte-equal compare with `runCmd('/opt/homebrew/bin/compare', ['-metric','AE','-fuzz','0%', ...])`. Parses absolute pixel-diff from stderr (handles both `<n>` and `<n> (<norm>)` formats). `THRESHOLD_PERCENT = 0.1` constant. Per-fixture line: `<fixture>: <diff> / <total> = <pct>% [PASS|FAIL]`. Diff PNG written to `test/__snapshots__/<hash>/diffs/<fixture>.diff.png` on failure. Added `cropTitlebar()` helper that shaves the top 32px off each capture before bless or compare — see "Considered/rejected" below. Added window-size verification with cap-1 retry: if captured PNG isn't 480x352 (or 2x for Retina), retry once after 500ms then fail loudly.
- Re-blessed goldens. Renderer hash changed from `5bf7bad3e1dc` to `a0ce316e1b7e` (host-html edited). Old snapshot dir deleted.
- Stability check: ran `node test/visual.mjs` three times back-to-back. Run 1: 6/6 PASS, worst 0.0052%. Run 2: 6/6 PASS. Run 3: 6/6 PASS. Per-run noise floor is 0–8 pixels out of 153,600 (≤0.0052%), well under the 0.1% threshold.
- Plan-doc edit: `knowledge/20260509-140000.polish-and-hardening-plan.plan.md` Phase 1 — replaced "byte-equal acceptable for v1" with the pixel-diff + host-page-CSS language Brian dictated; updated Acceptance to "passes pixel-diff (≤0.1%) across three back-to-back runs."

**Considered / rejected:**
- **Comparing the full 480x352 captured PNG (titlebar included).** Tried it first. Diff was a stable 262 px (0.155%) — just above threshold. Connected-components analysis revealed *all* the diff pixels live in the top 32 pixels: traffic-light buttons (red/yellow/green at +9,+9 / +32,+9 / +55,+9) plus corner antialiasing where the OS draws focus state. The renderer content is bit-exact across runs. Cropping the titlebar before compare is the right scope — we test the *renderer*, not the OS chrome. Documented `TITLEBAR_HEIGHT = 32` and `CONTENT_HEIGHT = 320` constants so a future test-mode geometry tweak is one line.
- **Loosening `THRESHOLD_PERCENT` to 0.2% to absorb the titlebar jitter.** Rejected per the standing rule against papering over instabilities. The right move is to remove the noise source (crop), not raise the bar.
- **Hiding the titlebar entirely via `NSWindow.styleMask` in test mode.** Possible but invasive — it would change focus/keyboard behavior and break the `--title`-based window discovery used for `snap-happy.ListWindows`. Crop is cheaper and keeps the runtime semantics identical.
- **Generalizing the retry loop into a configurable retry count.** Rejected — brief explicitly says cap at 1, don't loop.

**Open / next:**
- Phase 1 acceptance met: pixel-diff harness green 6/6 across 3 runs.
- One observation worth a follow-up if it bites again: the iTerm-instead-of-a2glimpse anomaly from the prior run did not reproduce in any of the 3 stability runs after the window-size verify-and-retry was added. Treat as resolved-pending-recurrence.
- Trust boundary verified: only changes to the public surface are CSS in the host wrapper (geometry/timing) and a Swift-internal user script. No new stdin commands, no new bridge functions, no edits to the vendored Lit IIFE.

---

## 2026-05-09 ~19:40 — Phase 2a: harden renderer-host load (drop cwd fallback)

**Author:** Claude (Opus 4.7), worktree agent in `worktree-agent-a2c9866b899106cca`
**Context:** Phase 2a of `knowledge/20260509-140000.polish-and-hardening-plan.plan.md`. POC retro recommendation #1: the upstream-derived `loadRendererHost()` had a deterministic "next to binary" path *plus* a cwd-relative `src/a2glimpse-host.html` fallback *plus* a silent `loadHTMLString("Missing a2glimpse renderer host.")` last-ditch case. The fallbacks made packaging failures invisible to the user and let an inconsistent setup limp along. Trust-boundary-adjacent: a non-deterministic load path is a soft attack surface (someone could drop a host file in cwd and have it preferred over the bundled one in some launch scenarios).

**Did:**
- `src/a2glimpse.swift::loadRendererHost()`: collapsed three branches into one. Resolve `executableDir` from `CommandLine.arguments[0]` with `standardizedFileURL.resolvingSymlinksInPath().deletingLastPathComponent()` so a symlinked binary still resolves to the real install dir. Look only at `executableDir/a2glimpse-host.html`. If absent → write a single explanatory line to stderr (`[a2glimpse] FATAL: renderer host not found at <path>. The bundled a2glimpse-host.html must sit adjacent to the binary. Reinstall ... or rebuild via npm run build:macos.`) and `exit(2)`. No HTML placeholder, no second path tried.
- Verified the failure path manually: temporarily renamed `src/a2glimpse-host.html`, ran the binary, observed stderr line + `exit 2`, restored the file. Smoke and visual harness both green pre- and post-change. Visual hash unchanged (`a0ce316e1b7e`) — no goldens were touched.

**Considered / rejected:**
- **Keeping a cwd fallback gated to `--dev` or `A2GLIMPSE_DEV=1`.** Rejected. A second resolution path is the exact thing the brief says to remove, and there isn't a development scenario the bundled-adjacent path can't already serve (rebuild puts the host next to the freshly-built binary). The brief is also explicit that any new stdin/env trust-surface is out of scope here.
- **Logging via the existing `log()` helper instead of writing directly to stderr.** Rejected — `log()` only fires when `config.verbose` is set, and a fatal-path message must always emit. Direct `FileHandle.standardError.write` mirrors how unrecoverable failures should signal regardless of verbosity.
- **Falling through to `loadHTMLString("Missing renderer host")` so the WebView still mounts and the wrapper at least sees `closed`.** Rejected — that's the papering-over the brief explicitly bans. A missing host is unrecoverable; failing fast with a non-zero exit is the contract.
- **Returning a specific exit code per failure mode (e.g. 2 for missing host, 3 for malformed, etc.).** Out of scope; only one failure mode here today, and we don't have a documented exit-code table to slot into. Picked `2` to be distinguishable from `1` (Swift's default crash) and `0` (success).
- **Resolving via `Bundle.main.bundleURL` instead of `CommandLine.arguments[0]`.** Rejected for now — the binary is not yet a `.app` bundle (POC scope), and `Bundle.main` for a bare CLI on macOS resolves to the executable's directory, which is what `argv[0]` already gives us. Revisit when `.app` packaging lands.

**Open / next:**
- Phase 2b (`wt/harden-test-gating`) and Phase 2c (`wt/harden-ready-signal`) still pending; they were dispatched as parallel slices.
- `scripts/postinstall.mjs` doesn't currently verify the host-html file ends up alongside the binary post-install. Not in scope here, but worth a note if a future packaging change ever decoupled `src/a2glimpse-host.html` from the binary's directory.

---

## 2026-05-09 ~19:40 — Phase 2b: gate test-only `__test-click` behind `--test-mode`

**Author:** Claude Opus 4.7, worktree sub-agent (`worktree-agent-a646e99e1c9b45bba`)
**Context:** POC retrospective flagged the synthetic-click path as "useful for CI but should not exist in production command handling unless explicitly gated." Phase 2b in `knowledge/20260509-140000.polish-and-hardening-plan.plan.md` owns the fix. Phase 1 had already added a `--test-mode` flag (and `A2GLIMPSE_TEST_MODE=1` env fallback) for deterministic visual capture; that flag is the natural gate to extend.

**Did:**
- Audited `handleCommand` in `src/a2glimpse.swift` for test-only paths. Only one exists: `__test-click` (the `__` prefix and synthetic-`.click()` semantics confirm). All other cases (`follow-cursor`, `get-info`, `show`, `title`, `resize`, `close`) are production lifecycle commands.
- Gated `__test-click` on `config.testMode`. When test-mode is off, the dispatcher logs the rejection to stderr and returns the same `{"error":{"message":"Unknown command type: __test-click"}}` shape it would for any other unrecognized command — no information disclosure that the path exists.
- Added a `testMode` option to the Node wrapper `open()` in `src/a2glimpse.mjs` so callers can opt in. Production callers that don't pass it cannot reach the synthetic-click path even by writing the JSON shape directly to stdin.
- Updated `test/test.mjs` to pass `testMode: true` so the smoke test continues to exercise the click round-trip.

**Considered / rejected:**
- A separate `--allow-test-commands` flag distinct from `--test-mode`. Rejected — the brief is explicit that Phase 1's gate must be reused, and the flag's existing semantics (geometry locking, animation neutralization) already imply "this is a test harness, not a production session." A second flag would split the trust boundary into two switches with no upside.
- Silently swallowing `__test-click` (return without logging or emitting an error). Rejected — a stdout error matching the unknown-command shape is the right signal for a misconfigured caller, and stderr logging gives the operator a breadcrumb without leaking details over the protocol channel.
- Removing `__test-click` entirely and switching `test.mjs` to AppleScript-driven real clicks. Out of scope; that's a Phase 1+ rework, not a hardening pass.

**Open / next:**
- Trust-boundary grep clean: no `"html"`/`"file"`/`"eval"` cases in `src/a2glimpse.swift`. Synthetic-click now requires explicit opt-in.
- Verification command for the rejection path (documented for future audits):
  `(printf '{"type":"__test-click","id":"button"}\n{"type":"close"}\n'; sleep 1) | ./src/a2glimpse --hidden --title rejection-test`
  Expected: stderr `[a2glimpse] __test-click rejected: --test-mode not enabled`; stdout `{"error":{"message":"Unknown command type: __test-click"}}` then `{"type":"closed"}`.

---

## 2026-05-09 ~14:43 — Phase 2c renderer-host ready signal

**Author:** Claude (Opus 4.7), worktree agent in `worktree-agent-aa247821a8108b3c7`
**Context:** Phase 2c of the polish-and-hardening plan (`wt/harden-ready-signal`). POC retrospective flagged that `ready` had two meanings: WebKit `didFinish` versus the renderer host actually being able to receive `surfaceUpdate` messages. Today the binary emits stdout `ready` from `didFinish`, which means a downstream agent that immediately writes `surfaceUpdate` can hit a window where the Lit `<a2ui-surface>` element isn't registered yet and `window.a2glimpse.dispatch` doesn't exist. Brief: don't ship `ready` until both signals are true; never paper over the host-ready signal failing to arrive (no fallback timer).

**Did:**
- Read the vendored host bundle. Found that the IIFE already dispatches a `CustomEvent("a2glimpse-host-ready")` from `A2GlimpseApp.connectedCallback` immediately after wiring `window.a2glimpse.dispatch` and after `customElements.define("a2glimpse-app", ...)`. That's the exact contract — no IIFE edits needed.
- Added `<script id="a2glimpse-host-ready-shim">` to `src/a2glimpse-host.html`, *outside* the IIFE (after its closing `</script>`, before `</body>`). It listens for the CustomEvent and posts `{__a2glimpse_host_ready: true}` to `webkit.messageHandlers.glimpse`. Defensive fallback: a microtask-deferred check of `typeof window.a2glimpse.dispatch === 'function'` covers the script-ordering edge case where the event fires before the listener attaches. Posting is guarded against double-emit. No new global state, no new public stdin command.
- In `src/a2glimpse.swift`: added `webkitNavFinished`, `hostReady`, `readyEmitted` flags on `AppDelegate`, plus a `@MainActor maybeEmitReady()` helper. `didFinish` now flips `webkitNavFinished` and calls the helper instead of writing `ready` directly. The script-message handler recognizes `__a2glimpse_host_ready`, flips `hostReady`, and calls the helper. The helper is idempotent (`readyEmitted` guard). `getSystemInfo()` is still computed at emission time, so `cursorTip` is fresh.
- `src/a2glimpse.mjs` consumer needs no change — same JSONL `{type:"ready", ...}` shape.
- Built, ran `npm test` — green. Ran `npm run test:visual` — fails because the host-html edit changes the renderer hash from `a0ce316e1b7e` to `936f54cfb1c3`. Cross-hash `compare` of every old vs new golden: 0–8 px out of 153,600 (≤0.0052%), well below the 0.1% threshold. The visuals are bit-equal modulo capture jitter — only the hash bucket moved. Re-blessed at the new hash, deleted the old hash dir, and ran `node test/visual.mjs` three times back-to-back: 6/6 PASS each run, all at 0.0000% noise (down from 0–8 px in Phase 1's runs — tighter `ready` means less capture-time variance).
- CLI acceptance probe: spawned a fresh `a2glimpse --test-mode --no-show`, waited for `ready`, immediately wrote `test/fixtures/button-only.jsonl` lines. Renderer accepted them; no error; clean shutdown. A separate probe with a deliberately malformed component shape produced an immediate schema-validation error from the renderer at `t+2ms` after `ready` — strong evidence the surface is genuinely live at `ready`-time, not just navigated.

**Considered / rejected:**
- **Hooking inside the IIFE.** The brief makes the IIFE read-only and says STOP if a hook requires it. The IIFE already exposes the right hook (`a2glimpse-host-ready` CustomEvent), so no edit needed.
- **Adding a fallback timer that emits `ready` after N seconds even without host-ready.** Explicitly forbidden by the brief: "Don't paper over timeouts." If the host-ready message never arrives, that's a real bug to surface, not work around. The shim does have one defensive belt-and-suspenders microtask check for the listener-ordering edge case, but that's a same-tick guard, not a timeout.
- **Defining a new bridge name (`a2glimpseHost` etc.).** Rejected — reusing the existing `glimpse` messageHandler keeps the Swift handler surface small. The internal payload `{__a2glimpse_host_ready: true}` is namespaced like `__glimpse_close` already is.
- **Optional harness-settle reduction (drop the 1.5s settle in `test/visual.mjs`).** NOT taken. Visual harness is already 100% stable at 0.0000% noise; cutting the settle is value-neutral and changing test infra mid-phase risks regressions for a future agent. Left as a future tightening pass; capture-time noise floor proves `ready` is now strong enough to support it.
- **Re-blessing without the cross-hash sanity check.** Rejected — the brief warns explicitly against silent re-blessing. Confirmed cross-hash visuals are within noise floor before re-blessing.

**Open / next:**
- Phase 2c acceptance met: smoke green; visual harness green 6/6 × 3 runs at 0.0000%; CLI probe proves `ready` now means the surface can receive `surfaceUpdate`.
- Sister Phase 2 worktrees (`wt/harden-renderer-load`, `wt/harden-test-gating`) are independent of this slice; orchestrator owns merge.
- Future tightening: `test/visual.mjs` 1.5s settle could likely become 0–200ms now that `ready` is a strong signal. Punted to a polish pass.

---
