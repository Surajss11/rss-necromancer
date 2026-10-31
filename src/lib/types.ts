export type Feed = {
  id: number
  url: string
  title: string
  siteUrl: string | null
  lastFetchedAt: string | null
  error: string | null
}

export type Item = {
  id: number
  feedId: number
  guid: string
  title: string
  link: string
  summary: string
  publishedAt: string | null
  unread: boolean
  starred: boolean
  tags: string
}

export type DigestFlag = {
  kind: 'scam' | 'phishing' | 'deadline' | 'reward' | 'info'
  label: string
  evidence: string
}

export type DigestItem = {
  itemId: number
  title: string
  link: string
  feedTitle: string
  summary: string
  flags: DigestFlag[]
}

export type DigestBrief = {
  generatedAt: string
  unreadCount: number
  items: DigestItem[]
  highlights: string[]
}

export type ParsedFeed = {
  title: string
  siteUrl: string | null
  items: ParsedItem[]
}

export type ParsedItem = {
  guid: string
  title: string
  link: string
  summary: string
  publishedAt: string | null
}
