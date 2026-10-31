/**
 * Canonicalize feed / item URLs for idempotent upserts.
 * - lowercase host
 * - strip trailing slash (except root)
 * - drop common tracking query params
 * - normalize protocol to https when host present
 */
const DROP_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'fbclid',
  'gclid',
  'mc_cid',
  'mc_eid',
  'ref',
])

export function canonicalizeUrl(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''

  let candidate = trimmed
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(candidate)) {
    candidate = `https://${candidate}`
  }

  let url: URL
  try {
    url = new URL(candidate)
  } catch {
    return trimmed.toLowerCase()
  }

  url.hostname = url.hostname.toLowerCase()
  if (url.protocol === 'http:') url.protocol = 'https:'

  // Drop fragment
  url.hash = ''

  // Drop tracking params
  const kept = new URLSearchParams()
  url.searchParams.forEach((value, key) => {
    if (!DROP_PARAMS.has(key.toLowerCase())) kept.append(key, value)
  })
  url.search = kept.toString() ? `?${kept.toString()}` : ''

  // Strip trailing slash on path (keep root "/")
  if (url.pathname.length > 1 && url.pathname.endsWith('/')) {
    url.pathname = url.pathname.replace(/\/+$/, '')
  }

  return url.toString()
}

export function guidFromItem(link: string, title: string, publishedAt: string | null): string {
  const base = canonicalizeUrl(link) || title.trim().toLowerCase()
  return publishedAt ? `${base}#${publishedAt}` : base
}
