import { expect, test } from 'claude-code/testing'

const PICKS = {
  request_summary: 'A subscription paywall with a feature list and annual/monthly pricing.',
  reasoning: 'Both present plans with a feature list; the sheet suits an upsell, the card a membership.',
  items: [
    { kind: 'component', id: 'p1', name: 'Bottom Sheet Paywall', author: 'Ana', catalog_url: 'https://www.swiftux.app/components/paywall/p1', use_when: 'Paywall that slides up as a sheet with plan options', why: null },
    { kind: 'component', id: 'p2', name: 'Membership Card Paywall', author: null, catalog_url: 'https://www.swiftux.app/components/paywall/p2', use_when: 'Paywall built around a membership card', why: 'For a members-only tier' },
  ],
}
const reply = (body: unknown) => ({ result: { content: [{ type: 'text', text: JSON.stringify(body) }], isError: false, structuredContent: body }, text: JSON.stringify(body) })

for (const surface of ['terminal', 'desktop'] as const) {
  test(`show_picks fills the pane with linked cards (${surface})`, async ($, on) => {
    const opened: string[] = []
    on('ui.open', (_$, e) => { opened.push(e.id); return { value: { isPlaced: true as const } } })
    on('tool.call', { tool: 'mcp__plugin_swiftux_swiftux__show_picks' }, () => reply(PICKS))

    await $.tool.call({ tool: 'mcp__plugin_swiftux_swiftux__show_picks', ...PICKS } as never)
    expect(opened).toContain('swiftux-picks')

    const ui = await $.ui.mount({ plugin: 'swiftux', surface, component: 'Pane', requestId: 'swiftux-picks', props: { title: 'SwiftUX picks', isFocused: false, bodyColumns: 60, placement: 'dock' } as never })
    expect(await ui.find({ type: 'Text', text: 'subscription paywall with a feature list' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'the sheet suits an upsell' })).toBeDefined()

    expect(await ui.find({ type: 'Text', text: 'Bottom Sheet Paywall - Ana' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'Membership Card Paywall' })).toBeDefined()
    expect(await ui.find({ key: 'open:p1' })).toBeDefined()
    expect(await ui.find({ key: 'open:p2' })).toBeDefined()
    // No why: the card's use_when; a why wins over it.
    expect(await ui.find({ type: 'Text', text: 'slides up as a sheet' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'For a members-only tier' })).toBeDefined()
  })
}

test('the pane says so before any picks', async $ => {
  const ui = await $.ui.mount({ plugin: 'swiftux', surface: 'terminal', component: 'Pane', requestId: 'swiftux-picks', props: { title: 'SwiftUX picks', isFocused: false, bodyColumns: 60, placement: 'dock' } as never })
  expect(await ui.find({ type: 'Text', text: 'No SwiftUX picks yet' })).toBeDefined()
})

test('a failed show_picks leaves the pane alone', async ($, on) => {
  on('ui.open', () => ({ value: { isPlaced: true as const } }))
  on('tool.call', { tool: 'mcp__plugin_swiftux_swiftux__show_picks' }, () => ({ result: { content: [{ type: 'text', text: 'boom' }], isError: true }, text: 'boom', isError: true }))
  await $.tool.call({ tool: 'mcp__plugin_swiftux_swiftux__show_picks', ...PICKS } as never)
  const ui = await $.ui.mount({ plugin: 'swiftux', surface: 'terminal', component: 'Pane', requestId: 'swiftux-picks', props: { title: 'SwiftUX picks', isFocused: false, bodyColumns: 60, placement: 'dock' } as never })
  expect(await ui.find({ type: 'Text', text: 'No SwiftUX picks yet' })).toBeDefined()
})

test('Close closes the pane', async ($, on) => {
  const closed: string[] = []
  on('ui.close', (_$, e) => { closed.push(e.id); return {} })
  const ui = await $.ui.mount({ plugin: 'swiftux', surface: 'terminal', component: 'Pane', requestId: 'swiftux-picks', props: { title: 'SwiftUX picks', isFocused: false, bodyColumns: 60, placement: 'dock' } as never })
  await ui.press({ key: 'close' })
  expect(closed).toEqual(['swiftux-picks'])
})

test('Open opens the catalog page in the browser', async ($, on) => {
  const ran: string[][] = []
  on('ui.open', () => ({ value: { isPlaced: true as const } }))
  on('tool.call', { tool: 'mcp__plugin_swiftux_swiftux__show_picks' }, () => reply(PICKS))
  on('process.run', (_$, e) => {
    ran.push([...e.argv])
    return { value: { exitCode: 0, stdout: e.argv[0] === 'uname' ? 'Darwin\n' : '', stderr: '' } }
  })
  await $.tool.call({ tool: 'mcp__plugin_swiftux_swiftux__show_picks', ...PICKS } as never)
  const ui = await $.ui.mount({ plugin: 'swiftux', surface: 'terminal', component: 'Pane', requestId: 'swiftux-picks', props: { title: 'SwiftUX picks', isFocused: false, bodyColumns: 60, placement: 'dock' } as never })
  await ui.press({ key: 'open:p2' })
  expect(ran.at(-1)).toEqual(['open', 'https://www.swiftux.app/components/paywall/p2'])
})
