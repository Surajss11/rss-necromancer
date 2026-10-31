import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js'
import type { Feed, Item, ParsedFeed } from '../types'
import { canonicalizeUrl } from '../feeds/canonicalize'

const IDB_NAME = 'rss-necromancer'
const IDB_STORE = 'sqlite'
const IDB_KEY = 'main'

let SQL: SqlJsStatic | null = null
let db: Database | null = null

function nodeWasmPath(file: string): string {
  const g = globalThis as typeof globalThis & {
    process?: { cwd?: () => string }
  }
  const cwd = g.process?.cwd?.() ?? '.'
  return `${cwd}/node_modules/sql.js/dist/${file}`
}

async function loadSqlJs(): Promise<SqlJsStatic> {
  if (SQL) return SQL
  SQL = await initSqlJs({
    locateFile: (file) => {
      // Browser: wasm copied to public/sql-wasm.wasm
      if (typeof window !== 'undefined') {
        const base = import.meta.env.BASE_URL ?? '/'
        return `${base}${file}`
      }
      // Node / vitest — no import.meta.url into node_modules (Vite would bundle all variants)
      return nodeWasmPath(file)
    },
  })
  return SQL
}

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1)
    req.onupgradeneeded = () => {
      const idb = req.result
      if (!idb.objectStoreNames.contains(IDB_STORE)) idb.createObjectStore(IDB_STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function persist(): Promise<void> {
  if (!db || typeof indexedDB === 'undefined') return
  const data = db.export()
  const idb = await openIdb()
  await new Promise<void>((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE, 'readwrite')
    tx.objectStore(IDB_STORE).put(data, IDB_KEY)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  idb.close()
}

async function restore(): Promise<Uint8Array | null> {
  if (typeof indexedDB === 'undefined') return null
  const idb = await openIdb()
  const data = await new Promise<Uint8Array | null>((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE, 'readonly')
    const req = tx.objectStore(IDB_STORE).get(IDB_KEY)
    req.onsuccess = () => resolve((req.result as Uint8Array) ?? null)
    req.onerror = () => reject(req.error)
  })
  idb.close()
  return data
}

function migrate(database: Database): void {
  database.run(`
    CREATE TABLE IF NOT EXISTS feeds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      site_url TEXT,
      last_fetched_at TEXT,
      error TEXT
    );
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      feed_id INTEGER NOT NULL,
      guid TEXT NOT NULL,
      title TEXT NOT NULL,
      link TEXT NOT NULL,
      summary TEXT NOT NULL DEFAULT '',
      published_at TEXT,
      unread INTEGER NOT NULL DEFAULT 1,
      starred INTEGER NOT NULL DEFAULT 0,
      tags TEXT NOT NULL DEFAULT '',
      UNIQUE(feed_id, guid),
      FOREIGN KEY(feed_id) REFERENCES feeds(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_items_unread ON items(unread);
    CREATE INDEX IF NOT EXISTS idx_items_starred ON items(starred);
  `)
}

export async function initStore(): Promise<void> {
  const sql = await loadSqlJs()
  const saved = await restore()
  db = saved ? new sql.Database(saved) : new sql.Database()
  migrate(db)
  await persist()
}

function requireDb(): Database {
  if (!db) throw new Error('Store not initialized')
  return db
}

function mapFeed(row: Record<string, unknown>): Feed {
  return {
    id: Number(row.id),
    url: String(row.url),
    title: String(row.title),
    siteUrl: row.site_url == null ? null : String(row.site_url),
    lastFetchedAt: row.last_fetched_at == null ? null : String(row.last_fetched_at),
    error: row.error == null ? null : String(row.error),
  }
}

function mapItem(row: Record<string, unknown>): Item {
  return {
    id: Number(row.id),
    feedId: Number(row.feed_id),
    guid: String(row.guid),
    title: String(row.title),
    link: String(row.link),
    summary: String(row.summary ?? ''),
    publishedAt: row.published_at == null ? null : String(row.published_at),
    unread: Boolean(row.unread),
    starred: Boolean(row.starred),
    tags: String(row.tags ?? ''),
  }
}

function rowObjects(execResult: ReturnType<Database['exec']>): Record<string, unknown>[] {
  if (!execResult[0]) return []
  const { columns, values } = execResult[0]
  return values.map((valuesRow) => {
    const obj: Record<string, unknown> = {}
    columns.forEach((c, i) => {
      obj[c] = valuesRow[i]
    })
    return obj
  })
}

export async function addFeed(url: string, title?: string): Promise<Feed> {
  const database = requireDb()
  const canonical = canonicalizeUrl(url) || url.trim()
  database.run(
    `INSERT INTO feeds (url, title) VALUES (?, ?)
     ON CONFLICT(url) DO UPDATE SET title = COALESCE(excluded.title, feeds.title)`,
    [canonical, title?.trim() || canonical],
  )
  await persist()
  const rows = rowObjects(database.exec(`SELECT * FROM feeds WHERE url = ?`, [canonical]))
  return mapFeed(rows[0])
}

export async function listFeeds(): Promise<Feed[]> {
  const database = requireDb()
  return rowObjects(database.exec(`SELECT * FROM feeds ORDER BY id ASC`)).map(mapFeed)
}

export async function removeFeed(id: number): Promise<void> {
  const database = requireDb()
  database.run(`DELETE FROM items WHERE feed_id = ?`, [id])
  database.run(`DELETE FROM feeds WHERE id = ?`, [id])
  await persist()
}

export async function upsertParsedFeed(feedId: number, parsed: ParsedFeed): Promise<number> {
  const database = requireDb()
  const now = new Date().toISOString()
  database.run(
    `UPDATE feeds SET title = ?, site_url = ?, last_fetched_at = ?, error = NULL WHERE id = ?`,
    [parsed.title, parsed.siteUrl, now, feedId],
  )
  for (const item of parsed.items) {
    database.run(
      `INSERT INTO items (feed_id, guid, title, link, summary, published_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(feed_id, guid) DO UPDATE SET
         title = excluded.title,
         link = excluded.link,
         summary = excluded.summary,
         published_at = excluded.published_at`,
      [feedId, item.guid, item.title, item.link, item.summary, item.publishedAt],
    )
  }
  await persist()
  return parsed.items.length
}

export async function markFeedError(feedId: number, message: string): Promise<void> {
  const database = requireDb()
  database.run(`UPDATE feeds SET error = ?, last_fetched_at = ? WHERE id = ?`, [
    message.slice(0, 500),
    new Date().toISOString(),
    feedId,
  ])
  await persist()
}

export type ItemFilter = 'all' | 'unread' | 'starred'

export async function listItems(filter: ItemFilter = 'all', limit = 200): Promise<Item[]> {
  const database = requireDb()
  let where = ''
  if (filter === 'unread') where = 'WHERE unread = 1'
  if (filter === 'starred') where = 'WHERE starred = 1'
  return rowObjects(
    database.exec(
      `SELECT * FROM items ${where}
       ORDER BY COALESCE(published_at, '') DESC, id DESC
       LIMIT ?`,
      [limit],
    ),
  ).map(mapItem)
}

export async function setUnread(id: number, unread: boolean): Promise<void> {
  const database = requireDb()
  database.run(`UPDATE items SET unread = ? WHERE id = ?`, [unread ? 1 : 0, id])
  await persist()
}

export async function setStarred(id: number, starred: boolean): Promise<void> {
  const database = requireDb()
  database.run(`UPDATE items SET starred = ? WHERE id = ?`, [starred ? 1 : 0, id])
  await persist()
}

export async function unreadCount(): Promise<number> {
  const database = requireDb()
  const res = database.exec(`SELECT COUNT(*) AS c FROM items WHERE unread = 1`)
  return Number(res[0]?.values[0]?.[0] ?? 0)
}

export async function exportJson(): Promise<string> {
  const feeds = await listFeeds()
  const items = await listItems('all', 5000)
  return JSON.stringify({ exportedAt: new Date().toISOString(), feeds, items }, null, 2)
}

/** Test helper: in-memory only (no IndexedDB). */
export async function initStoreMemory(seed?: Uint8Array): Promise<Database> {
  const sql = await loadSqlJs()
  db = seed ? new sql.Database(seed) : new sql.Database()
  migrate(db)
  return db
}

export function getRawDb(): Database | null {
  return db
}
