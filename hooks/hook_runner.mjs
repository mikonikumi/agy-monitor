#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  appendHookEvent,
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
const HEAD_PROBE_BYTES = 16 * 1024;

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeEventLabel(raw) {
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
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
        if (val === 'PreInvocation' || val === 'Stop') {
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

function isHookInjectedSystemMessage(content) {
  if (typeof content !== 'string') return false;
  const trimmed = content.trimStart();
  return /^(?:\[Hook\b|\[agy-monitor\])/i.test(trimmed);
}

function classifyTriggerStep(obj) {
  if (!isPlainObject(obj)) return null;
  const type = typeof obj.type === 'string' ? obj.type : '';
  const content = typeof obj.content === 'string' ? obj.content : '';

  if (type === 'USER_INPUT') {
    const source = typeof obj.source === 'string' ? obj.source.trim().toUpperCase() : '';
    if (source === 'SYSTEM' || isSystemMessageOnlyContent(content)) {
      return 'system';
    }
    return 'user';
  }

  if (type === 'SYSTEM_MESSAGE') {
    if (!content.trim() || isHookInjectedSystemMessage(content)) {
      return null;
    }
    return 'system';
  }

  return null;
}

function parseTranscriptChunkLines(text) {
  let chunkCheckpointCount = 0;
  let sawCheckpointOrPlanner = false;
  let lastRelevantType = null;
  let latestPostCheckpointPlanner = null;
  let lastTriggerKind = null;

  const lines = text.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const obj = JSON.parse(trimmed);
      if (!isPlainObject(obj)) continue;
      const triggerKind = classifyTriggerStep(obj);
      if (triggerKind) {
        lastTriggerKind = triggerKind;
      }
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
    lastTriggerKind,
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
        lastTriggerKind: null,
        usableStartOffset: 0,
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
        lastTriggerKind: parsed.lastTriggerKind,
        usableStartOffset,
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
      lastTriggerKind: parsed.lastTriggerKind,
      usableStartOffset,
    };
  } finally {
    fs.closeSync(fd);
  }
}

function inspectTranscriptHeadTrigger(transcriptPath) {
  let fd = null;
  try {
    fd = fs.openSync(transcriptPath, 'r');
    const st = fs.fstatSync(fd);
    if (st.size <= 0) return null;
    const readLen = Math.min(st.size, HEAD_PROBE_BYTES);
    const buf = Buffer.allocUnsafe(readLen);
    const bytesRead = fs.readSync(fd, buf, 0, readLen, 0);
    let text = buf.subarray(0, bytesRead).toString('utf8');
    if (bytesRead < st.size) {
      const lastNl = text.lastIndexOf('\n');
      if (lastNl !== -1) {
        text = text.slice(0, lastNl);
      }
    }

    let sawSystemTrigger = false;
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const obj = JSON.parse(trimmed);
        const kind = classifyTriggerStep(obj);
        if (kind === 'user') return 'user';
        if (kind === 'system') sawSystemTrigger = true;
      } catch {
        // Ignore partial or malformed line
      }
    }
    return sawSystemTrigger ? 'system' : null;
  } catch {
    return null;
  } finally {
    if (fd !== null) {
      try {
        fs.closeSync(fd);
      } catch {
        // Ignore close error
      }
    }
  }
}

function resolveSiblingSummariesDbPath(transcriptPath, convId) {
  if (typeof transcriptPath !== 'string' || !transcriptPath.trim()) return null;
  const resolved = path.resolve(transcriptPath);
  const norm = resolved.replace(/\\/g, '/');

  let brainDir = null;
  if (norm.endsWith('/.system_generated/logs/transcript.jsonl')) {
    const convDir = path.dirname(path.dirname(path.dirname(resolved)));
    if (path.basename(path.dirname(convDir)) === 'brain') {
      brainDir = path.dirname(convDir);
    }
  } else {
    const parentDir = path.dirname(resolved);
    if (convId && path.basename(parentDir) === convId && path.basename(path.dirname(parentDir)) === 'brain') {
      brainDir = path.dirname(parentDir);
    }
  }

  if (!brainDir) return null;
  const dbPath = path.join(path.dirname(brainDir), 'conversation_summaries.db');
  return isExistingFile(dbPath) ? dbPath : null;
}

function isChildConversationInSummariesDb(transcriptPath, convId) {
  try {
    const dbPath = resolveSiblingSummariesDbPath(transcriptPath, convId);
    if (!dbPath || !convId) return false;
    const sqliteMod = process.getBuiltinModule?.('node:sqlite');
    const DatabaseSync = sqliteMod?.DatabaseSync;
    if (typeof DatabaseSync !== 'function') return false;

    const db = new DatabaseSync(dbPath, { open: true, readOnly: true });
    try {
      const colInfo = db.prepare('PRAGMA table_info("conversation_summaries")').all();
      if (!Array.isArray(colInfo) || colInfo.length === 0) return false;
      const cols = new Set(colInfo.map((c) => String(c.name)));
      if (!cols.has('conversation_id')) return false;

      const selectCols = ['parent_conversation_id', 'nesting_depth'].filter((c) => cols.has(c));
      if (selectCols.length === 0) return false;

      const row = db
        .prepare(
          `SELECT ${selectCols.map((c) => `"${c}"`).join(', ')} FROM "conversation_summaries" WHERE "conversation_id" = ? LIMIT 1`,
        )
        .get(convId);
      if (!row) return false;

      if (
        typeof row.parent_conversation_id === 'string' &&
        row.parent_conversation_id.trim().length > 0
      ) {
        return true;
      }
      if (Number(row.nesting_depth) > 0) {
        return true;
      }
      return false;
    } finally {
      db.close();
    }
  } catch {
    return false;
  }
}

/**
 * Returns true if the current invocation belongs to a subagent/worker conversation
 * or a reactive `<SYSTEM_MESSAGE>` wakeup turn where chat compaction alerts must be skipped.
 */
export function isSubagentOrSystemWakeup(payload, convId, transcriptPath, snapshot) {
  if (
    Boolean(
      payload?.parentConversationId ||
        payload?.parent_conversation_id ||
        payload?.isSubagent === true ||
        payload?.subagent === true,
    )
  ) {
    return true;
  }

  const lastUserInput =
    typeof payload?.lastUserInput === 'string'
      ? payload.lastUserInput
      : typeof payload?.last_user_input === 'string'
        ? payload.last_user_input
        : '';
  if (isSystemMessageOnlyContent(lastUserInput)) {
    return true;
  }

  if (snapshot?.lastTriggerKind === 'system') {
    return true;
  }

  if (
    snapshot &&
    snapshot.lastTriggerKind === null &&
    snapshot.usableStartOffset > 0 &&
    transcriptPath &&
    inspectTranscriptHeadTrigger(transcriptPath) === 'system'
  ) {
    return true;
  }

  if (transcriptPath && convId && isChildConversationInSummariesDb(transcriptPath, convId)) {
    return true;
  }

  return false;
}

export function buildAlertSystemMessage(level, usedTokens) {
  const usedK = (usedTokens / 1000).toFixed(1);
  const pct = ((usedTokens / CONTEXT_LIMIT) * 100).toFixed(1);
  const clause = level === 92 ? '即将触发自动压缩线（~250k）！' : '接近自动压缩线（~250k）。';
  return `[agy-monitor] 当前会话上下文已占用 ${usedK}k / 256k (${pct}%)，${clause}请在本次回复开头用一句话顺便提醒用户，并附上快捷入口 [打开 agy-monitor](sidecar://agy-monitor/monitor_pane/)。`;
}

function wrapSystemMessageStep(message) {
  return {
    injectSteps: [
      {
        systemMessage: {
          systemMessage: message,
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
    if (event !== 'PreInvocation' && event !== 'Stop') {
      return {};
    }

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

    if (event !== 'PreInvocation') {
      return {};
    }

    const settings = readSettings(options);
    const enableChatAlert = settings.enableChatAlert !== false;

    const transcriptPath = resolveTranscriptPath(payload, convId, options);
    if (!transcriptPath) {
      return {};
    }

    const snapshot = inspectTranscriptTail(transcriptPath, options);
    const skipAlert =
      enableChatAlert &&
      snapshot.hasPlannerInCycle &&
      snapshot.usedTokens >= THRESHOLD_80 &&
      isSubagentOrSystemWakeup(payload, convId, transcriptPath, snapshot);

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

        if (enableChatAlert && snapshot.hasPlannerInCycle && !skipAlert) {
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
      return wrapSystemMessageStep(buildAlertSystemMessage(alertLevelToEmit, snapshot.usedTokens));
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
