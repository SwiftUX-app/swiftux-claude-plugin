/** One pick as the picks pane draws it. */
export type PickCard = {
  id: string
  name: string
  author: string | null
  /** Short description: the agent's `why`, else the item's use_when. */
  blurb: string | null
  catalogUrl: string | null
}

/** The latest show_picks call. */
export type Picks = {
  summary: string
  reasoning: string
  cards: PickCard[]
}

declare module 'claude-code' {
  interface PluginState {
    'swiftux': {
      picks: Picks | null
    }
  }
}
