import { beforeAll, describe, expect, it } from 'vitest'
import {
  addFeed,
  initStoreMemory,
  listItems,
  upsertParsedFeed,
} from './store'
import { parseFeedXml } from '../feeds/parse'

const RSS = `<?xml version="1.0"?>
<rss version="2.0"><channel>
<title>T</title><link>https://ex.com</link>
<item><title>One</title><link>https://ex.com/1</link><guid>https://ex.com/1</guid><description>Hi</description></item>
</channel></rss>`

describe('store upsert idempotency', () => {
  beforeAll(async () => {
    await initStoreMemory()
  })

  it('upserts same guid without duplicating', async () => {
    const feed = await addFeed('https://ex.com/rss', 'T')
    const parsed = parseFeedXml(RSS, 'https://ex.com/rss')
    await upsertParsedFeed(feed.id, parsed)
    await upsertParsedFeed(feed.id, parsed)
    await upsertParsedFeed(feed.id, {
      ...parsed,
      items: parsed.items.map((i) => ({ ...i, title: 'One (updated)' })),
    })
    const items = await listItems('all')
    expect(items).toHaveLength(1)
    expect(items[0].title).toBe('One (updated)')
  })
})
