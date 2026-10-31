# Design

## Architecture
```
UI (React) ──► store.ts (sql.js) ──► IndexedDB
     │              ▲
     ├── fetch.ts ──┤ parse RSS/Atom/OPML
     └── digest/agent.ts (heuristics)
```

## Modules
| Module | Responsibility |
| --- | --- |
| `lib/feeds/canonicalize` | Idempotent URL / guid normalization |
| `lib/feeds/parse` | RSS 2.0 + Atom + OPML |
| `lib/feeds/fetch` | Allowlist + CORS proxy chain |
| `lib/db/store` | SQLite schema, upsert, filters, export |
| `lib/digest/agent` | Brief + flags |
| `lib/export/markdown` | MD/JSON downloads |

## Security
- Only `http:` / `https:` feed URLs
- Block localhost and RFC1918 / link-local hosts (steering)
- No secrets in repo; no wallet APIs
- Strip HTML in summaries for display; keep raw for export length-capped

## Theme
Dark green haunted archive: Creepster display + IBM Plex. Accent `#7dffb3`.
