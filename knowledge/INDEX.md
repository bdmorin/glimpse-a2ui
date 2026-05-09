# Knowledge Index — glimpse-a2ui

Durable reference material for this fork. Read these before touching code in a new session.

## Append-Only Narrative

- [DEV_LOG.md](DEV_LOG.md) — session-by-session rationale, alternatives weighed, deliberate non-actions. Read recent entries to understand current state. Append when finishing meaningful work; never edit past entries.
- [AUDIT_LOG.md](AUDIT_LOG.md) — who/what/where ledger of agent dispatches, worktree work, blockers, deferrals. Sister to DEV_LOG; AUDIT_LOG owns lineage, DEV_LOG owns rationale.
- [log/](log/) — per-slice DEV_LOG / AUDIT_LOG fragments written by parallel worktree agents. Aggregated into DEV_LOG.md / AUDIT_LOG.md at merge time. Convention: [parallel-agent log fragments](20260509-145843.parallel-agent-log-fragments.knowledge.md).
- [Worktree Isolation Verification](20260509-152436.worktree-isolation-verification.knowledge.md) — MANDATORY first-action check for worktree-dispatched agents; HARD_FAIL if not in an isolated worktree. Codifies the Phase 3 root-cause finding.
- [Vendored Renderer Pathologies](20260509-154525.vendored-renderer-pathologies.knowledge.md) — three levers (CSS custom properties, additionalStyles, prototype patching) for reaching shadow-DOM components without touching the IIFE. Documents two confirmed renderer bugs (Tabs theme-gap, MultipleChoice schema/element mismatch).
- [Renderer Re-vendor Runbook](20260509-172345.renderer-revendor-runbook.knowledge.md) — step-by-step procedure for adopting a new v0.8.x bugfix bundle from upstream `@a2ui/lit`. Pinning policy, trust-boundary diff check, workaround re-verification, visual re-bless protocol, rollback. **LIKELY (unproven) — first operator edits in place.**
- [Renderer Bundle Pins](renderer-bundle-pins.md) — append-only ledger of every vendored bundle that has shipped. Pair with the runbook on every re-vendor.
- [Agent Dispatch Procedure](20260509-160946.agent-dispatch-procedure.knowledge.md) — end-to-end runbook for orchestrator sessions dispatching worktree-isolated sub-agents. Synthesizes the three companion conventions into a single playbook covering pre-dispatch checks, prompt template, monitoring, merge protocol, recovery, and outcome vocabulary.

## Distribution / Packaging

- [Apple Developer Onboarding](20260509-172625.apple-developer-onboarding.knowledge.md) — from-zero walkthrough of enrollment, Developer ID Application cert generation, codesign, and notarytool flow for distributing the `.app` bundle produced by `npm run build:app` (slice C1).

## Active Plan

- [Polish + Hardening Plan (2026-05-09)](20260509-140000.polish-and-hardening-plan.plan.md) — phased plan with worktree assignments, conventions, and bail rules. **Read before dispatching worktree agents.**

## Agent Surface

- [Agent Control Surface — Pattern Catalog](20260509-180000.agent-control-surface.knowledge.md) — the seven canonical A2UI v0.8 patterns coding agents should use (confirm / choice / multi-choice / free-text / status / diff-review / command-approval), with copy-paste-modify JSONL examples and expected `userAction` shapes. Substrate for HANDOFF.md A2 (MCP bridge) and A3 (agent skill).

## Pre-Implementation Baseline (2026-05-09)

- [A2UI Protocol Overview](20260509-162039.a2ui-protocol-overview.knowledge.md) — what A2UI is, who owns it, security model, repo layout. **Read first.**
- [Glimpse Upstream Snapshot](20260509-162039.glimpse-upstream-snapshot.knowledge.md) — frozen baseline of HazAT/glimpse at fork point. The reference for "what was this in upstream?"
- [Fork Architecture](20260509-162039.fork-architecture.analysis.md) — keep/swap/add design decisions, MVP path, costs, competing hypotheses. **This is an assessment, not built code.**
- [External References](20260509-162039.external-references.reference.md) — authoritative URLs for specs, renderers, adjacent projects.

## Upstream Filings

- [filings/README.md](filings/README.md) — filing-ready GitHub issue bodies for `google/A2UI` (Tabs theme-gap, MultipleChoice type/variant, MultipleChoice empty-literalArray). Slice B1 deliverable.

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
