/**
 * agy-monitor — Frontend Application & Pure Visualization/State Helpers
 *
 * Zero external runtime dependencies. Runs natively in AGY Sidecar iframe
 * (with preload.js CSS variables & window.sidecar bridge), in standalone
 * fullscreen browser mode (?tab=global&fullscreen=1), in ?mock=1 preview mode,
 * and can be imported directly by Node.js unit tests (test/web_ui.test.mjs).
 */

export const CONTEXT_LIMIT = 256_000;
export const AUTOCOMPACT_BUFFER = 6_000;
export const SAFE_CONTEXT_LIMIT = 250_000;
export const ALERT_WARN_TOKENS = 204_800;     // 80% of 256K
export const ALERT_CRITICAL_TOKENS = 235_520; // 92% of 256K
export const LANG_STORAGE_KEY = 'agy_monitor_lang';

export const CATEGORY_DEFINITIONS = [
  { id: 'rules', label: 'Rules 规则文件', labelEn: 'Rules Files' },
  { id: 'system', label: 'System 底座与内置工具', labelEn: 'System Prompt & Built-in Tools' },
  { id: 'mcp', label: 'MCP 工具', labelEn: 'MCP Tool Schemas' },
  { id: 'skills', label: 'Skills 技能', labelEn: 'Skills' },
  { id: 'messages', label: '对话消息与附件', labelEn: 'Chat Messages & Media' },
  { id: 'toolResults', label: '工具调用结果', labelEn: 'Tool Call Results' },
];

export const CATEGORY_LABELS_EN = Object.freeze({
  rules: 'Rules Files',
  system: 'System Prompt & Built-in Tools',
  mcp: 'MCP Tool Schemas',
  skills: 'Skills',
  messages: 'Chat Messages & Media',
  toolResults: 'Tool Call Results',
});

const MONTH_NAMES_EN = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const I18N_MESSAGES = {
  zh: {
    'doc.title': 'agy-monitor · 上下文与全局 Token 监控',
    'header.previewBadge': '预览模式',
    'header.mockBadge': 'MOCK 预览',
    'header.fullscreenBadge': '全屏总控',
    'header.syncTitle': '点击立即同步并查看实时状态',
    'header.syncLive': '实时',
    'header.syncSyncing': '同步中…',
    'header.syncOffline': '离线',
    'header.syncError': '连接受阻',
    'header.syncDemo': '演示数据',
    'header.langToggleText': 'EN',
    'header.langToggleTitle': 'Switch to English',
    'header.refreshTitle': '立即刷新数据',
    'header.fullscreenBtn': '大屏展开',
    'header.fullscreenTitle': '在浏览器打开全屏总控大屏',
    'fsbar.label': '全屏总控地址',
    'fsbar.inputAria': '全屏总控链接',
    'fsbar.copyBtn': '复制链接',
    'fsbar.openLink': '新窗口打开',
    'fsbar.closeAria': '收起',
    'tabs.aria': '监控主视图切换',
    'tabs.conversation': '当前对话',
    'tabs.global': '全局总控',
    'drill.navAria': '子智能体下钻导航',
    'drill.backMain': '← 返回主会话',
    'drill.backMainTitle': '返回主会话：{title}',
    'drill.viewingSubagent': '正在查看子智能体: @{role}',
    'drill.openHost': '在宿主打开对话 ↗',
    'drill.openHostTitle': '在当前客户端宿主窗口直接打开该子智能体会话',
    'drill.siblingsAria': '同组会话与子智能体快捷切换',
    'drill.mainPill': '主会话',
    'drill.parentFallback': '上级会话',
    'meta.sectionAria': '当前会话信息',
    'meta.loadingConv': '加载当前会话中…',
    'meta.untitledConv': '未命名会话',
    'meta.activeConvFallback': '当前活跃会话',
    'meta.alertHealthy': '水位安全',
    'meta.alertWarn': '80%+ 压缩警戒区',
    'meta.alertCritical': '92%+ 临近压缩高危',
    'meta.modelTitle': '当前生效模型',
    'meta.modelKey': '模型',
    'meta.workspaceKey': '工作区',
    'meta.noWorkspace': '未绑定工作区',
    'meta.switchConvAria': '切换查看会话',
    'meta.switchConvTitle': '切换会话',
    'meta.subagentOpt': '↳ @{role} (子智能体)',
    'cons.sectionAria': '本对话总消耗归集',
    'cons.cardLabel': '本对话含缓存总消耗（主会话 + 子智能体）',
    'cons.noSubagents': '无子智能体',
    'cons.mainOnly': '仅主会话',
    'cons.subagentView': '子智能体独立视图',
    'cons.nSubagents': '含 {count} 个子智能体 / Swarm',
    'cons.exactTitle': '精确含缓存总消耗：{exact} tokens',
    'cons.heroSub': '约 {zh} · 精确 {exact}',
    'cons.splitAria': '主会话与子智能体消耗占比',
    'cons.selfName': '主会话',
    'cons.subName': '派生子智能体 / Swarm',
    'cons.subWinBadge': '窗口 {pct}%',
    'cons.subWinTitle': '该子智能体独立 {cap} 窗口使用率',
    'cons.subCpBadge': '压缩 {count}次',
    'cons.subCpTitle': '该子智能体已触发 CHECKPOINT 自动压缩次数',
    'cons.subRowTitle': '点击下钻查看该子智能体的 {cap} 窗口与步骤明细',
    'stats.sectionAria': '吞吐与流速详情',
    'stats.inputLabel': '累计新增输入',
    'stats.outputLabel': '累计输出',
    'stats.cacheLabel': '缓存命中量 / 命中率',
    'stats.speedLabel': '平均输出流速',
    'stats.speedSub': 'output / 单步耗时',
    'stats.durationLabel': '单步推理耗时',
    'stats.latestDuration': '最近一步: {val}',
    'stats.checkpointLabel': 'CHECKPOINT 自动压缩',
    'stats.checkpointCount': '{count} 次',
    'stats.checkpointBadge': '已压缩',
    'stats.checkpointNone': '当前尚未触发自动压缩',
    'stats.checkpointReset': '已触发自动上下文压缩重置',
    'stats.checkpointLatest': '最近 #{step}: {before} → {after} ({delta})',
    'win.sectionAria': '{cap} 上下文窗口拆解',
    'win.labelMain': '上下文窗口构成（仅主会话 · 锚定 {cap}）',
    'win.labelSubagent': '上下文窗口构成（子智能体 @{role} · 锚定 {cap}）',
    'win.methodologyBtn': '口径说明 ?',
    'win.methodologyHtml': '<strong>底座锁死 + Step Delta 守恒归因：</strong>总占用 100% 锚定当前压缩周期最新模型步骤的官方 <code>input + cache_read + output</code>（绝不混入子智能体窗口）。当前检测到窗口上限为 <code>{limitExact}</code> Token，其中右侧 <code>{safeCap}–{cap}</code> 为自动压缩触发警戒带（<code>Autocompact buffer ~{bufCap}</code>）。静态底座四子项与单步并行工具切分采用字符权重（CJK 0.65 / ASCII 0.25）守恒分摊，六大分类之和恒等于真实上下文总量。',
    'win.usedPct': '已使用 {pct}%',
    'win.exactTitle': '精确占用：{used} / {limit} tokens',
    'win.barAria': '{cap} 上下文分段占用条',
    'win.mark80Title': '80% 预警线 ({warnTok})',
    'win.mark92Title': '92% 临近压缩高危线 ({critTok})',
    'win.catListAria': '六大活跃上下文分类',
    'win.catExactTitle': '精确 Token: {exact}',
    'win.bufferLabel': 'Autocompact buffer 警戒带',
    'win.bufferSegTitle': 'Autocompact buffer 自动压缩警戒缓冲带 (~{buf})',
    'win.freeLabel': '安全剩余空间 (Free space)',
    'win.freeSegTitle': 'Free space 安全剩余空间: {free}',
    'win.deferredAria': '按需未加载估算项',
    'win.deferredTitle': '按需未加载项（Deferred · 暂不占用当前窗口）',
    'win.deferredTotal': '约 {tokens} 未加载',
    'win.deferredItemCount': '~{tokens} ({count} 项)',
    'win.deferredMcp': 'Lazy MCP 工具定义',
    'win.deferredSkills': '未激活 Skills 正文',
    'alert.sectionAria': '聊天内临近压缩提醒设置',
    'alert.title': '聊天内临近压缩提醒',
    'alert.descHtml': '开启后，当单会话上下文首次突破 <code>80% ({warnTok})</code> 或 <code>92% ({critTok})</code> 时，在下一轮回复中自动附带压缩预警与面板打开链接。',
    'alert.savedOn': '已保存：上下文突破 80% / 92% 时将在下一轮回复中自动附带压缩预警与面板链接',
    'alert.savedOff': '已保存：聊天内临近压缩提醒已关闭，仅在监控面板内部高亮',
    'alert.demoSuffix': '（预览模式）',
    'alert.err401': '缺少有效 X-Sidecar-Token 鉴权 (401)',
    'alert.errStatus': '保存失败 ({status})',
    'alert.errFeedback': '保存设置失败：{msg}',
    'alert.errToast': '设置未保存：{msg}',
    'drawers.sectionAria': '上下文配置与单步暴涨明细',
    'drawers.rulesTitle': 'Rules 规则文件',
    'drawers.rulesCount': '{count} 个文件',
    'drawers.rulesEmpty': '当前工作区与全局未检测到已加载的 AGENTS.md / GEMINI.md / rules 文件。',
    'drawers.ruleFallback': '规则文件',
    'drawers.mcpTitle': 'MCP 工具',
    'drawers.mcpCount': '{count} 个服务',
    'drawers.mcpEmpty': '当前会话未挂载常驻 Eager MCP Schema。',
    'drawers.mcpLazyVal': '按需 ~{tokens}',
    'drawers.mcpLazyMode': 'Lazy 按需未加载',
    'drawers.mcpEagerMode': 'Eager 常驻',
    'drawers.mcpToolCount': '{count} 个工具',
    'drawers.skillsTitle': 'Skills 技能',
    'drawers.skillsCount': '{count} 项技能',
    'drawers.skillsEmpty': '未检测到已注入或已激活读取的技能记录。',
    'drawers.skillActivated': '已激活',
    'drawers.skillReadBody': '已在本会话读取正文',
    'drawers.skillSummaryOnly': '仅底座摘要驻留',
    'drawers.spikesTitle': '单步暴涨 Top 明细',
    'drawers.spikesCount': 'Top {count}',
    'drawers.spikesEmpty': '当前周期内尚无显著单步工具调用暴涨记录。',
    'global.subtitle': '跨端全量账本 · 自动聚合 WSL 与 Windows 下 Desktop / IDE / CLI',
    'global.metricsAria': '全局五大核心指标',
    'global.metricTotalLabel': '累计 Token 数',
    'global.metricTotalSub': '{en} · 含缓存总吞吐',
    'global.metricTotalTitle': '精确累计 Token：{exact} ({en})',
    'global.metricPeakLabel': 'Token 使用峰值',
    'global.metricPeakSubDate': '峰值日 {date}',
    'global.metricPeakSubDefault': '单日最高吞吐',
    'global.metricPeakTitle': '单日最高精确 Token：{exact}{dateSuffix}',
    'global.metricTaskLabel': '最长任务用时',
    'global.metricTaskSub': '单轮连续执行（剔除挂机）',
    'global.metricTaskTitle': '单轮连续最长耗时：{short} ({exact} ms，已剔除两次提问间人工闲置时间)',
    'global.metricLongestStreakLabel': '最长连续天数',
    'global.metricLongestStreakSub': '历史最高活跃连击',
    'global.metricLongestStreakTitle': '历史最长连续活跃自然日：{days} 天',
    'global.metricCurrentStreakLabel': '当前连续天数',
    'global.metricCurrentStreakSub': '本地自然日连续活跃',
    'global.metricCurrentStreakTitle': '截至最近活跃日的当前连续天数：{days} 天',
    'chart.sectionAria': 'Token 活动趋势图表',
    'chart.heading': 'Token 活动',
    'chart.tablistAria': 'Token 活动时间维度',
    'chart.tabDaily': '每天',
    'chart.tabWeekly': '每周',
    'chart.tabCumulative': '累计总量',
    'chart.captionDaily': '过去 365 天每日贡献热力图（点击蓝阶格子下钻筛选当日日志）',
    'chart.captionWeekly': '按自然周聚合总吞吐趋势（点击柱条筛选该周调用日志）',
    'chart.captionCumulative': '随时间推进的全局累计 Token 增长曲线（点击节点筛选当日日志）',
    'chart.clearFilterBtn': '× 清除日期筛选',
    'chart.clearChipAria': '重置日期筛选',
    'chart.filterDay': '日期筛选: {date}',
    'chart.filterWeek': '周次筛选: {start} ~ {end}',
    'chart.filterBarPrefix': '当前图表下钻 · {desc}',
    'fallback.title': '会话详情',
    'fallback.closeAria': '关闭会话提示',
    'fallback.inspectBtn': '在本监控面板查看该会话上下文',
    'fallback.copyIdBtn': '复制会话 ID',
    'fallback.keyId': '会话 ID',
    'fallback.keySurface': '所属客户端',
    'fallback.keyWorkspace': '项目 / 工作区',
    'fallback.keyModel': '模型',
    'fallback.toastOpened': '{surface}：已展开会话详情说明',
    'table.sectionAria': 'AGY 调用日志与多维汇总',
    'table.subtabsAria': '全局表格维度',
    'table.caption': 'AGY 全局模型调用与排行明细表',
    'subtab.requests': '请求日志',
    'subtab.timeline': '按时间汇总',
    'subtab.projects': '项目/对话排行',
    'subtab.models': '模型汇总',
    'time.groupAria': '按时间范围查看与排序',
    'time.all': '全部时间',
    'time.1h': '近1小时',
    'time.today': '今天',
    'time.24h': '近24h',
    'time.7d': '近7天',
    'time.30d': '近30天',
    'time.custom': '自定义时段',
    'time.sortTitle': '切换按时间倒序或正序排列',
    'time.sortNewest': '时间: 最新 ↓',
    'time.sortOldest': '时间: 最早 ↑',
    'time.granularityAria': '按时间汇总粒度',
    'time.byDay': '按天',
    'time.byHour': '按小时',
    'time.rangeLabel': '起止：',
    'time.startAria': '自定义开始时间',
    'time.endAria': '自定义结束时间',
    'time.resetBtn': '重置时间',
    'status.groupAria': '按步骤状态筛选',
    'status.all': '全部',
    'status.normal': '正常',
    'status.checkpoint': '压缩',
    'status.error': '报错',
    'table.loadMore': '加载更多（剩余 {remaining} 条）',
    'table.scrollTop': '↑ 回到顶部',
    'toast.langSwitched': '已切换为中文',
    'toast.syncOk': '实时自动同步正常（每 2.8s）· 已同步最新数据',
    'toast.refreshed': '已刷新最新监控数据',
    'toast.fsOpenedCopied': '已在系统浏览器打开全屏总控（链接已复制）',
    'toast.fsOpened': '已在系统浏览器打开全屏总控',
    'toast.fsCopied': '已复制全屏总控链接，可点击顶部「新窗口打开」或在浏览器粘贴访问',
    'toast.fsBarShown': '已展开全屏总控地址栏，可点击「新窗口打开」访问',
    'toast.urlCopied': '已复制全屏总控链接',
    'toast.urlManualCopy': '请选中输入框手动复制链接',
    'toast.drilledSubRole': '已下钻查看子智能体 @{role} 的 {cap} 窗口与明细',
    'toast.drilledSub': '已下钻查看子智能体明细',
    'toast.backToMain': '已返回主会话视图',
    'toast.switchedWorker': '已切换查看 {label}',
    'toast.openedInHost': '已请求宿主打开该子智能体会话',
    'toast.timeFiltered': '时间筛选「{desc}」：共 {count} 条匹配日志',
    'toast.sortAsc': '已切换为按时间正序（最早 → 最新）',
    'toast.sortDesc': '已切换为按时间倒序（最新 → 最早）',
    'toast.granHour': '已切换为按小时聚合汇总',
    'toast.granDay': '已切换为按自然日聚合汇总',
    'toast.bucketDrilled': '已下钻至时段「{label}」：共 {count} 条请求日志',
    'toast.statusFiltered': '已切换筛选「{label}」：共 {count} 条匹配日志',
    'toast.loadedMore': '已展开显示 {shown} / 共 {total} 条记录',
    'toast.copiedId': '已复制会话 ID：{id}',
    'toast.rawId': '会话 ID：{id}',
    'err.convLoad': '无法读取当前会话数据（{msg}）。',
    'err.globalLoad': '无法读取全局统计数据（{msg}）。',
    'err.mockBtn': '使用模拟数据预览',
  },
  en: {
    'doc.title': 'agy-monitor · Context & Global Token Monitor',
    'header.previewBadge': 'Preview',
    'header.mockBadge': 'Demo Mode',
    'header.fullscreenBadge': 'Fullscreen',
    'header.syncTitle': 'Click to sync now and check live status',
    'header.syncLive': 'Live',
    'header.syncSyncing': 'Syncing…',
    'header.syncOffline': 'Offline',
    'header.syncError': 'Error',
    'header.syncDemo': 'Demo',
    'header.langToggleText': '中文',
    'header.langToggleTitle': '切换为中文',
    'header.refreshTitle': 'Refresh data now',
    'header.fullscreenBtn': 'Expand',
    'header.fullscreenTitle': 'Open fullscreen dashboard in browser',
    'fsbar.label': 'Fullscreen URL',
    'fsbar.inputAria': 'Fullscreen dashboard link',
    'fsbar.copyBtn': 'Copy Link',
    'fsbar.openLink': 'Open in New Tab',
    'fsbar.closeAria': 'Dismiss',
    'tabs.aria': 'Primary monitor views',
    'tabs.conversation': 'Current Chat',
    'tabs.global': 'Global Overview',
    'drill.navAria': 'Subagent drilldown navigation',
    'drill.backMain': '← Back to Main',
    'drill.backMainTitle': 'Back to Main: {title}',
    'drill.viewingSubagent': 'Viewing Subagent: @{role}',
    'drill.openHost': 'Open in Host ↗',
    'drill.openHostTitle': 'Open this subagent conversation in the host window',
    'drill.siblingsAria': 'Sibling conversations and subagents',
    'drill.mainPill': 'Main',
    'drill.parentFallback': 'Parent Chat',
    'meta.sectionAria': 'Current session metadata',
    'meta.loadingConv': 'Loading conversation…',
    'meta.untitledConv': 'Untitled Session',
    'meta.activeConvFallback': 'Untitled Session',
    'meta.alertHealthy': 'Healthy',
    'meta.alertWarn': 'High (80%+)',
    'meta.alertCritical': 'Critical (92%+)',
    'meta.modelTitle': 'Active model',
    'meta.modelKey': 'Model',
    'meta.workspaceKey': 'Workspace',
    'meta.noWorkspace': 'No Workspace',
    'meta.switchConvAria': 'Switch inspected conversation',
    'meta.switchConvTitle': 'Switch conversation',
    'meta.subagentOpt': '↳ @{role} (Subagent)',
    'cons.sectionAria': 'Total conversation token consumption',
    'cons.cardLabel': 'Total Tokens incl. Cache (Main + Subagents)',
    'cons.noSubagents': 'No Subagents',
    'cons.mainOnly': 'No Subagents',
    'cons.subagentView': 'Subagent View',
    'cons.nSubagents': '{count} Subagents / Swarm',
    'cons.exactTitle': 'Exact total incl. cache: {exact} tokens',
    'cons.heroSub': 'Exact {exact} tokens',
    'cons.splitAria': 'Main chat vs subagents consumption share',
    'cons.selfName': 'Main Chat',
    'cons.subName': 'Subagents / Swarm',
    'cons.subWinBadge': 'Win {pct}%',
    'cons.subWinTitle': 'Subagent independent {cap} context window usage',
    'cons.subCpBadge': 'Compacted {count}x',
    'cons.subCpTitle': 'Auto-compaction checkpoints triggered in this subagent',
    'cons.subRowTitle': 'Click to inspect this subagent {cap} window and step spikes',
    'stats.sectionAria': 'Throughput and speed metrics',
    'stats.inputLabel': 'Uncached Input',
    'stats.outputLabel': 'Total Output',
    'stats.cacheLabel': 'Cache Read / Hit Rate',
    'stats.speedLabel': 'Avg Output Speed',
    'stats.speedSub': 'output / step time',
    'stats.durationLabel': 'Avg Step Time',
    'stats.latestDuration': 'Latest: {val}',
    'stats.checkpointLabel': 'Auto-Compactions',
    'stats.checkpointCount': '{count}x',
    'stats.checkpointBadge': 'Compacted',
    'stats.checkpointNone': 'No auto-compaction yet',
    'stats.checkpointReset': 'Context auto-compacted',
    'stats.checkpointLatest': 'Latest #{step}: {before} → {after} ({delta})',
    'win.sectionAria': '{cap} context window breakdown',
    'win.labelMain': 'Context Window (Main Only · {cap} Cap)',
    'win.labelSubagent': 'Context Window (Subagent @{role} · {cap} Cap)',
    'win.methodologyBtn': 'How it works ?',
    'win.methodologyHtml': '<strong>Locked Baseline + Step-Delta Conservation:</strong> Total occupancy is 100% anchored to the latest model step’s official <code>input + cache_read + output</code> in the current compaction cycle (subagent windows are never mixed in). Detected window cap is <code>{limitExact}</code> tokens, with <code>{safeCap}–{cap}</code> reserved as the auto-compaction trigger zone (<code>Autocompact Buffer ~{bufCap}</code>). Static baseline items and parallel tool steps are apportioned by character weights (CJK 0.65 / ASCII 0.25) so all 6 categories strictly sum to the exact context total.',
    'win.usedPct': 'Used {pct}%',
    'win.exactTitle': 'Exact usage: {used} / {limit} tokens',
    'win.barAria': '{cap} segmented context occupancy bar',
    'win.mark80Title': '80% warning threshold ({warnTok})',
    'win.mark92Title': '92% critical compaction threshold ({critTok})',
    'win.catListAria': 'Six active context categories',
    'win.catExactTitle': 'Exact tokens: {exact}',
    'win.bufferLabel': 'Autocompact Buffer',
    'win.bufferSegTitle': 'Autocompact Buffer (~{buf})',
    'win.freeLabel': 'Safe Free Space',
    'win.freeSegTitle': 'Safe Free Space: {free}',
    'win.deferredAria': 'Deferred unloaded items estimate',
    'win.deferredTitle': 'Deferred Items (Not Loaded in Window)',
    'win.deferredTotal': '~{tokens}',
    'win.deferredItemCount': '~{tokens} ({count} items)',
    'win.deferredMcp': 'Lazy MCP Schemas',
    'win.deferredSkills': 'Inactive Skill Bodies',
    'alert.sectionAria': 'Compaction threshold alert settings',
    'alert.title': 'Compaction Threshold Alert',
    'alert.descHtml': 'When enabled, once a session first crosses <code>80% ({warnTok})</code> or <code>92% ({critTok})</code>, the next reply includes a brief compaction warning and a quick link to open this monitor.',
    'alert.savedOn': 'Saved: Compaction warning & monitor link will be included on the next reply after crossing 80% / 92%',
    'alert.savedOff': 'Saved: In-chat compaction alert disabled (highlighted inside monitor pane only)',
    'alert.demoSuffix': ' (Demo)',
    'alert.err401': 'Missing valid X-Sidecar-Token auth (401)',
    'alert.errStatus': 'Save failed ({status})',
    'alert.errFeedback': 'Failed to save settings: {msg}',
    'alert.errToast': 'Settings not saved: {msg}',
    'drawers.sectionAria': 'Context configuration and top step spikes',
    'drawers.rulesTitle': 'Rules',
    'drawers.rulesCount': '{count} items',
    'drawers.rulesEmpty': 'No loaded AGENTS.md, GEMINI.md, or rule files detected in workspace or global config.',
    'drawers.ruleFallback': 'Rule file',
    'drawers.mcpTitle': 'MCP Tools',
    'drawers.mcpCount': '{count} servers',
    'drawers.mcpEmpty': 'No eager MCP tool schemas mounted in this session.',
    'drawers.mcpLazyVal': 'Deferred ~{tokens}',
    'drawers.mcpLazyMode': 'Lazy (Deferred)',
    'drawers.mcpEagerMode': 'Eager',
    'drawers.mcpToolCount': '{count} tools',
    'drawers.skillsTitle': 'Skills',
    'drawers.skillsCount': '{count} skills',
    'drawers.skillsEmpty': 'No injected or activated skills detected in this session.',
    'drawers.skillActivated': 'Activated',
    'drawers.skillReadBody': 'Full SKILL.md loaded',
    'drawers.skillSummaryOnly': 'Summary Only',
    'drawers.spikesTitle': 'Top Context Spikes',
    'drawers.spikesCount': '{count} steps',
    'drawers.spikesEmpty': 'No significant single-step context spikes recorded in this cycle.',
    'global.subtitle': 'Cross-Side Ledger · Aggregates Desktop, IDE & CLI across WSL and Windows',
    'global.metricsAria': 'Five core global metrics',
    'global.metricTotalLabel': 'Cumulative Tokens',
    'global.metricTotalSub': 'Exact {exact} incl. cache',
    'global.metricTotalTitle': 'Exact cumulative tokens: {exact} ({en})',
    'global.metricPeakLabel': 'Peak Daily Tokens',
    'global.metricPeakSubDate': 'Peak on {date}',
    'global.metricPeakSubDefault': 'Highest single-day total',
    'global.metricPeakTitle': 'Peak single-day tokens: {exact}{dateSuffix}',
    'global.metricTaskLabel': 'Longest Task Time',
    'global.metricTaskSub': 'Single continuous turn (idle excluded)',
    'global.metricTaskTitle': 'Longest continuous turn: {short} ({exact} ms, user idle gaps excluded)',
    'global.metricLongestStreakLabel': 'Longest Streak',
    'global.metricLongestStreakSub': 'All-time active day streak',
    'global.metricLongestStreakTitle': 'Longest consecutive active days: {days} days',
    'global.metricCurrentStreakLabel': 'Current Streak',
    'global.metricCurrentStreakSub': 'Consecutive local active days',
    'global.metricCurrentStreakTitle': 'Current consecutive active days: {days} days',
    'chart.sectionAria': 'Token activity chart',
    'chart.heading': 'Token Activity',
    'chart.tablistAria': 'Token activity time granularity',
    'chart.tabDaily': 'Daily',
    'chart.tabWeekly': 'Weekly',
    'chart.tabCumulative': 'Cumulative',
    'chart.captionDaily': 'Past 365 days contribution heatmap (click a cell to filter requests)',
    'chart.captionWeekly': 'Weekly token throughput (click a bar to filter requests)',
    'chart.captionCumulative': 'Cumulative token growth over time (click a point to filter by day)',
    'chart.clearFilterBtn': '× Clear date filter',
    'chart.clearChipAria': 'Clear date filter',
    'chart.filterDay': 'Date: {date}',
    'chart.filterWeek': 'Week: {start} ~ {end}',
    'chart.filterBarPrefix': 'Chart filter · {desc}',
    'fallback.title': 'Session Info',
    'fallback.closeAria': 'Close session info',
    'fallback.inspectBtn': 'Inspect Context Here',
    'fallback.copyIdBtn': 'Copy Session ID',
    'fallback.keyId': 'Session ID',
    'fallback.keySurface': 'Client Surface',
    'fallback.keyWorkspace': 'Workspace / Project',
    'fallback.keyModel': 'Model',
    'fallback.toastOpened': '{surface}: Session info opened',
    'table.sectionAria': 'AGY request logs and multi-view summaries',
    'table.subtabsAria': 'Global table views',
    'table.caption': 'AGY global model requests and rankings table',
    'subtab.requests': 'Requests',
    'subtab.timeline': 'Timeline',
    'subtab.projects': 'Projects & Chats',
    'subtab.models': 'Models',
    'time.groupAria': 'Time range filter and sort order',
    'time.all': 'All Time',
    'time.1h': '1h',
    'time.today': 'Today',
    'time.24h': '24h',
    'time.7d': '7d',
    'time.30d': '30d',
    'time.custom': 'Custom',
    'time.sortTitle': 'Toggle newest-first or oldest-first chronological order',
    'time.sortNewest': 'Time: Newest ↓',
    'time.sortOldest': 'Time: Oldest ↑',
    'time.granularityAria': 'Timeline aggregation granularity',
    'time.byDay': 'By Day',
    'time.byHour': 'By Hour',
    'time.rangeLabel': 'Range:',
    'time.startAria': 'Custom start time',
    'time.endAria': 'Custom end time',
    'time.resetBtn': 'Reset',
    'status.groupAria': 'Filter by step status',
    'status.all': 'All',
    'status.normal': 'OK',
    'status.checkpoint': 'Compact',
    'status.error': 'Error',
    'table.loadMore': 'Load More ({remaining} left)',
    'table.scrollTop': '↑ Top',
    'toast.langSwitched': 'Switched to English',
    'toast.syncOk': 'Live auto-sync active (every 2.8s) · Data synced',
    'toast.refreshed': 'Refreshed latest telemetry',
    'toast.fsOpenedCopied': 'Opened fullscreen dashboard in browser (link copied)',
    'toast.fsOpened': 'Opened fullscreen dashboard in browser',
    'toast.fsCopied': 'Copied fullscreen URL — click "Open in New Tab" above or paste in browser',
    'toast.fsBarShown': 'Fullscreen URL bar shown — click "Open in New Tab" to launch',
    'toast.urlCopied': 'Copied fullscreen URL',
    'toast.urlManualCopy': 'Select the URL input to copy manually',
    'toast.drilledSubRole': 'Inspecting subagent @{role} {cap} window & details',
    'toast.drilledSub': 'Inspecting subagent details',
    'toast.backToMain': 'Returned to main conversation view',
    'toast.switchedWorker': 'Switched to {label}',
    'toast.openedInHost': 'Requested host window to open subagent chat',
    'toast.timeFiltered': 'Time filter "{desc}": {count} matching requests',
    'toast.sortAsc': 'Sorted chronologically (Oldest → Newest)',
    'toast.sortDesc': 'Sorted reverse-chronologically (Newest → Oldest)',
    'toast.granHour': 'Switched to hourly aggregation',
    'toast.granDay': 'Switched to daily aggregation',
    'toast.bucketDrilled': 'Drilled into "{label}": {count} request logs',
    'toast.statusFiltered': 'Filter "{label}": {count} matching requests',
    'toast.loadedMore': 'Showing {shown} of {total} records',
    'toast.copiedId': 'Copied session ID: {id}',
    'toast.rawId': 'Session ID: {id}',
    'err.convLoad': 'Failed to load current conversation ({msg}).',
    'err.globalLoad': 'Failed to load global telemetry ({msg}).',
    'err.mockBtn': 'Preview Demo Data',
  },
};

let currentLocale = 'zh';

export function normalizeLocale(raw, fallback = '') {
  const s = String(raw ?? '').trim().toLowerCase();
  if (/^en(?:[-_]|$)/.test(s)) return 'en';
  if (/^zh(?:[-_]|$)/.test(s)) return 'zh';
  return fallback;
}

export function resolveInitialLocale({
  search = '',
  storedLang = '',
  settingsLang = '',
  navigatorLanguage = '',
} = {}) {
  if (search) {
    const params = new URLSearchParams(search);
    const fromQuery = normalizeLocale(params.get('lang'));
    if (fromQuery) return fromQuery;
  }
  const fromStorage = normalizeLocale(storedLang);
  if (fromStorage) return fromStorage;
  const fromSettings = normalizeLocale(settingsLang);
  if (fromSettings) return fromSettings;
  const nav = String(navigatorLanguage ?? '').trim();
  if (nav) {
    return /^zh\b/i.test(nav) ? 'zh' : 'en';
  }
  return 'zh';
}

export function getLocale() {
  return currentLocale;
}

export function setLocale(nextLocale) {
  const norm = normalizeLocale(nextLocale);
  if (norm) {
    currentLocale = norm;
  }
  return currentLocale;
}

export function t(key, vars = null, localeOverride = '') {
  const loc = normalizeLocale(localeOverride) || currentLocale || 'zh';
  const dict = I18N_MESSAGES[loc] || I18N_MESSAGES.zh;
  const template = dict[key] ?? I18N_MESSAGES.zh[key] ?? key;
  if (!vars || typeof template !== 'string') return template;
  return template.replace(/\{(\w+)\}/g, (_, k) => (
    vars[k] !== undefined && vars[k] !== null ? String(vars[k]) : ''
  ));
}

export function formatScopeLabel(rawScope, locale = currentLocale) {
  const s = String(rawScope ?? '').trim();
  if (!s) return '';
  const lower = s.toLowerCase();
  const isEn = normalizeLocale(locale, currentLocale) === 'en';
  if (lower === 'workspace' || s === '工作区' || s === '工作区规则') {
    return isEn ? 'Workspace' : (lower === 'workspace' ? '工作区' : s);
  }
  if (s === '工作区根目录' || lower === 'workspace-root' || lower === 'workspace_root') {
    return isEn ? 'Workspace Root' : '工作区根目录';
  }
  if (lower === 'global' || s === '全局' || s === '全局规则') {
    return isEn ? 'Global' : (lower === 'global' ? '全局' : s);
  }
  if (lower === 'plugin' || s === '插件') {
    return isEn ? 'Plugin' : '插件';
  }
  if (lower === 'builtin' || lower === 'built-in' || s === '内置') {
    return isEn ? 'Built-in' : '内置';
  }
  if (lower === 'session' || s === '当前会话') {
    return isEn ? 'Session' : '当前会话';
  }
  return s;
}

function localizeSessionTitle(
  rawTitle,
  { fallbackZh = '未命名会话', fallbackEn = 'Untitled Session', locale = currentLocale } = {},
) {
  const isEn = normalizeLocale(locale, currentLocale) === 'en';
  const trimmed = String(rawTitle ?? '').trim();
  if (!trimmed) {
    return isEn ? fallbackEn : fallbackZh;
  }
  if (trimmed === '未命名对话') {
    return isEn ? 'Untitled Chat' : trimmed;
  }
  if (trimmed === '未命名会话' || trimmed === '当前活跃会话') {
    return isEn ? 'Untitled Session' : trimmed;
  }
  if (isEn && trimmed === '主会话') {
    return 'Main Chat';
  }
  return trimmed;
}

function localizeWorkspace(rawWs, locale = currentLocale) {
  const isEn = normalizeLocale(locale, currentLocale) === 'en';
  const trimmed = String(rawWs ?? '').trim();
  if (!trimmed || trimmed === '未绑定工作区') {
    return isEn ? 'No Workspace' : '未绑定工作区';
  }
  return trimmed;
}

function localizeProject(rawProj, locale = currentLocale) {
  const isEn = normalizeLocale(locale, currentLocale) === 'en';
  const trimmed = String(rawProj ?? '').trim();
  if (!trimmed || trimmed === '未关联项目') {
    return isEn ? 'Unlinked Project' : '未关联项目';
  }
  return trimmed;
}

function localizeSurface(
  rawSurface,
  { fallbackZh = '未知客户端', fallbackEn = 'Unknown Client', locale = currentLocale } = {},
) {
  const isEn = normalizeLocale(locale, currentLocale) === 'en';
  const trimmed = String(rawSurface ?? '').trim();
  if (!trimmed || trimmed === '未知客户端') {
    return isEn ? fallbackEn : fallbackZh;
  }
  return trimmed;
}

/* ==========================================================================
   1. Pure Formatting & Normalization Helpers
   ========================================================================== */

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[ch]));
}

function trimDecimals(str) {
  return str.replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
}

export function formatExactInt(value) {
  const num = Math.max(0, Math.round(Number(value) || 0));
  return num.toLocaleString('en-US');
}

/**
 * Formats token counts with English k / M / B suffixes (e.g. 1.05M, 36.5k, 256k).
 */
export function formatTokensEn(value) {
  const num = Number(value) || 0;
  const abs = Math.abs(num);
  const sign = num < 0 ? '-' : '';
  if (abs >= 1_000_000_000) {
    return `${sign}${trimDecimals((abs / 1_000_000_000).toFixed(2))}B`;
  }
  if (abs >= 1_000_000) {
    return `${sign}${trimDecimals((abs / 1_000_000).toFixed(2))}M`;
  }
  if (abs >= 1_000) {
    return `${sign}${trimDecimals((abs / 1_000).toFixed(1))}k`;
  }
  return `${sign}${Math.round(abs)}`;
}

/**
 * Formats a context window limit badge with uppercase K / M suffix (e.g. 256K, 512K, 900K, 1M).
 */
export function formatWindowCap(value) {
  return formatTokensEn(value).replace(/k$/, 'K');
}

function buildWindowI18nParams(
  limit = CONTEXT_LIMIT,
  autocompactBuffer = AUTOCOMPACT_BUFFER,
  safeLimit,
) {
  const lim = Number(limit) > 0 ? Math.round(Number(limit)) : CONTEXT_LIMIT;
  const buf = Number.isFinite(Number(autocompactBuffer))
    ? Math.max(0, Math.round(Number(autocompactBuffer)))
    : AUTOCOMPACT_BUFFER;
  const safe = Number(safeLimit) > 0 ? Math.round(Number(safeLimit)) : Math.max(0, lim - buf);
  return {
    cap: formatWindowCap(lim),
    limitExact: formatExactInt(lim),
    safeCap: formatWindowCap(safe),
    bufCap: formatWindowCap(buf),
    warnTok: formatTokensEn(Math.round(lim * 0.8)),
    critTok: formatTokensEn(Math.round(lim * 0.92)),
  };
}

/**
 * Formats token counts with Chinese 万 / 亿 units (e.g. 105 万, 1.28 亿).
 */
export function formatTokensZh(value) {
  const num = Number(value) || 0;
  const abs = Math.abs(num);
  const sign = num < 0 ? '-' : '';
  if (abs >= 100_000_000) {
    return `${sign}${trimDecimals((abs / 100_000_000).toFixed(2))} 亿`;
  }
  if (abs >= 10_000) {
    const decimals = abs >= 1_000_000 ? 1 : 2;
    return `${sign}${trimDecimals((abs / 10_000).toFixed(decimals))} 万`;
  }
  return `${sign}${formatExactInt(abs)}`;
}

/**
 * Normalizes cache hit rate (accepting either 0..1 ratio or 0..100 percent, or
 * deriving directly from inputTokens + cacheReadTokens when provided) to 0..100.
 */
export function normalizeCacheHitPercent(rate, inputTokens, cacheReadTokens) {
  const inp = Number(inputTokens);
  const cache = Number(cacheReadTokens);
  if (Number.isFinite(inp) && Number.isFinite(cache) && (inp + cache) > 0) {
    return Math.min(100, Math.max(0, (cache / (inp + cache)) * 100));
  }
  const num = Number(rate);
  if (!Number.isFinite(num) || num <= 0) return 0;
  if (num <= 1) return num * 100;
  return Math.min(100, num);
}

export function formatPercent(value, digits = 1) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '0.0%';
  return `${num.toFixed(digits)}%`;
}

export function formatSpeed(tokPerSec) {
  const num = Number(tokPerSec);
  if (!Number.isFinite(num) || num <= 0) return '0.0 tok/s';
  return `${num.toFixed(1)} tok/s`;
}

export function formatDurationShort(ms) {
  const val = Math.max(0, Number(ms) || 0);
  if (val === 0) return '0s';
  if (val < 1_000) return `${Math.round(val)}ms`;
  const totalSec = val / 1_000;
  if (totalSec < 60) return `${totalSec.toFixed(1)}s`;
  const mins = Math.floor(totalSec / 60);
  const secs = Math.round(totalSec % 60);
  if (mins < 60) {
    return `${mins}m ${String(secs).padStart(2, '0')}s`;
  }
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hours}h ${String(remMins).padStart(2, '0')}m`;
}

export function formatDurationZh(ms) {
  const val = Math.max(0, Number(ms) || 0);
  const totalSec = Math.round(val / 1_000);
  if (totalSec <= 0) return '0秒';
  if (totalSec < 60) return `${totalSec}秒`;
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  if (mins < 60) {
    return secs === 0 ? `${mins} 分钟` : `${mins}分 ${String(secs).padStart(2, '0')}秒`;
  }
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins === 0 ? `${hours} 小时` : `${hours}小时 ${remMins}分`;
}

export function formatLocalTime(timestampOrIso) {
  const ms = typeof timestampOrIso === 'number'
    ? timestampOrIso
    : Date.parse(String(timestampOrIso || ''));
  if (!Number.isFinite(ms)) return '—';
  const d = new Date(ms);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${mm}-${dd} ${hh}:${mi}:${ss}`;
}

export function toLocalDateKey(dateObj) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Sanitizes model display labels so UI placeholders and stale payloads never render generic auto/default labels.
 */
export function formatModelDisplay(rawModel, fallback = '—') {
  const trimmed = String(rawModel ?? '').trim();
  if (!trimmed || /^(?:auto|default|none|inherit)$/i.test(trimmed)) {
    return fallback;
  }
  return trimmed;
}

export function formatSubagentRole(role) {
  const clean = String(role ?? '').trim().replace(/^@+/, '');
  return clean || 'subagent';
}

export function formatSubagentTitle(rawTitle, role, conversationId = '', locale = currentLocale) {
  const isEn = normalizeLocale(locale, currentLocale) === 'en';
  const title = String(rawTitle ?? '').trim();
  const cleanRole = formatSubagentRole(role);
  if (title && !/^(?:未命名会话|未命名对话)$/.test(title)) {
    const escapedRole = cleanRole.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const stripped = title.replace(new RegExp(`^@?${escapedRole}\\s*[·:\\-—|]\\s*`, 'i'), '').trim();
    if (stripped) return stripped;
    return title;
  }
  if (isEn) {
    return conversationId ? `Subagent ${String(conversationId).slice(0, 8)}` : 'Subagent';
  }
  return conversationId ? `子会话 ${String(conversationId).slice(0, 8)}` : '子会话';
}

/* ==========================================================================
   2. Routing, Sidecar Token, Theme & Cross-Side Navigation Helpers
   ========================================================================== */

export function resolveInitialRoute({
  search = '',
  sidecarConversationId = '',
  metaConversationId = '',
} = {}) {
  const params = new URLSearchParams(search);
  const conversationId = String(
    sidecarConversationId || params.get('conversationId') || metaConversationId || '',
  ).trim();
  const explicitTab = params.get('tab');
  let tab = 'global';
  if (explicitTab === 'conversation' || explicitTab === 'global') {
    tab = explicitTab;
  } else if (conversationId) {
    tab = 'conversation';
  }
  const fullscreen = params.get('fullscreen') === '1' || params.get('fullscreen') === 'true';
  const mock = params.get('mock') === '1' || params.get('mock') === 'true';
  const rawTheme = params.get('theme');
  const themeOverride = rawTheme === 'dark' || rawTheme === 'light' ? rawTheme : '';
  return {
    tab,
    conversationId,
    fullscreen,
    mock,
    themeOverride,
  };
}

export function buildFullscreenUrl(search = '', token = '', locale = '') {
  const params = new URLSearchParams(search);
  const out = new URLSearchParams();
  out.set('tab', 'global');
  out.set('fullscreen', '1');
  if (params.get('mock') === '1' || params.get('mock') === 'true') {
    out.set('mock', '1');
  }
  const resolvedToken = String(token || params.get('token') || '').trim();
  if (resolvedToken) {
    out.set('token', resolvedToken);
  }
  const resolvedLang = normalizeLocale(locale) || normalizeLocale(params.get('lang'));
  if (resolvedLang) {
    out.set('lang', resolvedLang);
  }
  return `/?${out.toString()}`;
}

export function resolveSidecarToken({ sidecar = null, search = '', metaToken = '', globalToken = '' } = {}) {
  if (sidecar && typeof sidecar.token === 'string' && sidecar.token.trim()) {
    return sidecar.token.trim();
  }
  if (typeof globalToken === 'string' && globalToken.trim()) {
    return globalToken.trim();
  }
  if (typeof metaToken === 'string' && metaToken.trim()) {
    return metaToken.trim();
  }
  const params = new URLSearchParams(search);
  const queryToken = params.get('token');
  return queryToken ? queryToken.trim() : '';
}

export function decideConversationAction(item, { sidecar = null, locale = currentLocale } = {}) {
  const isEn = normalizeLocale(locale, currentLocale) === 'en';
  const convId = String(item?.conversationId || '').trim();
  const title = localizeSessionTitle(item?.conversationTitle || item?.title || convId, { locale });
  const surface = localizeSurface(item?.surface, { locale });
  const canHostToggle = Boolean(sidecar?.ui && typeof sidecar.ui.toggleConversation === 'function');

  if (convId && item?.isLocalSide === true && canHostToggle) {
    return {
      mode: 'host-switch',
      conversationId: convId,
      title,
      surface,
      reason: isEn
        ? `Requested host to switch to session "${title}"`
        : `已请求宿主切换至会话「${title}」`,
    };
  }

  if (item?.isLocalSide === false) {
    return {
      mode: 'fallback-cross-side',
      conversationId: convId,
      title,
      surface,
      reason: isEn
        ? `Cross-side session: This session belongs to ${surface}, which runs on a different host side than this pane. Open it in ${surface}, or inspect its context breakdown right here below.`
        : `跨端会话提示：该会话属于 ${surface}，与当前面板所在运行端不同，宿主无法直接跨端切换窗口。请在 ${surface} 客户端打开，或点击下方按钮在本面板查看其上下文明细。`,
    };
  }

  return {
    mode: 'fallback-standalone',
    conversationId: convId,
    title,
    surface,
    reason: isEn
      ? `Standalone view: Not connected to an AGY sidecar host bridge (session client: ${surface}). Full session metadata is shown below.`
      : `独立视图提示：当前未连接 AGY 侧边栏宿主桥接（会话所属端：${surface}），已为您展开该会话的完整元数据。`,
  };
}

/* ==========================================================================
   3. Context Window & Drawer Normalization Logic (Task 5.2)
   ========================================================================== */

export function computeContextBarModel(contextWindow = {}, { locale = currentLocale } = {}) {
  const isEn = normalizeLocale(locale, currentLocale) === 'en';
  const limit = Number(contextWindow?.limit) > 0 ? Number(contextWindow.limit) : CONTEXT_LIMIT;
  const autocompactBuffer = Number.isFinite(Number(contextWindow?.autocompactBuffer))
    ? Number(contextWindow.autocompactBuffer)
    : AUTOCOMPACT_BUFFER;
  const safeLimit = Number(contextWindow?.safeLimit) > 0
    ? Number(contextWindow.safeLimit)
    : Math.max(0, limit - autocompactBuffer);

  const usedTokens = Math.max(0, Math.round(Number(contextWindow?.usedTokens) || 0));
  const usedPercent = Number.isFinite(Number(contextWindow?.usedPercent))
    ? Number(contextWindow.usedPercent)
    : Number(((usedTokens / limit) * 100).toFixed(1));
  const freeTokens = Number.isFinite(Number(contextWindow?.freeTokens))
    ? Math.max(0, Math.round(Number(contextWindow.freeTokens)))
    : Math.max(0, safeLimit - usedTokens);

  const barDenom = Math.max(limit, usedTokens);
  const rawCats = Array.isArray(contextWindow?.categories) ? contextWindow.categories : [];
  const byId = new Map(rawCats.map((c) => [c.id, c]));

  const categories = CATEGORY_DEFINITIONS.map((def) => {
    const found = byId.get(def.id);
    const tokens = Math.max(0, Math.round(Number(found?.tokens) || 0));
    const percent = Number.isFinite(Number(found?.percent))
      ? Number(found.percent)
      : Number(((tokens / limit) * 100).toFixed(1));
    const widthPct = barDenom > 0 ? (tokens / barDenom) * 100 : 0;
    const label = isEn
      ? (CATEGORY_LABELS_EN[def.id] || def.labelEn || def.id)
      : (found?.label || def.label);
    return {
      id: def.id,
      label,
      tokens,
      percent,
      widthPct,
    };
  });

  const bufferTokensVisible = Math.max(0, Math.min(autocompactBuffer, limit - usedTokens));
  const freeWidthPct = barDenom > 0 ? (freeTokens / barDenom) * 100 : 0;
  const bufferWidthPct = barDenom > 0 ? (bufferTokensVisible / barDenom) * 100 : 0;

  const rawAlert = String(contextWindow?.alertLevel || '').toLowerCase();
  const critThreshold = Math.round(limit * 0.92);
  const warnThreshold = Math.round(limit * 0.8);
  let alertState = 'ok';
  if (
    usedTokens >= critThreshold ||
    rawAlert === 'critical' ||
    rawAlert === 'danger' ||
    rawAlert === 'high' ||
    rawAlert.includes('92')
  ) {
    alertState = 'critical';
  } else if (
    usedTokens >= warnThreshold ||
    rawAlert === 'warn' ||
    rawAlert === 'warning' ||
    rawAlert.includes('80')
  ) {
    alertState = 'warn';
  }

  return {
    limit,
    autocompactBuffer,
    safeLimit,
    usedTokens,
    usedPercent,
    freeTokens,
    bufferTokensVisible,
    freeWidthPct,
    bufferWidthPct,
    alertState,
    categories,
  };
}

export function normalizeDeferredGroup(raw) {
  if (typeof raw === 'number') {
    return { tokens: Math.max(0, Math.round(raw)), count: null, items: [] };
  }
  if (Array.isArray(raw)) {
    const tokens = raw.reduce(
      (sum, item) => sum + Math.max(0, Math.round(Number(item?.tokens ?? item?.estimatedTokens) || 0)),
      0,
    );
    return { tokens, count: raw.length, items: raw };
  }
  if (raw && typeof raw === 'object') {
    const items = Array.isArray(raw.items) ? raw.items : [];
    const tokens = Math.max(
      0,
      Math.round(
        Number(raw.tokens ?? raw.estimatedTokens ?? raw.totalEstimatedTokens) ||
        items.reduce((s, it) => s + (Number(it?.tokens ?? it?.estimatedTokens) || 0), 0),
      ),
    );
    const count = Number.isFinite(Number(raw.count)) ? Number(raw.count) : (items.length || null);
    return { tokens, count, items };
  }
  return { tokens: 0, count: 0, items: [] };
}

function unwrapDrawerArray(raw) {
  if (Array.isArray(raw)) return raw;
  if (raw && Array.isArray(raw.items)) return raw.items;
  return [];
}

/* ==========================================================================
   4. Global Filtering, Date Drilldown & Dynamic Aggregation (Task 5.3)
   ========================================================================== */

export function normalizeRequestStatus(status) {
  const s = String(status || '').trim().toLowerCase();
  if (s === 'checkpoint' || s === 'compacted') return 'checkpoint';
  if (s === 'error' || s === 'failed') return 'error';
  return 'normal';
}

export function matchesDateFilter(dateStr, activeDateFilter) {
  if (!activeDateFilter) return true;
  const d = String(dateStr || '').slice(0, 10);
  if (!d) return false;
  if (activeDateFilter.type === 'day') {
    return d === activeDateFilter.date;
  }
  if (activeDateFilter.type === 'week') {
    return d >= activeDateFilter.weekStart && d <= activeDateFilter.weekEnd;
  }
  return true;
}

export function resolveRequestTimestampMs(req) {
  if (typeof req?.timestamp === 'number' && Number.isFinite(req.timestamp)) {
    return req.timestamp;
  }
  if (req?.timestamp !== undefined && req?.timestamp !== null && req?.timestamp !== '') {
    const num = Number(req.timestamp);
    if (Number.isFinite(num)) return num;
  }
  if (req?.isoTime) {
    const parsed = Date.parse(String(req.isoTime));
    if (Number.isFinite(parsed)) return parsed;
  }
  if (req?.date) {
    const dStr = String(req.date).slice(0, 10);
    const parsed = Date.parse(`${dStr}T00:00:00`);
    if (Number.isFinite(parsed)) return parsed;
  }
  return NaN;
}

export function toDatetimeLocalInputValue(ms) {
  if (!Number.isFinite(ms)) return '';
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day}T${hh}:${mm}`;
}

export function matchesTimeRangeFilter(req, timeRangeFilter, nowMs = Date.now()) {
  if (!timeRangeFilter) return true;
  const preset = typeof timeRangeFilter === 'string'
    ? timeRangeFilter
    : String(timeRangeFilter.preset || 'all');
  if (!preset || preset === 'all') return true;

  const ts = resolveRequestTimestampMs(req);
  if (!Number.isFinite(ts)) return false;

  const refNow = Number.isFinite(Number(nowMs)) ? Number(nowMs) : Date.now();

  if (preset === '1h') {
    return ts >= refNow - 3_600_000 && ts <= refNow + 60_000;
  }
  if (preset === 'today') {
    const nowDate = new Date(refNow);
    const startOfDay = new Date(
      nowDate.getFullYear(),
      nowDate.getMonth(),
      nowDate.getDate(),
      0,
      0,
      0,
      0,
    ).getTime();
    const endOfDay = new Date(
      nowDate.getFullYear(),
      nowDate.getMonth(),
      nowDate.getDate(),
      23,
      59,
      59,
      999,
    ).getTime();
    return ts >= startOfDay && ts <= endOfDay;
  }
  if (preset === '24h') {
    return ts >= refNow - 86_400_000 && ts <= refNow + 60_000;
  }
  if (preset === '7d') {
    return ts >= refNow - 7 * 86_400_000 && ts <= refNow + 60_000;
  }
  if (preset === '30d') {
    return ts >= refNow - 30 * 86_400_000 && ts <= refNow + 60_000;
  }
  if (preset === 'custom') {
    let startMs = (
      timeRangeFilter?.startMs !== undefined &&
      timeRangeFilter?.startMs !== null &&
      timeRangeFilter?.startMs !== '' &&
      Number.isFinite(Number(timeRangeFilter.startMs))
    )
      ? Number(timeRangeFilter.startMs)
      : (timeRangeFilter?.start ? Date.parse(String(timeRangeFilter.start)) : NaN);

    let endMs = NaN;
    if (
      timeRangeFilter?.endMs !== undefined &&
      timeRangeFilter?.endMs !== null &&
      timeRangeFilter?.endMs !== '' &&
      Number.isFinite(Number(timeRangeFilter.endMs))
    ) {
      endMs = Number(timeRangeFilter.endMs);
    } else if (timeRangeFilter?.end) {
      const rawEnd = String(timeRangeFilter.end).trim();
      const parsedEnd = Date.parse(rawEnd);
      if (Number.isFinite(parsedEnd)) {
        endMs = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(rawEnd) ? parsedEnd + 59_999 : parsedEnd;
      }
    }

    if (!Number.isFinite(startMs) && !Number.isFinite(endMs)) return true;
    if (Number.isFinite(startMs) && Number.isFinite(endMs) && startMs > endMs) {
      [startMs, endMs] = [endMs, startMs];
    }
    if (Number.isFinite(startMs) && ts < startMs) return false;
    if (Number.isFinite(endMs) && ts > endMs) return false;
    return true;
  }
  return true;
}

export function filterRequests(
  requests = [],
  {
    activeDateFilter = null,
    statusFilter = 'all',
    timeRangeFilter = null,
    sortOrder = null,
    nowMs = Date.now(),
  } = {},
) {
  const list = Array.isArray(requests) ? requests : [];
  const filtered = list.filter((req) => {
    if (!matchesDateFilter(req?.date || req?.isoTime, activeDateFilter)) {
      return false;
    }
    if (!matchesTimeRangeFilter(req, timeRangeFilter, nowMs)) {
      return false;
    }
    if (statusFilter && statusFilter !== 'all') {
      return normalizeRequestStatus(req?.status) === statusFilter;
    }
    return true;
  });

  if (sortOrder === 'asc' || sortOrder === 'desc') {
    const dir = sortOrder === 'asc' ? 1 : -1;
    return filtered.slice().sort((a, b) => {
      const tsA = resolveRequestTimestampMs(a);
      const tsB = resolveRequestTimestampMs(b);
      const numA = Number.isFinite(tsA) ? tsA : 0;
      const numB = Number.isFinite(tsB) ? tsB : 0;
      if (numA !== numB) return (numA - numB) * dir;
      const stepDiff = (Number(a?.stepIndex) || 0) - (Number(b?.stepIndex) || 0);
      return stepDiff * dir;
    });
  }

  return filtered;
}

export function computeRequestStatusCounts(
  requests = [],
  { activeDateFilter = null, timeRangeFilter = null, nowMs = Date.now() } = {},
) {
  const counts = { all: 0, normal: 0, checkpoint: 0, error: 0 };
  const list = Array.isArray(requests) ? requests : [];
  for (const req of list) {
    if (!matchesDateFilter(req?.date || req?.isoTime, activeDateFilter)) continue;
    if (!matchesTimeRangeFilter(req, timeRangeFilter, nowMs)) continue;
    counts.all += 1;
    const norm = normalizeRequestStatus(req?.status);
    counts[norm] = (counts[norm] || 0) + 1;
  }
  return counts;
}

export function deriveTimeBuckets(
  requests = [],
  granularity = 'day',
  { sortOrder = 'desc' } = {},
) {
  const mode = granularity === 'hour' ? 'hour' : 'day';
  const byBucket = new Map();
  const list = Array.isArray(requests) ? requests : [];

  for (const r of list) {
    const ts = resolveRequestTimestampMs(r);
    if (!Number.isFinite(ts)) continue;
    const d = new Date(ts);
    const y = d.getFullYear();
    const m = d.getMonth();
    const day = d.getDate();
    const h = d.getHours();
    const dateKey = toLocalDateKey(d);

    let key;
    let label;
    let startMs;
    let endMs;
    if (mode === 'hour') {
      const hh = String(h).padStart(2, '0');
      key = `${dateKey} ${hh}:00`;
      label = `${dateKey} ${hh}:00–${hh}:59`;
      startMs = new Date(y, m, day, h, 0, 0, 0).getTime();
      endMs = new Date(y, m, day, h, 59, 59, 999).getTime();
    } else {
      key = dateKey;
      label = dateKey;
      startMs = new Date(y, m, day, 0, 0, 0, 0).getTime();
      endMs = new Date(y, m, day, 23, 59, 59, 999).getTime();
    }

    let acc = byBucket.get(key);
    if (!acc) {
      acc = {
        key,
        label,
        granularity: mode,
        startMs,
        endMs,
        requestCount: 0,
        totalTokens: 0,
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        rateSum: 0,
        speedSum: 0,
        speedCount: 0,
      };
      byBucket.set(key, acc);
    }

    acc.requestCount += 1;
    acc.totalTokens += Number(r.totalTokens) || 0;
    acc.inputTokens += Number(r.inputTokens) || 0;
    acc.outputTokens += Number(r.outputTokens) || 0;
    acc.cacheReadTokens += Number(r.cacheReadTokens) || 0;
    acc.rateSum += normalizeCacheHitPercent(r.cacheHitRate, r.inputTokens, r.cacheReadTokens);
    if (Number(r.tokensPerSec) > 0) {
      acc.speedSum += Number(r.tokensPerSec);
      acc.speedCount += 1;
    }
  }

  const dir = sortOrder === 'asc' ? 1 : -1;
  return Array.from(byBucket.values())
    .map((acc) => ({
      key: acc.key,
      label: acc.label,
      granularity: acc.granularity,
      startMs: acc.startMs,
      endMs: acc.endMs,
      requestCount: acc.requestCount,
      totalTokens: acc.totalTokens,
      inputTokens: acc.inputTokens,
      outputTokens: acc.outputTokens,
      cacheReadTokens: acc.cacheReadTokens,
      avgCacheHitRate: (acc.inputTokens + acc.cacheReadTokens) > 0
        ? (acc.cacheReadTokens / (acc.inputTokens + acc.cacheReadTokens))
        : (acc.requestCount > 0 ? (acc.rateSum / acc.requestCount) / 100 : 0),
      avgTokensPerSec: acc.speedCount > 0 ? acc.speedSum / acc.speedCount : 0,
    }))
    .sort((a, b) => (a.startMs - b.startMs) * dir);
}

export function deriveProjectRankings(requests = [], { locale = currentLocale } = {}) {
  const byConv = new Map();
  for (const r of requests) {
    const key = r.conversationId || `${r.surface || 'unknown'}:${r.project || ''}:${r.conversationTitle || ''}`;
    let acc = byConv.get(key);
    if (!acc) {
      acc = {
        conversationId: r.conversationId || '',
        project: localizeProject(r.project || r.workspace, locale),
        title: localizeSessionTitle(r.conversationTitle || r.title || r.conversationId, { locale }),
        surface: r.surface || 'Desktop',
        isLocalSide: Boolean(r.isLocalSide),
        requestCount: 0,
        totalTokens: 0,
        outputTokens: 0,
        inputSum: 0,
        cacheSum: 0,
        rateSum: 0,
        speedSum: 0,
        speedCount: 0,
        lastActiveAt: r.isoTime || r.timestamp || '',
        lastMs: 0,
      };
      byConv.set(key, acc);
    }
    acc.requestCount += 1;
    acc.totalTokens += Number(r.totalTokens) || 0;
    acc.outputTokens += Number(r.outputTokens) || 0;
    acc.inputSum += Number(r.inputTokens) || 0;
    acc.cacheSum += Number(r.cacheReadTokens) || 0;
    acc.rateSum += normalizeCacheHitPercent(r.cacheHitRate, r.inputTokens, r.cacheReadTokens);
    if (Number(r.tokensPerSec) > 0) {
      acc.speedSum += Number(r.tokensPerSec);
      acc.speedCount += 1;
    }
    const ts = typeof r.timestamp === 'number' ? r.timestamp : Date.parse(String(r.isoTime || ''));
    if (Number.isFinite(ts) && ts >= acc.lastMs) {
      acc.lastMs = ts;
      acc.lastActiveAt = r.isoTime || new Date(ts).toISOString();
    }
  }
  return Array.from(byConv.values())
    .map((acc) => ({
      conversationId: acc.conversationId,
      project: acc.project,
      title: acc.title,
      surface: acc.surface,
      isLocalSide: acc.isLocalSide,
      requestCount: acc.requestCount,
      totalTokens: acc.totalTokens,
      outputTokens: acc.outputTokens,
      avgCacheHitRate: (acc.inputSum + acc.cacheSum) > 0
        ? (acc.cacheSum / (acc.inputSum + acc.cacheSum))
        : (acc.requestCount > 0 ? (acc.rateSum / acc.requestCount) / 100 : 0),
      avgTokensPerSec: acc.speedCount > 0 ? acc.speedSum / acc.speedCount : 0,
      lastActiveAt: acc.lastActiveAt,
    }))
    .sort((a, b) => b.totalTokens - a.totalTokens);
}

export function deriveModelSummary(requests = []) {
  const byModel = new Map();
  for (const r of requests) {
    const model = formatModelDisplay(r.model);
    let acc = byModel.get(model);
    if (!acc) {
      acc = {
        model,
        requestCount: 0,
        totalTokens: 0,
        outputTokens: 0,
        inputSum: 0,
        cacheSum: 0,
        rateSum: 0,
        speedSum: 0,
        speedCount: 0,
      };
      byModel.set(model, acc);
    }
    acc.requestCount += 1;
    acc.totalTokens += Number(r.totalTokens) || 0;
    acc.outputTokens += Number(r.outputTokens) || 0;
    acc.inputSum += Number(r.inputTokens) || 0;
    acc.cacheSum += Number(r.cacheReadTokens) || 0;
    acc.rateSum += normalizeCacheHitPercent(r.cacheHitRate, r.inputTokens, r.cacheReadTokens);
    if (Number(r.tokensPerSec) > 0) {
      acc.speedSum += Number(r.tokensPerSec);
      acc.speedCount += 1;
    }
  }
  return Array.from(byModel.values())
    .map((acc) => ({
      model: acc.model,
      requestCount: acc.requestCount,
      totalTokens: acc.totalTokens,
      outputTokens: acc.outputTokens,
      avgCacheHitRate: (acc.inputSum + acc.cacheSum) > 0
        ? (acc.cacheSum / (acc.inputSum + acc.cacheSum))
        : (acc.requestCount > 0 ? (acc.rateSum / acc.requestCount) / 100 : 0),
      avgTokensPerSec: acc.speedCount > 0 ? acc.speedSum / acc.speedCount : 0,
    }))
    .sort((a, b) => b.totalTokens - a.totalTokens);
}

/* ==========================================================================
   5. Native Zero-Dependency SVG Chart Generators (Task 5.3)
   ========================================================================== */

export function normalizeDaily365(dailyEntries = [], referenceDateStr = '') {
  const byDate = new Map();
  let latestStr = referenceDateStr;
  for (const item of Array.isArray(dailyEntries) ? dailyEntries : []) {
    const d = String(item?.date || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) continue;
    byDate.set(d, {
      date: d,
      tokens: Math.max(0, Number(item.tokens) || 0),
      requests: Math.max(0, Number(item.requests) || 0),
    });
    if (!latestStr || d > latestStr) latestStr = d;
  }

  const end = latestStr && /^\d{4}-\d{2}-\d{2}$/.test(latestStr)
    ? new Date(`${latestStr}T12:00:00`)
    : new Date();
  end.setHours(12, 0, 0, 0);

  const days = [];
  for (let i = 364; i >= 0; i--) {
    const cur = new Date(end.getTime() - i * 86_400_000);
    const key = toLocalDateKey(cur);
    const hit = byDate.get(key);
    days.push(hit || { date: key, tokens: 0, requests: 0 });
  }
  return days;
}

export function computeHeatLevel(tokens, maxTokens) {
  const val = Number(tokens) || 0;
  const max = Number(maxTokens) || 0;
  if (val <= 0 || max <= 0) return 0;
  const ratio = val / max;
  if (ratio <= 0.12) return 1;
  if (ratio <= 0.35) return 2;
  if (ratio <= 0.68) return 3;
  return 4;
}

/**
 * Generates a 365-day GitHub/AGY-style blue-scale contribution heatmap SVG.
 */
export function renderDailyHeatmapSvg(
  dailyEntries = [],
  { activeDateFilter = null, referenceDateStr = '', locale = currentLocale } = {},
) {
  const isEn = normalizeLocale(locale, currentLocale) === 'en';
  const days = normalizeDaily365(dailyEntries, referenceDateStr);
  const maxTokens = days.reduce((m, d) => Math.max(m, d.tokens), 0);

  // Monday-first weekday index: Mon=0 .. Sun=6
  const weekdayMon0 = (dateStr) => {
    const dt = new Date(`${dateStr}T12:00:00`);
    return (dt.getDay() + 6) % 7;
  };

  const firstOffset = weekdayMon0(days[0].date);
  const totalSlots = firstOffset + days.length;
  const numWeeks = Math.ceil(totalSlots / 7);

  const cell = 11;
  const gap = 3;
  const step = cell + gap;
  const padLeft = isEn ? 32 : 28;
  const padTop = 20;
  const width = padLeft + numWeeks * step + 10;
  const height = padTop + 7 * step + 24;

  const monthLabels = [];
  let lastMonth = -1;
  let lastLabelX = -999;

  const rects = [];
  for (let idx = 0; idx < days.length; idx++) {
    const slot = firstOffset + idx;
    const col = Math.floor(slot / 7);
    const row = slot % 7;
    const x = padLeft + col * step;
    const y = padTop + row * step;
    const d = days[idx];

    const monthNum = Number(d.date.slice(5, 7));
    if (monthNum !== lastMonth && row <= 2 && x - lastLabelX >= 26) {
      const mText = isEn ? (MONTH_NAMES_EN[monthNum - 1] || String(monthNum)) : `${monthNum}月`;
      monthLabels.push(`<text x="${x}" y="13" class="svg-axis-label">${mText}</text>`);
      lastMonth = monthNum;
      lastLabelX = x;
    } else if (monthNum !== lastMonth && lastMonth === -1) {
      lastMonth = monthNum;
    }

    const level = computeHeatLevel(d.tokens, maxTokens);
    const selected = activeDateFilter?.type === 'day' && activeDateFilter.date === d.date;
    const tip = isEn
      ? `${d.date} · ${formatTokensEn(d.tokens)} (${formatExactInt(d.tokens)} tokens) · ${d.requests} ${d.requests === 1 ? 'request' : 'requests'}`
      : `${d.date} · ${formatTokensZh(d.tokens)} (${formatTokensEn(d.tokens)}) · ${d.requests} 次请求`;

    rects.push(
      `<rect class="heat-cell" x="${x}" y="${y}" width="${cell}" height="${cell}" rx="2.2"` +
      ` fill="var(--heat-${level})" data-chart-kind="day" data-date="${escapeHtml(d.date)}"` +
      ` data-tokens="${d.tokens}" data-requests="${d.requests}" data-level="${level}"` +
      ` data-selected="${selected ? 'true' : 'false'}" data-tooltip="${escapeHtml(tip)}"` +
      ` tabindex="0" role="button" aria-label="${escapeHtml(tip)}"><title>${escapeHtml(tip)}</title></rect>`,
    );
  }

  const weekdayMarks = (
    isEn
      ? [
          { row: 0, text: 'Mon' },
          { row: 2, text: 'Wed' },
          { row: 4, text: 'Fri' },
          { row: 6, text: 'Sun' },
        ]
      : [
          { row: 0, text: '一' },
          { row: 2, text: '三' },
          { row: 4, text: '五' },
          { row: 6, text: '日' },
        ]
  ).map(({ row, text }) => (
    `<text x="2" y="${padTop + row * step + 9}" class="svg-axis-label">${text}</text>`
  ));

  const legendY = padTop + 7 * step + 14;
  const legendStartX = width - (isEn ? 136 : 118);
  const swatchOffset = isEn ? 28 : 18;
  const legendMoreOffset = isEn ? 96 : 86;
  const legendSwatches = [0, 1, 2, 3, 4].map((lvl, i) => (
    `<rect x="${legendStartX + swatchOffset + i * 13}" y="${legendY - 9}" width="10" height="10" rx="2" fill="var(--heat-${lvl})"/>`
  )).join('');
  const svgAria = isEn
    ? '365-day daily Token activity heatmap'
    : '过去 365 天每日 Token 活动热力图';

  return (
    `<svg class="activity-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${svgAria}">` +
    monthLabels.join('') +
    weekdayMarks.join('') +
    rects.join('') +
    `<text x="${legendStartX}" y="${legendY}" class="svg-axis-label">${isEn ? 'Less' : '少'}</text>` +
    legendSwatches +
    `<text x="${legendStartX + legendMoreOffset}" y="${legendY}" class="svg-axis-label">${isEn ? 'More' : '多'}</text>` +
    `</svg>`
  );
}

/**
 * Generates a weekly Token trend bar chart SVG.
 */
export function renderWeeklyBarSvg(
  weeklyEntries = [],
  { activeDateFilter = null, locale = currentLocale } = {},
) {
  const isEn = normalizeLocale(locale, currentLocale) === 'en';
  const weeks = Array.isArray(weeklyEntries) && weeklyEntries.length > 0
    ? weeklyEntries
    : [{ weekStart: '—', weekEnd: '—', label: isEn ? 'No data' : '暂无数据', tokens: 0, requests: 0 }];

  const width = 760;
  const height = 192;
  const padLeft = 56;
  const padRight = 14;
  const padTop = 14;
  const padBottom = 30;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const maxTokens = Math.max(1, ...weeks.map((w) => Number(w.tokens) || 0));

  const gridLines = [0, 0.5, 1].map((ratio) => {
    const y = padTop + plotH * (1 - ratio);
    const val = maxTokens * ratio;
    const label = ratio === 0 ? '0' : formatTokensEn(val);
    return (
      `<line x1="${padLeft}" y1="${y.toFixed(1)}" x2="${width - padRight}" y2="${y.toFixed(1)}" class="svg-grid-line"/>` +
      `<text x="${padLeft - 6}" y="${(y + 3.5).toFixed(1)}" text-anchor="end" class="svg-axis-label">${escapeHtml(label)}</text>`
    );
  });

  const slotW = plotW / weeks.length;
  const barW = Math.max(4, Math.min(24, slotW * 0.68));
  const labelStride = Math.max(1, Math.ceil(weeks.length / 8));

  const bars = [];
  const xLabels = [];

  weeks.forEach((w, i) => {
    const tokens = Math.max(0, Number(w.tokens) || 0);
    const requests = Math.max(0, Number(w.requests) || 0);
    const barH = tokens > 0 ? Math.max(3, (tokens / maxTokens) * plotH) : 1.5;
    const x = padLeft + i * slotW + (slotW - barW) / 2;
    const y = padTop + plotH - barH;
    const weekStart = String(w.weekStart || w.date || '');
    const weekEnd = String(w.weekEnd || w.weekStart || '');
    const rawLabel = String(w.label || (weekStart ? weekStart.slice(5) : `W${i + 1}`));
    const label = isEn && rawLabel === '暂无数据' ? 'No data' : rawLabel;
    const selected = activeDateFilter?.type === 'week' &&
      activeDateFilter.weekStart === weekStart &&
      activeDateFilter.weekEnd === weekEnd;
    const tip = isEn
      ? `${weekStart} ~ ${weekEnd} · ${formatTokensEn(tokens)} (${formatExactInt(tokens)} tokens) · ${requests} ${requests === 1 ? 'request' : 'requests'}`
      : `${weekStart} ~ ${weekEnd} · ${formatTokensZh(tokens)} (${formatTokensEn(tokens)}) · ${requests} 次请求`;

    bars.push(
      `<rect class="week-bar" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${barH.toFixed(1)}" rx="2.5"` +
      ` fill="${tokens > 0 ? 'var(--am-primary)' : 'var(--heat-0)'}"` +
      ` fill-opacity="${selected ? '1' : '0.86'}"` +
      ` data-chart-kind="week" data-week-start="${escapeHtml(weekStart)}" data-week-end="${escapeHtml(weekEnd)}"` +
      ` data-label="${escapeHtml(label)}" data-tokens="${tokens}" data-requests="${requests}"` +
      ` data-selected="${selected ? 'true' : 'false'}" data-tooltip="${escapeHtml(tip)}"` +
      ` tabindex="0" role="button" aria-label="${escapeHtml(tip)}"><title>${escapeHtml(tip)}</title></rect>`,
    );

    if (i % labelStride === 0 || i === weeks.length - 1) {
      xLabels.push(
        `<text x="${(x + barW / 2).toFixed(1)}" y="${height - 9}" text-anchor="middle" class="svg-axis-label">${escapeHtml(label)}</text>`,
      );
    }
  });

  const svgAria = isEn
    ? 'Weekly Token consumption bar chart'
    : '每周 Token 消耗趋势柱状图';

  return (
    `<svg class="activity-svg svg-responsive-fit" viewBox="0 0 ${width} ${height}" role="img" aria-label="${svgAria}">` +
    gridLines.join('') +
    bars.join('') +
    xLabels.join('') +
    `</svg>`
  );
}

/**
 * Generates a cumulative Token growth area + line SVG chart.
 */
export function renderCumulativeAreaSvg(
  cumulativeEntries = [],
  { activeDateFilter = null, locale = currentLocale } = {},
) {
  const isEn = normalizeLocale(locale, currentLocale) === 'en';
  const pts = Array.isArray(cumulativeEntries) && cumulativeEntries.length > 0
    ? cumulativeEntries
    : [{ date: toLocalDateKey(new Date()), tokens: 0, dailyTokens: 0 }];

  const width = 760;
  const height = 192;
  const padLeft = 58;
  const padRight = 16;
  const padTop = 14;
  const padBottom = 30;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const maxTokens = Math.max(1, ...pts.map((p) => Number(p.tokens) || 0));

  const gridLines = [0, 0.5, 1].map((ratio) => {
    const y = padTop + plotH * (1 - ratio);
    const val = maxTokens * ratio;
    const label = ratio === 0 ? '0' : formatTokensEn(val);
    return (
      `<line x1="${padLeft}" y1="${y.toFixed(1)}" x2="${width - padRight}" y2="${y.toFixed(1)}" class="svg-grid-line"/>` +
      `<text x="${padLeft - 6}" y="${(y + 3.5).toFixed(1)}" text-anchor="end" class="svg-axis-label">${escapeHtml(label)}</text>`
    );
  });

  const coords = pts.map((p, i) => {
    const x = pts.length === 1
      ? padLeft + plotW / 2
      : padLeft + (i / (pts.length - 1)) * plotW;
    const tokens = Math.max(0, Number(p.tokens) || 0);
    const dailyTokens = Math.max(0, Number(p.dailyTokens) || 0);
    const y = padTop + plotH - (tokens / maxTokens) * plotH;
    return { x, y, date: String(p.date || ''), tokens, dailyTokens };
  });

  const linePath = coords
    .map((c, idx) => `${idx === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`)
    .join(' ');
  const baselineY = (padTop + plotH).toFixed(1);
  const areaPath = coords.length > 1
    ? `${linePath} L${coords[coords.length - 1].x.toFixed(1)},${baselineY} L${coords[0].x.toFixed(1)},${baselineY} Z`
    : '';

  const hitStep = Math.max(1, Math.floor(coords.length / 48));
  const hitNodes = coords
    .filter((_, i) => i % hitStep === 0 || i === coords.length - 1)
    .map((c) => {
      const selected = activeDateFilter?.type === 'day' && activeDateFilter.date === c.date;
      const tip = isEn
        ? `${c.date} · Cumulative ${formatTokensEn(c.tokens)} (${formatExactInt(c.tokens)}) · Daily +${formatTokensEn(c.dailyTokens)}`
        : `${c.date} · 累计 ${formatTokensZh(c.tokens)} (${formatTokensEn(c.tokens)}) · 当日 +${formatTokensEn(c.dailyTokens)}`;
      return (
        `<circle class="cum-point-hit" cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="${selected ? 4.5 : 3.2}"` +
        ` fill="var(--am-primary)" fill-opacity="${selected ? '1' : '0.85'}"` +
        ` data-chart-kind="day" data-date="${escapeHtml(c.date)}" data-tokens="${c.tokens}"` +
        ` data-daily-tokens="${c.dailyTokens}" data-tooltip="${escapeHtml(tip)}"` +
        ` tabindex="0" role="button" aria-label="${escapeHtml(tip)}"><title>${escapeHtml(tip)}</title></circle>`
      );
    });

  const xLabelIndices = Array.from(new Set([0, Math.floor((coords.length - 1) / 2), coords.length - 1]));
  const xLabels = xLabelIndices.map((idx) => {
    const c = coords[idx];
    return `<text x="${c.x.toFixed(1)}" y="${height - 9}" text-anchor="middle" class="svg-axis-label">${escapeHtml(c.date.slice(5) || c.date)}</text>`;
  });

  const svgAria = isEn
    ? 'Cumulative Token growth curve'
    : '累计 Token 总量增长曲线';

  return (
    `<svg class="activity-svg svg-responsive-fit" viewBox="0 0 ${width} ${height}" role="img" aria-label="${svgAria}">` +
    `<defs><linearGradient id="cum-area-grad" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0%" stop-color="var(--am-primary)" stop-opacity="0.28"/>` +
    `<stop offset="100%" stop-color="var(--am-primary)" stop-opacity="0.02"/>` +
    `</linearGradient></defs>` +
    gridLines.join('') +
    (areaPath ? `<path d="${areaPath}" fill="url(#cum-area-grad)"/>` : '') +
    `<path d="${linePath}" fill="none" stroke="var(--am-primary)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>` +
    hitNodes.join('') +
    xLabels.join('') +
    `</svg>`
  );
}

/* ==========================================================================
   6. Realistic ?mock=1 Preview Data Generators
   ========================================================================== */

export function createMockConversationData(
  convId = 'mock-conv-wsl-001',
  alertEnabled = true,
  locale = currentLocale,
) {
  const isEn = normalizeLocale(locale, currentLocale) === 'en';
  const rootConvId = 'mock-conv-wsl-001';
  const rootTitle = isEn
    ? 'Build agy-monitor cross-side context & global Token monitor plugin'
    : '构建 agy-monitor 双端上下文与全局 Token 监控插件';
  const mockSubagents = [
    {
      conversationId: 'mock-sub-browser',
      parentConversationId: rootConvId,
      depth: 1,
      title: isEn
        ? 'browser · Verify sidecar responsive layout & contrast'
        : 'browser · 验证侧边栏响应式布局与色彩对比度',
      role: 'browser',
      modelName: 'Gemini 4 Carbon (High)',
      surface: 'Desktop (WSL)',
      isLocalSide: true,
      totalTokens: 510_000,
      inputTokens: 42_000,
      outputTokens: 16_800,
      cacheReadTokens: 451_200,
      selfContextTokens: 209_920,
      contextUsedPercent: 82.0,
      checkpointCount: 1,
      requestCount: 18,
      sharePercent: 48.6,
    },
    {
      conversationId: 'mock-sub-swarm',
      parentConversationId: rootConvId,
      depth: 1,
      title: isEn
        ? 'swarm · Implement incremental transcript parser & attribution engine'
        : 'swarm · 并行实现增量解析器与归因引擎',
      role: 'swarm',
      modelName: 'Gemini 4 Argon (High)',
      surface: 'Desktop (WSL)',
      isLocalSide: true,
      totalTokens: 340_000,
      inputTokens: 29_500,
      outputTokens: 11_200,
      cacheReadTokens: 299_300,
      selfContextTokens: 112_640,
      contextUsedPercent: 44.0,
      checkpointCount: 0,
      requestCount: 12,
      sharePercent: 32.4,
    },
  ];
  const availableConversations = [
    {
      conversationId: rootConvId,
      title: rootTitle,
      surface: 'Desktop (WSL)',
    },
    {
      conversationId: 'mock-conv-win-002',
      title: isEn
        ? 'Windows Desktop Electron rendering performance audit'
        : 'Windows 桌面端 Electron 渲染性能排查',
      surface: 'Desktop (Win)',
    },
  ];

  const matchedSub = mockSubagents.find((s) => s.conversationId === convId);
  if (matchedSub) {
    const isBrowserWorker = matchedSub.conversationId === 'mock-sub-browser';
    const usedTokens = matchedSub.selfContextTokens;
    const categories = isBrowserWorker
      ? [
          { id: 'rules', label: isEn ? CATEGORY_LABELS_EN.rules : 'Rules 规则文件', tokens: 6_800, percent: 2.7 },
          { id: 'system', label: isEn ? CATEGORY_LABELS_EN.system : 'System 底座与内置工具', tokens: 24_200, percent: 9.5 },
          { id: 'mcp', label: isEn ? CATEGORY_LABELS_EN.mcp : 'MCP 工具', tokens: 12_400, percent: 4.8 },
          { id: 'skills', label: isEn ? CATEGORY_LABELS_EN.skills : 'Skills 技能', tokens: 9_400, percent: 3.7 },
          { id: 'messages', label: isEn ? CATEGORY_LABELS_EN.messages : '对话消息与附件', tokens: 51_120, percent: 20.0 },
          { id: 'toolResults', label: isEn ? CATEGORY_LABELS_EN.toolResults : '工具调用结果', tokens: 106_000, percent: 41.4 },
        ]
      : [
          { id: 'rules', label: isEn ? CATEGORY_LABELS_EN.rules : 'Rules 规则文件', tokens: 6_800, percent: 2.7 },
          { id: 'system', label: isEn ? CATEGORY_LABELS_EN.system : 'System 底座与内置工具', tokens: 24_200, percent: 9.5 },
          { id: 'mcp', label: isEn ? CATEGORY_LABELS_EN.mcp : 'MCP 工具', tokens: 6_400, percent: 2.5 },
          { id: 'skills', label: isEn ? CATEGORY_LABELS_EN.skills : 'Skills 技能', tokens: 6_240, percent: 2.4 },
          { id: 'messages', label: isEn ? CATEGORY_LABELS_EN.messages : '对话消息与附件', tokens: 28_000, percent: 10.9 },
          { id: 'toolResults', label: isEn ? CATEGORY_LABELS_EN.toolResults : '工具调用结果', tokens: 41_000, percent: 16.0 },
        ];
    return {
      unchanged: false,
      etag: `mock-sub-${convId}-${alertEnabled ? 'on' : 'off'}-v1`,
      conversationId: convId,
      isSubagent: true,
      role: matchedSub.role,
      parentConversationId: rootConvId,
      rootConversationId: rootConvId,
      ancestors: [
        {
          conversationId: rootConvId,
          title: rootTitle,
          role: null,
          selfContextTokens: 212_400,
          combinedTotalTokens: 1_050_000,
        },
      ],
      siblingSubagents: mockSubagents,
      title: matchedSub.title,
      surface: matchedSub.surface,
      isLocalSide: matchedSub.isLocalSide,
      workspace: '/home/dev/projects/agy-monitor',
      modelName: matchedSub.modelName,
      settings: {
        enableChatAlert: Boolean(alertEnabled),
      },
      consumption: {
        turnCount: isBrowserWorker ? 6 : 4,
        stepCount: isBrowserWorker ? 48 : 32,
        requestCount: matchedSub.requestCount,
        combinedTotalTokens: matchedSub.totalTokens,
        selfTotalTokens: matchedSub.totalTokens,
        subagentsTotalTokens: 0,
        selfSharePercent: 100,
        subagentsSharePercent: 0,
        subagents: [],
        inputTokens: matchedSub.inputTokens,
        outputTokens: matchedSub.outputTokens,
        cacheReadTokens: matchedSub.cacheReadTokens,
        cacheHitRate: matchedSub.cacheReadTokens / (matchedSub.inputTokens + matchedSub.cacheReadTokens),
        avgTokensPerSec: isBrowserWorker ? 74.2 : 81.6,
        avgStepDurationMs: isBrowserWorker ? 3_620 : 2_980,
        lastStepDurationMs: isBrowserWorker ? 2_840 : 2_410,
      },
      checkpoints: isBrowserWorker
        ? {
            count: 1,
            latest: {
              stepIndex: 28,
              createdAt: '2026-11-11T08:14:22Z',
              beforeTokens: 246_800,
              afterTokens: 74_200,
              deltaTokens: -172_600,
            },
            items: [
              {
                stepIndex: 28,
                createdAt: '2026-11-11T08:14:22Z',
                beforeTokens: 246_800,
                afterTokens: 74_200,
                deltaTokens: -172_600,
              },
            ],
          }
        : { count: 0, latest: null, items: [] },
      contextWindow: {
        limit: 256_000,
        autocompactBuffer: 6_000,
        safeLimit: 250_000,
        usedTokens,
        usedPercent: matchedSub.contextUsedPercent,
        freeTokens: Math.max(0, 250_000 - usedTokens),
        alertLevel: isBrowserWorker ? 'warn' : 'ok',
        categories,
        deferred: {
          totalEstimatedTokens: 29_800,
          lazyMcp: { estimatedTokens: 18_200, count: 24 },
          inactiveSkills: { estimatedTokens: 11_600, count: 14 },
        },
        drawers: {
          rules: [
            { path: 'AGENTS.md', scope: isEn ? 'workspace' : '工作区根目录', tokens: 4_200 },
            { path: '.agents/rules/openspec-conventions.md', scope: isEn ? 'workspace' : '工作区规则', tokens: 2_600 },
          ],
          mcp: [
            { name: 'filesystem-mcp', toolCount: 9, eager: true, tokens: 6_800 },
          ],
          skills: [
            { name: 'modern-web-guidance', activated: true, tokens: 9_400, path: 'skills/modern-web-guidance/SKILL.md' },
          ],
          topSpikes: isBrowserWorker
            ? [
                { stepIndex: 19, toolName: 'read_file', summary: 'plugin/sidecars/monitor_pane/web/styles.css', deltaTokens: 24_600 },
                { stepIndex: 12, toolName: 'run_command', summary: 'DOM container query snapshot audit', deltaTokens: 16_300 },
              ]
            : [
                { stepIndex: 9, toolName: 'read_file', summary: 'lib/transcript_parser.mjs & gen_metadata', deltaTokens: 15_800 },
                { stepIndex: 14, toolName: 'run_command', summary: 'node --test test/transcript_parser.test.mjs', deltaTokens: 8_900 },
              ],
        },
      },
      availableConversations,
    };
  }

  return {
    unchanged: false,
    etag: `mock-conv-${alertEnabled ? 'on' : 'off'}-v1`,
    conversationId: convId,
    isSubagent: false,
    role: null,
    parentConversationId: null,
    rootConversationId: convId,
    ancestors: [],
    siblingSubagents: [],
    title: rootTitle,
    surface: 'Desktop (WSL)',
    isLocalSide: true,
    workspace: '/home/dev/projects/agy-monitor',
    modelName: 'Claude Opus 4.6',
    settings: {
      enableChatAlert: Boolean(alertEnabled),
    },
    consumption: {
      turnCount: 14,
      stepCount: 126,
      requestCount: 41,
      combinedTotalTokens: 1_050_000,
      selfTotalTokens: 200_000,
      subagentsTotalTokens: 850_000,
      selfSharePercent: 19.0,
      subagentsSharePercent: 81.0,
      subagents: mockSubagents,
      inputTokens: 28_400,
      outputTokens: 14_600,
      cacheReadTokens: 157_000,
      cacheHitRate: 0.847,
      avgTokensPerSec: 68.4,
      avgStepDurationMs: 4_250,
      lastStepDurationMs: 3_180,
    },
    checkpoints: {
      count: 1,
      latest: {
        stepIndex: 34,
        createdAt: '2026-11-11T07:52:10Z',
        beforeTokens: 249_200,
        afterTokens: 68_400,
        deltaTokens: -180_800,
      },
      items: [
        {
          stepIndex: 34,
          createdAt: '2026-11-11T07:52:10Z',
          beforeTokens: 249_200,
          afterTokens: 68_400,
          deltaTokens: -180_800,
        },
      ],
    },
    contextWindow: {
      limit: 256_000,
      autocompactBuffer: 6_000,
      safeLimit: 250_000,
      usedTokens: 212_400,
      usedPercent: 83.0,
      freeTokens: 37_600,
      alertLevel: 'warn',
      categories: [
        { id: 'rules', label: isEn ? CATEGORY_LABELS_EN.rules : 'Rules 规则文件', tokens: 6_800, percent: 2.7 },
        { id: 'system', label: isEn ? CATEGORY_LABELS_EN.system : 'System 底座与内置工具', tokens: 24_200, percent: 9.5 },
        { id: 'mcp', label: isEn ? CATEGORY_LABELS_EN.mcp : 'MCP 工具', tokens: 11_400, percent: 4.5 },
        { id: 'skills', label: isEn ? CATEGORY_LABELS_EN.skills : 'Skills 技能', tokens: 15_600, percent: 6.1 },
        { id: 'messages', label: isEn ? CATEGORY_LABELS_EN.messages : '对话消息与附件', tokens: 62_000, percent: 24.2 },
        { id: 'toolResults', label: isEn ? CATEGORY_LABELS_EN.toolResults : '工具调用结果', tokens: 92_400, percent: 36.1 },
      ],
      deferred: {
        totalEstimatedTokens: 29_800,
        lazyMcp: { estimatedTokens: 18_200, count: 24 },
        inactiveSkills: { estimatedTokens: 11_600, count: 14 },
      },
      drawers: {
        rules: [
          { path: 'AGENTS.md', scope: isEn ? 'workspace' : '工作区根目录', tokens: 4_200 },
          { path: '.agents/rules/openspec-conventions.md', scope: isEn ? 'workspace' : '工作区规则', tokens: 2_600 },
        ],
        mcp: [
          { name: 'filesystem-mcp', toolCount: 9, eager: true, tokens: 6_800 },
          { name: 'git-inspector', toolCount: 6, eager: true, tokens: 4_600 },
        ],
        skills: [
          { name: 'modern-web-guidance', activated: true, tokens: 9_400, path: 'skills/modern-web-guidance/SKILL.md' },
          { name: 'plugin', activated: true, tokens: 4_100, path: 'builtin/skills/plugin/SKILL.md' },
          { name: isEn ? 'openspec-apply-change (+14 summaries)' : 'openspec-apply-change (+14 摘要)', activated: false, tokens: 2_100, path: 'frontmatter summaries' },
        ],
        topSpikes: [
          { stepIndex: 23, toolName: 'read_file', summary: '/tmp/mwg-guide-1364-lines.md', deltaTokens: 18_900 },
          { stepIndex: 16, toolName: 'read_board', summary: isEn ? 'Read Swarm task contracts #1..#7' : '读取 Swarm 全员任务契约 #1..#7', deltaTokens: 14_200 },
          { stepIndex: 11, toolName: 'read_file', summary: 'sidecar_sdk/preload.js & index.mjs', deltaTokens: 9_650 },
          { stepIndex: 39, toolName: 'run_command', summary: 'node --test test/*.test.mjs', deltaTokens: 6_400 },
        ],
      },
    },
    availableConversations,
  };
}

export function createMockGlobalData(locale = currentLocale) {
  const isEn = normalizeLocale(locale, currentLocale) === 'en';
  const end = new Date('2026-11-11T12:00:00');
  const daily = [];
  let runningTotal = 0;
  const cumulative = [];
  const weeklyMap = new Map();

  for (let i = 364; i >= 0; i--) {
    const d = new Date(end.getTime() - i * 86_400_000);
    const key = toLocalDateKey(d);
    // Deterministic realistic wave pattern
    const wave = ((i * 37) % 11 === 0) ? 0 : Math.max(0, Math.round((Math.sin(i * 0.27) + 1.15) * (i < 45 ? 420_000 : 120_000)));
    const tokens = i === 1 ? 2_480_000 : (i === 0 ? 1_640_000 : wave);
    const requests = tokens > 0 ? Math.max(1, Math.round(tokens / 38_000)) : 0;
    daily.push({ date: key, tokens, requests });

    runningTotal += tokens;
    if (i % 4 === 0 || i < 30) {
      cumulative.push({ date: key, tokens: runningTotal, dailyTokens: tokens });
    }

    const mondayOffset = (d.getDay() + 6) % 7;
    const monday = new Date(d.getTime() - mondayOffset * 86_400_000);
    const sunday = new Date(monday.getTime() + 6 * 86_400_000);
    const wStart = toLocalDateKey(monday);
    const wEnd = toLocalDateKey(sunday);
    let wk = weeklyMap.get(wStart);
    if (!wk) {
      wk = { weekStart: wStart, weekEnd: wEnd, label: wStart.slice(5), tokens: 0, requests: 0 };
      weeklyMap.set(wStart, wk);
    }
    wk.tokens += tokens;
    wk.requests += requests;
  }

  const wslTitle = isEn
    ? 'Build agy-monitor cross-side context & global Token monitor plugin'
    : '构建 agy-monitor 双端上下文与全局 Token 监控插件';
  const winTitle = isEn
    ? 'Windows Desktop Electron rendering performance audit'
    : 'Windows 桌面端 Electron 渲染性能排查';
  const cliTitle = isEn
    ? 'Fix WSL non-interactive Hook PATH auto-detection'
    : 'WSL 非交互式 Hook PATH 自动探测修复';

  const requests = [
    {
      id: 'req-1',
      timestamp: Date.parse('2026-11-11T16:12:40Z'),
      isoTime: '2026-11-11T16:12:40Z',
      date: '2026-11-11',
      surface: 'Desktop (WSL)',
      isLocalSide: true,
      project: 'agy-monitor',
      workspace: '/home/dev/projects/agy-monitor',
      conversationId: 'mock-conv-wsl-001',
      conversationTitle: wslTitle,
      stepIndex: 41,
      model: 'Claude Opus 4.6',
      status: 'normal',
      contextTokens: 212_400,
      preCheckpointContextTokens: 0,
      cacheHitRate: 0.912,
      inputTokens: 18_400,
      outputTokens: 2_850,
      cacheReadTokens: 191_150,
      totalTokens: 212_400,
      tokensPerSec: 71.2,
      durationMs: 4_002,
    },
    {
      id: 'req-2',
      timestamp: Date.parse('2026-11-11T15:52:10Z'),
      isoTime: '2026-11-11T15:52:10Z',
      date: '2026-11-11',
      surface: 'Desktop (WSL)',
      isLocalSide: true,
      project: 'agy-monitor',
      workspace: '/home/dev/projects/agy-monitor',
      conversationId: 'mock-conv-wsl-001',
      conversationTitle: wslTitle,
      stepIndex: 34,
      model: 'Claude Opus 4.6',
      status: 'checkpoint',
      contextTokens: 68_400,
      preCheckpointContextTokens: 249_200,
      cacheHitRate: 0.945,
      inputTokens: 13_600,
      outputTokens: 4_100,
      cacheReadTokens: 235_600,
      totalTokens: 253_300,
      tokensPerSec: 64.0,
      durationMs: 6_410,
    },
    {
      id: 'req-3',
      timestamp: Date.parse('2026-11-10T21:18:05Z'),
      isoTime: '2026-11-10T21:18:05Z',
      date: '2026-11-10',
      surface: 'Desktop (Win)',
      isLocalSide: false,
      project: 'win-electron-shell',
      workspace: 'C:\\Users\\dev\\repos\\win-electron-shell',
      conversationId: 'mock-conv-win-002',
      conversationTitle: winTitle,
      stepIndex: 19,
      model: 'Gemini 3.1 Pro',
      status: 'normal',
      contextTokens: 144_800,
      preCheckpointContextTokens: 0,
      cacheHitRate: 0.862,
      inputTokens: 19_500,
      outputTokens: 3_200,
      cacheReadTokens: 122_100,
      totalTokens: 144_800,
      tokensPerSec: 89.5,
      durationMs: 3_575,
    },
    {
      id: 'req-4',
      timestamp: Date.parse('2026-11-10T18:04:51Z'),
      isoTime: '2026-11-10T18:04:51Z',
      date: '2026-11-10',
      surface: 'CLI (WSL)',
      isLocalSide: true,
      project: 'infra-scripts',
      workspace: '/home/dev/projects/infra-scripts',
      conversationId: 'mock-conv-cli-003',
      conversationTitle: cliTitle,
      stepIndex: 8,
      model: 'Claude Sonnet 4.5',
      status: 'error',
      contextTokens: 42_100,
      preCheckpointContextTokens: 0,
      cacheHitRate: 0.76,
      inputTokens: 9_800,
      outputTokens: 310,
      cacheReadTokens: 31_990,
      totalTokens: 42_100,
      tokensPerSec: 38.2,
      durationMs: 8_115,
    },
  ];

  return {
    unchanged: false,
    etag: 'mock-global-v1',
    metrics: {
      totalTokens: runningTotal,
      peakDailyTokens: 2_480_000,
      peakDailyDate: '2026-11-10',
      longestTaskDurationMs: 1_122_000, // 18m 42s
      longestStreakDays: 14,
      currentStreakDays: 6,
    },
    activity: {
      daily,
      weekly: Array.from(weeklyMap.values()).slice(-26),
      cumulative,
    },
    requests,
    projectRankings: deriveProjectRankings(requests, { locale }),
    modelSummary: deriveModelSummary(requests),
  };
}

/* ==========================================================================
   7. Browser UI Controller
   ========================================================================== */

export const PAGE_SIZE = 50;

function getStatusFilterLabel(key, locale = currentLocale) {
  const k = `status.${key}`;
  return I18N_MESSAGES[locale]?.[k] || I18N_MESSAGES.zh[k] || key;
}

function getTimeRangeLabel(preset, locale = currentLocale) {
  const k = `time.${preset}`;
  return I18N_MESSAGES[locale]?.[k] || I18N_MESSAGES.zh[k] || preset;
}

export function bootMonitorApp(win = globalThis.window, doc = globalThis.document) {
  if (!win || !doc) return null;
  win.__AGY_MONITOR_BOOTED__ = true;

  const $ = (id) => doc.getElementById(id);
  const setTxt = (id, text) => {
    const el = $(id);
    if (el) el.textContent = text;
  };
  const setAttr = (id, attr, val) => {
    const el = $(id);
    if (!el) return;
    if (attr === 'title') el.title = val;
    el.setAttribute?.(attr, val);
  };

  const searchStr = win.location?.search || '';
  const queryLang = normalizeLocale(new URLSearchParams(searchStr).get('lang'));
  let storedLang = '';
  try {
    storedLang = normalizeLocale(win.localStorage?.getItem?.(LANG_STORAGE_KEY) || '');
  } catch {
    // Ignore storage access errors in sandboxed contexts
  }
  const initialLocale = resolveInitialLocale({
    search: searchStr,
    storedLang,
    settingsLang: '',
    navigatorLanguage: win.navigator?.language || '',
  });
  setLocale(initialLocale);

  const metaConversationId = doc.querySelector('meta[name="sidecar-conversation-id"]')?.getAttribute('content') || '';
  const route = resolveInitialRoute({
    search: searchStr,
    sidecarConversationId: win.sidecar?.conversationId || '',
    metaConversationId,
  });

  const state = {
    locale: initialLocale,
    localePinned: Boolean(queryLang || storedLang),
    explicitLang: queryLang || storedLang || (initialLocale === 'en' ? 'en' : ''),
    syncKind: 'ok',
    convErrorMsg: '',
    globalErrorMsg: '',
    activeTab: route.tab,
    conversationId: route.conversationId,
    fullscreen: route.fullscreen,
    mock: route.mock,
    themeOverride: route.themeOverride,
    convEtag: '',
    globalEtag: '',
    convData: null,
    globalData: null,
    mockAlertEnabled: true,
    chartView: 'daily',        // 'daily' | 'weekly' | 'cumulative'
    tableSubTab: 'requests',   // 'requests' | 'timeline' | 'projects' | 'models'
    statusFilter: 'all',       // 'all' | 'normal' | 'checkpoint' | 'error'
    activeDateFilter: null,    // null | { type: 'day', date } | { type: 'week', weekStart, weekEnd, label }
    timeRangeFilter: { preset: 'all', startMs: null, endMs: null, label: '' },
    timeSortOrder: 'desc',     // 'desc' | 'asc'
    timelineGranularity: 'day', // 'day' | 'hour'
    visibleRowsLimit: PAGE_SIZE,
    fallbackTarget: null,
    isPointerDown: false,
    pendingPollRender: null,
    toastTimer: null,
    pollTimer: null,
    spinTimer: null,
  };

  function resolveEventElement(e) {
    const raw = e?.target;
    if (!raw) return null;
    const el = raw.nodeType === 1
      ? raw
      : (raw.parentElement || (typeof raw.closest === 'function' ? raw : null));
    return typeof el?.closest === 'function' ? el : null;
  }

  if (state.fullscreen && doc.body?.dataset) {
    doc.body.dataset.fullscreen = 'true';
  }

  function applyStaticTranslations(loc = state.locale) {
    const htmlLang = loc === 'en' ? 'en' : 'zh-CN';
    if (doc.documentElement) {
      doc.documentElement.lang = htmlLang;
      doc.documentElement.setAttribute?.('lang', htmlLang);
    }
    doc.title = t('doc.title', null, loc);

    // Header & Fullscreen bar
    const badge = $('mode-badge');
    if (badge) {
      if (state.mock) {
        badge.hidden = false;
        badge.textContent = t('header.mockBadge', null, loc);
      } else if (state.fullscreen) {
        badge.hidden = false;
        badge.textContent = t('header.fullscreenBadge', null, loc);
      } else {
        badge.textContent = t('header.previewBadge', null, loc);
      }
    }
    setAttr('sync-status', 'title', t('header.syncTitle', null, loc));
    const langBtn = $('btn-lang-toggle');
    if (langBtn) {
      const toggleTxt = t('header.langToggleText', null, loc);
      const toggleTitle = t('header.langToggleTitle', null, loc);
      langBtn.textContent = toggleTxt;
      langBtn.title = toggleTitle;
      langBtn.setAttribute?.('aria-label', toggleTitle);
    }
    const refreshTitle = t('header.refreshTitle', null, loc);
    setAttr('btn-refresh', 'title', refreshTitle);
    setAttr('btn-refresh', 'aria-label', refreshTitle);
    setAttr('btn-fullscreen-header', 'title', t('header.fullscreenTitle', null, loc));
    setTxt('btn-fullscreen-header-text', t('header.fullscreenBtn', null, loc));
    setTxt('btn-fullscreen-global-text', t('header.fullscreenBtn', null, loc));

    setTxt('fullscreen-url-label', t('fsbar.label', null, loc));
    setAttr('fullscreen-url-input', 'aria-label', t('fsbar.inputAria', null, loc));
    setTxt('btn-copy-fullscreen-url', t('fsbar.copyBtn', null, loc));
    setTxt('link-open-fullscreen', t('fsbar.openLink', null, loc));
    setAttr('btn-close-fullscreen-bar', 'aria-label', t('fsbar.closeAria', null, loc));

    // Primary tabs
    setAttr('primary-tablist', 'aria-label', t('tabs.aria', null, loc));
    setTxt('tabbtn-conv-label', t('tabs.conversation', null, loc));
    setTxt('tabbtn-global-label', t('tabs.global', null, loc));

    // Tab 1 static labels
    setAttr('conv-drilldown-bar', 'aria-label', t('drill.navAria', null, loc));
    setTxt('btn-back-root-conv', t('drill.backMain', null, loc));
    setTxt('btn-open-subagent-host', t('drill.openHost', null, loc));
    setAttr('btn-open-subagent-host', 'title', t('drill.openHostTitle', null, loc));
    setAttr('conv-sibling-pills', 'aria-label', t('drill.siblingsAria', null, loc));

    const activeWin = state.convData?.contextWindow;
    const winParams = buildWindowI18nParams(
      activeWin?.limit,
      activeWin?.autocompactBuffer,
      activeWin?.safeLimit,
    );

    setAttr('session-meta-card', 'aria-label', t('meta.sectionAria', null, loc));
    if (!state.convData) {
      setTxt('conv-title', t('meta.loadingConv', null, loc));
      setTxt('conv-alert-pill', t('meta.alertHealthy', null, loc));
      setTxt('conv-subagent-count-pill', t('cons.noSubagents', null, loc));
      setTxt('context-window-label', t('win.labelMain', winParams, loc));
      setTxt('window-used-pct', t('win.usedPct', { pct: '0.0' }, loc));
      setTxt('stat-last-duration', t('stats.latestDuration', { val: '—' }, loc));
      setTxt('stat-checkpoint-count', t('stats.checkpointCount', { count: 0 }, loc));
      setTxt('stat-checkpoint-delta', t('stats.checkpointNone', null, loc));
      setTxt('deferred-total-tokens', t('win.deferredTotal', { tokens: '0' }, loc));
      setTxt('drawer-rules-meta', t('drawers.rulesCount', { count: 0 }, loc));
      setTxt('drawer-mcp-meta', t('drawers.mcpCount', { count: 0 }, loc));
      setTxt('drawer-skills-meta', t('drawers.skillsCount', { count: 0 }, loc));
      setTxt('drawer-spikes-meta', t('drawers.spikesCount', { count: 0 }, loc));
    }
    setAttr('meta-model-wrap', 'title', t('meta.modelTitle', null, loc));
    setTxt('meta-key-model', t('meta.modelKey', null, loc));
    setTxt('meta-key-workspace', t('meta.workspaceKey', null, loc));
    setTxt('conv-selector-label', t('meta.switchConvAria', null, loc));
    setAttr('conv-selector', 'title', t('meta.switchConvTitle', null, loc));

    setAttr('consumption-card', 'aria-label', t('cons.sectionAria', null, loc));
    setTxt('consumption-card-label', t('cons.cardLabel', null, loc));
    setAttr('conv-split-bar', 'aria-label', t('cons.splitAria', null, loc));
    setTxt('split-name-self', t('cons.selfName', null, loc));
    setTxt('split-name-sub', t('cons.subName', null, loc));

    setAttr('stats-grid-section', 'aria-label', t('stats.sectionAria', null, loc));
    setTxt('tile-label-input', t('stats.inputLabel', null, loc));
    setTxt('tile-label-output', t('stats.outputLabel', null, loc));
    setTxt('tile-label-cache', t('stats.cacheLabel', null, loc));
    setTxt('tile-label-speed', t('stats.speedLabel', null, loc));
    setTxt('tile-sub-speed', t('stats.speedSub', null, loc));
    setTxt('tile-label-duration', t('stats.durationLabel', null, loc));
    setTxt('tile-label-checkpoint', t('stats.checkpointLabel', null, loc));
    setTxt('stat-checkpoint-badge', t('stats.checkpointBadge', null, loc));

    setAttr('context-window-card', 'aria-label', t('win.sectionAria', winParams, loc));
    setTxt('btn-methodology', t('win.methodologyBtn', null, loc));
    const methNote = $('methodology-note');
    if (methNote) methNote.innerHTML = t('win.methodologyHtml', winParams, loc);
    setAttr('context-progress-bar', 'aria-label', t('win.barAria', winParams, loc));
    setAttr('threshold-mark-80', 'title', t('win.mark80Title', winParams, loc));
    setAttr('threshold-mark-92', 'title', t('win.mark92Title', winParams, loc));
    setAttr('context-categories-list', 'aria-label', t('win.catListAria', null, loc));
    setTxt('bf-label-buffer', t('win.bufferLabel', null, loc));
    setTxt('bf-label-free', t('win.freeLabel', null, loc));
    setAttr('deferred-section', 'aria-label', t('win.deferredAria', null, loc));
    setTxt('deferred-title', t('win.deferredTitle', null, loc));
    setTxt('deferred-label-mcp', t('win.deferredMcp', null, loc));
    setTxt('deferred-label-skills', t('win.deferredSkills', null, loc));

    setAttr('alert-toggle-card', 'aria-label', t('alert.sectionAria', null, loc));
    setTxt('chat-alert-label', t('alert.title', null, loc));
    const alertDesc = $('chat-alert-desc');
    if (alertDesc) alertDesc.innerHTML = t('alert.descHtml', winParams, loc);

    setAttr('drawers-section', 'aria-label', t('drawers.sectionAria', null, loc));
    setTxt('drawer-rules-title', t('drawers.rulesTitle', null, loc));
    setTxt('drawer-mcp-title', t('drawers.mcpTitle', null, loc));
    setTxt('drawer-skills-title', t('drawers.skillsTitle', null, loc));
    setTxt('drawer-spikes-title', t('drawers.spikesTitle', null, loc));

    // Tab 2 static labels
    setTxt('global-subtitle', t('global.subtitle', null, loc));
    setAttr('global-metrics-grid', 'aria-label', t('global.metricsAria', null, loc));
    setTxt('metric-label-total', t('global.metricTotalLabel', null, loc));
    setTxt('metric-label-peak', t('global.metricPeakLabel', null, loc));
    setTxt('metric-label-task', t('global.metricTaskLabel', null, loc));
    setTxt('metric-longest-task-sub', t('global.metricTaskSub', null, loc));
    setTxt('metric-label-longest-streak', t('global.metricLongestStreakLabel', null, loc));
    setTxt('metric-sub-longest-streak', t('global.metricLongestStreakSub', null, loc));
    setTxt('metric-label-current-streak', t('global.metricCurrentStreakLabel', null, loc));
    setTxt('metric-sub-current-streak', t('global.metricCurrentStreakSub', null, loc));
    if (!state.globalData) {
      setTxt('metric-total-tokens-sub', t('global.metricTotalSub', { en: '0', exact: '0' }, loc));
      setTxt('metric-peak-date', t('global.metricPeakSubDefault', null, loc));
      setTxt('metric-longest-task', loc === 'en' ? '0s' : '0秒');
      setTxt('metric-longest-streak', loc === 'en' ? '0 days' : '0 天');
      setTxt('metric-current-streak', loc === 'en' ? '0 days' : '0 天');
      setTxt('activity-range-caption', t('chart.captionDaily', null, loc));
      setTxt('table-summary-text', loc === 'en' ? '0 records' : '共 0 条记录');
    }

    setAttr('activity-card', 'aria-label', t('chart.sectionAria', null, loc));
    setTxt('activity-heading', t('chart.heading', null, loc));
    setAttr('activity-tablist', 'aria-label', t('chart.tablistAria', null, loc));
    setTxt('charttab-daily', t('chart.tabDaily', null, loc));
    setTxt('charttab-weekly', t('chart.tabWeekly', null, loc));
    setTxt('charttab-cumulative', t('chart.tabCumulative', null, loc));
    setTxt('btn-clear-date-filter', t('chart.clearFilterBtn', null, loc));
    setAttr('btn-clear-date-chip', 'aria-label', t('chart.clearChipAria', null, loc));

    if (!state.fallbackTarget) {
      setTxt('fallback-conv-title', t('fallback.title', null, loc));
    }
    setAttr('btn-close-fallback', 'aria-label', t('fallback.closeAria', null, loc));
    setTxt('btn-inspect-conv-local', t('fallback.inspectBtn', null, loc));
    setTxt('btn-copy-conv-id', t('fallback.copyIdBtn', null, loc));

    setAttr('table-section-card', 'aria-label', t('table.sectionAria', null, loc));
    setAttr('sub-tablist', 'aria-label', t('table.subtabsAria', null, loc));
    setTxt('subtab-label-requests', t('subtab.requests', null, loc));
    setTxt('subtab-label-timeline', t('subtab.timeline', null, loc));
    setTxt('subtab-label-projects', t('subtab.projects', null, loc));
    setTxt('subtab-label-models', t('subtab.models', null, loc));
    setTxt('global-table-caption', t('table.caption', null, loc));

    setAttr('time-filter-wrap', 'aria-label', t('time.groupAria', null, loc));
    for (const preset of ['all', '1h', 'today', '24h', '7d', '30d', 'custom']) {
      setTxt(`timechip-${preset}`, getTimeRangeLabel(preset, loc));
    }
    for (const chip of doc.querySelectorAll('.filter-chip[data-time-range]')) {
      const preset = chip.dataset?.timeRange || 'all';
      chip.textContent = getTimeRangeLabel(preset, loc);
    }
    setAttr('btn-time-sort', 'title', t('time.sortTitle', null, loc));
    setTxt('btn-time-sort', state.timeSortOrder === 'asc' ? t('time.sortOldest', null, loc) : t('time.sortNewest', null, loc));
    setAttr('timeline-granularity-wrap', 'aria-label', t('time.granularityAria', null, loc));
    setTxt('btn-granularity-day', t('time.byDay', null, loc));
    setTxt('btn-granularity-hour', t('time.byHour', null, loc));
    setTxt('custom-range-label', t('time.rangeLabel', null, loc));
    setAttr('time-start-input', 'aria-label', t('time.startAria', null, loc));
    setAttr('time-end-input', 'aria-label', t('time.endAria', null, loc));
    setTxt('btn-reset-time-range', t('time.resetBtn', null, loc));
    setAttr('status-filter-wrap', 'aria-label', t('status.groupAria', null, loc));
    if (!state.globalData) {
      for (const statusKey of ['all', 'normal', 'checkpoint', 'error']) {
        setTxt(`statuschip-${statusKey}`, `${getStatusFilterLabel(statusKey, loc)} (0)`);
      }
    }
    setTxt('btn-scroll-top', t('table.scrollTop', null, loc));
  }

  // ---------- Host & System Theme Synchronization ----------
  function syncTheme() {
    if (state.themeOverride) {
      doc.documentElement.dataset.theme = state.themeOverride;
      return;
    }
    const inlineBg = doc.documentElement.style.getPropertyValue('--background').trim();
    if (inlineBg) {
      const probe = doc.createElement('span');
      probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;color:var(--background)';
      doc.documentElement.appendChild(probe);
      const computed = win.getComputedStyle(probe).color || '';
      probe.remove();
      const nums = (computed.match(/[\d.]+/g) || []).map(Number);
      if (nums.length >= 3) {
        const scale = computed.startsWith('color(') ? 1 : 255;
        const [r, g, b] = nums.slice(0, 3).map((v) => v / scale);
        const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        doc.documentElement.dataset.theme = lum < 0.5 ? 'dark' : 'light';
        return;
      }
    }
    if (typeof win.matchMedia === 'function') {
      const prefersDark = win.matchMedia('(prefers-color-scheme: dark)').matches;
      doc.documentElement.dataset.theme = prefersDark ? 'dark' : 'light';
    }
  }

  syncTheme();
  applyStaticTranslations(state.locale);

  if (typeof MutationObserver === 'function') {
    new MutationObserver(() => syncTheme()).observe(doc.documentElement, {
      attributes: true,
      attributeFilter: ['style'],
    });
  }
  if (typeof win.matchMedia === 'function') {
    const mq = win.matchMedia('(prefers-color-scheme: dark)');
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', () => syncTheme());
    }
  }

  // ---------- Progressive Enhancement for [switch] Checkbox ----------
  const hasNativeSwitch = Boolean(
    win.HTMLInputElement?.prototype && ('switch' in win.HTMLInputElement.prototype),
  );
  for (const input of doc.querySelectorAll('input[type="checkbox"][switch]')) {
    if (!hasNativeSwitch) {
      input.classList.add('switch-fallback');
      input.setAttribute('role', 'switch');
    }
  }

  // ---------- Toast & Sync Status Helpers ----------
  function showToast(msg) {
    const el = $('toast');
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
    if (state.toastTimer) clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => {
      el.hidden = true;
    }, 3600);
    state.toastTimer?.unref?.();
  }

  function resolveSyncLabel(kind, loc = state.locale) {
    if (kind === 'syncing') return t('header.syncSyncing', null, loc);
    if (kind === 'error') return t('header.syncError', null, loc);
    if (kind === 'offline') return t('header.syncOffline', null, loc);
    if (kind === 'demo') return t('header.syncDemo', null, loc);
    return t('header.syncLive', null, loc);
  }

  function setSyncIndicator(kind, customText = '') {
    state.syncKind = kind;
    const domState = kind === 'demo' ? 'ok' : kind;
    const wrap = $('sync-status');
    const lbl = $('sync-label');
    if (wrap) wrap.dataset.state = domState;
    if (lbl) lbl.textContent = customText || resolveSyncLabel(kind, state.locale);
  }

  function renderConvErrorBanner(msg) {
    const errBanner = $('conv-error-banner');
    if (!errBanner) return;
    errBanner.hidden = false;
    errBanner.innerHTML =
      `${escapeHtml(t('err.convLoad', { msg }, state.locale))} ` +
      `<button type="button" class="ghost-btn sm" id="btn-enable-mock-conv">${escapeHtml(t('err.mockBtn', null, state.locale))}</button>`;
    $('btn-enable-mock-conv')?.addEventListener('click', () => {
      state.mock = true;
      state.convErrorMsg = '';
      errBanner.hidden = true;
      applyStaticTranslations(state.locale);
      refreshActiveData({ force: true });
    });
  }

  function renderGlobalErrorBanner(msg) {
    const errBanner = $('global-error-banner');
    if (!errBanner) return;
    errBanner.hidden = false;
    errBanner.innerHTML =
      `${escapeHtml(t('err.globalLoad', { msg }, state.locale))} ` +
      `<button type="button" class="ghost-btn sm" id="btn-enable-mock-global">${escapeHtml(t('err.mockBtn', null, state.locale))}</button>`;
    $('btn-enable-mock-global')?.addEventListener('click', () => {
      state.mock = true;
      state.globalErrorMsg = '';
      errBanner.hidden = true;
      applyStaticTranslations(state.locale);
      refreshActiveData({ force: true });
    });
  }

  // ---------- Tablist Management ----------
  function activateTablistGroup(tablistEl, selectedBtn) {
    if (!tablistEl || !selectedBtn) return;
    for (const btn of tablistEl.querySelectorAll('[role="tab"]')) {
      const isSel = btn === selectedBtn;
      btn.setAttribute('aria-selected', isSel ? 'true' : 'false');
      btn.toggleAttribute('focusgroupstart', isSel);
    }
  }

  function bindTablistKeyboard(tablistEl, onSelect) {
    if (!tablistEl) return;
    tablistEl.addEventListener('keydown', (e) => {
      const tabs = Array.from(tablistEl.querySelectorAll('[role="tab"]'));
      const curIdx = tabs.indexOf(doc.activeElement);
      if (curIdx < 0) return;
      let nextIdx = -1;
      if (e.key === 'ArrowRight') nextIdx = (curIdx + 1) % tabs.length;
      else if (e.key === 'ArrowLeft') nextIdx = (curIdx - 1 + tabs.length) % tabs.length;
      else if (e.key === 'Home') nextIdx = 0;
      else if (e.key === 'End') nextIdx = tabs.length - 1;
      if (nextIdx >= 0) {
        e.preventDefault();
        tabs[nextIdx].focus();
        onSelect(tabs[nextIdx]);
      }
    });
  }

  function setPrimaryTab(tabName, { triggerFetch = true } = {}) {
    state.activeTab = tabName === 'conversation' ? 'conversation' : 'global';
    const convBtn = $('tabbtn-conversation');
    const globBtn = $('tabbtn-global');
    const convPanel = $('panel-conversation');
    const globPanel = $('panel-global');

    activateTablistGroup(
      convBtn?.parentElement,
      state.activeTab === 'conversation' ? convBtn : globBtn,
    );

    if (convPanel) convPanel.hidden = state.activeTab !== 'conversation';
    if (globPanel) globPanel.hidden = state.activeTab !== 'global';

    if (triggerFetch) {
      refreshActiveData();
    }
  }

  // ---------- Network & API Helpers ----------
  function getResolvedToken() {
    const metaToken = doc.querySelector('meta[name="sidecar-token"]')?.getAttribute('content') || '';
    return resolveSidecarToken({
      sidecar: win.sidecar,
      search: win.location?.search || '',
      metaToken,
      globalToken: win.__AGY_SIDECAR_TOKEN__ || '',
    });
  }

  function getApiFetcher() {
    if (win.sidecar && typeof win.sidecar.fetch === 'function') {
      return win.sidecar.fetch.bind(win.sidecar);
    }
    return win.fetch.bind(win);
  }

  async function setAppLocale(nextLocale, { persist = false, showFeedback = false } = {}) {
    const loc = normalizeLocale(nextLocale);
    if (!loc) return state.locale;
    state.locale = loc;
    setLocale(loc);

    if (persist) {
      state.localePinned = true;
      state.explicitLang = loc;
      try {
        win.localStorage?.setItem?.(LANG_STORAGE_KEY, loc);
      } catch {
        // Ignore storage write errors in restricted webviews
      }
    }

    const preset = state.timeRangeFilter?.preset || 'all';
    if (preset !== 'custom') {
      state.timeRangeFilter.label = getTimeRangeLabel(preset, loc);
    } else if (state.timeRangeFilter.label === '自定义时段' || state.timeRangeFilter.label === 'Custom') {
      state.timeRangeFilter.label = getTimeRangeLabel('custom', loc);
    }

    const feedback = $('alert-save-feedback');
    if (feedback) feedback.textContent = '';

    applyStaticTranslations(loc);
    setSyncIndicator(state.syncKind);

    const fsBar = $('fullscreen-url-bar');
    if (fsBar && !fsBar.hidden) {
      const token = getResolvedToken();
      const relUrl = buildFullscreenUrl(win.location?.search || '', token, state.explicitLang);
      const baseHref =
        win.location?.href ||
        (win.location?.origin ? `${win.location.origin}/` : 'http://127.0.0.1/');
      const fullUrl = new URL(relUrl, baseHref).href;
      const urlInput = $('fullscreen-url-input');
      const urlLink = $('link-open-fullscreen');
      if (urlInput) urlInput.value = fullUrl;
      if (urlLink) {
        urlLink.href = fullUrl;
        urlLink.setAttribute?.('href', fullUrl);
      }
    }

    if (state.mock) {
      if (state.convData) {
        state.convData = createMockConversationData(
          state.conversationId || 'mock-conv-wsl-001',
          state.mockAlertEnabled,
          loc,
        );
      }
      if (state.globalData) {
        state.globalData = createMockGlobalData(loc);
      }
    }

    if (state.convData) {
      renderConversationView(state.convData);
    }
    if (state.globalData) {
      renderGlobalView(state.globalData, { forceRender: true });
    }
    if (state.convErrorMsg && $('conv-error-banner') && !$('conv-error-banner').hidden) {
      renderConvErrorBanner(state.convErrorMsg);
    }
    if (state.globalErrorMsg && $('global-error-banner') && !$('global-error-banner').hidden) {
      renderGlobalErrorBanner(state.globalErrorMsg);
    }
    const fallbackCard = $('session-fallback-card');
    if (fallbackCard && !fallbackCard.hidden && state.fallbackTarget) {
      renderFallbackSessionCard(state.fallbackTarget);
    }

    if (showFeedback) {
      showToast(t('toast.langSwitched', null, loc));
    }

    if (persist && !state.mock) {
      const token = getResolvedToken();
      if (token) {
        const headers = { 'Content-Type': 'application/json', 'X-Sidecar-Token': token };
        const endpoint = `/api/settings?token=${encodeURIComponent(token)}`;
        try {
          const fetcher = getApiFetcher();
          await fetcher(endpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify({ language: loc }),
          });
          if (state.convData?.settings) {
            state.convData.settings.language = loc;
          }
        } catch {
          // Local UI + localStorage already updated cleanly
        }
      }
    }

    return loc;
  }

  async function fetchConversationData({ force = false } = {}) {
    if (force) {
      setSyncIndicator('syncing');
    }
    if (state.mock) {
      state.convData = createMockConversationData(
        state.conversationId || 'mock-conv-wsl-001',
        state.mockAlertEnabled,
        state.locale,
      );
      setSyncIndicator('demo');
      renderConversationView(state.convData, { forceRender: force });
      return true;
    }

    const token = getResolvedToken();
    const qs = new URLSearchParams();
    if (state.conversationId) qs.set('conversationId', state.conversationId);
    if (force) qs.set('refresh', '1');
    if (!force && state.convEtag) qs.set('etag', state.convEtag);
    if (token) qs.set('token', token);

    const headers = {};
    if (!force && state.convEtag) headers['If-None-Match'] = state.convEtag;
    if (token) headers['X-Sidecar-Token'] = token;

    try {
      const fetcher = getApiFetcher();
      const res = await fetcher(`/api/conversation?${qs.toString()}`, { method: 'GET', headers });
      if (res.status === 304) {
        setSyncIndicator('ok');
        return true;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.etag) state.convEtag = data.etag;
      if (data.unchanged && !force) {
        setSyncIndicator('ok');
        return true;
      }
      if (!state.conversationId && data.conversationId) {
        state.conversationId = data.conversationId;
      }
      if (!data.unchanged) {
        state.convData = data;
      }
      if (!state.localePinned && data?.settings?.language) {
        const srvLang = normalizeLocale(data.settings.language);
        if (srvLang && srvLang !== state.locale) {
          if (srvLang === 'en') state.explicitLang = 'en';
          await setAppLocale(srvLang, { persist: false, showFeedback: false });
        }
      }
      state.convErrorMsg = '';
      const errBanner = $('conv-error-banner');
      if (errBanner) errBanner.hidden = true;
      setSyncIndicator('ok');
      if (!force && state.isPointerDown) {
        state.pendingPollRender = 'conversation';
        return true;
      }
      if (state.convData) {
        renderConversationView(state.convData, { forceRender: force });
      }
      return true;
    } catch (err) {
      setSyncIndicator('error');
      state.convErrorMsg = err.message;
      renderConvErrorBanner(err.message);
      return false;
    }
  }

  async function fetchGlobalData({ force = false } = {}) {
    if (force) {
      setSyncIndicator('syncing');
    }
    if (state.mock) {
      state.globalData = createMockGlobalData(state.locale);
      setSyncIndicator('demo');
      renderGlobalView(state.globalData, { forceRender: force });
      return true;
    }

    const token = getResolvedToken();
    const qs = new URLSearchParams();
    if (force) qs.set('refresh', '1');
    if (!force && state.globalEtag) qs.set('etag', state.globalEtag);
    if (token) qs.set('token', token);
    const headers = {};
    if (!force && state.globalEtag) headers['If-None-Match'] = state.globalEtag;
    if (token) headers['X-Sidecar-Token'] = token;

    try {
      const fetcher = getApiFetcher();
      const res = await fetcher(`/api/global?${qs.toString()}`, { method: 'GET', headers });
      if (res.status === 304) {
        setSyncIndicator('ok');
        return true;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.etag) state.globalEtag = data.etag;
      if (data.unchanged && !force) {
        setSyncIndicator('ok');
        return true;
      }
      if (!data.unchanged) {
        state.globalData = data;
      }
      state.globalErrorMsg = '';
      const errBanner = $('global-error-banner');
      if (errBanner) errBanner.hidden = true;
      setSyncIndicator('ok');
      if (!force && state.isPointerDown) {
        state.pendingPollRender = 'global';
        return true;
      }
      if (state.globalData) {
        renderGlobalView(state.globalData, { forceRender: force });
      }
      return true;
    } catch (err) {
      setSyncIndicator('error');
      state.globalErrorMsg = err.message;
      renderGlobalErrorBanner(err.message);
      return false;
    }
  }

  async function updatePluginSettings(patch = {}, { switchEl = null, revertChecked = true, successMsg = '' } = {}) {
    const loc = state.locale;
    const feedback = $('alert-save-feedback');
    if (state.mock) {
      if (typeof patch.enableChatAlert === 'boolean') {
        state.mockAlertEnabled = patch.enableChatAlert;
      }
      if (feedback) {
        feedback.textContent = `${successMsg}${t('alert.demoSuffix', null, loc)}`;
      }
      return;
    }

    const token = getResolvedToken();
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['X-Sidecar-Token'] = token;
    const endpoint = token ? `/api/settings?token=${encodeURIComponent(token)}` : '/api/settings';

    try {
      const fetcher = getApiFetcher();
      const res = await fetcher(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        throw new Error(
          res.status === 401
            ? t('alert.err401', null, loc)
            : t('alert.errStatus', { status: res.status }, loc),
        );
      }
      if (state.convData && state.convData.settings) {
        Object.assign(state.convData.settings, patch);
      }
      if (feedback) {
        feedback.textContent = successMsg;
      }
    } catch (err) {
      if (switchEl) switchEl.checked = revertChecked;
      if (feedback) feedback.textContent = t('alert.errFeedback', { msg: err.message }, loc);
      showToast(t('alert.errToast', { msg: err.message }, loc));
    }
  }

  async function updateChatAlertSetting(enableChatAlert) {
    const val = Boolean(enableChatAlert);
    const loc = state.locale;
    return updatePluginSettings(
      { enableChatAlert: val },
      {
        switchEl: $('chat-alert-switch'),
        revertChecked: !val,
        successMsg: val ? t('alert.savedOn', null, loc) : t('alert.savedOff', null, loc),
      },
    );
  }

  async function inspectSubagentConversation(targetConvId, { toastMsg = '' } = {}) {
    const cleanId = String(targetConvId || '').trim();
    if (!cleanId) return false;
    state.conversationId = cleanId;
    state.convEtag = '';
    const sel = $('conv-selector');
    if (sel) {
      sel.value = cleanId;
    }
    if (state.activeTab !== 'conversation') {
      setPrimaryTab('conversation', { triggerFetch: false });
    }
    const shellMain = doc.querySelector?.('.shell-main');
    if (shellMain && typeof shellMain.scrollTo === 'function') {
      shellMain.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (shellMain) {
      shellMain.scrollTop = 0;
    }
    if (typeof win.scrollTo === 'function') {
      win.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (doc.documentElement) {
      doc.documentElement.scrollTop = 0;
    }
    const ok = await fetchConversationData({ force: true });
    if (ok && toastMsg) {
      showToast(toastMsg);
    }
    return ok;
  }

  // ---------- Render Tab 1: 当前对话 / Current Chat ----------
  function renderConversationView(data) {
    if (!data) return;

    const loc = state.locale;
    const isEn = loc === 'en';
    const isSubagent = Boolean(data.isSubagent);
    const activeConvId = String(data.conversationId || state.conversationId || '').trim();
    const currentRoleLabel = formatSubagentRole(data.role);

    // Subagent / Swarm Worker Drilldown Breadcrumb & Sibling Switcher
    const drillBar = $('conv-drilldown-bar');
    if (drillBar) {
      if (!isSubagent) {
        drillBar.hidden = true;
      } else {
        drillBar.hidden = false;
        const ancestors = Array.isArray(data.ancestors) ? data.ancestors : [];
        const rootConvId = String(
          data.rootConversationId || ancestors[0]?.conversationId || data.parentConversationId || '',
        ).trim();
        const rootTitle = localizeSessionTitle(ancestors[0]?.title, {
          fallbackZh: '主会话',
          fallbackEn: 'Main Chat',
          locale: loc,
        });
        const backMainTitle = t('drill.backMainTitle', { title: rootTitle }, loc);

        const backBtn = $('btn-back-root-conv');
        if (backBtn) {
          backBtn.textContent = t('drill.backMain', null, loc);
          backBtn.dataset.targetConvId = rootConvId;
          backBtn.setAttribute?.('data-target-conv-id', rootConvId);
          backBtn.disabled = !rootConvId;
          backBtn.title = backMainTitle;
        }

        const ancestorTrailEl = $('conv-ancestor-trail');
        if (ancestorTrailEl) {
          const midAncestors = ancestors.length > 1 ? ancestors.slice(1) : [];
          if (midAncestors.length === 0) {
            ancestorTrailEl.hidden = true;
            if (ancestorTrailEl._lastHtml !== '') {
              ancestorTrailEl.innerHTML = '';
              ancestorTrailEl._lastHtml = '';
            }
          } else {
            ancestorTrailEl.hidden = false;
            const trailHtml = midAncestors
              .map((anc) => {
                const ancId = String(anc.conversationId || '').trim();
                const ancTitle = localizeSessionTitle(anc.title, {
                  fallbackZh: ancId.slice(0, 8) || t('drill.parentFallback', null, loc),
                  fallbackEn: ancId.slice(0, 8) || t('drill.parentFallback', null, loc),
                  locale: loc,
                });
                const ancLabel = anc.role
                  ? `@${formatSubagentRole(anc.role)}`
                  : ancTitle;
                return (
                  `<span class="drilldown-sep" aria-hidden="true">/</span>` +
                  `<button type="button" class="drilldown-ancestor-btn" data-drill-conv-id="${escapeHtml(ancId)}" title="${escapeHtml(ancTitle || ancId)}">${escapeHtml(ancLabel)}</button>`
                );
              })
              .join('');
            if (ancestorTrailEl._lastHtml !== trailHtml) {
              ancestorTrailEl.innerHTML = trailHtml;
              ancestorTrailEl._lastHtml = trailHtml;
            }
          }
        }

        const workerBadgeEl = $('conv-current-worker-badge');
        if (workerBadgeEl) {
          workerBadgeEl.textContent = t('drill.viewingSubagent', { role: currentRoleLabel }, loc);
        }

        const hostBtn = $('btn-open-subagent-host');
        if (hostBtn) {
          const canHostOpen = Boolean(
            activeConvId &&
            data.isLocalSide &&
            win.sidecar?.ui &&
            typeof win.sidecar.ui.toggleConversation === 'function',
          );
          hostBtn.hidden = !canHostOpen;
          hostBtn.dataset.hostConvId = activeConvId;
        }

        const siblingPillsEl = $('conv-sibling-pills');
        if (siblingPillsEl) {
          const siblings = Array.isArray(data.siblingSubagents) ? data.siblingSubagents : [];
          const pillParts = [];
          if (rootConvId) {
            pillParts.push(
              `<button type="button" class="sibling-pill sibling-pill-root" data-drill-conv-id="${escapeHtml(rootConvId)}" aria-current="false" title="${escapeHtml(backMainTitle)}">${escapeHtml(t('drill.mainPill', null, loc))}</button>`,
            );
          }
          for (const sib of siblings) {
            const sibId = String(sib?.conversationId || '').trim();
            if (!sibId) continue;
            const sibRole = formatSubagentRole(sib.role);
            const isCurrent = sibId === activeConvId;
            const sibTip = localizeSessionTitle(sib.title, {
              fallbackZh: sibId,
              fallbackEn: sibId,
              locale: loc,
            });
            pillParts.push(
              `<button type="button" class="sibling-pill${isCurrent ? ' is-current' : ''}" data-drill-conv-id="${escapeHtml(sibId)}" aria-current="${isCurrent ? 'true' : 'false'}" title="${escapeHtml(sibTip)}">@${escapeHtml(sibRole)} · ${escapeHtml(formatTokensEn(sib.totalTokens))}</button>`,
            );
          }
          const pillsHtml = pillParts.join('');
          siblingPillsEl.hidden = pillParts.length === 0;
          if (siblingPillsEl._lastHtml !== pillsHtml) {
            siblingPillsEl.innerHTML = pillsHtml;
            siblingPillsEl._lastHtml = pillsHtml;
          }
        }
      }
    }

    const barModel = computeContextBarModel(data.contextWindow, { locale: loc });
    const winParams = buildWindowI18nParams(
      barModel.limit,
      barModel.autocompactBuffer,
      barModel.safeLimit,
    );

    const ctxLabelEl = $('context-window-label');
    if (ctxLabelEl) {
      ctxLabelEl.textContent = isSubagent
        ? t('win.labelSubagent', { role: currentRoleLabel, cap: winParams.cap }, loc)
        : t('win.labelMain', winParams, loc);
    }
    setAttr('context-window-card', 'aria-label', t('win.sectionAria', winParams, loc));
    const methNoteEl = $('methodology-note');
    if (methNoteEl) methNoteEl.innerHTML = t('win.methodologyHtml', winParams, loc);
    setAttr('context-progress-bar', 'aria-label', t('win.barAria', winParams, loc));
    setAttr('threshold-mark-80', 'title', t('win.mark80Title', winParams, loc));
    setAttr('threshold-mark-92', 'title', t('win.mark92Title', winParams, loc));
    const alertDescEl = $('chat-alert-desc');
    if (alertDescEl) alertDescEl.innerHTML = t('alert.descHtml', winParams, loc);

    const convTitleText = localizeSessionTitle(data.title, {
      fallbackZh: data.conversationId || '当前活跃会话',
      fallbackEn: data.conversationId || 'Untitled Session',
      locale: loc,
    });
    setTxt('conv-title', convTitleText);
    setTxt(
      'conv-surface-badge',
      localizeSurface(data.surface || 'Desktop', { fallbackZh: 'Desktop', fallbackEn: 'Desktop', locale: loc }),
    );
    setTxt('conv-model-name', formatModelDisplay(data.modelName || data.model));
    const ws = localizeWorkspace(data.workspace, loc);
    setTxt('conv-workspace', ws);
    setAttr('conv-workspace-wrap', 'title', ws);

    // Conversation switcher when multiple sessions are available
    const avail = Array.isArray(data.availableConversations) ? data.availableConversations : [];
    const swWrap = $('conv-switcher-wrap');
    const sel = $('conv-selector');
    if (swWrap && sel && avail.length > 1) {
      swWrap.hidden = false;
      const hasCurrentInAvail = avail.some((c) => (c.conversationId || c.id || '') === activeConvId);
      const extraSubOpt = isSubagent && activeConvId && !hasCurrentInAvail
        ? `<option value="${escapeHtml(activeConvId)}" selected>${escapeHtml(t('meta.subagentOpt', { role: currentRoleLabel }, loc))}</option>`
        : '';
      const selHtml = extraSubOpt + avail
        .map((c) => {
          const cid = c.conversationId || c.id || '';
          const optTitle = localizeSessionTitle(c.title, {
            fallbackZh: cid.slice(0, 8) || '未命名会话',
            fallbackEn: cid.slice(0, 8) || 'Untitled Session',
            locale: loc,
          });
          const optSurface = c.surface ? localizeSurface(c.surface, { locale: loc }) : '';
          const label = optSurface ? `${optTitle} (${optSurface})` : optTitle;
          const isCurrent = cid === activeConvId;
          return `<option value="${escapeHtml(cid)}"${isCurrent ? ' selected' : ''}>${escapeHtml(label)}</option>`;
        })
        .join('');
      if (sel._lastHtml !== selHtml) {
        sel.innerHTML = selHtml;
        sel._lastHtml = selHtml;
      }
    } else if (swWrap) {
      swWrap.hidden = true;
    }

    // Total Consumption (Main + Subagents / Swarm)
    const cons = data.consumption || {};
    const selfTotal = Math.max(0, Number(cons.selfTotalTokens) || 0);
    const subTotal = Math.max(0, Number(cons.subagentsTotalTokens) || 0);
    const combined = Number.isFinite(Number(cons.combinedTotalTokens))
      ? Math.max(0, Number(cons.combinedTotalTokens))
      : selfTotal + subTotal;
    const selfPct = combined > 0
      ? (Number.isFinite(Number(cons.selfSharePercent)) ? Number(cons.selfSharePercent) : (selfTotal / combined) * 100)
      : 100;
    const subPct = combined > 0
      ? (Number.isFinite(Number(cons.subagentsSharePercent)) ? Number(cons.subagentsSharePercent) : (subTotal / combined) * 100)
      : 0;

    setTxt('conv-combined-tokens', formatTokensEn(combined));
    setAttr('conv-combined-tokens', 'title', t('cons.exactTitle', { exact: formatExactInt(combined) }, loc));
    setTxt(
      'conv-combined-zh',
      isEn
        ? t('cons.heroSub', { exact: formatExactInt(combined) }, loc)
        : t('cons.heroSub', { zh: formatTokensZh(combined), exact: formatExactInt(combined) }, loc),
    );
    const splitSelfEl = $('conv-split-self');
    if (splitSelfEl?.style) splitSelfEl.style.width = `${Math.max(0, Math.min(100, selfPct)).toFixed(1)}%`;
    const splitSubEl = $('conv-split-sub');
    if (splitSubEl?.style) splitSubEl.style.width = `${Math.max(0, Math.min(100, subPct)).toFixed(1)}%`;
    setTxt('conv-self-tokens', formatTokensEn(selfTotal));
    setTxt('conv-self-pct', `(${formatPercent(selfPct)})`);
    setTxt('conv-sub-tokens', formatTokensEn(subTotal));
    setTxt('conv-sub-pct', `(${formatPercent(subPct)})`);

    const subagents = Array.isArray(cons.subagents) ? cons.subagents : [];
    setTxt(
      'conv-subagent-count-pill',
      subagents.length > 0
        ? t('cons.nSubagents', { count: subagents.length }, loc)
        : (isSubagent ? t('cons.subagentView', null, loc) : t('cons.mainOnly', null, loc)),
    );

    const subListEl = $('conv-subagents-list');
    if (subListEl) {
      if (subagents.length === 0) {
        subListEl.hidden = true;
        if (subListEl._lastHtml !== '') {
          subListEl.innerHTML = '';
          subListEl._lastHtml = '';
        }
      } else {
        subListEl.hidden = false;
        const cpTip = t('cons.subCpTitle', null, loc);
        const subHtml = subagents
          .map((sub) => {
            const subId = String(sub.conversationId || '').trim();
            const roleLabel = formatSubagentRole(sub.role);
            const subLimit =
              Number(sub.contextLimit) > 0 ? Number(sub.contextLimit) : barModel.limit;
            const subCap = formatWindowCap(subLimit);
            const winTip = t('cons.subWinTitle', { cap: subCap }, loc);
            const rowTip = t('cons.subRowTitle', { cap: subCap }, loc);
            const displayTitle = formatSubagentTitle(sub.title, sub.role, subId, loc);
            const rawTipTitle = localizeSessionTitle(sub.title, {
              fallbackZh: subId,
              fallbackEn: subId,
              locale: loc,
            });
            const subShare = Number.isFinite(Number(sub.sharePercent))
              ? Number(sub.sharePercent)
              : (combined > 0 ? ((Number(sub.totalTokens) || 0) / combined) * 100 : 0);
            const shareClamped = Math.max(0, Math.min(100, subShare));

            const rawCtxPct = Number(sub.contextUsedPercent);
            const ctxPct = Number.isFinite(rawCtxPct)
              ? Math.max(0, rawCtxPct)
              : (Number.isFinite(Number(sub.selfContextTokens))
                  ? Number(((Math.max(0, Number(sub.selfContextTokens)) / subLimit) * 100).toFixed(1))
                  : null);
            const ctxToneClass = ctxPct === null
              ? 'pill-subtle'
              : ctxPct >= 92
                ? 'pill-danger'
                : ctxPct >= 80
                  ? 'pill-warn'
                  : 'pill-subtle';
            const ctxBadgeHtml = ctxPct !== null
              ? `<span class="pill ${ctxToneClass} subagent-ctx-pill" title="${escapeHtml(winTip)}">${escapeHtml(t('cons.subWinBadge', { pct: trimDecimals(ctxPct.toFixed(1)) }, loc))}</span>`
              : '';
            const cpCountSub = Math.max(0, Number(sub.checkpointCount) || 0);
            const cpBadgeHtml = cpCountSub > 0
              ? `<span class="pill pill-warn subagent-cp-pill" title="${escapeHtml(cpTip)}">${escapeHtml(t('cons.subCpBadge', { count: formatExactInt(cpCountSub) }, loc))}</span>`
              : '';

            return (
              `<button type="button" class="subagent-row subagent-row-btn" data-subagent-id="${escapeHtml(subId)}" data-subagent-role="${escapeHtml(roleLabel)}" data-subagent-cap="${escapeHtml(subCap)}" style="--sub-share:${shareClamped.toFixed(1)}%" title="${escapeHtml(rowTip)}">` +
              `<span class="subagent-name">` +
              `<span class="pill pill-role">@${escapeHtml(roleLabel)}</span>` +
              `<span class="subagent-title-text" title="${escapeHtml(rawTipTitle)}">${escapeHtml(displayTitle)}</span>` +
              `</span>` +
              `<span class="subagent-telemetry">` +
              ctxBadgeHtml +
              cpBadgeHtml +
              `<span class="subagent-tokens"><strong>${escapeHtml(formatTokensEn(sub.totalTokens))}</strong> <span class="muted-num">(${escapeHtml(formatPercent(subShare))})</span></span>` +
              `<span class="subagent-chevron" aria-hidden="true">→</span>` +
              `</span>` +
              `</button>`
            );
          })
          .join('');
        if (subListEl._lastHtml !== subHtml) {
          subListEl.innerHTML = subHtml;
          subListEl._lastHtml = subHtml;
        }
      }
    }

    // 6-Tile Stats Grid
    const inTok = Math.max(0, Number(cons.inputTokens) || 0);
    const outTok = Math.max(0, Number(cons.outputTokens) || 0);
    const cacheTok = Math.max(0, Number(cons.cacheReadTokens) || 0);
    const hitPct = normalizeCacheHitPercent(cons.cacheHitRate, inTok, cacheTok);

    setTxt('stat-input-tokens', formatTokensEn(inTok));
    setTxt('stat-input-exact', `${formatExactInt(inTok)} tokens`);
    setTxt('stat-output-tokens', formatTokensEn(outTok));
    setTxt('stat-output-exact', `${formatExactInt(outTok)} tokens`);
    setTxt('stat-cache-tokens', formatTokensEn(cacheTok));
    setTxt('stat-cache-rate', formatPercent(hitPct));
    setTxt('stat-avg-speed', formatSpeed(cons.avgTokensPerSec));
    setTxt('stat-avg-duration', formatDurationShort(cons.avgStepDurationMs));
    setTxt(
      'stat-last-duration',
      t(
        'stats.latestDuration',
        { val: Number(cons.lastStepDurationMs) > 0 ? formatDurationShort(cons.lastStepDurationMs) : '—' },
        loc,
      ),
    );

    // Checkpoints
    const cp = data.checkpoints || {};
    const cpCount = Math.max(0, Number(cp.count) || (Array.isArray(cp.items) ? cp.items.length : 0));
    const latestCp = cp.latest || (Array.isArray(cp.items) && cp.items.length > 0 ? cp.items[cp.items.length - 1] : null);
    setTxt('stat-checkpoint-count', t('stats.checkpointCount', { count: cpCount }, loc));
    const cpBadge = $('stat-checkpoint-badge');
    if (cpBadge) {
      cpBadge.hidden = cpCount === 0;
      cpBadge.textContent = t('stats.checkpointBadge', null, loc);
    }
    if (cpCount > 0 && latestCp) {
      const before = Number(latestCp.beforeTokens) || 0;
      const after = Number(latestCp.afterTokens) || 0;
      const delta = Number.isFinite(Number(latestCp.deltaTokens)) ? Number(latestCp.deltaTokens) : (after - before);
      setTxt(
        'stat-checkpoint-delta',
        t(
          'stats.checkpointLatest',
          {
            step: latestCp.stepIndex ?? '—',
            before: formatTokensEn(before),
            after: formatTokensEn(after),
            delta: `${delta <= 0 ? '' : '+'}${formatTokensEn(delta)}`,
          },
          loc,
        ),
      );
    } else {
      setTxt(
        'stat-checkpoint-delta',
        cpCount > 0 ? t('stats.checkpointReset', null, loc) : t('stats.checkpointNone', null, loc),
      );
    }

    // Detected Context Window Bar & 6 Categories
    const windowCard = $('context-window-card');
    if (windowCard) windowCard.dataset.alert = barModel.alertState;

    const alertPill = $('conv-alert-pill');
    if (alertPill) {
      alertPill.className = 'pill ' + (
        barModel.alertState === 'critical'
          ? 'pill-danger'
          : barModel.alertState === 'warn'
            ? 'pill-warn'
            : 'pill-ok'
      );
      alertPill.textContent = barModel.alertState === 'critical'
        ? t('meta.alertCritical', null, loc)
        : barModel.alertState === 'warn'
          ? t('meta.alertWarn', null, loc)
          : t('meta.alertHealthy', null, loc);
    }

    const tabPctBadge = $('tab-conv-pct');
    if (tabPctBadge) {
      tabPctBadge.hidden = false;
      tabPctBadge.textContent = `${barModel.usedPercent.toFixed(0)}%`;
    }

    setTxt('window-used-pct', t('win.usedPct', { pct: barModel.usedPercent.toFixed(1) }, loc));
    setTxt('window-used-fraction', `${formatTokensEn(barModel.usedTokens)} / ${formatTokensEn(barModel.limit)}`);
    setAttr(
      'window-used-fraction',
      'title',
      t('win.exactTitle', { used: formatExactInt(barModel.usedTokens), limit: formatExactInt(barModel.limit) }, loc),
    );

    const barEl = $('context-progress-bar');
    if (barEl) {
      const segsHtml = barModel.categories
        .filter((c) => c.tokens > 0)
        .map((c) => {
          const tip = `${c.label}: ${formatTokensEn(c.tokens)} (${formatExactInt(c.tokens)} tokens · ${c.percent.toFixed(1)}%)`;
          return `<div class="ctx-seg" data-cat="${escapeHtml(c.id)}" style="width:${c.widthPct.toFixed(3)}%" title="${escapeHtml(tip)}"></div>`;
        });
      if (barModel.freeWidthPct > 0) {
        segsHtml.push(
          `<div class="ctx-seg" data-cat="free" style="width:${barModel.freeWidthPct.toFixed(3)}%" title="${escapeHtml(t('win.freeSegTitle', { free: formatTokensEn(barModel.freeTokens) }, loc))}"></div>`,
        );
      }
      if (barModel.bufferWidthPct > 0) {
        segsHtml.push(
          `<div class="ctx-seg" data-cat="buffer" style="width:${barModel.bufferWidthPct.toFixed(3)}%" title="${escapeHtml(t('win.bufferSegTitle', { buf: formatTokensEn(barModel.autocompactBuffer) }, loc))}"></div>`,
        );
      }
      barEl.innerHTML = segsHtml.join('');
    }

    const catListEl = $('context-categories-list');
    if (catListEl) {
      catListEl.innerHTML = barModel.categories
        .map((c) => (
          `<li class="category-item" title="${escapeHtml(t('win.catExactTitle', { exact: formatExactInt(c.tokens) }, loc))}">` +
          `<span class="cat-left">` +
          `<span class="swatch" style="background:var(--cat-${escapeHtml(c.id)})" aria-hidden="true"></span>` +
          `<span>${escapeHtml(c.label)}</span>` +
          `</span>` +
          `<span class="cat-right">` +
          `<strong>${escapeHtml(formatTokensEn(c.tokens))}</strong>` +
          `<span class="cat-pct">${escapeHtml(formatPercent(c.percent))}</span>` +
          `</span>` +
          `</li>`
        ))
        .join('');
    }

    const bufPct = ((barModel.autocompactBuffer / barModel.limit) * 100).toFixed(1);
    setTxt('window-buffer-tokens', `~${formatTokensEn(barModel.autocompactBuffer)} (${bufPct}%)`);
    setTxt(
      'window-free-tokens',
      `${formatTokensEn(barModel.freeTokens)} (${((barModel.freeTokens / barModel.limit) * 100).toFixed(1)}%)`,
    );

    // Deferred Section
    const defRaw = data.contextWindow?.deferred || {};
    const lazyMcp = normalizeDeferredGroup(defRaw.lazyMcp);
    const inactiveSkills = normalizeDeferredGroup(defRaw.inactiveSkills);
    const totalDeferred = Number.isFinite(Number(defRaw.totalEstimatedTokens))
      ? Math.max(0, Math.round(Number(defRaw.totalEstimatedTokens)))
      : lazyMcp.tokens + inactiveSkills.tokens;

    setTxt('deferred-total-tokens', t('win.deferredTotal', { tokens: formatTokensEn(totalDeferred) }, loc));
    setTxt(
      'deferred-lazy-mcp',
      lazyMcp.count !== null
        ? t('win.deferredItemCount', { tokens: formatTokensEn(lazyMcp.tokens), count: lazyMcp.count }, loc)
        : `~${formatTokensEn(lazyMcp.tokens)}`,
    );
    setTxt(
      'deferred-inactive-skills',
      inactiveSkills.count !== null
        ? t('win.deferredItemCount', { tokens: formatTokensEn(inactiveSkills.tokens), count: inactiveSkills.count }, loc)
        : `~${formatTokensEn(inactiveSkills.tokens)}`,
    );

    // Chat Compaction Alert Switch
    const sw = $('chat-alert-switch');
    if (sw && typeof data.settings?.enableChatAlert === 'boolean') {
      sw.checked = data.settings.enableChatAlert;
    }

    // 4 Bottom Accordion Drawers
    const drawers = data.contextWindow?.drawers || {};
    renderRulesDrawer(unwrapDrawerArray(drawers.rules));
    renderMcpDrawer(unwrapDrawerArray(drawers.mcp));
    renderSkillsDrawer(unwrapDrawerArray(drawers.skills));
    renderSpikesDrawer(unwrapDrawerArray(drawers.topSpikes));
  }

  function setDrawerBodyHtml(body, html) {
    if (!body) return;
    if (body._lastHtml !== html) {
      body.innerHTML = html;
      body._lastHtml = html;
    }
  }

  function renderRulesDrawer(items) {
    const loc = state.locale;
    const meta = $('drawer-rules-meta');
    if (meta) meta.textContent = t('drawers.rulesCount', { count: items.length }, loc);
    const body = $('drawer-rules-body');
    if (!items.length) {
      setDrawerBodyHtml(body, `<p class="empty-hint">${escapeHtml(t('drawers.rulesEmpty', null, loc))}</p>`);
      return;
    }
    const html = `<ul class="drawer-list">${items.map((it) => {
      const path = typeof it === 'string' ? it : (it.path || it.filePath || it.name || t('drawers.ruleFallback', null, loc));
      const rawScope = typeof it === 'object' ? (it.scope || it.source || '') : '';
      const scope = formatScopeLabel(rawScope, loc);
      const tok = typeof it === 'object' ? (Number(it.tokens) || Number(it.estimatedTokens) || 0) : 0;
      const pct = typeof it === 'object' && Number.isFinite(Number(it.percent))
        ? ` (${Number(it.percent).toFixed(1)}%)`
        : '';
      return (
        `<li class="drawer-row">` +
        `<div class="drawer-row-main">` +
        `<span class="drawer-row-title">${escapeHtml(path)}</span>` +
        (scope ? `<span class="drawer-row-sub">${escapeHtml(scope)}</span>` : '') +
        `</div>` +
        `<span class="drawer-row-val">~${escapeHtml(formatTokensEn(tok))}${escapeHtml(pct)}</span>` +
        `</li>`
      );
    }).join('')}</ul>`;
    setDrawerBodyHtml(body, html);
  }

  function renderMcpDrawer(items) {
    const loc = state.locale;
    const meta = $('drawer-mcp-meta');
    if (meta) meta.textContent = t('drawers.mcpCount', { count: items.length }, loc);
    const body = $('drawer-mcp-body');
    if (!items.length) {
      setDrawerBodyHtml(body, `<p class="empty-hint">${escapeHtml(t('drawers.mcpEmpty', null, loc))}</p>`);
      return;
    }
    const html = `<ul class="drawer-list">${items.map((it) => {
      const name = it.name || it.serverName || it.server || 'MCP Server';
      const toolCount = Number(it.toolCount ?? it.toolsCount ?? (Array.isArray(it.tools) ? it.tools.length : 0)) || 0;
      const isLazy = Boolean(it.lazy || it.mode === 'lazy');
      const activeTok = Number(it.tokens) || 0;
      const fallbackTok = Number(it.deferredTokens ?? it.estimatedTokens) || 0;
      const tokLabel = activeTok > 0
        ? `~${formatTokensEn(activeTok)}${Number.isFinite(Number(it.percent)) ? ` (${Number(it.percent).toFixed(1)}%)` : ''}`
        : (isLazy && fallbackTok > 0
            ? t('drawers.mcpLazyVal', { tokens: formatTokensEn(fallbackTok) }, loc)
            : `~${formatTokensEn(fallbackTok)}`);
      const mode = isLazy ? t('drawers.mcpLazyMode', null, loc) : t('drawers.mcpEagerMode', null, loc);
      const scopeTxt = it.scope ? formatScopeLabel(it.scope, loc) : '';
      const subParts = [mode];
      if (scopeTxt) subParts.push(scopeTxt);
      if (toolCount > 0) subParts.push(t('drawers.mcpToolCount', { count: toolCount }, loc));
      return (
        `<li class="drawer-row">` +
        `<div class="drawer-row-main">` +
        `<span class="drawer-row-title">${escapeHtml(name)}</span>` +
        `<span class="drawer-row-sub">${escapeHtml(subParts.join(' · '))}</span>` +
        `</div>` +
        `<span class="drawer-row-val">${escapeHtml(tokLabel)}</span>` +
        `</li>`
      );
    }).join('')}</ul>`;
    setDrawerBodyHtml(body, html);
  }

  function renderSkillsDrawer(items) {
    const loc = state.locale;
    const meta = $('drawer-skills-meta');
    if (meta) meta.textContent = t('drawers.skillsCount', { count: items.length }, loc);
    const body = $('drawer-skills-body');
    if (!items.length) {
      setDrawerBodyHtml(body, `<p class="empty-hint">${escapeHtml(t('drawers.skillsEmpty', null, loc))}</p>`);
      return;
    }
    const html = `<ul class="drawer-list">${items.map((it) => {
      const name = it.name || it.skillName || 'Skill';
      const active = Boolean(it.activated ?? it.isActivated ?? it.loaded);
      const tok = Number(it.tokens) || Number(it.estimatedTokens) || 0;
      const pct = Number.isFinite(Number(it.percent)) && Number(it.percent) > 0
        ? ` (${Number(it.percent).toFixed(1)}%)`
        : '';
      const scopeTxt = it.scope ? formatScopeLabel(it.scope, loc) : '';
      const baseSub = active
        ? `${t('drawers.skillReadBody', null, loc)}${it.path ? ` · ${it.path}` : ''}`
        : t('drawers.skillSummaryOnly', null, loc);
      const sub = scopeTxt ? `${scopeTxt} · ${baseSub}` : baseSub;
      return (
        `<li class="drawer-row">` +
        `<div class="drawer-row-main">` +
        `<span class="drawer-row-title">${escapeHtml(name)} ${active ? `<span class="pill pill-ok">${escapeHtml(t('drawers.skillActivated', null, loc))}</span>` : ''}</span>` +
        `<span class="drawer-row-sub">${escapeHtml(sub)}</span>` +
        `</div>` +
        `<span class="drawer-row-val">~${escapeHtml(formatTokensEn(tok))}${escapeHtml(pct)}</span>` +
        `</li>`
      );
    }).join('')}</ul>`;
    setDrawerBodyHtml(body, html);
  }

  function renderSpikesDrawer(items) {
    const loc = state.locale;
    const meta = $('drawer-spikes-meta');
    if (meta) meta.textContent = t('drawers.spikesCount', { count: items.length }, loc);
    const body = $('drawer-spikes-body');
    if (!items.length) {
      setDrawerBodyHtml(body, `<p class="empty-hint">${escapeHtml(t('drawers.spikesEmpty', null, loc))}</p>`);
      return;
    }
    const html = `<ul class="drawer-list">${items.map((it) => {
      const stepNo = it.stepIndex ?? it.step ?? '—';
      const tool = it.toolName || it.tool || it.name || 'tool_call';
      const summary = it.summary || it.targetPath || it.description || '';
      const delta = Number(it.deltaTokens ?? it.tokens) || 0;
      return (
        `<li class="drawer-row">` +
        `<div class="drawer-row-main">` +
        `<span class="drawer-row-title">Step #${escapeHtml(stepNo)} · <code>${escapeHtml(tool)}</code></span>` +
        (summary ? `<span class="drawer-row-sub">${escapeHtml(summary)}</span>` : '') +
        `</div>` +
        `<span class="drawer-row-val spike-delta">+${escapeHtml(formatTokensEn(delta))}</span>` +
        `</li>`
      );
    }).join('')}</ul>`;
    setDrawerBodyHtml(body, html);
  }

  // ---------- Render Tab 2: 全局总控 / Global Overview ----------
  function renderGlobalView(data, { forceRender = false } = {}) {
    if (!data) return;
    const loc = state.locale;
    const isEn = loc === 'en';
    const m = data.metrics || {};
    const totalTok = Math.max(0, Number(m.totalTokens) || 0);
    const peakTok = Math.max(0, Number(m.peakDailyTokens) || 0);
    const longestMs = Math.max(0, Number(m.longestTaskDurationMs) || 0);
    const longestStreak = Math.max(0, Number(m.longestStreakDays) || 0);
    const currentStreak = Math.max(0, Number(m.currentStreakDays) || 0);

    setTxt('metric-total-tokens', isEn ? formatTokensEn(totalTok) : formatTokensZh(totalTok));
    setTxt(
      'metric-total-tokens-sub',
      t('global.metricTotalSub', { en: formatTokensEn(totalTok), exact: formatExactInt(totalTok) }, loc),
    );
    setAttr(
      'card-total-tokens',
      'title',
      t('global.metricTotalTitle', { exact: formatExactInt(totalTok), en: formatTokensEn(totalTok) }, loc),
    );

    setTxt('metric-peak-daily', isEn ? formatTokensEn(peakTok) : formatTokensZh(peakTok));
    setTxt(
      'metric-peak-date',
      m.peakDailyDate
        ? t('global.metricPeakSubDate', { date: m.peakDailyDate }, loc)
        : t('global.metricPeakSubDefault', null, loc),
    );
    setAttr(
      'card-peak-daily',
      'title',
      t(
        'global.metricPeakTitle',
        { exact: formatExactInt(peakTok), dateSuffix: m.peakDailyDate ? ` (${m.peakDailyDate})` : '' },
        loc,
      ),
    );

    setTxt('metric-longest-task', isEn ? formatDurationShort(longestMs) : formatDurationZh(longestMs));
    setAttr(
      'card-longest-task',
      'title',
      t(
        'global.metricTaskTitle',
        { short: formatDurationShort(longestMs), exact: formatExactInt(longestMs) },
        loc,
      ),
    );

    setTxt(
      'metric-longest-streak',
      isEn ? `${longestStreak} ${longestStreak === 1 ? 'day' : 'days'}` : `${longestStreak} 天`,
    );
    setAttr(
      'card-longest-streak',
      'title',
      t('global.metricLongestStreakTitle', { days: longestStreak }, loc),
    );

    setTxt(
      'metric-current-streak',
      isEn ? `${currentStreak} ${currentStreak === 1 ? 'day' : 'days'}` : `${currentStreak} 天`,
    );
    setAttr(
      'card-current-streak',
      'title',
      t('global.metricCurrentStreakTitle', { days: currentStreak }, loc),
    );

    renderActivityChart({ forceRender });
    renderGlobalTableSection({ forceRender });
  }

  function renderActivityChart({ forceRender = false } = {}) {
    const loc = state.locale;
    const activity = state.globalData?.activity || {};
    const container = $('activity-svg-container');
    const caption = $('activity-range-caption');
    if (!container) return;

    let nextSvg = '';
    if (state.chartView === 'weekly') {
      if (caption) caption.textContent = t('chart.captionWeekly', null, loc);
      nextSvg = renderWeeklyBarSvg(activity.weekly, { activeDateFilter: state.activeDateFilter, locale: loc });
    } else if (state.chartView === 'cumulative') {
      if (caption) caption.textContent = t('chart.captionCumulative', null, loc);
      nextSvg = renderCumulativeAreaSvg(activity.cumulative, { activeDateFilter: state.activeDateFilter, locale: loc });
    } else {
      if (caption) caption.textContent = t('chart.captionDaily', null, loc);
      nextSvg = renderDailyHeatmapSvg(activity.daily, { activeDateFilter: state.activeDateFilter, locale: loc });
    }

    if (forceRender || container._lastSvg !== nextSvg) {
      container.innerHTML = nextSvg;
      container._lastSvg = nextSvg;
    }

    syncDateFilterIndicators();
  }

  function syncDateFilterIndicators() {
    const loc = state.locale;
    const f = state.activeDateFilter;
    const bar = $('chart-filter-bar');
    const barLbl = $('chart-filter-label');
    const chip = $('table-active-date-chip');
    const chipTxt = $('table-date-chip-text');

    if (!f) {
      if (bar) bar.hidden = true;
      if (chip) chip.hidden = true;
      return;
    }

    const desc = f.type === 'day'
      ? t('chart.filterDay', { date: f.date }, loc)
      : t('chart.filterWeek', { start: f.weekStart, end: f.weekEnd }, loc);
    if (bar && barLbl) {
      bar.hidden = false;
      barLbl.textContent = t('chart.filterBarPrefix', { desc }, loc);
    }
    if (chip && chipTxt) {
      chip.hidden = false;
      chipTxt.textContent = desc;
    }
  }

  function resolveNowMs() {
    if (Number.isFinite(Number(win.__AGY_NOW_MS__)) && Number(win.__AGY_NOW_MS__) > 0) {
      return Number(win.__AGY_NOW_MS__);
    }
    if (state.mock) {
      return Date.parse('2026-11-11T16:30:00Z');
    }
    return Date.now();
  }

  function parseDatetimeInputMs(rawValue, isEnd = false) {
    const str = String(rawValue || '').trim();
    if (!str) return null;
    const ms = Date.parse(str);
    if (!Number.isFinite(ms)) return null;
    if (isEnd && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(str)) {
      return ms + 59_999;
    }
    return ms;
  }

  function setDateFilter(nextFilter) {
    // Clicking the same day/week again toggles it off cleanly
    if (
      nextFilter &&
      state.activeDateFilter &&
      nextFilter.type === state.activeDateFilter.type &&
      nextFilter.date === state.activeDateFilter.date &&
      nextFilter.weekStart === state.activeDateFilter.weekStart
    ) {
      state.activeDateFilter = null;
    } else {
      state.activeDateFilter = nextFilter;
    }
    if (state.activeDateFilter) {
      state.timeRangeFilter = { preset: 'all', startMs: null, endMs: null, label: '' };
      if ($('time-start-input')) $('time-start-input').value = '';
      if ($('time-end-input')) $('time-end-input').value = '';
    }
    state.visibleRowsLimit = PAGE_SIZE;
    renderActivityChart({ forceRender: true });
    renderGlobalTableSection({ forceRender: true });
  }

  function setTimeRangeFilter(nextTimeFilter, { showFeedback = true } = {}) {
    const loc = state.locale;
    const preset = String(nextTimeFilter?.preset || 'all');
    const hadDateFilter = Boolean(state.activeDateFilter);
    if (preset !== 'all' && state.activeDateFilter) {
      state.activeDateFilter = null;
    }
    state.timeRangeFilter = {
      preset,
      startMs: nextTimeFilter?.startMs ?? null,
      endMs: nextTimeFilter?.endMs ?? null,
      label: nextTimeFilter?.label || getTimeRangeLabel(preset, loc),
    };
    state.visibleRowsLimit = PAGE_SIZE;
    if (hadDateFilter && !state.activeDateFilter) {
      renderActivityChart({ forceRender: true });
    }
    const stats = renderGlobalTableSection({ forceRender: true });
    if (showFeedback) {
      const desc = state.timeRangeFilter.label || getTimeRangeLabel(preset, loc);
      showToast(t('toast.timeFiltered', { desc, count: stats.filteredRequestsCount }, loc));
    }
    return stats;
  }

  function toggleTimeSortOrder({ showFeedback = true } = {}) {
    state.timeSortOrder = state.timeSortOrder === 'asc' ? 'desc' : 'asc';
    state.visibleRowsLimit = PAGE_SIZE;
    const stats = renderGlobalTableSection({ forceRender: true });
    if (showFeedback) {
      showToast(
        state.timeSortOrder === 'asc'
          ? t('toast.sortAsc', null, state.locale)
          : t('toast.sortDesc', null, state.locale),
      );
    }
    return stats;
  }

  function updateLoadMoreButton(loadMoreBtn, totalCount, shownCount) {
    if (!loadMoreBtn) return;
    const remaining = Math.max(0, totalCount - shownCount);
    if (remaining > 0) {
      loadMoreBtn.hidden = false;
      loadMoreBtn.textContent = t('table.loadMore', { remaining }, state.locale);
    } else {
      loadMoreBtn.hidden = true;
    }
  }

  function renderGlobalTableSection({ forceRender = false } = {}) {
    const loc = state.locale;
    const isEn = loc === 'en';
    const data = state.globalData || {};
    const allRequests = Array.isArray(data.requests) ? data.requests : [];
    const nowMs = resolveNowMs();
    const activePreset = state.timeRangeFilter?.preset || 'all';

    // Sync time preset chips, custom datetime bar, sort button & timeline granularity toggle
    for (const chip of doc.querySelectorAll('.filter-chip[data-time-range]')) {
      const key = chip.dataset.timeRange || 'all';
      const active = key === activePreset;
      chip.textContent = getTimeRangeLabel(key, loc);
      chip.classList.toggle('active', active);
      chip.setAttribute('aria-pressed', active ? 'true' : 'false');
    }
    const customWrap = $('custom-time-inputs');
    if (customWrap) {
      customWrap.hidden = activePreset !== 'custom';
    }
    const sortBtn = $('btn-time-sort');
    if (sortBtn) {
      sortBtn.textContent = state.timeSortOrder === 'asc'
        ? t('time.sortOldest', null, loc)
        : t('time.sortNewest', null, loc);
    }
    const granWrap = $('timeline-granularity-wrap');
    if (granWrap) {
      granWrap.hidden = state.tableSubTab !== 'timeline';
    }
    if ($('btn-granularity-day')) {
      $('btn-granularity-day').setAttribute('aria-selected', state.timelineGranularity === 'day' ? 'true' : 'false');
    }
    if ($('btn-granularity-hour')) {
      $('btn-granularity-hour').setAttribute('aria-selected', state.timelineGranularity === 'hour' ? 'true' : 'false');
    }

    const statusCounts = computeRequestStatusCounts(allRequests, {
      activeDateFilter: state.activeDateFilter,
      timeRangeFilter: state.timeRangeFilter,
      nowMs,
    });

    // Dynamically update status filter chips with live counts & aria-pressed state
    for (const statusKey of ['all', 'normal', 'checkpoint', 'error']) {
      const cnt = statusCounts[statusKey] ?? 0;
      const chipTxt = `${getStatusFilterLabel(statusKey, loc)} (${cnt})`;
      const idChip = $(`statuschip-${statusKey}`);
      if (idChip) {
        const active = statusKey === state.statusFilter;
        idChip.textContent = chipTxt;
        idChip.classList.toggle?.('active', active);
        idChip.setAttribute?.('aria-pressed', active ? 'true' : 'false');
      }
    }
    for (const chip of doc.querySelectorAll('.filter-chip[data-status-filter]')) {
      const key = chip.dataset.statusFilter || 'all';
      const baseLabel = getStatusFilterLabel(key, loc);
      const cnt = statusCounts[key] ?? 0;
      chip.textContent = `${baseLabel} (${cnt})`;
      const active = key === state.statusFilter;
      chip.classList.toggle('active', active);
      chip.setAttribute('aria-pressed', active ? 'true' : 'false');
    }

    const filteredRequests = filterRequests(allRequests, {
      activeDateFilter: state.activeDateFilter,
      statusFilter: state.statusFilter,
      timeRangeFilter: state.timeRangeFilter,
      sortOrder: state.timeSortOrder,
      nowMs,
    });

    const hasActiveFilter =
      Boolean(state.activeDateFilter) ||
      state.statusFilter !== 'all' ||
      activePreset !== 'all';
    const timeBuckets = deriveTimeBuckets(filteredRequests, state.timelineGranularity, {
      sortOrder: state.timeSortOrder,
    });
    const projects = hasActiveFilter || !Array.isArray(data.projectRankings)
      ? deriveProjectRankings(filteredRequests, { locale: loc })
      : data.projectRankings;
    const models = hasActiveFilter || !Array.isArray(data.modelSummary)
      ? deriveModelSummary(filteredRequests)
      : data.modelSummary.map((mRow) => ({
          ...mRow,
          model: formatModelDisplay(mRow?.model),
        }));

    if ($('count-requests')) $('count-requests').textContent = String(filteredRequests.length);
    if ($('count-timeline')) $('count-timeline').textContent = String(timeBuckets.length);
    if ($('count-projects')) $('count-projects').textContent = String(projects.length);
    if ($('count-models')) $('count-models').textContent = String(models.length);

    const statusLabel = getStatusFilterLabel(state.statusFilter, loc);
    const activeTimeDesc = state.timeRangeFilter?.label || getTimeRangeLabel(activePreset, loc);
    const timePrefix = activePreset !== 'all'
      ? (isEn ? `Range: ${activeTimeDesc} · ` : `时段：${activeTimeDesc} · `)
      : '';
    const activeRows = state.tableSubTab === 'timeline'
      ? timeBuckets
      : state.tableSubTab === 'projects'
        ? projects
        : state.tableSubTab === 'models'
          ? models
          : filteredRequests;
    const slice = activeRows.slice(0, state.visibleRowsLimit);

    const summaryEl = $('table-summary-text');
    const loadMoreBtn = $('btn-load-more');
    if (summaryEl) {
      if (isEn) {
        const unitEn = state.tableSubTab === 'timeline'
          ? (state.timelineGranularity === 'hour' ? 'hours' : 'days')
          : state.tableSubTab === 'projects'
            ? 'projects/chats'
            : state.tableSubTab === 'models'
              ? 'models'
              : 'records';
        summaryEl.textContent = activeRows.length > slice.length
          ? `${timePrefix}Filter: ${statusLabel} · Showing ${slice.length} of ${activeRows.length} ${unitEn}`
          : `${timePrefix}Filter: ${statusLabel} · ${activeRows.length} ${unitEn}`;
      } else {
        const unitNoun = state.tableSubTab === 'timeline'
          ? (state.timelineGranularity === 'hour' ? '个小时时段' : '个自然日')
          : state.tableSubTab === 'projects'
            ? '个项目/会话'
            : state.tableSubTab === 'models'
              ? '个模型'
              : '条记录';
        summaryEl.textContent = activeRows.length > slice.length
          ? `${timePrefix}筛选：${statusLabel} · 显示前 ${slice.length} / 共 ${activeRows.length} ${unitNoun}`
          : `${timePrefix}筛选：${statusLabel} · 共 ${activeRows.length} ${unitNoun}`;
      }
    }
    updateLoadMoreButton(loadMoreBtn, activeRows.length, slice.length);

    const thead = $('global-table-head');
    const tbody = $('global-table-body');
    if (!thead || !tbody) {
      return {
        shown: slice.length,
        total: activeRows.length,
        filteredRequestsCount: filteredRequests.length,
        counts: statusCounts,
      };
    }

    const renderSig = JSON.stringify([
      loc,
      state.globalEtag || '',
      allRequests.length,
      allRequests[0]?.id || '',
      filteredRequests.length,
      filteredRequests[0]?.id || '',
      filteredRequests[filteredRequests.length - 1]?.id || '',
      state.tableSubTab,
      state.statusFilter,
      state.activeDateFilter,
      state.timeRangeFilter,
      state.timeSortOrder,
      state.timelineGranularity,
      state.visibleRowsLimit,
    ]);
    if (!forceRender && tbody._lastRenderSig === renderSig) {
      return {
        shown: slice.length,
        total: activeRows.length,
        filteredRequestsCount: filteredRequests.length,
        counts: statusCounts,
      };
    }
    tbody._lastRenderSig = renderSig;

    const sortThTip = isEn ? 'Click to toggle sort order' : '点击切换时间正序/倒序';
    const renderTotalTokensCell = (tokVal, colLabel) => {
      const zhSuffix = isEn ? '' : ` <span class="muted-num">(${escapeHtml(formatTokensZh(tokVal))})</span>`;
      return `<td class="num-col" data-label="${escapeHtml(colLabel)}" title="${escapeHtml(formatExactInt(tokVal))}"><strong>${escapeHtml(formatTokensEn(tokVal))}</strong>${zhSuffix}</td>`;
    };

    if (state.tableSubTab === 'timeline') {
      const sortArrow = state.timeSortOrder === 'asc' ? '↑' : '↓';
      const cPeriod = isEn ? 'Period' : '时间段';
      const cCalls = isEn ? 'Calls' : '调用次数';
      const cTotal = isEn ? 'Total Tokens' : '总吞吐 Token';
      const cInput = isEn ? 'Input' : '新增输入';
      const cOutput = isEn ? 'Output' : '总输出';
      const cAvgCache = isEn ? 'Avg Cache' : '平均缓存率';
      const cAvgSpeed = isEn ? 'Avg Speed' : '平均流速';
      const headHtml = (
        `<tr>` +
        `<th class="sortable-th" data-sort-time="1" title="${escapeHtml(sortThTip)}">${escapeHtml(cPeriod)} ${sortArrow}</th>` +
        `<th class="num-col">${escapeHtml(cCalls)}</th>` +
        `<th class="num-col">${escapeHtml(cTotal)}</th>` +
        `<th class="num-col">${escapeHtml(cInput)}</th>` +
        `<th class="num-col">${escapeHtml(cOutput)}</th>` +
        `<th class="num-col">${escapeHtml(cAvgCache)}</th>` +
        `<th class="num-col">${escapeHtml(cAvgSpeed)}</th>` +
        `</tr>`
      );
      if (thead._lastHtml !== headHtml) {
        thead.innerHTML = headHtml;
        thead._lastHtml = headHtml;
      }
      tbody._timelineBuckets = slice;
      const emptyTimeline = isEn
        ? 'No request logs match the current filters for timeline aggregation.'
        : '当前筛选条件下暂无可按时间聚合的调用日志。';
      tbody.innerHTML = slice.length
        ? slice.map((b, idx) => {
            const hitPct = normalizeCacheHitPercent(b.avgCacheHitRate);
            const rowTip = isEn
              ? `Click to view request logs for ${b.label}`
              : `点击下钻查看 ${b.label} 的请求日志`;
            const btnTip = isEn
              ? `View request logs for ${b.label}`
              : `点击查看 ${b.label} 的请求日志`;
            return (
              `<tr class="timeline-bucket-row" data-timeline-bucket="${idx}" title="${escapeHtml(rowTip)}">` +
              `<td data-label="${escapeHtml(cPeriod)}">` +
              `<button type="button" class="timeline-bucket-btn" data-timeline-bucket="${idx}" title="${escapeHtml(btnTip)}">${escapeHtml(b.label)} →</button>` +
              `</td>` +
              `<td class="num-col" data-label="${escapeHtml(cCalls)}">${formatExactInt(b.requestCount)}</td>` +
              renderTotalTokensCell(b.totalTokens, cTotal) +
              `<td class="num-col" data-label="${escapeHtml(cInput)}">${escapeHtml(formatTokensEn(b.inputTokens))}</td>` +
              `<td class="num-col" data-label="${escapeHtml(cOutput)}">${escapeHtml(formatTokensEn(b.outputTokens))}</td>` +
              `<td class="num-col" data-label="${escapeHtml(cAvgCache)}"><span class="pill pill-cache">${escapeHtml(formatPercent(hitPct))}</span></td>` +
              `<td class="num-col" data-label="${escapeHtml(cAvgSpeed)}">${escapeHtml(formatSpeed(b.avgTokensPerSec))}</td>` +
              `</tr>`
            );
          }).join('')
        : `<tr><td colspan="7" class="empty-hint">${escapeHtml(emptyTimeline)}</td></tr>`;
      return {
        shown: slice.length,
        total: timeBuckets.length,
        filteredRequestsCount: filteredRequests.length,
        counts: statusCounts,
      };
    }

    if (state.tableSubTab === 'projects') {
      const cProj = isEn ? 'Project / Chat' : '项目/对话';
      const cClient = isEn ? 'Client' : '应用';
      const cCalls = isEn ? 'Calls' : '调用次数';
      const cTotal = isEn ? 'Total Tokens' : '总吞吐 Token';
      const cOutput = isEn ? 'Output' : '总输出';
      const cCache = isEn ? 'Cache' : '缓存率';
      const cSpeed = isEn ? 'Speed' : '流速';
      const cLast = isEn ? 'Last Active' : '最近活跃';
      const headHtml = (
        `<tr>` +
        `<th>${escapeHtml(cProj)}</th>` +
        `<th>${escapeHtml(cClient)}</th>` +
        `<th class="num-col">${escapeHtml(cCalls)}</th>` +
        `<th class="num-col">${escapeHtml(cTotal)}</th>` +
        `<th class="num-col">${escapeHtml(cOutput)}</th>` +
        `<th class="num-col">${escapeHtml(cCache)}</th>` +
        `<th class="num-col">${escapeHtml(cSpeed)}</th>` +
        `<th>${escapeHtml(cLast)}</th>` +
        `</tr>`
      );
      if (thead._lastHtml !== headHtml) {
        thead.innerHTML = headHtml;
        thead._lastHtml = headHtml;
      }
      const emptyProj = isEn
        ? 'No projects or conversations match the current filters.'
        : '暂无匹配筛选条件的项目或对话记录。';
      tbody.innerHTML = slice.length
        ? slice.map((p, idx) => {
            const hitPct = normalizeCacheHitPercent(p.avgCacheHitRate);
            const title = localizeSessionTitle(p.title, {
              fallbackZh: p.conversationId || '未命名对话',
              fallbackEn: p.conversationId || 'Untitled Chat',
              locale: loc,
            });
            const proj = p.project ? localizeProject(p.project, loc) : '';
            const surf = localizeSurface(p.surface || 'Desktop', {
              fallbackZh: 'Desktop',
              fallbackEn: 'Desktop',
              locale: loc,
            });
            const fullTip = proj && proj !== title ? `${proj} · ${title}` : title;
            return (
              `<tr>` +
              `<td data-label="${escapeHtml(cProj)}">` +
              `<button type="button" class="conv-link-btn" data-conv-jump="${idx}" data-jump-source="projects" title="${escapeHtml(fullTip)}">` +
              (proj && proj !== title ? `<span class="conv-link-project">${escapeHtml(proj)} · </span>` : '') +
              `<span class="conv-link-title">${escapeHtml(title)}</span>` +
              `</button></td>` +
              `<td data-label="${escapeHtml(cClient)}"><span class="pill pill-subtle">${escapeHtml(surf)}</span></td>` +
              `<td class="num-col" data-label="${escapeHtml(cCalls)}">${formatExactInt(p.requestCount)}</td>` +
              renderTotalTokensCell(p.totalTokens, cTotal) +
              `<td class="num-col" data-label="${escapeHtml(cOutput)}">${escapeHtml(formatTokensEn(p.outputTokens))}</td>` +
              `<td class="num-col" data-label="${escapeHtml(cCache)}"><span class="pill pill-cache">${escapeHtml(formatPercent(hitPct))}</span></td>` +
              `<td class="num-col" data-label="${escapeHtml(cSpeed)}">${escapeHtml(formatSpeed(p.avgTokensPerSec))}</td>` +
              `<td data-label="${escapeHtml(cLast)}">${escapeHtml(formatLocalTime(p.lastActiveAt))}</td>` +
              `</tr>`
            );
          }).join('')
        : `<tr><td colspan="8" class="empty-hint">${escapeHtml(emptyProj)}</td></tr>`;
      tbody._jumpItems = slice;
      return {
        shown: slice.length,
        total: projects.length,
        filteredRequestsCount: filteredRequests.length,
        counts: statusCounts,
      };
    }

    if (state.tableSubTab === 'models') {
      const cModel = isEn ? 'Model' : '模型';
      const cCalls = isEn ? 'Calls' : '调用次数';
      const cTotal = isEn ? 'Total Tokens' : '总吞吐 Token';
      const cOutput = isEn ? 'Output' : '总输出';
      const cAvgCache = isEn ? 'Avg Cache' : '平均缓存率';
      const cSpeed = isEn ? 'Speed' : '流速';
      const headHtml = (
        `<tr>` +
        `<th>${escapeHtml(cModel)}</th>` +
        `<th class="num-col">${escapeHtml(cCalls)}</th>` +
        `<th class="num-col">${escapeHtml(cTotal)}</th>` +
        `<th class="num-col">${escapeHtml(cOutput)}</th>` +
        `<th class="num-col">${escapeHtml(cAvgCache)}</th>` +
        `<th class="num-col">${escapeHtml(cSpeed)}</th>` +
        `</tr>`
      );
      if (thead._lastHtml !== headHtml) {
        thead.innerHTML = headHtml;
        thead._lastHtml = headHtml;
      }
      const emptyModels = isEn
        ? 'No model summaries match the current filters.'
        : '暂无匹配筛选条件的模型汇总数据。';
      tbody.innerHTML = slice.length
        ? slice.map((mRow) => {
            const hitPct = normalizeCacheHitPercent(mRow.avgCacheHitRate);
            return (
              `<tr>` +
              `<td data-label="${escapeHtml(cModel)}"><code>${escapeHtml(formatModelDisplay(mRow.model))}</code></td>` +
              `<td class="num-col" data-label="${escapeHtml(cCalls)}">${formatExactInt(mRow.requestCount)}</td>` +
              renderTotalTokensCell(mRow.totalTokens, cTotal) +
              `<td class="num-col" data-label="${escapeHtml(cOutput)}">${escapeHtml(formatTokensEn(mRow.outputTokens))}</td>` +
              `<td class="num-col" data-label="${escapeHtml(cAvgCache)}"><span class="pill pill-cache">${escapeHtml(formatPercent(hitPct))}</span></td>` +
              `<td class="num-col" data-label="${escapeHtml(cSpeed)}">${escapeHtml(formatSpeed(mRow.avgTokensPerSec))}</td>` +
              `</tr>`
            );
          }).join('')
        : `<tr><td colspan="6" class="empty-hint">${escapeHtml(emptyModels)}</td></tr>`;
      return {
        shown: slice.length,
        total: models.length,
        filteredRequestsCount: filteredRequests.length,
        counts: statusCounts,
      };
    }

    // Default sub-tab: 请求日志 / Requests (10 compact horizontal AGY columns)
    const reqSortArrow = state.timeSortOrder === 'asc' ? '↑' : '↓';
    const cTime = isEn ? 'Time' : '时间';
    const cClient = isEn ? 'Client' : '应用';
    const cProj = isEn ? 'Project / Chat' : '项目/对话';
    const cModel = isEn ? 'Model' : '模型';
    const cCtx = isEn ? 'Context / Cache' : '上下文/缓存率';
    const cInput = isEn ? 'Input' : '输入';
    const cOutput = isEn ? 'Output' : '输出';
    const cCacheHit = isEn ? 'Cache Read' : '缓存命中';
    const cSpeed = isEn ? 'Speed' : '流速';
    const cDuration = isEn ? 'Duration' : '耗时';
    const headHtml = (
      `<tr>` +
      `<th class="sortable-th" data-sort-time="1" title="${escapeHtml(sortThTip)}">${escapeHtml(cTime)} ${reqSortArrow}</th>` +
      `<th>${escapeHtml(cClient)}</th>` +
      `<th>${escapeHtml(cProj)}</th>` +
      `<th>${escapeHtml(cModel)}</th>` +
      `<th class="num-col">${escapeHtml(cCtx)}</th>` +
      `<th class="num-col">${escapeHtml(cInput)}</th>` +
      `<th class="num-col">${escapeHtml(cOutput)}</th>` +
      `<th class="num-col">${escapeHtml(cCacheHit)}</th>` +
      `<th class="num-col">${escapeHtml(cSpeed)}</th>` +
      `<th class="num-col">${escapeHtml(cDuration)}</th>` +
      `</tr>`
    );
    if (thead._lastHtml !== headHtml) {
      thead.innerHTML = headHtml;
      thead._lastHtml = headHtml;
    }

    tbody._jumpItems = slice;

    if (!slice.length) {
      const emptyReqs = isEn
        ? 'No request logs match the current filters.'
        : '当前筛选条件下暂无匹配的请求日志。';
      tbody.innerHTML = `<tr><td colspan="10" class="empty-hint">${escapeHtml(emptyReqs)}</td></tr>`;
      return {
        shown: 0,
        total: 0,
        filteredRequestsCount: 0,
        counts: statusCounts,
      };
    }

    const cpPillTip = isEn ? 'Auto-compaction checkpoint step' : '自动上下文压缩步骤';
    const errPillTip = isEn ? 'Request error' : '调用异常';
    const errPillText = isEn ? 'ERROR' : '报错';
    const preCpPrefix = isEn ? 'Pre-compact: ' : '压缩前规模: ';

    tbody.innerHTML = slice.map((r, idx) => {
      const normStatus = normalizeRequestStatus(r.status);
      const hitPct = normalizeCacheHitPercent(r.cacheHitRate, r.inputTokens, r.cacheReadTokens);
      const statusBadge = normStatus === 'checkpoint'
        ? ` <span class="pill pill-warn" title="${escapeHtml(cpPillTip)}">CHECKPOINT</span>`
        : normStatus === 'error'
          ? ` <span class="pill pill-danger" title="${escapeHtml(errPillTip)}">${escapeHtml(errPillText)}</span>`
          : '';
      const preCp = Number(r.preCheckpointContextTokens) || 0;
      const preCpHtml = (normStatus === 'checkpoint' && preCp > 0)
        ? `<span class="pre-cp-note">${escapeHtml(preCpPrefix)}${escapeHtml(formatTokensEn(preCp))}</span>`
        : '';
      const convTitle = localizeSessionTitle(r.conversationTitle, {
        fallbackZh: r.conversationId || '未命名会话',
        fallbackEn: r.conversationId || 'Untitled Session',
        locale: loc,
      });
      const rawProj = r.project || r.workspace || '';
      const proj = rawProj
        ? (rawProj === '未绑定工作区' ? localizeWorkspace(rawProj, loc) : localizeProject(rawProj, loc))
        : '';
      const surf = localizeSurface(r.surface || 'Desktop', {
        fallbackZh: 'Desktop',
        fallbackEn: 'Desktop',
        locale: loc,
      });
      const fullConvTip = proj && proj !== convTitle ? `${proj} · ${convTitle}` : convTitle;

      return (
        `<tr data-row-status="${normStatus}">` +
        `<td data-label="${escapeHtml(cTime)}" title="${escapeHtml(r.isoTime || '')}">${escapeHtml(formatLocalTime(r.timestamp ?? r.isoTime))} <span class="muted-num">#${escapeHtml(r.stepIndex ?? '—')}</span></td>` +
        `<td data-label="${escapeHtml(cClient)}"><span class="pill ${r.isLocalSide ? 'pill-accent' : 'pill-subtle'}">${escapeHtml(surf)}</span></td>` +
        `<td data-label="${escapeHtml(cProj)}">` +
        `<button type="button" class="conv-link-btn" data-conv-jump="${idx}" data-jump-source="requests" title="${escapeHtml(fullConvTip)}">` +
        (proj && proj !== convTitle ? `<span class="conv-link-project">${escapeHtml(proj)} · </span>` : '') +
        `<span class="conv-link-title">${escapeHtml(convTitle)}</span>` +
        `</button></td>` +
        `<td data-label="${escapeHtml(cModel)}"><code>${escapeHtml(formatModelDisplay(r.model))}</code>${statusBadge}</td>` +
        `<td class="num-col" data-label="${escapeHtml(cCtx)}">` +
        `<div class="ctx-cell-stack">` +
        `<span><strong>${escapeHtml(formatTokensEn(r.contextTokens))}</strong> <span class="pill pill-cache">${escapeHtml(formatPercent(hitPct))}</span></span>` +
        preCpHtml +
        `</div></td>` +
        `<td class="num-col" data-label="${escapeHtml(cInput)}">${escapeHtml(formatTokensEn(r.inputTokens))}</td>` +
        `<td class="num-col" data-label="${escapeHtml(cOutput)}">${escapeHtml(formatTokensEn(r.outputTokens))}</td>` +
        `<td class="num-col" data-label="${escapeHtml(cCacheHit)}">${escapeHtml(formatTokensEn(r.cacheReadTokens))}</td>` +
        `<td class="num-col" data-label="${escapeHtml(cSpeed)}">${escapeHtml(formatSpeed(r.tokensPerSec))}</td>` +
        `<td class="num-col" data-label="${escapeHtml(cDuration)}">${escapeHtml(formatDurationShort(r.durationMs))}</td>` +
        `</tr>`
      );
    }).join('');

    return {
      shown: slice.length,
      total: filteredRequests.length,
      filteredRequestsCount: filteredRequests.length,
      counts: statusCounts,
    };
  }

  // ---------- Clipboard, Manual Refresh & Fullscreen Launcher ----------
  async function copyTextToClipboard(text, inputEl = null) {
    if (!text) return false;
    try {
      if (win.navigator?.clipboard?.writeText) {
        await win.navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      // Fall back to execCommand('copy') when clipboard-write permission is restricted in iframes
    }
    try {
      if (inputEl && typeof inputEl.select === 'function' && typeof doc.execCommand === 'function') {
        inputEl.focus?.();
        inputEl.select();
        return Boolean(doc.execCommand('copy'));
      }
      if (typeof doc.createElement === 'function' && typeof doc.execCommand === 'function') {
        const ta = doc.createElement('textarea');
        ta.value = text;
        ta.setAttribute?.('readonly', '');
        if (ta.style) ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
        doc.body?.appendChild?.(ta);
        ta.select?.();
        const ok = Boolean(doc.execCommand('copy'));
        ta.remove?.();
        return ok;
      }
    } catch {
      // Ignore
    }
    return false;
  }

  async function manualRefresh({ source = 'refresh-btn' } = {}) {
    const refreshBtn = $('btn-refresh');
    const startedAt = Date.now();
    if (refreshBtn) {
      refreshBtn.classList.add('is-spinning');
    }
    const ok = await refreshActiveData({ force: true });
    const remainMs = Math.max(0, 380 - (Date.now() - startedAt));
    if (state.spinTimer) clearTimeout(state.spinTimer);
    state.spinTimer = setTimeout(() => {
      refreshBtn?.classList.remove('is-spinning');
    }, remainMs);
    state.spinTimer?.unref?.();

    if (ok) {
      if (source === 'sync-status') {
        showToast(t('toast.syncOk', null, state.locale));
      } else {
        showToast(t('toast.refreshed', null, state.locale));
      }
    }
    return ok;
  }

  async function openFullscreenDashboard() {
    const loc = state.locale;
    const token = getResolvedToken();
    const relUrl = buildFullscreenUrl(win.location?.search || '', token, state.explicitLang);
    const baseHref =
      win.location?.href ||
      (win.location?.origin ? `${win.location.origin}/` : 'http://127.0.0.1/');
    const fullUrl = new URL(relUrl, baseHref).href;

    const urlBar = $('fullscreen-url-bar');
    const urlInput = $('fullscreen-url-input');
    const urlLink = $('link-open-fullscreen');
    if (urlInput) urlInput.value = fullUrl;
    if (urlLink) {
      urlLink.href = fullUrl;
      urlLink.setAttribute?.('href', fullUrl);
    }
    if (urlBar) urlBar.hidden = false;

    const copied = await copyTextToClipboard(fullUrl, urlInput);

    // In a standalone browser (not nested inside sandboxed Aux Pane iframe), also call window.open
    const isTopWindow = !win.top || win === win.top;
    if (isTopWindow && typeof win.open === 'function') {
      win.open(fullUrl, '_blank');
    }

    let backendOpened = false;
    if (!state.mock) {
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['X-Sidecar-Token'] = token;
      const endpoint = token
        ? `/api/open-fullscreen?token=${encodeURIComponent(token)}`
        : '/api/open-fullscreen';
      const clientOrigin =
        win.location?.origin ||
        (win.location?.href ? new URL(win.location.href).origin : '');
      try {
        const fetcher = getApiFetcher();
        const res = await fetcher(endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify(state.explicitLang ? { clientOrigin, lang: state.explicitLang } : { clientOrigin }),
        });
        if (res?.ok) {
          const payload = await res.json();
          backendOpened = Boolean(payload?.opened);
        }
      } catch {
        // Inline URL bar + clipboard fallback already visible
      }
    }

    if (backendOpened) {
      showToast(copied ? t('toast.fsOpenedCopied', null, loc) : t('toast.fsOpened', null, loc));
    } else if (copied) {
      showToast(t('toast.fsCopied', null, loc));
    } else {
      showToast(t('toast.fsBarShown', null, loc));
    }
  }

  // ---------- Conversation Click / Cross-Side Fallback ----------
  function renderFallbackSessionCard(item) {
    const loc = state.locale;
    const decision = decideConversationAction(item, { sidecar: win.sidecar, locale: loc });
    const card = $('session-fallback-card');
    if (card) {
      card.hidden = false;
      setTxt('fallback-surface-pill', decision.surface);
      setTxt('fallback-conv-title', decision.title);
      setTxt('fallback-reason', decision.reason);
      const rawWs = item?.workspace || item?.project || '';
      const wsDisplay = rawWs
        ? (rawWs === '未绑定工作区'
            ? localizeWorkspace(rawWs, loc)
            : (rawWs === '未关联项目' ? localizeProject(rawWs, loc) : rawWs))
        : '—';
      const grid = $('fallback-meta-grid');
      if (grid) {
        grid.innerHTML = [
          [t('fallback.keyId', null, loc), item?.conversationId || '—'],
          [t('fallback.keySurface', null, loc), decision.surface],
          [t('fallback.keyWorkspace', null, loc), wsDisplay],
          [t('fallback.keyModel', null, loc), formatModelDisplay(item?.model)],
        ]
          .map(([k, v]) => `<div class="fallback-kv"><div class="meta-key">${escapeHtml(k)}</div><div><code>${escapeHtml(v)}</code></div></div>`)
          .join('');
      }
    }
    return decision;
  }

  function handleConversationJump(item) {
    const decision = decideConversationAction(item, { sidecar: win.sidecar, locale: state.locale });
    if (decision.mode === 'host-switch') {
      win.sidecar.ui.toggleConversation(decision.conversationId);
      showToast(decision.reason);
      return;
    }

    state.fallbackTarget = item;
    renderFallbackSessionCard(item);
    showToast(t('fallback.toastOpened', { surface: decision.surface }, state.locale));
  }

  // ---------- Pointer Interaction Guard (Defer 2.8s Poll During Clicks) ----------
  function releasePointerGuard() {
    if (!state.isPointerDown) return;
    state.isPointerDown = false;
    const pending = state.pendingPollRender;
    state.pendingPollRender = null;
    if (pending === 'conversation' && state.convData) {
      renderConversationView(state.convData);
    } else if (pending === 'global' && state.globalData) {
      renderGlobalView(state.globalData);
    }
  }

  doc.addEventListener('pointerdown', () => {
    state.isPointerDown = true;
  });
  doc.addEventListener('pointerup', releasePointerGuard);
  doc.addEventListener('pointercancel', releasePointerGuard);
  win.addEventListener?.('blur', releasePointerGuard);

  // ---------- Event Wiring ----------
  doc.addEventListener('click', (e) => {
    const target = resolveEventElement(e);
    if (!target) return;

    // Language toggle button (#btn-lang-toggle)
    const langToggleBtn = target.closest('#btn-lang-toggle');
    if (langToggleBtn) {
      const nextLoc = state.locale === 'en' ? 'zh' : 'en';
      setAppLocale(nextLoc, { persist: true, showFeedback: true });
      return;
    }

    // Fullscreen button (#btn-fullscreen-header & #btn-fullscreen-global)
    const fsBtn = target.closest('[data-action="open-fullscreen"]');
    if (fsBtn) {
      openFullscreenDashboard();
      return;
    }

    // Header sync indicator (#sync-status)
    const syncBtn = target.closest('#sync-status');
    if (syncBtn) {
      manualRefresh({ source: 'sync-status' });
      return;
    }

    // Header manual refresh button (#btn-refresh)
    const refreshBtn = target.closest('#btn-refresh');
    if (refreshBtn) {
      manualRefresh({ source: 'refresh-btn' });
      return;
    }

    // Fullscreen inline bar copy & close controls
    const copyFsBtn = target.closest('#btn-copy-fullscreen-url');
    if (copyFsBtn) {
      const inputEl = $('fullscreen-url-input');
      copyTextToClipboard(inputEl?.value || '', inputEl).then((ok) => {
        showToast(ok ? t('toast.urlCopied', null, state.locale) : t('toast.urlManualCopy', null, state.locale));
      });
      return;
    }
    const closeFsBtn = target.closest('#btn-close-fullscreen-bar');
    if (closeFsBtn) {
      const bar = $('fullscreen-url-bar');
      if (bar) bar.hidden = true;
      return;
    }

    // Primary tabs
    const primaryTab = target.closest('.primary-tab[data-tab]');
    if (primaryTab) {
      setPrimaryTab(primaryTab.dataset.tab);
      return;
    }

    // Subagent row click -> drill directly into child conversation's window & drawers
    const subRowBtn = target.closest('.subagent-row-btn[data-subagent-id]');
    if (subRowBtn) {
      const subId = subRowBtn.getAttribute('data-subagent-id') || subRowBtn.dataset?.subagentId || '';
      const subRole = subRowBtn.getAttribute('data-subagent-role') || subRowBtn.dataset?.subagentRole || '';
      const subCap =
        subRowBtn.getAttribute('data-subagent-cap') ||
        subRowBtn.dataset?.subagentCap ||
        formatWindowCap(state.convData?.contextWindow?.limit || CONTEXT_LIMIT);
      if (subId) {
        inspectSubagentConversation(subId, {
          toastMsg: subRole
            ? t('toast.drilledSubRole', { role: subRole, cap: subCap }, state.locale)
            : t('toast.drilledSub', null, state.locale),
        });
      }
      return;
    }

    // Drilldown breadcrumb: return to root main conversation
    const backRootBtn = target.closest('#btn-back-root-conv');
    if (backRootBtn) {
      const rootId =
        backRootBtn.dataset?.targetConvId ||
        backRootBtn.getAttribute?.('data-target-conv-id') ||
        state.convData?.rootConversationId ||
        state.convData?.ancestors?.[0]?.conversationId ||
        state.convData?.parentConversationId ||
        '';
      if (rootId) {
        inspectSubagentConversation(rootId, { toastMsg: t('toast.backToMain', null, state.locale) });
      }
      return;
    }

    // Drilldown sibling worker pills & intermediate ancestor buttons
    const drillNode = target.closest('[data-drill-conv-id]');
    if (drillNode) {
      const nextId = drillNode.getAttribute('data-drill-conv-id') || drillNode.dataset?.drillConvId || '';
      if (nextId && nextId !== state.conversationId) {
        const rootId = state.convData?.rootConversationId || state.convData?.ancestors?.[0]?.conversationId || '';
        const fallbackLabel = state.locale === 'en' ? 'subagent' : '子智能体';
        inspectSubagentConversation(nextId, {
          toastMsg: nextId === rootId
            ? t('toast.backToMain', null, state.locale)
            : t('toast.switchedWorker', { label: drillNode.textContent?.trim() || fallbackLabel }, state.locale),
        });
      }
      return;
    }

    // Drilldown: open inspected subagent conversation in host window
    const openSubHostBtn = target.closest('#btn-open-subagent-host');
    if (openSubHostBtn) {
      const cid = state.convData?.conversationId || state.conversationId || '';
      if (cid && state.convData?.isLocalSide && win.sidecar?.ui && typeof win.sidecar.ui.toggleConversation === 'function') {
        win.sidecar.ui.toggleConversation(cid);
        showToast(t('toast.openedInHost', null, state.locale));
      }
      return;
    }

    // Chart view switcher
    const chartBtn = target.closest('.seg-btn[data-chart-view]');
    if (chartBtn) {
      state.chartView = chartBtn.dataset.chartView;
      activateTablistGroup(chartBtn.parentElement, chartBtn);
      renderActivityChart({ forceRender: true });
      return;
    }

    // SVG chart day / week click -> filter table
    const chartNode = target.closest('[data-chart-kind]');
    if (chartNode) {
      const kind = chartNode.getAttribute('data-chart-kind');
      if (kind === 'day') {
        const date = chartNode.getAttribute('data-date');
        if (date) setDateFilter({ type: 'day', date });
      } else if (kind === 'week') {
        const weekStart = chartNode.getAttribute('data-week-start');
        const weekEnd = chartNode.getAttribute('data-week-end');
        const label = chartNode.getAttribute('data-label') || weekStart;
        if (weekStart && weekEnd) setDateFilter({ type: 'week', weekStart, weekEnd, label });
      }
      return;
    }

    // Table sub-tabs
    const subTab = target.closest('.sub-tab[data-table-tab]');
    if (subTab) {
      state.tableSubTab = subTab.dataset.tableTab;
      state.visibleRowsLimit = PAGE_SIZE;
      activateTablistGroup(subTab.parentElement, subTab);
      renderGlobalTableSection({ forceRender: true });
      return;
    }

    // Time range quick preset chips
    const timeChip = target.closest('.filter-chip[data-time-range]');
    if (timeChip) {
      const preset = timeChip.dataset.timeRange || 'all';
      if (preset === 'custom') {
        const startMs = parseDatetimeInputMs($('time-start-input')?.value, false);
        const endMs = parseDatetimeInputMs($('time-end-input')?.value, true);
        setTimeRangeFilter({ preset: 'custom', startMs, endMs, label: getTimeRangeLabel('custom', state.locale) });
      } else {
        if ($('time-start-input')) $('time-start-input').value = '';
        if ($('time-end-input')) $('time-end-input').value = '';
        setTimeRangeFilter({ preset, startMs: null, endMs: null, label: getTimeRangeLabel(preset, state.locale) });
      }
      return;
    }

    // Reset custom time range button
    const resetTimeBtn = target.closest('#btn-reset-time-range');
    if (resetTimeBtn) {
      if ($('time-start-input')) $('time-start-input').value = '';
      if ($('time-end-input')) $('time-end-input').value = '';
      setTimeRangeFilter({ preset: 'all', startMs: null, endMs: null, label: getTimeRangeLabel('all', state.locale) });
      return;
    }

    // Time sort order button (#btn-time-sort) or clickable table header (<th data-sort-time>)
    const sortTrigger = target.closest('#btn-time-sort') || target.closest('[data-sort-time]');
    if (sortTrigger) {
      toggleTimeSortOrder();
      return;
    }

    // Timeline aggregation granularity switch (day / hour)
    const granBtn = target.closest('[data-timeline-granularity]');
    if (granBtn) {
      state.timelineGranularity = granBtn.getAttribute('data-timeline-granularity') === 'hour' ? 'hour' : 'day';
      state.visibleRowsLimit = PAGE_SIZE;
      renderGlobalTableSection({ forceRender: true });
      showToast(
        state.timelineGranularity === 'hour'
          ? t('toast.granHour', null, state.locale)
          : t('toast.granDay', null, state.locale),
      );
      return;
    }

    // Timeline bucket drilldown -> sets custom time window & switches straight to 请求日志 / Requests
    const bucketNode = target.closest('[data-timeline-bucket]');
    if (bucketNode) {
      const idx = Number(bucketNode.getAttribute('data-timeline-bucket'));
      const bucket = $('global-table-body')?._timelineBuckets?.[idx];
      if (bucket) {
        if ($('time-start-input')) $('time-start-input').value = toDatetimeLocalInputValue(bucket.startMs);
        if ($('time-end-input')) $('time-end-input').value = toDatetimeLocalInputValue(bucket.endMs);
        state.activeDateFilter = null;
        state.timeRangeFilter = {
          preset: 'custom',
          startMs: bucket.startMs,
          endMs: bucket.endMs,
          label: bucket.label,
        };
        state.tableSubTab = 'requests';
        state.visibleRowsLimit = PAGE_SIZE;
        const reqSubTab = $('subtab-requests');
        activateTablistGroup(reqSubTab?.parentElement, reqSubTab);
        renderActivityChart({ forceRender: true });
        const stats = renderGlobalTableSection({ forceRender: true });
        showToast(
          t(
            'toast.bucketDrilled',
            { label: bucket.label, count: stats.filteredRequestsCount },
            state.locale,
          ),
        );
      }
      return;
    }

    // Status filter pills
    const statusChip = target.closest('.filter-chip[data-status-filter]');
    if (statusChip) {
      state.statusFilter = statusChip.dataset.statusFilter || 'all';
      state.visibleRowsLimit = PAGE_SIZE;
      const stats = renderGlobalTableSection({ forceRender: true });
      const statusLabel = getStatusFilterLabel(state.statusFilter, state.locale);
      showToast(
        t(
          'toast.statusFiltered',
          { label: statusLabel, count: stats.filteredRequestsCount },
          state.locale,
        ),
      );
      return;
    }

    // Load more pagination button
    const loadMoreBtn = target.closest('#btn-load-more');
    if (loadMoreBtn) {
      state.visibleRowsLimit += PAGE_SIZE;
      const stats = renderGlobalTableSection({ forceRender: true });
      showToast(
        t('toast.loadedMore', { shown: stats.shown, total: stats.total }, state.locale),
      );
      return;
    }

    // Scroll back to top button
    const scrollTopBtn = target.closest('#btn-scroll-top');
    if (scrollTopBtn) {
      if (typeof win.scrollTo === 'function') {
        win.scrollTo({ top: 0, behavior: 'smooth' });
      } else if (doc.documentElement) {
        doc.documentElement.scrollTop = 0;
      }
      return;
    }

    // Conversation jump link inside table
    const jumpBtn = target.closest('[data-conv-jump]');
    if (jumpBtn) {
      const idx = Number(jumpBtn.getAttribute('data-conv-jump'));
      const tbody = $('global-table-body');
      const item = tbody?._jumpItems?.[idx];
      if (item) handleConversationJump(item);
    }
  });

  // Keyboard Enter/Space on SVG chart elements
  $('activity-svg-container')?.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const node = resolveEventElement(e)?.closest('[data-chart-kind]');
    if (!node) return;
    e.preventDefault();
    node.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  });

  // Hover & focus tooltip on SVG chart stage
  const stage = $('svg-chart-stage');
  const tooltipEl = $('chart-tooltip');
  function showChartTooltip(node, clientX, clientY) {
    if (!stage || !tooltipEl) return;
    const tip = node?.getAttribute?.('data-tooltip');
    if (!tip) {
      tooltipEl.hidden = true;
      return;
    }
    tooltipEl.textContent = tip;
    tooltipEl.hidden = false;
    const rect = stage.getBoundingClientRect();
    const relX = Math.max(8, Math.min(rect.width - 210, (clientX || rect.left + 40) - rect.left + 10));
    const relY = Math.max(4, (clientY || rect.top + 24) - rect.top - 34);
    tooltipEl.style.left = `${relX}px`;
    tooltipEl.style.top = `${relY}px`;
  }

  stage?.addEventListener('pointermove', (e) => {
    const node = resolveEventElement(e)?.closest('[data-tooltip]') || null;
    if (!node) {
      if (tooltipEl) tooltipEl.hidden = true;
      return;
    }
    showChartTooltip(node, e.clientX, e.clientY);
  });
  stage?.addEventListener('pointerleave', () => {
    if (tooltipEl) tooltipEl.hidden = true;
  });
  stage?.addEventListener('focusin', (e) => {
    const node = resolveEventElement(e)?.closest('[data-tooltip]') || null;
    if (node) {
      const r = node.getBoundingClientRect();
      showChartTooltip(node, r.left, r.top);
    }
  });
  stage?.addEventListener('focusout', () => {
    if (tooltipEl) tooltipEl.hidden = true;
  });

  // Clear date filter buttons
  $('btn-clear-date-filter')?.addEventListener('click', () => setDateFilter(null));
  $('btn-clear-date-chip')?.addEventListener('click', () => setDateFilter(null));

  // Methodology toggle
  $('btn-methodology')?.addEventListener('click', () => {
    const btn = $('btn-methodology');
    const note = $('methodology-note');
    if (!btn || !note) return;
    const nextOpen = note.hidden;
    note.hidden = !nextOpen;
    btn.setAttribute('aria-expanded', nextOpen ? 'true' : 'false');
  });

  // Conversation selector in standalone mode
  $('conv-selector')?.addEventListener('change', (e) => {
    state.conversationId = e.target.value;
    state.convEtag = '';
    fetchConversationData({ force: true });
  });

  // Chat compaction alert toggle switch
  $('chat-alert-switch')?.addEventListener('change', (e) => {
    updateChatAlertSetting(Boolean(e.target.checked));
  });

  // Custom datetime-local range inputs
  function applyCustomDatetimeInputs() {
    const startMs = parseDatetimeInputMs($('time-start-input')?.value, false);
    const endMs = parseDatetimeInputMs($('time-end-input')?.value, true);
    setTimeRangeFilter({ preset: 'custom', startMs, endMs, label: getTimeRangeLabel('custom', state.locale) });
  }
  $('time-start-input')?.addEventListener('change', applyCustomDatetimeInputs);
  $('time-end-input')?.addEventListener('change', applyCustomDatetimeInputs);

  // Fallback session card actions
  $('btn-close-fallback')?.addEventListener('click', () => {
    const card = $('session-fallback-card');
    if (card) card.hidden = true;
  });
  $('btn-inspect-conv-local')?.addEventListener('click', () => {
    const cid = state.fallbackTarget?.conversationId;
    if (!cid) return;
    state.conversationId = cid;
    state.convEtag = '';
    setPrimaryTab('conversation');
  });
  $('btn-copy-conv-id')?.addEventListener('click', async () => {
    const cid = state.fallbackTarget?.conversationId || '';
    if (!cid) return;
    const ok = await copyTextToClipboard(cid);
    showToast(
      ok
        ? t('toast.copiedId', { id: cid }, state.locale)
        : t('toast.rawId', { id: cid }, state.locale),
    );
  });

  // Keyboard support on tablists
  bindTablistKeyboard(doc.querySelector('.primary-tablist'), (btn) => setPrimaryTab(btn.dataset.tab));
  bindTablistKeyboard(doc.querySelector('.segmented-control'), (btn) => btn.click());
  bindTablistKeyboard(doc.querySelector('.sub-tablist'), (btn) => btn.click());

  // ---------- Polling Lifecycle ----------
  async function refreshActiveData({ force = false } = {}) {
    if (state.activeTab === 'conversation') {
      return fetchConversationData({ force });
    }
    return fetchGlobalData({ force });
  }

  function schedulePoll() {
    if (state.pollTimer) clearInterval(state.pollTimer);
    state.pollTimer = setInterval(() => {
      if (doc.hidden || state.mock) return;
      refreshActiveData({ force: false });
    }, 2_800);
    state.pollTimer?.unref?.();
  }

  doc.addEventListener('visibilitychange', () => {
    if (!doc.hidden) refreshActiveData({ force: false });
  });

  // Boot initial tab & fetch
  setPrimaryTab(state.activeTab, { triggerFetch: true });
  schedulePoll();

  return {
    state,
    setAppLocale,
    setPrimaryTab,
    setDateFilter,
    setTimeRangeFilter,
    toggleTimeSortOrder,
    inspectSubagentConversation,
    refreshActiveData,
    manualRefresh,
    openFullscreenDashboard,
    destroy() {
      if (state.pollTimer) clearInterval(state.pollTimer);
      if (state.toastTimer) clearTimeout(state.toastTimer);
      if (state.spinTimer) clearTimeout(state.spinTimer);
    },
  };
}

if (
  typeof window !== 'undefined' &&
  typeof document !== 'undefined' &&
  !globalThis.__AGY_MONITOR_DISABLE_AUTO_BOOT__
) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => bootMonitorApp(window, document));
  } else {
    bootMonitorApp(window, document);
  }
}
