# Upstream Filings — google/A2UI

Filing-ready GitHub issue bodies for the A2UI vendored renderer bugs surfaced during the a2glimpse Phase 3 polish arc. Each file contains YAML frontmatter (target URL, proposed issue title, lineage) plus the issue body itself starting at the H1. Brian copies from the H1 onward into the "New Issue" form at the URL in `issue_url_target`.

Recon-derived house style applied — terse, repo-relative paths, paste-ready repro JSONL, no preamble, no emoji, no labels (let triage apply them).

## The three filings (file in this order, cross-reference each other)

1. **[Tabs theme-gap](20260509-172158.tabs-theme-gap.filing.md)**
   - Title: `[@a2ui/lit] Tabs.render: blank component when defaultTheme.components.Tabs.element is missing`
   - Pure renderer crash; minimal repro fits in two JSONL lines; suggested fix is one-line defensive default or fixed defaultTheme.

2. **[MultipleChoice type-vs-variant mismatch](20260509-172158.multiplechoice-type-variant.filing.md)**
   - Title: `[@a2ui/lit] MultipleChoice silently ignores spec field type (element reads .variant)`
   - Spec/element divergence; silent property drop; cross-reference closed #574 for historical context.

3. **[MultipleChoice empty-array selections crash](20260509-172158.multiplechoice-empty-selections.filing.md)**
   - Title: `[@a2ui/lit] MultipleChoice.getCurrentSelections throws when selections.literalArray is []`
   - Renderer crash on spec-valid input; cross-reference closed #574 for historical context.

## Cross-referencing order

File (1) first — it's the cleanest standalone filing and establishes the audit context. Then (2) and (3) as a paired set under the MultipleChoice umbrella; their "Related issues" sections already point at each other and at (1). After filing, update each `Related issues` block in the filings if Brian gets real issue numbers back so the chain is bidirectional.

## What to do before pasting

- Verify the bundle path / version reference in each filing matches what Brian wants to disclose in public (the source-of-truth line numbers in the upstream repo are exact; the consumer-bundle line numbers are from our vendored copy and are illustrative).
- Filing 2 has a `<verify exact source path>` placeholder for the catalog binding location in the in-tree Lit source; if Brian wants it pinned to a path before pasting, grep `case "MultipleChoice"` under `renderers/lit/src/0.8/` in a fresh `google/A2UI` checkout.
