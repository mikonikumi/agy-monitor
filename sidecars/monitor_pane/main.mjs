#!/usr/bin/env node
/**
 * agy-monitor Sidecar Backend Server (`plugin/sidecars/monitor_pane/main.mjs`)
 *
 * Responsibilities:
 * 1. Dynamically integrates `sidecar_sdk` (`SidecarApp` + `preload.js`) when launched
 *    by the Antigravity Language Server, with a built-in `node:http` standalone/test
 *    compatibility shim when run directly or instantiated via `createMonitorServer(options)`.
 * 2. Binds strictly to loopback `127.0.0.1` ONLY (`BIND_HOST = '127.0.0.1'`).
 * 3. Serves `web/` static assets (`index.html`, `styles.css`, `app.js`, etc.) and `/preload.js`
 *    with seamless Sidecar token bridging (`window.sidecar.token` + `<meta name="sidecar-token">`).
 * 4. Wires `state_store.mjs`, `discovery.mjs`, `transcript_parser.mjs`, `metadata_Hierarchy.mjs`,
 *    and `context_breakdown.mjs` through an in-memory incremental `TranscriptIndex` + stat-keyed
 *    metadata cache so repeated polling completes in < 10ms.
 * 5. Exposes:
 *    - `GET /api/conversation` (`?conversationId=...`, fallback to most recent; `If-None-Match` & `?etag=` -> `200 { unchanged: true, etag }`)
 *    - `GET /api/global` (5 core metrics, 365d daily / weekly / cumulative activity, requests, projectRankings, modelSummary; ETag short-circuit)
 *    - `GET /api/settings` & `POST /api/settings` (`POST` strictly enforces valid `X-Sidecar-Token`, returning `401 { error: "Unauthorized" }` otherwise)
 */

import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  getDefaultDataDir,
  readHookEvents,
  readSettings,
  sanitizeConvId,
  writeSettings,
} from './lib/state_store.mjs';
import { discoverConversations, discoverDataSources } from './lib/discovery.mjs';
import {
  canonicalizeModelName,
  formatLocalDate,
  TranscriptIndex,
} from './lib/transcript_parser.mjs';
import {
  deriveProjectName,
  resolveMetadataAndHierarchy,
} from './lib/metadata_Hierarchy.mjs';
import {
  AUTOCOMPACT_BUFFER,
  computeContextBreakdown,
  CONTEXT_LIMIT,
  SAFE_LIMIT,
  scanWorkspaceAndGlobalCustomizations,
} from './lib/context_breakdown.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_WEB_DIR = path.join(__dirname, 'web');
const DEFAULT_ASSETS_DIR = path.resolve(__dirname, '..', '..', 'assets');

export const BIND_HOST = '127.0.0.1';
const MAX_JSON_BODY_BYTES = 64 * 1024;
const DEFAULT_CROSS_SIDE_TTL_MS = 2_500;
const DEFAULT_CUSTOMIZATIONS_TTL_MS = 5_000;

function resolveCleanModel(...candidates) {
  for (const candidate of candidates) {
    const clean = canonicalizeModelName(candidate);
    if (clean) return clean;
  }
  return '—';
}

const MIME_TYPES = Object.freeze({
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
});

const FALLBACK_PRELOAD_JS = `/* agy-monitor standalone preload compatibility shim */
(function() {
  const params = new URLSearchParams(window.location.search);
  const metaToken = document.querySelector('meta[name="sidecar-token"]')?.getAttribute('content') || '';
  const metaConvId = document.querySelector('meta[name="sidecar-conversation-id"]')?.getAttribute('content') || '';
  let storedToken = '';
  try {
    storedToken = sessionStorage.getItem('agy_monitor_sidecar_token')
      || localStorage.getItem('agy_monitor_sidecar_token:' + window.location.port)
      || '';
  } catch {}
  const token = (params.get('token') || metaToken || storedToken || '').trim();
  if (token) {
    try {
      sessionStorage.setItem('agy_monitor_sidecar_token', token);
      localStorage.setItem('agy_monitor_sidecar_token:' + window.location.port, token);
    } catch {}
  }
  const conversationId = (params.get('conversationId') || metaConvId || '').trim();

  window.addEventListener('message', (event) => {
    if (event.data?.type === 'theme-change' && event.data.payload?.cssVariables) {
      for (const [k, v] of Object.entries(event.data.payload.cssVariables)) {
        document.documentElement.style.setProperty(k, v);
      }
    }
  });

  function appendQueryToken(rawUrl) {
    if (!token || typeof rawUrl !== 'string' || !rawUrl.startsWith('/')) return rawUrl;
    if (/[?&]token=/.test(rawUrl)) return rawUrl;
    return rawUrl + (rawUrl.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(token);
  }

  function secureFetch(url, options = {}) {
    const headers = new Headers(options.headers || {});
    if (!headers.has('Content-Type') && options.body) {
      headers.set('Content-Type', 'application/json');
    }
    if (token && !headers.has('X-Sidecar-Token')) {
      headers.set('X-Sidecar-Token', token);
    }
    return fetch(appendQueryToken(url), { ...options, headers });
  }

  if (!window.sidecar) {
    window.sidecar = {
      token,
      conversationId,
      fetch: secureFetch,
      async getWorkspaceUris() { return []; },
      onWorkspaceChange() { return () => {}; },
      agent: {
        async sendMessage() { return { error: 'standalone' }; },
        async startConversation() { return { error: 'standalone' }; },
        async getConversationMetadata() { return { error: 'standalone' }; },
      },
      ui: null,
    };
  }
})();
`;

const TOKEN_BRIDGE_SNIPPET = `
/* agy-monitor token & conversationId bridge for window.sidecar */
;(function() {
  try {
    const params = new URLSearchParams(window.location.search);
    const metaToken = document.querySelector('meta[name="sidecar-token"]')?.getAttribute('content') || '';
    const metaConvId = document.querySelector('meta[name="sidecar-conversation-id"]')?.getAttribute('content') || '';
    let storedToken = '';
    try {
      storedToken = sessionStorage.getItem('agy_monitor_sidecar_token')
        || localStorage.getItem('agy_monitor_sidecar_token:' + window.location.port)
        || '';
    } catch {}
    const tok = (params.get('token') || metaToken || storedToken || '').trim();
    const convId = (params.get('conversationId') || metaConvId || '').trim();
    if (convId && window.sidecar && !window.sidecar.conversationId) {
      window.sidecar.conversationId = convId;
    }
    if (tok) {
      window.__AGY_SIDECAR_TOKEN__ = tok;
      if (window.sidecar) {
        if (!window.sidecar.token) {
          window.sidecar.token = tok;
        }
        if (typeof window.sidecar.fetch === 'function' && !window.sidecar.__agyFetchPatched) {
          const origFetch = window.sidecar.fetch.bind(window.sidecar);
          window.sidecar.fetch = function(url, opts = {}) {
            let nextUrl = url;
            if (typeof nextUrl === 'string' && nextUrl.startsWith('/') && !/[?&]token=/.test(nextUrl)) {
              nextUrl += (nextUrl.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(tok);
            }
            const headers = new Headers(opts.headers || {});
            if (!headers.has('X-Sidecar-Token')) {
              headers.set('X-Sidecar-Token', tok);
            }
            return origFetch(nextUrl, { ...opts, headers });
          };
          window.sidecar.__agyFetchPatched = true;
        }
      }
      try {
        sessionStorage.setItem('agy_monitor_sidecar_token', tok);
        localStorage.setItem('agy_monitor_sidecar_token:' + window.location.port, tok);
      } catch {}
    }
  } catch {}
})();
`;

/**
 * Transforms an ES module frontend script (`web/app.js`) with top-level `export`
 * declarations into a self-contained classic JS IIFE (`(function(){\n...\n})();`)
 * so `<script src="/app-classic.js" defer></script>` loads cleanly without CORS
 * module-mode restrictions inside Electron cross-site Sidecar iframes.
 */
export function transformEsmToClassicJs(esmSource) {
  const transformed = String(esmSource ?? '')
    .replace(/^(\s*)export\s+default\s+/gm, '$1')
    .replace(
      /^(\s*)export\s+(?=(?:async\s+function|function|const|let|var|class)\b)/gm,
      '$1',
    )
    .replace(/^\s*export\s*\{[^}]*\}\s*;?\s*$/gm, '');
  return `(function(){\n"use strict";\n${transformed}\n})();\n`;
}

function safeStat(targetPath) {
  try {
    return fs.statSync(targetPath);
  } catch {
    return null;
  }
}

function escapeHtmlAttr(str) {
  return String(str ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[ch]));
}

function shortHash(input) {
  return crypto.createHash('sha1').update(input).digest('hex').slice(0, 16);
}

/**
 * Dynamically resolves `sidecar_sdk` and its `preload.js` across AGY installations
 * (Node loader hook, Linux/WSL `~/.gemini/...`, and Windows equivalents).
 */
export async function resolveSidecarSdk(options = {}) {
  if (options.disableSidecarSdk) {
    return { sdk: null, preloadJs: FALLBACK_PRELOAD_JS, source: 'fallback' };
  }

  let sdk = null;
  let sdkDir = '';
  let source = 'fallback';

  // 1. Try bare specifier (registered by AGY's `--import register_loader.js`)
  try {
    sdk = await import('sidecar_sdk');
    source = 'loader:sidecar_sdk';
  } catch {
    sdk = null;
  }

  // 2. Probe explicit filesystem candidates for `sidecar_sdk` and `preload.js`
  const home = options.homeDir || os.homedir();
  const candidates = [];
  if (process.env.ANTIGRAVITY_APP_DATA_DIR) {
    candidates.push(
      path.join(process.env.ANTIGRAVITY_APP_DATA_DIR, 'lib', 'node_modules', 'sidecar_sdk'),
    );
  }
  for (const appName of ['antigravity', 'antigravity-ide', 'antigravity-cli', 'config']) {
    candidates.push(path.join(home, '.gemini', appName, 'lib', 'node_modules', 'sidecar_sdk'));
    candidates.push(path.join(home, '.gemini', appName, 'node_modules', 'sidecar_sdk'));
  }
  if (process.env.USERPROFILE && process.env.USERPROFILE !== home) {
    for (const appName of ['antigravity', 'antigravity-ide', 'antigravity-cli', 'config']) {
      candidates.push(
        path.join(process.env.USERPROFILE, '.gemini', appName, 'lib', 'node_modules', 'sidecar_sdk'),
      );
      candidates.push(
        path.join(process.env.USERPROFILE, '.gemini', appName, 'node_modules', 'sidecar_sdk'),
      );
    }
  }
  if (process.env.LOCALAPPDATA) {
    candidates.push(
      path.join(
        process.env.LOCALAPPDATA,
        'Programs',
        'Antigravity',
        'resources',
        'app',
        'node_modules',
        'sidecar_sdk',
      ),
    );
  }

  for (const dir of candidates) {
    const indexPath = path.join(dir, 'index.mjs');
    if (safeStat(indexPath)?.isFile()) {
      sdkDir = dir;
      if (!sdk) {
        try {
          sdk = await import(pathToFileURL(indexPath).href);
          source = indexPath;
        } catch {
          sdk = null;
        }
      }
      break;
    }
  }

  let preloadJs = FALLBACK_PRELOAD_JS;
  if (sdkDir) {
    const preloadPath = path.join(sdkDir, 'preload.js');
    if (safeStat(preloadPath)?.isFile()) {
      try {
        preloadJs = `${fs.readFileSync(preloadPath, 'utf-8')}\n${TOKEN_BRIDGE_SNIPPET}`;
      } catch {
        preloadJs = FALLBACK_PRELOAD_JS;
      }
    }
  }

  return { sdk, preloadJs, source };
}

/**
 * Converts `YYYY-MM-DD` calendar string to a DST-proof integer day serial.
 */
export function dateKeyToSerial(dateKey) {
  if (typeof dateKey !== 'string') return NaN;
  const parts = dateKey.split('-');
  if (parts.length !== 3) return NaN;
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return NaN;
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

export function serialToDateKey(serial) {
  const dt = new Date(serial * 86_400_000);
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Computes `longestStreakDays` and `currentStreakDays` in local timezone calendar days.
 */
export function computeGlobalStreaks(activeDateKeys, nowDateKey) {
  const serialSet = new Set();
  for (const key of activeDateKeys || []) {
    const s = dateKeyToSerial(key);
    if (Number.isFinite(s)) {
      serialSet.add(s);
    }
  }
  if (serialSet.size === 0) {
    return { longestStreakDays: 0, currentStreakDays: 0 };
  }

  const sorted = Array.from(serialSet).sort((a, b) => a - b);
  let longestStreakDays = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i] === sorted[i - 1] + 1) {
      run += 1;
      if (run > longestStreakDays) longestStreakDays = run;
    } else {
      run = 1;
    }
  }

  const todaySerial = dateKeyToSerial(nowDateKey);
  let currentStreakDays = 0;
  if (Number.isFinite(todaySerial)) {
    let cursor = serialSet.has(todaySerial)
      ? todaySerial
      : serialSet.has(todaySerial - 1)
        ? todaySerial - 1
        : null;
    while (cursor !== null && serialSet.has(cursor)) {
      currentStreakDays += 1;
      cursor -= 1;
    }
  }

  return { longestStreakDays, currentStreakDays };
}

function isSlowCrossOsFsPath(fsPath) {
  if (typeof fsPath !== 'string' || !fsPath) return false;
  return fsPath.startsWith('/mnt/') || fsPath.startsWith('\\\\wsl');
}

function normalizeEtagValue(raw) {
  if (typeof raw !== 'string') return '';
  let val = raw.trim();
  if (val.startsWith('W/')) val = val.slice(2).trim();
  if (val.startsWith('"') && val.endsWith('"') && val.length >= 2) {
    val = val.slice(1, -1);
  }
  return val;
}

export function matchesClientEtag(req, url, currentEtag) {
  const target = normalizeEtagValue(currentEtag);
  if (!target) return false;

  const queryEtag = normalizeEtagValue(url.searchParams.get('etag') || '');
  if (queryEtag && queryEtag === target) return true;

  const headerRaw = req.headers['if-none-match'];
  if (typeof headerRaw === 'string' && headerRaw.trim()) {
    const parts = headerRaw.split(',').map((p) => normalizeEtagValue(p));
    if (parts.includes(target) || parts.includes('*')) return true;
  }
  return false;
}

function timingSafeTokenMatch(provided, expected) {
  if (typeof provided !== 'string' || typeof expected !== 'string') return false;
  if (!provided || !expected) return false;
  const bufA = Buffer.from(provided, 'utf-8');
  const bufB = Buffer.from(expected, 'utf-8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function buildEmptyContextWindow() {
  return computeContextBreakdown({
    steps: [],
    options: {
      customizations: {
        workspacePath: '',
        geminiDir: '',
        rules: [],
        skills: [],
        eagerMcpServers: [],
        lazyMcpServers: [],
        heuristics: { rulesTokens: 0, mcpTokens: 0, skillsSummaryTokens: 0 },
      },
    },
  });
}

/**
 * Stateful incremental telemetry & attribution engine powering `/api/conversation` and `/api/global`.
 */
export function createMonitorEngine(options = {}) {
  const discoveryOptions = options.discoveryOptions || {};
  const metadataOptions = options.metadataOptions || {};
  const stateStoreOptions = {
    ...(options.dataDir ? { dataDir: options.dataDir } : {}),
    ...(options.homeDir ? { homeDir: options.homeDir } : {}),
  };
  const crossSideTtlMs =
    typeof options.crossSideTtlMs === 'number'
      ? options.crossSideTtlMs
      : DEFAULT_CROSS_SIDE_TTL_MS;
  const customizationsTtlMs =
    typeof options.customizationsTtlMs === 'number'
      ? options.customizationsTtlMs
      : DEFAULT_CUSTOMIZATIONS_TTL_MS;
  const getNowMs = typeof options.now === 'function' ? options.now : () => Date.now();

  const transcriptIndex = new TranscriptIndex();
  const hookEventsCache = new Map(); // convId -> { mtimeMs, size, events, sig }
  const customizationsCache = new Map(); // key -> { ts, value }

  let cachedSources = null;
  let cachedSourcesAt = 0;
  let cachedSlowConvs = [];
  let cachedSlowConvsAt = 0;
  let slowWarmupTimer = null;
  let disposed = false;

  let cachedHierarchyKey = '';
  let cachedHierarchyResult = null;

  let cachedGlobalEtag = '';
  let cachedGlobalPayload = null;
  const cachedConvPayloads = new Map(); // convId -> { etag, payload }
  let settingsVersion = 0;

  function isSlowSource(src) {
    return Boolean(
      src &&
        !src.isLocalSide &&
        (src.isSlowCrossOs === true || isSlowCrossOsFsPath(src.rootDir)),
    );
  }

  function scheduleSlowSourcesWarmup(knownSlowSources = null) {
    if (disposed || slowWarmupTimer) return;
    slowWarmupTimer = setTimeout(() => {
      slowWarmupTimer = null;
      if (disposed || cachedSlowConvsAt > 0) return;
      try {
        let slowSources = knownSlowSources;
        if (!Array.isArray(slowSources)) {
          cachedSources = Array.isArray(discoveryOptions.dataSources)
            ? discoveryOptions.dataSources
            : discoverDataSources(discoveryOptions);
          cachedSourcesAt = Date.now();
          slowSources = cachedSources.filter((s) => isSlowSource(s));
        }
        if (slowSources.length > 0) {
          cachedSlowConvs = discoverConversations({
            ...discoveryOptions,
            dataSources: slowSources,
          });
        }
        cachedSlowConvsAt = Date.now();
      } catch {
        // Ignore background cross-side warm-up errors
      }
    }, 0);
    slowWarmupTimer.unref?.();
  }

  function getCachedHookEvents(convId) {
    const dataDir = getDefaultDataDir(stateStoreOptions);
    const safeStem = sanitizeConvId(convId);
    const hookPath = path.join(dataDir, 'hooks', `${safeStem}.jsonl`);
    const st = safeStat(hookPath);
    if (!st || !st.isFile()) {
      hookEventsCache.delete(convId);
      return { events: [], sig: '0:0' };
    }
    const prev = hookEventsCache.get(convId);
    if (prev && prev.mtimeMs === st.mtimeMs && prev.size === st.size) {
      return prev;
    }
    const events = readHookEvents(convId, stateStoreOptions);
    const sig = `${st.mtimeMs}:${st.size}:${events.length}`;
    const entry = { mtimeMs: st.mtimeMs, size: st.size, events, sig };
    hookEventsCache.set(convId, entry);
    return entry;
  }

  function discoverMergedConversations({ forceRefresh = false, focusConvId = '' } = {}) {
    const now = Date.now();

    // Cold-start fast path: if requesting a specific conversation before any cross-OS
    // `/mnt/c` or `\\wsl` scan has occurred, probe local ext4/NTFS sources first and
    // return immediately if found, warming up slow cross-OS sources asynchronously.
    if (
      !cachedSources &&
      !forceRefresh &&
      cachedSlowConvsAt === 0 &&
      focusConvId &&
      !Array.isArray(discoveryOptions.dataSources)
    ) {
      const platform = discoveryOptions.platform || process.platform;
      const localProbeOpts =
        platform === 'win32'
          ? { ...discoveryOptions, wslUncRoot: null }
          : { ...discoveryOptions, mntCRoot: null };
      const localSources = discoverDataSources(localProbeOpts);
      const localFastConvs =
        localSources.length > 0
          ? discoverConversations({ ...discoveryOptions, dataSources: localSources })
          : [];
      if (localFastConvs.some((c) => c.conversationId === focusConvId)) {
        scheduleSlowSourcesWarmup(null);
        return localFastConvs;
      }
    }

    if (!cachedSources || forceRefresh || now - cachedSourcesAt > Math.max(crossSideTtlMs, 5_000)) {
      cachedSources = Array.isArray(discoveryOptions.dataSources)
        ? discoveryOptions.dataSources
        : discoverDataSources(discoveryOptions);
      cachedSourcesAt = now;
    }

    const fastSources = [];
    const slowSources = [];
    for (const src of cachedSources) {
      if (isSlowSource(src)) {
        slowSources.push(src);
      } else {
        fastSources.push(src);
      }
    }

    const fastConvs = fastSources.length > 0
      ? discoverConversations({ ...discoveryOptions, dataSources: fastSources })
      : [];

    if (slowSources.length > 0) {
      if (
        !forceRefresh &&
        cachedSlowConvsAt === 0 &&
        focusConvId &&
        fastConvs.some((c) => c.conversationId === focusConvId)
      ) {
        scheduleSlowSourcesWarmup(slowSources);
        return fastConvs;
      }

      if (forceRefresh || crossSideTtlMs <= 0 || now - cachedSlowConvsAt >= crossSideTtlMs) {
        cachedSlowConvs = discoverConversations({ ...discoveryOptions, dataSources: slowSources });
        cachedSlowConvsAt = now;
      } else if (focusConvId) {
        // Re-stat focused cross-side conversation immediately if actively viewed
        const idx = cachedSlowConvs.findIndex((c) => c.conversationId === focusConvId);
        if (idx >= 0) {
          const st = safeStat(cachedSlowConvs[idx].transcriptPath);
          if (st && st.isFile()) {
            cachedSlowConvs[idx] = {
              ...cachedSlowConvs[idx],
              mtimeMs: st.mtimeMs,
              size: st.size,
            };
          }
        }
      }
    } else {
      cachedSlowConvs = [];
    }

    if (cachedSlowConvs.length === 0) {
      return fastConvs;
    }

    // Deduplicate fast + slow conversations by conversationId (keeping latest mtimeMs)
    const byId = new Map();
    for (const c of [...fastConvs, ...cachedSlowConvs]) {
      const existing = byId.get(c.conversationId);
      if (
        !existing ||
        c.mtimeMs > existing.mtimeMs ||
        (c.mtimeMs === existing.mtimeMs &&
          ((c.isLocalSide && !existing.isLocalSide) ||
            (c.isLocalSide === existing.isLocalSide && c.size > existing.size)))
      ) {
        byId.set(c.conversationId, c);
      }
    }

    return Array.from(byId.values()).sort((a, b) => {
      if (b.mtimeMs !== a.mtimeMs) return b.mtimeMs - a.mtimeMs;
      return a.conversationId.localeCompare(b.conversationId);
    });
  }

  async function refreshSnapshot({ forceRefresh = false, focusConvId = '' } = {}) {
    const conversations = discoverMergedConversations({ forceRefresh, focusConvId });
    const hookSigs = [];
    const parsedByConvId = transcriptIndex.syncConversations(conversations, (conv) => {
      const h = getCachedHookEvents(conv.conversationId);
      hookSigs.push(`${conv.conversationId}:${h.sig}`);
      return h.events;
    });

    // Compute fingerprint to avoid redundant SQLite openings across 9P when nothing changed
    const dbParts = [];
    const seenDbs = new Set();
    for (const conv of conversations) {
      if (conv.dbPath && !seenDbs.has(conv.dbPath)) {
        seenDbs.add(conv.dbPath);
        if (!conv.isLocalSide && isSlowCrossOsFsPath(conv.dbPath) && !forceRefresh && cachedHierarchyResult) {
          dbParts.push(`${conv.dbPath}:cached`);
        } else {
          const st = safeStat(conv.dbPath);
          dbParts.push(`${conv.dbPath}:${st ? `${st.mtimeMs}:${st.size}` : 'none'}`);
        }
      }
    }
    if (Array.isArray(metadataOptions.dbPaths)) {
      for (const p of metadataOptions.dbPaths) {
        const st = safeStat(p);
        dbParts.push(`${p}:${st ? `${st.mtimeMs}:${st.size}` : 'none'}`);
      }
    }

    const convFingerprintParts = conversations.map((c) => {
      const p = parsedByConvId.get(c.conversationId);
      const childCount = p?.metadataHints?.spawnedChildren?.length || 0;
      return `${c.conversationId}:${c.surface}:${c.mtimeMs}:${c.size}:${p?.nextOffset ?? 0}:${childCount}:${p?.modelName || ''}`;
    });

    const hierarchyKey = shortHash(
      `${convFingerprintParts.join('|')}||${hookSigs.join('|')}||${dbParts.join('|')}`,
    );

    let hierarchy = cachedHierarchyResult;
    if (!hierarchy || cachedHierarchyKey !== hierarchyKey || forceRefresh) {
      hierarchy = await resolveMetadataAndHierarchy(conversations, parsedByConvId, metadataOptions);
      cachedHierarchyKey = hierarchyKey;
      cachedHierarchyResult = hierarchy;
    }

    return {
      conversations,
      parsedByConvId,
      hierarchy,
      snapshotHash: hierarchyKey,
    };
  }

  function getCachedCustomizations(workspacePath, geminiDir, forceRefresh = false) {
    const effectiveGeminiDir =
      geminiDir ||
      discoveryOptions.extraRoots?.[0]?.geminiDir ||
      (discoveryOptions.homeDir ? path.join(discoveryOptions.homeDir, '.gemini') : '');
    const cacheKey = `${workspacePath || ''}::${effectiveGeminiDir || ''}`;
    const now = Date.now();
    const effectiveTtlMs =
      typeof options.customizationsTtlMs === 'number'
        ? options.customizationsTtlMs
        : isSlowCrossOsFsPath(workspacePath) || isSlowCrossOsFsPath(effectiveGeminiDir)
          ? Math.max(customizationsTtlMs, 60_000)
          : customizationsTtlMs;
    const hit = customizationsCache.get(cacheKey);
    if (hit && !forceRefresh && now - hit.ts < effectiveTtlMs) {
      return hit.value;
    }
    const value = scanWorkspaceAndGlobalCustomizations({
      workspacePath,
      geminiDir: effectiveGeminiDir || undefined,
      homeDir: discoveryOptions.homeDir || options.homeDir || undefined,
    });
    customizationsCache.set(cacheKey, { ts: now, value });
    return value;
  }

  async function getConversationResponse({
    requestedConvId = '',
    defaultConvId = '',
    forceRefresh = false,
  } = {}) {
    const snap = await refreshSnapshot({
      forceRefresh,
      focusConvId: requestedConvId || defaultConvId,
    });
    const { conversations, parsedByConvId, hierarchy, snapshotHash } = snap;
    const settings = readSettings(stateStoreOptions);

    // Resolve target conversationId:
    // 1. Explicit `?conversationId=...` query param
    // 2. Host `defaultConvId` (if it exists in discovered conversations)
    // 3. Fallback to most recently active conversation
    let targetConvId = String(requestedConvId || '').trim();
    if (!targetConvId) {
      if (defaultConvId && hierarchy.byId.has(defaultConvId)) {
        targetConvId = defaultConvId;
      } else if (conversations.length > 0) {
        targetConvId = conversations[0].conversationId;
      } else if (defaultConvId) {
        targetConvId = defaultConvId;
      }
    }

    const enableChatAlert = Boolean(settings.enableChatAlert);
    const enableChatStatusBar = settings.enableChatStatusBar !== false;

    const etag = `conv-${shortHash(
      `${targetConvId}|${snapshotHash}|${enableChatAlert ? 1 : 0}|${enableChatStatusBar ? 1 : 0}|v${settingsVersion}`,
    )}`;

    const cached = cachedConvPayloads.get(targetConvId || '__empty__');
    if (cached && cached.etag === etag && !forceRefresh) {
      return { etag, payload: cached.payload };
    }

    const availableConversations = hierarchy.records.map((rec) => ({
      conversationId: rec.conversationId,
      title: rec.title,
      surface: rec.surface,
      isLocalSide: rec.isLocalSide,
      workspace: rec.workspace,
      project: rec.project,
      totalTokens: rec.combinedTotalTokens,
      mtimeMs: rec.mtimeMs,
    }));

    const record = targetConvId ? hierarchy.byId.get(targetConvId) || null : null;
    const parsed = targetConvId ? parsedByConvId.get(targetConvId) || null : null;
    const fallbackGlobalModel =
      hierarchy.records.map((r) => canonicalizeModelName(r?.modelName)).find(Boolean) ||
      conversations.map((c) => canonicalizeModelName(c?.defaultModelRaw)).find(Boolean) ||
      '';

    const enrichSubagentItem = (sub) => {
      const subId = sub?.conversationId || '';
      const subParsed = subId ? parsedByConvId.get(subId) : null;
      const selfContextTokens = Math.max(0, Number(sub?.selfContextTokens) || 0);
      return {
        ...sub,
        modelName: resolveCleanModel(sub?.modelName, subParsed?.modelName, fallbackGlobalModel),
        contextUsedPercent: Number(((selfContextTokens / CONTEXT_LIMIT) * 100).toFixed(1)),
        checkpointCount: subParsed?.checkpoints?.count || 0,
        requestCount: subParsed?.totals?.requestCount || 0,
      };
    };

    if (!record || !parsed) {
      const emptyWindow = buildEmptyContextWindow();
      const emptyPayload = {
        unchanged: false,
        etag,
        conversationId: targetConvId || null,
        title: targetConvId ? `Conversation ${targetConvId.slice(0, 8)}` : '暂无活跃会话',
        surface: process.platform === 'win32' ? 'Desktop (Win)' : 'Desktop (WSL)',
        isLocalSide: true,
        workspace: '',
        project: '',
        modelName: resolveCleanModel(fallbackGlobalModel),
        isSubagent: false,
        role: null,
        parentConversationId: null,
        rootConversationId: targetConvId || null,
        ancestors: [],
        siblingSubagents: [],
        settings: { enableChatAlert, enableChatStatusBar },
        consumption: {
          combinedTotalTokens: 0,
          selfTotalTokens: 0,
          subagentsTotalTokens: 0,
          selfSharePercent: 100,
          subagentsSharePercent: 0,
          subagents: [],
          inputTokens: 0,
          outputTokens: 0,
          cacheReadTokens: 0,
          cacheHitRate: 0,
          avgTokensPerSec: 0,
          avgStepDurationMs: 0,
          lastStepDurationMs: 0,
          turnCount: 0,
          stepCount: 0,
          requestCount: 0,
        },
        checkpoints: { count: 0, latest: null, items: [] },
        contextWindow: {
          limit: CONTEXT_LIMIT,
          autocompactBuffer: AUTOCOMPACT_BUFFER,
          safeLimit: SAFE_LIMIT,
          usedTokens: 0,
          usedPercent: 0,
          freeTokens: SAFE_LIMIT,
          alertLevel: 'normal',
          categories: emptyWindow.categories,
          deferred: emptyWindow.deferred,
          drawers: emptyWindow.drawers,
        },
        availableConversations,
      };
      cachedConvPayloads.set(targetConvId || '__empty__', { etag, payload: emptyPayload });
      return { etag, payload: emptyPayload };
    }

    const convEntry = conversations.find((c) => c.conversationId === targetConvId);
    const customizations = getCachedCustomizations(
      record.workspace,
      convEntry?.geminiDir || '',
      forceRefresh,
    );
    const rawContextWindow = computeContextBreakdown({
      steps: parsed.steps,
      workspacePath: record.workspace,
      geminiDir: convEntry?.geminiDir || undefined,
      options: { customizations },
    });

    const enrichedMcpDrawer = Array.isArray(rawContextWindow.drawers?.mcp)
      ? rawContextWindow.drawers.mcp.map((item) => ({
          ...item,
          lazy: item.mode === 'lazy' || Boolean(item.lazy),
          eager: item.mode !== 'lazy' && !item.lazy,
        }))
      : [];

    const turnCount =
      parsed.steps.filter(
        (s) =>
          s.type === 'USER_INPUT' &&
          String(s.source || '').toUpperCase() !== 'SYSTEM' &&
          !String(s.summary || '').trimStart().startsWith('<SYSTEM_MESSAGE>'),
      ).length || (parsed.steps.length > 0 ? 1 : 0);
    const stepCount =
      parsed.steps.length > 0
        ? Math.max(
            parsed.steps.length,
            (parsed.steps[parsed.steps.length - 1]?.stepIndex ?? 0) + 1,
          )
        : 0;
    const requestCount = parsed.totals?.requestCount || 0;

    const isSubagent = Boolean(
      record.parentConversationId && hierarchy.byId.has(record.parentConversationId),
    );
    const ancestors = [];
    if (isSubagent) {
      const seenAncestors = new Set([record.conversationId]);
      let cursorId = record.parentConversationId;
      while (cursorId && !seenAncestors.has(cursorId) && hierarchy.byId.has(cursorId)) {
        seenAncestors.add(cursorId);
        const ancRec = hierarchy.byId.get(cursorId);
        ancestors.push({
          conversationId: ancRec.conversationId,
          title: ancRec.title,
          role: ancRec.role || null,
          selfContextTokens: ancRec.selfContextTokens || 0,
          combinedTotalTokens: ancRec.combinedTotalTokens || 0,
        });
        cursorId = ancRec.parentConversationId;
      }
      ancestors.reverse();
    }

    const rootConversationId =
      (isSubagent && ancestors.length > 0 ? ancestors[0].conversationId : null) ||
      record.rootConversationId ||
      record.conversationId ||
      null;
    const rootRecord =
      isSubagent && rootConversationId ? hierarchy.byId.get(rootConversationId) || null : null;
    const enrichedSubagents = Array.isArray(record.consumption?.subagents)
      ? record.consumption.subagents.map(enrichSubagentItem)
      : [];
    const siblingSubagents =
      isSubagent && Array.isArray(rootRecord?.consumption?.subagents)
        ? rootRecord.consumption.subagents.map(enrichSubagentItem)
        : [];

    const payload = {
      unchanged: false,
      etag,
      conversationId: record.conversationId,
      title: record.title,
      surface: record.surface,
      isLocalSide: record.isLocalSide,
      workspace: record.workspace,
      project: record.project,
      modelName: resolveCleanModel(
        record.modelName,
        parsed.modelName,
        convEntry?.defaultModelRaw,
        fallbackGlobalModel,
      ),
      isSubagent,
      role: record.role || null,
      parentConversationId: record.parentConversationId || null,
      rootConversationId,
      ancestors,
      siblingSubagents,
      settings: { enableChatAlert, enableChatStatusBar },
      consumption: {
        ...record.consumption,
        subagents: enrichedSubagents,
        turnCount,
        stepCount,
        requestCount,
      },
      checkpoints: parsed.checkpoints || { count: 0, latest: null, items: [] },
      contextWindow: {
        ...rawContextWindow,
        drawers: {
          ...rawContextWindow.drawers,
          mcp: enrichedMcpDrawer,
        },
      },
      availableConversations,
    };

    cachedConvPayloads.set(targetConvId, { etag, payload });
    return { etag, payload };
  }

  async function getGlobalResponse({ forceRefresh = false } = {}) {
    const snap = await refreshSnapshot({ forceRefresh });
    const { conversations, parsedByConvId, hierarchy, snapshotHash } = snap;
    const nowMs = getNowMs();
    const todayKey = formatLocalDate(nowMs);

    const etag = `glob-${shortHash(`${snapshotHash}|${todayKey}`)}`;
    if (cachedGlobalPayload && cachedGlobalEtag === etag && !forceRefresh) {
      return { etag, payload: cachedGlobalPayload };
    }

    let totalTokens = 0;
    let longestTaskDurationMs = 0;

    // Map<YYYY-MM-DD, { tokens: number, requests: number }> across all history
    const dailyByDate = new Map();
    const activeDates = [];
    const requests = [];
    const projectRankings = [];
    const modelAggMap = new Map();
    const fallbackGlobalModel =
      hierarchy.records.map((r) => canonicalizeModelName(r?.modelName)).find(Boolean) ||
      conversations.map((c) => canonicalizeModelName(c?.defaultModelRaw)).find(Boolean) ||
      '';

    for (const conv of conversations) {
      const convId = conv.conversationId;
      const parsed = parsedByConvId.get(convId);
      const meta = hierarchy.byId.get(convId);
      if (!parsed || !meta) continue;

      totalTokens += parsed.selfTotalTokens;
      if (parsed.maxTurnDurationMs > longestTaskDurationMs) {
        longestTaskDurationMs = parsed.maxTurnDurationMs;
      }

      const projectLabel =
        meta.project || deriveProjectName(meta.workspace, '', meta.projectId) || '未绑定项目';
      let lastStepTs = conv.mtimeMs || 0;

      for (const step of parsed.steps) {
        const isLoggableStep =
          step.type === 'PLANNER_RESPONSE' ||
          step.type === 'CHECKPOINT' ||
          (step.status === 'error' && step.type !== 'USER_INPUT');
        if (!isLoggableStep && step.totalTokens <= 0) continue;

        const stepTs = step.createdAtMs || conv.mtimeMs || nowMs;
        if (stepTs > lastStepTs) lastStepTs = stepTs;
        const stepDate = step.date || formatLocalDate(stepTs);

        if (stepDate && (step.totalTokens > 0 || isLoggableStep)) {
          let dayRec = dailyByDate.get(stepDate);
          if (!dayRec) {
            dayRec = { tokens: 0, requests: 0 };
            dailyByDate.set(stepDate, dayRec);
          }
          dayRec.tokens += step.totalTokens;
          if (isLoggableStep) {
            dayRec.requests += 1;
          }
        }

        if (!isLoggableStep) continue;

        const modelName = resolveCleanModel(
          step.modelName,
          meta.modelName,
          parsed.modelName,
          conv.defaultModelRaw,
          fallbackGlobalModel,
        );
        const displayContextTokens =
          step.type === 'CHECKPOINT' && typeof step.afterTokens === 'number'
            ? step.afterTokens
            : step.contextTokens;
        const preCheckpointContextTokens =
          step.type === 'CHECKPOINT'
            ? Number(step.beforeTokens ?? step.preCheckpointContextTokens) || 0
            : 0;

        requests.push({
          id: `${convId}:${step.stepIndex}`,
          timestamp: stepTs,
          isoTime: step.isoTime || new Date(stepTs).toISOString(),
          date: stepDate,
          surface: meta.surface,
          isLocalSide: meta.isLocalSide,
          project: projectLabel,
          workspace: meta.workspace,
          conversationId: convId,
          conversationTitle: meta.title,
          stepIndex: step.stepIndex,
          model: modelName,
          status: step.status,
          contextTokens: displayContextTokens,
          preCheckpointContextTokens,
          cacheHitRate: step.cacheHitRate,
          inputTokens: step.inputTokens,
          outputTokens: step.outputTokens,
          cacheReadTokens: step.cacheReadTokens,
          totalTokens: step.totalTokens,
          tokensPerSec: step.tokensPerSec,
          durationMs: step.durationMs,
        });

        // Aggregate model summary
        let mAgg = modelAggMap.get(modelName);
        if (!mAgg) {
          mAgg = {
            model: modelName,
            requestCount: 0,
            totalTokens: 0,
            inputTokens: 0,
            cacheReadTokens: 0,
            outputTokens: 0,
            durationMsSum: 0,
            speedOutputTokensSum: 0,
          };
          modelAggMap.set(modelName, mAgg);
        }
        mAgg.requestCount += 1;
        mAgg.totalTokens += step.totalTokens;
        mAgg.inputTokens += step.inputTokens;
        mAgg.cacheReadTokens += step.cacheReadTokens;
        mAgg.outputTokens += step.outputTokens;
        if (step.durationMs > 0 && step.outputTokens > 0) {
          mAgg.durationMsSum += step.durationMs;
          mAgg.speedOutputTokensSum += step.outputTokens;
        }
      }

      if (parsed.totals.requestCount > 0 || parsed.selfTotalTokens > 0) {
        projectRankings.push({
          conversationId: convId,
          project: projectLabel,
          title: meta.title,
          workspace: meta.workspace,
          surface: meta.surface,
          isLocalSide: meta.isLocalSide,
          model: resolveCleanModel(
            meta.modelName,
            parsed.modelName,
            conv.defaultModelRaw,
            fallbackGlobalModel,
          ),
          requestCount: parsed.totals.requestCount,
          totalTokens: parsed.selfTotalTokens,
          outputTokens: parsed.totals.outputTokens,
          avgCacheHitRate: parsed.totals.cacheHitRate,
          avgTokensPerSec: parsed.totals.avgTokensPerSec,
          lastActiveAt: lastStepTs,
        });
      }
    }

    // Peak daily tokens & active streak dates
    let peakDailyTokens = 0;
    let peakDailyDate = '';
    const sortedAllDates = Array.from(dailyByDate.keys()).sort();
    for (const dateKey of sortedAllDates) {
      const rec = dailyByDate.get(dateKey);
      if (rec.tokens > 0 || rec.requests > 0) {
        activeDates.push(dateKey);
      }
      if (rec.tokens > peakDailyTokens) {
        peakDailyTokens = rec.tokens;
        peakDailyDate = dateKey;
      }
    }

    const { longestStreakDays, currentStreakDays } = computeGlobalStreaks(activeDates, todayKey);

    // Build 365-day daily series, Monday-Sunday weekly series, and cumulative series
    const todaySerial = dateKeyToSerial(todayKey);
    const startSerial = todaySerial - 364;
    const startDateKey = serialToDateKey(startSerial);

    let tokensBeforeWindow = 0;
    for (const [dateKey, rec] of dailyByDate.entries()) {
      if (dateKey < startDateKey) {
        tokensBeforeWindow += rec.tokens;
      }
    }

    const daily = [];
    const cumulative = [];
    const weeklyByStart = new Map();
    let runningCumulative = tokensBeforeWindow;

    for (let s = startSerial; s <= todaySerial; s += 1) {
      const dateKey = serialToDateKey(s);
      const dayStat = dailyByDate.get(dateKey);
      const dayTokens = dayStat ? dayStat.tokens : 0;
      const dayReqs = dayStat ? dayStat.requests : 0;

      daily.push({
        date: dateKey,
        tokens: dayTokens,
        requests: dayReqs,
      });

      runningCumulative += dayTokens;
      cumulative.push({
        date: dateKey,
        tokens: runningCumulative,
        dailyTokens: dayTokens,
      });

      // Monday = 0 .. Sunday = 6 in UTC on `s * 86_400_000`
      const dayOfWeek = new Date(s * 86_400_000).getUTCDay();
      const mondayOffset = (dayOfWeek + 6) % 7;
      const weekStartSerial = s - mondayOffset;
      const weekEndSerial = weekStartSerial + 6;
      const weekStart = serialToDateKey(weekStartSerial);
      const weekEnd = serialToDateKey(weekEndSerial);

      let wk = weeklyByStart.get(weekStart);
      if (!wk) {
        wk = {
          weekStart,
          weekEnd,
          label: weekStart.slice(5),
          tokens: 0,
          requests: 0,
        };
        weeklyByStart.set(weekStart, wk);
      }
      wk.tokens += dayTokens;
      wk.requests += dayReqs;
    }

    const weekly = Array.from(weeklyByStart.values());

    // Sort requests newest first
    requests.sort((a, b) => {
      if (b.timestamp !== a.timestamp) return b.timestamp - a.timestamp;
      if (b.stepIndex !== a.stepIndex) return b.stepIndex - a.stepIndex;
      return a.id.localeCompare(b.id);
    });

    // Sort projectRankings by totalTokens descending
    projectRankings.sort((a, b) => {
      if (b.totalTokens !== a.totalTokens) return b.totalTokens - a.totalTokens;
      return b.lastActiveAt - a.lastActiveAt;
    });

    // Finalize modelSummary sorted by totalTokens descending
    const modelSummary = Array.from(modelAggMap.values())
      .map((m) => {
        const promptTok = m.inputTokens + m.cacheReadTokens;
        return {
          model: m.model,
          requestCount: m.requestCount,
          totalTokens: m.totalTokens,
          outputTokens: m.outputTokens,
          inputTokens: m.inputTokens,
          cacheReadTokens: m.cacheReadTokens,
          avgCacheHitRate: promptTok > 0 ? m.cacheReadTokens / promptTok : 0,
          avgTokensPerSec:
            m.durationMsSum > 0
              ? Number((m.speedOutputTokensSum / (m.durationMsSum / 1000)).toFixed(2))
              : 0,
        };
      })
      .sort((a, b) => {
        if (b.totalTokens !== a.totalTokens) return b.totalTokens - a.totalTokens;
        return b.requestCount - a.requestCount;
      });

    const payload = {
      unchanged: false,
      etag,
      metrics: {
        totalTokens,
        peakDailyTokens,
        peakDailyDate,
        longestTaskDurationMs,
        longestStreakDays,
        currentStreakDays,
      },
      activity: {
        daily,
        weekly,
        cumulative,
      },
      requests,
      projectRankings,
      modelSummary,
    };

    cachedGlobalEtag = etag;
    cachedGlobalPayload = payload;
    return { etag, payload };
  }

  function normalizeEngineSettings(raw) {
    const base = raw && typeof raw === 'object' ? raw : {};
    return {
      ...base,
      enableChatAlert: Boolean(base.enableChatAlert),
      enableChatStatusBar: base.enableChatStatusBar !== false,
    };
  }

  function getSettings() {
    return normalizeEngineSettings(readSettings(stateStoreOptions));
  }

  function updateSettings(patch) {
    const updated = writeSettings(patch, stateStoreOptions);
    settingsVersion += 1;
    cachedConvPayloads.clear();
    return normalizeEngineSettings(updated);
  }

  function dispose() {
    disposed = true;
    if (slowWarmupTimer) {
      clearTimeout(slowWarmupTimer);
      slowWarmupTimer = null;
    }
  }

  return {
    transcriptIndex,
    getConversationResponse,
    getGlobalResponse,
    getSettings,
    updateSettings,
    dispose,
  };
}

function readJsonRequestBody(req, maxBytes = MAX_JSON_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    let aborted = false;

    req.on('data', (chunk) => {
      if (aborted) return;
      total += chunk.length;
      if (total > maxBytes) {
        aborted = true;
        const err = new Error('Payload Too Large');
        err.statusCode = 413;
        reject(err);
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      if (aborted) return;
      const raw = Buffer.concat(chunks).toString('utf-8').trim();
      if (!raw) {
        resolve({});
        return;
      }
      try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          const err = new Error('JSON body must be an object');
          err.statusCode = 400;
          reject(err);
          return;
        }
        resolve(parsed);
      } catch {
        const err = new Error('Invalid JSON body');
        err.statusCode = 400;
        reject(err);
      }
    });

    req.on('error', (err) => {
      if (!aborted) reject(err);
    });
  });
}

function sendJson(res, status, data, extraHeaders = {}) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-cache',
    ...extraHeaders,
  });
  res.end(body);
}

/**
 * Validates a client-reported origin strictly as loopback HTTP (`localhost` or `127.0.0.1`
 * with valid TCP port `1..65535`), falling back to `http://127.0.0.1:<fallbackPort>`.
 */
export function resolveSafeFullscreenOrigin(rawOrigin, fallbackPort) {
  if (typeof rawOrigin === 'string') {
    const trimmed = rawOrigin.trim();
    const match = /^http:\/\/(?:localhost|127\.0\.0\.1):(\d{1,5})$/.exec(trimmed);
    if (match) {
      const portNum = Number(match[1]);
      if (Number.isInteger(portNum) && portNum >= 1 && portNum <= 65_535) {
        return trimmed;
      }
    }
  }
  return `http://${BIND_HOST}:${fallbackPort}`;
}

/**
 * Launches `targetUrl` in the host OS / Windows default browser using `child_process.spawn`
 * with `detached: true, stdio: 'ignore'` and `shell: false` (never `cmd.exe /c start`, so
 * `&` query separators are never shell-interpreted). Never throws if the launcher is absent.
 */
export function launchExternalBrowser(targetUrl, envOpts = {}) {
  return new Promise((resolve) => {
    const platform = envOpts.platform || process.platform;
    const wslRundllPath = envOpts.wslRundllPath || '/mnt/c/Windows/System32/rundll32.exe';
    let cmd = envOpts.linuxOpenCmd || 'xdg-open';
    let args = [targetUrl];

    if (platform === 'win32') {
      cmd = 'rundll32.exe';
      args = ['url.dll,FileProtocolHandler', targetUrl];
    } else if (platform === 'linux' && safeStat(wslRundllPath)?.isFile()) {
      cmd = wslRundllPath;
      args = ['url.dll,FileProtocolHandler', targetUrl];
    } else if (platform === 'darwin') {
      cmd = 'open';
      args = [targetUrl];
    }

    let settled = false;
    try {
      const child = spawn(cmd, args, {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
      });
      child.on('error', () => {
        if (!settled) {
          settled = true;
          resolve(false);
        }
      });
      child.once('spawn', () => {
        child.unref();
        if (!settled) {
          settled = true;
          resolve(true);
        }
      });
    } catch {
      if (!settled) {
        settled = true;
        resolve(false);
      }
    }
  });
}

/**
 * Creates and starts the `agy-monitor` Sidecar HTTP server bound strictly to `127.0.0.1`.
 */
export async function createMonitorServer(options = {}) {
  if (options.host && options.host !== BIND_HOST) {
    throw new Error(`Security policy violation: agy-monitor must bind strictly to ${BIND_HOST}`);
  }

  const webDir = path.resolve(options.webDir ?? DEFAULT_WEB_DIR);
  const assetsDir = path.resolve(options.assetsDir ?? DEFAULT_ASSETS_DIR);
  const envPort = process.env.ANTIGRAVITY_SIDECAR_WEB_PORT
    ? Number.parseInt(process.env.ANTIGRAVITY_SIDECAR_WEB_PORT, 10)
    : NaN;
  const requestedPort =
    typeof options.port === 'number'
      ? options.port
      : Number.isFinite(envPort)
        ? envPort
        : 0;

  const token = String(
    options.token ??
      process.env.ANTIGRAVITY_SIDECAR_UI_TOKEN ??
      process.env.ANTIGRAVITY_SIDECAR_AUTH_TOKEN ??
      process.env.ANTIGRAVITY_SIDECAR_WEB_TOKEN ??
      crypto.randomBytes(24).toString('hex'),
  );

  const hasCustomSandbox = Boolean(
    options.discoveryOptions || options.dataDir || options.ignoreEnvConversationId,
  );
  const defaultConvId =
    options.defaultConversationId ??
    (hasCustomSandbox ? '' : process.env.ANTIGRAVITY_CONVERSATION_ID || '');

  const { sdk, preloadJs, source: sdkSource } = await resolveSidecarSdk(options);
  const engine = options.engine || createMonitorEngine(options);

  // Instantiate SidecarApp when running inside full AGY Sidecar runtime
  const isFullSidecarEnv = Boolean(
    sdk?.SidecarApp &&
      !hasCustomSandbox &&
      options.port === undefined &&
      process.env.ANTIGRAVITY_LS_ADDRESS &&
      process.env.ANTIGRAVITY_CSRF_TOKEN &&
      process.env.ANTIGRAVITY_SIDECAR_WEB_PORT,
  );
  const sdkApp = isFullSidecarEnv ? new sdk.SidecarApp() : null;

  function isTokenAuthorized(req, allowQueryToken = false, url = null) {
    const headerVal =
      typeof req.headers['x-sidecar-token'] === 'string'
        ? req.headers['x-sidecar-token'].trim()
        : '';
    if (headerVal && timingSafeTokenMatch(headerVal, token)) {
      return true;
    }
    if (allowQueryToken && url) {
      const qVal = (url.searchParams.get('token') || '').trim();
      if (qVal && timingSafeTokenMatch(qVal, token)) {
        return true;
      }
    }
    return false;
  }

  let cachedClassicAppJs = null; // { mtimeMs, size, body }

  function serveAppClassicJs(res) {
    const appJsPath = path.join(webDir, 'app.js');
    const st = safeStat(appJsPath);
    if (!st || !st.isFile()) {
      sendJson(res, 404, { error: 'app.js not found' });
      return;
    }
    if (
      !cachedClassicAppJs ||
      cachedClassicAppJs.mtimeMs !== st.mtimeMs ||
      cachedClassicAppJs.size !== st.size
    ) {
      const esmSource = fs.readFileSync(appJsPath, 'utf-8');
      cachedClassicAppJs = {
        mtimeMs: st.mtimeMs,
        size: st.size,
        body: transformEsmToClassicJs(esmSource),
      };
    }
    res.writeHead(200, {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-cache',
    });
    res.end(cachedClassicAppJs.body);
  }

  function serveHtmlIndex(req, res, url) {
    const indexPath = path.join(webDir, 'index.html');
    const st = safeStat(indexPath);
    if (!st || !st.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('index.html not found');
      return;
    }
    let html = fs.readFileSync(indexPath, 'utf-8');
    const authorized = isTokenAuthorized(req, true, url);
    const resolvedConvId = String(
      url.searchParams.get('conversationId') || defaultConvId || '',
    ).trim();

    const metaTags = [];
    if (authorized) {
      metaTags.push(`  <meta name="sidecar-token" content="${escapeHtmlAttr(token)}">`);
      const encodedToken = encodeURIComponent(token);
      html = html.replace(
        /\b(src|href)=(["'])(\/(?:preload\.js|styles\.css|app-classic\.js|app\.js))\2/g,
        `$1=$2$3?token=${encodedToken}$2`,
      );
    }
    if (resolvedConvId) {
      metaTags.push(
        `  <meta name="sidecar-conversation-id" content="${escapeHtmlAttr(resolvedConvId)}">`,
      );
    }

    if (metaTags.length > 0) {
      const metaBlock = `${metaTags.join('\n')}\n`;
      if (/<meta\s+charset=["']utf-8["']\s*\/?>/i.test(html)) {
        html = html.replace(/(<meta\s+charset=["']utf-8["']\s*\/?>\s*\n?)/i, `$1${metaBlock}`);
      } else if (html.includes('<head>')) {
        html = html.replace('<head>', `<head>\n${metaBlock}`);
      } else if (html.includes('</head>')) {
        html = html.replace('</head>', `${metaBlock}</head>`);
      } else {
        html = `${metaBlock}${html}`;
      }
    }

    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache',
    });
    res.end(html);
  }

  function tryServeStaticFile(res, baseDir, relPathname) {
    const safeRel = relPathname.replace(/^\/+/, '');
    if (!safeRel || safeRel.includes('..') || safeRel.includes('\0')) {
      return false;
    }
    const candidate = path.resolve(baseDir, safeRel);
    const resolvedBase = path.resolve(baseDir);
    if (candidate !== resolvedBase && !candidate.startsWith(`${resolvedBase}${path.sep}`)) {
      return false;
    }
    const st = safeStat(candidate);
    if (!st || !st.isFile()) return false;
    const ext = path.extname(candidate).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache',
    });
    res.end(fs.readFileSync(candidate));
    return true;
  }

  async function handleRequest(req, res) {
    try {
      const method = (req.method || 'GET').toUpperCase();
      const url = new URL(req.url || '/', `http://${BIND_HOST}`);
      const pathname = url.pathname || '/';

      // 1. Preload bridge script & classic JS bundle
      if (method === 'GET' && pathname === '/preload.js') {
        res.writeHead(200, {
          'Content-Type': 'application/javascript; charset=utf-8',
          'Cache-Control': 'no-cache',
        });
        res.end(preloadJs);
        return;
      }

      if (method === 'GET' && pathname === '/app-classic.js') {
        serveAppClassicJs(res);
        return;
      }

      // 2. HTML entrypoint (`/` and `/index.html`)
      if (method === 'GET' && (pathname === '/' || pathname === '/index.html')) {
        serveHtmlIndex(req, res, url);
        return;
      }

      // 3. API Routes
      if (pathname === '/api/conversation') {
        if (method !== 'GET') {
          sendJson(res, 405, { error: 'Method Not Allowed' });
          return;
        }
        const requestedConvId = url.searchParams.get('conversationId') || '';
        const forceRefresh = url.searchParams.get('refresh') === '1';
        const { etag, payload } = await engine.getConversationResponse({
          requestedConvId,
          defaultConvId,
          forceRefresh,
        });
        const headers = { ETag: `"${etag}"` };
        if (!forceRefresh && matchesClientEtag(req, url, etag)) {
          sendJson(
            res,
            200,
            { unchanged: true, etag, conversationId: payload.conversationId },
            headers,
          );
          return;
        }
        sendJson(res, 200, payload, headers);
        return;
      }

      if (pathname === '/api/global') {
        if (method !== 'GET') {
          sendJson(res, 405, { error: 'Method Not Allowed' });
          return;
        }
        const forceRefresh = url.searchParams.get('refresh') === '1';
        const { etag, payload } = await engine.getGlobalResponse({ forceRefresh });
        const headers = { ETag: `"${etag}"` };
        if (!forceRefresh && matchesClientEtag(req, url, etag)) {
          sendJson(res, 200, { unchanged: true, etag }, headers);
          return;
        }
        sendJson(res, 200, payload, headers);
        return;
      }

      if (pathname === '/api/settings') {
        if (method === 'GET') {
          const settings = engine.getSettings();
          sendJson(res, 200, {
            ok: true,
            settings,
            enableChatAlert: Boolean(settings.enableChatAlert),
            enableChatStatusBar: settings.enableChatStatusBar !== false,
          });
          return;
        }
        if (method === 'POST') {
          // STRICT write authentication: MUST carry valid `X-Sidecar-Token` header!
          if (!isTokenAuthorized(req, false, null)) {
            sendJson(res, 401, { error: 'Unauthorized' });
            return;
          }
          const body = await readJsonRequestBody(req);
          const patch = {};
          if ('enableChatAlert' in body) {
            if (typeof body.enableChatAlert !== 'boolean') {
              sendJson(res, 400, { error: '"enableChatAlert" must be a boolean' });
              return;
            }
            patch.enableChatAlert = body.enableChatAlert;
          }
          if ('enableChatStatusBar' in body) {
            if (typeof body.enableChatStatusBar !== 'boolean') {
              sendJson(res, 400, { error: '"enableChatStatusBar" must be a boolean' });
              return;
            }
            patch.enableChatStatusBar = body.enableChatStatusBar;
          }
          const updated = engine.updateSettings(patch);
          sendJson(res, 200, {
            ok: true,
            settings: updated,
            enableChatAlert: Boolean(updated.enableChatAlert),
            enableChatStatusBar: updated.enableChatStatusBar !== false,
          });
          return;
        }
        sendJson(res, 405, { error: 'Method Not Allowed' });
        return;
      }

      if (pathname === '/api/open-fullscreen') {
        if (method !== 'POST') {
          sendJson(res, 405, { error: 'Method Not Allowed' });
          return;
        }
        if (!isTokenAuthorized(req, false, null)) {
          sendJson(res, 401, { error: 'Unauthorized' });
          return;
        }
        const body = await readJsonRequestBody(req);
        const addr = server?.address();
        const actualServerPort =
          typeof addr === 'object' && addr && addr.port ? addr.port : requestedPort;
        const safeOrigin = resolveSafeFullscreenOrigin(body?.clientOrigin, actualServerPort);
        const targetUrl = `${safeOrigin}/?tab=global&fullscreen=1&token=${encodeURIComponent(token)}`;

        let opened = false;
        try {
          if (typeof options.openExternalUrl === 'function') {
            const customRes = await options.openExternalUrl(targetUrl);
            if (customRes && typeof customRes === 'object' && 'opened' in customRes) {
              opened = Boolean(customRes.opened);
            } else {
              opened = customRes !== false;
            }
          } else {
            opened = await launchExternalBrowser(targetUrl);
          }
        } catch {
          opened = false;
        }

        sendJson(res, 200, {
          ok: true,
          opened,
          url: targetUrl,
        });
        return;
      }

      // 4. Built-in AGY Sidecar RPC forwarders (`/_sidecar/*`) when `sdkApp` is active
      if (pathname.startsWith('/_sidecar/')) {
        if (method !== 'POST') {
          sendJson(res, 405, { error: 'Method Not Allowed' });
          return;
        }
        if (!isTokenAuthorized(req, false, null)) {
          sendJson(res, 401, { error: 'Unauthorized' });
          return;
        }
        const data = await readJsonRequestBody(req);
        if (!sdkApp) {
          sendJson(res, 200, { response: {} });
          return;
        }
        if (pathname === '/_sidecar/get-conversation-metadata') {
          sendJson(res, 200, sdkApp.getConversationMetadata(data.conversationId));
          return;
        }
        if (pathname === '/_sidecar/send-message') {
          sendJson(
            res,
            200,
            sdkApp.sendMessage(data.conversationId, data.message, {
              title: data.title,
              projectId: data.projectId,
            }),
          );
          return;
        }
        if (pathname === '/_sidecar/new-conversation') {
          sendJson(
            res,
            200,
            sdkApp.startConversation(data.message, {
              model: data.model,
              projectId: data.projectId,
            }),
          );
          return;
        }
      }

      // 5. Static files under `web/` or `/assets/`
      if (method === 'GET') {
        if (pathname.startsWith('/assets/')) {
          if (tryServeStaticFile(res, assetsDir, pathname.slice('/assets/'.length))) {
            return;
          }
        }
        if (tryServeStaticFile(res, webDir, pathname)) {
          return;
        }
      }

      sendJson(res, 404, { error: 'Not Found' });
    } catch (err) {
      const status = typeof err?.statusCode === 'number' ? err.statusCode : 500;
      if (!res.headersSent) {
        sendJson(res, status, { error: err?.message || 'Internal Server Error' });
      } else {
        res.end();
      }
    }
  }

  let server;
  if (sdkApp) {
    server = await sdkApp.run();
    server.removeAllListeners('request');
    server.on('request', handleRequest);
  } else {
    server = http.createServer(handleRequest);
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(requestedPort, BIND_HOST, () => {
        server.removeListener('error', reject);
        resolve();
      });
    });
    if (!options.silent) {
      const addr = server.address();
      const actualPort = typeof addr === 'object' && addr ? addr.port : requestedPort;
      console.log(`[sidecar] listening on ${BIND_HOST}:${actualPort}`);
    }
  }

  const addressInfo = server.address();
  const port = typeof addressInfo === 'object' && addressInfo ? addressInfo.port : requestedPort;
  const host = typeof addressInfo === 'object' && addressInfo ? addressInfo.address : BIND_HOST;

  async function close() {
    engine.dispose?.();
    if (sdkApp) {
      await sdkApp.close();
      return;
    }
    if (!server.listening) return;
    server.closeAllConnections?.();
    await new Promise((resolve) => server.close(() => resolve()));
  }

  return {
    server,
    host,
    port,
    url: `http://${BIND_HOST}:${port}`,
    token,
    sdkSource,
    engine,
    close,
  };
}

const isDirectExecution =
  process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isDirectExecution) {
  createMonitorServer()
    .then((instance) => {
      if (!process.env.ANTIGRAVITY_SIDECAR_WEB_PORT) {
        console.log(
          `[agy-monitor] Standalone preview ready: ${instance.url}/?tab=global&fullscreen=1&token=${instance.token}`,
        );
      }
      const shutdown = () => {
        instance.close().finally(() => process.exit(0));
      };
      process.once('SIGINT', shutdown);
      process.once('SIGTERM', shutdown);
    })
    .catch((err) => {
      console.error(`[agy-monitor] Failed to start sidecar server: ${err.message}`);
      process.exit(1);
    });
}
