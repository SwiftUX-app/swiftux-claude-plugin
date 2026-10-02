# SwiftUX for Claude Code

[SwiftUX](https://www.swiftux.app) is a catalog of production SwiftUI components (single views) and flows (multi-screen journeys). This plugin connects Claude Code to it, so that when you ask for a piece of UI, Claude finds the catalog items that fit, shows them to you, and adapts the one you choose to your codebase.

## Install

In a Claude Code session (v2.1.275 or later), one command adds the marketplace and installs the plugin:

```
/plugin install swiftux --marketplace SwiftUX-app/swiftux-claude-plugin
```

On earlier versions, run the two steps yourself:

```
/plugin marketplace add SwiftUX-app/swiftux-claude-plugin
/plugin install swiftux@swiftux
```

Then restart Claude Code and ask for one piece of UI, for example *"add a paywall with a monthly/yearly toggle"* or *"onboarding screens for a fitness app"*. `/mcp` should list `plugin:swiftux:swiftux` as connected.

To update later: `/plugin marketplace update swiftux`.

**In Claude's web, desktop or mobile app**, add the server as a connector instead: Settings → Connectors → Add custom connector, with the URL `https://api.swiftux.app/mcp`.

## What you get

- **The SwiftUX MCP server** (`https://api.swiftux.app/mcp`), which provides these tools:
  - `search_catalog` returns every component or flow that fits the request, best first.
  - `show_picks` presents those options to you.
  - `get_component` / `get_flow` and their `*_source` tools let Claude adapt the source you pick.
- **A picks pane** beside the chat. When Claude presents options, the pane shows:
  - a short summary of your request
  - why these picks fit
  - one card per pick: **name - author**, a short description of what it is for, and an **[ Open ]** link to its catalog page

  **[ Close ]** at the top right closes the pane. `/swiftux-picks` reopens the pane. It opens on its own in a terminal at least 144 columns wide; in a narrower one, use the command.

The pane uses Claude Code's function-hooks API, which is in early access. On a Claude Code build without it, the plugin still works: options are listed in the chat as links.

In Claude's web, desktop and mobile apps, and in ChatGPT and Codex, the same server shows its picks as interactive cards (an MCP App), so you don't need this pane there.

## Layout

```
.claude-plugin/marketplace.json     the marketplace: one plugin, "swiftux"
plugins/swiftux/
  .claude-plugin/plugin.json        the plugin manifest
  .mcp.json                         the SwiftUX MCP server
  hooks/register.tsx                the picks pane
  types/index.d.ts                  the pane's state contract
  tests/picks.test.ts               claude plugin test plugins/swiftux
```

## Develop

```
claude plugin validate .
claude plugin validate plugins/swiftux
claude plugin test plugins/swiftux
claude --plugin-dir plugins/swiftux       # try a local copy
```

Releasing: raise `version` in `plugins/swiftux/.claude-plugin/plugin.json` and push. Installed copies update from the marketplace.

## Privacy

The plugin sends your UI request (`ux_task`) to the SwiftUX API to search the catalog. It does not read your code to search, and it does not send your code anywhere.
