# agy-monitor

平时用 Google Antigravity 时顺手搓的一个小玩具插件，主要用来看看当前对话的 `256K` 上下文还剩多少、Token 都花在哪一步了。纯本地读日志和数据库，零依赖，克隆下来就能用，不需要 `npm install`。

## 主要功能

- 看当前对话的 `256K` 上下文窗口占用，拆开看 Rules、System、MCP、Skills、聊天消息和工具输出各自占了多少，顺便看看哪几步工具调用突然把上下文撑大了。
- 跑 Subagent 或 Swarm 时，能看到每个子智能体各自的消耗和独立窗口占比，点一下就能进子智能体看明细和来回切换。
- 聊天流里带一个小状态条方便点开面板，上下文快到 `80%` / `92%` 自动压缩线时会提前提醒（走宿主 UI 通道展示，不消耗模型 Token，不喜欢也可以在面板里关掉）。
- 全局统计页可以按时间段、按天或按小时翻历史请求日志，看项目排行和实际调用的真实模型（不糊弄显示成 `Auto`）。同时用 WSL 和 Windows 的话两边记录会自动合在一起看，嫌侧边栏窄也能点右上角用浏览器大屏打开。

## 安装方式

需要本机装有 Node.js（建议 `22.5+`，方便直接读本地 SQLite 记录）。

直接 `git clone` 到 Antigravity 的插件目录即可：

macOS / Linux / WSL：

```bash
git clone https://github.com/mikonikumi/agy-monitor.git ~/.gemini/config/plugins/agy-monitor
```

Windows (PowerShell)：

```powershell
git clone https://github.com/mikonikumi/agy-monitor.git "$env:USERPROFILE\.gemini\config\plugins\agy-monitor"
```

如果 WSL / Linux 下是用 `nvm` 或 `fnm` 装的 Node 导致面板起不来，做个软链让系统路径能找到 `node` 就行：

```bash
sudo ln -sf "$(command -v node)" /usr/local/bin/node
```

克隆后在 Antigravity 的 Plugins 页面里启用 `agy-monitor`（首次没刷出来的话重启一下客户端），之后点对话右上角的侧边栏图标或聊天框里的小胶囊就能打开。

后续更新直接在插件目录里拉一下代码即可：

```bash
git -C ~/.gemini/config/plugins/agy-monitor pull
```
