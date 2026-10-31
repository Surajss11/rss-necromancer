import type { DigestBrief, Item } from '../types'

export function digestToMarkdown(brief: DigestBrief): string {
  const lines: string[] = [
    `# RSS Necromancer — Daily Brief`,
    ``,
    `Generated: ${brief.generatedAt}`,
    `Unread in archive: ${brief.unreadCount}`,
    ``,
    `## Highlights`,
    ...brief.highlights.map((h) => `- ${h}`),
    ``,
    `## Raised items`,
  ]

  for (const item of brief.items) {
    lines.push(``)
    lines.push(`### ${item.title}`)
    lines.push(`- Feed: ${item.feedTitle}`)
    lines.push(`- Link: ${item.link}`)
    if (item.flags.length) {
      lines.push(`- Flags: ${item.flags.map((f) => `${f.kind}:${f.label}`).join('; ')}`)
    }
    lines.push(``)
    lines.push(item.summary || '_No summary_')
  }

  lines.push(``)
  lines.push(`---`)
  lines.push(`_Raised from the dead by RSS Necromancer_`)
  return lines.join('\n')
}

export function starredToMarkdown(items: Item[]): string {
  const starred = items.filter((i) => i.starred)
  const lines = [`# Starred bones`, ``, `Count: ${starred.length}`, ``]
  for (const item of starred) {
    lines.push(`- [${item.title}](${item.link})`)
  }
  return lines.join('\n')
}

export function downloadText(filename: string, content: string, mime = 'text/markdown'): void {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
