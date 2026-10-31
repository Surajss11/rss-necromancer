import { describe, expect, it } from 'vitest'
import { parseFeedXml, parseOpml } from './parse'

const RSS = `<?xml version="1.0"?>
<rss version="2.0"><channel>
<title>T</title><link>https://ex.com</link>
<item><title>One</title><link>https://ex.com/1</link><guid>g1</guid><description>Hi</description></item>
<item><title>One</title><link>https://ex.com/1?utm_source=x</link><guid>g1</guid><description>Hi</description></item>
</channel></rss>`

const ATOM = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
<title>A</title>
<link href="https://ex.com"/>
<entry><title>E</title><link href="https://ex.com/e"/><id>id1</id><summary>S</summary></entry>
</feed>`

const OPML = `<?xml version="1.0"?>
<opml version="2.0"><head><title>x</title></head>
<body>
<outline text="Folder">
  <outline type="rss" text="F" xmlUrl="https://Example.com/feed/"/>
</outline>
</body></opml>`

describe('parseFeedXml', () => {
  it('parses RSS', () => {
    const feed = parseFeedXml(RSS, 'https://ex.com/rss')
    expect(feed.title).toBe('T')
    expect(feed.items).toHaveLength(2)
    expect(feed.items[0].title).toBe('One')
  })

  it('parses Atom', () => {
    const feed = parseFeedXml(ATOM, 'https://ex.com/atom')
    expect(feed.title).toBe('A')
    expect(feed.items[0].link).toBe('https://ex.com/e')
  })
})

describe('parseOpml', () => {
  it('flattens nested outlines and canonicalizes urls', () => {
    const outlines = parseOpml(OPML)
    expect(outlines).toHaveLength(1)
    expect(outlines[0].xmlUrl).toBe('https://example.com/feed')
  })
})
