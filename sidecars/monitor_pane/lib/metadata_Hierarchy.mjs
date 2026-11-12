import fs from 'node:fs';
import path from 'node:path';
import {
  canonicalizeModelName,
  extractCleanUserTitle,
  extractWorkspaceFromContent,
  parseTranscriptIncremental,
} from './transcript_parser.mjs';

const DESIRED_SUMMARY_COLUMNS = [
  'conversation_id',
  'title',
  'preview',
  'workspace_uris',
  'workspace',
  'project_id',
  'project',
  'agent_name',
  'parent_conversation_id',
  'nesting_depth',
  'source',
  'status',
];

/**
 * Decodes AGY `workspace_uris` (e.g. `'["file:///home/user/proj%20a"]'` or `'["file:///c:/Users/..."]'`)
 * or plain workspace paths into a clean filesystem path string.
 *
 * @param {string | null | undefined} rawWorkspaceUris
 * @param {string | null | undefined} [rawWorkspace]
 * @returns {string}
 */
export function decodeWorkspaceUri(rawWorkspaceUris, rawWorkspace = '') {
  let candidate = '';

  if (typeof rawWorkspaceUris === 'string' && rawWorkspaceUris.trim()) {
    const trimmed = rawWorkspaceUris.trim();
    if (trimmed.startsWith('[')) {
      try {
        const arr = JSON.parse(trimmed);
        if (Array.isArray(arr) && arr.length > 0 && typeof arr[0] === 'string') {
          candidate = arr[0].trim();
        }
      } catch {
        candidate = trimmed;
      }
    } else {
      candidate = trimmed;
    }
  }

  if (!candidate && typeof rawWorkspace === 'string' && rawWorkspace.trim()) {
    candidate = rawWorkspace.trim();
  }

  if (!candidate) return '';

  if (candidate.startsWith('file://')) {
    let withoutScheme = candidate.slice('file://'.length);
    if (withoutScheme.startsWith('localhost/')) {
      withoutScheme = withoutScheme.slice('localhost'.length);
    }
    try {
      withoutScheme = decodeURIComponent(withoutScheme);
    } catch {
      // Keep raw path if percent-decoding fails
    }
    // Normalize Windows `/c:/Users/...` -> `c:/Users/...`
    if (/^\/[A-Za-z]:[\\/]/.test(withoutScheme)) {
      withoutScheme = withoutScheme.slice(1);
    }
    return withoutScheme;
  }

  return candidate;
}

/**
 * Derives a human-readable project label from a workspace path or fallback DB project identifier.
 * @param {string} workspacePath
 * @param {string} [rawProject]
 * @param {string} [rawProjectId]
 * @returns {string}
 */
export function deriveProjectName(workspacePath, rawProject = '', rawProjectId = '') {
  if (typeof workspacePath === 'string' && workspacePath.trim()) {
    const normalized = workspacePath.trim().replace(/\\/g, '/').replace(/\/+$/, '');
    const base = path.posix.basename(normalized);
    if (base && base !== '.' && base !== '/') {
      return base;
    }
  }
  if (typeof rawProject === 'string' && rawProject.trim()) {
    return rawProject.trim();
  }
  if (
    typeof rawProjectId === 'string' &&
    rawProjectId.trim() &&
    rawProjectId.trim() !== 'outside-of-project'
  ) {
    return rawProjectId.trim();
  }
  return '';
}

function getParsedEntry(parsedByConvId, convId) {
  if (!parsedByConvId || !convId) return null;
  if (parsedByConvId instanceof Map) {
    return parsedByConvId.get(convId) || null;
  }
  if (typeof parsedByConvId === 'object') {
    return Object.prototype.hasOwnProperty.call(parsedByConvId, convId)
      ? parsedByConvId[convId]
      : null;
  }
  return null;
}

/**
 * Extracts fallback metadata hints from raw/mock step arrays when `metadataHints` wasn't pre-populated.
 */
function buildHintsFromSteps(steps) {
  const hints = {
    firstUserTitle: null,
    workspace: null,
    spawnedChildren: [],
    inferredParentId: null,
    inferredRole: null,
  };
  if (!Array.isArray(steps) || steps.length === 0) {
    return hints;
  }

  const seenChildren = new Set();
  const addChild = (cid, role, title, sourceTool, stepIndex, modelHint = '') => {
    const cleanId = typeof cid === 'string' ? cid.trim() : '';
    if (!cleanId) return;
    const cleanModel = canonicalizeModelName(modelHint);
    if (seenChildren.has(cleanId)) {
      if (cleanModel) {
        const idx = hints.spawnedChildren.findIndex((c) => c.conversationId === cleanId);
        if (idx >= 0 && !hints.spawnedChildren[idx].model) {
          hints.spawnedChildren[idx] = { ...hints.spawnedChildren[idx], model: cleanModel };
        }
      }
      return;
    }
    seenChildren.add(cleanId);
    hints.spawnedChildren.push({
      conversationId: cleanId,
      role: role || 'subagent',
      title: title || '',
      sourceTool: sourceTool || 'subagent',
      stepIndex: stepIndex ?? 0,
      ...(cleanModel ? { model: cleanModel } : {}),
    });
  };

  let pendingCalls = [];
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    if (!s || typeof s !== 'object') continue;
    const type = s.type || '';
    const content = typeof s.content === 'string' ? s.content : '';

    if (!hints.workspace && content) {
      const ws = extractWorkspaceFromContent(content);
      if (ws) hints.workspace = ws;
    }

    if (type === 'USER_INPUT' && !hints.firstUserTitle && content) {
      const t = extractCleanUserTitle(content);
      if (t) hints.firstUserTitle = t;
    }

    if ((type === 'SYSTEM_MESSAGE' || type === 'USER_INPUT') && !hints.inferredParentId && i <= 2 && content) {
      const senderMatch = content.match(/\bsender=([0-9a-fA-F-]{8,128})\b/);
      if (
        senderMatch &&
        !content.includes(`sender=${senderMatch[1]}/`) &&
        (content.includes('You have just started') || content.includes('assignment'))
      ) {
        const roleMatch = content.match(/for\s+@([a-zA-Z0-9_-]+)/);
        hints.inferredParentId = senderMatch[1];
        hints.inferredRole = roleMatch ? roleMatch[1] : 'worker';
      }
    }

    const rawCalls = s.tool_calls || s.toolCalls;
    if (type === 'PLANNER_RESPONSE' && Array.isArray(rawCalls)) {
      pendingCalls = rawCalls.slice();
      for (const tc of rawCalls) {
        const name = tc?.name || '';
        let args = tc?.args || tc?.arguments || {};
        if (typeof args === 'string') {
          try {
            args = JSON.parse(args);
          } catch {
            args = {};
          }
        }
        const directCid = args?.conversation_id || args?.conversationId || args?.child_conversation_id;
        if (directCid && (name.includes('subagent') || name === 'swarm')) {
          const role =
            args?.name || args?.subagent_name || args?.SubagentName || args?.agent_name || name;
          const argModel = String(args?.model || args?.Model || '').replace(/^"|"$/g, '');
          addChild(
            String(directCid).replace(/^"|"$/g, ''),
            String(role).replace(/^"|"$/g, ''),
            '',
            name,
            s.stepIndex ?? s.step_index ?? i,
            argModel,
          );
        }
      }
    } else if ((type === 'GENERIC' || type === 'TOOL_RESULT') && content) {
      const matched = pendingCalls.shift() || null;
      const toolName = matched?.name || s.toolName || '';
      let matchedArgs = matched?.args || {};
      if (typeof matchedArgs === 'string') {
        try {
          matchedArgs = JSON.parse(matchedArgs);
        } catch {
          matchedArgs = {};
        }
      }
      const fallbackRole = String(
        matchedArgs?.name ||
          matchedArgs?.subagent_name ||
          matchedArgs?.SubagentName ||
          matchedArgs?.agent_name ||
          (toolName && toolName !== 'invoke_subagent' ? toolName : 'subagent'),
      ).replace(/^"|"$/g, '');
      const fallbackModel = String(matchedArgs?.model || matchedArgs?.Model || '').replace(
        /^"|"$/g,
        '',
      );

      const uriRegex = /conversation:\/\/([a-zA-Z0-9_-]{4,128})/g;
      let m;
      while ((m = uriRegex.exec(content)) !== null) {
        addChild(m[1], fallbackRole, '', toolName, s.stepIndex ?? s.step_index ?? i, fallbackModel);
      }

      for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) continue;
        try {
          const parsedLine = JSON.parse(trimmed);
          const items = Array.isArray(parsedLine) ? parsedLine : [parsedLine];
          for (const obj of items) {
            if (!obj || typeof obj !== 'object' || Array.isArray(obj.messages)) continue;
            const cid =
              obj.conversation_id || obj.conversationId || obj.subagent_conversation_id;
            if (cid) {
              const r = obj.name || obj.agent_name || obj.subagent_name || obj.role || fallbackRole;
              const mHint = obj.model_display_name || obj.modelDisplayName || obj.model || fallbackModel;
              addChild(
                String(cid),
                String(r),
                String(obj.title || ''),
                toolName,
                s.stepIndex ?? s.step_index ?? i,
                String(mHint || ''),
              );
            }
            const memberLists = [obj.workers, obj.members].filter(Array.isArray);
            for (const list of memberLists) {
              for (const w of list) {
                const wcid = w?.conversation_id || w?.conversationId;
                if (wcid) {
                  addChild(
                    String(wcid),
                    String(w.name || fallbackRole || 'worker'),
                    '',
                    toolName,
                    s.stepIndex ?? s.step_index ?? i,
                    String(w.model_display_name || w.modelDisplayName || w.model || fallbackModel || ''),
                  );
                }
              }
            }
          }
        } catch {
          // Ignore non-JSON lines
        }
      }

      if (toolName.includes('subagent') || toolName === 'swarm') {
        const kv = content.match(
          /(?:subagent_)?conversation[_\s-]?id\s*[:=]\s*["']?([a-zA-Z0-9_-]{4,128})["']?/i,
        );
        if (kv && kv[1]) {
          addChild(kv[1], fallbackRole, '', toolName, s.stepIndex ?? s.step_index ?? i, fallbackModel);
        }
      }
    }
  }

  return hints;
}

/**
 * Queries a single `conversation_summaries.db` file strictly read-only via `DatabaseSync`.
 */
function readSummariesFromDb(DatabaseSync, dbPath) {
  const rowsById = new Map();
  if (!dbPath || !fs.existsSync(dbPath)) {
    return { ok: false, rowsById };
  }

  let db = null;
  try {
    db = new DatabaseSync(dbPath, { open: true, readOnly: true });

    const tableCheck = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'conversation_summaries'",
      )
      .get();
    if (!tableCheck) {
      return { ok: true, rowsById };
    }

    const colInfo = db.prepare('PRAGMA table_info("conversation_summaries")').all();
    const existingCols = new Set(colInfo.map((c) => String(c.name)));
    if (!existingCols.has('conversation_id')) {
      return { ok: true, rowsById };
    }

    const selectedCols = DESIRED_SUMMARY_COLUMNS.filter((col) => existingCols.has(col));
    const sql = `SELECT ${selectedCols.map((c) => `"${c}"`).join(', ')} FROM "conversation_summaries"`;
    const rows = db.prepare(sql).all();

    for (const row of rows) {
      const cid = typeof row.conversation_id === 'string' ? row.conversation_id.trim() : '';
      if (!cid) continue;
      rowsById.set(cid, row);
    }

    return { ok: true, rowsById };
  } catch {
    return { ok: false, rowsById };
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

function normalizeParsedSummary(parsed) {
  if (!parsed || typeof parsed !== 'object') {
    return {
      inputTokens: 0,
      cacheReadTokens: 0,
      outputTokens: 0,
      promptContextTokens: 0,
      totalTokens: 0,
      cacheHitRate: 0,
      requestCount: 0,
      avgTokensPerSec: 0,
      avgStepDurationMs: 0,
      lastStepDurationMs: 0,
      selfContextTokens: 0,
      modelName: '',
    };
  }

  if (parsed.totals && typeof parsed.totals === 'object') {
    const t = parsed.totals;
    const inputTokens = Number(t.inputTokens) || 0;
    const cacheReadTokens = Number(t.cacheReadTokens) || 0;
    const outputTokens = Number(t.outputTokens) || 0;
    const promptContextTokens = inputTokens + cacheReadTokens;
    const totalTokens =
      typeof parsed.selfTotalTokens === 'number'
        ? parsed.selfTotalTokens
        : typeof t.totalTokens === 'number'
          ? t.totalTokens
          : promptContextTokens + outputTokens;

    return {
      inputTokens,
      cacheReadTokens,
      outputTokens,
      promptContextTokens,
      totalTokens,
      cacheHitRate:
        typeof t.cacheHitRate === 'number'
          ? t.cacheHitRate
          : promptContextTokens > 0
            ? cacheReadTokens / promptContextTokens
            : 0,
      requestCount: Number(t.requestCount) || 0,
      avgTokensPerSec: Number(t.avgTokensPerSec) || 0,
      avgStepDurationMs: Number(t.avgStepDurationMs) || 0,
      lastStepDurationMs: Number(t.lastStepDurationMs) || 0,
      selfContextTokens:
        typeof parsed.selfContextTokens === 'number' ? parsed.selfContextTokens : 0,
      modelName: canonicalizeModelName(parsed.modelName),
    };
  }

  // Fallback if caller passed a minimal mock `{ selfTotalTokens, selfContextTokens, steps }`
  let inputTokens = Number(parsed.inputTokens) || 0;
  let cacheReadTokens = Number(parsed.cacheReadTokens) || 0;
  let outputTokens = Number(parsed.outputTokens) || 0;
  let lastContextTokens = 0;
  let stepModelFallback = '';

  if (Array.isArray(parsed.steps)) {
    const computeTokens = inputTokens === 0 && cacheReadTokens === 0 && outputTokens === 0;
    for (const s of parsed.steps) {
      const sm = canonicalizeModelName(s?.modelName ?? s?.model ?? '');
      if (sm) stepModelFallback = sm;
      if (!computeTokens) continue;
      const inp = Number(s.inputTokens ?? s.input_tokens) || 0;
      const cache = Number(s.cacheReadTokens ?? s.cache_read_tokens) || 0;
      const out = Number(s.outputTokens ?? s.output_tokens) || 0;
      if (s.type === 'CHECKPOINT') {
        lastContextTokens = 0;
      } else if (s.type === 'PLANNER_RESPONSE') {
        lastContextTokens = inp + cache + out;
      }
      inputTokens += inp;
      cacheReadTokens += cache;
      outputTokens += out;
    }
  }

  const promptContextTokens = inputTokens + cacheReadTokens;
  const totalTokens =
    typeof parsed.selfTotalTokens === 'number'
      ? parsed.selfTotalTokens
      : typeof parsed.totalTokens === 'number'
        ? parsed.totalTokens
        : promptContextTokens + outputTokens;
  const selfContextTokens =
    typeof parsed.selfContextTokens === 'number' ? parsed.selfContextTokens : lastContextTokens;

  return {
    inputTokens,
    cacheReadTokens,
    outputTokens,
    promptContextTokens,
    totalTokens,
    cacheHitRate: promptContextTokens > 0 ? cacheReadTokens / promptContextTokens : 0,
    requestCount: Array.isArray(parsed.steps)
      ? parsed.steps.filter((s) => s.type === 'PLANNER_RESPONSE' || s.type === 'CHECKPOINT').length
      : 0,
    avgTokensPerSec: Number(parsed.avgTokensPerSec) || 0,
    avgStepDurationMs: Number(parsed.avgStepDurationMs) || 0,
    lastStepDurationMs: Number(parsed.lastStepDurationMs) || 0,
    selfContextTokens,
    modelName: canonicalizeModelName(parsed.modelName) || stepModelFallback,
  };
}

/**
 * Resolves rich conversation metadata (`title`, `workspace`, `project`, `role`) and parent-child
 * subagent/Swarm hierarchy across all discovered conversations.
 *
 * Primarily queries `conversation_summaries.db` read-only via `await import('node:sqlite')`,
 * and gracefully falls back to transcript `USER_INPUT` / `<user_information>` / `invoke_subagent` / `swarm`
 * metadata when SQLite is unavailable, disabled, locked, or missing rows.
 *
 * Strictly isolates `selfContextTokens` to each conversation's own 256K window while recursively
 * aggregating `combinedTotalTokens = selfTotalTokens + subagentsTotalTokens` across all descendants.
 *
 * @param {Array<object>} conversations
 * @param {Map<string, object> | Record<string, object>} [parsedByConvId]
 * @param {object} [options]
 * @param {boolean} [options.disableSqlite=false]
 * @param {boolean} [options.useSqlite=true]
 * @param {() => Promise<any>} [options.sqliteLoader]
 * @param {Array<string>} [options.dbPaths]
 * @returns {Promise<{
 *   byId: Map<string, object>,
 *   records: Array<object>,
 *   rootRecords: Array<object>,
 *   sqliteUsed: boolean
 * }>}
 */
export async function resolveMetadataAndHierarchy(
  conversations = [],
  parsedByConvId = new Map(),
  options = {},
) {
  const convList = Array.isArray(conversations) ? conversations : [];
  const convById = new Map();
  for (const c of convList) {
    if (c && typeof c.conversationId === 'string' && c.conversationId) {
      convById.set(c.conversationId, c);
    }
  }

  // Also include any conversation IDs present in `parsedByConvId` even if omitted from `conversations`
  const allConvIds = new Set(convById.keys());
  if (parsedByConvId instanceof Map) {
    for (const cid of parsedByConvId.keys()) {
      if (cid) allConvIds.add(cid);
    }
  } else if (parsedByConvId && typeof parsedByConvId === 'object') {
    for (const cid of Object.keys(parsedByConvId)) {
      if (cid) allConvIds.add(cid);
    }
  }

  // 1. Collect candidate SQLite DB paths and query read-only if enabled
  const sqliteEnabled = !options.disableSqlite && options.useSqlite !== false;
  let sqliteUsed = false;
  const dbMapsByPath = new Map();
  const mergedDbRows = new Map();

  if (sqliteEnabled) {
    let DatabaseSync = null;
    try {
      const mod =
        typeof options.sqliteLoader === 'function'
          ? await options.sqliteLoader()
          : await import('node:sqlite');
      DatabaseSync = mod?.DatabaseSync || null;
    } catch {
      DatabaseSync = null;
    }

    if (DatabaseSync) {
      const candidateDbPaths = [];
      const seenDbPaths = new Set();
      const registerDbPath = (p) => {
        if (typeof p !== 'string' || !p.trim()) return;
        const resolved = path.resolve(p);
        if (seenDbPaths.has(resolved)) return;
        seenDbPaths.add(resolved);
        candidateDbPaths.push({ raw: p, resolved });
      };

      if (Array.isArray(options.dbPaths)) {
        for (const p of options.dbPaths) registerDbPath(p);
      }
      for (const conv of convList) {
        if (conv?.dbPath) registerDbPath(conv.dbPath);
        else if (conv?.rootDir) registerDbPath(path.join(conv.rootDir, 'conversation_summaries.db'));
        // Notice: Windows CLI / IDE sessions often write summaries into sibling `antigravity/conversation_summaries.db`
        if (conv?.geminiDir) {
          registerDbPath(path.join(conv.geminiDir, 'antigravity', 'conversation_summaries.db'));
        }
      }

      for (const { raw, resolved } of candidateDbPaths) {
        const res = readSummariesFromDb(DatabaseSync, raw);
        if (res.ok) {
          sqliteUsed = true;
          dbMapsByPath.set(resolved, res.rowsById);
          for (const [cid, row] of res.rowsById.entries()) {
            if (!mergedDbRows.has(cid)) {
              mergedDbRows.set(cid, row);
            }
          }
        }
      }
    }
  }

  // 2. Gather parsed state & transcript fallback hints per conversation
  const parsedMap = new Map();
  const hintsMap = new Map();

  for (const cid of allConvIds) {
    const conv = convById.get(cid) || null;
    let parsed = getParsedEntry(parsedByConvId, cid);
    if (!parsed && conv?.transcriptPath && fs.existsSync(conv.transcriptPath)) {
      parsed = parseTranscriptIncremental(conv.transcriptPath, null, [], null, {
        trajectoryDbPath: conv.trajectoryDbPath,
        trajectoryDbMtimeMs: conv.trajectoryDbMtimeMs,
        trajectoryDbSize: conv.trajectoryDbSize,
        defaultModelRaw: conv.defaultModelRaw,
      });
    }
    parsedMap.set(cid, parsed || null);

    if (parsed?.metadataHints) {
      hintsMap.set(cid, parsed.metadataHints);
    } else if (Array.isArray(parsed?.steps)) {
      hintsMap.set(cid, buildHintsFromSteps(parsed.steps));
    } else {
      hintsMap.set(cid, buildHintsFromSteps([]));
    }
  }

  // 3. Establish parent -> child links (SQLite primary, transcript fallback/supplement)
  const rawParentOf = new Map();
  const spawnedRoleMap = new Map();
  const spawnedTitleMap = new Map();
  const spawnedModelMap = new Map();
  const spawnedStepIndexMap = new Map();

  // First record child role/title/model hints from parent transcripts (`invoke_subagent` / `swarm`)
  for (const [parentId, hints] of hintsMap.entries()) {
    if (!Array.isArray(hints?.spawnedChildren)) continue;
    for (const child of hints.spawnedChildren) {
      const childId = child?.conversationId;
      if (!childId || childId === parentId) continue;
      if (child.role && !spawnedRoleMap.has(childId)) {
        spawnedRoleMap.set(childId, child.role);
      }
      if (child.title && !spawnedTitleMap.has(childId)) {
        spawnedTitleMap.set(childId, child.title);
      }
      if (child.model && !spawnedModelMap.has(childId)) {
        const cm = canonicalizeModelName(child.model);
        if (cm) spawnedModelMap.set(childId, cm);
      }
      if (typeof child.stepIndex === 'number' && !spawnedStepIndexMap.has(childId)) {
        spawnedStepIndexMap.set(childId, child.stepIndex);
      }
    }
  }

  // Primary parent link from SQLite `parent_conversation_id`
  const lookupDbRow = (cid) => {
    const conv = convById.get(cid);
    if (conv?.dbPath) {
      const localMap = dbMapsByPath.get(path.resolve(conv.dbPath));
      if (localMap?.has(cid)) return localMap.get(cid);
    }
    return mergedDbRows.get(cid) || null;
  };

  for (const cid of allConvIds) {
    const dbRow = lookupDbRow(cid);
    const dbParent =
      typeof dbRow?.parent_conversation_id === 'string'
        ? dbRow.parent_conversation_id.trim()
        : '';
    if (dbParent && dbParent !== cid) {
      rawParentOf.set(cid, dbParent);
    }
  }

  // Fallback parent links from parent transcripts (`invoke_subagent` / `swarm`)
  for (const [parentId, hints] of hintsMap.entries()) {
    if (!Array.isArray(hints?.spawnedChildren)) continue;
    for (const child of hints.spawnedChildren) {
      const childId = child?.conversationId;
      if (!childId || childId === parentId) continue;
      if (!rawParentOf.has(childId)) {
        rawParentOf.set(childId, parentId);
      }
    }
  }

  // Fallback parent links from child's own startup `SYSTEM_MESSAGE` (`sender=<parentId>`)
  for (const [cid, hints] of hintsMap.entries()) {
    if (!rawParentOf.has(cid) && hints?.inferredParentId && hints.inferredParentId !== cid) {
      rawParentOf.set(cid, hints.inferredParentId);
    }
  }

  // Break any accidental cycles (`A -> B -> A`) deterministically
  const parentOf = new Map();
  for (const [cid, directParent] of rawParentOf.entries()) {
    const visited = new Set([cid]);
    let cursor = directParent;
    let hasCycle = false;
    while (cursor) {
      if (visited.has(cursor)) {
        hasCycle = true;
        break;
      }
      visited.add(cursor);
      cursor = rawParentOf.get(cursor) || null;
    }
    if (!hasCycle) {
      parentOf.set(cid, directParent);
    }
  }

  // Build adjacency list `childrenOf`
  const childrenOf = new Map();
  for (const [childId, parentId] of parentOf.entries()) {
    // Only link children that are actually present in our known universe (or discovered)
    if (!allConvIds.has(childId)) continue;
    let arr = childrenOf.get(parentId);
    if (!arr) {
      arr = [];
      childrenOf.set(parentId, arr);
    }
    arr.push(childId);
  }

  // 4. Resolve individual conversation metadata (title, workspace, project, role, selfTotals)
  const baseInfoById = new Map();

  for (const cid of allConvIds) {
    const conv = convById.get(cid) || {};
    const dbRow = lookupDbRow(cid);
    const hints = hintsMap.get(cid) || {};
    const parsedSummary = normalizeParsedSummary(parsedMap.get(cid));
    const parentId = parentOf.get(cid) || null;

    const dbWorkspace = dbRow
      ? decodeWorkspaceUri(dbRow.workspace_uris, dbRow.workspace)
      : '';
    const workspace = dbWorkspace || hints.workspace || '';

    const project = deriveProjectName(
      workspace,
      dbRow?.project || '',
      dbRow?.project_id || '',
    );
    const projectId = typeof dbRow?.project_id === 'string' ? dbRow.project_id : '';

    const dbAgentName =
      typeof dbRow?.agent_name === 'string' && dbRow.agent_name.trim()
        ? dbRow.agent_name.trim()
        : '';
    const role =
      dbAgentName ||
      spawnedRoleMap.get(cid) ||
      hints.inferredRole ||
      (parentId ? 'subagent' : 'main');

    const dbTitle =
      typeof dbRow?.title === 'string' && dbRow.title.trim()
        ? dbRow.title.trim()
        : typeof dbRow?.preview === 'string' && dbRow.preview.trim()
          ? dbRow.preview.trim()
          : '';

    const title =
      dbTitle ||
      hints.firstUserTitle ||
      spawnedTitleMap.get(cid) ||
      (parentId && role && role !== 'subagent' ? `@${role}` : '') ||
      `Conversation ${cid.slice(0, 8)}`;

    const metadataSource = dbRow
      ? 'sqlite'
      : hints.firstUserTitle || hints.workspace || hints.inferredParentId
        ? 'transcript'
        : 'default';

    baseInfoById.set(cid, {
      conversationId: cid,
      title,
      workspace,
      project,
      projectId,
      surface: conv.surface || 'Desktop (WSL)',
      side: conv.side || 'WSL',
      appKind: conv.appKind || 'Desktop',
      isLocalSide: typeof conv.isLocalSide === 'boolean' ? conv.isLocalSide : true,
      transcriptPath: conv.transcriptPath || parsedMap.get(cid)?.transcriptPath || '',
      mtimeMs: Number(conv.mtimeMs ?? parsedMap.get(cid)?.mtimeMs) || 0,
      modelName: parsedSummary.modelName,
      role,
      parentConversationId: parentId,
      selfTotals: parsedSummary,
      metadataSource,
    });
  }

  // Propagate workspace/project across parent <-> child links when missing in fallback mode
  for (const [cid, info] of baseInfoById.entries()) {
    if (!info.workspace && !info.parentConversationId) {
      for (const childId of childrenOf.get(cid) || []) {
        const childInfo = baseInfoById.get(childId);
        if (childInfo?.workspace) {
          info.workspace = childInfo.workspace;
          if (!info.project) info.project = childInfo.project;
          if (!info.projectId) info.projectId = childInfo.projectId;
          break;
        }
      }
    }
  }

  for (const [cid, info] of baseInfoById.entries()) {
    if (!info.workspace && info.parentConversationId) {
      let cursor = info.parentConversationId;
      const seen = new Set([cid]);
      while (cursor && !seen.has(cursor)) {
        seen.add(cursor);
        const ancestor = baseInfoById.get(cursor);
        if (ancestor?.workspace) {
          info.workspace = ancestor.workspace;
          if (!info.project) info.project = ancestor.project;
          if (!info.projectId) info.projectId = ancestor.projectId;
          break;
        }
        cursor = parentOf.get(cursor) || null;
      }
    }
  }

  // Propagate real model across parent -> descendant links, installation defaults, and peers
  // so subagents with `Model: "inherit"` or unannotated sessions never resolve to `'Auto'` or `''`.
  const peerModelByGeminiDir = new Map();
  const peerModelBySide = new Map();
  let anyPeerModel = '';
  for (const [cid, info] of baseInfoById.entries()) {
    const conv = convById.get(cid);
    const m = info.modelName || canonicalizeModelName(conv?.defaultModelRaw || '');
    if (!m) continue;
    if (!anyPeerModel) anyPeerModel = m;
    if (conv?.geminiDir && !peerModelByGeminiDir.has(conv.geminiDir)) {
      peerModelByGeminiDir.set(conv.geminiDir, m);
    }
    if (info.side && !peerModelBySide.has(info.side)) {
      peerModelBySide.set(info.side, m);
    }
  }

  for (const [cid, info] of baseInfoById.entries()) {
    if (!info.modelName) {
      let inheritedModel = spawnedModelMap.get(cid) || '';

      if (!inheritedModel && info.parentConversationId) {
        let cursor = cid;
        const seen = new Set([cid]);
        while (!inheritedModel && parentOf.has(cursor)) {
          const pid = parentOf.get(cursor);
          if (!pid || seen.has(pid)) break;
          seen.add(pid);
          if (spawnedModelMap.has(pid)) {
            inheritedModel = spawnedModelMap.get(pid);
            break;
          }
          const parentParsed = parsedMap.get(pid);
          const spawnIdx = spawnedStepIndexMap.get(cursor);
          if (typeof spawnIdx === 'number' && Array.isArray(parentParsed?.steps)) {
            const exactStep = parentParsed.steps.find((s) => s.stepIndex === spawnIdx);
            const sm = canonicalizeModelName(exactStep?.modelName);
            if (sm) {
              inheritedModel = sm;
              break;
            }
          }
          const parentInfo = baseInfoById.get(pid);
          if (parentInfo?.modelName) {
            inheritedModel = parentInfo.modelName;
            break;
          }
          cursor = pid;
        }
      }

      if (!inheritedModel) {
        const conv = convById.get(cid);
        inheritedModel =
          canonicalizeModelName(conv?.defaultModelRaw || '') ||
          (conv?.geminiDir ? peerModelByGeminiDir.get(conv.geminiDir) || '' : '') ||
          (info.side ? peerModelBySide.get(info.side) || '' : '') ||
          anyPeerModel;
      }

      if (inheritedModel) {
        info.modelName = inheritedModel;
        info.selfTotals.modelName = inheritedModel;
      }
    }

    // Backfill empty step/conversation modelName on caller's parsed entry when resolved via hierarchy
    if (info.modelName) {
      const parsed = parsedMap.get(cid);
      if (parsed && typeof parsed === 'object') {
        if (!canonicalizeModelName(parsed.modelName)) {
          parsed.modelName = info.modelName;
        }
        if (Array.isArray(parsed.steps)) {
          for (const st of parsed.steps) {
            if (st && typeof st === 'object' && !canonicalizeModelName(st.modelName)) {
              st.modelName = info.modelName;
            }
          }
        }
      }
    }
  }

  // Helper to find top-most known root ancestor
  const findRootId = (cid) => {
    let current = cid;
    const seen = new Set([cid]);
    while (true) {
      const p = parentOf.get(current);
      if (!p || seen.has(p) || !baseInfoById.has(p)) {
        return current;
      }
      seen.add(p);
      current = p;
    }
  };

  // Helper to collect all recursive descendants `(descId, depth)`
  const collectDescendants = (rootCid) => {
    const descendants = [];
    const visited = new Set([rootCid]);
    const queue = (childrenOf.get(rootCid) || []).map((id) => ({ id, depth: 1 }));

    while (queue.length > 0) {
      const { id, depth } = queue.shift();
      if (visited.has(id) || !baseInfoById.has(id)) continue;
      visited.add(id);
      descendants.push({ id, depth });
      for (const grandChildId of childrenOf.get(id) || []) {
        if (!visited.has(grandChildId)) {
          queue.push({ id: grandChildId, depth: depth + 1 });
        }
      }
    }
    return descendants;
  };

  // 5. Assemble final resolved records with recursive subagent aggregation & isolated 256K window
  const byId = new Map();

  for (const [cid, info] of baseInfoById.entries()) {
    const directChildren = (childrenOf.get(cid) || []).slice();
    const descendants = collectDescendants(cid);
    const descendantIds = descendants.map((d) => d.id);

    const selfTotalTokens = info.selfTotals.totalTokens;
    // CRITICAL INVARIANT: `selfContextTokens` is strictly isolated to this conversation's own 256K window!
    const selfContextTokens = info.selfTotals.selfContextTokens;

    let subagentsTotalTokens = 0;
    let subInputTokens = 0;
    let subCacheReadTokens = 0;
    let subOutputTokens = 0;

    for (const { id: descId } of descendants) {
      const descInfo = baseInfoById.get(descId);
      if (!descInfo) continue;
      subagentsTotalTokens += descInfo.selfTotals.totalTokens;
      subInputTokens += descInfo.selfTotals.inputTokens;
      subCacheReadTokens += descInfo.selfTotals.cacheReadTokens;
      subOutputTokens += descInfo.selfTotals.outputTokens;
    }

    const combinedTotalTokens = selfTotalTokens + subagentsTotalTokens;
    const selfSharePercent =
      combinedTotalTokens > 0
        ? Number(((selfTotalTokens / combinedTotalTokens) * 100).toFixed(1))
        : 0;
    const subagentsSharePercent =
      combinedTotalTokens > 0
        ? Number(((subagentsTotalTokens / combinedTotalTokens) * 100).toFixed(1))
        : 0;

    const subagents = descendants
      .map(({ id: descId, depth }) => {
        const descInfo = baseInfoById.get(descId);
        const descTotal = descInfo.selfTotals.totalTokens;
        return {
          conversationId: descId,
          parentConversationId: descInfo.parentConversationId,
          depth,
          title: descInfo.title,
          role: descInfo.role || 'subagent',
          modelName: descInfo.modelName,
          surface: descInfo.surface,
          isLocalSide: descInfo.isLocalSide,
          totalTokens: descTotal,
          inputTokens: descInfo.selfTotals.inputTokens,
          cacheReadTokens: descInfo.selfTotals.cacheReadTokens,
          outputTokens: descInfo.selfTotals.outputTokens,
          selfContextTokens: descInfo.selfTotals.selfContextTokens,
          sharePercent:
            combinedTotalTokens > 0
              ? Number(((descTotal / combinedTotalTokens) * 100).toFixed(1))
              : 0,
        };
      })
      .sort((a, b) => {
        if (b.totalTokens !== a.totalTokens) return b.totalTokens - a.totalTokens;
        return a.conversationId.localeCompare(b.conversationId);
      });

    const combinedInputTokens = info.selfTotals.inputTokens + subInputTokens;
    const combinedCacheReadTokens = info.selfTotals.cacheReadTokens + subCacheReadTokens;
    const combinedOutputTokens = info.selfTotals.outputTokens + subOutputTokens;
    const combinedPromptTokens = combinedInputTokens + combinedCacheReadTokens;
    const combinedCacheHitRate =
      combinedPromptTokens > 0 ? combinedCacheReadTokens / combinedPromptTokens : 0;

    const record = {
      conversationId: info.conversationId,
      title: info.title,
      workspace: info.workspace,
      project: info.project,
      projectId: info.projectId,
      surface: info.surface,
      side: info.side,
      appKind: info.appKind,
      isLocalSide: info.isLocalSide,
      transcriptPath: info.transcriptPath,
      mtimeMs: info.mtimeMs,
      modelName: info.modelName,
      role: info.role,
      parentConversationId: info.parentConversationId,
      rootConversationId: findRootId(cid),
      childConversationIds: directChildren,
      descendantIds,
      selfContextTokens,
      selfTotalTokens,
      subagentsTotalTokens,
      combinedTotalTokens,
      selfSharePercent,
      subagentsSharePercent,
      subagents,
      selfTotals: {
        inputTokens: info.selfTotals.inputTokens,
        cacheReadTokens: info.selfTotals.cacheReadTokens,
        outputTokens: info.selfTotals.outputTokens,
        totalTokens: selfTotalTokens,
        cacheHitRate: info.selfTotals.cacheHitRate,
        avgTokensPerSec: info.selfTotals.avgTokensPerSec,
        avgStepDurationMs: info.selfTotals.avgStepDurationMs,
        lastStepDurationMs: info.selfTotals.lastStepDurationMs,
        requestCount: info.selfTotals.requestCount,
      },
      combinedTotals: {
        inputTokens: combinedInputTokens,
        cacheReadTokens: combinedCacheReadTokens,
        outputTokens: combinedOutputTokens,
        totalTokens: combinedTotalTokens,
        cacheHitRate: combinedCacheHitRate,
      },
      consumption: {
        combinedTotalTokens,
        selfTotalTokens,
        subagentsTotalTokens,
        selfSharePercent,
        subagentsSharePercent,
        subagents,
        inputTokens: info.selfTotals.inputTokens,
        outputTokens: info.selfTotals.outputTokens,
        cacheReadTokens: info.selfTotals.cacheReadTokens,
        cacheHitRate: info.selfTotals.cacheHitRate,
        avgTokensPerSec: info.selfTotals.avgTokensPerSec,
        avgStepDurationMs: info.selfTotals.avgStepDurationMs,
        lastStepDurationMs: info.selfTotals.lastStepDurationMs,
        combinedInputTokens,
        combinedOutputTokens,
        combinedCacheReadTokens,
        combinedCacheHitRate,
      },
      metadataSource: info.metadataSource,
    };

    byId.set(cid, record);
  }

  // Preserve input order first (sorted by mtimeMs desc for remaining)
  const orderedIds = [];
  const added = new Set();
  for (const c of convList) {
    if (c?.conversationId && byId.has(c.conversationId) && !added.has(c.conversationId)) {
      added.add(c.conversationId);
      orderedIds.push(c.conversationId);
    }
  }
  const extraRecords = [];
  for (const [cid, rec] of byId.entries()) {
    if (!added.has(cid)) extraRecords.push(rec);
  }
  extraRecords.sort((a, b) => b.mtimeMs - a.mtimeMs);
  for (const r of extraRecords) orderedIds.push(r.conversationId);

  const records = orderedIds.map((cid) => byId.get(cid));
  const rootRecords = records.filter(
    (r) => !r.parentConversationId || !byId.has(r.parentConversationId),
  );

  return {
    byId,
    records,
    rootRecords,
    sqliteUsed,
  };
}
