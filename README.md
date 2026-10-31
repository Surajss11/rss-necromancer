# RSS Necromancer 🪦

**Kiroween 2026 · Resurrection**

Bring classic RSS/Atom (and OPML) back as a modern, **local-first**, agent-assisted reading stack.

> Your crypt lives in SQLite in the browser. No wallet. No KYC. No cloud lock-in.

## Live demo

**https://surajss11.github.io/rss-necromancer/**

## Features

1. **Import OPML** or paste feed URLs — RSS 2.0 + Atom
2. **Local SQLite** (sql.js) with unread / starred, persisted in IndexedDB
3. **Digest agent** — summarizes unread, flags scam/phishing patterns in crypto-ish feeds, extracts deadline/reward hints
4. **Haunted archive UI** — dark green necromantic theme
5. **Export** Markdown daily brief + JSON (+ starred list)
6. **Offline sample crypt** so judges can demo without network feeds

## Quick start

```bash
pnpm install
pnpm dev
```

Open the app → **Load sample crypt** → **Raise digest** → star an item → export Markdown.

```bash
pnpm test    # unit + property tests
pnpm build   # static site → dist/
pnpm preview
```

## Spec-driven with Kiro (`/.kiro`)

This repo **commits** the `/.kiro` folder (required for Kiroween):

| Path | What it shows |
| --- | --- |
| `.kiro/specs/rss-necromancer/` | requirements → design → tasks |
| `.kiro/steering/` | TypeScript, security (SSRF allowlist, no wallet), UX tone |
| `.kiro/hooks/` | on-save lint, on-commit README checklist, before-PR property tests |
| `.kiro/mcp/` | optional RSS-fetch + Ollama digest MCP sketches |

Property tests (`fast-check`) cover URL canonicalization idempotency and feed upsert uniqueness.

## Architecture

```
UI (React + Vite)
  ├─ feeds/parse + canonicalize
  ├─ feeds/fetch (http(s) allowlist + CORS proxy fallback)
  ├─ db/store (sql.js → IndexedDB)
  ├─ digest/agent (heuristics; MCP LLM optional)
  └─ export/markdown + JSON
```

## Security notes

- Only `http:` / `https:` feed URLs
- Localhost / private / link-local hosts blocked
- Feed XML treated as data, never executed
- No secrets, no wallet APIs

## Stack

- Vite + React 19 + TypeScript
- sql.js (SQLite WASM)
- fast-xml-parser
- vitest + fast-check

## License

MIT © 2026 Surajss11

## Kiroween

- **Category:** Resurrection
- **Started:** on/after Oct 30, 2026 (new project)
- **Author:** [Surajss11](https://github.com/Surajss11)
