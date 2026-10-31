# TypeScript steering

- Prefer explicit types at module boundaries (`Feed`, `Item`, `ParsedFeed`).
- No `any` unless bridging sql.js row bags — then narrow immediately.
- Keep functions pure where possible (parse, canonicalize, digest).
- Vitest + fast-check for normalization invariants.
- ESM only; Vite path aliases optional — prefer relative imports in this small app.
