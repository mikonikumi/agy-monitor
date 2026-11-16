import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseContextLimitValue } from './discovery.mjs';

export const CONTEXT_LIMIT = 256_000;
export const AUTOCOMPACT_BUFFER = 6_000;
export const SAFE_LIMIT = 250_000;
export const WARNING_THRESHOLD = 204_800; // 80% of 256,000
export const CRITICAL_THRESHOLD = 235_520; // 92% of 256,000
export const MEDIA_TOKEN_WEIGHT = 258;

const RULE_FILE_BYTE_CAP = 24_000;
const STATIC_HEURISTIC_CAP_RATIO = 0.85;
const DEFAULT_MAX_TOP_SPIKES = 15;

const CATEGORY_DEFS = [
  { id: 'rules', label: 'Rules 规则文件' },
  { id: 'system', label: 'System 底座与内置工具' },
  { id: 'mcp', label: 'MCP 工具' },
  { id: 'skills', label: 'Skills 技能' },
  { id: 'messages', label: '对话消息与附件' },
  { id: 'toolResults', label: '工具调用结果' },
];

const CJK_CHAR_RE =
  /[\u2E80-\u2FFF\u3000-\u303F\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uAC00-\uD7AF\uF900-\uFAFF\uFE30-\uFE4F\uFF00-\uFFEF\u{20000}-\u{2FA1F}]/u;

/**
 * Estimate token count from text (or `{ cjkChars, asciiChars }` counts).
 * Uses 0.65 tok/char for CJK characters and 0.25 tok/char for non-CJK/ASCII.
 *
 * @param {string | { cjkChars?: number, asciiChars?: number, cjk?: number, ascii?: number } | null | undefined} input
 * @returns {number}
 */
export function estimateTextTokens(input) {
  if (!input) return 0;
  if (typeof input === 'object') {
    const cjk = Math.max(0, Number(input.cjkChars ?? input.cjk ?? 0) || 0);
    const ascii = Math.max(
      0,
      Number(input.asciiChars ?? input.otherChars ?? input.ascii ?? 0) || 0
    );
    if (cjk === 0 && ascii === 0) return 0;
    return Math.max(1, Math.round(cjk * 0.65 + ascii * 0.25));
  }
  if (typeof input !== 'string' || input.length === 0) return 0;

  let cjkChars = 0;
  let otherChars = 0;
  for (const ch of input) {
    if (CJK_CHAR_RE.test(ch)) {
      cjkChars++;
    } else {
      otherChars++;
    }
  }
  return Math.max(1, Math.round(cjkChars * 0.65 + otherChars * 0.25));
}

function normalizeFsPath(rawPath) {
  if (!rawPath || typeof rawPath !== 'string') return '';
  let p = rawPath.trim();
  if (!p) return '';
  if (p.startsWith('file://')) {
    try {
      p = fileURLToPath(p);
    } catch {
      p = decodeURIComponent(p.replace(/^file:\/\/\/?/, '/'));
    }
  }
  return p;
}

function normalizeMatchKey(rawPath) {
  if (!rawPath || typeof rawPath !== 'string') return '';
  return rawPath.trim().replace(/\\/g, '/').replace(/\/+/g, '/');
}

function safeRealpath(filePath) {
  try {
    return fs.realpathSync(filePath);
  } catch {
    return path.resolve(filePath);
  }
}

function safeStat(targetPath) {
  try {
    return fs.statSync(targetPath);
  } catch {
    return null;
  }
}

function isDir(targetPath) {
  const st = safeStat(targetPath);
  return Boolean(st && st.isDirectory());
}

function isFile(targetPath) {
  const st = safeStat(targetPath);
  return Boolean(st && st.isFile());
}

function safeReadUtf8(filePath, maxBytes = 0) {
  try {
    const buf = fs.readFileSync(filePath);
    if (maxBytes > 0 && buf.length > maxBytes) {
      return {
        text: buf.subarray(0, maxBytes).toString('utf8'),
        bytes: maxBytes,
        totalBytes: buf.length,
      };
    }
    return {
      text: buf.toString('utf8'),
      bytes: buf.length,
      totalBytes: buf.length,
    };
  } catch {
    return null;
  }
}

function safeReadDirNames(dirPath) {
  try {
    return fs.readdirSync(dirPath);
  } catch {
    return [];
  }
}

function parseYamlFrontmatter(markdown) {
  if (typeof markdown !== 'string') {
    return { frontmatter: {}, body: '' };
  }
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) {
    return { frontmatter: {}, body: markdown };
  }
  const yamlBlock = match[1];
  const body = markdown.slice(match[0].length);
  const frontmatter = {};

  const lines = yamlBlock.split(/\r?\n/);
  let currentKey = null;
  let blockMode = null; // '>' or '|'
  let blockLines = [];

  const flushBlock = () => {
    if (currentKey) {
      const joined =
        blockMode === '|'
          ? blockLines.join('\n').trim()
          : blockLines.map((l) => l.trim()).filter(Boolean).join(' ');
      frontmatter[currentKey] = joined;
    }
    currentKey = null;
    blockMode = null;
    blockLines = [];
  };

  for (const line of lines) {
    if (currentKey && (/^\s+/.test(line) || line.trim() === '')) {
      blockLines.push(line);
      continue;
    }
    if (currentKey) {
      flushBlock();
    }
    const kv = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
    if (!kv) continue;
    const [, key, rawVal] = kv;
    const trimmed = rawVal.trim();
    if (/^[>|][-+]?$/.test(trimmed)) {
      currentKey = key;
      blockMode = trimmed[0];
      blockLines = [];
    } else {
      frontmatter[key] = trimmed.replace(/^['"]|['"]$/g, '');
    }
  }
  if (currentKey) {
    flushBlock();
  }

  return { frontmatter, body };
}

function resolveGeminiRoots(geminiDir, homeDir) {
  const effectiveHome = homeDir || os.homedir();
  const rawGemini = normalizeFsPath(geminiDir) || path.join(effectiveHome, '.gemini');
  const baseName = path.basename(rawGemini);

  let rootGeminiDir = rawGemini;
  const appDirs = new Set();

  if (
    /^(antigravity|antigravity-ide|antigravity-cli)$/i.test(baseName) &&
    (path.basename(path.dirname(rawGemini)) === '.gemini' ||
      isDir(path.join(path.dirname(rawGemini), 'config')))
  ) {
    rootGeminiDir = path.dirname(rawGemini);
    appDirs.add(rawGemini);
  }

  for (const entry of safeReadDirNames(rootGeminiDir)) {
    if (entry.endsWith('-backup')) continue;
    if (/^antigravity(-ide|-cli)?$/i.test(entry)) {
      const candidate = path.join(rootGeminiDir, entry);
      if (isDir(candidate)) {
        appDirs.add(candidate);
      }
    }
  }

  // Support flat test fixtures where builtin/ or mcp/ sits directly under geminiDir
  if (isDir(path.join(rawGemini, 'builtin')) || isDir(path.join(rawGemini, 'mcp'))) {
    appDirs.add(rawGemini);
  }

  return { rootGeminiDir, appDirs: [...appDirs] };
}

function loadDisabledPluginsInfo(rootGeminiDir) {
  const disabledNames = new Set();
  const disabledMcpDirs = new Set();
  const configJsonPath = path.join(rootGeminiDir, 'config', 'config.json');
  const read = safeReadUtf8(configJsonPath);
  if (!read) {
    return { disabledNames, disabledMcpDirs };
  }
  try {
    const parsed = JSON.parse(read.text);
    const plugins = parsed?.plugins;
    if (plugins && typeof plugins === 'object') {
      for (const [pluginName, meta] of Object.entries(plugins)) {
        if (meta && meta.enabled === false) {
          disabledNames.add(pluginName);
          disabledMcpDirs.add(pluginName);
          // Inspect disabled plugin's mcp_config.json to map `<plugin>_<server>`
          const pluginMcpPath = path.join(
            rootGeminiDir,
            'config',
            'plugins',
            pluginName,
            'mcp_config.json'
          );
          const pmRead = safeReadUtf8(pluginMcpPath);
          if (pmRead) {
            try {
              const pmJson = JSON.parse(pmRead.text);
              for (const srvName of Object.keys(pmJson?.mcpServers || {})) {
                disabledMcpDirs.add(`${pluginName}_${srvName}`);
              }
            } catch {
              // Ignore malformed plugin mcp_config.json
            }
          }
        }
      }
    }
  } catch {
    // Ignore malformed config.json
  }
  return { disabledNames, disabledMcpDirs };
}

function getWorkspaceChain(workspacePath) {
  const cleanWs = normalizeFsPath(workspacePath);
  if (!cleanWs || !isDir(cleanWs)) return [];

  const resolvedWs = path.resolve(cleanWs);
  // Check if an ancestor up to 8 levels contains `.git`
  const ancestors = [];
  let cur = resolvedWs;
  let gitRootIdx = -1;
  for (let depth = 0; depth < 8; depth++) {
    ancestors.push(cur);
    if (fs.existsSync(path.join(cur, '.git'))) {
      gitRootIdx = depth;
      break;
    }
    const parent = path.dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }

  if (gitRootIdx >= 0) {
    // Return from repo root down to workspacePath (or workspacePath up; deduplicated anyway)
    return ancestors.slice(0, gitRootIdx + 1);
  }
  return [resolvedWs];
}

/**
 * Scan active workspace + global customizations (`Rules`, `MCP`, `Skills`)
 * and deferred items (`Lazy MCP`, full `SKILL.md` bodies).
 *
 * @param {object} [options]
 * @param {string} [options.workspacePath]
 * @param {string} [options.geminiDir]
 * @param {string} [options.homeDir]
 */
export function scanWorkspaceAndGlobalCustomizations(options = {}) {
  const workspacePath = normalizeFsPath(options.workspacePath);
  const { rootGeminiDir, appDirs } = resolveGeminiRoots(
    options.geminiDir,
    options.homeDir
  );
  const { disabledNames, disabledMcpDirs } = loadDisabledPluginsInfo(rootGeminiDir);
  const workspaceDirs = getWorkspaceChain(workspacePath);
  const primaryWorkspace = workspaceDirs[0] || '';

  // --- 1. Scan Rules ---
  const rules = [];
  const seenRulePaths = new Set();

  const addRuleFile = (filePath, scope, checkTrigger = false) => {
    if (!isFile(filePath)) return;
    const real = safeRealpath(filePath);
    if (seenRulePaths.has(real)) return;
    const read = safeReadUtf8(filePath, RULE_FILE_BYTE_CAP);
    if (!read) return;

    if (checkTrigger) {
      const { frontmatter } = parseYamlFrontmatter(read.text);
      if (
        frontmatter.trigger &&
        frontmatter.trigger !== 'always_on' &&
        frontmatter.trigger !== 'always'
      ) {
        return;
      }
    }

    seenRulePaths.add(real);
    let displayName = path.basename(filePath);
    if (scope === 'workspace' && primaryWorkspace) {
      const rel = path.relative(primaryWorkspace, filePath).replace(/\\/g, '/');
      if (rel && !rel.startsWith('..')) {
        displayName = rel;
      }
    } else if (scope.startsWith('plugin:')) {
      displayName = `${scope.slice(7)}/${path.basename(filePath)}`;
    }

    const estimatedTokens = estimateTextTokens(read.text);
    rules.push({
      name: displayName,
      path: filePath,
      scope: scope.startsWith('plugin:') ? 'plugin' : scope,
      bytes: read.bytes,
      estimatedTokens,
    });
  };

  // Workspace rules (walk workspace chain)
  for (const dir of workspaceDirs) {
    addRuleFile(path.join(dir, 'AGENTS.md'), 'workspace', false);
    addRuleFile(path.join(dir, 'GEMINI.md'), 'workspace', false);
    for (const agentFolder of ['.agents', '.agent', '_agents', '_agent']) {
      const rulesDir = path.join(dir, agentFolder, 'rules');
      if (isDir(rulesDir)) {
        for (const f of safeReadDirNames(rulesDir).sort()) {
          if (f.toLowerCase().endsWith('.md')) {
            addRuleFile(path.join(rulesDir, f), 'workspace', true);
          }
        }
      }
    }
  }

  // Global rules
  for (const globalDir of [path.join(rootGeminiDir, 'config'), rootGeminiDir]) {
    addRuleFile(path.join(globalDir, 'AGENTS.md'), 'global', false);
    addRuleFile(path.join(globalDir, 'GEMINI.md'), 'global', false);
    const rulesDir = path.join(globalDir, 'rules');
    if (isDir(rulesDir)) {
      for (const f of safeReadDirNames(rulesDir).sort()) {
        if (f.toLowerCase().endsWith('.md')) {
          addRuleFile(path.join(rulesDir, f), 'global', true);
        }
      }
    }
  }

  // Enabled plugin rules (global + builtin)
  const pluginRoots = [
    path.join(rootGeminiDir, 'config', 'plugins'),
    ...appDirs.map((d) => path.join(d, 'builtin', 'plugins')),
  ];
  for (const pRoot of pluginRoots) {
    if (!isDir(pRoot)) continue;
    for (const pluginName of safeReadDirNames(pRoot).sort()) {
      if (disabledNames.has(pluginName)) continue;
      const rulesDir = path.join(pRoot, pluginName, 'rules');
      if (!isDir(rulesDir)) continue;
      for (const f of safeReadDirNames(rulesDir).sort()) {
        if (f.toLowerCase().endsWith('.md')) {
          addRuleFile(path.join(rulesDir, f), `plugin:${pluginName}`, true);
        }
      }
    }
  }

  // --- 2. Scan Skills ---
  const skills = [];
  const seenSkillRealpaths = new Set();
  const seenSkillNames = new Set();

  const addSkillsFromParentDir = (skillsParentDir, scope) => {
    if (!isDir(skillsParentDir)) return;
    for (const folder of safeReadDirNames(skillsParentDir).sort()) {
      const skillDir = path.join(skillsParentDir, folder);
      if (!isDir(skillDir)) continue;
      const skillMdPath = path.join(skillDir, 'SKILL.md');
      if (!isFile(skillMdPath)) continue;

      const real = safeRealpath(skillMdPath);
      if (seenSkillRealpaths.has(real)) continue;

      const read = safeReadUtf8(skillMdPath);
      if (!read) continue;

      const { frontmatter, body } = parseYamlFrontmatter(read.text);
      const skillName = (frontmatter.name || folder).trim();
      const nameKey = skillName.toLowerCase();
      if (seenSkillNames.has(nameKey)) continue;

      seenSkillRealpaths.add(real);
      seenSkillNames.add(nameKey);

      const description = (frontmatter.description || '').trim();
      const summaryLine = `- ${skillName} (${skillMdPath}): ${description}`;
      const summaryTokens = estimateTextTokens(summaryLine);
      const fullTokens = estimateTextTokens(read.text);
      const bodyEstimate = body.trim()
        ? estimateTextTokens(body)
        : Math.max(0, fullTokens - summaryTokens);
      const deferredBodyTokens = Math.max(
        bodyEstimate,
        Math.max(0, fullTokens - summaryTokens)
      );

      skills.push({
        name: skillName,
        folderName: folder,
        path: skillMdPath,
        realpath: real,
        scope,
        description,
        summaryTokens,
        fullTokens: Math.max(fullTokens, summaryTokens),
        bodyTokens: deferredBodyTokens,
      });
    }
  };

  // Priority order: Workspace > Global > Enabled Plugins > Builtin
  for (const dir of workspaceDirs) {
    for (const agentFolder of ['.agents', '.agent', '_agents', '_agent']) {
      addSkillsFromParentDir(path.join(dir, agentFolder, 'skills'), 'workspace');
    }
    addSkillsFromParentDir(path.join(dir, 'skills'), 'workspace');
  }

  addSkillsFromParentDir(path.join(rootGeminiDir, 'config', 'skills'), 'global');
  addSkillsFromParentDir(path.join(rootGeminiDir, 'skills'), 'global');

  for (const pRoot of pluginRoots) {
    if (!isDir(pRoot)) continue;
    for (const pluginName of safeReadDirNames(pRoot).sort()) {
      if (disabledNames.has(pluginName)) continue;
      addSkillsFromParentDir(path.join(pRoot, pluginName, 'skills'), 'plugin');
    }
  }

  for (const appDir of appDirs) {
    addSkillsFromParentDir(path.join(appDir, 'builtin', 'skills'), 'builtin');
  }

  // --- 3. Scan MCP (Lazy cached tool definitions + Configured MCP servers) ---
  const lazyMcpByDir = new Map();
  const mcpRootCandidates = new Set([
    ...appDirs.map((d) => path.join(d, 'mcp')),
    path.join(rootGeminiDir, 'mcp'),
  ]);

  // First collect configured MCP servers so we know global/workspace/plugin server names
  const configuredServers = [];
  const seenConfiguredKeys = new Set();

  const collectMcpConfigFile = (mcpConfigPath, scope, pluginName = '') => {
    if (!isFile(mcpConfigPath)) return;
    const read = safeReadUtf8(mcpConfigPath);
    if (!read) return;
    try {
      const parsed = JSON.parse(read.text);
      const serversObj = parsed?.mcpServers;
      if (!serversObj || typeof serversObj !== 'object') return;
      for (const [srvName, srvCfg] of Object.entries(serversObj)) {
        if (!srvCfg || typeof srvCfg !== 'object') continue;
        if (srvCfg.disabled === true || srvCfg.enabled === false) continue;
        const dedupKey = pluginName ? `${pluginName}:${srvName}` : srvName;
        if (seenConfiguredKeys.has(dedupKey)) continue;
        seenConfiguredKeys.add(dedupKey);
        configuredServers.push({
          serverName: srvName,
          pluginName,
          scope,
          config: srvCfg,
          configPath: mcpConfigPath,
        });
      }
    } catch {
      // Ignore malformed JSON
    }
  };

  for (const dir of workspaceDirs) {
    collectMcpConfigFile(path.join(dir, 'mcp_config.json'), 'workspace');
    for (const agentFolder of ['.agents', '.agent', '_agents', '_agent']) {
      collectMcpConfigFile(
        path.join(dir, agentFolder, 'mcp_config.json'),
        'workspace'
      );
    }
  }
  collectMcpConfigFile(path.join(rootGeminiDir, 'config', 'mcp_config.json'), 'global');
  collectMcpConfigFile(path.join(rootGeminiDir, 'mcp_config.json'), 'global');

  for (const pRoot of pluginRoots) {
    if (!isDir(pRoot)) continue;
    for (const pluginName of safeReadDirNames(pRoot).sort()) {
      if (disabledNames.has(pluginName)) continue;
      collectMcpConfigFile(
        path.join(pRoot, pluginName, 'mcp_config.json'),
        'plugin',
        pluginName
      );
    }
  }

  const activeServerNames = new Set(configuredServers.map((s) => s.serverName));

  for (const mcpRoot of mcpRootCandidates) {
    if (!isDir(mcpRoot)) continue;
    for (const serverDirName of safeReadDirNames(mcpRoot).sort()) {
      if (
        disabledMcpDirs.has(serverDirName) &&
        !activeServerNames.has(serverDirName)
      ) {
        continue;
      }
      const serverDirPath = path.join(mcpRoot, serverDirName);
      if (!isDir(serverDirPath)) continue;

      let entry = lazyMcpByDir.get(serverDirName);
      if (!entry) {
        entry = {
          dirName: serverDirName,
          serverName: serverDirName,
          path: serverDirPath,
          toolFiles: new Map(),
          instructionsTokens: 0,
        };
        lazyMcpByDir.set(serverDirName, entry);
      }

      const instrPath = path.join(serverDirPath, 'instructions.md');
      if (entry.instructionsTokens === 0 && isFile(instrPath)) {
        const instrRead = safeReadUtf8(instrPath);
        if (instrRead) {
          entry.instructionsTokens = estimateTextTokens(instrRead.text);
        }
      }

      for (const fileName of safeReadDirNames(serverDirPath).sort()) {
        if (!fileName.toLowerCase().endsWith('.json')) continue;
        if (entry.toolFiles.has(fileName)) continue;
        const fullToolPath = path.join(serverDirPath, fileName);
        if (!isFile(fullToolPath)) continue;
        const toolRead = safeReadUtf8(fullToolPath);
        if (!toolRead) continue;

        let toolName = fileName.replace(/\.json$/i, '');
        try {
          const parsedTool = JSON.parse(toolRead.text);
          if (typeof parsedTool?.name === 'string' && parsedTool.name.trim()) {
            toolName = parsedTool.name.trim();
          }
        } catch {
          // Keep filename-derived toolName
        }

        entry.toolFiles.set(fileName, {
          toolName,
          filePath: fullToolPath,
          realpath: safeRealpath(fullToolPath),
          estimatedTokens: estimateTextTokens(toolRead.text),
        });
      }
    }
  }

  // Match configured servers with lazy cache dirs vs eager servers
  const eagerMcpServers = [];
  const lazyMcpServers = [];
  const matchedLazyDirs = new Set();

  const findMatchingLazyDir = (srv) => {
    const candidates = [];
    if (srv.pluginName) {
      candidates.push(`${srv.pluginName}_${srv.serverName}`);
    }
    candidates.push(srv.serverName);
    candidates.push(`${srv.serverName}_${srv.serverName}`);
    for (const c of candidates) {
      if (lazyMcpByDir.has(c)) return lazyMcpByDir.get(c);
    }
    for (const [dirName, item] of lazyMcpByDir.entries()) {
      if (dirName.endsWith(`_${srv.serverName}`)) return item;
    }
    return null;
  };

  for (const srv of configuredServers) {
    const cfg = srv.config;
    const explicitEager =
      cfg.eager === true ||
      cfg.lazy === false ||
      (Array.isArray(cfg.tools) && cfg.tools.length > 0);
    const lazyMatch = !explicitEager ? findMatchingLazyDir(srv) : null;

    if (lazyMatch && lazyMatch.toolFiles.size > 0) {
      matchedLazyDirs.add(lazyMatch.dirName);
      const toolList = [...lazyMatch.toolFiles.values()];
      const lazyTokens = toolList.reduce((s, t) => s + t.estimatedTokens, 0);
      const pointerTokens =
        lazyMatch.instructionsTokens +
        estimateTextTokens(`${srv.serverName}: ${lazyMatch.path}`);

      lazyMcpServers.push({
        name: srv.serverName,
        serverName: srv.serverName,
        dirName: lazyMatch.dirName,
        scope: srv.scope,
        mode: 'lazy',
        path: lazyMatch.path,
        toolCount: toolList.length,
        tools: toolList.map((t) => t.toolName),
        toolEntries: toolList,
        estimatedTokens: lazyTokens,
        pointerTokens,
      });

      if (pointerTokens > 0) {
        eagerMcpServers.push({
          name: srv.serverName,
          serverName: srv.serverName,
          scope: srv.scope,
          mode: 'lazy',
          path: lazyMatch.path,
          toolCount: toolList.length,
          estimatedTokens: pointerTokens,
          deferredTokens: lazyTokens,
          isPointerForLazy: true,
        });
      }
    } else {
      // Eagerly mounted MCP server
      let eagerEst = 0;
      let toolCount = 0;
      if (typeof cfg.estimatedTokens === 'number' && cfg.estimatedTokens >= 0) {
        eagerEst = Math.round(cfg.estimatedTokens);
        toolCount = Array.isArray(cfg.tools) ? cfg.tools.length : Number(cfg.toolCount || 1);
      } else if (Array.isArray(cfg.tools) && cfg.tools.length > 0) {
        eagerEst = estimateTextTokens(JSON.stringify(cfg.tools));
        toolCount = cfg.tools.length;
      } else {
        eagerEst =
          estimateTextTokens(JSON.stringify({ [srv.serverName]: cfg })) + 80;
        toolCount = Number(cfg.toolCount || 0);
      }

      eagerMcpServers.push({
        name: srv.serverName,
        serverName: srv.serverName,
        scope: srv.scope,
        mode: 'eager',
        path: srv.configPath,
        toolCount,
        estimatedTokens: eagerEst,
        deferredTokens: 0,
        isPointerForLazy: false,
      });
    }
  }

  // Include any remaining cached lazy MCP directories on disk that weren't in mcp_config.json
  for (const [dirName, lazyEntry] of lazyMcpByDir.entries()) {
    if (matchedLazyDirs.has(dirName)) continue;
    if (lazyEntry.toolFiles.size === 0) continue;
    const toolList = [...lazyEntry.toolFiles.values()];
    const lazyTokens = toolList.reduce((s, t) => s + t.estimatedTokens, 0);
    const cleanName = dirName.includes('_')
      ? dirName.split('_').slice(1).join('_') || dirName
      : dirName;
    const pointerTokens =
      lazyEntry.instructionsTokens +
      estimateTextTokens(`${cleanName}: ${lazyEntry.path}`);

    lazyMcpServers.push({
      name: cleanName,
      serverName: cleanName,
      dirName,
      scope: 'global',
      mode: 'lazy',
      path: lazyEntry.path,
      toolCount: toolList.length,
      tools: toolList.map((t) => t.toolName),
      toolEntries: toolList,
      estimatedTokens: lazyTokens,
      pointerTokens,
    });

    if (pointerTokens > 0) {
      eagerMcpServers.push({
        name: cleanName,
        serverName: cleanName,
        scope: 'global',
        mode: 'lazy',
        path: lazyEntry.path,
        toolCount: toolList.length,
        estimatedTokens: pointerTokens,
        deferredTokens: lazyTokens,
        isPointerForLazy: true,
      });
    }
  }

  const rulesHeuristicTokens = rules.reduce((s, r) => s + r.estimatedTokens, 0);
  const eagerMcpHeuristicTokens = eagerMcpServers.reduce(
    (s, m) => s + m.estimatedTokens,
    0
  );
  const skillsSummaryHeuristicTokens = skills.reduce(
    (s, sk) => s + sk.summaryTokens,
    0
  );

  return {
    workspacePath: primaryWorkspace || workspacePath || '',
    geminiDir: rootGeminiDir,
    rules,
    skills,
    eagerMcpServers,
    lazyMcpServers,
    heuristics: {
      rulesTokens: rulesHeuristicTokens,
      mcpTokens: eagerMcpHeuristicTokens,
      skillsSummaryTokens: skillsSummaryHeuristicTokens,
    },
  };
}

function toNonNegInt(val) {
  const n = Number(val);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n);
}

function unwrapArgString(val) {
  if (typeof val !== 'string') return val == null ? '' : String(val);
  const trimmed = val.trim();
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed === 'string') return parsed;
    } catch {
      return trimmed.slice(1, -1);
    }
  }
  return trimmed;
}

function isSkillMdPath(targetPath) {
  if (!targetPath || typeof targetPath !== 'string') return false;
  const norm = normalizeMatchKey(unwrapArgString(targetPath));
  return /(^|\/)SKILL\.md$/i.test(norm);
}

function isReadLikeTool(toolName) {
  if (!toolName) return true;
  return /^(read_file|view_file|view_file_outline|read_resource|open_file)$/i.test(
    toolName.trim()
  );
}

function buildToolSummary(toolName, targetPath, explicitSummary, args = {}) {
  const cleanSummary = unwrapArgString(explicitSummary);
  if (cleanSummary) return cleanSummary;

  const argSummary = unwrapArgString(args.toolSummary || args.summary || '');
  if (argSummary) return argSummary;

  if (targetPath) {
    const norm = normalizeMatchKey(targetPath);
    const parts = norm.split('/').filter(Boolean);
    const shortPath =
      parts.length > 2 ? parts.slice(-2).join('/') : parts.join('/') || norm;
    const startLine = unwrapArgString(args.StartLine ?? args.startLine ?? '');
    const endLine = unwrapArgString(args.EndLine ?? args.endLine ?? '');
    if (startLine && endLine) {
      return `${shortPath}#L${startLine}-L${endLine}`;
    }
    return shortPath;
  }

  const query = unwrapArgString(args.query || args.Query || args.Pattern || '');
  if (query) {
    return query.length > 64 ? `${query.slice(0, 61)}...` : query;
  }

  const cmd = unwrapArgString(args.CommandLine || args.command || '');
  if (cmd) {
    const oneLine = cmd.replace(/\s+/g, ' ').trim();
    return oneLine.length > 64 ? `${oneLine.slice(0, 61)}...` : oneLine;
  }

  return toolName || 'tool_output';
}

function normalizeStep(rawStep, idx) {
  const s = rawStep && typeof rawStep === 'object' ? rawStep : {};
  const stepIndex = Number.isFinite(Number(s.stepIndex ?? s.step_index))
    ? Number(s.stepIndex ?? s.step_index)
    : idx;
  const type = String(s.type || '').trim().toUpperCase();
  const status = String(s.status || 'DONE').trim().toUpperCase();

  let inputTokens = toNonNegInt(s.inputTokens ?? s.input_tokens ?? 0);
  const cacheReadTokens = toNonNegInt(s.cacheReadTokens ?? s.cache_read_tokens ?? 0);
  const outputTokens = toNonNegInt(s.outputTokens ?? s.output_tokens ?? 0);
  if (
    s.inputTokens == null &&
    s.input_tokens == null &&
    s.promptContextTokens != null
  ) {
    inputTokens = Math.max(0, toNonNegInt(s.promptContextTokens) - cacheReadTokens);
  }

  let textTokens = 0;
  if (typeof s.estimatedTokens === 'number' && Number.isFinite(s.estimatedTokens)) {
    textTokens = Math.max(0, Math.round(s.estimatedTokens));
  } else if (typeof s.content === 'string' && s.content.length > 0) {
    textTokens = estimateTextTokens(s.content);
  } else if (s.charEstimate && typeof s.charEstimate === 'object') {
    if (typeof s.charEstimate.tokens === 'number') {
      textTokens = Math.max(0, Math.round(s.charEstimate.tokens));
    } else {
      textTokens = estimateTextTokens(s.charEstimate);
    }
  } else if (typeof s.charEstimate === 'number' && s.charEstimate > 0) {
    textTokens = Math.max(1, Math.round(s.charEstimate * 0.25));
  }

  const mediaCount =
    typeof s.mediaCount === 'number' && Number.isFinite(s.mediaCount)
      ? Math.max(0, Math.floor(s.mediaCount))
      : Array.isArray(s.media)
        ? s.media.length
        : 0;

  const rawToolCalls = Array.isArray(s.toolCalls)
    ? s.toolCalls
    : Array.isArray(s.tool_calls)
      ? s.tool_calls
      : [];

  const toolCalls = rawToolCalls.map((tc) => {
    const obj = tc && typeof tc === 'object' ? tc : {};
    const args = obj.args && typeof obj.args === 'object' ? obj.args : {};
    const name = unwrapArgString(obj.name || obj.toolName || obj.tool || 'tool');
    const targetPath = unwrapArgString(
      obj.targetPath ||
        obj.path ||
        args.Path ||
        args.path ||
        args.TargetFile ||
        args.target_file ||
        args.File ||
        args.file ||
        args.Uri ||
        args.uri ||
        args.Directory ||
        args.SearchPath ||
        ''
    );
    const summary = buildToolSummary(name, targetPath, obj.summary, args);
    const skillRead =
      Boolean(obj.isSkillRead) ||
      Boolean(obj.skillPath) ||
      (isReadLikeTool(name) && isSkillMdPath(targetPath));
    const skillPath = skillRead
      ? unwrapArgString(obj.skillPath || targetPath)
      : '';
    return {
      name,
      targetPath,
      summary,
      isSkillRead: skillRead,
      skillPath,
    };
  });

  const explicitToolName = unwrapArgString(s.toolName || '');
  const explicitTargetPath = unwrapArgString(s.targetPath || s.skillPath || '');
  const explicitSummary = unwrapArgString(s.summary || '');
  const explicitIsSkillRead =
    Boolean(s.isSkillRead) ||
    Boolean(s.skillPath) ||
    (Boolean(explicitTargetPath) &&
      isReadLikeTool(explicitToolName) &&
      isSkillMdPath(explicitTargetPath));
  const explicitSkillPath = explicitIsSkillRead
    ? unwrapArgString(s.skillPath || explicitTargetPath)
    : '';

  const createdAt =
    s.isoTime ||
    s.createdAt ||
    s.created_at ||
    (typeof s.createdAtMs === 'number' && Number.isFinite(s.createdAtMs)
      ? new Date(s.createdAtMs).toISOString()
      : null);

  const isTruncated =
    Boolean(s.isTruncated) ||
    (Array.isArray(s.truncated_fields) && s.truncated_fields.includes('content')) ||
    (Array.isArray(s.truncatedFields) && s.truncatedFields.includes('content'));

  return {
    stepIndex,
    type,
    status,
    inputTokens,
    cacheReadTokens,
    outputTokens,
    promptTokens: inputTokens + cacheReadTokens,
    textTokens,
    mediaCount,
    isTruncated,
    toolCalls,
    explicitToolName,
    explicitTargetPath,
    explicitSummary,
    explicitIsSkillRead,
    explicitSkillPath,
    createdAt,
  };
}

function isValidPlannerStep(st) {
  if (st.type !== 'PLANNER_RESPONSE') return false;
  if (
    st.status === 'ERROR' &&
    st.inputTokens + st.cacheReadTokens + st.outputTokens === 0
  ) {
    return false;
  }
  return true;
}

function splitStaticBase(cBase, heuristics) {
  const safeBase = Math.max(0, cBase);
  if (safeBase === 0) {
    return { rules: 0, mcp: 0, skills: 0, system: 0 };
  }
  const hRules = Math.max(0, heuristics.rulesTokens || 0);
  const hMcp = Math.max(0, heuristics.mcpTokens || 0);
  const hSkills = Math.max(0, heuristics.skillsSummaryTokens || 0);
  const hSum = hRules + hMcp + hSkills;
  const maxHeuristic = safeBase * STATIC_HEURISTIC_CAP_RATIO;

  if (hSum > maxHeuristic && hSum > 0) {
    const scale = maxHeuristic / hSum;
    const rules = hRules * scale;
    const mcp = hMcp * scale;
    const skills = hSkills * scale;
    const system = Math.max(0, safeBase - (rules + mcp + skills));
    return { rules, mcp, skills, system };
  }

  return {
    rules: hRules,
    mcp: hMcp,
    skills: hSkills,
    system: Math.max(0, safeBase - hSum),
  };
}

/**
 * Largest Remainder Method (Hamilton apportionment) guaranteeing:
 * 1. Every category token value is an integer >= 0.
 * 2. Categories with 0 raw weight stay strictly 0.
 * 3. Sum across all 6 categories === targetTotal ALWAYS.
 */
function conserveCategoryIntegers(rawMap, targetTotal) {
  const total = toNonNegInt(targetTotal);
  const ids = CATEGORY_DEFS.map((c) => c.id);
  const result = {};

  if (total === 0) {
    for (const id of ids) result[id] = 0;
    return result;
  }

  const clamped = {};
  let rawSum = 0;
  for (const id of ids) {
    const v = Number(rawMap[id]);
    const clean = Number.isFinite(v) && v > 0 ? v : 0;
    clamped[id] = clean;
    rawSum += clean;
  }

  if (rawSum <= 0) {
    for (const id of ids) result[id] = 0;
    result.system = total;
    return result;
  }

  const scale = total / rawSum;
  const items = ids.map((id, orderIdx) => {
    const exact = clamped[id] * scale;
    const floored = Math.floor(exact);
    return {
      id,
      orderIdx,
      exact,
      floored,
      frac: exact - floored,
    };
  });

  let currentSum = items.reduce((s, it) => s + it.floored, 0);
  let remainder = total - currentSum;

  // Sort by descending fractional remainder; tie-break by descending exact magnitude
  const sorted = [...items].sort((a, b) => {
    if (b.frac !== a.frac) return b.frac - a.frac;
    if (b.exact !== a.exact) return b.exact - a.exact;
    return a.orderIdx - b.orderIdx;
  });

  let idx = 0;
  while (remainder > 0 && sorted.length > 0) {
    sorted[idx % sorted.length].floored += 1;
    remainder -= 1;
    idx += 1;
  }
  while (remainder < 0) {
    const candidate = [...items]
      .reverse()
      .find((it) => it.floored > 0);
    if (!candidate) break;
    candidate.floored -= 1;
    remainder += 1;
  }

  for (const it of items) {
    result[it.id] = Math.max(0, it.floored);
  }
  return result;
}

function allocateProportionalIntegers(weights, targetTotal) {
  const total = toNonNegInt(targetTotal);
  if (weights.length === 0) return [];
  if (total === 0) return weights.map(() => 0);

  const clean = weights.map((w) => (Number.isFinite(w) && w > 0 ? w : 0));
  const wSum = clean.reduce((s, v) => s + v, 0);
  if (wSum <= 0) {
    const base = Math.floor(total / weights.length);
    let rem = total - base * weights.length;
    return weights.map(() => {
      const add = rem > 0 ? 1 : 0;
      if (rem > 0) rem--;
      return base + add;
    });
  }

  const scale = total / wSum;
  const entries = clean.map((w, i) => {
    const exact = w * scale;
    const floored = Math.floor(exact);
    return { i, exact, floored, frac: exact - floored };
  });
  let rem = total - entries.reduce((s, e) => s + e.floored, 0);
  const byFrac = [...entries].sort(
    (a, b) => b.frac - a.frac || b.exact - a.exact || a.i - b.i
  );
  let k = 0;
  while (rem > 0 && byFrac.length > 0) {
    byFrac[k % byFrac.length].floored += 1;
    rem -= 1;
    k += 1;
  }
  return entries.map((e) => e.floored);
}

function extractSkillNameFromPath(skillPath) {
  const norm = normalizeMatchKey(skillPath);
  const parts = norm.split('/').filter(Boolean);
  if (parts.length >= 2 && /^skill\.md$/i.test(parts[parts.length - 1])) {
    return parts[parts.length - 2];
  }
  return parts[parts.length - 1] || 'unknown-skill';
}

function matchDiscoveredSkill(readSkillPath, discoveredSkills) {
  if (!readSkillPath) return null;
  const normRead = normalizeMatchKey(readSkillPath);
  const lowerRead = normRead.toLowerCase();

  for (const sk of discoveredSkills) {
    const normSk = normalizeMatchKey(sk.path);
    const normReal = normalizeMatchKey(sk.realpath);
    if (
      normSk.toLowerCase() === lowerRead ||
      (normReal && normReal.toLowerCase() === lowerRead)
    ) {
      return sk;
    }
  }

  const folderName = extractSkillNameFromPath(normRead).toLowerCase();
  if (folderName) {
    for (const sk of discoveredSkills) {
      if (
        sk.name.toLowerCase() === folderName ||
        (sk.folderName && sk.folderName.toLowerCase() === folderName)
      ) {
        return sk;
      }
    }
  }
  return null;
}

function readWorkspaceContextLimit(workspacePath) {
  const ws = normalizeFsPath(workspacePath);
  if (!ws) return null;
  const cfgPath = path.join(ws, '.antigravity', 'settings.json');
  try {
    if (!isFile(cfgPath)) return null;
    const parsed = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    return parseContextLimitValue(
      parsed?.contextWindow ?? parsed?.context_window ?? parsed?.contextLimit,
    );
  } catch {
    return null;
  }
}

export function resolveContextWindowCapacity(rawLimit, workspacePath = '', rawBuffer = AUTOCOMPACT_BUFFER) {
  const explicitLimit =
    parseContextLimitValue(rawLimit) || readWorkspaceContextLimit(workspacePath) || CONTEXT_LIMIT;
  const parsedBuf = Number(rawBuffer);
  const autocompactBuffer = Number.isFinite(parsedBuf) && parsedBuf >= 0
    ? Math.min(Math.round(parsedBuf), Math.floor(explicitLimit * 0.2))
    : Math.min(AUTOCOMPACT_BUFFER, Math.floor(explicitLimit * 0.2));
  const safeLimit = Math.max(0, explicitLimit - autocompactBuffer);
  return {
    limit: explicitLimit,
    autocompactBuffer,
    safeLimit,
    warningThreshold: Math.round(explicitLimit * 0.8),
    criticalThreshold: Math.round(explicitLimit * 0.92),
  };
}

/**
 * Compute exact context breakdown anchored to the detected window limit using Static Base Lock + Step Delta attribution.
 *
 * @param {object} [params]
 * @param {Array<object>} [params.steps]
 * @param {string} [params.workspacePath]
 * @param {string} [params.geminiDir]
 * @param {number | string} [params.contextLimit]
 * @param {object} [params.options]
 */
export function computeContextBreakdown(params = {}) {
  const {
    steps: rawSteps = [],
    workspacePath,
    geminiDir,
    contextLimit,
    options = {},
    ...restTopLevel
  } = params || {};

  const mergedOpts = {
    ...restTopLevel,
    ...(options && typeof options === 'object' ? options : {}),
    workspacePath: workspacePath ?? options?.workspacePath,
    geminiDir: geminiDir ?? options?.geminiDir,
    contextLimit: contextLimit ?? options?.contextLimit,
  };

  const capacity = resolveContextWindowCapacity(
    mergedOpts.contextLimit,
    mergedOpts.workspacePath,
    mergedOpts.autocompactBuffer,
  );

  const customizations =
    mergedOpts.customizations ||
    scanWorkspaceAndGlobalCustomizations({
      workspacePath: mergedOpts.workspacePath,
      geminiDir: mergedOpts.geminiDir,
      homeDir: mergedOpts.homeDir,
    });

  const normalizedSteps = Array.isArray(rawSteps)
    ? rawSteps.map((s, idx) => normalizeStep(s, idx))
    : [];

  // Locate first CHECKPOINT and last CHECKPOINT to isolate current compaction cycle
  let firstCheckpointIdx = -1;
  let lastCheckpointIdx = -1;
  for (let i = 0; i < normalizedSteps.length; i++) {
    if (normalizedSteps[i].type === 'CHECKPOINT') {
      if (firstCheckpointIdx === -1) firstCheckpointIdx = i;
      lastCheckpointIdx = i;
    }
  }

  const hasCheckpoint = lastCheckpointIdx !== -1;
  const preCheckpointSlice = hasCheckpoint
    ? normalizedSteps.slice(0, firstCheckpointIdx)
    : [];
  const cycleSteps = hasCheckpoint
    ? normalizedSteps.slice(lastCheckpointIdx + 1)
    : normalizedSteps;

  // Identify completed PLANNER_RESPONSE steps in the active cycle
  const cyclePlannerPositions = [];
  for (let i = 0; i < cycleSteps.length; i++) {
    if (isValidPlannerStep(cycleSteps[i])) {
      cyclePlannerPositions.push(i);
    }
  }

  const maxTopSpikes = Number(mergedOpts.maxTopSpikes ?? DEFAULT_MAX_TOP_SPIKES);

  // If no completed PLANNER_RESPONSE exists in the active cycle yet -> usedTokens = 0
  if (cyclePlannerPositions.length === 0) {
    return buildBreakdownResult({
      usedTokens: 0,
      conserved: {
        rules: 0,
        system: 0,
        mcp: 0,
        skills: 0,
        messages: 0,
        toolResults: 0,
      },
      customizations,
      activatedSkillTokenMap: new Map(),
      virtualActivatedSkills: new Map(),
      readFilePathsInCycle: new Set(),
      topSpikes: [],
      maxTopSpikes,
      capacity,
    });
  }

  const firstActivePos = cyclePlannerPositions[0];
  const lastActivePos = cyclePlannerPositions[cyclePlannerPositions.length - 1];
  const pFirstActive = cycleSteps[firstActivePos];
  const pLastActive = cycleSteps[lastActivePos];

  const usedTokens = Math.max(
    0,
    pLastActive.inputTokens + pLastActive.cacheReadTokens + pLastActive.outputTokens
  );

  // --- Step 4: Determine Static Base (C_base) ---
  let baseStatic = { rules: 0, mcp: 0, skills: 0, system: 0 };
  let initialMessages = 0;

  if (!hasCheckpoint) {
    let initialUserEst = 0;
    for (let i = 0; i < firstActivePos; i++) {
      const st = cycleSteps[i];
      if (st.type === 'USER_INPUT' || st.type === 'SYSTEM_MESSAGE') {
        initialUserEst += st.textTokens + st.mediaCount * MEDIA_TOKEN_WEIGHT;
      }
    }
    const clampedInitMsg = Math.min(pFirstActive.promptTokens, initialUserEst);
    const cBase = Math.max(0, pFirstActive.promptTokens - clampedInitMsg);
    baseStatic = splitStaticBase(cBase, customizations.heuristics);
    initialMessages = clampedInitMsg;
  } else {
    // Post-CHECKPOINT cycle: use pre-checkpoint P_1 if available to know true static C_base
    const preFirstPlannerIdx = preCheckpointSlice.findIndex(isValidPlannerStep);
    let cBaseOrig = 0;

    if (preFirstPlannerIdx !== -1) {
      const pOrig1 = preCheckpointSlice[preFirstPlannerIdx];
      let origUserEst = 0;
      for (let i = 0; i < preFirstPlannerIdx; i++) {
        const st = preCheckpointSlice[i];
        if (st.type === 'USER_INPUT' || st.type === 'SYSTEM_MESSAGE') {
          origUserEst += st.textTokens + st.mediaCount * MEDIA_TOKEN_WEIGHT;
        }
      }
      const clampedOrigMsg = Math.min(pOrig1.promptTokens, origUserEst);
      cBaseOrig = Math.max(0, pOrig1.promptTokens - clampedOrigMsg);
    } else {
      // Truncated log starting at CHECKPOINT without pre-checkpoint P_1
      const lastCheckpointStep = normalizedSteps[lastCheckpointIdx];
      let postSummaryEst = lastCheckpointStep.textTokens;
      for (let i = 0; i < firstActivePos; i++) {
        const st = cycleSteps[i];
        if (st.type === 'USER_INPUT' || st.type === 'SYSTEM_MESSAGE') {
          postSummaryEst += st.textTokens + st.mediaCount * MEDIA_TOKEN_WEIGHT;
        }
      }
      if (postSummaryEst > 0 && postSummaryEst < pFirstActive.promptTokens) {
        cBaseOrig = pFirstActive.promptTokens - postSummaryEst;
      } else {
        const hTotal =
          customizations.heuristics.rulesTokens +
          customizations.heuristics.mcpTokens +
          customizations.heuristics.skillsSummaryTokens;
        cBaseOrig = Math.min(
          pFirstActive.promptTokens,
          Math.max(hTotal, Math.round(pFirstActive.promptTokens * 0.65))
        );
      }
    }

    const origSplit = splitStaticBase(cBaseOrig, customizations.heuristics);
    const postFirstPrompt = pFirstActive.promptTokens;

    if (postFirstPrompt >= cBaseOrig) {
      baseStatic = origSplit;
      initialMessages = postFirstPrompt - cBaseOrig; // Compaction summary + initial prompt
    } else if (cBaseOrig > 0) {
      const scale = postFirstPrompt / cBaseOrig;
      baseStatic = {
        rules: origSplit.rules * scale,
        mcp: origSplit.mcp * scale,
        skills: origSplit.skills * scale,
        system: origSplit.system * scale,
      };
      initialMessages = 0;
    } else {
      baseStatic = { rules: 0, mcp: 0, skills: 0, system: postFirstPrompt };
      initialMessages = 0;
    }
  }

  // Track running raw category totals (static + dynamic)
  let rawRules = baseStatic.rules;
  let rawSystem = baseStatic.system;
  let rawMcp = baseStatic.mcp;
  let rawBaseSkills = baseStatic.skills;
  let rawDynSkills = 0;
  let rawMessages = initialMessages;
  let rawToolResults = 0;

  const activatedSkillTokenMap = new Map(); // skillNameKey -> float dynamic tokens
  const virtualActivatedSkills = new Map(); // skillNameKey -> { name, path }
  const readFilePathsInCycle = new Set();
  const topSpikes = [];

  const registerActivatedSkill = (skillPath, addedTokens) => {
    const matched = matchDiscoveredSkill(skillPath, customizations.skills);
    if (matched) {
      const key = matched.name.toLowerCase();
      activatedSkillTokenMap.set(
        key,
        (activatedSkillTokenMap.get(key) || 0) + addedTokens
      );
    } else {
      const derivedName = extractSkillNameFromPath(skillPath);
      const key = derivedName.toLowerCase();
      activatedSkillTokenMap.set(
        key,
        (activatedSkillTokenMap.get(key) || 0) + addedTokens
      );
      if (!virtualActivatedSkills.has(key)) {
        virtualActivatedSkills.set(key, {
          name: derivedName,
          path: skillPath,
        });
      }
    }
  };

  // --- Step 5: Step Delta (Delta_k) across adjacent (P_k, P_{k+1}) in active cycle ---
  for (let p = 0; p < cyclePlannerPositions.length - 1; p++) {
    const posK = cyclePlannerPositions[p];
    const posNext = cyclePlannerPositions[p + 1];
    const pk = cycleSteps[posK];
    const pNext = cycleSteps[posNext];

    const deltaK = pNext.promptTokens - pk.promptTokens;

    const pkOutTokens = Math.max(0, pk.outputTokens);
    const interMsgBuckets = [];
    const skillBuckets = [];
    const toolBuckets = [];

    let tcCursor = 0;
    let genericCount = 0;

    for (let j = posK + 1; j < posNext; j++) {
      const st = cycleSteps[j];
      if (st.type === 'USER_INPUT' || st.type === 'SYSTEM_MESSAGE') {
        const w = Math.max(1, st.textTokens + st.mediaCount * MEDIA_TOKEN_WEIGHT);
        interMsgBuckets.push({ weight: w, isTruncated: st.isTruncated });
      } else if (
        st.type === 'GENERIC' ||
        st.type === 'TOOL_RESULT' ||
        st.type === 'LIST_DIRECTORY'
      ) {
        genericCount++;
        const pairedTc =
          tcCursor < pk.toolCalls.length ? pk.toolCalls[tcCursor++] : null;
        const selfTc = st.toolCalls[0] || null;

        const toolName =
          st.explicitToolName || selfTc?.name || pairedTc?.name || 'tool';
        const targetPath =
          st.explicitTargetPath || selfTc?.targetPath || pairedTc?.targetPath || '';
        const summary =
          st.explicitSummary ||
          selfTc?.summary ||
          pairedTc?.summary ||
          buildToolSummary(toolName, targetPath, '', {});
        const isSkillRead =
          st.explicitIsSkillRead ||
          Boolean(selfTc?.isSkillRead) ||
          Boolean(pairedTc?.isSkillRead) ||
          (isReadLikeTool(toolName) && isSkillMdPath(targetPath));
        const skillPath = isSkillRead
          ? st.explicitSkillPath ||
            selfTc?.skillPath ||
            pairedTc?.skillPath ||
            targetPath
          : '';

        if (targetPath && isReadLikeTool(toolName)) {
          readFilePathsInCycle.add(normalizeMatchKey(targetPath).toLowerCase());
        }

        const w = Math.max(1, st.textTokens + st.mediaCount * MEDIA_TOKEN_WEIGHT);
        if (isSkillRead) {
          skillBuckets.push({
            weight: w,
            isTruncated: st.isTruncated,
            skillPath,
          });
        } else {
          toolBuckets.push({
            weight: w,
            isTruncated: st.isTruncated,
            stepIndex: st.stepIndex,
            toolName,
            targetPath,
            summary,
            createdAt: st.createdAt || pk.createdAt,
          });
        }
      } else if (st.textTokens > 0) {
        interMsgBuckets.push({
          weight: st.textTokens,
          isTruncated: st.isTruncated,
        });
      }
    }

    // Fallback when synthetic steps omit intermediate GENERIC items between P_k and P_{k+1}
    if (genericCount === 0 && pk.toolCalls.length > 0) {
      const estSurplus = Math.max(
        pk.toolCalls.length,
        deltaK > pkOutTokens ? deltaK - pkOutTokens : pk.toolCalls.length
      );
      const perCallWeight = Math.max(1, estSurplus / pk.toolCalls.length);
      for (const tc of pk.toolCalls) {
        if (tc.targetPath && isReadLikeTool(tc.name)) {
          readFilePathsInCycle.add(normalizeMatchKey(tc.targetPath).toLowerCase());
        }
        if (tc.isSkillRead) {
          skillBuckets.push({
            weight: perCallWeight,
            isTruncated: false,
            skillPath: tc.skillPath || tc.targetPath,
          });
        } else {
          toolBuckets.push({
            weight: perCallWeight,
            isTruncated: false,
            stepIndex: pk.stepIndex,
            toolName: tc.name,
            targetPath: tc.targetPath,
            summary: tc.summary,
            createdAt: pk.createdAt,
          });
        }
      }
    }

    if (deltaK > 0) {
      const hasInterSteps =
        interMsgBuckets.length + skillBuckets.length + toolBuckets.length > 0;

      if (!hasInterSteps) {
        rawMessages += deltaK;
      } else {
        // Deduct exact P_k API outputTokens to messages when deltaK > pkOutTokens
        let remDelta = deltaK;
        let includePkInProportional = false;
        if (deltaK > pkOutTokens) {
          rawMessages += pkOutTokens;
          remDelta = deltaK - pkOutTokens;
        } else {
          includePkInProportional = pkOutTokens > 0;
        }

        const allInter = [
          ...(includePkInProportional
            ? [{ kind: 'msg', weight: pkOutTokens, isTruncated: false }]
            : []),
          ...interMsgBuckets.map((b) => ({ ...b, kind: 'msg' })),
          ...skillBuckets.map((b) => ({ ...b, kind: 'skill' })),
          ...toolBuckets.map((b) => ({ ...b, kind: 'tool' })),
        ];

        const baseWeightSum = allInter.reduce((s, b) => s + b.weight, 0);
        const truncItems = allInter.filter((b) => b.isTruncated);
        const truncWeightSum = truncItems.reduce((s, b) => s + b.weight, 0);

        // When compact transcript truncated large step content (`truncated_fields: ["content"]`),
        // attribute unmeasured excess tokens specifically to the truncated step(s).
        if (truncWeightSum > 0 && remDelta > baseWeightSum) {
          const excess = remDelta - baseWeightSum;
          for (const item of truncItems) {
            item.weight += excess * (item.weight / truncWeightSum);
          }
        }

        const effectiveSum = allInter.reduce((s, b) => s + b.weight, 0);
        if (effectiveSum > 0) {
          for (const item of allInter) {
            const share = remDelta * (item.weight / effectiveSum);
            if (item.kind === 'msg') {
              rawMessages += share;
            } else if (item.kind === 'skill') {
              rawDynSkills += share;
              registerActivatedSkill(item.skillPath, share);
            } else {
              rawToolResults += share;
              const roundedSpike = Math.round(share);
              if (roundedSpike > 0) {
                topSpikes.push({
                  stepIndex: item.stepIndex,
                  toolName: item.toolName,
                  targetPath: item.targetPath,
                  summary: item.summary,
                  deltaTokens: roundedSpike,
                  tokens: roundedSpike,
                  percent: Number(
                    ((roundedSpike / capacity.limit) * 100).toFixed(2)
                  ),
                  createdAt: item.createdAt,
                });
              }
            }
          }
        } else {
          rawMessages += remDelta;
        }
      }
    } else {
      // Even when deltaK <= 0, preserve skill activation state if SKILL.md was read
      for (const sb of skillBuckets) {
        registerActivatedSkill(sb.skillPath, 0);
      }

      if (deltaK < 0) {
        const shrink = -deltaK;
        const dynSum = rawMessages + rawToolResults + rawDynSkills;
        if (dynSum >= shrink && dynSum > 0) {
          const keepRatio = (dynSum - shrink) / dynSum;
          rawMessages *= keepRatio;
          rawToolResults *= keepRatio;
          rawDynSkills *= keepRatio;
        } else {
          const remShrink = shrink - dynSum;
          rawMessages = 0;
          rawToolResults = 0;
          rawDynSkills = 0;
          const staticSum = rawRules + rawSystem + rawMcp + rawBaseSkills;
          if (staticSum > 0) {
            const staticKeep = Math.max(0, (staticSum - remShrink) / staticSum);
            rawRules *= staticKeep;
            rawSystem *= staticKeep;
            rawMcp *= staticKeep;
            rawBaseSkills *= staticKeep;
          }
        }
      }
    }
  }

  // Add latest completed PLANNER_RESPONSE outputTokens to messages
  rawMessages += Math.max(0, pLastActive.outputTokens);

  // --- Step 6: Hard Conservation Guarantee ---
  const conserved = conserveCategoryIntegers(
    {
      rules: rawRules,
      system: rawSystem,
      mcp: rawMcp,
      skills: rawBaseSkills + rawDynSkills,
      messages: rawMessages,
      toolResults: rawToolResults,
    },
    usedTokens
  );

  return buildBreakdownResult({
    usedTokens,
    conserved,
    customizations,
    activatedSkillTokenMap,
    virtualActivatedSkills,
    readFilePathsInCycle,
    topSpikes,
    maxTopSpikes,
    capacity,
  });
}

function buildBreakdownResult({
  usedTokens,
  conserved,
  customizations,
  activatedSkillTokenMap,
  virtualActivatedSkills,
  readFilePathsInCycle,
  topSpikes,
  maxTopSpikes,
  capacity = resolveContextWindowCapacity(CONTEXT_LIMIT),
}) {
  const activeLimit = capacity.limit;
  const activeBuffer = capacity.autocompactBuffer;
  const activeSafeLimit = capacity.safeLimit;
  const freeTokens = Math.max(0, activeSafeLimit - usedTokens);
  const usedPercent = Number(((usedTokens / activeLimit) * 100).toFixed(1));

  let alertLevel = 'normal';
  if (usedTokens >= capacity.criticalThreshold) {
    alertLevel = 'critical';
  } else if (usedTokens >= capacity.warningThreshold) {
    alertLevel = 'warning';
  }

  const categories = CATEGORY_DEFS.map((def) => {
    const tokens = conserved[def.id] || 0;
    return {
      id: def.id,
      label: def.label,
      tokens,
      percent: Number(((tokens / activeLimit) * 100).toFixed(2)),
      usedSharePercent:
        usedTokens > 0 ? Number(((tokens / usedTokens) * 100).toFixed(1)) : 0,
    };
  });

  // --- Drawers: Rules ---
  const ruleAlloc = allocateProportionalIntegers(
    customizations.rules.map((r) => r.estimatedTokens),
    conserved.rules
  );
  const rulesDrawer = customizations.rules
    .map((r, idx) => {
      const tokens = ruleAlloc[idx] || 0;
      return {
        name: r.name,
        path: r.path,
        scope: r.scope,
        bytes: r.bytes,
        estimatedTokens: r.estimatedTokens,
        tokens,
        percent: Number(((tokens / activeLimit) * 100).toFixed(2)),
      };
    })
    .sort((a, b) => b.tokens - a.tokens || b.estimatedTokens - a.estimatedTokens);

  // --- Deferred Lazy MCP & Drawers: MCP ---
  const lazyMcp = [];
  for (const srv of customizations.lazyMcpServers) {
    const unreadTools = (srv.toolEntries || []).filter(
      (t) => !readFilePathsInCycle.has(normalizeMatchKey(t.filePath).toLowerCase())
    );
    if (unreadTools.length === 0) continue;
    const estTokens = unreadTools.reduce((s, t) => s + t.estimatedTokens, 0);
    lazyMcp.push({
      name: srv.name,
      serverName: srv.serverName,
      dirName: srv.dirName,
      scope: srv.scope,
      toolCount: unreadTools.length,
      tools: unreadTools.map((t) => t.toolName),
      estimatedTokens: estTokens,
      tokens: estTokens,
      path: srv.path,
    });
  }
  lazyMcp.sort((a, b) => b.estimatedTokens - a.estimatedTokens);

  const mcpAlloc = allocateProportionalIntegers(
    customizations.eagerMcpServers.map((m) => m.estimatedTokens),
    conserved.mcp
  );
  const mcpDrawerMap = new Map();
  customizations.eagerMcpServers.forEach((m, idx) => {
    const tokens = mcpAlloc[idx] || 0;
    mcpDrawerMap.set(`${m.scope}:${m.name}`, {
      name: m.name,
      serverName: m.serverName,
      mode: m.mode,
      scope: m.scope,
      toolCount: m.toolCount,
      estimatedTokens: m.estimatedTokens,
      tokens,
      deferredTokens: m.deferredTokens || 0,
      percent: Number(((tokens / activeLimit) * 100).toFixed(2)),
      path: m.path,
    });
  });
  for (const lz of lazyMcp) {
    const key = `${lz.scope}:${lz.name}`;
    if (!mcpDrawerMap.has(key)) {
      mcpDrawerMap.set(key, {
        name: lz.name,
        serverName: lz.serverName,
        mode: 'lazy',
        scope: lz.scope,
        toolCount: lz.toolCount,
        estimatedTokens: lz.estimatedTokens,
        tokens: 0,
        deferredTokens: lz.estimatedTokens,
        percent: 0,
        path: lz.path,
      });
    } else {
      mcpDrawerMap.get(key).deferredTokens = lz.estimatedTokens;
    }
  }
  const mcpDrawer = [...mcpDrawerMap.values()].sort(
    (a, b) =>
      b.tokens - a.tokens ||
      b.deferredTokens - a.deferredTokens ||
      b.toolCount - a.toolCount
  );

  // --- Deferred Inactive Skills & Drawers: Skills ---
  const inactiveSkills = [];
  const rawSkillItems = [];

  for (const sk of customizations.skills) {
    const key = sk.name.toLowerCase();
    const isActivated = activatedSkillTokenMap.has(key);
    const dynAdded = activatedSkillTokenMap.get(key) || 0;
    const rawActiveWeight = isActivated
      ? sk.summaryTokens + Math.max(dynAdded, sk.bodyTokens > 0 ? 1 : 0)
      : sk.summaryTokens;

    rawSkillItems.push({
      name: sk.name,
      path: sk.path,
      scope: sk.scope,
      description: sk.description,
      activated: isActivated,
      rawWeight: rawActiveWeight,
      estimatedTokens: isActivated ? sk.fullTokens : sk.summaryTokens,
      deferredTokens: isActivated ? 0 : sk.bodyTokens,
    });

    if (!isActivated && sk.bodyTokens > 0) {
      inactiveSkills.push({
        name: sk.name,
        scope: sk.scope,
        path: sk.path,
        description: sk.description,
        estimatedTokens: sk.bodyTokens,
        tokens: sk.bodyTokens,
        fullTokens: sk.fullTokens,
        summaryTokens: sk.summaryTokens,
      });
    }
  }

  // Include any virtual/session-only skills activated via read_file that weren't in filesystem scan
  for (const [key, virt] of virtualActivatedSkills.entries()) {
    const dynAdded = activatedSkillTokenMap.get(key) || 0;
    rawSkillItems.push({
      name: virt.name,
      path: virt.path,
      scope: 'session',
      description: '',
      activated: true,
      rawWeight: Math.max(1, dynAdded),
      estimatedTokens: Math.max(1, Math.round(dynAdded)),
      deferredTokens: 0,
    });
  }

  const skillAlloc = allocateProportionalIntegers(
    rawSkillItems.map((it) => it.rawWeight),
    conserved.skills
  );

  const scopeRank = {
    session: 0,
    workspace: 1,
    global: 2,
    plugin: 3,
    builtin: 4,
  };

  const skillsDrawer = rawSkillItems
    .map((it, idx) => {
      const tokens = skillAlloc[idx] || 0;
      return {
        name: it.name,
        path: it.path,
        scope: it.scope,
        activated: it.activated,
        tokens,
        estimatedTokens: it.estimatedTokens,
        deferredTokens: it.deferredTokens,
        percent: Number(((tokens / activeLimit) * 100).toFixed(2)),
      };
    })
    .sort((a, b) => {
      if (a.activated !== b.activated) return a.activated ? -1 : 1;
      if (b.tokens !== a.tokens) return b.tokens - a.tokens;
      return (scopeRank[a.scope] ?? 9) - (scopeRank[b.scope] ?? 9);
    });

  inactiveSkills.sort((a, b) => b.estimatedTokens - a.estimatedTokens);

  const lazyMcpTokens = lazyMcp.reduce((s, item) => s + item.estimatedTokens, 0);
  const inactiveSkillsTokens = inactiveSkills.reduce(
    (s, item) => s + item.estimatedTokens,
    0
  );

  // --- Drawers: Top Spikes ---
  const sortedSpikes = [...topSpikes]
    .sort((a, b) => b.deltaTokens - a.deltaTokens || b.stepIndex - a.stepIndex)
    .slice(0, Math.max(1, maxTopSpikes));

  return {
    limit: activeLimit,
    autocompactBuffer: activeBuffer,
    safeLimit: activeSafeLimit,
    usedTokens,
    usedPercent,
    freeTokens,
    alertLevel,
    categories,
    deferred: {
      totalEstimatedTokens: lazyMcpTokens + inactiveSkillsTokens,
      lazyMcpTokens,
      inactiveSkillsTokens,
      lazyMcp,
      inactiveSkills,
    },
    drawers: {
      rules: rulesDrawer,
      mcp: mcpDrawer,
      skills: skillsDrawer,
      topSpikes: sortedSpikes,
    },
  };
}
