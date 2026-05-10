# Knowledge Index — glimpse-a2ui

Durable reference material for this fork. Read these before touching code in a new session.

## Append-Only Narrative

- [DEV_LOG.md](DEV_LOG.md) — session-by-session rationale, alternatives weighed, deliberate non-actions. Read recent entries to understand current state. Append when finishing meaningful work; never edit past entries.
- [AUDIT_LOG.md](AUDIT_LOG.md) — who/what/where ledger of agent dispatches, worktree work, blockers, deferrals. Sister to DEV_LOG; AUDIT_LOG owns lineage, DEV_LOG owns rationale.
- [log/](log/) — per-slice DEV_LOG / AUDIT_LOG fragments written by parallel worktree agents. Aggregated into DEV_LOG.md / AUDIT_LOG.md at merge time. Convention: [parallel-agent log fragments](20260509-145843.parallel-agent-log-fragments.knowledge.md).
- [Worktree Isolation Verification](20260509-152436.worktree-isolation-verification.knowledge.md) — MANDATORY first-action check for worktree-dispatched agents; HARD_FAIL if not in an isolated worktree. Codifies the Phase 3 root-cause finding.
- [Parallel Branches and the Visual-Golden Host Hash](20260510-020000.parallel-branch-host-hash.knowledge.md) — when two branches both edit `src/a2glimpse-host.html`, the visual-golden host hash rotates per side. Re-bless once at merge — never on each branch in isolation. Don't `rm -rf test/__snapshots__/*/` to clean up; you'll nuke the other branch's baseline.
- [Vendored Renderer Pathologies](20260509-154525.vendored-renderer-pathologies.knowledge.md) — three levers (CSS custom properties, additionalStyles, prototype patching) for reaching shadow-DOM components without touching the IIFE. Documents two confirmed renderer bugs (Tabs theme-gap, MultipleChoice schema/element mismatch).
- [Shadow-DOM CSS Scoping Pathology](20260509-214700.shadow-dom-css-scoping-pathology.knowledge.md) — why light-DOM `<style>` selectors silently fail against `a2ui-*` renderer components (two shadow roots deep) while custom-property inheritance still works. The fix pattern: inject `<style>` into the right shadow scope. Architectural truth that was missed during the early polish arc.
- [Investigation Methodology and Lever Vocabulary](20260509-220000.investigation-methodology-and-lever-vocabulary.knowledge.md) — the operating philosophy + reusable techniques behind the styling work: three-round CSS cause-isolation, the wrapperPatch trust-boundary-clean mutation lever, and the corrected five-lever framing. Read this before investigating any renderer-related bug or theming issue.
- [Renderer Re-vendor Runbook](20260509-172345.renderer-revendor-runbook.knowledge.md) — step-by-step procedure for adopting a new v0.8.x bugfix bundle from upstream `@a2ui/lit`. Pinning policy, trust-boundary diff check, workaround re-verification, visual re-bless protocol, rollback. **LIKELY (unproven) — first operator edits in place.**
- [Renderer Bundle Pins](renderer-bundle-pins.md) — append-only ledger of every vendored bundle that has shipped. Pair with the runbook on every re-vendor.
- [Agent Dispatch Procedure](20260509-160946.agent-dispatch-procedure.knowledge.md) — end-to-end runbook for orchestrator sessions dispatching worktree-isolated sub-agents. Synthesizes the three companion conventions into a single playbook covering pre-dispatch checks, prompt template, monitoring, merge protocol, recovery, and outcome vocabulary.

## Distribution / Packaging

- [Apple Developer Onboarding](20260509-172625.apple-developer-onboarding.knowledge.md) — from-zero walkthrough of enrollment, Developer ID Application cert generation, codesign, and notarytool flow for distributing the `.app` bundle produced by `npm run build:app` (slice C1).
- [Desktop-Pet Sprite Ecosystem](20260509-173913.desktop-pet-sprite-ecosystem.knowledge.md) — Codex / Petdex / Openpets convergence on a shared 1536×1872 / 8×9 / 9-row sprite format, lineage, IP posture, and the "bring your own pet from `~/.codex/pets/`" plan for menubar mode.

## Active Plan

- [Polish + Hardening Plan (2026-05-09)](20260509-140000.polish-and-hardening-plan.plan.md) — phased plan with worktree assignments, conventions, and bail rules. **Read before dispatching worktree agents.**

## Agent Surface

- [Agent Control Surface — Pattern Catalog](20260509-180000.agent-control-surface.knowledge.md) — the seven canonical A2UI v0.8 patterns coding agents should use (confirm / choice / multi-choice / free-text / status / diff-review / command-approval), with copy-paste-modify JSONL examples and expected `userAction` shapes. Substrate for HANDOFF.md A2 (MCP bridge) and A3 (agent skill).
- [`skills/a2glimpse/SKILL.md`](../skills/a2glimpse/SKILL.md) — the agent skill. Teaches Claude / Codex / any SKILL.md-aware harness when to reach for `a2glimpse` (multi-step asks, diff/command approval, persistent status surfaces) and how to drive it via `mcporter call a2glimpse.<tool>`. Built on the seven-pattern catalog. Slice A3.

## Pre-Implementation Baseline (2026-05-09)

- [A2UI Protocol Overview](20260509-162039.a2ui-protocol-overview.knowledge.md) — what A2UI is, who owns it, security model, repo layout. **Read first.**
- [Glimpse Upstream Snapshot](20260509-162039.glimpse-upstream-snapshot.knowledge.md) — frozen baseline of HazAT/glimpse at fork point. The reference for "what was this in upstream?"
- [Fork Architecture](20260509-162039.fork-architecture.analysis.md) — keep/swap/add design decisions, MVP path, costs, competing hypotheses. **This is an assessment, not built code.**
- [External References](20260509-162039.external-references.reference.md) — authoritative URLs for specs, renderers, adjacent projects.

## Upstream Filings

- [filings/README.md](filings/README.md) — filing-ready GitHub issue bodies for `google/A2UI` (Tabs theme-gap, MultipleChoice type/variant, MultipleChoice empty-literalArray, CheckBox stretched-input). Slice B1 deliverable; CLA-blocked on Brian's side.

## Implementation Spike (2026-05-09)

- [A2UI Spec Grounding](20260509-121003.a2ui-spec-grounding.knowledge.md) — local verification of A2UI v0.8 message names, renderer entry points, event shape, and eval-harness fit.
- [a2glimpse POC Retrospective](20260509-130112.poc-retrospective.retrospective.md) — verdict, lessons learned, implemented subset, visual debugging notes, and next-step recommendations after the first visible spike.
- [Phase 1 Visual-Regression Harness Retro](20260509-141700.phase1-visual-harness.retrospective.md) — SOFT_BLOCK finding: byte-equal comparison doesn't survive WKWebView noise; pixel-diff threshold is the load-bearing primitive that unblocks the visual harness.
- [Visual Fixture Consolidation Decision](20260510-035000.visual-fixture-consolidation-decision.knowledge.md) — why 9, why maybe 3, why not 1. Decision space and trigger condition for collapsing the isolated fixtures into composites. The kitchen-sink composite shipped as the additive 10th fixture — the consolidation question is queued, not closed.

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
