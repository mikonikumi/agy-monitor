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

export const CATEGORY_DEFINITIONS = [
  { id: 'rules', label: 'Rules 规则文件' },
  { id: 'system', label: 'System 底座与内置工具' },
  { id: 'mcp', label: 'MCP 工具' },
  { id: 'skills', label: 'Skills 技能' },
  { id: 'messages', label: '对话消息与附件' },
  { id: 'toolResults', label: '工具调用结果' },
];

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

export function formatSubagentTitle(rawTitle, role, conversationId = '') {
  const title = String(rawTitle ?? '').trim();
  const cleanRole = formatSubagentRole(role);
  if (title) {
    const escapedRole = cleanRole.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const stripped = title.replace(new RegExp(`^@?${escapedRole}\\s*[·:\\-—|]\\s*`, 'i'), '').trim();
    if (stripped) return stripped;
    return title;
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

export function buildFullscreenUrl(search = '', token = '') {
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

export function decideConversationAction(item, { sidecar = null } = {}) {
  const convId = String(item?.conversationId || '').trim();
  const title = item?.conversationTitle || item?.title || convId || '未命名会话';
  const surface = item?.surface || '未知客户端';
  const canHostToggle = Boolean(sidecar?.ui && typeof sidecar.ui.toggleConversation === 'function');

  if (convId && item?.isLocalSide === true && canHostToggle) {
    return {
      mode: 'host-switch',
      conversationId: convId,
      title,
      surface,
      reason: `已请求宿主切换至会话「${title}」`,
    };
  }

  if (item?.isLocalSide === false) {
    return {
      mode: 'fallback-cross-side',
      conversationId: convId,
      title,
      surface,
      reason: `跨端会话提示：该会话属于 ${surface}，与当前面板所在运行端不同，宿主无法直接跨端切换窗口。请在 ${surface} 客户端打开，或点击下方按钮在本面板查看其上下文明细。`,
    };
  }

  return {
    mode: 'fallback-standalone',
    conversationId: convId,
    title,
    surface,
    reason: `独立视图提示：当前未连接 AGY 侧边栏宿主桥接（会话所属端：${surface}），已为您展开该会话的完整元数据。`,
  };
}

/* ==========================================================================
   3. Context Window & Drawer Normalization Logic (Task 5.2)
   ========================================================================== */

export function computeContextBarModel(contextWindow = {}) {
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
    return {
      id: def.id,
      label: found?.label || def.label,
      tokens,
      percent,
      widthPct,
    };
  });

  const bufferTokensVisible = Math.max(0, Math.min(autocompactBuffer, limit - usedTokens));
  const freeWidthPct = barDenom > 0 ? (freeTokens / barDenom) * 100 : 0;
  const bufferWidthPct = barDenom > 0 ? (bufferTokensVisible / barDenom) * 100 : 0;

  const rawAlert = String(contextWindow?.alertLevel || '').toLowerCase();
  let alertState = 'ok';
  if (
    usedTokens >= ALERT_CRITICAL_TOKENS ||
    rawAlert === 'critical' ||
    rawAlert === 'danger' ||
    rawAlert === 'high' ||
    rawAlert.includes('92')
  ) {
    alertState = 'critical';
  } else if (
    usedTokens >= ALERT_WARN_TOKENS ||
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

export function deriveProjectRankings(requests = []) {
  const byConv = new Map();
  for (const r of requests) {
    const key = r.conversationId || `${r.surface || 'unknown'}:${r.project || ''}:${r.conversationTitle || ''}`;
    let acc = byConv.get(key);
    if (!acc) {
      acc = {
        conversationId: r.conversationId || '',
        project: r.project || r.workspace || '未关联项目',
        title: r.conversationTitle || r.title || r.conversationId || '未命名会话',
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
export function renderDailyHeatmapSvg(dailyEntries = [], { activeDateFilter = null, referenceDateStr = '' } = {}) {
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
  const padLeft = 28;
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
      monthLabels.push(`<text x="${x}" y="13" class="svg-axis-label">${monthNum}月</text>`);
      lastMonth = monthNum;
      lastLabelX = x;
    } else if (monthNum !== lastMonth && lastMonth === -1) {
      lastMonth = monthNum;
    }

    const level = computeHeatLevel(d.tokens, maxTokens);
    const selected = activeDateFilter?.type === 'day' && activeDateFilter.date === d.date;
    const tip = `${d.date} · ${formatTokensZh(d.tokens)} (${formatTokensEn(d.tokens)}) · ${d.requests} 次请求`;

    rects.push(
      `<rect class="heat-cell" x="${x}" y="${y}" width="${cell}" height="${cell}" rx="2.2"` +
      ` fill="var(--heat-${level})" data-chart-kind="day" data-date="${escapeHtml(d.date)}"` +
      ` data-tokens="${d.tokens}" data-requests="${d.requests}" data-level="${level}"` +
      ` data-selected="${selected ? 'true' : 'false'}" data-tooltip="${escapeHtml(tip)}"` +
      ` tabindex="0" role="button" aria-label="${escapeHtml(tip)}"><title>${escapeHtml(tip)}</title></rect>`,
    );
  }

  const weekdayMarks = [
    { row: 0, text: '一' },
    { row: 2, text: '三' },
    { row: 4, text: '五' },
    { row: 6, text: '日' },
  ].map(({ row, text }) => (
    `<text x="2" y="${padTop + row * step + 9}" class="svg-axis-label">${text}</text>`
  ));

  const legendY = padTop + 7 * step + 14;
  const legendStartX = width - 118;
  const legendSwatches = [0, 1, 2, 3, 4].map((lvl, i) => (
    `<rect x="${legendStartX + 18 + i * 13}" y="${legendY - 9}" width="10" height="10" rx="2" fill="var(--heat-${lvl})"/>`
  )).join('');

  return (
    `<svg class="activity-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="过去 365 天每日 Token 活动热力图">` +
    monthLabels.join('') +
    weekdayMarks.join('') +
    rects.join('') +
    `<text x="${legendStartX}" y="${legendY}" class="svg-axis-label">少</text>` +
    legendSwatches +
    `<text x="${legendStartX + 86}" y="${legendY}" class="svg-axis-label">多</text>` +
    `</svg>`
  );
}

/**
 * Generates a weekly Token trend bar chart SVG.
 */
export function renderWeeklyBarSvg(weeklyEntries = [], { activeDateFilter = null } = {}) {
  const weeks = Array.isArray(weeklyEntries) && weeklyEntries.length > 0
    ? weeklyEntries
    : [{ weekStart: '—', weekEnd: '—', label: '暂无数据', tokens: 0, requests: 0 }];

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
    const label = String(w.label || (weekStart ? weekStart.slice(5) : `W${i + 1}`));
    const selected = activeDateFilter?.type === 'week' &&
      activeDateFilter.weekStart === weekStart &&
      activeDateFilter.weekEnd === weekEnd;
    const tip = `${weekStart} ~ ${weekEnd} · ${formatTokensZh(tokens)} (${formatTokensEn(tokens)}) · ${requests} 次请求`;

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

  return (
    `<svg class="activity-svg svg-responsive-fit" viewBox="0 0 ${width} ${height}" role="img" aria-label="每周 Token 消耗趋势柱状图">` +
    gridLines.join('') +
    bars.join('') +
    xLabels.join('') +
    `</svg>`
  );
}

/**
 * Generates a cumulative Token growth area + line SVG chart.
 */
export function renderCumulativeAreaSvg(cumulativeEntries = [], { activeDateFilter = null } = {}) {
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
      const tip = `${c.date} · 累计 ${formatTokensZh(c.tokens)} (${formatTokensEn(c.tokens)}) · 当日 +${formatTokensEn(c.dailyTokens)}`;
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

  return (
    `<svg class="activity-svg svg-responsive-fit" viewBox="0 0 ${width} ${height}" role="img" aria-label="累计 Token 总量增长曲线">` +
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
) {
  const rootConvId = 'mock-conv-wsl-001';
  const rootTitle = '构建 agy-monitor 双端上下文与全局 Token 监控插件';
  const mockSubagents = [
    {
      conversationId: 'mock-sub-browser',
      parentConversationId: rootConvId,
      depth: 1,
      title: 'browser · 验证侧边栏响应式布局与色彩对比度',
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
      title: 'swarm · 并行实现增量解析器与归因引擎',
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
      title: 'Windows 桌面端 Electron 渲染性能排查',
      surface: 'Desktop (Win)',
    },
  ];

  const matchedSub = mockSubagents.find((s) => s.conversationId === convId);
  if (matchedSub) {
    const isBrowserWorker = matchedSub.conversationId === 'mock-sub-browser';
    const usedTokens = matchedSub.selfContextTokens;
    const categories = isBrowserWorker
      ? [
          { id: 'rules', label: 'Rules 规则文件', tokens: 6_800, percent: 2.7 },
          { id: 'system', label: 'System 底座与内置工具', tokens: 24_200, percent: 9.5 },
          { id: 'mcp', label: 'MCP 工具', tokens: 12_400, percent: 4.8 },
          { id: 'skills', label: 'Skills 技能', tokens: 9_400, percent: 3.7 },
          { id: 'messages', label: '对话消息与附件', tokens: 51_120, percent: 20.0 },
          { id: 'toolResults', label: '工具调用结果', tokens: 106_000, percent: 41.4 },
        ]
      : [
          { id: 'rules', label: 'Rules 规则文件', tokens: 6_800, percent: 2.7 },
          { id: 'system', label: 'System 底座与内置工具', tokens: 24_200, percent: 9.5 },
          { id: 'mcp', label: 'MCP 工具', tokens: 6_400, percent: 2.5 },
          { id: 'skills', label: 'Skills 技能', tokens: 6_240, percent: 2.4 },
          { id: 'messages', label: '对话消息与附件', tokens: 28_000, percent: 10.9 },
          { id: 'toolResults', label: '工具调用结果', tokens: 41_000, percent: 16.0 },
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
            { path: 'AGENTS.md', scope: '工作区根目录', tokens: 4_200 },
            { path: '.agents/rules/openspec-conventions.md', scope: '工作区规则', tokens: 2_600 },
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
        { id: 'rules', label: 'Rules 规则文件', tokens: 6_800, percent: 2.7 },
        { id: 'system', label: 'System 底座与内置工具', tokens: 24_200, percent: 9.5 },
        { id: 'mcp', label: 'MCP 工具', tokens: 11_400, percent: 4.5 },
        { id: 'skills', label: 'Skills 技能', tokens: 15_600, percent: 6.1 },
        { id: 'messages', label: '对话消息与附件', tokens: 62_000, percent: 24.2 },
        { id: 'toolResults', label: '工具调用结果', tokens: 92_400, percent: 36.1 },
      ],
      deferred: {
        totalEstimatedTokens: 29_800,
        lazyMcp: { estimatedTokens: 18_200, count: 24 },
        inactiveSkills: { estimatedTokens: 11_600, count: 14 },
      },
      drawers: {
        rules: [
          { path: 'AGENTS.md', scope: '工作区根目录', tokens: 4_200 },
          { path: '.agents/rules/openspec-conventions.md', scope: '工作区规则', tokens: 2_600 },
        ],
        mcp: [
          { name: 'filesystem-mcp', toolCount: 9, eager: true, tokens: 6_800 },
          { name: 'git-inspector', toolCount: 6, eager: true, tokens: 4_600 },
        ],
        skills: [
          { name: 'modern-web-guidance', activated: true, tokens: 9_400, path: 'skills/modern-web-guidance/SKILL.md' },
          { name: 'plugin', activated: true, tokens: 4_100, path: 'builtin/skills/plugin/SKILL.md' },
          { name: 'openspec-apply-change (+14 摘要)', activated: false, tokens: 2_100, path: 'frontmatter summaries' },
        ],
        topSpikes: [
          { stepIndex: 23, toolName: 'read_file', summary: '/tmp/mwg-guide-1364-lines.md', deltaTokens: 18_900 },
          { stepIndex: 16, toolName: 'read_board', summary: '读取 Swarm 全员任务契约 #1..#7', deltaTokens: 14_200 },
          { stepIndex: 11, toolName: 'read_file', summary: 'sidecar_sdk/preload.js & index.mjs', deltaTokens: 9_650 },
          { stepIndex: 39, toolName: 'run_command', summary: 'node --test test/*.test.mjs', deltaTokens: 6_400 },
        ],
      },
    },
    availableConversations,
  };
}

export function createMockGlobalData() {
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
      conversationTitle: '构建 agy-monitor 双端上下文与全局 Token 监控插件',
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
      conversationTitle: '构建 agy-monitor 双端上下文与全局 Token 监控插件',
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
      conversationTitle: 'Windows 桌面端 Electron 渲染性能排查',
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
      conversationTitle: 'WSL 非交互式 Hook PATH 自动探测修复',
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
    projectRankings: deriveProjectRankings(requests),
    modelSummary: deriveModelSummary(requests),
  };
}

/* ==========================================================================
   7. Browser UI Controller
   ========================================================================== */

export const PAGE_SIZE = 50;

const STATUS_FILTER_LABELS = {
  all: '全部',
  normal: '正常',
  checkpoint: '压缩',
  error: '报错',
};

const TIME_RANGE_LABELS = {
  all: '全部时间',
  '1h': '近1小时',
  today: '今天',
  '24h': '近24h',
  '7d': '近7天',
  '30d': '近30天',
  custom: '自定义时段',
};

export function bootMonitorApp(win = globalThis.window, doc = globalThis.document) {
  if (!win || !doc) return null;
  win.__AGY_MONITOR_BOOTED__ = true;

  const $ = (id) => doc.getElementById(id);
  const metaConversationId = doc.querySelector('meta[name="sidecar-conversation-id"]')?.getAttribute('content') || '';
  const route = resolveInitialRoute({
    search: win.location?.search || '',
    sidecarConversationId: win.sidecar?.conversationId || '',
    metaConversationId,
  });

  const state = {
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

  if (state.fullscreen) {
    doc.body.dataset.fullscreen = 'true';
  }
  if (state.mock) {
    const badge = $('mode-badge');
    if (badge) {
      badge.hidden = false;
      badge.textContent = 'MOCK 预览';
    }
  } else if (state.fullscreen) {
    const badge = $('mode-badge');
    if (badge) {
      badge.hidden = false;
      badge.textContent = '全屏总控';
    }
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

  // ---------- Toast Helper ----------
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

  function setSyncIndicator(kind, text) {
    const wrap = $('sync-status');
    const lbl = $('sync-label');
    if (wrap) wrap.dataset.state = kind;
    if (lbl) lbl.textContent = text;
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

  async function fetchConversationData({ force = false } = {}) {
    if (force) {
      setSyncIndicator('syncing', '同步中…');
    }
    if (state.mock) {
      state.convData = createMockConversationData(
        state.conversationId || 'mock-conv-wsl-001',
        state.mockAlertEnabled,
      );
      setSyncIndicator('ok', '演示数据');
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
        setSyncIndicator('ok', '实时');
        return true;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.etag) state.convEtag = data.etag;
      if (data.unchanged && !force) {
        setSyncIndicator('ok', '实时');
        return true;
      }
      if (!state.conversationId && data.conversationId) {
        state.conversationId = data.conversationId;
      }
      if (!data.unchanged) {
        state.convData = data;
      }
      const errBanner = $('conv-error-banner');
      if (errBanner) errBanner.hidden = true;
      setSyncIndicator('ok', '实时');
      if (!force && state.isPointerDown) {
        state.pendingPollRender = 'conversation';
        return true;
      }
      if (state.convData) {
        renderConversationView(state.convData, { forceRender: force });
      }
      return true;
    } catch (err) {
      setSyncIndicator('error', '连接受阻');
      const errBanner = $('conv-error-banner');
      if (errBanner) {
        errBanner.hidden = false;
        errBanner.innerHTML =
          `无法读取当前会话数据（${escapeHtml(err.message)}）。` +
          ` <button type="button" class="ghost-btn sm" id="btn-enable-mock-conv">使用模拟数据预览</button>`;
        $('btn-enable-mock-conv')?.addEventListener('click', () => {
          state.mock = true;
          errBanner.hidden = true;
          refreshActiveData({ force: true });
        });
      }
      return false;
    }
  }

  async function fetchGlobalData({ force = false } = {}) {
    if (force) {
      setSyncIndicator('syncing', '同步中…');
    }
    if (state.mock) {
      state.globalData = createMockGlobalData();
      setSyncIndicator('ok', '演示数据');
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
        setSyncIndicator('ok', '实时');
        return true;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.etag) state.globalEtag = data.etag;
      if (data.unchanged && !force) {
        setSyncIndicator('ok', '实时');
        return true;
      }
      if (!data.unchanged) {
        state.globalData = data;
      }
      const errBanner = $('global-error-banner');
      if (errBanner) errBanner.hidden = true;
      setSyncIndicator('ok', '实时');
      if (!force && state.isPointerDown) {
        state.pendingPollRender = 'global';
        return true;
      }
      if (state.globalData) {
        renderGlobalView(state.globalData, { forceRender: force });
      }
      return true;
    } catch (err) {
      setSyncIndicator('error', '连接受阻');
      const errBanner = $('global-error-banner');
      if (errBanner) {
        errBanner.hidden = false;
        errBanner.innerHTML =
          `无法读取全局统计数据（${escapeHtml(err.message)}）。` +
          ` <button type="button" class="ghost-btn sm" id="btn-enable-mock-global">使用模拟数据预览</button>`;
        $('btn-enable-mock-global')?.addEventListener('click', () => {
          state.mock = true;
          errBanner.hidden = true;
          refreshActiveData({ force: true });
        });
      }
      return false;
    }
  }

  async function updatePluginSettings(patch = {}, { switchEl = null, revertChecked = true, successMsg = '' } = {}) {
    const feedback = $('alert-save-feedback');
    if (state.mock) {
      if (typeof patch.enableChatAlert === 'boolean') {
        state.mockAlertEnabled = patch.enableChatAlert;
      }
      if (feedback) {
        feedback.textContent = `${successMsg}（预览模式）`;
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
        throw new Error(res.status === 401 ? '缺少有效 X-Sidecar-Token 鉴权 (401)' : `保存失败 (${res.status})`);
      }
      if (state.convData && state.convData.settings) {
        Object.assign(state.convData.settings, patch);
      }
      if (feedback) {
        feedback.textContent = successMsg;
      }
    } catch (err) {
      if (switchEl) switchEl.checked = revertChecked;
      if (feedback) feedback.textContent = `保存设置失败：${err.message}`;
      showToast(`设置未保存：${err.message}`);
    }
  }

  async function updateChatAlertSetting(enableChatAlert) {
    const val = Boolean(enableChatAlert);
    return updatePluginSettings(
      { enableChatAlert: val },
      {
        switchEl: $('chat-alert-switch'),
        revertChecked: !val,
        successMsg: val
          ? '已保存：上下文突破 80% / 92% 时将在下一轮回复中自动附带压缩预警与面板链接'
          : '已保存：聊天内临近压缩提醒已关闭，仅在监控面板内部高亮',
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

  // ---------- Render Tab 1: 当前对话 ----------
  function renderConversationView(data) {
    if (!data) return;

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
        const rootTitle = ancestors[0]?.title || '主会话';

        const backBtn = $('btn-back-root-conv');
        if (backBtn) {
          backBtn.dataset.targetConvId = rootConvId;
          backBtn.setAttribute?.('data-target-conv-id', rootConvId);
          backBtn.disabled = !rootConvId;
          backBtn.title = `返回主会话：${rootTitle}`;
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
                const ancLabel = anc.role
                  ? `@${formatSubagentRole(anc.role)}`
                  : (anc.title || ancId.slice(0, 8) || '上级会话');
                return (
                  `<span class="drilldown-sep" aria-hidden="true">/</span>` +
                  `<button type="button" class="drilldown-ancestor-btn" data-drill-conv-id="${escapeHtml(ancId)}" title="${escapeHtml(anc.title || ancId)}">${escapeHtml(ancLabel)}</button>`
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
          workerBadgeEl.textContent = `正在查看子智能体: @${currentRoleLabel}`;
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
              `<button type="button" class="sibling-pill sibling-pill-root" data-drill-conv-id="${escapeHtml(rootConvId)}" aria-current="false" title="${escapeHtml(`返回主会话：${rootTitle}`)}">主会话</button>`,
            );
          }
          for (const sib of siblings) {
            const sibId = String(sib?.conversationId || '').trim();
            if (!sibId) continue;
            const sibRole = formatSubagentRole(sib.role);
            const isCurrent = sibId === activeConvId;
            pillParts.push(
              `<button type="button" class="sibling-pill${isCurrent ? ' is-current' : ''}" data-drill-conv-id="${escapeHtml(sibId)}" aria-current="${isCurrent ? 'true' : 'false'}" title="${escapeHtml(sib.title || sibId)}">@${escapeHtml(sibRole)} · ${escapeHtml(formatTokensEn(sib.totalTokens))}</button>`,
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

    const ctxLabelEl = $('context-window-label');
    if (ctxLabelEl) {
      ctxLabelEl.textContent = isSubagent
        ? `上下文窗口构成（子智能体 @${currentRoleLabel} · 锚定 256K）`
        : '上下文窗口构成（仅主会话 · 锚定 256K）';
    }

    $('conv-title').textContent = data.title || data.conversationId || '当前活跃会话';
    $('conv-surface-badge').textContent = data.surface || 'Desktop';
    $('conv-model-name').textContent = formatModelDisplay(data.modelName || data.model);
    const ws = data.workspace || '未绑定工作区';
    $('conv-workspace').textContent = ws;
    $('conv-workspace-wrap').title = ws;

    // Conversation switcher when multiple sessions are available
    const avail = Array.isArray(data.availableConversations) ? data.availableConversations : [];
    const swWrap = $('conv-switcher-wrap');
    const sel = $('conv-selector');
    if (swWrap && sel && avail.length > 1) {
      swWrap.hidden = false;
      const hasCurrentInAvail = avail.some((c) => (c.conversationId || c.id || '') === activeConvId);
      const extraSubOpt = isSubagent && activeConvId && !hasCurrentInAvail
        ? `<option value="${escapeHtml(activeConvId)}" selected>${escapeHtml(`↳ @${currentRoleLabel} (子智能体)`)}</option>`
        : '';
      const selHtml = extraSubOpt + avail
        .map((c) => {
          const cid = c.conversationId || c.id || '';
          const label = `${c.title || cid.slice(0, 8)} (${c.surface || ''})`;
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

    $('conv-combined-tokens').textContent = formatTokensEn(combined);
    $('conv-combined-tokens').title = `精确含缓存总消耗：${formatExactInt(combined)} tokens`;
    $('conv-combined-zh').textContent = `约 ${formatTokensZh(combined)} · 精确 ${formatExactInt(combined)}`;
    $('conv-split-self').style.width = `${Math.max(0, Math.min(100, selfPct)).toFixed(1)}%`;
    $('conv-split-sub').style.width = `${Math.max(0, Math.min(100, subPct)).toFixed(1)}%`;
    $('conv-self-tokens').textContent = formatTokensEn(selfTotal);
    $('conv-self-pct').textContent = `(${formatPercent(selfPct)})`;
    $('conv-sub-tokens').textContent = formatTokensEn(subTotal);
    $('conv-sub-pct').textContent = `(${formatPercent(subPct)})`;

    const subagents = Array.isArray(cons.subagents) ? cons.subagents : [];
    $('conv-subagent-count-pill').textContent = subagents.length > 0
      ? `含 ${subagents.length} 个子智能体 / Swarm`
      : (isSubagent ? '子智能体独立视图' : '仅主会话');

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
        const subHtml = subagents
          .map((sub) => {
            const subId = String(sub.conversationId || '').trim();
            const roleLabel = formatSubagentRole(sub.role);
            const displayTitle = formatSubagentTitle(sub.title, sub.role, subId);
            const subShare = Number.isFinite(Number(sub.sharePercent))
              ? Number(sub.sharePercent)
              : (combined > 0 ? ((Number(sub.totalTokens) || 0) / combined) * 100 : 0);
            const shareClamped = Math.max(0, Math.min(100, subShare));

            const rawCtxPct = Number(sub.contextUsedPercent);
            const ctxPct = Number.isFinite(rawCtxPct)
              ? Math.max(0, rawCtxPct)
              : (Number.isFinite(Number(sub.selfContextTokens))
                  ? Number(((Math.max(0, Number(sub.selfContextTokens)) / CONTEXT_LIMIT) * 100).toFixed(1))
                  : null);
            const ctxToneClass = ctxPct === null
              ? 'pill-subtle'
              : ctxPct >= 92
                ? 'pill-danger'
                : ctxPct >= 80
                  ? 'pill-warn'
                  : 'pill-subtle';
            const ctxBadgeHtml = ctxPct !== null
              ? `<span class="pill ${ctxToneClass} subagent-ctx-pill" title="该子智能体独立 256K 窗口使用率">窗口 ${escapeHtml(trimDecimals(ctxPct.toFixed(1)))}%</span>`
              : '';
            const cpCountSub = Math.max(0, Number(sub.checkpointCount) || 0);
            const cpBadgeHtml = cpCountSub > 0
              ? `<span class="pill pill-warn subagent-cp-pill" title="该子智能体已触发 CHECKPOINT 自动压缩次数">压缩 ${formatExactInt(cpCountSub)}次</span>`
              : '';

            return (
              `<button type="button" class="subagent-row subagent-row-btn" data-subagent-id="${escapeHtml(subId)}" data-subagent-role="${escapeHtml(roleLabel)}" style="--sub-share:${shareClamped.toFixed(1)}%" title="点击下钻查看该子智能体的 256K 窗口与步骤明细">` +
              `<span class="subagent-name">` +
              `<span class="pill pill-role">@${escapeHtml(roleLabel)}</span>` +
              `<span class="subagent-title-text" title="${escapeHtml(sub.title || subId)}">${escapeHtml(displayTitle)}</span>` +
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

    $('stat-input-tokens').textContent = formatTokensEn(inTok);
    $('stat-input-exact').textContent = `${formatExactInt(inTok)} tokens`;
    $('stat-output-tokens').textContent = formatTokensEn(outTok);
    $('stat-output-exact').textContent = `${formatExactInt(outTok)} tokens`;
    $('stat-cache-tokens').textContent = formatTokensEn(cacheTok);
    $('stat-cache-rate').textContent = formatPercent(hitPct);
    $('stat-avg-speed').textContent = formatSpeed(cons.avgTokensPerSec);
    $('stat-avg-duration').textContent = formatDurationShort(cons.avgStepDurationMs);
    $('stat-last-duration').textContent = Number(cons.lastStepDurationMs) > 0
      ? `最近一步: ${formatDurationShort(cons.lastStepDurationMs)}`
      : '最近一步: —';

    // Checkpoints
    const cp = data.checkpoints || {};
    const cpCount = Math.max(0, Number(cp.count) || (Array.isArray(cp.items) ? cp.items.length : 0));
    const latestCp = cp.latest || (Array.isArray(cp.items) && cp.items.length > 0 ? cp.items[cp.items.length - 1] : null);
    $('stat-checkpoint-count').textContent = `${cpCount} 次`;
    const cpBadge = $('stat-checkpoint-badge');
    if (cpBadge) cpBadge.hidden = cpCount === 0;
    if (cpCount > 0 && latestCp) {
      const before = Number(latestCp.beforeTokens) || 0;
      const after = Number(latestCp.afterTokens) || 0;
      const delta = Number.isFinite(Number(latestCp.deltaTokens)) ? Number(latestCp.deltaTokens) : (after - before);
      $('stat-checkpoint-delta').textContent =
        `最近 #${latestCp.stepIndex ?? '—'}: ${formatTokensEn(before)} → ${formatTokensEn(after)} (${delta <= 0 ? '' : '+'}${formatTokensEn(delta)})`;
    } else {
      $('stat-checkpoint-delta').textContent = cpCount > 0 ? '已触发自动上下文压缩重置' : '当前尚未触发自动压缩';
    }

    // 256K Context Window Bar & 6 Categories
    const barModel = computeContextBarModel(data.contextWindow);
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
        ? '92%+ 临近压缩高危'
        : barModel.alertState === 'warn'
          ? '80%+ 压缩警戒区'
          : '水位安全';
    }

    const tabPctBadge = $('tab-conv-pct');
    if (tabPctBadge) {
      tabPctBadge.hidden = false;
      tabPctBadge.textContent = `${barModel.usedPercent.toFixed(0)}%`;
    }

    $('window-used-pct').textContent = `已使用 ${barModel.usedPercent.toFixed(1)}%`;
    $('window-used-fraction').textContent = `${formatTokensEn(barModel.usedTokens)} / ${formatTokensEn(barModel.limit)}`;
    $('window-used-fraction').title = `精确占用：${formatExactInt(barModel.usedTokens)} / ${formatExactInt(barModel.limit)} tokens`;

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
          `<div class="ctx-seg" data-cat="free" style="width:${barModel.freeWidthPct.toFixed(3)}%" title="Free space 安全剩余空间: ${formatTokensEn(barModel.freeTokens)}"></div>`,
        );
      }
      if (barModel.bufferWidthPct > 0) {
        segsHtml.push(
          `<div class="ctx-seg" data-cat="buffer" style="width:${barModel.bufferWidthPct.toFixed(3)}%" title="Autocompact buffer 自动压缩警戒缓冲带 (~${formatTokensEn(barModel.autocompactBuffer)})"></div>`,
        );
      }
      barEl.innerHTML = segsHtml.join('');
    }

    const catListEl = $('context-categories-list');
    if (catListEl) {
      catListEl.innerHTML = barModel.categories
        .map((c) => (
          `<li class="category-item" title="精确 Token: ${formatExactInt(c.tokens)}">` +
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
    $('window-buffer-tokens').textContent = `~${formatTokensEn(barModel.autocompactBuffer)} (${bufPct}%)`;
    $('window-free-tokens').textContent = `${formatTokensEn(barModel.freeTokens)} (${((barModel.freeTokens / barModel.limit) * 100).toFixed(1)}%)`;

    // Deferred Section
    const defRaw = data.contextWindow?.deferred || {};
    const lazyMcp = normalizeDeferredGroup(defRaw.lazyMcp);
    const inactiveSkills = normalizeDeferredGroup(defRaw.inactiveSkills);
    const totalDeferred = Number.isFinite(Number(defRaw.totalEstimatedTokens))
      ? Math.max(0, Math.round(Number(defRaw.totalEstimatedTokens)))
      : lazyMcp.tokens + inactiveSkills.tokens;

    $('deferred-total-tokens').textContent = `约 ${formatTokensEn(totalDeferred)} 未加载`;
    $('deferred-lazy-mcp').textContent = lazyMcp.count !== null
      ? `~${formatTokensEn(lazyMcp.tokens)} (${lazyMcp.count} 项)`
      : `~${formatTokensEn(lazyMcp.tokens)}`;
    $('deferred-inactive-skills').textContent = inactiveSkills.count !== null
      ? `~${formatTokensEn(inactiveSkills.tokens)} (${inactiveSkills.count} 项)`
      : `~${formatTokensEn(inactiveSkills.tokens)}`;

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
    const meta = $('drawer-rules-meta');
    if (meta) meta.textContent = `${items.length} 个文件`;
    const body = $('drawer-rules-body');
    if (!items.length) {
      setDrawerBodyHtml(body, `<p class="empty-hint">当前工作区与全局未检测到已加载的 AGENTS.md / GEMINI.md / rules 文件。</p>`);
      return;
    }
    const html = `<ul class="drawer-list">${items.map((it) => {
      const path = typeof it === 'string' ? it : (it.path || it.filePath || it.name || '规则文件');
      const scope = typeof it === 'object' ? (it.scope || it.source || '') : '';
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
    const meta = $('drawer-mcp-meta');
    if (meta) meta.textContent = `${items.length} 个服务`;
    const body = $('drawer-mcp-body');
    if (!items.length) {
      setDrawerBodyHtml(body, `<p class="empty-hint">当前会话未挂载常驻 Eager MCP Schema。</p>`);
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
        : (isLazy && fallbackTok > 0 ? `按需 ~${formatTokensEn(fallbackTok)}` : `~${formatTokensEn(fallbackTok)}`);
      const mode = isLazy ? 'Lazy 按需未加载' : 'Eager 常驻';
      return (
        `<li class="drawer-row">` +
        `<div class="drawer-row-main">` +
        `<span class="drawer-row-title">${escapeHtml(name)}</span>` +
        `<span class="drawer-row-sub">${escapeHtml(mode)}${toolCount > 0 ? ` · ${toolCount} 个工具` : ''}</span>` +
        `</div>` +
        `<span class="drawer-row-val">${escapeHtml(tokLabel)}</span>` +
        `</li>`
      );
    }).join('')}</ul>`;
    setDrawerBodyHtml(body, html);
  }

  function renderSkillsDrawer(items) {
    const meta = $('drawer-skills-meta');
    if (meta) meta.textContent = `${items.length} 项技能`;
    const body = $('drawer-skills-body');
    if (!items.length) {
      setDrawerBodyHtml(body, `<p class="empty-hint">未检测到已注入或已激活读取的技能记录。</p>`);
      return;
    }
    const html = `<ul class="drawer-list">${items.map((it) => {
      const name = it.name || it.skillName || 'Skill';
      const active = Boolean(it.activated ?? it.isActivated ?? it.loaded);
      const tok = Number(it.tokens) || Number(it.estimatedTokens) || 0;
      const pct = Number.isFinite(Number(it.percent)) && Number(it.percent) > 0
        ? ` (${Number(it.percent).toFixed(1)}%)`
        : '';
      const sub = active ? `已在本会话读取正文${it.path ? ` · ${it.path}` : ''}` : '仅底座摘要驻留';
      return (
        `<li class="drawer-row">` +
        `<div class="drawer-row-main">` +
        `<span class="drawer-row-title">${escapeHtml(name)} ${active ? '<span class="pill pill-ok">已激活</span>' : ''}</span>` +
        `<span class="drawer-row-sub">${escapeHtml(sub)}</span>` +
        `</div>` +
        `<span class="drawer-row-val">~${escapeHtml(formatTokensEn(tok))}${escapeHtml(pct)}</span>` +
        `</li>`
      );
    }).join('')}</ul>`;
    setDrawerBodyHtml(body, html);
  }

  function renderSpikesDrawer(items) {
    const meta = $('drawer-spikes-meta');
    if (meta) meta.textContent = `Top ${items.length}`;
    const body = $('drawer-spikes-body');
    if (!items.length) {
      setDrawerBodyHtml(body, `<p class="empty-hint">当前周期内尚无显著单步工具调用暴涨记录。</p>`);
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

  // ---------- Render Tab 2: 全局总控 ----------
  function renderGlobalView(data, { forceRender = false } = {}) {
    if (!data) return;
    const m = data.metrics || {};
    const totalTok = Math.max(0, Number(m.totalTokens) || 0);
    const peakTok = Math.max(0, Number(m.peakDailyTokens) || 0);
    const longestMs = Math.max(0, Number(m.longestTaskDurationMs) || 0);
    const longestStreak = Math.max(0, Number(m.longestStreakDays) || 0);
    const currentStreak = Math.max(0, Number(m.currentStreakDays) || 0);

    $('metric-total-tokens').textContent = formatTokensZh(totalTok);
    $('metric-total-tokens-sub').textContent = `${formatTokensEn(totalTok)} · 含缓存总吞吐`;
    $('card-total-tokens').title = `精确累计 Token：${formatExactInt(totalTok)} (${formatTokensEn(totalTok)})`;

    $('metric-peak-daily').textContent = formatTokensZh(peakTok);
    $('metric-peak-date').textContent = m.peakDailyDate ? `峰值日 ${m.peakDailyDate}` : '单日最高吞吐';
    $('card-peak-daily').title = `单日最高精确 Token：${formatExactInt(peakTok)}${m.peakDailyDate ? ` (${m.peakDailyDate})` : ''}`;

    $('metric-longest-task').textContent = formatDurationZh(longestMs);
    $('card-longest-task').title = `单轮连续最长耗时：${formatDurationShort(longestMs)} (${formatExactInt(longestMs)} ms，已剔除两次提问间人工闲置时间)`;

    $('metric-longest-streak').textContent = `${longestStreak} 天`;
    $('card-longest-streak').title = `历史最长连续活跃自然日：${longestStreak} 天`;

    $('metric-current-streak').textContent = `${currentStreak} 天`;
    $('card-current-streak').title = `截至最近活跃日的当前连续天数：${currentStreak} 天`;

    renderActivityChart({ forceRender });
    renderGlobalTableSection({ forceRender });
  }

  function renderActivityChart({ forceRender = false } = {}) {
    const activity = state.globalData?.activity || {};
    const container = $('activity-svg-container');
    const caption = $('activity-range-caption');
    if (!container) return;

    let nextSvg = '';
    if (state.chartView === 'weekly') {
      if (caption) caption.textContent = '按自然周聚合总吞吐趋势（点击柱条筛选该周调用日志）';
      nextSvg = renderWeeklyBarSvg(activity.weekly, { activeDateFilter: state.activeDateFilter });
    } else if (state.chartView === 'cumulative') {
      if (caption) caption.textContent = '随时间推进的全局累计 Token 增长曲线（点击节点筛选当日日志）';
      nextSvg = renderCumulativeAreaSvg(activity.cumulative, { activeDateFilter: state.activeDateFilter });
    } else {
      if (caption) caption.textContent = '过去 365 天每日贡献热力图（点击蓝阶格子下钻筛选当日日志）';
      nextSvg = renderDailyHeatmapSvg(activity.daily, { activeDateFilter: state.activeDateFilter });
    }

    if (forceRender || container._lastSvg !== nextSvg) {
      container.innerHTML = nextSvg;
      container._lastSvg = nextSvg;
    }

    syncDateFilterIndicators();
  }

  function syncDateFilterIndicators() {
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
      ? `日期筛选: ${f.date}`
      : `周次筛选: ${f.weekStart} ~ ${f.weekEnd}`;
    if (bar && barLbl) {
      bar.hidden = false;
      barLbl.textContent = `当前图表下钻 · ${desc}`;
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
    const preset = String(nextTimeFilter?.preset || 'all');
    const hadDateFilter = Boolean(state.activeDateFilter);
    if (preset !== 'all' && state.activeDateFilter) {
      state.activeDateFilter = null;
    }
    state.timeRangeFilter = {
      preset,
      startMs: nextTimeFilter?.startMs ?? null,
      endMs: nextTimeFilter?.endMs ?? null,
      label: nextTimeFilter?.label || TIME_RANGE_LABELS[preset] || preset,
    };
    state.visibleRowsLimit = PAGE_SIZE;
    if (hadDateFilter && !state.activeDateFilter) {
      renderActivityChart({ forceRender: true });
    }
    const stats = renderGlobalTableSection({ forceRender: true });
    if (showFeedback) {
      const desc = state.timeRangeFilter.label || TIME_RANGE_LABELS[preset] || preset;
      showToast(`时间筛选「${desc}」：共 ${stats.filteredRequestsCount} 条匹配日志`);
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
          ? '已切换为按时间正序（最早 → 最新）'
          : '已切换为按时间倒序（最新 → 最早）',
      );
    }
    return stats;
  }

  function updateLoadMoreButton(loadMoreBtn, totalCount, shownCount) {
    if (!loadMoreBtn) return;
    const remaining = Math.max(0, totalCount - shownCount);
    if (remaining > 0) {
      loadMoreBtn.hidden = false;
      loadMoreBtn.textContent = `加载更多（剩余 ${remaining} 条）`;
    } else {
      loadMoreBtn.hidden = true;
    }
  }

  function renderGlobalTableSection({ forceRender = false } = {}) {
    const data = state.globalData || {};
    const allRequests = Array.isArray(data.requests) ? data.requests : [];
    const nowMs = resolveNowMs();
    const activePreset = state.timeRangeFilter?.preset || 'all';

    // Sync time preset chips, custom datetime bar, sort button & timeline granularity toggle
    for (const chip of doc.querySelectorAll('.filter-chip[data-time-range]')) {
      const key = chip.dataset.timeRange || 'all';
      const active = key === activePreset;
      chip.classList.toggle('active', active);
      chip.setAttribute('aria-pressed', active ? 'true' : 'false');
    }
    const customWrap = $('custom-time-inputs');
    if (customWrap) {
      customWrap.hidden = activePreset !== 'custom';
    }
    const sortBtn = $('btn-time-sort');
    if (sortBtn) {
      sortBtn.textContent = state.timeSortOrder === 'asc' ? '时间: 最早 ↑' : '时间: 最新 ↓';
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
    for (const chip of doc.querySelectorAll('.filter-chip[data-status-filter]')) {
      const key = chip.dataset.statusFilter || 'all';
      const baseLabel = STATUS_FILTER_LABELS[key] || key;
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
      ? deriveProjectRankings(filteredRequests)
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

    const statusLabel = STATUS_FILTER_LABELS[state.statusFilter] || '全部';
    const timePrefix = activePreset !== 'all'
      ? `时段：${state.timeRangeFilter?.label || TIME_RANGE_LABELS[activePreset] || activePreset} · `
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
    const unitNoun = state.tableSubTab === 'timeline'
      ? (state.timelineGranularity === 'hour' ? '个小时时段' : '个自然日')
      : state.tableSubTab === 'projects'
        ? '个项目/会话'
        : state.tableSubTab === 'models'
          ? '个模型'
          : '条记录';
    if (summaryEl) {
      summaryEl.textContent = activeRows.length > slice.length
        ? `${timePrefix}筛选：${statusLabel} · 显示前 ${slice.length} / 共 ${activeRows.length} ${unitNoun}`
        : `${timePrefix}筛选：${statusLabel} · 共 ${activeRows.length} ${unitNoun}`;
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

    if (state.tableSubTab === 'timeline') {
      const sortArrow = state.timeSortOrder === 'asc' ? '↑' : '↓';
      const headHtml = (
        `<tr>` +
        `<th class="sortable-th" data-sort-time="1" title="点击切换时间正序/倒序">时间段 ${sortArrow}</th>` +
        `<th class="num-col">调用次数</th>` +
        `<th class="num-col">总吞吐 Token</th>` +
        `<th class="num-col">新增输入</th>` +
        `<th class="num-col">总输出</th>` +
        `<th class="num-col">平均缓存率</th>` +
        `<th class="num-col">平均流速</th>` +
        `</tr>`
      );
      if (thead._lastHtml !== headHtml) {
        thead.innerHTML = headHtml;
        thead._lastHtml = headHtml;
      }
      tbody._timelineBuckets = slice;
      tbody.innerHTML = slice.length
        ? slice.map((b, idx) => {
            const hitPct = normalizeCacheHitPercent(b.avgCacheHitRate);
            return (
              `<tr class="timeline-bucket-row" data-timeline-bucket="${idx}" title="点击下钻查看 ${escapeHtml(b.label)} 的请求日志">` +
              `<td data-label="时间段">` +
              `<button type="button" class="timeline-bucket-btn" data-timeline-bucket="${idx}" title="点击查看 ${escapeHtml(b.label)} 的请求日志">${escapeHtml(b.label)} →</button>` +
              `</td>` +
              `<td class="num-col" data-label="调用次数">${formatExactInt(b.requestCount)}</td>` +
              `<td class="num-col" data-label="总吞吐 Token" title="${escapeHtml(formatExactInt(b.totalTokens))}"><strong>${escapeHtml(formatTokensEn(b.totalTokens))}</strong> <span class="muted-num">(${escapeHtml(formatTokensZh(b.totalTokens))})</span></td>` +
              `<td class="num-col" data-label="新增输入">${escapeHtml(formatTokensEn(b.inputTokens))}</td>` +
              `<td class="num-col" data-label="总输出">${escapeHtml(formatTokensEn(b.outputTokens))}</td>` +
              `<td class="num-col" data-label="平均缓存率"><span class="pill pill-cache">${escapeHtml(formatPercent(hitPct))}</span></td>` +
              `<td class="num-col" data-label="平均流速">${escapeHtml(formatSpeed(b.avgTokensPerSec))}</td>` +
              `</tr>`
            );
          }).join('')
        : `<tr><td colspan="7" class="empty-hint">当前筛选条件下暂无可按时间聚合的调用日志。</td></tr>`;
      return {
        shown: slice.length,
        total: timeBuckets.length,
        filteredRequestsCount: filteredRequests.length,
        counts: statusCounts,
      };
    }

    if (state.tableSubTab === 'projects') {
      const headHtml = (
        `<tr>` +
        `<th>项目/对话</th>` +
        `<th>应用</th>` +
        `<th class="num-col">调用次数</th>` +
        `<th class="num-col">总吞吐 Token</th>` +
        `<th class="num-col">总输出</th>` +
        `<th class="num-col">缓存率</th>` +
        `<th class="num-col">流速</th>` +
        `<th>最近活跃</th>` +
        `</tr>`
      );
      if (thead._lastHtml !== headHtml) {
        thead.innerHTML = headHtml;
        thead._lastHtml = headHtml;
      }
      tbody.innerHTML = slice.length
        ? slice.map((p, idx) => {
            const hitPct = normalizeCacheHitPercent(p.avgCacheHitRate);
            const title = p.title || p.conversationId || '未命名对话';
            const proj = p.project || '';
            const fullTip = proj && proj !== title ? `${proj} · ${title}` : title;
            return (
              `<tr>` +
              `<td data-label="项目/对话">` +
              `<button type="button" class="conv-link-btn" data-conv-jump="${idx}" data-jump-source="projects" title="${escapeHtml(fullTip)}">` +
              (proj && proj !== title ? `<span class="conv-link-project">${escapeHtml(proj)} · </span>` : '') +
              `<span class="conv-link-title">${escapeHtml(title)}</span>` +
              `</button></td>` +
              `<td data-label="应用"><span class="pill pill-subtle">${escapeHtml(p.surface || 'Desktop')}</span></td>` +
              `<td class="num-col" data-label="调用次数">${formatExactInt(p.requestCount)}</td>` +
              `<td class="num-col" data-label="总吞吐 Token" title="${escapeHtml(formatExactInt(p.totalTokens))}"><strong>${escapeHtml(formatTokensEn(p.totalTokens))}</strong> <span class="muted-num">(${escapeHtml(formatTokensZh(p.totalTokens))})</span></td>` +
              `<td class="num-col" data-label="总输出">${escapeHtml(formatTokensEn(p.outputTokens))}</td>` +
              `<td class="num-col" data-label="缓存率"><span class="pill pill-cache">${escapeHtml(formatPercent(hitPct))}</span></td>` +
              `<td class="num-col" data-label="流速">${escapeHtml(formatSpeed(p.avgTokensPerSec))}</td>` +
              `<td data-label="最近活跃">${escapeHtml(formatLocalTime(p.lastActiveAt))}</td>` +
              `</tr>`
            );
          }).join('')
        : `<tr><td colspan="8" class="empty-hint">暂无匹配筛选条件的项目或对话记录。</td></tr>`;
      tbody._jumpItems = slice;
      return {
        shown: slice.length,
        total: projects.length,
        filteredRequestsCount: filteredRequests.length,
        counts: statusCounts,
      };
    }

    if (state.tableSubTab === 'models') {
      const headHtml = (
        `<tr>` +
        `<th>模型</th>` +
        `<th class="num-col">调用次数</th>` +
        `<th class="num-col">总吞吐 Token</th>` +
        `<th class="num-col">总输出</th>` +
        `<th class="num-col">平均缓存率</th>` +
        `<th class="num-col">平均流速</th>` +
        `</tr>`
      );
      if (thead._lastHtml !== headHtml) {
        thead.innerHTML = headHtml;
        thead._lastHtml = headHtml;
      }
      tbody.innerHTML = slice.length
        ? slice.map((mRow) => {
            const hitPct = normalizeCacheHitPercent(mRow.avgCacheHitRate);
            return (
              `<tr>` +
              `<td data-label="模型"><code>${escapeHtml(formatModelDisplay(mRow.model))}</code></td>` +
              `<td class="num-col" data-label="调用次数">${formatExactInt(mRow.requestCount)}</td>` +
              `<td class="num-col" data-label="总吞吐 Token" title="${escapeHtml(formatExactInt(mRow.totalTokens))}"><strong>${escapeHtml(formatTokensEn(mRow.totalTokens))}</strong> <span class="muted-num">(${escapeHtml(formatTokensZh(mRow.totalTokens))})</span></td>` +
              `<td class="num-col" data-label="总输出">${escapeHtml(formatTokensEn(mRow.outputTokens))}</td>` +
              `<td class="num-col" data-label="平均缓存率"><span class="pill pill-cache">${escapeHtml(formatPercent(hitPct))}</span></td>` +
              `<td class="num-col" data-label="流速">${escapeHtml(formatSpeed(mRow.avgTokensPerSec))}</td>` +
              `</tr>`
            );
          }).join('')
        : `<tr><td colspan="6" class="empty-hint">暂无匹配筛选条件的模型汇总数据。</td></tr>`;
      return {
        shown: slice.length,
        total: models.length,
        filteredRequestsCount: filteredRequests.length,
        counts: statusCounts,
      };
    }

    // Default sub-tab: 请求日志 (10 compact horizontal AGY columns)
    const reqSortArrow = state.timeSortOrder === 'asc' ? '↑' : '↓';
    const headHtml = (
      `<tr>` +
      `<th class="sortable-th" data-sort-time="1" title="点击切换时间正序/倒序">时间 ${reqSortArrow}</th>` +
      `<th>应用</th>` +
      `<th>项目/对话</th>` +
      `<th>模型</th>` +
      `<th class="num-col">上下文/缓存率</th>` +
      `<th class="num-col">输入</th>` +
      `<th class="num-col">输出</th>` +
      `<th class="num-col">缓存命中</th>` +
      `<th class="num-col">流速</th>` +
      `<th class="num-col">耗时</th>` +
      `</tr>`
    );
    if (thead._lastHtml !== headHtml) {
      thead.innerHTML = headHtml;
      thead._lastHtml = headHtml;
    }

    tbody._jumpItems = slice;

    if (!slice.length) {
      tbody.innerHTML = `<tr><td colspan="10" class="empty-hint">当前筛选条件下暂无匹配的请求日志。</td></tr>`;
      return {
        shown: 0,
        total: 0,
        filteredRequestsCount: 0,
        counts: statusCounts,
      };
    }

    tbody.innerHTML = slice.map((r, idx) => {
      const normStatus = normalizeRequestStatus(r.status);
      const hitPct = normalizeCacheHitPercent(r.cacheHitRate, r.inputTokens, r.cacheReadTokens);
      const statusBadge = normStatus === 'checkpoint'
        ? ' <span class="pill pill-warn" title="自动上下文压缩步骤">CHECKPOINT</span>'
        : normStatus === 'error'
          ? ' <span class="pill pill-danger" title="调用异常">报错</span>'
          : '';
      const preCp = Number(r.preCheckpointContextTokens) || 0;
      const preCpHtml = (normStatus === 'checkpoint' && preCp > 0)
        ? `<span class="pre-cp-note">压缩前规模: ${escapeHtml(formatTokensEn(preCp))}</span>`
        : '';
      const convTitle = r.conversationTitle || r.conversationId || '未命名会话';
      const proj = r.project || r.workspace || '';
      const fullConvTip = proj && proj !== convTitle ? `${proj} · ${convTitle}` : convTitle;

      return (
        `<tr data-row-status="${normStatus}">` +
        `<td data-label="时间" title="${escapeHtml(r.isoTime || '')}">${escapeHtml(formatLocalTime(r.timestamp ?? r.isoTime))} <span class="muted-num">#${escapeHtml(r.stepIndex ?? '—')}</span></td>` +
        `<td data-label="应用"><span class="pill ${r.isLocalSide ? 'pill-accent' : 'pill-subtle'}">${escapeHtml(r.surface || 'Desktop')}</span></td>` +
        `<td data-label="项目/对话">` +
        `<button type="button" class="conv-link-btn" data-conv-jump="${idx}" data-jump-source="requests" title="${escapeHtml(fullConvTip)}">` +
        (proj && proj !== convTitle ? `<span class="conv-link-project">${escapeHtml(proj)} · </span>` : '') +
        `<span class="conv-link-title">${escapeHtml(convTitle)}</span>` +
        `</button></td>` +
        `<td data-label="模型"><code>${escapeHtml(formatModelDisplay(r.model))}</code>${statusBadge}</td>` +
        `<td class="num-col" data-label="上下文/缓存率">` +
        `<div class="ctx-cell-stack">` +
        `<span><strong>${escapeHtml(formatTokensEn(r.contextTokens))}</strong> <span class="pill pill-cache">${escapeHtml(formatPercent(hitPct))}</span></span>` +
        preCpHtml +
        `</div></td>` +
        `<td class="num-col" data-label="输入">${escapeHtml(formatTokensEn(r.inputTokens))}</td>` +
        `<td class="num-col" data-label="输出">${escapeHtml(formatTokensEn(r.outputTokens))}</td>` +
        `<td class="num-col" data-label="缓存命中">${escapeHtml(formatTokensEn(r.cacheReadTokens))}</td>` +
        `<td class="num-col" data-label="流速">${escapeHtml(formatSpeed(r.tokensPerSec))}</td>` +
        `<td class="num-col" data-label="耗时">${escapeHtml(formatDurationShort(r.durationMs))}</td>` +
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
        showToast('实时自动同步正常（每 2.8s）· 已同步最新数据');
      } else {
        showToast('已刷新最新监控数据');
      }
    }
    return ok;
  }

  async function openFullscreenDashboard() {
    const token = getResolvedToken();
    const relUrl = buildFullscreenUrl(win.location?.search || '', token);
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
          body: JSON.stringify({ clientOrigin }),
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
      showToast(copied ? '已在系统浏览器打开全屏总控（链接已复制）' : '已在系统浏览器打开全屏总控');
    } else if (copied) {
      showToast('已复制全屏总控链接，可点击顶部「新窗口打开」或在浏览器粘贴访问');
    } else {
      showToast('已展开全屏总控地址栏，可点击「新窗口打开」访问');
    }
  }

  // ---------- Conversation Click / Cross-Side Fallback ----------
  function handleConversationJump(item) {
    const decision = decideConversationAction(item, { sidecar: win.sidecar });
    if (decision.mode === 'host-switch') {
      win.sidecar.ui.toggleConversation(decision.conversationId);
      showToast(decision.reason);
      return;
    }

    state.fallbackTarget = item;
    const card = $('session-fallback-card');
    if (card) {
      card.hidden = false;
      $('fallback-surface-pill').textContent = decision.surface;
      $('fallback-conv-title').textContent = decision.title;
      $('fallback-reason').textContent = decision.reason;
      $('fallback-meta-grid').innerHTML = [
        ['会话 ID', item?.conversationId || '—'],
        ['所属客户端', decision.surface],
        ['项目 / 工作区', item?.workspace || item?.project || '—'],
        ['模型', formatModelDisplay(item?.model)],
      ]
        .map(([k, v]) => `<div class="fallback-kv"><div class="meta-key">${escapeHtml(k)}</div><div><code>${escapeHtml(v)}</code></div></div>`)
        .join('');
    }
    showToast(`${decision.surface}：已展开会话详情说明`);
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
        showToast(ok ? '已复制全屏总控链接' : '请选中输入框手动复制链接');
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

    // Subagent row click -> drill directly into child conversation's 256K window & drawers
    const subRowBtn = target.closest('.subagent-row-btn[data-subagent-id]');
    if (subRowBtn) {
      const subId = subRowBtn.getAttribute('data-subagent-id') || subRowBtn.dataset?.subagentId || '';
      const subRole = subRowBtn.getAttribute('data-subagent-role') || subRowBtn.dataset?.subagentRole || '';
      if (subId) {
        inspectSubagentConversation(subId, {
          toastMsg: subRole ? `已下钻查看子智能体 @${subRole} 的 256K 窗口与明细` : '已下钻查看子智能体明细',
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
        inspectSubagentConversation(rootId, { toastMsg: '已返回主会话视图' });
      }
      return;
    }

    // Drilldown sibling worker pills & intermediate ancestor buttons
    const drillNode = target.closest('[data-drill-conv-id]');
    if (drillNode) {
      const nextId = drillNode.getAttribute('data-drill-conv-id') || drillNode.dataset?.drillConvId || '';
      if (nextId && nextId !== state.conversationId) {
        const rootId = state.convData?.rootConversationId || state.convData?.ancestors?.[0]?.conversationId || '';
        inspectSubagentConversation(nextId, {
          toastMsg: nextId === rootId ? '已返回主会话视图' : `已切换查看 ${drillNode.textContent?.trim() || '子智能体'}`,
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
        showToast('已请求宿主打开该子智能体会话');
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
        setTimeRangeFilter({ preset: 'custom', startMs, endMs, label: '自定义时段' });
      } else {
        if ($('time-start-input')) $('time-start-input').value = '';
        if ($('time-end-input')) $('time-end-input').value = '';
        setTimeRangeFilter({ preset, startMs: null, endMs: null, label: TIME_RANGE_LABELS[preset] || preset });
      }
      return;
    }

    // Reset custom time range button
    const resetTimeBtn = target.closest('#btn-reset-time-range');
    if (resetTimeBtn) {
      if ($('time-start-input')) $('time-start-input').value = '';
      if ($('time-end-input')) $('time-end-input').value = '';
      setTimeRangeFilter({ preset: 'all', startMs: null, endMs: null, label: '全部时间' });
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
      showToast(state.timelineGranularity === 'hour' ? '已切换为按小时聚合汇总' : '已切换为按自然日聚合汇总');
      return;
    }

    // Timeline bucket drilldown -> sets custom time window & switches straight to 请求日志
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
        showToast(`已下钻至时段「${bucket.label}」：共 ${stats.filteredRequestsCount} 条请求日志`);
      }
      return;
    }

    // Status filter pills
    const statusChip = target.closest('.filter-chip[data-status-filter]');
    if (statusChip) {
      state.statusFilter = statusChip.dataset.statusFilter || 'all';
      state.visibleRowsLimit = PAGE_SIZE;
      const stats = renderGlobalTableSection({ forceRender: true });
      const statusLabel = STATUS_FILTER_LABELS[state.statusFilter] || '全部';
      showToast(`已切换筛选「${statusLabel}」：共 ${stats.filteredRequestsCount} 条匹配日志`);
      return;
    }

    // Load more pagination button
    const loadMoreBtn = target.closest('#btn-load-more');
    if (loadMoreBtn) {
      state.visibleRowsLimit += PAGE_SIZE;
      const stats = renderGlobalTableSection({ forceRender: true });
      showToast(`已展开显示 ${stats.shown} / 共 ${stats.total} 条记录`);
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
    setTimeRangeFilter({ preset: 'custom', startMs, endMs, label: '自定义时段' });
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
    showToast(ok ? `已复制会话 ID：${cid}` : `会话 ID：${cid}`);
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
