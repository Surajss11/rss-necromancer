import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  addFeed,
  exportJson,
  initStore,
  listFeeds,
  listItems,
  markFeedError,
  removeFeed,
  setStarred,
  setUnread,
  unreadCount,
  upsertParsedFeed,
  type ItemFilter,
} from './lib/db/store'
import { fetchFeed, fetchSampleFeed, isAllowedFeedUrl } from './lib/feeds/fetch'
import { parseOpml } from './lib/feeds/parse'
import { buildDigest } from './lib/digest/agent'
import { digestToMarkdown, downloadText, starredToMarkdown } from './lib/export/markdown'
import type { DigestBrief, Feed, Item } from './lib/types'
import { canonicalizeUrl } from './lib/feeds/canonicalize'

const SAMPLE_FEEDS = [
  { title: 'Haunted Tech Digest', path: 'samples/demo-news.xml' },
  { title: 'Crypt Keeper Alerts', path: 'samples/demo-crypto.xml' },
]

function sampleUrl(path: string): string {
  return `${import.meta.env.BASE_URL}${path}`
}

export default function App() {
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [feeds, setFeeds] = useState<Feed[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [filter, setFilter] = useState<ItemFilter>('unread')
  const [urlInput, setUrlInput] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  const [digest, setDigest] = useState<DigestBrief | null>(null)
  const [unread, setUnreadTotal] = useState(0)

  const refresh = useCallback(async (nextFilter: ItemFilter = filter) => {
    const [f, i, u] = await Promise.all([
      listFeeds(),
      listItems(nextFilter),
      unreadCount(),
    ])
    setFeeds(f)
    setItems(i)
    setUnreadTotal(u)
  }, [filter])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      await initStore()
      if (cancelled) return
      setReady(true)
      await refresh('unread')
    })().catch((err) => setToast(String(err)))
    return () => {
      cancelled = true
    }
  }, [refresh])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4200)
    return () => clearTimeout(t)
  }, [toast])

  const syncFeed = async (feed: Feed) => {
    try {
      // Sample feeds are local paths
      const parsed = feed.url.includes('/samples/') || feed.url.startsWith('samples/')
        ? await fetchSampleFeed(
            feed.url.startsWith('http') ? feed.url : sampleUrl(feed.url.replace(/^\//, '')),
          )
        : await fetchFeed(feed.url)
      await upsertParsedFeed(feed.id, parsed)
    } catch (err) {
      await markFeedError(feed.id, err instanceof Error ? err.message : String(err))
    }
  }

  const onAddUrl = async () => {
    const raw = urlInput.trim()
    if (!raw) return
    setBusy(true)
    try {
      const allowed = isAllowedFeedUrl(raw)
      if (!allowed.ok) throw new Error(allowed.reason)
      const feed = await addFeed(allowed.url)
      await syncFeed(feed)
      setUrlInput('')
      setToast(`Raised feed: ${feed.title || feed.url}`)
      await refresh()
    } catch (err) {
      setToast(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const onLoadSamples = async () => {
    setBusy(true)
    try {
      for (const sample of SAMPLE_FEEDS) {
        const path = sample.path
        const feed = await addFeed(path, sample.title)
        const parsed = await fetchSampleFeed(sampleUrl(path))
        await upsertParsedFeed(feed.id, { ...parsed, title: sample.title })
      }
      setFilter('unread')
      await refresh('unread')
      setToast('Sample crypt loaded (news + crypto alerts)')
    } catch (err) {
      setToast(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const onImportOpml = async (file: File) => {
    setBusy(true)
    try {
      const text = await file.text()
      const outlines = parseOpml(text)
      let count = 0
      for (const o of outlines) {
        // Resolve relative sample paths inside OPML
        const isRelative = !/^https?:/i.test(o.xmlUrl)
        const url = isRelative ? o.xmlUrl.replace(/^\.\//, '') : o.xmlUrl
        if (!isRelative) {
          const allowed = isAllowedFeedUrl(url)
          if (!allowed.ok) continue
        }
        const feed = await addFeed(url, o.title)
        if (isRelative) {
          const parsed = await fetchSampleFeed(sampleUrl(url))
          await upsertParsedFeed(feed.id, { ...parsed, title: o.title || parsed.title })
        } else {
          await syncFeed(feed)
        }
        count += 1
      }
      await refresh()
      setToast(`Imported ${count} outline(s) from OPML`)
    } catch (err) {
      setToast(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const onRefreshAll = async () => {
    setBusy(true)
    try {
      for (const feed of feeds) await syncFeed(feed)
      await refresh()
      setToast('All feeds re-summoned')
    } catch (err) {
      setToast(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const onDigest = async () => {
    const allUnread = await listItems('unread', 100)
    const brief = buildDigest(allUnread, feeds)
    setDigest(brief)
    setToast('Digest raised from unread bones')
  }

  const onExportDigest = () => {
    if (!digest) return
    downloadText(`rss-necromancer-brief-${Date.now()}.md`, digestToMarkdown(digest))
  }

  const onExportJson = async () => {
    const json = await exportJson()
    downloadText(`rss-necromancer-export-${Date.now()}.json`, json, 'application/json')
  }

  const onExportStarred = async () => {
    const all = await listItems('all', 5000)
    downloadText(`rss-necromancer-starred-${Date.now()}.md`, starredToMarkdown(all))
  }

  const filterLabel = useMemo(
    () => ({ all: 'All', unread: 'Unread', starred: 'Starred' } as const),
    [],
  )

  if (!ready) {
    return (
      <div className="app-shell">
        <div className="empty">Awakening the archive…</div>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <header className="hero">
        <div>
          <h1>RSS Necromancer</h1>
          <p>
            Resurrect RSS/Atom as a local-first, agent-assisted reading stack. Your crypt lives in
            SQLite in the browser — no wallet, no KYC, no cloud lock-in.
          </p>
          <div className="badge-row">
            <span className="badge">Kiroween · Resurrection</span>
            <span className="badge">{unread} unread</span>
            <span className="badge">{feeds.length} feeds</span>
          </div>
        </div>
        <div className="row">
          <button className="btn primary" disabled={busy} onClick={onLoadSamples}>
            Load sample crypt
          </button>
          <button className="btn" disabled={busy || feeds.length === 0} onClick={onRefreshAll}>
            Refresh all
          </button>
          <button className="btn" disabled={busy} onClick={onDigest}>
            Raise digest
          </button>
        </div>
      </header>

      <div className="layout">
        <aside className="panel stack">
          <h2>Summon feeds</h2>
          <input
            className="input"
            placeholder="https://example.com/feed.xml"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void onAddUrl()
            }}
          />
          <div className="row">
            <button className="btn primary" disabled={busy || !urlInput.trim()} onClick={onAddUrl}>
              Add URL
            </button>
            <label className="btn">
              Import OPML
              <input
                type="file"
                accept=".opml,application/xml,text/xml"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) void onImportOpml(file)
                  e.target.value = ''
                }}
              />
            </label>
          </div>

          <h2>Crypt ({feeds.length})</h2>
          {feeds.length === 0 ? (
            <div className="empty">No feeds yet. Load samples or paste a URL.</div>
          ) : (
            <ul className="feed-list">
              {feeds.map((feed) => (
                <li key={feed.id} className="feed-card">
                  <header>
                    <div>
                      <h3>{feed.title}</h3>
                      <div className="meta">{canonicalizeUrl(feed.url) || feed.url}</div>
                      {feed.lastFetchedAt && (
                        <div className="meta">Fetched {new Date(feed.lastFetchedAt).toLocaleString()}</div>
                      )}
                      {feed.error && <div className="error-text">{feed.error}</div>}
                    </div>
                    <button
                      className="btn danger ghost"
                      title="Banish feed"
                      onClick={() => {
                        void removeFeed(feed.id).then(() => refresh())
                      }}
                    >
                      ✕
                    </button>
                  </header>
                </li>
              ))}
            </ul>
          )}

          <h2>Export</h2>
          <div className="row">
            <button className="btn" onClick={onExportJson}>JSON</button>
            <button className="btn" onClick={onExportStarred}>Starred MD</button>
            <button className="btn" disabled={!digest} onClick={onExportDigest}>
              Digest MD
            </button>
          </div>
        </aside>

        <main className="panel">
          {digest && (
            <div className="digest-box">
              <strong>Digest · {new Date(digest.generatedAt).toLocaleString()}</strong>
              <ul>
                {digest.highlights.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="tabs">
            {(['unread', 'starred', 'all'] as ItemFilter[]).map((f) => (
              <button
                key={f}
                className={`tab ${filter === f ? 'active' : ''}`}
                onClick={() => {
                  setFilter(f)
                  void refresh(f)
                }}
              >
                {filterLabel[f]}
              </button>
            ))}
          </div>

          {items.length === 0 ? (
            <div className="empty">Nothing here yet. The graveyard is quiet.</div>
          ) : (
            <ul className="item-list">
              {items.map((item) => {
                const flags =
                  digest?.items.find((d) => d.itemId === item.id)?.flags ??
                  buildDigest([item], feeds).items[0]?.flags ??
                  []
                return (
                  <li key={item.id} className="item-card">
                    <header>
                      <div>
                        <h3>
                          <a href={item.link || '#'} target="_blank" rel="noreferrer">
                            {item.title}
                          </a>
                        </h3>
                        <div className="meta">
                          {feeds.find((f) => f.id === item.feedId)?.title ?? `Feed #${item.feedId}`}
                          {item.publishedAt ? ` · ${item.publishedAt}` : ''}
                        </div>
                      </div>
                      <div className="row">
                        <button
                          className="btn ghost"
                          onClick={() => {
                            void setUnread(item.id, !item.unread).then(() => refresh())
                          }}
                        >
                          {item.unread ? 'Mark read' : 'Mark unread'}
                        </button>
                        <button
                          className="btn ghost"
                          onClick={() => {
                            void setStarred(item.id, !item.starred).then(() => refresh())
                          }}
                        >
                          {item.starred ? '★ Starred' : '☆ Star'}
                        </button>
                      </div>
                    </header>
                    {flags.length > 0 && (
                      <div className="flags">
                        {flags.map((f) => (
                          <span key={`${f.kind}-${f.label}`} className={`flag ${f.kind}`} title={f.evidence}>
                            {f.label}
                          </span>
                        ))}
                      </div>
                    )}
                    {item.summary && (
                      <p className="summary">
                        {item.summary.replace(/<[^>]+>/g, ' ').slice(0, 280)}
                        {item.summary.length > 280 ? '…' : ''}
                      </p>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </main>
      </div>

      <p className="footer-note">
        Built for Kiroween 2026 · Resurrection · Spec-driven with <code>/.kiro</code> · MIT · Offline-first
      </p>

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
