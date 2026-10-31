import type { DigestBrief, DigestFlag, DigestItem, Feed, Item } from '../types'

const SCAM_PATTERNS: { re: RegExp; label: string }[] = [
  { re: /\b(double|guaranteed)\s+your\s+(money|crypto|btc|eth)\b/i, label: 'Guaranteed returns' },
  { re: /\b(seed\s*phrase|private\s*key|secret\s*recovery)\b/i, label: 'Seed / key harvest' },
  { re: /\bconnect\s+(your\s+)?wallet\b/i, label: 'Wallet connect lure' },
  { re: /\b(airdrop|claim).{0,40}\b(urgent|immediately|expire[sd]?)\b/i, label: 'Urgent claim pressure' },
  { re: /\b(send|transfer)\s+\d+(\.\d+)?\s*(eth|btc|bnb|sol)\b/i, label: 'Send-crypto bait' },
  { re: /\bfree\s+mint\b.*\b(connect|approve|sign)\b/i, label: 'Free mint + sign' },
]

const DEADLINE_RE =
  /\b(deadline|ends?|closing|closes|until|before)\b[^.]{0,80}\b(\d{1,2}[\/\-]\d{1,2}([\/\-]\d{2,4})?|\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{2,4}|tomorrow|today|tonight)\b/i

const REWARD_RE =
  /\b(reward|prize|pool|bounty|\$\s?\d[\d,]*(k|m)?|\d+(\.\d+)?\s*(usd|usdc|eth|btc|sol))\b/i

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function flagsFor(text: string): DigestFlag[] {
  const flags: DigestFlag[] = []
  for (const p of SCAM_PATTERNS) {
    const m = text.match(p.re)
    if (m) flags.push({ kind: m[0].toLowerCase().includes('seed') || m[0].toLowerCase().includes('wallet') ? 'phishing' : 'scam', label: p.label, evidence: m[0] })
  }
  const d = text.match(DEADLINE_RE)
  if (d) flags.push({ kind: 'deadline', label: 'Possible deadline', evidence: d[0] })
  const r = text.match(REWARD_RE)
  if (r) flags.push({ kind: 'reward', label: 'Possible reward', evidence: r[0] })
  return flags
}

function summarize(text: string, max = 220): string {
  const clean = stripHtml(text)
  if (clean.length <= max) return clean
  return `${clean.slice(0, max - 1).trim()}…`
}

/**
 * Local "digest agent" — heuristic, offline-first.
 * Optional: wire Ollama MCP later for richer summaries (see .kiro/mcp).
 */
export function buildDigest(
  items: Item[],
  feeds: Feed[],
  opts: { limit?: number } = {},
): DigestBrief {
  const limit = opts.limit ?? 25
  const feedTitle = new Map(feeds.map((f) => [f.id, f.title]))
  const unread = items.filter((i) => i.unread).slice(0, limit)

  const digestItems: DigestItem[] = unread.map((item) => {
    const blob = `${item.title}\n${item.summary}\n${item.link}`
    return {
      itemId: item.id,
      title: item.title,
      link: item.link,
      feedTitle: feedTitle.get(item.feedId) ?? `Feed #${item.feedId}`,
      summary: summarize(item.summary || item.title),
      flags: flagsFor(blob),
    }
  })

  const highlights: string[] = []
  const scamCount = digestItems.filter((i) => i.flags.some((f) => f.kind === 'scam' || f.kind === 'phishing')).length
  const deadlineCount = digestItems.filter((i) => i.flags.some((f) => f.kind === 'deadline')).length
  const rewardCount = digestItems.filter((i) => i.flags.some((f) => f.kind === 'reward')).length

  if (digestItems.length === 0) highlights.push('Graveyard is quiet — no unread items.')
  else highlights.push(`${digestItems.length} unread item(s) raised from the feeds.`)
  if (scamCount) highlights.push(`⚠ ${scamCount} item(s) flagged for scam/phishing patterns.`)
  if (deadlineCount) highlights.push(`⏳ ${deadlineCount} item(s) may mention a deadline.`)
  if (rewardCount) highlights.push(`✦ ${rewardCount} item(s) may mention a reward/prize.`)

  return {
    generatedAt: new Date().toISOString(),
    unreadCount: items.filter((i) => i.unread).length,
    items: digestItems,
    highlights,
  }
}
