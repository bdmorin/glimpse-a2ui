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
