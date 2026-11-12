#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import {
  appendHookEvent,
  readHookEvents,
  readSettings,
  updateConversationAlertState,
} from '../sidecars/monitor_pane/lib/state_store.mjs';

export const CONTEXT_LIMIT = 256_000;
export const THRESHOLD_80 = 204_800;
export const THRESHOLD_92 = 235_520;
export const COMPACTION_DROP_THRESHOLD = 100_000;
export const COMPACTION_PREV_HIGH_WATER = 150_000;
export const DEFAULT_TAIL_BYTES = 64 * 1024;

const CLIENT_APPS = ['antigravity', 'antigravity-ide', 'antigravity-cli'];
const SIDECAR_PILL_LINK = '[查看上下文明细](sidecar://agy-monitor/monitor_pane/)';
const SAFE_CHILD_ID_RE = /^[a-zA-Z0-9][a-zA-Z0-9_-]{3,127}$/;
const MAX_MAIN_TRANSCRIPT_BYTES = 8 * 1024 * 1024;
const MAX_CHILD_TRANSCRIPT_BYTES = 4 * 1024 * 1024;
const MAX_CHILD_TRANSCRIPTS = 12;
const CHILD_SCAN_BUDGET_MS = 15;

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeEventLabel(raw) {
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (/^session[-_]?start$/i.test(trimmed)) return 'SessionStart';
  if (/^pre[-_]?invocation$/i.test(trimmed)) return 'PreInvocation';
  if (/^stop$/i.test(trimmed)) return 'Stop';
  return trimmed;
}

/**
 * Determine lifecycle event name from stdin payload, CLI args, or AGY payload schema.
 */
export function resolveEventName(payload, argv = []) {
  const fromPayload = normalizeEventLabel(
    payload?.event || payload?.hookEventName || payload?.hook_event_name || payload?.eventType,
  );
  if (fromPayload) {
    return fromPayload;
  }

  if (Array.isArray(argv)) {
    for (let i = 0; i < argv.length; i += 1) {
      const arg = String(argv[i] ?? '').trim();
      if (!arg) continue;
      if (arg.startsWith('--event=')) {
        const val = normalizeEventLabel(arg.slice('--event='.length));
        if (val) return val;
      } else if (arg === '--event' && i + 1 < argv.length) {
        const val = normalizeEventLabel(argv[i + 1]);
        if (val) return val;
      } else if (!arg.startsWith('-')) {
        const val = normalizeEventLabel(arg);
        if (val === 'SessionStart' || val === 'PreInvocation' || val === 'Stop') {
          return val;
        }
      }
    }
  }

  if (
    'terminationReason' in payload ||
    'fullyIdle' in payload ||
    ('executionNum' in payload && !('invocationNum' in payload))
  ) {
    return 'Stop';
  }

  if ('invocationNum' in payload || 'initialNumSteps' in payload) {
    return 'PreInvocation';
  }

  return 'PreInvocation';
}

function isExistingFile(filePath) {
  if (typeof filePath !== 'string' || !filePath.trim()) return false;
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

/**
 * Resolve transcript.jsonl path via explicit hook payload fields or ~/.gemini/<app>/brain/<convId>/...
 */
export function resolveTranscriptPath(payload, convId, options) {
  const explicit = payload?.transcriptPath || payload?.transcript_path;
  if (isExistingFile(explicit)) {
    return explicit;
  }

  const artifactDir = payload?.artifactDirectoryPath || payload?.artifact_directory_path;
  if (typeof artifactDir === 'string' && artifactDir.trim()) {
    for (const rel of ['.system_generated/logs/transcript.jsonl', 'transcript.jsonl']) {
      const candidate = path.join(artifactDir, rel);
      if (isExistingFile(candidate)) {
        return candidate;
      }
    }
  }

  if (!convId || /[/\\]|\.\./.test(convId)) {
    return null;
  }

  const homeDir = options?.homeDir || os.homedir();
  const geminiRoots = [];
  if (Array.isArray(options?.geminiRoots)) {
    geminiRoots.push(...options.geminiRoots);
  }
  geminiRoots.push(path.join(homeDir, '.gemini'));

  let bestPath = null;
  let bestMtimeMs = -1;

  for (const geminiRoot of geminiRoots) {
    for (const app of CLIENT_APPS) {
      const brainConvDir = path.join(geminiRoot, app, 'brain', convId);
      for (const rel of ['.system_generated/logs/transcript.jsonl', 'transcript.jsonl']) {
        const candidate = path.join(brainConvDir, rel);
        try {
          const st = fs.statSync(candidate);
          if (st.isFile() && st.mtimeMs >= bestMtimeMs) {
            bestMtimeMs = st.mtimeMs;
            bestPath = candidate;
          }
        } catch {
          // Ignore missing candidate
        }
      }
    }
  }

  return bestPath;
}

function parseTranscriptChunkLines(text) {
  let chunkCheckpointCount = 0;
  let sawCheckpointOrPlanner = false;
  let lastRelevantType = null;
  let latestPostCheckpointPlanner = null;

  const lines = text.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const obj = JSON.parse(trimmed);
      if (!isPlainObject(obj)) continue;
      if (obj.type === 'CHECKPOINT') {
        chunkCheckpointCount += 1;
        sawCheckpointOrPlanner = true;
        lastRelevantType = 'CHECKPOINT';
        latestPostCheckpointPlanner = null;
      } else if (obj.type === 'PLANNER_RESPONSE') {
        sawCheckpointOrPlanner = true;
        lastRelevantType = 'PLANNER_RESPONSE';
        latestPostCheckpointPlanner = obj;
      }
    } catch {
      // Skip malformed/incomplete line
    }
  }

  return {
    chunkCheckpointCount,
    sawCheckpointOrPlanner,
    lastRelevantType,
    latestPostCheckpointPlanner,
  };
}

function countCheckpointsBeforeOffset(fd, endOffset) {
  if (endOffset <= 0) return 0;
  const chunkSize = 64 * 1024;
  const buf = Buffer.allocUnsafe(Math.min(chunkSize, endOffset));
  let offset = 0;
  let carry = '';
  let count = 0;

  while (offset < endOffset) {
    const toRead = Math.min(buf.length, endOffset - offset);
    const bytesRead = fs.readSync(fd, buf, 0, toRead, offset);
    if (bytesRead <= 0) break;
    offset += bytesRead;

    const str = carry + buf.subarray(0, bytesRead).toString('utf8');
    const lastNl = str.lastIndexOf('\n');
    if (lastNl === -1) {
      carry = str;
      continue;
    }

    const completePart = str.slice(0, lastNl);
    carry = str.slice(lastNl + 1);

    if (completePart.includes('CHECKPOINT')) {
      for (const line of completePart.split('\n')) {
        if (!line.includes('CHECKPOINT')) continue;
        try {
          const obj = JSON.parse(line);
          if (obj?.type === 'CHECKPOINT') {
            count += 1;
          }
        } catch {
          // Ignore malformed line
        }
      }
    }
  }

  if (carry && carry.includes('CHECKPOINT')) {
    try {
      const obj = JSON.parse(carry);
      if (obj?.type === 'CHECKPOINT') {
        count += 1;
      }
    } catch {
      // Ignore malformed line
    }
  }

  return count;
}

/**
 * Fast-read the tail (default 64KB, expanding automatically if a line spans boundary or
 * no PLANNER_RESPONSE/CHECKPOINT appears in the tail) of transcript.jsonl.
 */
export function inspectTranscriptTail(transcriptPath, options) {
  const tailBytes =
    typeof options?.tailBytes === 'number' && options.tailBytes > 0
      ? Math.floor(options.tailBytes)
      : DEFAULT_TAIL_BYTES;

  const fd = fs.openSync(transcriptPath, 'r');
  try {
    const stat = fs.fstatSync(fd);
    const fileSize = stat.size;
    if (fileSize <= 0) {
      return {
        checkpointCount: 0,
        hasPlannerInCycle: false,
        usedTokens: 0,
        inputTokens: 0,
        cacheReadTokens: 0,
        outputTokens: 0,
      };
    }

    let windowSize = Math.min(fileSize, tailBytes);
    let usableStartOffset = 0;
    let parsed = null;

    while (true) {
      const startOffset = fileSize - windowSize;
      if (startOffset === 0) {
        const fullBuf = Buffer.allocUnsafe(fileSize);
        const bytesRead = fs.readSync(fd, fullBuf, 0, fileSize, 0);
        usableStartOffset = 0;
        parsed = parseTranscriptChunkLines(fullBuf.subarray(0, bytesRead).toString('utf8'));
        break;
      }

      // Read 1 extra preceding byte to check whether startOffset lands on an exact line boundary
      const probeOffset = startOffset - 1;
      const readLen = windowSize + 1;
      const buf = Buffer.allocUnsafe(readLen);
      const bytesRead = fs.readSync(fd, buf, 0, readLen, probeOffset);
      const actualSlice = buf.subarray(0, bytesRead);

      let lineSlice;
      if (actualSlice[0] === 0x0a) {
        // Preceding byte is '\n' -> startOffset is already a clean line start
        usableStartOffset = startOffset;
        lineSlice = actualSlice.subarray(1);
      } else {
        // Drop partial line spanning startOffset boundary
        const firstNl = actualSlice.indexOf(0x0a, 1);
        if (firstNl === -1) {
          // Single line spans the entire tail window -> expand window
          windowSize = Math.min(fileSize, windowSize * 4);
          continue;
        }
        usableStartOffset = probeOffset + firstNl + 1;
        lineSlice = actualSlice.subarray(firstNl + 1);
      }

      parsed = parseTranscriptChunkLines(lineSlice.toString('utf8'));
      if (parsed.sawCheckpointOrPlanner) {
        break;
      }

      // No PLANNER_RESPONSE or CHECKPOINT in current tail window -> expand backwards
      windowSize = Math.min(fileSize, windowSize * 4);
    }

    const prefixCheckpointCount =
      usableStartOffset > 0 ? countCheckpointsBeforeOffset(fd, usableStartOffset) : 0;
    const checkpointCount = prefixCheckpointCount + parsed.chunkCheckpointCount;

    const planner = parsed.latestPostCheckpointPlanner;
    if (!planner) {
      return {
        checkpointCount,
        hasPlannerInCycle: false,
        usedTokens: 0,
        inputTokens: 0,
        cacheReadTokens: 0,
        outputTokens: 0,
      };
    }

    const inputTokens = Number(planner.input_tokens ?? planner.inputTokens ?? 0) || 0;
    const cacheReadTokens = Number(planner.cache_read_tokens ?? planner.cacheReadTokens ?? 0) || 0;
    const outputTokens = Number(planner.output_tokens ?? planner.outputTokens ?? 0) || 0;
    const usedTokens = Math.max(0, inputTokens + cacheReadTokens + outputTokens);

    return {
      checkpointCount,
      hasPlannerInCycle: true,
      usedTokens,
      inputTokens,
      cacheReadTokens,
      outputTokens,
    };
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * Returns true if text is purely an AGY `<SYSTEM_MESSAGE>` wakeup or worker brief without `<USER_REQUEST>`.
 */
export function isSystemMessageOnlyContent(content) {
  if (typeof content !== 'string') return false;
  const trimmed = content.trimStart();
  if (!trimmed) return false;
  if (trimmed.startsWith('<SYSTEM_MESSAGE>')) {
    return true;
  }
  if (trimmed.includes('<SYSTEM_MESSAGE>') && !trimmed.includes('<USER_REQUEST>')) {
    const stripped = trimmed
      .replace(/The following is a <SYSTEM_MESSAGE>[^\n]*\n*/gi, '')
      .replace(/<SYSTEM_MESSAGE>[\s\S]*?<\/SYSTEM_MESSAGE>/gi, '')
      .replace(/<ADDITIONAL_METADATA>[\s\S]*?<\/ADDITIONAL_METADATA>/gi, '')
      .replace(/<user_information>[\s\S]*?<\/user_information>/gi, '')
      .trim();
    if (!stripped) {
      return true;
    }
  }
  return false;
}

export function formatCompactTokens(tokens) {
  const n = Math.max(0, Math.floor(Number(tokens) || 0));
  if (n >= 1_000_000_000) {
    return `${(n / 1_000_000_000).toFixed(2)}B`;
  }
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1)}M`;
  }
  if (n >= 1_000) {
    return `${(n / 1_000).toFixed(1)}k`;
  }
  return String(n);
}

function formatContextShortTokens(tokens) {
  const n = Math.max(0, Math.floor(Number(tokens) || 0));
  if (n >= 1_000) {
    return `${(n / 1_000).toFixed(1)}k`;
  }
  return String(n);
}

export function formatHudMarkdown(hud) {
  const turns = Math.max(0, Math.floor(Number(hud?.turns) || 0));
  const steps = Math.max(0, Math.floor(Number(hud?.steps) || 0));
  const avgTokPerSec = Math.max(0, Math.round(Number(hud?.avgTokPerSec) || 0));
  const combinedTotalTokens = Math.max(0, Math.floor(Number(hud?.combinedTotalTokens) || 0));
  const cacheHitPct = Math.max(0, Math.min(100, Math.round(Number(hud?.cacheHitPct) || 0)));
  const usedTokens = Math.max(0, Math.floor(Number(hud?.usedTokens) || 0));
  const usedPct =
    typeof hud?.usedPct === 'number' && Number.isFinite(hud.usedPct)
      ? Math.max(0, Math.round(hud.usedPct))
      : Math.round((usedTokens / CONTEXT_LIMIT) * 100);

  return `⏱ \`${turns} turns ${steps} steps · ${avgTokPerSec} tok/s\` · 🗄 \`${formatCompactTokens(combinedTotalTokens)} tok · Cache hit ${cacheHitPct}%\` · [◔ ${usedPct}% (${formatContextShortTokens(usedTokens)} / 256k)](sidecar://agy-monitor/monitor_pane/)`;
}

function inferBrainRootDir(transcriptPath, convId) {
  if (typeof transcriptPath !== 'string' || !transcriptPath.trim()) return null;
  const resolved = path.resolve(transcriptPath);
  const norm = resolved.replace(/\\/g, '/');

  if (norm.endsWith('/.system_generated/logs/transcript.jsonl')) {
    const convDir = path.dirname(path.dirname(path.dirname(resolved)));
    return path.dirname(convDir);
  }

  const parentDir = path.dirname(resolved);
  if (convId && path.basename(parentDir) === convId) {
    return path.dirname(parentDir);
  }

  let cursor = parentDir;
  for (let depth = 0; depth < 6; depth += 1) {
    if (path.basename(cursor) === 'brain') {
      return cursor;
    }
    const next = path.dirname(cursor);
    if (next === cursor) break;
    cursor = next;
  }
  return null;
}

function readBoundedFileText(filePath, maxBytes) {
  const fd = fs.openSync(filePath, 'r');
  try {
    const st = fs.fstatSync(fd);
    if (st.size <= 0) return '';
    const len = Math.min(st.size, maxBytes);
    const startOffset = st.size - len;
    const buf = Buffer.allocUnsafe(len);
    const bytesRead = fs.readSync(fd, buf, 0, len, startOffset);
    let slice = buf.subarray(0, bytesRead);
    if (startOffset > 0) {
      const nl = slice.indexOf(0x0a);
      slice = nl === -1 ? Buffer.alloc(0) : slice.subarray(nl + 1);
    }
    return slice.toString('utf8');
  } finally {
    fs.closeSync(fd);
  }
}

function registerChildId(rawId, selfConvId, childIds) {
  if (childIds.size >= MAX_CHILD_TRANSCRIPTS) return;
  if (typeof rawId !== 'string') return;
  const clean = rawId.trim().replace(/^["']|["']$/g, '');
  if (!clean || clean === selfConvId || !SAFE_CHILD_ID_RE.test(clean)) return;
  childIds.add(clean);
}

function extractChildIdsFromStep(raw, selfConvId, childIds) {
  if (childIds.size >= MAX_CHILD_TRANSCRIPTS) return;

  const calls = raw.tool_calls ?? raw.toolCalls;
  if (Array.isArray(calls)) {
    for (const tc of calls) {
      if (!tc || typeof tc !== 'object') continue;
      const name = String(tc.name || '');
      if (!name.includes('subagent') && name !== 'swarm') continue;
      let args = tc.args ?? tc.arguments ?? {};
      if (typeof args === 'string') {
        try {
          args = JSON.parse(args);
        } catch {
          args = {};
        }
      }
      if (isPlainObject(args)) {
        const cid = args.conversation_id || args.conversationId || args.child_conversation_id;
        if (cid) registerChildId(String(cid), selfConvId, childIds);
      }
    }
  }

  const content = raw.content;
  if (typeof content !== 'string' || !content) return;

  if (content.includes('conversation://')) {
    const uriRegex = /conversation:\/\/([a-zA-Z0-9_-]{4,128})/g;
    let match;
    while ((match = uriRegex.exec(content)) !== null) {
      registerChildId(match[1], selfConvId, childIds);
      if (childIds.size >= MAX_CHILD_TRANSCRIPTS) return;
    }
  }

  if (content.includes('conversation_id') || content.includes('conversationId')) {
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) continue;
      try {
        const parsed = JSON.parse(trimmed);
        const list = Array.isArray(parsed) ? parsed : [parsed];
        for (const item of list) {
          if (!isPlainObject(item) || Array.isArray(item.messages)) continue;
          const cid =
            item.conversation_id ||
            item.conversationId ||
            item.subagent_conversation_id ||
            item.agent_conversation_id;
          if (cid) registerChildId(String(cid), selfConvId, childIds);
          if (Array.isArray(item.workers)) {
            for (const w of item.workers) {
              const wcid = w?.conversation_id || w?.conversationId;
              if (wcid) registerChildId(String(wcid), selfConvId, childIds);
            }
          }
        }
      } catch {
        // Ignore non-JSON lines
      }
      if (childIds.size >= MAX_CHILD_TRANSCRIPTS) return;
    }
  }
}

function sumChildTranscriptTokens(brainDir, childId) {
  if (!brainDir || !childId) {
    return { inputTokens: 0, cacheReadTokens: 0, outputTokens: 0, totalTokens: 0 };
  }
  let childPath = null;
  for (const rel of ['.system_generated/logs/transcript.jsonl', 'transcript.jsonl']) {
    const candidate = path.join(brainDir, childId, rel);
    if (isExistingFile(candidate)) {
      childPath = candidate;
      break;
    }
  }
  if (!childPath) {
    return { inputTokens: 0, cacheReadTokens: 0, outputTokens: 0, totalTokens: 0 };
  }

  try {
    const text = readBoundedFileText(childPath, MAX_CHILD_TRANSCRIPT_BYTES);
    if (!text) {
      return { inputTokens: 0, cacheReadTokens: 0, outputTokens: 0, totalTokens: 0 };
    }
    let inputTokens = 0;
    let cacheReadTokens = 0;
    let outputTokens = 0;
    for (const line of text.split('\n')) {
      if (!line.includes('tokens') && !line.includes('Tokens')) continue;
      try {
        const obj = JSON.parse(line);
        if (!isPlainObject(obj)) continue;
        if (obj.type !== 'PLANNER_RESPONSE' && obj.type !== 'CHECKPOINT') continue;
        inputTokens += Math.max(0, Math.floor(Number(obj.input_tokens ?? obj.inputTokens) || 0));
        cacheReadTokens += Math.max(
          0,
          Math.floor(Number(obj.cache_read_tokens ?? obj.cacheReadTokens) || 0),
        );
        outputTokens += Math.max(0, Math.floor(Number(obj.output_tokens ?? obj.outputTokens) || 0));
      } catch {
        // Skip malformed line
      }
    }
    return {
      inputTokens,
      cacheReadTokens,
      outputTokens,
      totalTokens: inputTokens + cacheReadTokens + outputTokens,
    };
  } catch {
    return { inputTokens: 0, cacheReadTokens: 0, outputTokens: 0, totalTokens: 0 };
  }
}

function buildHookTimingWindows(hookEvents) {
  if (!Array.isArray(hookEvents) || hookEvents.length === 0) return [];
  const sorted = hookEvents
    .filter((e) => isPlainObject(e) && Number.isFinite(e.ts) && e.ts > 0)
    .slice()
    .sort((a, b) => a.ts - b.ts);

  const windows = [];
  const openByInv = new Map();
  let lastOpen = null;

  for (const ev of sorted) {
    const kind = String(ev.event || '');
    const inv =
      typeof ev.invocationNum === 'number' && Number.isFinite(ev.invocationNum)
        ? ev.invocationNum
        : null;
    if (kind === 'PreInvocation') {
      const win = { preTs: ev.ts, stopTs: null, invocationNum: inv, used: false };
      windows.push(win);
      if (inv !== null) openByInv.set(inv, win);
      lastOpen = win;
    } else if (kind === 'Stop') {
      let target = inv !== null ? openByInv.get(inv) : null;
      if (!target && lastOpen && lastOpen.stopTs === null && ev.ts >= lastOpen.preTs) {
        target = lastOpen;
      }
      if (target) {
        target.stopTs = ev.ts;
        if (inv !== null) openByInv.delete(inv);
        if (lastOpen === target) lastOpen = null;
      }
    }
  }
  return windows.filter((w) => w.preTs !== null && w.stopTs !== null && w.stopTs > w.preTs);
}

/**
 * Fast (<20ms), fail-open summary of a conversation's HUD telemetry for inline zero-token status bar.
 */
export function summarizeConversationForHud(transcriptPath, convId, options = {}) {
  const startPerf = performance.now();
  const payload = isPlainObject(options?.payload) ? options.payload : {};
  const event = normalizeEventLabel(options?.event || '') || 'PreInvocation';
  const lastUserInput = typeof payload.lastUserInput === 'string' ? payload.lastUserInput : '';
  const payloadSystemWakeup = isSystemMessageOnlyContent(lastUserInput);
  const hasGenuinePayloadInput = Boolean(lastUserInput.trim()) && !payloadSystemWakeup;
  const hasExplicitParent = Boolean(
    payload.parentConversationId || payload.parent_conversation_id,
  );

  const fallbackResult = (isSub) => {
    const minTurns =
      !isSub && event === 'PreInvocation' && payload.invocationNum === 0 ? 1 : 0;
    return {
      isSubagentOrSystemWakeup: Boolean(isSub),
      turns: minTurns,
      steps: 0,
      selfTotalTokens: 0,
      subagentsTotalTokens: 0,
      combinedTotalTokens: 0,
      cacheHitPct: 0,
      avgTokPerSec: 0,
      usedTokens: 0,
      usedPct: 0,
      checkpointCount: 0,
      hasPlannerInCycle: false,
    };
  };

  try {
    if (payloadSystemWakeup || hasExplicitParent) {
      return fallbackResult(true);
    }

    if (!transcriptPath || !isExistingFile(transcriptPath)) {
      return fallbackResult(false);
    }

    const rawText = readBoundedFileText(transcriptPath, MAX_MAIN_TRANSCRIPT_BYTES);
    if (!rawText.trim()) {
      return fallbackResult(false);
    }

    let parsedStepCount = 0;
    let maxStepIndex = -1;
    let genuineUserTurns = 0;
    let hasSubagentSystemBrief = false;
    let checkpointCount = 0;
    let hasPlannerInCycle = false;
    let usedTokens = 0;

    let selfInputTokens = 0;
    let selfCacheReadTokens = 0;
    let selfOutputTokens = 0;

    const childIds = new Set();
    const stepMeta = [];
    let currentTurnId = 0;

    for (const line of rawText.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      let raw;
      try {
        raw = JSON.parse(trimmed);
      } catch {
        continue;
      }
      if (!isPlainObject(raw)) continue;

      parsedStepCount += 1;
      const stepIdx =
        typeof raw.step_index === 'number'
          ? raw.step_index
          : typeof raw.stepIndex === 'number'
            ? raw.stepIndex
            : -1;
      if (stepIdx > maxStepIndex) {
        maxStepIndex = stepIdx;
      }

      const type = typeof raw.type === 'string' ? raw.type : '';
      const content = typeof raw.content === 'string' ? raw.content : '';
      const createdAtStr = raw.created_at ?? raw.createdAt;
      const parsedMs = typeof createdAtStr === 'string' && createdAtStr ? Date.parse(createdAtStr) : NaN;
      const createdAtMs = Number.isFinite(parsedMs) ? parsedMs : 0;

      if (type === 'USER_INPUT') {
        currentTurnId += 1;
        if (isSystemMessageOnlyContent(content)) {
          hasSubagentSystemBrief = true;
        } else {
          genuineUserTurns += 1;
        }
      } else if (type === 'SYSTEM_MESSAGE') {
        if (content.trim().length > 0) {
          hasSubagentSystemBrief = true;
        }
      }

      const inp = Math.max(0, Math.floor(Number(raw.input_tokens ?? raw.inputTokens) || 0));
      const cache = Math.max(
        0,
        Math.floor(Number(raw.cache_read_tokens ?? raw.cacheReadTokens) || 0),
      );
      const out = Math.max(0, Math.floor(Number(raw.output_tokens ?? raw.outputTokens) || 0));

      if (type === 'CHECKPOINT') {
        checkpointCount += 1;
        hasPlannerInCycle = false;
        usedTokens = 0;
        selfInputTokens += inp;
        selfCacheReadTokens += cache;
        selfOutputTokens += out;
      } else if (type === 'PLANNER_RESPONSE') {
        hasPlannerInCycle = true;
        usedTokens = inp + cache + out;
        selfInputTokens += inp;
        selfCacheReadTokens += cache;
        selfOutputTokens += out;
      }

      extractChildIdsFromStep(raw, convId, childIds);

      stepMeta.push({
        type,
        turnId: currentTurnId,
        createdAtMs,
        outputTokens: out,
      });
    }

    const isSubagentOrSystemWakeup =
      genuineUserTurns === 0 && !hasGenuinePayloadInput && hasSubagentSystemBrief;
    if (isSubagentOrSystemWakeup) {
      return fallbackResult(true);
    }

    // Compute output streaming speed (avgTokPerSec) from hook windows or adjacent step timestamps >= 1s
    const hookEvents = convId ? readHookEvents(convId, options) : [];
    const hookWindows = buildHookTimingWindows(hookEvents);
    let totalTimedOutputTokens = 0;
    let totalDurationMs = 0;

    for (let i = 0; i < stepMeta.length; i += 1) {
      const sm = stepMeta[i];
      if ((sm.type !== 'PLANNER_RESPONSE' && sm.type !== 'CHECKPOINT') || sm.outputTokens <= 0) {
        continue;
      }

      let durationMs = 0;
      if (sm.type === 'PLANNER_RESPONSE' && hookWindows.length > 0) {
        for (const win of hookWindows) {
          if (win.used) continue;
          if (
            sm.createdAtMs === 0 ||
            (sm.createdAtMs >= win.preTs - 1500 && sm.createdAtMs <= win.stopTs + 1500)
          ) {
            durationMs = Math.max(1, win.stopTs - win.preTs);
            win.used = true;
            break;
          }
        }
        if (durationMs <= 0 && sm.turnId >= 1 && sm.turnId <= hookWindows.length) {
          const turnWin = hookWindows[sm.turnId - 1];
          if (turnWin && !turnWin.used) {
            const plannersInSameTurn = stepMeta.filter(
              (x) => x.turnId === sm.turnId && x.type === 'PLANNER_RESPONSE',
            ).length;
            if (plannersInSameTurn === 1) {
              durationMs = Math.max(1, turnWin.stopTs - turnWin.preTs);
              turnWin.used = true;
            }
          }
        }
      }

      if (durationMs <= 0) {
        const prev = i > 0 && stepMeta[i - 1].turnId === sm.turnId ? stepMeta[i - 1] : null;
        const next =
          i + 1 < stepMeta.length && stepMeta[i + 1].turnId === sm.turnId
            ? stepMeta[i + 1]
            : null;
        const deltaPrev =
          prev && sm.createdAtMs > 0 && prev.createdAtMs > 0
            ? sm.createdAtMs - prev.createdAtMs
            : 0;
        const deltaNext =
          next && sm.createdAtMs > 0 && next.createdAtMs > 0
            ? next.createdAtMs - sm.createdAtMs
            : 0;
        if (deltaPrev > 1000) {
          durationMs = deltaPrev;
        } else if (deltaNext > 1000) {
          durationMs = deltaNext;
        } else {
          durationMs = 1000;
        }
      }

      totalTimedOutputTokens += sm.outputTokens;
      totalDurationMs += durationMs;
    }

    const avgTokPerSec =
      totalDurationMs > 0 && totalTimedOutputTokens > 0
        ? Math.round(totalTimedOutputTokens / (totalDurationMs / 1000))
        : 0;

    // Sum spawned child transcripts in the same brain folder within strict <15ms budget
    let subInputTokens = 0;
    let subCacheReadTokens = 0;
    let subOutputTokens = 0;
    if (childIds.size > 0) {
      const brainDir = inferBrainRootDir(transcriptPath, convId);
      if (brainDir) {
        for (const childId of childIds) {
          if (performance.now() - startPerf >= CHILD_SCAN_BUDGET_MS) break;
          const sub = sumChildTranscriptTokens(brainDir, childId);
          subInputTokens += sub.inputTokens;
          subCacheReadTokens += sub.cacheReadTokens;
          subOutputTokens += sub.outputTokens;
        }
      }
    }

    const selfTotalTokens = selfInputTokens + selfCacheReadTokens + selfOutputTokens;
    const subagentsTotalTokens = subInputTokens + subCacheReadTokens + subOutputTokens;
    const combinedInput = selfInputTokens + subInputTokens;
    const combinedCacheRead = selfCacheReadTokens + subCacheReadTokens;
    const combinedOutput = selfOutputTokens + subOutputTokens;
    const combinedTotalTokens = combinedInput + combinedCacheRead + combinedOutput;
    const combinedPrompt = combinedInput + combinedCacheRead;
    const cacheHitPct =
      combinedPrompt > 0 ? Math.round((combinedCacheRead / combinedPrompt) * 100) : 0;

    const turns =
      event === 'PreInvocation' && payload.invocationNum === 0
        ? Math.max(1, genuineUserTurns)
        : genuineUserTurns;
    const steps = parsedStepCount > 0 ? Math.max(parsedStepCount, maxStepIndex + 1) : 0;
    const usedPct = Math.round((usedTokens / CONTEXT_LIMIT) * 100);

    return {
      isSubagentOrSystemWakeup: false,
      turns,
      steps,
      selfTotalTokens,
      subagentsTotalTokens,
      combinedTotalTokens,
      cacheHitPct,
      avgTokPerSec,
      usedTokens,
      usedPct,
      checkpointCount,
      hasPlannerInCycle,
    };
  } catch {
    return fallbackResult(false);
  }
}

function buildAlertMarkdown(level, usedTokens) {
  const usedK = (usedTokens / 1000).toFixed(1);
  const pct = ((usedTokens / CONTEXT_LIMIT) * 100).toFixed(1);
  return level === 92
    ? `🚨 **上下文紧急预警**：当前会话已占用 **${usedK}k / 256k (${pct}%)**，即将触发自动压缩红线（~250k）！ ${SIDECAR_PILL_LINK}`
    : `⚠️ **上下文预警**：当前会话已占用 **${usedK}k / 256k (${pct}%)**，接近自动压缩红线（~250k）。 ${SIDECAR_PILL_LINK}`;
}

function wrapUserMarkdownStep(userMarkdown) {
  return {
    injectSteps: [
      {
        systemMessage: {
          systemMessage: '',
          metadata: {
            user_markdown: userMarkdown,
          },
        },
      },
    ],
  };
}

/**
 * Core hook execution logic. Always Fail-Open: returns `{}` on any malformed input or error.
 */
export function runHook(rawStdin, options = {}) {
  try {
    if (typeof rawStdin !== 'string' || !rawStdin.trim()) {
      return {};
    }

    let payload;
    try {
      payload = JSON.parse(rawStdin);
    } catch {
      return {};
    }

    if (!isPlainObject(payload)) {
      return {};
    }

    const convId = String(
      payload.conversationId || payload.convId || payload.conversation_id || '',
    ).trim();
    if (!convId) {
      return {};
    }

    const event = resolveEventName(payload, options.argv);
    const rawInvocationNum = payload.invocationNum ?? payload.executionNum;
    const invocationNum =
      typeof rawInvocationNum === 'number' && Number.isFinite(rawInvocationNum)
        ? Math.floor(rawInvocationNum)
        : null;
    const rawModelCandidate =
      typeof payload.modelName === 'string' && payload.modelName.trim()
        ? payload.modelName.trim()
        : typeof payload.model === 'string' && payload.model.trim()
          ? payload.model.trim()
          : '';
    const rawModel = /^(?:auto|default|none|unknown|inherit)$/i.test(rawModelCandidate)
      ? ''
      : rawModelCandidate;
    const now =
      typeof options.now === 'number' && Number.isFinite(options.now)
        ? Math.floor(options.now)
        : Date.now();

    appendHookEvent(
      convId,
      {
        ts: now,
        event,
        invocationNum,
        modelName: rawModel,
        convId,
        ...(typeof payload.terminationReason === 'string' && payload.terminationReason
          ? { terminationReason: payload.terminationReason }
          : {}),
      },
      options,
    );

    if (event === 'Stop') {
      return {};
    }

    const settings = readSettings(options);
    const enableChatAlert = settings.enableChatAlert !== false;
    const enableChatStatusBar = settings.enableChatStatusBar !== false;

    if (event === 'SessionStart') {
      if (!enableChatStatusBar) {
        return {};
      }
      const transcriptPath = resolveTranscriptPath(payload, convId, options);
      const hud = summarizeConversationForHud(transcriptPath, convId, {
        ...options,
        payload,
        event: 'SessionStart',
      });
      if (hud.isSubagentOrSystemWakeup) {
        return {};
      }
      return wrapUserMarkdownStep(formatHudMarkdown(hud));
    }

    if (event !== 'PreInvocation') {
      return {};
    }

    const transcriptPath = resolveTranscriptPath(payload, convId, options);
    let alertMarkdown = '';

    if (transcriptPath) {
      const snapshot = inspectTranscriptTail(transcriptPath, options);
      let alertLevelToEmit = 0;

      updateConversationAlertState(
        convId,
        (prev) => {
          let alerted80 = Boolean(prev.alerted80);
          let alerted92 = Boolean(prev.alerted92);

          const compactedByCheckpoint = snapshot.checkpointCount > (prev.lastCheckpointCount || 0);
          const compactedByTokenDrop =
            snapshot.hasPlannerInCycle &&
            snapshot.usedTokens < COMPACTION_DROP_THRESHOLD &&
            (prev.lastContextTokens || 0) >= COMPACTION_PREV_HIGH_WATER;

          if (compactedByCheckpoint || compactedByTokenDrop) {
            alerted80 = false;
            alerted92 = false;
          }

          if (enableChatAlert && snapshot.hasPlannerInCycle) {
            if (snapshot.usedTokens >= THRESHOLD_92 && !alerted92) {
              alertLevelToEmit = 92;
              alerted92 = true;
              alerted80 = true;
            } else if (snapshot.usedTokens >= THRESHOLD_80 && !alerted80) {
              alertLevelToEmit = 80;
              alerted80 = true;
            }
          }

          const nextContextTokens = snapshot.hasPlannerInCycle
            ? snapshot.usedTokens
            : compactedByCheckpoint
              ? 0
              : prev.lastContextTokens || 0;

          return {
            alerted80,
            alerted92,
            lastCheckpointCount: Math.max(prev.lastCheckpointCount || 0, snapshot.checkpointCount),
            lastContextTokens: nextContextTokens,
            updatedAt: now,
          };
        },
        options,
      );

      if (alertLevelToEmit === 80 || alertLevelToEmit === 92) {
        alertMarkdown = buildAlertMarkdown(alertLevelToEmit, snapshot.usedTokens);
      }
    }

    let hudMarkdown = '';
    if (enableChatStatusBar && payload.invocationNum === 0) {
      const hud = summarizeConversationForHud(transcriptPath, convId, {
        ...options,
        payload,
        event: 'PreInvocation',
      });
      if (!hud.isSubagentOrSystemWakeup) {
        hudMarkdown = formatHudMarkdown(hud);
      }
    }

    if (alertMarkdown && hudMarkdown) {
      return wrapUserMarkdownStep(`${alertMarkdown}\n\n${hudMarkdown}`);
    }
    if (alertMarkdown) {
      return wrapUserMarkdownStep(alertMarkdown);
    }
    if (hudMarkdown) {
      return wrapUserMarkdownStep(hudMarkdown);
    }

    return {};
  } catch {
    return {};
  }
}

function isMainEntry() {
  try {
    if (!process.argv[1]) return false;
    const selfPath = fs.realpathSync(fileURLToPath(import.meta.url));
    const entryPath = fs.realpathSync(path.resolve(process.argv[1]));
    return selfPath === entryPath;
  } catch {
    return false;
  }
}

async function main() {
  try {
    const chunks = [];
    for await (const chunk of process.stdin) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
    }
    const rawStdin = Buffer.concat(chunks).toString('utf8');
    const output = runHook(rawStdin, { argv: process.argv.slice(2) });
    process.stdout.write(`${JSON.stringify(output)}\n`);
  } catch {
    process.stdout.write('{}\n');
  }
}

if (isMainEntry()) {
  process.on('uncaughtException', () => {
    try {
      process.stdout.write('{}\n');
    } catch {
      // Ignore stdout errors
    }
    process.exit(0);
  });
  process.on('unhandledRejection', () => {
    try {
      process.stdout.write('{}\n');
    } catch {
      // Ignore stdout errors
    }
    process.exit(0);
  });
  main();
}
