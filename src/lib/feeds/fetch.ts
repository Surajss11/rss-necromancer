import { parseFeedXml } from './parse'
import type { ParsedFeed } from '../types'

/**
 * SSRF-ish allowlist: only http(s) URLs with a hostname; block localhost / private ranges.
 * Browser still cannot hit private nets from GH Pages, but we keep the check for steering compliance.
 */
export function isAllowedFeedUrl(raw: string): { ok: true; url: string } | { ok: false; reason: string } {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return { ok: false, reason: 'Invalid URL' }
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, reason: 'Only http(s) allowed' }
  }
  const host = url.hostname.toLowerCase()
  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host === '::1' ||
    host.endsWith('.local') ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host) ||
    /^169\.254\./.test(host)
  ) {
    return { ok: false, reason: 'Private / local hosts blocked' }
  }
  return { ok: true, url: url.toString() }
}

const CORS_PROXIES = [
  (u: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  (u: string) => `https://corsproxy.io/?${encodeURIComponent(u)}`,
]

export async function fetchFeed(url: string, useProxy = true): Promise<ParsedFeed> {
  const allowed = isAllowedFeedUrl(url)
  if (!allowed.ok) throw new Error(allowed.reason)

  const attempts = useProxy
    ? [allowed.url, ...CORS_PROXIES.map((p) => p(allowed.url))]
    : [allowed.url]

  let lastError: unknown
  for (const target of attempts) {
    try {
      const res = await fetch(target, { signal: AbortSignal.timeout(20000) })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const text = await res.text()
      if (!text.trim().startsWith('<') && !text.includes('<?xml')) {
        throw new Error('Response was not XML')
      }
      return parseFeedXml(text, allowed.url)
    } catch (err) {
      lastError = err
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}

export async function fetchSampleFeed(samplePath: string): Promise<ParsedFeed> {
  const res = await fetch(samplePath)
  if (!res.ok) throw new Error(`Sample missing: ${samplePath}`)
  const text = await res.text()
  return parseFeedXml(text, samplePath)
}
