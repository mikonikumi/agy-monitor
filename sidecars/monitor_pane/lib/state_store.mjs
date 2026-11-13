import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const DEFAULT_SETTINGS = Object.freeze({
  enableChatAlert: true,
  language: 'auto',
});

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Normalize language preference strictly to `'auto' | 'zh' | 'en'`.
 * Accepts locale variants like `'zh-CN'`/`'zh-TW'` -> `'zh'` and `'en-US'`/`'en-GB'` -> `'en'`.
 * Never reads `process.env.LANG`.
 */
export function normalizeLanguageSetting(raw) {
  if (typeof raw !== 'string') {
    return 'auto';
  }
  const normalized = raw.trim().toLowerCase();
  if (!normalized || normalized === 'auto') {
    return 'auto';
  }
  if (normalized === 'zh' || normalized.startsWith('zh-') || normalized.startsWith('zh_')) {
    return 'zh';
  }
  if (normalized === 'en' || normalized.startsWith('en-') || normalized.startsWith('en_')) {
    return 'en';
  }
  return 'auto';
}

/**
 * Resolve persistent plugin data directory.
 * Priority: explicit options.dataDir -> AGY_MONITOR_DATA_DIR env -> ~/.gemini/agy_monitor_data
 */
export function getDefaultDataDir(options) {
  if (options?.dataDir) {
    return options.dataDir;
  }
  if (process.env.AGY_MONITOR_DATA_DIR) {
    return process.env.AGY_MONITOR_DATA_DIR;
  }
  const home = options?.homeDir || os.homedir();
  return path.join(home, '.gemini', 'agy_monitor_data');
}

/**
 * Safely sanitize conversation ID into a flat filename stem with zero path traversal risk.
 */
export function sanitizeConvId(convId) {
  const raw = String(convId ?? '').trim();
  if (!raw) {
    return 'unknown';
  }
  const cleaned = raw
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/\.{2,}/g, '_')
    .replace(/^\.+/, '_');
  const bounded = cleaned.slice(0, 200);
  return bounded || 'unknown';
}

export function createDefaultAlertState() {
  return {
    alerted80: false,
    alerted92: false,
    lastCheckpointCount: 0,
    lastContextTokens: 0,
    updatedAt: 0,
  };
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeNonNegativeInt(value, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return Math.floor(value);
  }
  return fallback;
}

function normalizeSettingsObject(raw) {
  if (!isPlainObject(raw)) {
    return { ...DEFAULT_SETTINGS };
  }
  const result = { ...DEFAULT_SETTINGS };
  for (const [key, val] of Object.entries(raw)) {
    if (FORBIDDEN_KEYS.has(key)) continue;
    result[key] = val;
  }
  result.enableChatAlert =
    typeof raw.enableChatAlert === 'boolean'
      ? raw.enableChatAlert
      : DEFAULT_SETTINGS.enableChatAlert;
  result.language = normalizeLanguageSetting(raw.language);
  return result;
}

function normalizeAlertEntry(raw) {
  if (!isPlainObject(raw)) {
    return createDefaultAlertState();
  }
  return {
    alerted80: Boolean(raw.alerted80),
    alerted92: Boolean(raw.alerted92),
    lastCheckpointCount: normalizeNonNegativeInt(raw.lastCheckpointCount, 0),
    lastContextTokens: normalizeNonNegativeInt(raw.lastContextTokens, 0),
    updatedAt: normalizeNonNegativeInt(raw.updatedAt, 0),
  };
}

function atomicWriteJson(targetPath, data) {
  const dir = path.dirname(targetPath);
  const base = path.basename(targetPath);
  fs.mkdirSync(dir, { recursive: true });
  const suffix = `${process.pid}.${Date.now()}.${crypto.randomBytes(4).toString('hex')}`;
  const tmpPath = path.join(dir, `.${base}.${suffix}.tmp`);
  const serialized = `${JSON.stringify(data, null, 2)}\n`;
  try {
    fs.writeFileSync(tmpPath, serialized, 'utf8');
    fs.renameSync(tmpPath, targetPath);
  } catch (err) {
    try {
      if (fs.existsSync(tmpPath)) {
        fs.unlinkSync(tmpPath);
      }
    } catch {
      // Ignore cleanup errors
    }
    throw err;
  }
}

/**
 * Read settings.json with graceful recovery on missing or corrupt JSON.
 */
export function readSettings(options) {
  const dataDir = getDefaultDataDir(options);
  const settingsPath = path.join(dataDir, 'settings.json');
  try {
    if (!fs.existsSync(settingsPath)) {
      return { ...DEFAULT_SETTINGS };
    }
    const text = fs.readFileSync(settingsPath, 'utf8');
    if (!text.trim()) {
      return { ...DEFAULT_SETTINGS };
    }
    const parsed = JSON.parse(text);
    return normalizeSettingsObject(parsed);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/**
 * Merge patch into settings.json atomically via temp file + rename.
 */
export function writeSettings(patch, options) {
  const dataDir = getDefaultDataDir(options);
  const settingsPath = path.join(dataDir, 'settings.json');
  const current = readSettings(options);
  const merged = { ...current };
  if (isPlainObject(patch)) {
    for (const [key, val] of Object.entries(patch)) {
      if (FORBIDDEN_KEYS.has(key)) continue;
      merged[key] = val;
    }
    if ('enableChatAlert' in patch) {
      merged.enableChatAlert = Boolean(patch.enableChatAlert);
    }
    if ('language' in patch) {
      merged.language = normalizeLanguageSetting(patch.language);
    }
  }
  const normalized = normalizeSettingsObject(merged);
  atomicWriteJson(settingsPath, normalized);
  return normalized;
}

/**
 * Read alerts.json with graceful recovery on missing or corrupt JSON.
 */
export function readAlerts(options) {
  const dataDir = getDefaultDataDir(options);
  const alertsPath = path.join(dataDir, 'alerts.json');
  try {
    if (!fs.existsSync(alertsPath)) {
      return {};
    }
    const text = fs.readFileSync(alertsPath, 'utf8');
    if (!text.trim()) {
      return {};
    }
    const parsed = JSON.parse(text);
    if (!isPlainObject(parsed)) {
      return {};
    }
    const clean = {};
    for (const [convId, entry] of Object.entries(parsed)) {
      if (!convId || FORBIDDEN_KEYS.has(convId) || !isPlainObject(entry)) {
        continue;
      }
      clean[convId] = normalizeAlertEntry(entry);
    }
    return clean;
  } catch {
    return {};
  }
}

/**
 * Write entire alerts map atomically via temp file + rename.
 */
export function writeAlerts(alerts, options) {
  const dataDir = getDefaultDataDir(options);
  const alertsPath = path.join(dataDir, 'alerts.json');
  const clean = {};
  if (isPlainObject(alerts)) {
    for (const [convId, entry] of Object.entries(alerts)) {
      if (!convId || FORBIDDEN_KEYS.has(convId) || !isPlainObject(entry)) {
        continue;
      }
      clean[convId] = normalizeAlertEntry(entry);
    }
  }
  atomicWriteJson(alertsPath, clean);
  return clean;
}

/**
 * Update a single conversation's alert state atomically.
 * Supports both synchronous and asynchronous updater functions.
 */
export function updateConversationAlertState(convId, updater, options) {
  const key = String(convId ?? '').trim();
  if (!key || FORBIDDEN_KEYS.has(key) || typeof updater !== 'function') {
    return createDefaultAlertState();
  }

  const alerts = readAlerts(options);
  const current = alerts[key] ? normalizeAlertEntry(alerts[key]) : createDefaultAlertState();
  const workingCopy = { ...current };

  const finalize = (returned) => {
    if (returned === null) {
      delete alerts[key];
      writeAlerts(alerts, options);
      return null;
    }
    const candidate = isPlainObject(returned) ? { ...workingCopy, ...returned } : workingCopy;
    const explicitUpdatedAt =
      isPlainObject(returned) &&
      typeof returned.updatedAt === 'number' &&
      Number.isFinite(returned.updatedAt) &&
      returned.updatedAt > 0 &&
      returned.updatedAt !== current.updatedAt;
    if (!explicitUpdatedAt) {
      candidate.updatedAt = Date.now();
    }
    const nextEntry = normalizeAlertEntry(candidate);
    alerts[key] = nextEntry;
    writeAlerts(alerts, options);
    return nextEntry;
  };

  const result = updater(workingCopy);
  if (result && typeof result.then === 'function') {
    return result.then(finalize);
  }
  return finalize(result);
}

/**
 * Append a lifecycle hook event record to hooks/<safeConvId>.jsonl.
 */
export function appendHookEvent(convId, eventObj, options) {
  const rawConvId = String(convId || eventObj?.convId || '').trim();
  if (!rawConvId) {
    return null;
  }
  const safeStem = sanitizeConvId(rawConvId);
  const dataDir = getDefaultDataDir(options);
  const hooksDir = path.join(dataDir, 'hooks');
  fs.mkdirSync(hooksDir, { recursive: true });
  const hookFilePath = path.join(hooksDir, `${safeStem}.jsonl`);

  const record = {
    ts:
      typeof eventObj?.ts === 'number' && Number.isFinite(eventObj.ts)
        ? Math.floor(eventObj.ts)
        : Date.now(),
    event: typeof eventObj?.event === 'string' && eventObj.event ? eventObj.event : 'unknown',
    invocationNum:
      typeof eventObj?.invocationNum === 'number' && Number.isFinite(eventObj.invocationNum)
        ? Math.floor(eventObj.invocationNum)
        : null,
    modelName: typeof eventObj?.modelName === 'string' ? eventObj.modelName : '',
    convId: rawConvId,
  };

  if (typeof eventObj?.terminationReason === 'string' && eventObj.terminationReason) {
    record.terminationReason = eventObj.terminationReason;
  }

  fs.appendFileSync(hookFilePath, `${JSON.stringify(record)}\n`, 'utf8');
  return record;
}

/**
 * Read lifecycle hook events from hooks/<safeConvId>.jsonl, gracefully skipping corrupt lines.
 */
export function readHookEvents(convId, options) {
  const rawConvId = String(convId ?? '').trim();
  if (!rawConvId) {
    return [];
  }
  const safeStem = sanitizeConvId(rawConvId);
  const dataDir = getDefaultDataDir(options);
  const hookFilePath = path.join(dataDir, 'hooks', `${safeStem}.jsonl`);
  try {
    if (!fs.existsSync(hookFilePath)) {
      return [];
    }
    const content = fs.readFileSync(hookFilePath, 'utf8');
    if (!content) {
      return [];
    }
    const events = [];
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const parsed = JSON.parse(trimmed);
        if (!isPlainObject(parsed)) continue;
        events.push({
          ts:
            typeof parsed.ts === 'number' && Number.isFinite(parsed.ts)
              ? Math.floor(parsed.ts)
              : 0,
          event: typeof parsed.event === 'string' ? parsed.event : 'unknown',
          invocationNum:
            typeof parsed.invocationNum === 'number' && Number.isFinite(parsed.invocationNum)
              ? Math.floor(parsed.invocationNum)
              : null,
          modelName: typeof parsed.modelName === 'string' ? parsed.modelName : '',
          convId: typeof parsed.convId === 'string' ? parsed.convId : rawConvId,
          ...(typeof parsed.terminationReason === 'string'
            ? { terminationReason: parsed.terminationReason }
            : {}),
        });
      } catch {
        // Skip corrupt or truncated JSONL line gracefully
      }
    }
    return events;
  } catch {
    return [];
  }
}
