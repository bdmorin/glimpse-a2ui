# a2glimpse — Agent Conventions

Mac-only A2UI v0.8 appliance, hardforked from [HazAT/glimpse](https://github.com/HazAT/glimpse) v0.8.0. **Status: POC complete (2026-05-09)** — plumbing proven, productization pending.

If this is your first session in this repo, **read `knowledge/INDEX.md` before touching code.** That index is the canonical entry point. This file is for orientation and conventions only.

## What This Repo Is

`a2glimpse` is a single-binary, Mac-only client that:

1. Reads A2UI v0.8 JSON Lines on stdin.
2. Renders one trusted surface in a native `WKWebView` via Google's vendored Lit renderer.
3. Emits `userAction` / `error` / lifecycle JSONL on stdout.

It is **not** upstream Glimpse anymore. The public `html`, `file`, and `eval` commands are gone. That removal is the whole point of the fork — the trust boundary now carries declarative A2UI, not arbitrary HTML/JS.

## What This Repo Is Not (Yet)

POC scope is deliberately small. Out of scope until further notice:

- Multi-surface rendering (single surface only).
- Catalog negotiation / inline catalogs.
- A2A envelope integration.
- A polished default theme; markdown rendering inside `Text` `usageHint`.
- Material Symbols / icon bundling.
- Renderer compliance suite (only smoke fixtures exist).
- `.app` packaging, signing, notarization.
- Linux / Windows backends. (Upstream Linux/Windows source was removed in repo maintenance 2026-05-09; pull from `git log --follow` if you ever need the baseline.)
- MCP server, agent skill, or coding-agent hooks (next iteration).

If a request asks for any of the above, surface it as scope expansion before implementing.

## Architecture

```
agent / script / MCP                  a2glimpse process
─────────────────────  JSONL stdin  ──────────────────────────────────
                                    ┌────────────────────────────────┐
  surfaceUpdate                     │ src/a2glimpse.swift            │
  dataModelUpdate         ────────▶ │  WKWebView host                │
  beginRendering                    │   loads src/a2glimpse-host.html│
  deleteSurface                     │   (vendored Lit v0.8 renderer) │
  + lifecycle (close, get-info,     │                                │
    show, title, resize,            │                                │
    follow-cursor)                  │                                │
                                    │                                │
  userAction          ◀──────────── │ a2uiaction DOM event           │
  error                             │   → window.glimpse.send(...)   │
  ready / info / closed / click     │   → stdout JSONL               │
─────────────────────  JSONL stdout ──────────────────────────────────
```

Key files:

```
src/a2glimpse.swift         Native binary source (compiles to src/a2glimpse).
                            Logs use [a2glimpse] prefix.
src/a2glimpse.mjs           Node ESM wrapper (EventEmitter). Replaces upstream
                            glimpse.mjs entirely; not a light edit.
src/a2glimpse-host.html     Bundled Lit v0.8 renderer host page. Loaded by
                            the WebView. Vendored, not built from source here.
src/follow-cursor-support.mjs   Retained from upstream.
bin/a2glimpse.mjs           CLI entrypoint (`npx a2glimpse`).
test/test.mjs               Smoke test: surfaceUpdate → render → synthetic
                            click → userAction round trip.
scripts/build.mjs           swiftc invocation. `npm run build:macos`.
scripts/postinstall.mjs     Compiles binary on install.
knowledge/                  Canonical project knowledge. Read INDEX.md first.
HANDOFF.md                  Forward-looking inventory of out-of-scope work
                            (agent control surface, MCP wrapper, agent skill,
                            upstream filings, productization). Read after
                            knowledge/INDEX.md for "what's next."
```

Upstream-residue directories were deleted in repo maintenance on 2026-05-09 (see `knowledge/AUDIT_LOG.md`). Recover from `git log` if needed.

## Wire Protocol (Public Surface)

### Stdin (host → a2glimpse)

A2UI v0.8 messages — exactly one top-level key per line:

```jsonc
{"surfaceUpdate":{"surfaceId":"...","components":[...]}}
{"dataModelUpdate":{"surfaceId":"...","contents":[...],"path":"..."}}
{"beginRendering":{"surfaceId":"...","root":"...","catalogId":"...","styles":{}}}
{"deleteSurface":{"surfaceId":"..."}}
```

Lifecycle / window control (retained from upstream, kept narrow):

```jsonc
{"type":"get-info"}
{"type":"close"}
{"type":"show","title":"..."}
{"type":"title","title":"..."}
{"type":"resize","width":420,"height":260}
{"type":"follow-cursor","enabled":true,"anchor":"top-right","mode":"spring"}
```

**Forbidden on the public surface:** `html`, `file`, `eval`. They are the upstream trust-boundary leak the fork exists to remove. Any synthetic test-only command must be gated, never reachable from default command handling.

### Stdout (a2glimpse → host)

```jsonc
{"type":"ready",   ...systemInfo}     // first event after launch
{"type":"info",    ...systemInfo}     // response to get-info
{"userAction":{"name":"...","surfaceId":"...","sourceComponentId":"...","timestamp":"...","context":{...}}}
{"error":{"message":"..."}}            // client-side error reporting
{"type":"click"}                       // window-level click (upstream carryover)
{"type":"closed"}
```

stderr is debug only (`[a2glimpse] ...`), not part of the protocol.

## Conventions

### Code

- **Single-file Swift.** All native code lives in `src/a2glimpse.swift`. Splitting is anti-pattern.
- **Zero runtime deps.** Node wrapper uses only `node:` built-ins. Swift uses only Cocoa / WebKit / Foundation.
- **ESM only** in Node-land. No CJS, no bundler.
- **Protocol-first.** New features land as JSONL message types; the Node wrapper is sugar.
- **Compile on install.** `postinstall` runs swiftc. Forking the Swift source is supported.
- **Trust boundary is load-bearing.** No path that reintroduces arbitrary HTML/JS execution from stdin reaches `main`.

### Knowledge & docs

This repo follows Brian's global file conventions (see `~/.claude/CLAUDE.md`):

- Prose / knowledge files: `.md` only. No `.mdx`.
- Filename: `YYYYMMDD-HHMMSS.descriptive-name.type.md` where `type` ∈ {knowledge, analysis, reference, retrospective, prompt, ...} and matches frontmatter `type:`.
- YAML frontmatter required; use common-core fields (`title`, `date`, `description`, `tags`) plus analytical fields where applicable (`confidence`, `provenance`, `lineage`).
- Co-locate by topic in `knowledge/`, not by category. Update `knowledge/INDEX.md` when adding files.
- Structural files (`AGENTS.md`, `INDEX.md`, `README.md`, `CHANGELOG.md`, `HANDOFF.md`) are exempt from the timestamped naming convention.

## Common Operations

### Build & test

```bash
npm install                  # postinstall compiles src/a2glimpse
npm run build:macos          # explicit rebuild
npm test                     # smoke: spawn → ready → render → click → userAction → close
```

A window server is required for the smoke test. The synthetic-click path is test-only and must remain gated.

### Add an A2UI v0.8 message type (within v0.8 spec)

1. Confirm the message is part of v0.8 server-to-client (see `knowledge/20260509-121003.a2ui-spec-grounding.knowledge.md`).
2. Forward it through Swift → host page without interpretation; the Lit renderer owns spec semantics.
3. Add a JSONL fixture to `test/test.mjs`.
4. Update README.md "Protocol" section.

### Add a lifecycle / control command

1. Add case to `handleCommand()` in `src/a2glimpse.swift`.
2. Add method on `A2GlimpseWindow` in `src/a2glimpse.mjs`.
3. Document in README.md.
4. Confirm it cannot be repurposed to ship executable code across the trust boundary.

### Bump a version

1. Update `version` in `package.json`.
2. Add `CHANGELOG.md` entry — what changed and why, not commit noise.
3. Commit, tag `vX.Y.Z`, push with tags.

## Where To Read For Depth

In order, for a fresh session:

1. `knowledge/INDEX.md` — entry point.
2. `knowledge/20260509-162039.a2ui-protocol-overview.knowledge.md` — what A2UI is.
3. `knowledge/20260509-162039.glimpse-upstream-snapshot.knowledge.md` — fork baseline.
4. `knowledge/20260509-162039.fork-architecture.analysis.md` — design decisions.
5. `knowledge/20260509-121003.a2ui-spec-grounding.knowledge.md` — what was verified against the local A2UI clone.
6. `knowledge/20260509-130112.poc-retrospective.retrospective.md` — POC verdict, lessons, next steps.
7. `knowledge/20260509-162039.external-references.reference.md` — authoritative URLs.

## Next-Iteration Hooks (for context, not for this PR)

The retrospective recommends, in order: harden the trust boundary (drop cwd renderer fallback, gate test-only commands, wait for renderer-host ready), define a small "agent control surface" subset, wrap the long-lived process behind an MCP server, and ship an agent skill teaching coding agents when to use a2glimpse. Nothing in this list is in scope until explicitly picked up.
