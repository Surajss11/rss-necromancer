# RSS Necromancer — Requirements

## Problem
RSS/Atom was the open, user-owned reading protocol. Modern timelines buried it. Readers still want chronological, offline-friendly, no-algorithm feeds — especially researchers and crypto/news hunters who track deadlines and rewards.

## Goals
1. Import OPML and paste feed URLs; fetch + normalize RSS and Atom.
2. Persist feeds/items in local SQLite (browser via sql.js + IndexedDB).
3. Unread / starred / tags; mark read/unread.
4. Digest agent: summarize unread, flag scam/phishing patterns, extract deadline/reward hints.
5. Dark "haunted archive" UI (Resurrection story + Costume Contest polish).
6. Export Markdown daily brief + JSON; no wallet connect; no KYC.
7. Spec-driven build visible in `/.kiro` (this folder), with steering, hooks, MCP notes, and property tests.

## Non-goals
- Hosted multi-user sync
- On-chain / wallet features
- Full NLP LLM requirement (heuristics first; optional local LLM via MCP)

## Acceptance
- Sample OPML/XML loads offline on GitHub Pages.
- Live http(s) feeds fetch with CORS proxy fallback; private hosts blocked.
- Re-fetching the same feed does not duplicate items (guid upsert).
- Digest highlights scam/deadline/reward when patterns match.
- `pnpm test` passes property tests for URL canonicalization and upsert idempotency.
