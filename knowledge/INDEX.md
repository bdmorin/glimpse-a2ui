# Knowledge Index — glimpse-a2ui

Durable reference material for this fork. Read these before touching code in a new session.

## Append-Only Narrative

- [DEV_LOG.md](DEV_LOG.md) — session-by-session rationale, alternatives weighed, deliberate non-actions. Read recent entries to understand current state. Append when finishing meaningful work; never edit past entries.
- [AUDIT_LOG.md](AUDIT_LOG.md) — who/what/where ledger of agent dispatches, worktree work, blockers, deferrals. Sister to DEV_LOG; AUDIT_LOG owns lineage, DEV_LOG owns rationale.
- [log/](log/) — per-slice DEV_LOG / AUDIT_LOG fragments written by parallel worktree agents. Aggregated into DEV_LOG.md / AUDIT_LOG.md at merge time. Convention: [parallel-agent log fragments](20260509-145843.parallel-agent-log-fragments.knowledge.md).

## Active Plan

- [Polish + Hardening Plan (2026-05-09)](20260509-140000.polish-and-hardening-plan.plan.md) — phased plan with worktree assignments, conventions, and bail rules. **Read before dispatching worktree agents.**

## Pre-Implementation Baseline (2026-05-09)

- [A2UI Protocol Overview](20260509-162039.a2ui-protocol-overview.knowledge.md) — what A2UI is, who owns it, security model, repo layout. **Read first.**
- [Glimpse Upstream Snapshot](20260509-162039.glimpse-upstream-snapshot.knowledge.md) — frozen baseline of HazAT/glimpse at fork point. The reference for "what was this in upstream?"
- [Fork Architecture](20260509-162039.fork-architecture.analysis.md) — keep/swap/add design decisions, MVP path, costs, competing hypotheses. **This is an assessment, not built code.**
- [External References](20260509-162039.external-references.reference.md) — authoritative URLs for specs, renderers, adjacent projects.

## Implementation Spike (2026-05-09)

- [A2UI Spec Grounding](20260509-121003.a2ui-spec-grounding.knowledge.md) — local verification of A2UI v0.8 message names, renderer entry points, event shape, and eval-harness fit.
- [a2glimpse POC Retrospective](20260509-130112.poc-retrospective.retrospective.md) — verdict, lessons learned, implemented subset, visual debugging notes, and next-step recommendations after the first visible spike.

## Reading Order for a Fresh Session

1. `a2ui-protocol-overview.knowledge.md` — ground yourself in the protocol.
2. `glimpse-upstream-snapshot.knowledge.md` — see the baseline.
3. `fork-architecture.analysis.md` — understand the plan.
4. `a2ui-spec-grounding.knowledge.md` — see what was verified against the local A2UI clone.
5. `poc-retrospective.retrospective.md` — understand what actually worked and what remains product work.
6. `external-references.reference.md` — bookmark the source-of-truth links.

Then read upstream `AGENTS.md` for project conventions.

## Rules

- **`.md` only.** No `.mdx`.
- **Filename:** `YYYYMMDD-HHMMSS.descriptive-name.type.md` where `type` ∈ {knowledge, analysis, reference, retrospective, ...} and matches frontmatter `type:`.
- **Frontmatter required.** YAML between `---` fences. Common-core fields where applicable (`title`, `date`, `description`, `tags`); add `confidence`, `provenance`, `lineage` for analytical content.
- **Co-locate by topic.** This folder, not parallel trees by category.
