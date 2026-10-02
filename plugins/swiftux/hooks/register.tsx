// SwiftUX picks pane (Claude Code): when the agent calls the SwiftUX MCP
// server's show_picks, open a pane beside the chat with the request summary, the
// reasoning, and one card per pick (name - author, a short description) whose
// title links to the catalog page. The terminal counterpart of the MCP App
// that ChatGPT, Codex and Claude's chat apps render for the same tool.
import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { PickCard, Picks } from '../types'

const PANE = 'swiftux-picks'
const TITLE = 'SwiftUX picks'
const BLURB_MAX = 110

const picks = atom({ plugin: 'swiftux', key: 'picks' } as const, null as Picks | null)

// The server answers with structuredContent and the same JSON as the first
// text block; take whichever this host hands over.
function payload(ran: { result?: unknown; text?: string }): Record<string, unknown> | null {
  const result = ran.result as { structuredContent?: unknown } | undefined
  if (result && typeof result.structuredContent === 'object' && result.structuredContent) {
    return result.structuredContent as Record<string, unknown>
  }
  const text = ran.text ?? ''
  const start = text.indexOf('{')
  if (start < 0) return null
  try {
    return JSON.parse(text.slice(start, text.lastIndexOf('}') + 1))
  } catch {
    return null
  }
}

const str = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value.trim() : null)

const clip = (text: string | null) =>
  !text ? null : text.length > BLURB_MAX ? `${text.slice(0, BLURB_MAX - 1).trimEnd()}…` : text

// Link refuses anything but an https URL spelled as the URL parser spells it.
function safeHref(url: string | null): string | null {
  if (!url) return null
  try {
    const href = new URL(url).href
    return href.startsWith('https://') ? href : null
  } catch {
    return null
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'swiftux-picks', description: 'Show the latest SwiftUX picks in a pane' })
    return next(e)
  })

  on('command.run', { command: 'swiftux-picks' }, async $ => {
    await $.ui.open({ id: PANE, title: TITLE })
    return { text: 'SwiftUX picks pane opened.' }
  })

  // Any server name: mcp__plugin_swiftux_swiftux__show_picks when this
  // plugin carries the server, mcp__swiftux__show_picks when the user added it.
  on('tool.call', { tool: /__show_picks$/ }, async ($, e, next) => {
    const ran = await next(e)
    if (ran.deny !== undefined || ran.isError) return ran
    const body = payload(ran)
    const items = Array.isArray(body?.items) ? (body.items as Array<Record<string, unknown>>) : []
    if (!items.length) return ran

    const cards: PickCard[] = items.map(item => {
      const id = str(item.id) ?? ''
      return {
        id,
        name: str(item.name) ?? id,
        author: str(item.author),
        blurb: clip(str(item.why) ?? str(item.use_when)),
        catalogUrl: safeHref(str(item.catalog_url)),
      }
    })
    const input = e as unknown as Record<string, unknown>
    await update($, picks, () => ({
      summary: str(body?.request_summary) ?? str(input.request_summary) ?? '',
      reasoning: str(body?.reasoning) ?? str(input.reasoning) ?? '',
      cards,
    }))
    // Not awaited: the tool result goes back to the agent at once. A pane that
    // cannot be placed (narrow terminal, no surface) waits or is skipped.
    $.ui.open({ id: PANE, title: TITLE }).catch(() => {})
    return ran
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Link } = $.ui.resolve(e)
    const shown = await read($, picks)
    if (!shown) {
      return (
        <Box flexDirection="column">
          <Text dimColor>No SwiftUX picks yet. They appear here when the agent calls show_picks.</Text>
        </Box>
      )
    }
    return (
      <Box flexDirection="column" gap={1} paddingX={1}>
        {shown.summary && <Text bold>{shown.summary}</Text>}
        {shown.reasoning && <Text>{shown.reasoning}</Text>}
        <Box flexDirection="column" gap={1}>
          {shown.cards.map(card => {
            const title = card.author ? `${card.name} - ${card.author}` : card.name
            return (
              <Box key={card.id} flexDirection="column" borderStyle="round" paddingX={1}>
                {card.catalogUrl ? <Link href={card.catalogUrl} label={title} /> : <Text bold>{title}</Text>}
                {card.blurb && <Text dimColor>{card.blurb}</Text>}
              </Box>
            )
          })}
        </Box>
      </Box>
    )
  })
}
