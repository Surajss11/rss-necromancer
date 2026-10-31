import { describe, expect, it } from 'vitest'
import * as fc from 'fast-check'
import { canonicalizeUrl, guidFromItem } from './canonicalize'

describe('canonicalizeUrl', () => {
  it('lowercases host and strips tracking params', () => {
    expect(canonicalizeUrl('HTTP://Example.COM/path/?utm_source=x&id=1')).toBe(
      'https://example.com/path?id=1',
    )
  })

  it('strips trailing slash except root', () => {
    expect(canonicalizeUrl('https://example.com/a/b/')).toBe('https://example.com/a/b')
    expect(canonicalizeUrl('https://example.com/')).toBe('https://example.com/')
  })

  it('is idempotent (property)', () => {
    fc.assert(
      fc.property(
        fc.webUrl({ withFragments: true, withQueryParameters: true }),
        (url) => {
          const once = canonicalizeUrl(url)
          const twice = canonicalizeUrl(once)
          expect(twice).toBe(once)
        },
      ),
      { numRuns: 50 },
    )
  })

  it('same logical URL collapses (property on host case)', () => {
    fc.assert(
      fc.property(fc.domain(), fc.stringMatching(/^[a-z0-9/-]{0,40}$/), (host, path) => {
        const a = canonicalizeUrl(`https://${host.toUpperCase()}/${path}`)
        const b = canonicalizeUrl(`http://${host.toLowerCase()}/${path}`)
        expect(a).toBe(b)
      }),
      { numRuns: 40 },
    )
  })
})

describe('guidFromItem', () => {
  it('stable for same inputs', () => {
    const a = guidFromItem('https://x.com/a', 'Title', '2026-01-01')
    const b = guidFromItem('https://x.com/a/', 'Title', '2026-01-01')
    expect(a).toBe(b)
  })
})
