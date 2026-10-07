// SwiftUX picks pane (Claude Code): when the agent calls the SwiftUX MCP
// server's show_picks, open a pane beside the chat with the request summary, the
// reasoning, and one card per pick (name - author, a short description) ending
// in [ Open ], which opens the catalog page in the browser, and [ Add to chat ],
// which attaches the pick to the person's next prompt as context for the agent;
// [ Close ] at the top right closes it. The terminal counterpart of the MCP App
// that ChatGPT, Codex and Claude's chat apps render for the same tool.
import { atom, read, update } from 'claude-code'
import type { CoreEngineInterface, Register } from 'claude-code'

import type { PickCard, Picks } from '../types'

const PANE = 'swiftux-picks'
const TITLE = 'SwiftUX picks'
const BLURB_MAX = 110

const picks = atom({ plugin: 'swiftux', key: 'picks' } as const, null as Picks | null)
const attached = atom({ plugin: 'swiftux', key: 'attached' } as const, [] as PickCard[])

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

// No call on $ opens a URL, so ask the OS: open on macOS, xdg-open elsewhere.
async function openInBrowser($: CoreEngineInterface, url: string) {
  for (const opener of ['open', 'xdg-open']) {
    try {
      const { exitCode } = await $.process.run([opener, url], { timeoutMs: 5000 })
      if (exitCode === 0) return
    } catch {
      // Not on this system; try the next one.
    }
  }
  $.ui.toast(`Open in your browser: ${url}`)
}

async function setAttached($: CoreEngineInterface, fn: (cards: PickCard[]) => PickCard[]) {
  const next = await update($, attached, fn)
  const n = next.length
  $.ui.status(n ? `SwiftUX: ${n} pick${n > 1 ? 's' : ''} attached to your next prompt` : undefined)
}

const contextBlock = (cards: PickCard[]) =>
  [
    'The user picked these SwiftUX catalog items to use: call get_component or get_flow with the id, then its *_source tool, and adapt it.',
    ...cards.map(card => {
      const parts = [`- ${card.kind} "${card.name}" (id ${card.id})${card.author ? ` by ${card.author}` : ''}`]
      if (card.catalogUrl) parts.push(card.catalogUrl)
      if (card.why) parts.push(card.why)
      return parts.join(' — ')
    }),
  ].join('\n')

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'swiftux-picks', description: 'Show the latest SwiftUX picks in a pane' })
    return next(e)
  })

  on('command.run', { command: 'swiftux-picks' }, async $ => {
    await $.ui.open({ id: PANE, title: TITLE })
    return { text: 'SwiftUX picks pane opened.' }
  })

  // Picks added to the chat ride along with the person's next prompt, unseen
  // by them, then the list empties. A prompt a plugin submits carries none.
  on('prompt.submit', async ($, e, next) => {
    if (e.origin?.kind === 'plugin') return next(e)
    const cards = await read($, attached)
    if (!cards.length) return next(e)
    await setAttached($, () => [])
    return next({ ...e, context: [...(e.context ?? []), contextBlock(cards)] })
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
      const why = str(item.why)
      return {
        kind: item.kind === 'flow' ? 'flow' : 'component',
        id,
        name: str(item.name) ?? id,
        author: str(item.author),
        blurb: clip(why ?? str(item.use_when)),
        why,
        catalogUrl: safeHref(str(item.catalog_url)),
      }
    })
    const input = e as unknown as Record<string, unknown>
    await update($, picks, () => ({
      summary: str(body?.request_summary) ?? str(input.request_summary) ?? '',
      reasoning: str(body?.reasoning) ?? str(input.reasoning) ?? '',
      cards,
    }))
    await setAttached($, () => [])
    // Not awaited: the tool result goes back to the agent at once. A pane that
    // cannot be placed (narrow terminal, no surface) waits or is skipped.
    $.ui.open({ id: PANE, title: TITLE }).catch(() => {})
    return ran
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const shown = await read($, picks)
    const added = new Set((await read($, attached)).map(card => card.id))
    const close = (
      <Box justifyContent="flex-end">
        <Button key="close" role="dismiss" onPress={() => void $.ui.close({ id: PANE }).catch(() => {})}>
          Close
        </Button>
      </Box>
    )
    if (!shown) {
      return (
        <Box flexDirection="column">
          {close}
          <Text dimColor>No SwiftUX picks yet. They appear here when the agent calls show_picks.</Text>
        </Box>
      )
    }
    return (
      <Box flexDirection="column" gap={1} paddingX={1}>
        {close}
        {shown.summary && <Text bold>{shown.summary}</Text>}
        {shown.reasoning && <Text>{shown.reasoning}</Text>}
        <Box flexDirection="column" gap={1}>
          {shown.cards.map(card => {
            const title = card.author ? `${card.name} - ${card.author}` : card.name
            return (
              <Box key={card.id} flexDirection="column" borderStyle="round" paddingX={1}>
                <Text bold>{title}</Text>
                {card.blurb && <Text dimColor>{card.blurb}</Text>}
                <Box gap={1}>
                  {card.catalogUrl && (
                    <Button key={`open-${card.id}`} onPress={() => void openInBrowser($, card.catalogUrl!)}>
                      Open
                    </Button>
                  )}
                  {added.has(card.id) ? (
                    <Button
                      key={`add-${card.id}`}
                      onPress={() => void setAttached($, cards => cards.filter(c => c.id !== card.id))}
                    >
                      Added ✓
                    </Button>
                  ) : (
                    <Button
                      key={`add-${card.id}`}
                      variant="primary"
                      onPress={async () => {
                        await setAttached($, cards => [...cards.filter(c => c.id !== card.id), card])
                        $.ui.toast(`Added ${card.name} to the chat`)
                      }}
                    >
                      Add to chat
                    </Button>
                  )}
                </Box>
              </Box>
            )
          })}
        </Box>
      </Box>
    )
  })
}
