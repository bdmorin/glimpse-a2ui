---
title: "Renderer Bundle Pins"
date: 2026-05-09
type: knowledge
description: >
  Append-only ledger of vendored @a2ui/lit IIFE bundles that have shipped in
  src/a2glimpse-host.html. One row per re-vendor. Pair with
  knowledge/20260509-172345.renderer-revendor-runbook.knowledge.md.
tags:
  - vendored-renderer
  - ledger
  - trust-boundary
confidence: VERIFIED
provenance: sourced
---

# Renderer Bundle Pins

Append-only ledger. One row per re-vendor. Newest at the top.

Columns:

- **Vendored date** — ISO date the swap landed on `main`.
- **Upstream sha** — `git rev-parse HEAD` of `github.com/google/A2UI` at the
  commit the bundle was built from. Short form (12 hex) is fine.
- **Upstream tag/branch** — the human label (e.g. `v0.8`,
  `release-0.8 @ <sha>`) so we can find it again.
- **File hash (SHA-256, 12 hex)** — `shasum -a 256 src/a2glimpse-host.html`,
  truncated to 12. This is what `test/visual.mjs` keys snapshots on.
- **IIFE-only hash (SHA-256, 12 hex)** — `sed -n '<begin>,<end>p'
  src/a2glimpse-host.html | shasum -a 256`. Independent of wrapper edits;
  the more durable identity for "which bundle bytes are these".
- **Vendored-by** — agent name or `brahn`.
- **Notes** — bugfix adopted, workarounds removed, anomalies.

| Vendored date | Upstream sha | Upstream tag/branch | File hash | IIFE-only hash | Vendored-by | Notes |
|---|---|---|---|---|---|---|
| `<unknown — pre-fork>` | `<unknown — capture on first re-vendor>` | v0.8.x (assumed) | `0ff4d09524c9` | `e02f68273f5b` | `<unknown>` | Initial hand-paste at fork time. Upstream sha was not recorded; first re-vendor will replace this row's blanks with the new known-good baseline and add itself as a new row above. The `e02f68273f5b` IIFE-only hash is the stable identity for "the bundle currently in tree" until a re-vendor lands. |

## Status legend (for future rows that didn't ship)

- `LIVE` — currently in tree on main.
- `SUPERSEDED` — replaced by a later row.
- `ATTEMPTED — REVERTED` — re-vendor attempted, reverted before merge.
  Document cause in Notes; cross-reference rollback DEV_LOG entry.
