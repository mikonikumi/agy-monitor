import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const CJK_REGEX = /[\u2E80-\u9FFF\uF900-\uFAFF\uFE30-\uFE4F\uFF00-\uFFEF\u3000-\u30FF\uAC00-\uD7AF]/u;

let cachedDatabaseSync = undefined;
function getSqliteDatabaseSync() {
  if (cachedDatabaseSync !== undefined) return cachedDatabaseSync;
  try {
    const req = createRequire(import.meta.url);
    const mod = req('node:sqlite');
    cachedDatabaseSync = mod?.DatabaseSync || null;
  } catch {
    cachedDatabaseSync = null;
  }
  return cachedDatabaseSync;
}

const AUTO_OR_EMPTY_MODEL_REGEX =
  /^(?:auto|none|default|unset|null|undefined|inherit|unknown|model_auto|model_unspecified|—|-)$/i;

/**
 * Canonical mapping from AGY internal `ModelEnum` placeholders (`MODEL_PLACEHOLDER_M*`),
 * backend model IDs (`gemini-4-carbon`, `gemini-4-argon-d`, etc.), and hook/swarm slugs
 * (`gemini-4-carbon-high`, `claude-opus-5-5-high`, etc.) to unified human-readable display names.
 */
const CANONICAL_MODEL_MAP = Object.freeze({
  // Internal ModelEnum values from `conversations/<convId>.db` (`gen_metadata`) & `antigravity_state.pbtxt`
  model_placeholder_m427: 'Gemini 4 Carbon (High)',
  model_placeholder_m417: 'Gemini 4 Argon (High)',
  model_placeholder_m402: 'Claude Opus 5.5 (High)',
  model_placeholder_m298: 'Gemini 3.7 Flash (High)',
  model_placeholder_m26: 'Claude Opus 4.6 (Thinking)',
  model_placeholder_m16: 'Gemini 3.1 Pro (High)',

  // Backend model IDs & hook/swarm slugs
  'gemini-4-carbon': 'Gemini 4 Carbon (High)',
  'gemini-4-carbon-high': 'Gemini 4 Carbon (High)',
  'gemini-4-carbon-medium': 'Gemini 4 Carbon (Medium)',
  'gemini-4-carbon-low': 'Gemini 4 Carbon (Low)',
  'gemini 4 carbon (high)': 'Gemini 4 Carbon (High)',
  'gemini 4 carbon (medium)': 'Gemini 4 Carbon (Medium)',
  'gemini 4 carbon (low)': 'Gemini 4 Carbon (Low)',

  'gemini-4-argon': 'Gemini 4 Argon (High)',
  'gemini-4-argon-c': 'Gemini 4 Argon (High)',
  'gemini-4-argon-d': 'Gemini 4 Argon (High)',
  'gemini-4-argon-trial': 'Gemini 4 Argon (High)',
  'gemini-4-argon-high': 'Gemini 4 Argon (High)',
  'gemini-4-argon-medium': 'Gemini 4 Argon (Medium)',
  'gemini-4-argon-low': 'Gemini 4 Argon (Low)',
  'gemini 4 argon (high)': 'Gemini 4 Argon (High)',
  'gemini 4 argon (medium)': 'Gemini 4 Argon (Medium)',
  'gemini 4 argon (low)': 'Gemini 4 Argon (Low)',

  'claude-opus-5-5': 'Claude Opus 5.5 (High)',
  'claude-opus-5-5-high': 'Claude Opus 5.5 (High)',
  'claude-opus-5-5-medium': 'Claude Opus 5.5 (Medium)',
  'claude-opus-5-5-low': 'Claude Opus 5.5 (Low)',
  'claude opus 5.5 (high)': 'Claude Opus 5.5 (High)',
  'claude opus 5.5 (medium)': 'Claude Opus 5.5 (Medium)',
  'claude opus 5.5 (low)': 'Claude Opus 5.5 (Low)',

  'claude-sonnet-5-5': 'Claude Sonnet 5.5 (High)',
  'claude-sonnet-5-5-high': 'Claude Sonnet 5.5 (High)',
  'claude-sonnet-5-5-medium': 'Claude Sonnet 5.5 (Medium)',
  'claude-sonnet-5-5-low': 'Claude Sonnet 5.5 (Low)',
  'claude sonnet 5.5 (high)': 'Claude Sonnet 5.5 (High)',
  'claude sonnet 5.5 (medium)': 'Claude Sonnet 5.5 (Medium)',
  'claude sonnet 5.5 (low)': 'Claude Sonnet 5.5 (Low)',

  'claude-opus-4-6-thinking': 'Claude Opus 4.6 (Thinking)',
  'claude opus 4.6 (thinking)': 'Claude Opus 4.6 (Thinking)',
  'claude-sonnet-4-6-thinking': 'Claude Sonnet 4.6 (Thinking)',
  'claude sonnet 4.6 (thinking)': 'Claude Sonnet 4.6 (Thinking)',
  'claude-sonnet-4-5-thinking': 'Claude Sonnet 4.5 (Thinking)',
  'claude sonnet 4.5 (thinking)': 'Claude Sonnet 4.5 (Thinking)',

  'gemini-3.8-flash-high': 'Gemini 3.8 Flash (High)',
  'gemini-3.8-flash-medium': 'Gemini 3.8 Flash (Medium)',
  'gemini-3.8-flash-low': 'Gemini 3.8 Flash (Low)',
  'gemini-3.8-flash-tiered': 'Gemini 3.8 Flash',
  'gemini 3.8 flash (high)': 'Gemini 3.8 Flash (High)',
  'gemini 3.8 flash (medium)': 'Gemini 3.8 Flash (Medium)',
  'gemini 3.8 flash (low)': 'Gemini 3.8 Flash (Low)',
  'gemini 3.8 flash': 'Gemini 3.8 Flash',

  'gemini-3.7-flash': 'Gemini 3.7 Flash (High)',
  'gemini-3.7-flash-high': 'Gemini 3.7 Flash (High)',
  'gemini 3.7 flash (high)': 'Gemini 3.7 Flash (High)',

  'gemini-3.5-flash': 'Gemini 3.5 Flash (High)',
  'gemini-3.5-flash-high': 'Gemini 3.5 Flash (High)',
  'gemini 3.5 flash (high)': 'Gemini 3.5 Flash (High)',

  'gemini-pro-default': 'Gemini 3.1 Pro (High)',
  'gemini-3.1-pro-high': 'Gemini 3.1 Pro (High)',
  'gemini-3.1-pro-low': 'Gemini 3.1 Pro (Low)',
  'gemini 3.1 pro (high)': 'Gemini 3.1 Pro (High)',
  'gemini 3.1 pro (low)': 'Gemini 3.1 Pro (Low)',

  'gpt-oss-120b-medium': 'GPT-OSS 120B (Medium)',
  'gpt-oss 120b (medium)': 'GPT-OSS 120B (Medium)',
});

/**
 * Returns true if a raw model string is empty or represents an unresolved placeholder (`auto`, `none`, `inherit`, etc.).
 * @param {unknown} rawLabel
 * @returns {boolean}
 */
export function isAutoOrEmptyModel(rawLabel) {
  if (typeof rawLabel !== 'string') return true;
  const cleaned = rawLabel.trim().replace(/^['"`]|['"`]$/g, '').trim();
  if (!cleaned) return true;
  return AUTO_OR_EMPTY_MODEL_REGEX.test(cleaned);
}

/**
 * Normalizes a raw model identifier/enum/slug into a canonical real model name,
 * or returns `''` if the value is unset / `'Auto'` / `'None'` / `'inherit'`.
 * Never returns `'Auto'` or `'auto'`.
 *
 * @param {unknown} rawLabel
 * @returns {string}
 */
export function canonicalizeModelName(rawLabel) {
  if (typeof rawLabel !== 'string') return '';
  const cleaned = rawLabel.trim().replace(/^['"`]|['"`]$/g, '').trim();
  if (!cleaned || AUTO_OR_EMPTY_MODEL_REGEX.test(cleaned)) {
    return '';
  }
  const mapped = CANONICAL_MODEL_MAP[cleaned.toLowerCase()];
  return mapped || cleaned;
}

/**
 * Formats an epoch millisecond timestamp as `YYYY-MM-DD` in local timezone.
 * @param {number} ms
 * @returns {string}
 */
export function formatLocalDate(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return '';
  const d = new Date(ms);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toNonNegInt(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return 0;
  return Math.floor(num);
}

/**
 * Counts CJK vs non-CJK/ASCII characters in a string for token estimation.
 * @param {string} text
 * @returns {{ cjkChars: number, asciiChars: number }}
 */
export function countStepChars(text) {
  if (typeof text !== 'string' || text.length === 0) {
    return { cjkChars: 0, asciiChars: 0 };
  }
  let cjkChars = 0;
  let asciiChars = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0) || 0;
    if ((cp >= 0x20000 && cp <= 0x2fa1f) || CJK_REGEX.test(ch)) {
      cjkChars += 1;
    } else {
      asciiChars += 1;
    }
  }
  return { cjkChars, asciiChars };
}

/**
 * Unwraps AGY `tool_calls[].args` values, which are often JSON-encoded string literals
 * (e.g. `"\"/path/to/SKILL.md\""` -> `"/path/to/SKILL.md"`).
 */
function unwrapArgValue(val) {
  if (val === null || val === undefined) return val;
  if (typeof val !== 'string') return val;
  const trimmed = val.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'))
  ) {
    try {
      return JSON.parse(trimmed);
    } catch {
      if (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) {
        return trimmed.slice(1, -1);
      }
    }
  }
  return val;
}

function normalizeToolArgs(rawArgs) {
  if (!rawArgs) return {};
  let parsedArgs = rawArgs;
  if (typeof rawArgs === 'string') {
    try {
      parsedArgs = JSON.parse(rawArgs);
    } catch {
      return {};
    }
  }
  if (typeof parsedArgs !== 'object' || Array.isArray(parsedArgs)) {
    return {};
  }
  const clean = {};
  for (const [k, v] of Object.entries(parsedArgs)) {
    clean[k] = unwrapArgValue(v);
  }
  return clean;
}

function truncateClean(str, maxLen = 160) {
  if (typeof str !== 'string') return '';
  const singleLine = str.replace(/\s+/g, ' ').trim();
  if (singleLine.length <= maxLen) return singleLine;
  return `${singleLine.slice(0, maxLen - 1)}…`;
}

function isSkillFilePath(targetPath) {
  if (typeof targetPath !== 'string' || !targetPath) return false;
  return /(?:^|[\\/])SKILL\.md$/i.test(targetPath.trim());
}

const SKILL_READ_TOOLS = new Set(['read_file', 'view_file', 'view_file_outline', 'read_resource']);

function parseToolCallsFromStep(rawToolCalls) {
  if (!Array.isArray(rawToolCalls) || rawToolCalls.length === 0) {
    return [];
  }
  const result = [];
  for (const tc of rawToolCalls) {
    if (!tc || typeof tc !== 'object') continue;
    const name = typeof tc.name === 'string' && tc.name ? tc.name : 'unknown_tool';
    const args = normalizeToolArgs(tc.args ?? tc.arguments ?? tc.parameters ?? {});

    const rawPath =
      args.Path ??
      args.path ??
      args.file_path ??
      args.filePath ??
      args.TargetFile ??
      args.target_file ??
      args.DirectoryPath ??
      args.SearchPath ??
      args.Uri ??
      tc.targetPath ??
      null;
    const targetPath = typeof rawPath === 'string' && rawPath.trim() ? rawPath.trim() : null;

    const rawSummary =
      tc.summary ??
      args.toolSummary ??
      args.Summary ??
      args.CommandLine ??
      args.command ??
      args.query ??
      targetPath ??
      name;
    const summary = truncateClean(String(rawSummary ?? name), 160);

    const isSkillRead = SKILL_READ_TOOLS.has(name) && isSkillFilePath(targetPath);

    result.push({
      name,
      targetPath,
      summary,
      isSkillRead,
      skillPath: isSkillRead ? targetPath : null,
      _args: args,
    });
  }
  return result;
}

/**
 * Extracts `{ fromModel, toModel }` transitions from `<USER_SETTINGS_CHANGE>...</USER_SETTINGS_CHANGE>` blocks.
 * Both `fromModel` and `toModel` are canonicalized (`''` when `None`/`Auto`).
 */
export function extractModelTransitionsFromContent(content) {
  if (typeof content !== 'string' || !content.includes('USER_SETTINGS_CHANGE')) {
    return [];
  }
  const transitions = [];
  const blockRegex = /<USER_SETTINGS_CHANGE>([\s\S]*?)<\/USER_SETTINGS_CHANGE>/gi;
  let match;
  while ((match = blockRegex.exec(content)) !== null) {
    const inner = match[1].trim();
    if (!inner) continue;

    // 1. Official AGY format:
    // "The user changed setting `Model Selection` from None to Gemini 4 Carbon (High). No need to comment..."
    const agyMatch = inner.match(
      /`?Model Selection`?\s+from\s+`?([^\n`]+?)`?\s+to\s+`?([^\n`]+?)`?(?:\.\s+(?:No need|If reporting)|\.?\s*$|\n)/i,
    );
    if (agyMatch && agyMatch[2]) {
      const fromRaw = (agyMatch[1] || '').trim().replace(/\.$/, '').trim();
      const toRaw = agyMatch[2].trim().replace(/\.$/, '').trim();
      transitions.push({
        fromModel: canonicalizeModelName(fromRaw),
        toModel: canonicalizeModelName(toRaw),
      });
      continue;
    }

    // 2. JSON object inside tag
    if (inner.startsWith('{') && inner.endsWith('}')) {
      try {
        const obj = JSON.parse(inner);
        const m = obj.modelName ?? obj.model ?? obj.modelSelection;
        if (typeof m === 'string') {
          transitions.push({
            fromModel: canonicalizeModelName(obj.fromModel ?? obj.previousModel ?? ''),
            toModel: canonicalizeModelName(m),
          });
          continue;
        }
      } catch {
        // Ignore non-JSON
      }
    }

    // 3. Key-value fallback (`model: ...` or `Model Selection: ...`)
    const kvMatch = inner.match(
      /(?:model(?:_name|Name|\s+selection)?)\s*[:=]\s*`?([^`\n<]+)`?/i,
    );
    if (kvMatch && kvMatch[1]) {
      transitions.push({
        fromModel: '',
        toModel: canonicalizeModelName(kvMatch[1].trim().replace(/\.$/, '')),
      });
      continue;
    }

    // 4. Generic `from X to Y` fallback
    const fromToMatch = inner.match(/\bfrom\s+`?([^`\n<]+?)`?\s+to\s+`?([^`.\n<]+)`?/i);
    if (fromToMatch && fromToMatch[2]) {
      transitions.push({
        fromModel: canonicalizeModelName(fromToMatch[1].trim()),
        toModel: canonicalizeModelName(fromToMatch[2].trim()),
      });
    }
  }
  return transitions;
}

/**
 * Extracts canonical target model names from `<USER_SETTINGS_CHANGE>...</USER_SETTINGS_CHANGE>` blocks.
 * Returns `''` (never `'Auto'`) when switched to `None` / `Auto`.
 */
export function extractModelChangesFromContent(content) {
  return extractModelTransitionsFromContent(content).map((t) => t.toModel);
}

function normalizeModelLabel(rawLabel) {
  return canonicalizeModelName(rawLabel);
}

function readProtoVarint(buf, startPos) {
  let result = 0;
  let multiplier = 1;
  let pos = startPos;
  let count = 0;
  while (pos < buf.length && count < 10) {
    const byte = buf[pos++];
    result += (byte & 0x7f) * multiplier;
    if ((byte & 0x80) === 0) {
      return { value: result, nextPos: pos };
    }
    multiplier *= 128;
    count += 1;
  }
  return null;
}

function parseMapStringEntry(entryBuf) {
  let pos = 0;
  let key = '';
  let val = '';
  while (pos < entryBuf.length) {
    const tag = readProtoVarint(entryBuf, pos);
    if (!tag) break;
    pos = tag.nextPos;
    const fieldNo = Math.floor(tag.value / 8);
    const wireType = tag.value % 8;
    if (wireType === 2) {
      const lenRes = readProtoVarint(entryBuf, pos);
      if (!lenRes) break;
      const end = lenRes.nextPos + lenRes.value;
      if (end > entryBuf.length) break;
      const str = entryBuf.subarray(lenRes.nextPos, end).toString('utf8');
      if (fieldNo === 1) key = str;
      else if (fieldNo === 2) val = str;
      pos = end;
    } else if (wireType === 0) {
      const v = readProtoVarint(entryBuf, pos);
      if (!v) break;
      pos = v.nextPos;
    } else if (wireType === 1) {
      pos += 8;
    } else if (wireType === 5) {
      pos += 4;
    } else {
      break;
    }
  }
  return { key, val };
}

function openReadOnlySqliteDb(DatabaseSync, dbPath) {
  try {
    return new DatabaseSync(dbPath, { open: true, readOnly: true, timeout: 1500 });
  } catch {
    return new DatabaseSync(dbPath, { open: true, readOnly: true });
  }
}

function parseGeneratorMetadataMessage(genBuf) {
  let pos = 0;
  let backendModel = '';
  let modelEnum = '';
  let displayModel = '';
  let contextLimit = null;
  while (pos < genBuf.length) {
    const tag = readProtoVarint(genBuf, pos);
    if (!tag) break;
    pos = tag.nextPos;
    const fieldNo = Math.floor(tag.value / 8);
    const wireType = tag.value % 8;
    if (wireType === 2) {
      const lenRes = readProtoVarint(genBuf, pos);
      if (!lenRes) break;
      const end = lenRes.nextPos + lenRes.value;
      if (end > genBuf.length) break;
      const sub = genBuf.subarray(lenRes.nextPos, end);
      pos = end;
      if (fieldNo === 9) {
        const f10 = findProtoSubfield(sub, 10, 2);
        const lim = f10 ? findProtoSubfield(f10, 4, 0) : null;
        if (typeof lim === 'number' && Number.isFinite(lim) && lim >= 16_000 && lim <= 10_000_000) {
          contextLimit = Math.round(lim);
        }
      } else if (fieldNo === 19) {
        backendModel = sub.toString('utf8').trim();
      } else if (fieldNo === 20) {
        const entry = parseMapStringEntry(sub);
        if (entry.key === 'model_enum' && entry.val) {
          modelEnum = entry.val.trim();
        }
      } else if (fieldNo === 21) {
        displayModel = sub.toString('utf8').trim();
      }
    } else if (wireType === 0) {
      const v = readProtoVarint(genBuf, pos);
      if (!v) break;
      pos = v.nextPos;
    } else if (wireType === 1) {
      pos += 8;
    } else if (wireType === 5) {
      pos += 4;
    } else {
      break;
    }
  }
  return { backendModel, modelEnum, displayModel, contextLimit };
}

/**
 * Decodes an AGY `conversations/<convId>.db` `gen_metadata.data` protobuf blob into
 * `{ stepIndices, backendModel, modelEnum, displayModel, modelName, contextLimit }`.
 *
 * @param {Buffer | Uint8Array} rawBuf
 * @returns {{
 *   stepIndices: number[],
 *   backendModel: string,
 *   modelEnum: string,
 *   displayModel: string,
 *   modelName: string,
 *   contextLimit: number | null
 * }}
 */
export function parseGenMetadataProtobuf(rawBuf) {
  if (!rawBuf || !(rawBuf instanceof Uint8Array) || rawBuf.length === 0) {
    return {
      stepIndices: [],
      backendModel: '',
      modelEnum: '',
      displayModel: '',
      modelName: '',
      contextLimit: null,
    };
  }
  const buf = Buffer.isBuffer(rawBuf) ? rawBuf : Buffer.from(rawBuf.buffer, rawBuf.byteOffset, rawBuf.byteLength);
  let pos = 0;
  const stepIndices = [];
  let backendModel = '';
  let modelEnum = '';
  let displayModel = '';
  let contextLimit = null;

  while (pos < buf.length) {
    const tag = readProtoVarint(buf, pos);
    if (!tag) break;
    pos = tag.nextPos;
    const fieldNo = Math.floor(tag.value / 8);
    const wireType = tag.value % 8;

    if (wireType === 2) {
      const lenRes = readProtoVarint(buf, pos);
      if (!lenRes) break;
      const end = lenRes.nextPos + lenRes.value;
      if (end > buf.length) break;
      const sub = buf.subarray(lenRes.nextPos, end);
      pos = end;

      if (fieldNo === 1) {
        const meta = parseGeneratorMetadataMessage(sub);
        if (meta.backendModel) backendModel = meta.backendModel;
        if (meta.modelEnum) modelEnum = meta.modelEnum;
        if (meta.displayModel) displayModel = meta.displayModel;
        if (meta.contextLimit) contextLimit = meta.contextLimit;
      } else if (fieldNo === 2) {
        let pPos = 0;
        while (pPos < sub.length) {
          const sv = readProtoVarint(sub, pPos);
          if (!sv) break;
          pPos = sv.nextPos;
          if (Number.isFinite(sv.value) && sv.value >= 0) {
            stepIndices.push(sv.value);
          }
        }
      }
    } else if (wireType === 0) {
      const v = readProtoVarint(buf, pos);
      if (!v) break;
      pos = v.nextPos;
      if (fieldNo === 2 && Number.isFinite(v.value) && v.value >= 0) {
        stepIndices.push(v.value);
      }
    } else if (wireType === 1) {
      pos += 8;
    } else if (wireType === 5) {
      pos += 4;
    } else {
      break;
    }
  }

  const modelName =
    canonicalizeModelName(displayModel) ||
    canonicalizeModelName(modelEnum) ||
    canonicalizeModelName(backendModel) ||
    '';

  return {
    stepIndices,
    backendModel,
    modelEnum,
    displayModel,
    modelName,
    contextLimit,
  };
}

function findProtoSubfield(buf, targetFieldNo, targetWireType) {
  let pos = 0;
  let found = null;
  while (pos < buf.length) {
    const tag = readProtoVarint(buf, pos);
    if (!tag) break;
    pos = tag.nextPos;
    const fieldNo = Math.floor(tag.value / 8);
    const wireType = tag.value % 8;
    if (wireType === 0) {
      const v = readProtoVarint(buf, pos);
      if (!v) break;
      pos = v.nextPos;
      if (fieldNo === targetFieldNo && targetWireType === 0) {
        found = v.value;
      }
    } else if (wireType === 2) {
      const lenRes = readProtoVarint(buf, pos);
      if (!lenRes || lenRes.value < 0) break;
      const end = lenRes.nextPos + lenRes.value;
      if (end > buf.length) break;
      if (fieldNo === targetFieldNo && targetWireType === 2) {
        found = buf.subarray(lenRes.nextPos, end);
      }
      pos = end;
    } else if (wireType === 1) {
      pos += 8;
    } else if (wireType === 5) {
      pos += 4;
    } else {
      break;
    }
  }
  return found;
}

/**
 * Decodes the active conversation context/compaction window limit from an AGY
 * `conversations/<convId>.db` `executor_metadata.data` protobuf blob (field path `10 -> 2 -> 5`).
 *
 * @param {Buffer | Uint8Array | null | undefined} rawBuf
 * @returns {number | null}
 */
export function parseExecutorMetadataContextLimit(rawBuf) {
  if (!rawBuf || !(rawBuf instanceof Uint8Array) || rawBuf.length === 0) {
    return null;
  }
  const buf = Buffer.isBuffer(rawBuf)
    ? rawBuf
    : Buffer.from(rawBuf.buffer, rawBuf.byteOffset, rawBuf.byteLength);
  const f10 = findProtoSubfield(buf, 10, 2);
  if (!f10) return null;
  const f2 = findProtoSubfield(f10, 2, 2);
  if (!f2) return null;
  const limit = findProtoSubfield(f2, 5, 0);
  if (typeof limit === 'number' && Number.isFinite(limit) && limit >= 16_000 && limit <= 10_000_000) {
    return Math.round(limit);
  }
  return null;
}

/**
 * Decodes the active conversation context window limit from an AGY `conversations/<convId>.db`
 * `gen_metadata.data` protobuf blob (field path `1 -> 9 -> 10 -> 4`).
 * Unlike `executor_metadata` (which is only persisted when a turn finishes on `Stop`),
 * `gen_metadata` is written after every single LLM step starting at `idx = 0`.
 *
 * @param {Buffer | Uint8Array | null | undefined} rawBuf
 * @returns {number | null}
 */
export function parseGenMetadataContextLimit(rawBuf) {
  if (!rawBuf || !(rawBuf instanceof Uint8Array) || rawBuf.length === 0) {
    return null;
  }
  const buf = Buffer.isBuffer(rawBuf)
    ? rawBuf
    : Buffer.from(rawBuf.buffer, rawBuf.byteOffset, rawBuf.byteLength);
  const f1 = findProtoSubfield(buf, 1, 2);
  if (!f1) return null;
  const f9 = findProtoSubfield(f1, 9, 2);
  if (!f9) return null;
  const f10 = findProtoSubfield(f9, 10, 2);
  if (!f10) return null;
  const limit = findProtoSubfield(f10, 4, 0);
  if (typeof limit === 'number' && Number.isFinite(limit) && limit >= 16_000 && limit <= 10_000_000) {
    return Math.round(limit);
  }
  return null;
}

const BRAIN_TRANSCRIPT_PATH_REGEX =
  /[\\/]brain[\\/]([^\\/]+)[\\/](?:\.system_generated[\\/]logs[\\/])?transcript(?:_full)?\.jsonl$/i;

function inferTrajectoryDbPathFromTranscript(transcriptPath) {
  if (typeof transcriptPath !== 'string' || !transcriptPath) return null;
  const m = transcriptPath.match(BRAIN_TRANSCRIPT_PATH_REGEX);
  if (!m || m.index === undefined || !m[1]) return null;
  const rootDir = transcriptPath.slice(0, m.index);
  const convId = m[1];
  if (!rootDir || !convId) return null;

  const directDb = path.join(rootDir, 'conversations', `${convId}.db`);
  try {
    if (fs.statSync(directDb).isFile()) return directDb;
  } catch {
    // Try sibling `antigravity/conversations/<convId>.db` when running under `antigravity-ide` / `antigravity-cli`
  }

  const baseName = path.basename(rootDir);
  if (baseName !== 'antigravity') {
    const siblingDb = path.join(path.dirname(rootDir), 'antigravity', 'conversations', `${convId}.db`);
    try {
      if (fs.statSync(siblingDb).isFile()) return siblingDb;
    } catch {
      // No trajectory DB on disk
    }
  }
  return null;
}

function statTrajectoryDbWithWal(dbPath, preDbStat) {
  if (!dbPath) return null;
  if (
    preDbStat &&
    typeof preDbStat.mtimeMs === 'number' &&
    typeof preDbStat.size === 'number' &&
    (preDbStat.mtimeMs > 0 || preDbStat.size > 0)
  ) {
    return { mtimeMs: preDbStat.mtimeMs, size: preDbStat.size };
  }
  try {
    const st = fs.statSync(dbPath);
    if (!st.isFile()) return null;
    let walMtime = 0;
    let walSize = 0;
    try {
      const walSt = fs.statSync(`${dbPath}-wal`);
      if (walSt.isFile()) {
        walMtime = walSt.mtimeMs;
        walSize = walSt.size;
      }
    } catch {
      // No WAL file
    }
    return {
      mtimeMs: Math.max(st.mtimeMs, walMtime),
      size: st.size + walSize,
    };
  } catch {
    return null;
  }
}

/**
 * Incrementally reads per-step ground-truth models from `conversations/<convId>.db` (`gen_metadata` table),
 * stat-cached by `{ mtimeMs, size }` so unchanged trajectory DBs incur 0 SQLite openings.
 */
export function readTrajectoryDbModels(dbPath, prevDbState = null, preDbStat = null) {
  if (!dbPath) return null;
  const dbStat = statTrajectoryDbWithWal(dbPath, preDbStat);
  if (!dbStat) return null;

  if (
    prevDbState &&
    prevDbState.dbPath === dbPath &&
    prevDbState.mtimeMs === dbStat.mtimeMs &&
    prevDbState.size === dbStat.size
  ) {
    return prevDbState;
  }

  const DatabaseSync = getSqliteDatabaseSync();
  if (!DatabaseSync) return prevDbState || null;

  const canAppend = Boolean(
    prevDbState &&
      prevDbState.dbPath === dbPath &&
      dbStat.size >= prevDbState.size &&
      typeof prevDbState.maxIdx === 'number' &&
      prevDbState.maxIdx >= 0 &&
      prevDbState.stepModels instanceof Map,
  );

  const stepModels = canAppend ? new Map(prevDbState.stepModels) : new Map();
  let firstModel = canAppend ? prevDbState.firstModel || '' : '';
  let latestModel = canAppend ? prevDbState.latestModel || '' : '';
  let maxIdx = canAppend ? prevDbState.maxIdx : -1;
  let execMaxIdx = canAppend && typeof prevDbState.execMaxIdx === 'number' ? prevDbState.execMaxIdx : -1;
  let contextLimit = canAppend && prevDbState.contextLimit ? prevDbState.contextLimit : null;
  let hasExecTable = canAppend ? Boolean(prevDbState.hasExecTable) : false;

  let db = null;
  try {
    db = openReadOnlySqliteDb(DatabaseSync, dbPath);
    let hasGenTable = canAppend;
    if (!canAppend) {
      const tables = db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('gen_metadata', 'executor_metadata')",
        )
        .all();
      const names = new Set(tables.map((t) => t.name));
      hasGenTable = names.has('gen_metadata');
      hasExecTable = names.has('executor_metadata');
    }

    if (hasExecTable) {
      const execRow =
        execMaxIdx >= 0
          ? db
              .prepare('SELECT idx, data FROM executor_metadata WHERE idx > ? ORDER BY idx DESC LIMIT 1')
              .get(execMaxIdx)
          : db.prepare('SELECT idx, data FROM executor_metadata ORDER BY idx DESC LIMIT 1').get();
      if (execRow) {
        const eIdx = typeof execRow.idx === 'number' ? execRow.idx : Number(execRow.idx);
        if (Number.isFinite(eIdx) && eIdx > execMaxIdx) {
          execMaxIdx = eIdx;
        }
        const parsedLimit = parseExecutorMetadataContextLimit(execRow.data);
        if (parsedLimit) {
          contextLimit = parsedLimit;
        }
      }
    }

    if (!hasGenTable) {
      return {
        dbPath,
        mtimeMs: dbStat.mtimeMs,
        size: dbStat.size,
        maxIdx: -1,
        execMaxIdx,
        hasExecTable,
        stepModels,
        firstModel: '',
        latestModel: '',
        contextLimit,
        sig: `${dbPath}:${dbStat.mtimeMs}:${dbStat.size}:empty:${contextLimit || 0}`,
      };
    }

    const rows = canAppend
      ? db.prepare('SELECT idx, data FROM gen_metadata WHERE idx > ? ORDER BY idx ASC').all(maxIdx)
      : db.prepare('SELECT idx, data FROM gen_metadata ORDER BY idx ASC').all();

    for (const row of rows) {
      const idx = typeof row.idx === 'number' ? row.idx : Number(row.idx);
      if (Number.isFinite(idx) && idx > maxIdx) {
        maxIdx = idx;
      }
      if (!row.data) continue;
      const decoded = parseGenMetadataProtobuf(row.data);
      if (decoded.contextLimit) {
        contextLimit = decoded.contextLimit;
      }
      if (!decoded.modelName) continue;
      if (!firstModel) firstModel = decoded.modelName;
      latestModel = decoded.modelName;
      for (const sIdx of decoded.stepIndices) {
        stepModels.set(sIdx, decoded.modelName);
      }
    }

    return {
      dbPath,
      mtimeMs: dbStat.mtimeMs,
      size: dbStat.size,
      maxIdx,
      execMaxIdx,
      hasExecTable,
      stepModels,
      firstModel,
      latestModel,
      contextLimit,
      sig: `${dbPath}:${dbStat.mtimeMs}:${dbStat.size}:${maxIdx}:${latestModel}:${contextLimit || 0}`,
    };
  } catch {
    return prevDbState || null;
  } finally {
    if (db) {
      try {
        db.close();
      } catch {
        // Ignore close errors
      }
    }
  }
}

/**
 * Extracts clean title from a `USER_INPUT` content string, stripping `<USER_REQUEST>` and metadata blocks.
 */
export function extractCleanUserTitle(content) {
  if (typeof content !== 'string' || !content.trim()) return null;

  const userReqMatch = content.match(/<USER_REQUEST>([\s\S]*?)<\/USER_REQUEST>/i);
  let body = userReqMatch ? userReqMatch[1] : content;

  body = body
    .replace(/<ADDITIONAL_METADATA>[\s\S]*?<\/ADDITIONAL_METADATA>/gi, '')
    .replace(/<USER_SETTINGS_CHANGE>[\s\S]*?<\/USER_SETTINGS_CHANGE>/gi, '')
    .replace(/<user_information>[\s\S]*?<\/user_information>/gi, '')
    .replace(/<SYSTEM_MESSAGE>[\s\S]*?<\/SYSTEM_MESSAGE>/gi, '')
    .replace(/<\/?USER_REQUEST>/gi, '')
    .trim();

  if (!body) return null;

  const lines = body
    .split(/\r?\n/)
    .map((l) => l.replace(/^#+\s*/, '').trim())
    .filter(Boolean);
  if (lines.length === 0) return null;

  return truncateClean(lines[0], 120);
}

/**
 * Extracts workspace path from `<user_information>` or initial swarm/system context.
 */
export function extractWorkspaceFromContent(content) {
  if (typeof content !== 'string' || !content) return null;

  const userInfoMatch = content.match(/<user_information>([\s\S]*?)<\/user_information>/i);
  const target = userInfoMatch ? userInfoMatch[1] : content;

  const activeWsMatch = target.match(/Active Workspaces:\s*\r?\n\s*-\s*([^\r\n]+)/i);
  if (activeWsMatch && activeWsMatch[1]?.trim()) {
    return activeWsMatch[1].trim();
  }

  const cwdMatch = target.match(/Command Working Directory:\s*([^\r\n]+)/i);
  if (cwdMatch && cwdMatch[1]?.trim()) {
    return cwdMatch[1].trim();
  }

  // Swarm brief pattern: `in \`/path/to/workspace\``
  if (content.includes('<SYSTEM_MESSAGE>')) {
    const briefPathMatch = content.match(/\bin\s+`((?:\/|[A-Za-z]:[\\/])[^`\r\n]+)`/);
    if (briefPathMatch && briefPathMatch[1]?.trim()) {
      return briefPathMatch[1].trim();
    }
  }

  return null;
}

function extractCompletedAtMs(content) {
  if (typeof content !== 'string' || !content.includes('Completed At:')) return null;
  const m = content.match(/Completed At:\s*([^\r\n]+)/);
  if (!m || !m[1]) return null;
  const ts = Date.parse(m[1].trim());
  return Number.isFinite(ts) ? ts : null;
}

const UUID_LIKE_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SAFE_CONV_ID_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9_-]{3,127}$/;

function isValidChildId(id) {
  if (typeof id !== 'string') return false;
  const t = id.trim();
  return UUID_LIKE_REGEX.test(t) || SAFE_CONV_ID_REGEX.test(t);
}

function extractSpawnedChildrenFromToolResult(matchedCall, content, stepIndex, outList, seenSet) {
  const toolName = matchedCall?.name || '';
  const args = matchedCall?._args || {};
  const isSubagentTool =
    toolName === 'invoke_subagent' ||
    toolName === 'browser_subagent' ||
    toolName === 'swarm' ||
    toolName.includes('subagent');

  const argModel = canonicalizeModelName(args.model ?? args.Model ?? '');

  const pushChild = (childId, roleHint, titleHint, modelHint = '') => {
    const cid = typeof childId === 'string' ? childId.trim() : '';
    if (!cid || !isValidChildId(cid)) return;
    const cleanModel = canonicalizeModelName(modelHint) || argModel;
    if (seenSet.has(cid)) {
      if (cleanModel) {
        const existingIdx = outList.findIndex((c) => c.conversationId === cid);
        if (existingIdx >= 0 && !outList[existingIdx].model) {
          outList[existingIdx] = { ...outList[existingIdx], model: cleanModel };
        }
      }
      return;
    }
    seenSet.add(cid);
    outList.push({
      conversationId: cid,
      role: roleHint || 'subagent',
      title: titleHint || '',
      sourceTool: toolName || 'subagent',
      stepIndex,
      ...(cleanModel ? { model: cleanModel } : {}),
    });
  };

  const argRole =
    args.name ||
    args.subagent_name ||
    args.SubagentName ||
    args.agent_name ||
    args.agentName ||
    args.role ||
    (toolName && toolName !== 'invoke_subagent' ? toolName : 'subagent');
  const argChildId =
    args.conversation_id || args.conversationId || args.child_conversation_id || null;
  if (isSubagentTool && argChildId) {
    pushChild(String(argChildId), String(argRole), String(args.task || args.brief || ''), argModel);
  }

  if (typeof content !== 'string' || !content) return;

  // 1. Check `conversation://<convId>` links anywhere in tool output
  const uriRegex = /conversation:\/\/([a-zA-Z0-9_-]{4,128})/g;
  let uriMatch;
  while ((uriMatch = uriRegex.exec(content)) !== null) {
    pushChild(uriMatch[1], String(argRole), '', argModel);
  }

  if (!isSubagentTool && !content.includes('conversation_id') && !content.includes('conversationId')) {
    return;
  }

  // 2. Check JSON payload lines (e.g. `swarm` `add`/`status` returns `{"status":"added","name":"...","conversation_id":"...","model":"..."}`)
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) continue;
    try {
      const parsed = JSON.parse(trimmed);
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of items) {
        if (!item || typeof item !== 'object') continue;
        // Skip swarm board message arrays (`messages: [...]`)
        if (Array.isArray(item.messages)) continue;
        const cid =
          item.conversation_id ||
          item.conversationId ||
          item.subagent_conversation_id ||
          item.agent_conversation_id;
        if (cid) {
          const itemRole = item.name || item.agent_name || item.subagent_name || item.role || argRole;
          const itemModel = item.model_display_name || item.modelDisplayName || item.model || '';
          pushChild(
            String(cid),
            String(itemRole || 'subagent'),
            String(item.title || ''),
            String(itemModel),
          );
        }
        const memberLists = [item.workers, item.members].filter(Array.isArray);
        for (const list of memberLists) {
          for (const w of list) {
            const wcid = w?.conversation_id || w?.conversationId;
            if (wcid) {
              pushChild(
                String(wcid),
                String(w.name || argRole || 'worker'),
                '',
                String(w.model_display_name || w.modelDisplayName || w.model || ''),
              );
            }
          }
        }
      }
    } catch {
      // Ignore non-JSON lines
    }
  }

  // 3. Plain-text key/value fallback in subagent output (`conversation_id: <id>` or `Conversation ID: <id>`)
  if (isSubagentTool) {
    const kvMatch = content.match(
      /(?:subagent_)?conversation[_\s-]?id\s*[:=]\s*["']?([a-zA-Z0-9_-]{4,128})["']?/i,
    );
    if (kvMatch && kvMatch[1]) {
      pushChild(kvMatch[1], String(argRole || 'subagent'), '', argModel);
    }
  }
}

function extractInferredParentFromSystemMessage(content) {
  if (typeof content !== 'string' || !content.includes('[Message]')) return null;
  // Matches AGY initial worker / subagent message:
  // `[Message] timestamp=... sender=<parentUUID> priority=... content=You have just started. Your assignment (recorded on the board as #2 for @ingestion):`
  const senderMatch = content.match(/\bsender=([0-9a-fA-F-]{8,128})\b/);
  if (!senderMatch) return null;
  const senderId = senderMatch[1];
  // Ignore task notifications (`<convId>/task-85`); only accept clean conversation IDs when paired with startup or subagent brief
  if (content.includes(`sender=${senderId}/`)) return null;
  if (!content.includes('You have just started') && !content.includes('assignment')) {
    return null;
  }
  const roleMatch = content.match(/for\s+@([a-zA-Z0-9_-]+)/);
  return {
    parentId: senderId,
    role: roleMatch ? roleMatch[1] : 'worker',
  };
}

function createFreshMutableParserState() {
  return {
    baseSteps: [],
    pendingToolCalls: [],
    settingsModelName: '',
    initialFromModel: '',
    hasSeenModelSetting: false,
    firstUserTitle: null,
    workspace: null,
    spawnedChildren: [],
    seenChildIds: new Set(),
    inferredParentId: null,
    inferredRole: null,
  };
}

function cloneMutableParserState(prev) {
  return {
    baseSteps: prev.baseSteps.slice(),
    pendingToolCalls: prev.pendingToolCalls.slice(),
    settingsModelName: prev.settingsModelName,
    initialFromModel: prev.initialFromModel || '',
    hasSeenModelSetting: Boolean(prev.hasSeenModelSetting),
    firstUserTitle: prev.firstUserTitle,
    workspace: prev.workspace,
    spawnedChildren: prev.spawnedChildren.slice(),
    seenChildIds: new Set(prev.seenChildIds),
    inferredParentId: prev.inferredParentId,
    inferredRole: prev.inferredRole,
  };
}

function ingestRawStep(raw, mutable) {
  if (!raw || typeof raw !== 'object') return;

  const stepIndex =
    typeof raw.step_index === 'number'
      ? raw.step_index
      : typeof raw.stepIndex === 'number'
        ? raw.stepIndex
        : mutable.baseSteps.length;

  const type = typeof raw.type === 'string' && raw.type ? raw.type : 'UNKNOWN';
  const source = typeof raw.source === 'string' ? raw.source : '';
  const rawStatus = typeof raw.status === 'string' && raw.status ? raw.status : 'DONE';

  let status = 'normal';
  if (type === 'CHECKPOINT') {
    status = 'checkpoint';
  } else if (
    rawStatus.toUpperCase() === 'ERROR' ||
    rawStatus.toUpperCase() === 'FAILED' ||
    type === 'ERROR_MESSAGE' ||
    (typeof raw.error === 'string' && raw.error.trim().length > 0)
  ) {
    status = 'error';
  }

  const isoTime =
    typeof raw.created_at === 'string'
      ? raw.created_at
      : typeof raw.createdAt === 'string'
        ? raw.createdAt
        : '';
  const parsedMs = isoTime ? Date.parse(isoTime) : NaN;
  const createdAtMs = Number.isFinite(parsedMs) ? parsedMs : 0;
  const date = createdAtMs > 0 ? formatLocalDate(createdAtMs) : '';

  const content = typeof raw.content === 'string' ? raw.content : '';
  const errorStr = typeof raw.error === 'string' ? raw.error : '';

  // Update model selection ONLY on genuine `USER_INPUT` / `SYSTEM_MESSAGE` steps
  // (never on `GENERIC` / `TOOL_RESULT` where grepping transcripts could contain `<USER_SETTINGS_CHANGE>`!)
  if (type === 'USER_INPUT' || type === 'SYSTEM_MESSAGE') {
    const transitions = extractModelTransitionsFromContent(content);
    for (const { fromModel, toModel } of transitions) {
      if (!mutable.hasSeenModelSetting && fromModel) {
        mutable.initialFromModel = fromModel;
        for (let prevIdx = 0; prevIdx < mutable.baseSteps.length; prevIdx++) {
          if (!mutable.baseSteps[prevIdx].baseModelName) {
            mutable.baseSteps[prevIdx] = {
              ...mutable.baseSteps[prevIdx],
              baseModelName: fromModel,
            };
          }
        }
      }
      mutable.hasSeenModelSetting = true;
      mutable.settingsModelName = toModel;
    }
  }

  const explicitModel =
    typeof raw.modelName === 'string' && raw.modelName.trim()
      ? canonicalizeModelName(raw.modelName)
      : typeof raw.model === 'string' && raw.model.trim()
        ? canonicalizeModelName(raw.model)
        : '';
  const stepBaseModel = explicitModel || mutable.settingsModelName || '';

  // Metadata hints extraction (zero extra disk reads later!)
  if (!mutable.workspace) {
    const ws = extractWorkspaceFromContent(content);
    if (ws) mutable.workspace = ws;
  }
  if (type === 'USER_INPUT' && !mutable.firstUserTitle) {
    const title = extractCleanUserTitle(content);
    if (title) mutable.firstUserTitle = title;
  }
  if (
    (type === 'SYSTEM_MESSAGE' || type === 'USER_INPUT') &&
    !mutable.inferredParentId &&
    mutable.baseSteps.length <= 2
  ) {
    const parentInfo = extractInferredParentFromSystemMessage(content);
    if (parentInfo) {
      mutable.inferredParentId = parentInfo.parentId;
      mutable.inferredRole = parentInfo.role;
    }
  }

  // Tokens
  const inputTokens = toNonNegInt(
    raw.input_tokens ?? raw.inputTokens ?? raw.usage?.input_tokens ?? 0,
  );
  const cacheReadTokens = toNonNegInt(
    raw.cache_read_tokens ?? raw.cacheReadTokens ?? raw.usage?.cache_read_tokens ?? 0,
  );
  const outputTokens = toNonNegInt(
    raw.output_tokens ?? raw.outputTokens ?? raw.usage?.output_tokens ?? 0,
  );
  const promptContextTokens = inputTokens + cacheReadTokens;
  const totalTokens = promptContextTokens + outputTokens;
  const contextTokens = totalTokens;
  const cacheHitRate = promptContextTokens > 0 ? cacheReadTokens / promptContextTokens : 0;

  // Character count & media count for context_breakdown.mjs
  const charEstimate =
    raw.charEstimate &&
    typeof raw.charEstimate.cjkChars === 'number' &&
    typeof raw.charEstimate.asciiChars === 'number'
      ? {
          cjkChars: toNonNegInt(raw.charEstimate.cjkChars),
          asciiChars: toNonNegInt(raw.charEstimate.asciiChars),
        }
      : countStepChars(content || errorStr);

  const mediaCount = Array.isArray(raw.media)
    ? raw.media.length
    : toNonNegInt(raw.mediaCount ?? 0);

  // Tool calls correlation
  let stepToolCalls = [];
  let isSkillRead = Boolean(raw.isSkillRead);
  let skillPath = typeof raw.skillPath === 'string' ? raw.skillPath : null;
  let toolName = typeof raw.toolName === 'string' ? raw.toolName : null;
  let stepSummary = '';

  const rawToolCalls = raw.tool_calls ?? raw.toolCalls;
  if (type === 'PLANNER_RESPONSE') {
    mutable.pendingToolCalls = [];
    const parsedCalls = parseToolCallsFromStep(rawToolCalls);
    for (const pc of parsedCalls) {
      mutable.pendingToolCalls.push(pc);
      // Also record child ID if directly present in tool_calls args
      extractSpawnedChildrenFromToolResult(
        pc,
        '',
        stepIndex,
        mutable.spawnedChildren,
        mutable.seenChildIds,
      );
    }
    stepToolCalls = parsedCalls.map(({ name, targetPath, summary }) => ({
      name,
      targetPath,
      summary,
    }));
    const skillCall = parsedCalls.find((c) => c.isSkillRead);
    if (skillCall) {
      isSkillRead = true;
      skillPath = skillCall.skillPath;
    }
  } else if (type === 'USER_INPUT' || type === 'CHECKPOINT') {
    mutable.pendingToolCalls = [];
    if (Array.isArray(rawToolCalls) && rawToolCalls.length > 0) {
      const parsedCalls = parseToolCallsFromStep(rawToolCalls);
      stepToolCalls = parsedCalls.map(({ name, targetPath, summary }) => ({
        name,
        targetPath,
        summary,
      }));
    }
  } else if (type === 'GENERIC' || type === 'LIST_DIRECTORY' || type === 'TOOL_RESULT') {
    let matchedCall = null;
    if (Array.isArray(rawToolCalls) && rawToolCalls.length > 0) {
      const parsedCalls = parseToolCallsFromStep(rawToolCalls);
      matchedCall = parsedCalls[0] || null;
    } else if (mutable.pendingToolCalls.length > 0) {
      matchedCall = mutable.pendingToolCalls.shift() || null;
    }

    if (matchedCall) {
      stepToolCalls = [
        {
          name: matchedCall.name,
          targetPath: matchedCall.targetPath,
          summary: matchedCall.summary,
        },
      ];
      toolName = matchedCall.name;
      stepSummary = matchedCall.summary;
      if (matchedCall.isSkillRead) {
        isSkillRead = true;
        skillPath = matchedCall.skillPath;
      }
    } else {
      stepSummary = truncateClean(content || errorStr, 120);
    }

    extractSpawnedChildrenFromToolResult(
      matchedCall,
      content,
      stepIndex,
      mutable.spawnedChildren,
      mutable.seenChildIds,
    );
  }

  const completedAtMs = extractCompletedAtMs(content);

  mutable.baseSteps.push({
    stepIndex,
    type,
    source,
    status,
    rawStatus,
    createdAtMs,
    isoTime,
    date,
    inputTokens,
    cacheReadTokens,
    outputTokens,
    promptContextTokens,
    totalTokens,
    contextTokens,
    cacheHitRate,
    baseModelName: stepBaseModel,
    charEstimate,
    mediaCount,
    toolCalls: stepToolCalls,
    toolName,
    summary: stepSummary,
    isSkillRead,
    skillPath,
    completedAtMs,
  });
}

function computeHookSignature(hookEvents) {
  if (!Array.isArray(hookEvents) || hookEvents.length === 0) return '0';
  const last = hookEvents[hookEvents.length - 1];
  return `${hookEvents.length}:${last?.ts ?? 0}:${last?.event ?? ''}:${last?.modelName ?? ''}`;
}

/**
 * Pairs sorted `PreInvocation` and `Stop` lifecycle hook events into invocation windows.
 */
function buildHookWindows(hookEvents) {
  if (!Array.isArray(hookEvents) || hookEvents.length === 0) {
    return [];
  }
  const sorted = hookEvents
    .filter((e) => e && typeof e === 'object' && Number.isFinite(e.ts) && e.ts > 0)
    .slice()
    .sort((a, b) => a.ts - b.ts);

  const windows = [];
  const openByInvNum = new Map();
  let lastOpenWindow = null;

  for (const ev of sorted) {
    const kind = String(ev.event || '');
    const modelName =
      typeof ev.modelName === 'string' && ev.modelName.trim()
        ? normalizeModelLabel(ev.modelName)
        : '';
    const invNum =
      typeof ev.invocationNum === 'number' && Number.isFinite(ev.invocationNum)
        ? ev.invocationNum
        : null;

    if (kind === 'PreInvocation') {
      const win = {
        preTs: ev.ts,
        stopTs: null,
        invocationNum: invNum,
        modelName,
        usedForStepCount: 0,
      };
      windows.push(win);
      if (invNum !== null) {
        openByInvNum.set(invNum, win);
      }
      lastOpenWindow = win;
    } else if (kind === 'Stop') {
      let target = invNum !== null ? openByInvNum.get(invNum) : null;
      if (!target && lastOpenWindow && lastOpenWindow.stopTs === null && ev.ts >= lastOpenWindow.preTs) {
        target = lastOpenWindow;
      }
      if (target) {
        target.stopTs = ev.ts;
        if (!target.modelName && modelName) {
          target.modelName = modelName;
        }
        if (invNum !== null) openByInvNum.delete(invNum);
        if (lastOpenWindow === target) lastOpenWindow = null;
      } else {
        windows.push({
          preTs: null,
          stopTs: ev.ts,
          invocationNum: invNum,
          modelName,
          usedForStepCount: 0,
        });
      }
    } else if (modelName) {
      windows.push({
        preTs: ev.ts,
        stopTs: null,
        invocationNum: invNum,
        modelName,
        usedForStepCount: 0,
      });
    }
  }

  return windows;
}

/**
 * Computes finalized step timings, trajectory DB ground-truth models, hook overrides,
 * checkpoints, totals, and single-turn durations.
 */
function finalizeTranscriptState(
  transcriptPath,
  fileStat,
  nextOffset,
  bytesRead,
  wasReset,
  mutable,
  hookEvents,
  hookSig,
  trajDbState = null,
  defaultModel = '',
) {
  const baseSteps = mutable.baseSteps;
  const hookWindows = buildHookWindows(hookEvents);
  const trajStepModels = trajDbState?.stepModels || null;

  // Determine whether this conversation has any explicit `USER_INPUT` steps
  const hasUserInput = baseSteps.some((s) => s.type === 'USER_INPUT');

  // Assign each step to a continuous execution turn index (`turnIdx`).
  // A new turn starts at every `USER_INPUT` (or at `SYSTEM_MESSAGE` in subagent/swarm sessions with no `USER_INPUT`).
  const stepTurnIndices = new Array(baseSteps.length).fill(-1);
  let currentTurnIdx = -1;
  for (let i = 0; i < baseSteps.length; i++) {
    const s = baseSteps[i];
    const isTurnStart =
      s.type === 'USER_INPUT' || (!hasUserInput && s.type === 'SYSTEM_MESSAGE') || currentTurnIdx < 0;
    if (isTurnStart && (s.type === 'USER_INPUT' || !hasUserInput || currentTurnIdx < 0)) {
      if (s.type === 'USER_INPUT' || (!hasUserInput && s.type === 'SYSTEM_MESSAGE') || currentTurnIdx < 0) {
        currentTurnIdx += 1;
      }
    }
    stepTurnIndices[i] = currentTurnIdx;
  }

  // Group step indices by turn
  const turns = [];
  for (let i = 0; i < baseSteps.length; i++) {
    const tIdx = stepTurnIndices[i];
    while (turns.length <= tIdx) {
      turns.push({ stepIndices: [], plannerIndices: [], matchedHookWin: null });
    }
    turns[tIdx].stepIndices.push(i);
    if (baseSteps[i].type === 'PLANNER_RESPONSE') {
      turns[tIdx].plannerIndices.push(i);
    }
  }

  // Match hook windows to individual steps or turns
  // Note: transcript `created_at` has 1-second resolution (`.000Z`), so `preTs` can be up to ~999ms > truncated second!
  const stepHookWindow = new Array(baseSteps.length).fill(null);
  const claimedWindows = new Set();

  // Pass 1: Match fine-grained per-step hook windows (when multiple PreInvocation/Stop pairs exist or exact overlap)
  for (let i = 0; i < baseSteps.length; i++) {
    const s = baseSteps[i];
    if (s.type !== 'PLANNER_RESPONSE') continue;
    for (const win of hookWindows) {
      if (claimedWindows.has(win)) continue;
      if (win.preTs !== null && win.stopTs !== null) {
        // Step created_at (either step start or step completion) lies within [preTs - 1500ms, stopTs + 1500ms]
        if (s.createdAtMs >= win.preTs - 1500 && s.createdAtMs <= win.stopTs + 1500) {
          stepHookWindow[i] = win;
          break;
        }
      } else if (win.preTs !== null && win.stopTs === null) {
        if (s.createdAtMs >= win.preTs - 1500 && s.createdAtMs <= win.preTs + 300_000) {
          stepHookWindow[i] = win;
          break;
        }
      }
    }
  }

  // Also map turn-level hook window for turns where multiple planner steps share one PreInvocation..Stop
  for (let tIdx = 0; tIdx < turns.length; tIdx++) {
    const turn = turns[tIdx];
    if (turn.stepIndices.length === 0) continue;
    const firstStep = baseSteps[turn.stepIndices[0]];
    const lastStep = baseSteps[turn.stepIndices[turn.stepIndices.length - 1]];
    const tStart = firstStep.createdAtMs;
    const tEnd = Math.max(lastStep.createdAtMs, lastStep.completedAtMs || 0);

    for (const win of hookWindows) {
      const anchor = win.preTs ?? win.stopTs ?? 0;
      if (tStart > 0 && anchor >= tStart - 5000 && anchor <= Math.max(tEnd, tStart) + 15_000) {
        turn.matchedHookWin = win;
        break;
      }
    }
    // Fallback match by 1-based or 0-based `invocationNum` when timestamps match loosely or synthetic
    if (!turn.matchedHookWin) {
      for (const win of hookWindows) {
        if (
          win.invocationNum !== null &&
          (win.invocationNum === tIdx + 1 || (win.invocationNum === tIdx && hookWindows[0]?.invocationNum === 0))
        ) {
          turn.matchedHookWin = win;
          break;
        }
      }
    }
  }

  // Track active non-Auto hook model progression chronologically
  let latestHookModel = '';
  let hookCursor = 0;
  const sortedModelHooks = hookEvents
    .map((e) => ({
      ts: e?.ts || 0,
      modelName:
        e && typeof e.modelName === 'string' ? canonicalizeModelName(e.modelName) : '',
    }))
    .filter((e) => e.modelName)
    .sort((a, b) => a.ts - b.ts);

  const finalizedSteps = new Array(baseSteps.length);
  const checkpointItems = [];
  let pendingCheckpointRef = null;
  let lastTokenBearingContextTokens = 0;

  let sumInputTokens = 0;
  let sumCacheReadTokens = 0;
  let sumOutputTokens = 0;
  let sumPromptContextTokens = 0;
  let sumTotalTokens = 0;
  let requestCount = 0;
  let sumModelDurationMs = 0;
  let sumModelOutputTokens = 0;
  let modelStepCount = 0;
  let lastStepDurationMs = 0;
  let activeCycleContextTokens = 0;
  let activeTrajModel = '';

  for (let i = 0; i < baseSteps.length; i++) {
    const b = baseSteps[i];
    const tIdx = stepTurnIndices[i];
    const turn = turns[tIdx];

    while (
      hookCursor < sortedModelHooks.length &&
      sortedModelHooks[hookCursor].ts <= b.createdAtMs + 1500
    ) {
      latestHookModel = sortedModelHooks[hookCursor].modelName;
      hookCursor += 1;
    }

    const directTrajModel = trajStepModels ? trajStepModels.get(b.stepIndex) || '' : '';
    if (directTrajModel) {
      activeTrajModel = directTrajModel;
    }

    const matchedWin = stepHookWindow[i] || turn?.matchedHookWin || null;
    const hookModel = matchedWin?.modelName || latestHookModel || '';
    const modelName = directTrajModel || activeTrajModel || hookModel || b.baseModelName || '';

    // Compute durationMs & tokensPerSec for PLANNER_RESPONSE / CHECKPOINT
    let durationMs = 0;
    const isModelStep = b.type === 'PLANNER_RESPONSE' || b.type === 'CHECKPOINT';

    if (isModelStep) {
      const plannersInTurn = turn ? turn.plannerIndices : [];
      const countSharingWin =
        matchedWin
          ? plannersInTurn.filter(
              (pIdx) => (stepHookWindow[pIdx] || turn?.matchedHookWin) === matchedWin,
            ).length
          : 0;

      // 1. Hook-based millisecond timing
      if (b.type === 'PLANNER_RESPONSE' && matchedWin) {
        if (
          matchedWin.preTs !== null &&
          matchedWin.stopTs !== null &&
          matchedWin.stopTs > matchedWin.preTs &&
          countSharingWin <= 1
        ) {
          durationMs = Math.max(1, matchedWin.stopTs - matchedWin.preTs);
        } else if (
          matchedWin.preTs !== null &&
          matchedWin.stopTs === null &&
          countSharingWin <= 1 &&
          b.createdAtMs > matchedWin.preTs
        ) {
          durationMs = Math.max(1, b.createdAtMs - matchedWin.preTs);
        } else if (
          countSharingWin > 1 &&
          plannersInTurn[plannersInTurn.length - 1] === i &&
          matchedWin.stopTs !== null &&
          b.createdAtMs > 0 &&
          matchedWin.stopTs > b.createdAtMs
        ) {
          // Final planner step in a multi-step turn where created_at is step start
          durationMs = Math.max(1, matchedWin.stopTs - b.createdAtMs);
        }
      }

      // 2. Fallback to transcript step timestamps (strictly within the same turn!)
      if (durationMs <= 0) {
        const prevStep = i > 0 && stepTurnIndices[i - 1] === tIdx ? baseSteps[i - 1] : null;
        const nextStep =
          i + 1 < baseSteps.length && stepTurnIndices[i + 1] === tIdx ? baseSteps[i + 1] : null;

        const prevAnchorMs = prevStep
          ? Math.max(prevStep.createdAtMs, prevStep.completedAtMs || 0)
          : 0;
        const deltaFromPrev =
          b.createdAtMs > 0 && prevAnchorMs > 0 ? b.createdAtMs - prevAnchorMs : 0;
        const deltaToNext =
          nextStep && nextStep.createdAtMs > 0 && b.createdAtMs > 0
            ? nextStep.createdAtMs - b.createdAtMs
            : 0;

        if (deltaFromPrev > 1000) {
          // Completion-timestamp style (or gap after previous step in same turn)
          durationMs = deltaFromPrev;
        } else if (deltaToNext > 1000) {
          // Real AGY start-timestamp style: planner step created at T_start, tool invoked at T_end
          durationMs = deltaToNext;
        } else if (deltaFromPrev > 0) {
          durationMs = Math.max(1000, deltaFromPrev);
        } else if (deltaToNext > 0) {
          durationMs = Math.max(1000, deltaToNext);
        } else {
          // Minimum 1000ms floor on second-granularity fallback to prevent divide-by-zero
          durationMs = 1000;
        }
      }
    } else if (b.completedAtMs && b.createdAtMs > 0 && b.completedAtMs >= b.createdAtMs) {
      durationMs = b.completedAtMs - b.createdAtMs;
    }

    const tokensPerSec =
      durationMs > 0 && b.outputTokens > 0
        ? Number((b.outputTokens / (durationMs / 1000)).toFixed(2))
        : 0;

    const stepObj = {
      stepIndex: b.stepIndex,
      type: b.type,
      source: b.source,
      status: b.status,
      createdAtMs: b.createdAtMs,
      isoTime: b.isoTime,
      date: b.date,
      inputTokens: b.inputTokens,
      cacheReadTokens: b.cacheReadTokens,
      outputTokens: b.outputTokens,
      promptContextTokens: b.promptContextTokens,
      totalTokens: b.totalTokens,
      contextTokens: b.contextTokens,
      cacheHitRate: b.cacheHitRate,
      durationMs,
      tokensPerSec,
      modelName,
      charEstimate: b.charEstimate,
      mediaCount: b.mediaCount,
      toolCalls: b.toolCalls,
      ...(b.toolName ? { toolName: b.toolName } : {}),
      ...(b.summary ? { summary: b.summary } : {}),
      isSkillRead: b.isSkillRead,
      skillPath: b.skillPath,
    };

    if (b.type === 'CHECKPOINT') {
      const beforeTokens =
        lastTokenBearingContextTokens > 0
          ? lastTokenBearingContextTokens
          : b.promptContextTokens;
      stepObj.beforeTokens = beforeTokens;
      stepObj.preCheckpointContextTokens = beforeTokens;
      stepObj.afterTokens = null;
      stepObj.deltaTokens = null;

      const cpItem = {
        stepIndex: b.stepIndex,
        createdAt: b.isoTime,
        createdAtMs: b.createdAtMs,
        beforeTokens,
        afterTokens: null,
        deltaTokens: null,
        inputTokens: b.inputTokens,
        cacheReadTokens: b.cacheReadTokens,
        outputTokens: b.outputTokens,
        totalTokens: b.totalTokens,
      };
      checkpointItems.push(cpItem);
      pendingCheckpointRef = { stepObj, cpItem };
      // Compaction resets active window until post-checkpoint PLANNER_RESPONSE runs
      activeCycleContextTokens = 0;
    } else if (b.type === 'PLANNER_RESPONSE') {
      if (pendingCheckpointRef) {
        pendingCheckpointRef.stepObj.afterTokens = b.contextTokens;
        pendingCheckpointRef.stepObj.deltaTokens =
          b.contextTokens - pendingCheckpointRef.stepObj.beforeTokens;
        pendingCheckpointRef.cpItem.afterTokens = b.contextTokens;
        pendingCheckpointRef.cpItem.deltaTokens =
          b.contextTokens - pendingCheckpointRef.cpItem.beforeTokens;
        pendingCheckpointRef = null;
      }
      activeCycleContextTokens = b.contextTokens;
    }

    if (b.totalTokens > 0 || b.type === 'PLANNER_RESPONSE' || b.type === 'CHECKPOINT') {
      if (b.contextTokens > 0) {
        lastTokenBearingContextTokens = b.contextTokens;
      }
      sumInputTokens += b.inputTokens;
      sumCacheReadTokens += b.cacheReadTokens;
      sumOutputTokens += b.outputTokens;
      sumPromptContextTokens += b.promptContextTokens;
      sumTotalTokens += b.totalTokens;
      if (b.type === 'PLANNER_RESPONSE' || b.type === 'CHECKPOINT') {
        requestCount += 1;
      }
    }

    if (b.type === 'PLANNER_RESPONSE') {
      sumModelDurationMs += durationMs;
      sumModelOutputTokens += b.outputTokens;
      modelStepCount += 1;
      lastStepDurationMs = durationMs;
    }

    finalizedSteps[i] = stepObj;
  }

  // Back-propagate earliest known real model onto pre-hook / pre-gen_metadata steps,
  // and forward-fill across intermediate steps (e.g. CHECKPOINT / ERROR) within the conversation.
  let firstKnownRealModel = '';
  for (let i = 0; i < finalizedSteps.length; i++) {
    if (finalizedSteps[i].modelName) {
      firstKnownRealModel = finalizedSteps[i].modelName;
      break;
    }
  }
  const hasIntrinsicModel = Boolean(
    firstKnownRealModel ||
      trajDbState?.firstModel ||
      mutable.initialFromModel ||
      mutable.settingsModelName ||
      sortedModelHooks.length > 0,
  );
  if (!firstKnownRealModel) {
    firstKnownRealModel =
      trajDbState?.firstModel ||
      mutable.initialFromModel ||
      mutable.settingsModelName ||
      (sortedModelHooks.length > 0 ? sortedModelHooks[0].modelName : '') ||
      defaultModel ||
      '';
  }

  let runningModel = firstKnownRealModel;
  for (let i = 0; i < finalizedSteps.length; i++) {
    if (finalizedSteps[i].modelName) {
      runningModel = finalizedSteps[i].modelName;
    } else if (runningModel) {
      finalizedSteps[i].modelName = runningModel;
    }
  }

  let latestResolvedModel = runningModel || defaultModel || '';
  if (trajDbState?.latestModel) {
    latestResolvedModel = trajDbState.latestModel;
  } else if (sortedModelHooks.length > 0) {
    const lastHook = sortedModelHooks[sortedModelHooks.length - 1];
    if (lastHook.modelName) {
      latestResolvedModel = lastHook.modelName;
    }
  }

  // Compute single-turn continuous task durations (`turnDurationsMs` / `maxTurnDurationMs`)
  // Strictly measures each turn from its starting `USER_INPUT` to the final step BEFORE the next `USER_INPUT`,
  // completely excluding idle human gaps (e.g. 48h overnight idle between user prompts!).
  const turnDurationsMs = [];
  for (const turn of turns) {
    if (turn.stepIndices.length === 0) continue;
    let turnStartMs = 0;
    let turnEndMs = 0;

    for (const idx of turn.stepIndices) {
      const rawStep = baseSteps[idx];
      const ts = rawStep.createdAtMs;
      const completedTs = rawStep.completedAtMs || 0;
      if (ts > 0) {
        if (turnStartMs === 0 || ts < turnStartMs) {
          turnStartMs = ts;
        }
        if (ts > turnEndMs) {
          turnEndMs = ts;
        }
      }
      if (completedTs > turnEndMs) {
        turnEndMs = completedTs;
      }
    }

    // Refine with exact hook window timestamps when matched to this turn
    const win = turn.matchedHookWin;
    if (win) {
      if (
        win.preTs !== null &&
        (turnStartMs === 0 || (win.preTs <= turnStartMs + 1000 && win.preTs >= turnStartMs - 5000))
      ) {
        turnStartMs = Math.min(turnStartMs || win.preTs, win.preTs);
      }
      if (win.stopTs !== null && win.stopTs > turnEndMs && win.stopTs <= turnEndMs + 300_000) {
        turnEndMs = win.stopTs;
      }
    }

    // Only count turns that actually performed execution beyond a bare prompt (or have >0 elapsed duration)
    const hasExecution = turn.stepIndices.some((idx) => baseSteps[idx].type !== 'USER_INPUT');
    if (hasExecution && turnStartMs > 0 && turnEndMs >= turnStartMs) {
      turnDurationsMs.push(turnEndMs - turnStartMs);
    }
  }

  const maxTurnDurationMs =
    turnDurationsMs.length > 0 ? Math.max(...turnDurationsMs) : 0;

  const overallCacheHitRate =
    sumPromptContextTokens > 0 ? sumCacheReadTokens / sumPromptContextTokens : 0;
  const avgTokensPerSec =
    sumModelDurationMs > 0 && sumModelOutputTokens > 0
      ? Number((sumModelOutputTokens / (sumModelDurationMs / 1000)).toFixed(2))
      : 0;
  const avgStepDurationMs =
    modelStepCount > 0 ? Math.round(sumModelDurationMs / modelStepCount) : 0;

  const totals = {
    inputTokens: sumInputTokens,
    cacheReadTokens: sumCacheReadTokens,
    outputTokens: sumOutputTokens,
    promptContextTokens: sumPromptContextTokens,
    totalTokens: sumTotalTokens,
    cacheHitRate: overallCacheHitRate,
    requestCount,
    avgTokensPerSec,
    avgStepDurationMs,
    lastStepDurationMs,
  };

  return {
    transcriptPath,
    mtimeMs: fileStat ? fileStat.mtimeMs : 0,
    size: fileStat ? fileStat.size : 0,
    nextOffset,
    bytesRead,
    wasReset,
    steps: finalizedSteps,
    modelName: latestResolvedModel,
    contextLimit: trajDbState?.contextLimit || null,
    totals,
    selfTotalTokens: sumTotalTokens,
    selfContextTokens: activeCycleContextTokens,
    latestContextTokens: lastTokenBearingContextTokens,
    checkpoints: {
      count: checkpointItems.length,
      latest: checkpointItems.length > 0 ? checkpointItems[checkpointItems.length - 1] : null,
      items: checkpointItems,
    },
    turnDurationsMs,
    maxTurnDurationMs,
    metadataHints: {
      firstUserTitle: mutable.firstUserTitle,
      workspace: mutable.workspace,
      spawnedChildren: mutable.spawnedChildren.slice(),
      inferredParentId: mutable.inferredParentId,
      inferredRole: mutable.inferredRole,
    },
    _mutable: mutable,
    _hookSig: hookSig,
    _trajDbState: trajDbState,
    _trajSig: trajDbState ? trajDbState.sig : 'none',
    _defaultModel: defaultModel,
    _hasIntrinsicModel: hasIntrinsicModel,
  };
}

/**
 * Incrementally parses a `transcript.jsonl` file using `{ mtimeMs, size, nextOffset }`
 * and fuses per-step models from sibling `conversations/<convId>.db` (`gen_metadata`) when present.
 *
 * - Unchanged files (`mtimeMs` and `size` match `prevState`): 0 disk bytes read & 0 SQLite openings!
 * - Appended files (`size > prevState.nextOffset`): `fs.openSync` + reads ONLY `[nextOffset, size)`.
 * - Truncated files (`size < prevState.nextOffset`): cleanly resets and reparses from byte 0.
 *
 * @param {string} transcriptPath
 * @param {object | null} [prevState=null]
 * @param {Array<object>} [hookEvents=[]]
 * @param {{ mtimeMs: number, size: number } | null} [preStat=null]
 * @param {{
 *   trajectoryDbPath?: string | null,
 *   trajectoryDbMtimeMs?: number,
 *   trajectoryDbSize?: number,
 *   defaultModelRaw?: string,
 *   applyDefaultModel?: boolean,
 *   disableTrajectoryDb?: boolean
 * }} [options={}]
 * @returns {object}
 */
export function parseTranscriptIncremental(
  transcriptPath,
  prevState = null,
  hookEvents = [],
  preStat = null,
  options = {},
) {
  const safeHooks = Array.isArray(hookEvents) ? hookEvents : [];
  const hookSig = computeHookSignature(safeHooks);
  const opts = options && typeof options === 'object' ? options : {};
  const defaultModel =
    opts.applyDefaultModel === false ? '' : canonicalizeModelName(opts.defaultModelRaw || '');

  // Resolve trajectory DB (`conversations/<convId>.db`) stat-cached
  let trajDbPath = null;
  if (!opts.disableTrajectoryDb) {
    if (opts.trajectoryDbPath !== undefined) {
      trajDbPath = opts.trajectoryDbPath || null;
    } else if (prevState?._trajDbState?.dbPath) {
      trajDbPath = prevState._trajDbState.dbPath;
    } else {
      trajDbPath = inferTrajectoryDbPathFromTranscript(transcriptPath);
    }
  }
  const preDbStat =
    trajDbPath &&
    typeof opts.trajectoryDbMtimeMs === 'number' &&
    typeof opts.trajectoryDbSize === 'number'
      ? { mtimeMs: opts.trajectoryDbMtimeMs, size: opts.trajectoryDbSize }
      : null;
  const trajDbState = trajDbPath
    ? readTrajectoryDbModels(trajDbPath, prevState?._trajDbState || null, preDbStat)
    : null;
  const trajSig = trajDbState ? trajDbState.sig : 'none';

  let stat = null;
  if (
    preStat &&
    typeof preStat.mtimeMs === 'number' &&
    Number.isFinite(preStat.mtimeMs) &&
    typeof preStat.size === 'number' &&
    Number.isFinite(preStat.size)
  ) {
    stat = preStat;
  } else {
    try {
      stat = fs.statSync(transcriptPath);
    } catch {
      const emptyMutable = createFreshMutableParserState();
      return finalizeTranscriptState(
        transcriptPath,
        null,
        0,
        0,
        false,
        emptyMutable,
        safeHooks,
        hookSig,
        trajDbState,
        defaultModel,
      );
    }
  }

  // Fast-path: file size & mtime unchanged and fully caught up
  if (
    prevState &&
    prevState._mutable &&
    prevState.size === stat.size &&
    prevState.mtimeMs === stat.mtimeMs &&
    prevState.nextOffset === stat.size
  ) {
    if (
      prevState._hookSig === hookSig &&
      prevState._trajSig === trajSig &&
      prevState._defaultModel === defaultModel
    ) {
      if (prevState.bytesRead === 0 && prevState.wasReset === false) {
        return prevState;
      }
      return {
        ...prevState,
        bytesRead: 0,
        wasReset: false,
      };
    }

    // Only hookEvents or trajectory DB changed -> 0 transcript bytes read, re-fuse onto cached baseSteps!
    return finalizeTranscriptState(
      transcriptPath,
      stat,
      prevState.nextOffset,
      0,
      false,
      prevState._mutable,
      safeHooks,
      hookSig,
      trajDbState,
      defaultModel,
    );
  }

  // Check truncation (`stat.size < prevState.nextOffset`) or cold start
  const isTruncated = Boolean(
    prevState && typeof prevState.nextOffset === 'number' && stat.size < prevState.nextOffset,
  );
  const canAppend = Boolean(
    prevState &&
      prevState._mutable &&
      !isTruncated &&
      typeof prevState.nextOffset === 'number' &&
      prevState.nextOffset >= 0,
  );

  const mutable = canAppend
    ? cloneMutableParserState(prevState._mutable)
    : createFreshMutableParserState();
  const startOffset = canAppend ? prevState.nextOffset : 0;
  const bytesToRead = Math.max(0, stat.size - startOffset);

  if (bytesToRead === 0) {
    return finalizeTranscriptState(
      transcriptPath,
      stat,
      startOffset,
      0,
      isTruncated,
      mutable,
      safeHooks,
      hookSig,
      trajDbState,
      defaultModel,
    );
  }

  // Read ONLY bytes [startOffset, stat.size) via file descriptor positional read
  const buffer = Buffer.allocUnsafe(bytesToRead);
  let totalRead = 0;
  const fd = fs.openSync(transcriptPath, 'r');
  try {
    while (totalRead < bytesToRead) {
      const n = fs.readSync(
        fd,
        buffer,
        totalRead,
        bytesToRead - totalRead,
        startOffset + totalRead,
      );
      if (n <= 0) break;
      totalRead += n;
    }
  } finally {
    fs.closeSync(fd);
  }

  // Parse complete JSONL lines on raw UTF-8 byte boundaries so CJK multi-byte offsets never drift!
  let lineStart = 0;
  let consumedBytes = 0;

  for (let idx = 0; idx < totalRead; idx++) {
    if (buffer[idx] === 0x0a) {
      const lineStr = buffer.subarray(lineStart, idx).toString('utf8').trim();
      if (lineStr) {
        try {
          const parsedObj = JSON.parse(lineStr);
          ingestRawStep(parsedObj, mutable);
        } catch {
          // Malformed complete JSONL line -> skip safely without stalling offset
        }
      }
      lineStart = idx + 1;
      consumedBytes = lineStart;
    }
  }

  // Trailing fragment without newline: consume if complete valid JSON, otherwise hold offset for next flush
  if (lineStart < totalRead) {
    const trailingStr = buffer.subarray(lineStart, totalRead).toString('utf8').trim();
    if (!trailingStr) {
      consumedBytes = totalRead;
    } else {
      try {
        const parsedTrailing = JSON.parse(trailingStr);
        ingestRawStep(parsedTrailing, mutable);
        consumedBytes = totalRead;
      } catch {
        // Incomplete mid-write JSON line -> leave `consumedBytes = lineStart` to re-read once finished!
      }
    }
  }

  const nextOffset = startOffset + consumedBytes;

  return finalizeTranscriptState(
    transcriptPath,
    stat,
    nextOffset,
    totalRead,
    isTruncated,
    mutable,
    safeHooks,
    hookSig,
    trajDbState,
    defaultModel,
  );
}

function stampInheritedMetadata(baseParsed, inheritedModel, inheritedLimit) {
  const needsStepStamp = Boolean(inheritedModel) && baseParsed.steps.some((s) => !s.modelName);
  const nextModel = baseParsed.modelName || inheritedModel || '';
  const nextLimit = baseParsed.contextLimit || inheritedLimit || null;
  if (
    nextModel === baseParsed.modelName &&
    nextLimit === baseParsed.contextLimit &&
    !needsStepStamp
  ) {
    return baseParsed;
  }
  const steps = needsStepStamp
    ? baseParsed.steps.map((s) => (s.modelName ? s : { ...s, modelName: inheritedModel }))
    : baseParsed.steps;
  return {
    ...baseParsed,
    modelName: nextModel,
    contextLimit: nextLimit,
    steps,
    _isInheritedModel: Boolean(
      (!baseParsed.modelName && inheritedModel) || needsStepStamp || !baseParsed.contextLimit && inheritedLimit,
    ),
    _baseUninherited: baseParsed._baseUninherited || baseParsed,
  };
}

/**
 * Stateful in-memory incremental cache over multiple conversation transcripts.
 */
export class TranscriptIndex {
  constructor() {
    /** @type {Map<string, object>} */
    this.byPath = new Map();
    /** @type {Map<string, string>} */
    this.pathByConvId = new Map();
  }

  get size() {
    return this.byPath.size;
  }

  /**
   * Incrementally parses `transcriptPath` using cached state when available.
   * @param {string} transcriptPath
   * @param {Array<object>} [hookEvents=[]]
   * @param {{
   *   conversationId?: string,
   *   mtimeMs?: number,
   *   size?: number,
   *   trajectoryDbPath?: string | null,
   *   trajectoryDbMtimeMs?: number,
   *   trajectoryDbSize?: number,
   *   defaultModelRaw?: string,
   *   applyDefaultModel?: boolean,
   *   disableTrajectoryDb?: boolean
   * }} [meta={}]
   * @returns {object}
   */
  parse(transcriptPath, hookEvents = [], meta = {}) {
    const cached = this.byPath.get(transcriptPath) || null;
    const prev = cached?._baseUninherited || cached;
    const preStat =
      meta && typeof meta.mtimeMs === 'number' && typeof meta.size === 'number'
        ? { mtimeMs: meta.mtimeMs, size: meta.size }
        : null;
    const next = parseTranscriptIncremental(transcriptPath, prev, hookEvents, preStat, {
      trajectoryDbPath: meta?.trajectoryDbPath,
      trajectoryDbMtimeMs: meta?.trajectoryDbMtimeMs,
      trajectoryDbSize: meta?.trajectoryDbSize,
      defaultModelRaw: meta?.defaultModelRaw,
      applyDefaultModel: meta?.applyDefaultModel,
      disableTrajectoryDb: meta?.disableTrajectoryDb,
    });

    // Preserve previously stamped inherited model on fast-path hit until `syncConversations` verifies it
    if (next === prev && cached && cached._isInheritedModel) {
      if (meta && typeof meta.conversationId === 'string' && meta.conversationId) {
        this.pathByConvId.set(meta.conversationId, transcriptPath);
      }
      return cached;
    }

    this.byPath.set(transcriptPath, next);
    if (meta && typeof meta.conversationId === 'string' && meta.conversationId) {
      this.pathByConvId.set(meta.conversationId, transcriptPath);
    }
    return next;
  }

  /**
   * Alias of `parse(...)` for ergonomic usage.
   */
  update(transcriptPath, hookEvents = [], meta = {}) {
    return this.parse(transcriptPath, hookEvents, meta);
  }

  get(transcriptPath) {
    return this.byPath.get(transcriptPath) || null;
  }

  getByConversationId(conversationId) {
    const p = this.pathByConvId.get(conversationId);
    if (!p) return null;
    return this.byPath.get(p) || null;
  }

  delete(transcriptPath) {
    for (const [cid, p] of this.pathByConvId.entries()) {
      if (p === transcriptPath) this.pathByConvId.delete(cid);
    }
    return this.byPath.delete(transcriptPath);
  }

  clear() {
    this.byPath.clear();
    this.pathByConvId.clear();
  }

  /**
   * Batch-updates a list of discovered conversations and resolves cross-conversation
   * model inheritance (parent -> subagent/swarm -> installation `antigravity_state.pbtxt` -> peer)
   * so no conversation or step is ever left with an unresolved / `'Auto'` model.
   *
   * @param {Array<{ conversationId: string, transcriptPath: string }>} conversations
   * @param {(conv: object) => Array<object>} [getHookEvents]
   * @returns {Map<string, object>}
   */
  syncConversations(conversations, getHookEvents) {
    const activePaths = new Set();
    const resultByConvId = new Map();
    const convById = new Map();
    let needsCrossConvResolution = false;

    if (Array.isArray(conversations)) {
      for (const conv of conversations) {
        if (!conv || !conv.conversationId || !conv.transcriptPath) continue;
        activePaths.add(conv.transcriptPath);
        convById.set(conv.conversationId, conv);
        const hooks = typeof getHookEvents === 'function' ? getHookEvents(conv) || [] : [];
        const parsed = this.parse(conv.transcriptPath, hooks, {
          conversationId: conv.conversationId,
          mtimeMs: conv.mtimeMs,
          size: conv.size,
          trajectoryDbPath: conv.trajectoryDbPath,
          trajectoryDbMtimeMs: conv.trajectoryDbMtimeMs,
          trajectoryDbSize: conv.trajectoryDbSize,
          defaultModelRaw: conv.defaultModelRaw,
          applyDefaultModel: false,
        });
        resultByConvId.set(conv.conversationId, parsed);
        if (!parsed.modelName || !parsed.contextLimit || parsed._isInheritedModel) {
          needsCrossConvResolution = true;
        }
      }
    }

    // Prune stale paths no longer in discovered conversations
    for (const cachedPath of Array.from(this.byPath.keys())) {
      if (!activePaths.has(cachedPath)) {
        this.delete(cachedPath);
      }
    }

    if (!needsCrossConvResolution || resultByConvId.size === 0) {
      return resultByConvId;
    }

    // Build parent links & explicit child spawn models from transcript hints
    const parentOf = new Map();
    const spawnStepOf = new Map();
    const explicitChildModel = new Map();

    for (const [cid, parsed] of resultByConvId.entries()) {
      const conv = convById.get(cid);
      if (conv?.parentConversationId && conv.parentConversationId !== cid) {
        parentOf.set(cid, conv.parentConversationId);
      }
      const hints = parsed?.metadataHints;
      if (Array.isArray(hints?.spawnedChildren)) {
        for (const child of hints.spawnedChildren) {
          const childId = child?.conversationId;
          if (!childId || childId === cid) continue;
          if (!parentOf.has(childId)) {
            parentOf.set(childId, cid);
          }
          if (typeof child.stepIndex === 'number' && !spawnStepOf.has(childId)) {
            spawnStepOf.set(childId, child.stepIndex);
          }
          if (child.model && !explicitChildModel.has(childId)) {
            const cm = canonicalizeModelName(child.model);
            if (cm) explicitChildModel.set(childId, cm);
          }
        }
      }
    }

    for (const [cid, parsed] of resultByConvId.entries()) {
      const infParent = parsed?.metadataHints?.inferredParentId;
      if (!parentOf.has(cid) && infParent && infParent !== cid) {
        parentOf.set(cid, infParent);
      }
    }

    // Index peer intrinsic models & context limits by geminiDir, side, and global fallback
    const modelByGeminiDir = new Map();
    const modelBySide = new Map();
    const limitByGeminiDir = new Map();
    let anyIntrinsicModel = '';

    if (Array.isArray(conversations)) {
      for (const conv of conversations) {
        if (!conv?.conversationId) continue;
        const p = resultByConvId.get(conv.conversationId);
        const base = p?._baseUninherited || p;
        const lim = base?.contextLimit || conv.defaultContextLimit || null;
        if (lim && conv.geminiDir && !limitByGeminiDir.has(conv.geminiDir)) {
          limitByGeminiDir.set(conv.geminiDir, { limit: lim, mtimeMs: conv.mtimeMs || 0 });
        }
        const m = base?.modelName || canonicalizeModelName(conv.defaultModelRaw || '');
        if (!m) continue;
        if (!anyIntrinsicModel) anyIntrinsicModel = m;
        if (conv.geminiDir && !modelByGeminiDir.has(conv.geminiDir)) {
          modelByGeminiDir.set(conv.geminiDir, m);
        }
        if (conv.side && !modelBySide.has(conv.side)) {
          modelBySide.set(conv.side, m);
        }
      }
    }

    const lookupInheritedContextLimit = (targetCid) => {
      let cursor = targetCid;
      const visited = new Set([targetCid]);
      while (parentOf.has(cursor)) {
        const pid = parentOf.get(cursor);
        if (!pid || visited.has(pid)) break;
        visited.add(pid);
        const pParsed = resultByConvId.get(pid);
        const pBase = pParsed?._baseUninherited || pParsed;
        if (pBase?.contextLimit) return pBase.contextLimit;
        const pConv = convById.get(pid);
        if (pConv?.defaultContextLimit) return pConv.defaultContextLimit;
        cursor = pid;
      }
      const conv = convById.get(targetCid);
      if (conv?.defaultContextLimit) return conv.defaultContextLimit;
      if (conv?.geminiDir && limitByGeminiDir.has(conv.geminiDir)) {
        const peer = limitByGeminiDir.get(conv.geminiDir);
        if ((conv.mtimeMs || 0) >= peer.mtimeMs - 60_000) {
          return peer.limit;
        }
      }
      return null;
    };

    const lookupIntrinsicOrSpawnModel = (targetCid) => {
      // 1. Explicit child model passed in parent's `swarm` / `invoke_subagent`
      if (explicitChildModel.has(targetCid)) {
        return explicitChildModel.get(targetCid);
      }

      // 2. Walk ancestor chain (`parent -> grandparent`) and read model at spawn step
      let cursor = targetCid;
      const visited = new Set([targetCid]);
      while (parentOf.has(cursor)) {
        const pid = parentOf.get(cursor);
        if (!pid || visited.has(pid)) break;
        visited.add(pid);

        if (explicitChildModel.has(pid)) {
          return explicitChildModel.get(pid);
        }

        const pParsed = resultByConvId.get(pid);
        const pBase = pParsed?._baseUninherited || pParsed;
        if (pBase) {
          const spawnStepIdx = spawnStepOf.get(cursor);
          if (typeof spawnStepIdx === 'number' && Array.isArray(pBase.steps)) {
            const exactStep = pBase.steps.find((s) => s.stepIndex === spawnStepIdx);
            if (exactStep?.modelName) return exactStep.modelName;
          }
          if (pBase.modelName) return pBase.modelName;
        }
        cursor = pid;
      }

      // 3. Installation `antigravity_state.pbtxt` (`last_selected_agent_model`)
      const conv = convById.get(targetCid);
      if (conv?.defaultModelRaw) {
        const dm = canonicalizeModelName(conv.defaultModelRaw);
        if (dm) return dm;
      }
      if (visited.size > 1) {
        for (const ancId of visited) {
          const ancConv = convById.get(ancId);
          if (ancConv?.defaultModelRaw) {
            const dm = canonicalizeModelName(ancConv.defaultModelRaw);
            if (dm) return dm;
          }
        }
      }

      // 4. Same installation (`geminiDir`) -> same OS side (`WSL`/`Win`) -> batch peer
      if (conv?.geminiDir && modelByGeminiDir.has(conv.geminiDir)) {
        return modelByGeminiDir.get(conv.geminiDir);
      }
      if (conv?.side && modelBySide.has(conv.side)) {
        return modelBySide.get(conv.side);
      }
      return anyIntrinsicModel;
    };

    for (const [cid, currentParsed] of resultByConvId.entries()) {
      const baseParsed = currentParsed._baseUninherited || currentParsed;
      const needsModel = !baseParsed.modelName || baseParsed.steps.some((s) => !s.modelName);
      const needsLimit = !baseParsed.contextLimit;
      if (!needsModel && !needsLimit) {
        continue;
      }
      const inheritedModel = needsModel ? lookupIntrinsicOrSpawnModel(cid) : '';
      const inheritedLimit = needsLimit ? lookupInheritedContextLimit(cid) : null;
      if (!inheritedModel && !inheritedLimit) continue;
      if (
        currentParsed._isInheritedModel &&
        currentParsed.modelName === (baseParsed.modelName || inheritedModel) &&
        currentParsed.contextLimit === (baseParsed.contextLimit || inheritedLimit) &&
        !currentParsed.steps.some((s) => !s.modelName)
      ) {
        continue;
      }
      const stamped = stampInheritedMetadata(baseParsed, inheritedModel, inheritedLimit);
      resultByConvId.set(cid, stamped);
      const conv = convById.get(cid);
      if (conv?.transcriptPath) {
        this.byPath.set(conv.transcriptPath, stamped);
      }
    }

    return resultByConvId;
  }
}
