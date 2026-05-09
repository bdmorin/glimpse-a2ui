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
