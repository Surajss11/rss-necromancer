import { XMLParser } from 'fast-xml-parser'
import { canonicalizeUrl, guidFromItem } from './canonicalize'
import type { ParsedFeed, ParsedItem } from '../types'

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  trimValues: true,
  isArray: (name) =>
    ['item', 'entry', 'outline', 'category', 'link'].includes(name),
})

function asText(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'string' || typeof v === 'number') return String(v)
  if (typeof v === 'object' && v !== null && '#text' in v) {
    return String((v as { '#text': unknown })['#text'] ?? '')
  }
  return ''
}

function firstLink(node: unknown): string {
  if (!node) return ''
  if (typeof node === 'string') return node
  if (Array.isArray(node)) {
    for (const entry of node) {
      const href = (entry as { '@_href'?: string; '#text'?: string })['@_href']
        ?? (entry as { '#text'?: string })['#text']
      if (href) return href
      if (typeof entry === 'string') return entry
    }
    return ''
  }
  const obj = node as { '@_href'?: string; '#text'?: string }
  return obj['@_href'] ?? obj['#text'] ?? ''
}

function parseRssItems(channel: Record<string, unknown>): ParsedItem[] {
  const items = (channel.item as unknown[]) ?? []
  return items.map((raw) => {
    const it = raw as Record<string, unknown>
    const link = canonicalizeUrl(asText(it.link) || firstLink(it.link))
    const title = asText(it.title) || link || '(untitled)'
    const publishedAt = asText(it.pubDate) || asText(it['dc:date']) || null
    const summary =
      asText(it.description) ||
      asText(it['content:encoded']) ||
      asText(it.summary) ||
      ''
    const guid =
      asText(it.guid) ||
      guidFromItem(link, title, publishedAt)
    return {
      guid: canonicalizeUrl(guid) || guid,
      title,
      link,
      summary: summary.slice(0, 4000),
      publishedAt,
    }
  })
}

function parseAtomEntries(feed: Record<string, unknown>): ParsedItem[] {
  const entries = (feed.entry as unknown[]) ?? []
  return entries.map((raw) => {
    const it = raw as Record<string, unknown>
    const link = canonicalizeUrl(firstLink(it.link))
    const title = asText(it.title) || link || '(untitled)'
    const publishedAt = asText(it.published) || asText(it.updated) || null
    const summary = asText(it.summary) || asText(it.content) || ''
    const guid = asText(it.id) || guidFromItem(link, title, publishedAt)
    return {
      guid: canonicalizeUrl(guid) || guid,
      title,
      link,
      summary: summary.slice(0, 4000),
      publishedAt,
    }
  })
}

export function parseFeedXml(xml: string, sourceUrl: string): ParsedFeed {
  const doc = parser.parse(xml) as Record<string, unknown>

  if (doc.rss || doc['rdf:RDF']) {
    const root = (doc.rss ?? doc['rdf:RDF']) as Record<string, unknown>
    const channel = (root.channel ?? root) as Record<string, unknown>
    return {
      title: asText(channel.title) || canonicalizeUrl(sourceUrl),
      siteUrl: canonicalizeUrl(asText(channel.link) || firstLink(channel.link)) || null,
      items: parseRssItems(channel),
    }
  }

  if (doc.feed) {
    const feed = doc.feed as Record<string, unknown>
    return {
      title: asText(feed.title) || canonicalizeUrl(sourceUrl),
      siteUrl: canonicalizeUrl(firstLink(feed.link)) || null,
      items: parseAtomEntries(feed),
    }
  }

  throw new Error('Unrecognized feed format (expected RSS or Atom)')
}

export type OpmlOutline = { title: string; xmlUrl: string; htmlUrl?: string }

export function parseOpml(xml: string): OpmlOutline[] {
  const doc = parser.parse(xml) as Record<string, unknown>
  const opml = doc.opml as Record<string, unknown> | undefined
  if (!opml) throw new Error('Not a valid OPML document')
  const body = opml.body as Record<string, unknown>
  const outlines = collectOutlines(body?.outline)
  return outlines.filter((o) => o.xmlUrl)
}

function collectOutlines(node: unknown): OpmlOutline[] {
  if (!node) return []
  const list = Array.isArray(node) ? node : [node]
  const out: OpmlOutline[] = []
  for (const entry of list) {
    const o = entry as Record<string, unknown>
    const xmlUrl = asText(o['@_xmlUrl'] ?? o['@_xmlurl'])
    if (xmlUrl) {
      out.push({
        title: asText(o['@_title'] ?? o['@_text']) || xmlUrl,
        xmlUrl: canonicalizeUrl(xmlUrl),
        htmlUrl: asText(o['@_htmlUrl']) || undefined,
      })
    }
    if (o.outline) out.push(...collectOutlines(o.outline))
  }
  return out
}
