import { describe, expect, it } from 'vitest'
import { buildDigest } from './agent'
import type { Feed, Item } from '../types'

const feed: Feed = {
  id: 1,
  url: 'https://ex.com/feed',
  title: 'Crypto',
  siteUrl: null,
  lastFetchedAt: null,
  error: null,
}

function item(partial: Partial<Item> & Pick<Item, 'id' | 'title' | 'summary'>): Item {
  return {
    feedId: 1,
    guid: `g-${partial.id}`,
    link: 'https://ex.com/x',
    publishedAt: null,
    unread: true,
    starred: false,
    tags: '',
    ...partial,
  }
}

describe('buildDigest', () => {
  it('flags scam and deadline patterns', () => {
    const brief = buildDigest(
      [
        item({
          id: 1,
          title: 'Claim free mint — connect wallet immediately before deadline tomorrow',
          summary: 'Guaranteed double your money. Send 0.05 eth.',
        }),
        item({
          id: 2,
          title: 'Normal update',
          summary: 'All good',
        }),
      ],
      [feed],
    )
    const flagged = brief.items.find((i) => i.itemId === 1)!
    expect(flagged.flags.some((f) => f.kind === 'phishing' || f.kind === 'scam')).toBe(true)
    expect(flagged.flags.some((f) => f.kind === 'deadline')).toBe(true)
    expect(brief.highlights.length).toBeGreaterThan(0)
  })
})
