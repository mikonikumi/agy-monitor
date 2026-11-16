# agy-monitor

[简体中文](./README.md)

A small toy plugin built while using Antigravity to check how much of the current chat's context window (auto-detecting the live `256K` / `512K`+ cap) is left and where the tokens went. It reads local logs and SQLite files directly, has zero external dependencies, and works right after cloning without `npm install` (supports switching between English and Chinese in the top-right corner).

## Features

- Automatically detect the current chat's real context window cap (e.g. `256K` / `512K`), broken down across Rules, System, MCP, Skills, chat messages, and tool outputs, plus which tool steps caused big jumps.
- When running Subagents or Swarm workers, view combined token usage alongside each subagent's own isolated context window share, and click any subagent row to inspect its breakdown and hop between siblings.
- Get a heads-up in the next reply (with a quick link to open the pane) when a chat crosses `80%` or `92%` of the auto-compaction line — or turn it off in the pane if you don't want it.
- Browse global request logs by time range, day, or hour, check per-project rankings, and see the actual underlying model used on each step instead of vague `Auto` labels. If you use both WSL and Windows, records from both sides are merged automatically, and you can pop the dashboard out into a full-width browser tab.

## Installation

Requires Node.js on your machine (`22.5+` recommended so the built-in SQLite module can read local session databases directly).

Clone directly into Antigravity's plugins folder:

macOS / Linux / WSL:

```bash
git clone https://github.com/mikonikumi/agy-monitor.git ~/.gemini/config/plugins/agy-monitor
```

Windows (PowerShell):

```powershell
git clone https://github.com/mikonikumi/agy-monitor.git "$env:USERPROFILE\.gemini\config\plugins\agy-monitor"
```

If you installed Node on WSL / Linux via `nvm` or `fnm` and the pane fails to start because non-login shells cannot find `node`, symlink it into `/usr/local/bin`:

```bash
sudo ln -sf "$(command -v node)" /usr/local/bin/node
```

Enable `agy-monitor` on the Plugins page in Antigravity (restart the client once if it doesn't show up on first install), then click the sidebar icon at the top right of a chat to open it.

To update later, just pull inside the plugin folder:

```bash
git -C ~/.gemini/config/plugins/agy-monitor pull
```
