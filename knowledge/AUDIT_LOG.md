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
