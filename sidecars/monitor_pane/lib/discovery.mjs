import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Mapping from `.gemini` client directory names to normalized surface app kinds.
 */
export const APP_DIR_MAP = Object.freeze({
  antigravity: 'Desktop',
  'antigravity-ide': 'IDE',
  'antigravity-cli': 'CLI',
});

const SKIP_WIN_USER_DIRS = new Set([
  'public',
  'default',
  'default user',
  'all users',
]);

/**
 * Format human-readable client surface label (e.g. `Desktop (WSL)`, `CLI (Win)`).
 * @param {'Desktop' | 'IDE' | 'CLI' | string} appKind
 * @param {'WSL' | 'Win' | string} side
 * @returns {string}
 */
export function formatSurfaceLabel(appKind, side) {
  return `${appKind} (${side})`;
}

/**
 * Returns true if a directory name or any segment in a path ends with `-backup`.
 * @param {string} targetPath
 * @returns {boolean}
 */
export function isBackupPath(targetPath) {
  if (typeof targetPath !== 'string' || !targetPath) return false;
  const segments = targetPath.split(/[\\/]+/).filter(Boolean);
  return segments.some((seg) => seg.toLowerCase().endsWith('-backup'));
}

function safeStat(targetPath) {
  try {
    return fs.statSync(targetPath);
  } catch {
    return null;
  }
}

function isDirectorySafe(targetPath) {
  const st = safeStat(targetPath);
  return Boolean(st && st.isDirectory());
}

function isFileSafe(targetPath) {
  const st = safeStat(targetPath);
  return Boolean(st && st.isFile());
}

function safeReadDirEntries(dirPath) {
  try {
    return fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }
}

function isEntryDirectory(parentDir, entry) {
  if (entry.isDirectory()) return true;
  if (entry.isSymbolicLink()) {
    return isDirectorySafe(path.join(parentDir, entry.name));
  }
  return false;
}

function normalizeDedupKey(dirPath) {
  return path.resolve(dirPath).replace(/\\/g, '/');
}

/**
 * Reads `last_selected_agent_model` from `antigravity_state.pbtxt` / `jetski_state.pbtxt` if present.
 */
function readInstallationDefaultModel(rootDir, geminiDir) {
  const candidates = [];
  if (rootDir) {
    candidates.push(path.join(rootDir, 'antigravity_state.pbtxt'));
    candidates.push(path.join(rootDir, 'jetski_state.pbtxt'));
  }
  if (geminiDir) {
    candidates.push(path.join(geminiDir, 'antigravity', 'antigravity_state.pbtxt'));
    candidates.push(path.join(geminiDir, 'antigravity', 'jetski_state.pbtxt'));
  }
  for (const statePath of candidates) {
    try {
      if (!isFileSafe(statePath)) continue;
      const text = fs.readFileSync(statePath, 'utf8');
      const m = text.match(/last_selected_agent_model:\s*["']?([A-Za-z0-9_.-]+)["']?/);
      if (m && m[1]) {
        return m[1].trim();
      }
    } catch {
      // Ignore unreadable state file
    }
  }
  return '';
}

function indexTrajectoryDbsInRoot(rootDir) {
  const map = new Map();
  if (!rootDir) return map;
  const convDbDir = path.join(rootDir, 'conversations');
  const entries = safeReadDirEntries(convDbDir);
  if (entries.length === 0) return map;
  const names = new Set(entries.map((e) => e.name));
  for (const name of names) {
    if (!name.endsWith('.db')) continue;
    const convId = name.slice(0, -3);
    if (!convId) continue;
    const dbFile = path.join(convDbDir, name);
    const st = safeStat(dbFile);
    if (!st || !st.isFile()) continue;
    const walSt = names.has(`${name}-wal`) ? safeStat(path.join(convDbDir, `${name}-wal`)) : null;
    map.set(convId, {
      trajectoryDbPath: dbFile,
      trajectoryDbMtimeMs: Math.max(st.mtimeMs, walSt?.mtimeMs || 0),
      trajectoryDbSize: st.size + (walSt?.size || 0),
    });
  }
  return map;
}

/**
 * Inspects a `.gemini` directory and appends any valid `antigravity`, `antigravity-ide`,
 * or `antigravity-cli` data source roots (strictly excluding `*-backup`).
 */
function collectAppRootsFromGeminiDir(geminiDir, side, localSide, outSources, seenRoots) {
  if (!geminiDir || isBackupPath(geminiDir) || !isDirectorySafe(geminiDir)) {
    return;
  }

  const entries = safeReadDirEntries(geminiDir);
  for (const entry of entries) {
    const name = entry.name;
    if (!name || name.toLowerCase().endsWith('-backup')) {
      continue;
    }
    const appKind = APP_DIR_MAP[name];
    if (!appKind) {
      continue;
    }
    if (!isEntryDirectory(geminiDir, entry)) {
      continue;
    }

    const rootDir = path.join(geminiDir, name);
    if (isBackupPath(rootDir)) {
      continue;
    }

    const dedupKey = normalizeDedupKey(rootDir);
    if (seenRoots.has(dedupKey)) {
      continue;
    }
    seenRoots.add(dedupKey);

    const brainDir = path.join(rootDir, 'brain');
    const dbPath = path.join(rootDir, 'conversation_summaries.db');
    const isLocalSide = side === localSide;
    const defaultModelRaw = readInstallationDefaultModel(rootDir, geminiDir);

    outSources.push({
      rootDir,
      geminiDir,
      brainDir,
      dbPath,
      hasBrain: isDirectorySafe(brainDir),
      hasDb: isFileSafe(dbPath),
      appName: name,
      appKind,
      side,
      surface: formatSurfaceLabel(appKind, side),
      isLocalSide,
      defaultModelRaw,
    });
  }
}

/**
 * Handles flexible `extraRoots` items (either a `.gemini` directory, a direct app root
 * like `.../antigravity`, or an object `{ rootDir|geminiDir|path, side?, appKind?, isLocalSide? }`).
 */
function collectExtraRoot(extraItem, localSide, outSources, seenRoots) {
  if (!extraItem) return;

  const rawObj = typeof extraItem === 'string' ? { path: extraItem } : extraItem;
  const targetPath = rawObj.rootDir || rawObj.geminiDir || rawObj.path;
  if (typeof targetPath !== 'string' || !targetPath || isBackupPath(targetPath)) {
    return;
  }
  if (!isDirectorySafe(targetPath)) {
    return;
  }

  const side = rawObj.side || localSide;
  const base = path.basename(targetPath);

  if (base === '.gemini' || rawObj.geminiDir) {
    collectAppRootsFromGeminiDir(targetPath, side, localSide, outSources, seenRoots);
    return;
  }

  const inferredAppKind = rawObj.appKind || APP_DIR_MAP[base] || null;
  if (!inferredAppKind) {
    // Check if targetPath contains a `.gemini` subdirectory or direct `antigravity*` children
    const nestedGemini = path.join(targetPath, '.gemini');
    if (isDirectorySafe(nestedGemini)) {
      collectAppRootsFromGeminiDir(nestedGemini, side, localSide, outSources, seenRoots);
      return;
    }
    const hasAppChild = Object.keys(APP_DIR_MAP).some((appDir) =>
      isDirectorySafe(path.join(targetPath, appDir)),
    );
    if (hasAppChild) {
      collectAppRootsFromGeminiDir(targetPath, side, localSide, outSources, seenRoots);
      return;
    }
  }

  const appKind = inferredAppKind || 'Desktop';
  const appName = APP_DIR_MAP[base] ? base : rawObj.appName || 'antigravity';
  const dedupKey = normalizeDedupKey(targetPath);
  if (seenRoots.has(dedupKey)) {
    return;
  }
  seenRoots.add(dedupKey);

  const brainDir = path.join(targetPath, 'brain');
  const dbPath = path.join(targetPath, 'conversation_summaries.db');
  const geminiDir = path.dirname(targetPath);
  const isLocalSide =
    typeof rawObj.isLocalSide === 'boolean' ? rawObj.isLocalSide : side === localSide;
  const defaultModelRaw = readInstallationDefaultModel(targetPath, geminiDir);

  outSources.push({
    rootDir: targetPath,
    geminiDir,
    brainDir,
    dbPath,
    hasBrain: isDirectorySafe(brainDir),
    hasDb: isFileSafe(dbPath),
    appName,
    appKind,
    side,
    surface: rawObj.surface || formatSurfaceLabel(appKind, side),
    isLocalSide,
    defaultModelRaw,
  });
}

/**
 * Automatically discovers reachable AGY data source roots across WSL and Windows
 * (`antigravity`, `antigravity-ide`, `antigravity-cli`), strictly skipping `*-backup`.
 *
 * When custom sandbox paths (`homeDir`, `mntCRoot`, or `wslUncRoot`) are passed in `options`,
 * only the explicitly supplied roots (plus `extraRoots`) are probed to prevent host leakage
 * during unit tests, unless `options.includeHostDefaults === true`.
 *
 * @param {object} [options]
 * @param {string} [options.platform]
 * @param {string | null} [options.homeDir]
 * @param {string | null} [options.mntCRoot]
 * @param {string | null} [options.wslUncRoot]
 * @param {Array<string | object>} [options.extraRoots]
 * @param {boolean} [options.includeDefaultRoots=true]
 * @param {boolean} [options.includeHostDefaults=false]
 * @returns {Array<object>}
 */
export function discoverDataSources(options = {}) {
  const platform = options.platform || process.platform;
  const localSide = platform === 'win32' ? 'Win' : 'WSL';

  const hasExplicitSandboxOverride =
    options.homeDir !== undefined ||
    options.mntCRoot !== undefined ||
    options.wslUncRoot !== undefined;
  const useHostDefaults =
    options.includeDefaultRoots !== false &&
    (!hasExplicitSandboxOverride || options.includeHostDefaults === true);

  const homeDir =
    options.homeDir !== undefined
      ? options.homeDir
      : useHostDefaults
        ? platform === 'win32'
          ? process.env.USERPROFILE || os.homedir()
          : os.homedir()
        : null;

  const mntCRoot =
    options.mntCRoot !== undefined
      ? options.mntCRoot
      : useHostDefaults && platform !== 'win32'
        ? '/mnt/c/Users'
        : null;

  const wslUncRoot =
    options.wslUncRoot !== undefined
      ? options.wslUncRoot
      : useHostDefaults && platform === 'win32'
        ? '\\\\wsl.localhost'
        : null;

  const sources = [];
  const seenRoots = new Set();

  if (options.includeDefaultRoots !== false) {
    if (platform === 'win32') {
      // 1. Windows local %USERPROFILE%\.gemini\*
      if (homeDir) {
        collectAppRootsFromGeminiDir(
          path.join(homeDir, '.gemini'),
          'Win',
          localSide,
          sources,
          seenRoots,
        );
      }

      // 2. Cross-side WSL UNC \\wsl.localhost\<distro>\home\<user>\.gemini\*
      if (wslUncRoot && !isBackupPath(wslUncRoot) && isDirectorySafe(wslUncRoot)) {
        const distroEntries = safeReadDirEntries(wslUncRoot);
        for (const distro of distroEntries) {
          if (!distro.name || distro.name.toLowerCase().endsWith('-backup')) continue;
          if (!isEntryDirectory(wslUncRoot, distro)) continue;

          const distroHomeRoot = path.join(wslUncRoot, distro.name, 'home');
          if (!isDirectorySafe(distroHomeRoot)) continue;

          const wslUsers = safeReadDirEntries(distroHomeRoot);
          for (const wslUser of wslUsers) {
            if (!wslUser.name || wslUser.name.startsWith('.') || wslUser.name.toLowerCase().endsWith('-backup')) {
              continue;
            }
            if (!isEntryDirectory(distroHomeRoot, wslUser)) continue;

            const wslGeminiDir = path.join(distroHomeRoot, wslUser.name, '.gemini');
            collectAppRootsFromGeminiDir(wslGeminiDir, 'WSL', localSide, sources, seenRoots);
          }
        }
      }
    } else {
      // 1. WSL / Linux local $HOME/.gemini/*
      if (homeDir) {
        collectAppRootsFromGeminiDir(
          path.join(homeDir, '.gemini'),
          'WSL',
          localSide,
          sources,
          seenRoots,
        );
      }

      // 2. Cross-side mounted Windows /mnt/c/Users/*/.gemini/*
      if (mntCRoot && !isBackupPath(mntCRoot) && isDirectorySafe(mntCRoot)) {
        const winUsers = safeReadDirEntries(mntCRoot);
        for (const winUser of winUsers) {
          const lower = winUser.name.toLowerCase();
          if (
            !winUser.name ||
            winUser.name.startsWith('.') ||
            lower.endsWith('-backup') ||
            SKIP_WIN_USER_DIRS.has(lower)
          ) {
            continue;
          }
          if (!isEntryDirectory(mntCRoot, winUser)) continue;

          const winGeminiDir = path.join(mntCRoot, winUser.name, '.gemini');
          collectAppRootsFromGeminiDir(winGeminiDir, 'Win', localSide, sources, seenRoots);
        }
      }
    }
  }

  if (Array.isArray(options.extraRoots)) {
    for (const extra of options.extraRoots) {
      collectExtraRoot(extra, localSide, sources, seenRoots);
    }
  }

  return sources;
}

/**
 * Resolves the active `transcript.jsonl` inside a `brain/<convId>` directory, probing both
 * `.system_generated/logs/transcript.jsonl` and direct `transcript.jsonl`, keeping latest `mtimeMs`.
 */
function findConversationTranscript(convDir) {
  const candidates = [
    path.join(convDir, '.system_generated', 'logs', 'transcript.jsonl'),
    path.join(convDir, 'transcript.jsonl'),
  ];

  let best = null;
  for (const candidatePath of candidates) {
    const st = safeStat(candidatePath);
    if (!st || !st.isFile()) continue;
    if (
      !best ||
      st.mtimeMs > best.mtimeMs ||
      (st.mtimeMs === best.mtimeMs && st.size > best.size)
    ) {
      best = {
        transcriptPath: candidatePath,
        mtimeMs: st.mtimeMs,
        size: st.size,
      };
    }
  }
  return best;
}

/**
 * Discovers all non-backup AGY conversation transcripts across reachable WSL & Windows roots
 * and deduplicates globally by `conversationId` (retaining the latest `mtimeMs`).
 *
 * @param {object} [options]
 * @returns {Array<object>}
 */
export function discoverConversations(options = {}) {
  const sources = Array.isArray(options.dataSources)
    ? options.dataSources
    : discoverDataSources(options);

  const byConvId = new Map();
  const siblingTrajCache = new Map();

  for (const source of sources) {
    if (!source || !source.brainDir || isBackupPath(source.rootDir) || isBackupPath(source.brainDir)) {
      continue;
    }
    if (!isDirectorySafe(source.brainDir)) {
      continue;
    }

    const ownTrajMap = indexTrajectoryDbsInRoot(source.rootDir);
    let siblingTrajMap = null;
    if (source.geminiDir && source.appName !== 'antigravity') {
      const siblingRoot = path.join(source.geminiDir, 'antigravity');
      if (!siblingTrajCache.has(siblingRoot)) {
        siblingTrajCache.set(siblingRoot, indexTrajectoryDbsInRoot(siblingRoot));
      }
      siblingTrajMap = siblingTrajCache.get(siblingRoot);
    }

    const convEntries = safeReadDirEntries(source.brainDir);
    for (const entry of convEntries) {
      const conversationId = entry.name;
      if (
        !conversationId ||
        conversationId.startsWith('.') ||
        conversationId.toLowerCase().endsWith('-backup')
      ) {
        continue;
      }
      if (!isEntryDirectory(source.brainDir, entry)) {
        continue;
      }

      const convDir = path.join(source.brainDir, conversationId);
      const found = findConversationTranscript(convDir);
      if (!found) {
        continue;
      }

      const trajInfo =
        ownTrajMap.get(conversationId) || siblingTrajMap?.get(conversationId) || null;

      const record = {
        conversationId,
        transcriptPath: found.transcriptPath,
        convDir,
        rootDir: source.rootDir,
        geminiDir: source.geminiDir,
        dbPath: source.dbPath,
        trajectoryDbPath: trajInfo ? trajInfo.trajectoryDbPath : null,
        trajectoryDbMtimeMs: trajInfo ? trajInfo.trajectoryDbMtimeMs : 0,
        trajectoryDbSize: trajInfo ? trajInfo.trajectoryDbSize : 0,
        defaultModelRaw: source.defaultModelRaw || '',
        appName: source.appName,
        appKind: source.appKind,
        side: source.side,
        surface: source.surface,
        isLocalSide: Boolean(source.isLocalSide),
        mtimeMs: found.mtimeMs,
        size: found.size,
      };

      const existing = byConvId.get(conversationId);
      if (!existing) {
        byConvId.set(conversationId, record);
        continue;
      }

      const isNewer = record.mtimeMs > existing.mtimeMs;
      const isTiedButPreferred =
        record.mtimeMs === existing.mtimeMs &&
        ((record.isLocalSide && !existing.isLocalSide) ||
          (record.isLocalSide === existing.isLocalSide && record.size > existing.size));

      if (isNewer || isTiedButPreferred) {
        byConvId.set(conversationId, record);
      }
    }
  }

  return Array.from(byConvId.values()).sort((a, b) => {
    if (b.mtimeMs !== a.mtimeMs) return b.mtimeMs - a.mtimeMs;
    return a.conversationId.localeCompare(b.conversationId);
  });
}
