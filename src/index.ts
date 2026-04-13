import { ScriptStorage } from './storage.ts';
import { ScriptRunner } from './script_runner.ts';
import { SearchService } from './services/search_service.ts';
import { ShortLinkService } from './services/shortlink_service.ts';
import { SongListService } from './services/songlist_service.ts';
import { LyricService } from './services/lyric_service.ts';

export interface Env {
  SCRIPTS_KV: KVNamespace;
  CACHE_KV: KVNamespace;
  API_KEY?: string;
}

const REQUEST_TIMEOUT_MS = 30000;

// ========== ScriptRunner 缓存（CF Workers Isolate 级别） ==========
// CF Workers 在同一 Isolate 内复用模块级变量。
// 缓存已初始化的 ScriptRunner 实例，避免每次请求都重新加载 QuickJS + 执行脚本。
// 参考: https://architectingoncloudflare.com/chapter-03/
// "Expensive initialisation producing immutable results belongs in global scope"

interface CachedRunner {
  runner: ScriptRunner;
  scriptId: string;
  rawScriptHash: string;
  createdAt: number;
  lastUsedAt: number;
}

const _runnerCache = new Map<string, CachedRunner>();
const CACHE_MAX_AGE_MS = 10 * 60 * 1000; // 10分钟过期
const CACHE_MAX_SIZE = 5;

function simpleHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = ((h << 5) - h + s.charCodeAt(i)) | 0; }
  return 'h' + Math.abs(h).toString(36);
}

async function getOrCreateRunner(scriptInfo: { id: string; name: string; rawScript: string }): Promise<ScriptRunner> {
  const hash = simpleHash(scriptInfo.rawScript);
  const cacheKey = `${scriptInfo.id}:${hash}`;

  const cached = _runnerCache.get(cacheKey);
  if (cached && cached.runner.isReady()) {
    cached.lastUsedAt = Date.now();
    console.log(`[RunnerCache] ✅ HIT ${scriptInfo.name} (age=${Math.round((Date.now() - cached.createdAt) / 1000)}s, key=${cacheKey.substring(0, 30)}...)`);
    return cached.runner;
  }

  console.log(`[RunnerCache] MISS ${scriptInfo.name}, creating new instance...`);
  const runner = new ScriptRunner(scriptInfo);
  await runner.initialize();

  _runnerCache.set(cacheKey, {
    runner,
    scriptId: scriptInfo.id,
    rawScriptHash: hash,
    createdAt: Date.now(),
    lastUsedAt: Date.now(),
  });

  // 清理过期/超量的缓存
  if (_runnerCache.size > CACHE_MAX_SIZE) {
    const now = Date.now();
    for (const [key, entry] of _runnerCache) {
      if (now - entry.lastUsedAt > CACHE_MAX_AGE_MS || _runnerCache.size > CACHE_MAX_SIZE) {
        try { entry.runner.dispose(); } catch (_e) {}
        _runnerCache.delete(key);
        console.log(`[RunnerCache] 🗑️ Evicted ${key.substring(0, 30)}...`);
      }
    }
  }

  return runner;
}

function jsonResponse(data: any, status = 200, msg = 'success', extra?: any): Response {
  const body: any = { code: status === 200 ? 200 : status, msg, data };
  if (extra) Object.assign(body, extra);
  return Response.json(body, { status });
}

function generateApiKey(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 32; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
}

let cachedApiKey: string | null = null;

async function getApiKey(kv: KVNamespace): Promise<string> {
  if (cachedApiKey) return cachedApiKey;
  const saved = await kv.get('api_key');
  if (saved) { cachedApiKey = saved; return saved; }
  const newKey = generateApiKey();
  await kv.put('api_key', newKey);
  cachedApiKey = newKey;
  return newKey;
}

const searchService = new SearchService();
const shortLinkService = new ShortLinkService();
const songListService = new SongListService();
const lyricService = new LyricService();

async function handleImportScriptFromUrl(request: Request, storage: ScriptStorage): Promise<Response> {
  const body = await request.json() as { url: string };
  if (!body.url) return jsonResponse(null, 400, '缺少 url 参数');
  try {
    const info = await storage.importScriptFromUrl(body.url);
    const loadedScripts = await storage.getScripts();
    const stats = await storage.getScriptStats();
    const defaultInfo = await storage.getDefaultScript();
    const scriptsFormatted = await Promise.all(loadedScripts.map(async (s) => {
      const ss = stats[s.id];
      const sr = ss ? storage.getScriptSuccessRate(ss) : 0;
      const tr = ss ? ss.success + ss.fail : 0;
      const icb = await storage.isScriptCircuitBreakerTripped(s.id);
      return { id: s.id, name: s.name, description: s.description, author: s.author, homepage: s.homepage, version: s.version, createdAt: new Date(s.createdAt).toISOString(), supportedSources: (s.supportedSources.length === 1 && s.supportedSources[0] === 'unknown') ? ['kw', 'kg', 'tx', 'wy', 'mg'] : s.supportedSources, isDefault: s.isDefault, successRate: tr > 0 ? sr : null, successCount: ss?.success || 0, failCount: ss?.fail || 0, totalRequests: tr, isCircuitBroken: icb };
    }));
    return jsonResponse({
      success: true,
      defaultSource: defaultInfo ? { id: defaultInfo.id, name: defaultInfo.name, supportedSources: (await storage.getScript(defaultInfo.id))?.supportedSources || [] } : null,
      scripts: scriptsFormatted,
    }, 200, '从URL导入成功');
  } catch (e: any) { return jsonResponse(null, 500, e.message || '导入失败'); }
}

async function handleImportScriptRaw(request: Request, storage: ScriptStorage): Promise<Response> {
  const body = await request.json() as { name: string; content: string; url?: string };
  if (!body.content || !body.name) return jsonResponse(null, 400, '缺少 name 或 content 参数');
  try { const info = await storage.importScriptRaw(body.name, body.content, body.url || ''); return jsonResponse(info); }
  catch (e: any) { return jsonResponse(null, 500, e.message || '导入失败'); }
}

// GET /api/scripts/loaded - 获取已加载脚本列表(含统计)
async function handleGetLoadedScripts(request: Request, storage: ScriptStorage): Promise<Response> {
  try {
    const scripts = await storage.getScripts();
    const stats = await storage.getScriptStats();
    const result = await Promise.all(scripts.map(async (s) => {
      const scriptStats = stats[s.id];
      const successRate = scriptStats ? storage.getScriptSuccessRate(scriptStats) : 0;
      const totalRequests = scriptStats ? scriptStats.success + scriptStats.fail : 0;
      const isCircuitBroken = await storage.isScriptCircuitBreakerTripped(s.id);
      return {
        id: s.id, name: s.name, description: s.description, author: s.author,
        homepage: s.homepage, version: s.version, createdAt: new Date(s.createdAt).toISOString(),
        supportedSources: s.supportedSources, isDefault: s.isDefault,
        successRate: totalRequests > 0 ? successRate : null,
        successCount: scriptStats?.success || 0,
        failCount: scriptStats?.fail || 0,
        totalRequests,
        isCircuitBroken,
      };
    }));
    return jsonResponse(result);
  } catch (e: any) { return jsonResponse(null, 500, e.message); }
}

// POST /api/scripts/default - 设置默认脚本
async function handleSetDefaultScript(request: Request, storage: ScriptStorage): Promise<Response> {
  const body = await request.json() as { id: string };
  if (!body.id) return jsonResponse(null, 400, '缺少 id 参数');
  try { await storage.setDefaultScript(body.id); return jsonResponse({ success: true }); }
  catch (e: any) { return jsonResponse(null, 500, e.message); }
}

// GET /api/scripts/default - 获取默认脚本信息
async function handleGetDefaultScript(storage: ScriptStorage): Promise<Response> {
  try {
    const def = await storage.getDefaultScript();
    if (!def) return jsonResponse(null, 404, '未设置默认脚本');
    return jsonResponse({ id: def.id, name: def.name });
  } catch (e: any) { return jsonResponse(null, 500, e.message); }
}

// POST /api/scripts/delete - 删除脚本
async function handleDeleteScript(request: Request, storage: ScriptStorage): Promise<Response> {
  const body = await request.json() as { id: string };
  if (!body.id) return jsonResponse(null, 400, '缺少 id 参数');
  try {
    await storage.deleteScript(body.id);
    const loadedScripts = await storage.getScripts();
    const stats = await storage.getScriptStats();
    const defaultInfo = await storage.getDefaultScript();
    const scriptsFormatted = await Promise.all(loadedScripts.map(async (s) => {
      const ss = stats[s.id];
      const sr = ss ? storage.getScriptSuccessRate(ss) : 0;
      const tr = ss ? ss.success + ss.fail : 0;
      const icb = await storage.isScriptCircuitBreakerTripped(s.id);
      return { id: s.id, name: s.name, description: s.description, author: s.author, homepage: s.homepage, version: s.version, createdAt: new Date(s.createdAt).toISOString(), supportedSources: s.supportedSources, isDefault: s.isDefault, successRate: tr > 0 ? sr : null, successCount: ss?.success || 0, failCount: ss?.fail || 0, totalRequests: tr, isCircuitBroken: icb };
    }));
    return jsonResponse({
      success: true,
      defaultSource: defaultInfo ? { id: defaultInfo.id, name: defaultInfo.name, supportedSources: (await storage.getScript(defaultInfo.id))?.supportedSources || [] } : null,
      scripts: scriptsFormatted,
    }, 200, '脚本已删除');
  } catch (e: any) { return jsonResponse(null, 500, e.message); }
}

// POST /api/music/lyric - 获取歌词
async function handleGetLyric(request: Request): Promise<Response> {
  try {
    const body = await request.json() as any;
    if (!body.source) return jsonResponse(null, 400, '缺少必要参数: source');
    if (!body.songId) return jsonResponse(null, 400, '缺少必要参数: songId');
    const musicInfo: any = { source: body.source };
    switch (body.source) {
      case 'kw': musicInfo.songmid = body.songId; break;
      case 'kg': musicInfo.hash = body.songId; musicInfo.name = body.name || '未知歌曲'; break;
      case 'tx': musicInfo.songId = body.songId; break;
      case 'wy': musicInfo.songId = body.songId; break;
      case 'mg': musicInfo.copyrightId = body.songId; musicInfo.name = body.name; musicInfo.singer = body.singer; break;
      default: return jsonResponse(null, 400, `不支持的音源: ${body.source}`);
    }
    const result = await lyricService.getLyric(musicInfo);
    return jsonResponse({ lyric: result.lyric, tlyric: result.tlyric, rlyric: result.rlyric, lxlyric: result.lxlyric }, 200, '获取歌词成功');
  } catch (e: any) { return jsonResponse(null, 500, e.message || '获取歌词失败'); }
}

// GET /api/search - 歌曲搜索
async function handleSearch(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const keyword = url.searchParams.get('keyword') || url.searchParams.get('key') || '';
  const source = url.searchParams.get('source') || '';
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = parseInt(url.searchParams.get('limit') || '20');

  if (!keyword) return jsonResponse(null, 400, '缺少 keyword 参数');
  try {
    const results = await searchService.search(keyword, source || undefined, page, limit);
    return jsonResponse(results);
  } catch (e: any) { return jsonResponse(null, 500, e.message); }
}

// POST /api/songlist/detail - 获取歌单详情
async function handleGetSongListDetail(request: Request): Promise<Response> {
  const body = await request.json() as { source: string; id: string };
  if (!body.source || !body.id) return jsonResponse(null, 400, '缺少 source 或 id 参数');
  
  try {
    const result = await songListService.getListDetail(body.source, body.id);
    return jsonResponse(result);
  } catch (e: any) { return jsonResponse(null, 500, e.message); }
}

// POST /api/songlist/detail/by-link - 通过链接获取歌单详情
async function handleGetSongListDetailByLink(request: Request): Promise<Response> {
  const body = await request.json() as { link: string; source?: string };
  if (!body.link) return jsonResponse(null, 400, '缺少 link 参数');
  
  try {
    const parsed = await shortLinkService.parseShortLink(body.link);
    if (!parsed || !parsed.id) return jsonResponse(null, 500, '短链接解析结果无效');
    const result = await songListService.getListDetail(parsed.source, parsed.id);
    return jsonResponse(result);
  } catch (e: any) { return jsonResponse(null, 500, e.message || '解析链接失败'); }
}

// POST /api/music/url/inline - inline模式(直接传脚本)
async function handleGetMusicUrlWithScript(request: Request): Promise<Response> {
  const body = await request.json() as any;
  if (!body.source || !body.quality || !body.scriptContent) return jsonResponse(null, 400, '缺少必要参数: source, quality, scriptContent');

  let rawScript = body.scriptContent;
  try { rawScript = atob(rawScript); } catch (_e) {}
  const scriptInfo = { id: 'inline_script', name: body.scriptName || 'Inline Script', rawScript };
  const runner = await getOrCreateRunner(scriptInfo);

  const musicInfo = body.musicInfo || {};
  const songId = body.songmid || body.id || body.songId || musicInfo?.id || musicInfo?.songmid || '';

  try {
    const result = await runner.request({
      source: body.source, action: 'musicUrl',
      info: {
        type: body.quality,
        musicInfo: {
          id: songId,
          name: musicInfo?.name || '',
          singer: musicInfo?.singer || '',
          source: body.source,
          songmid: songId,
          interval: musicInfo?.interval || 0,
          meta: {
            songId: songId,
            albumName: musicInfo?.albumName || musicInfo?.album || '',
            picUrl: musicInfo?.picUrl || musicInfo?.img || '',
            hash: musicInfo?.hash || musicInfo?.meta?.hash || '',
            strMediaMid: musicInfo?.strMediaMid || musicInfo?.meta?.strMediaMid || '',
            copyrightId: musicInfo?.copyrightId || musicInfo?.meta?.copyrightId || '',
          },
          typeUrl: {},
          albumId: musicInfo?.albumId || musicInfo?.meta?.albumId || '',
          types: musicInfo?.types || musicInfo?.qualitys || musicInfo?.meta?.qualitys || [],
          _types: {},
          hash: musicInfo?.hash || musicInfo?.meta?.hash || '',
          copyrightId: musicInfo?.copyrightId || musicInfo?.meta?.copyrightId || '',
          strMediaMid: musicInfo?.strMediaMid || musicInfo?.meta?.strMediaMid || '',
          albumMid: musicInfo?.albumMid || musicInfo?.meta?.albumMid || '',
          songId: musicInfo?.songId || musicInfo?.meta?.songId || songId,
          lrcUrl: musicInfo?.lrcUrl || musicInfo?.meta?.lrcUrl || '',
          mrcUrl: musicInfo?.mrcUrl || musicInfo?.meta?.mrcUrl || '',
          trcUrl: musicInfo?.trcUrl || musicInfo?.meta?.trcUrl || ''
        }
      },
    });
    return jsonResponse({ url: result.data.url, type: result.data.type || body.quality, source: body.source, quality: body.quality });
  } catch (error: any) { return jsonResponse(null, 500, error.message || '获取播放URL失败'); }
}

// 动态计算每个脚本的超时时间（ms）
// 总超时固定 15000ms，根据可用脚本数量分配
// 1脚本=15000ms, 2脚本=7300ms, 3+脚本=4300ms
function calculateScriptTimeouts(scriptIds: string[], realAvailableCount: number): Map<string, number> {
  const timeouts = new Map<string, number>();
  if (realAvailableCount === 0 || scriptIds.length === 0) return timeouts;
  const perScript = realAvailableCount === 1 ? 15000 : realAvailableCount === 2 ? 7300 : 4300;
  for (const id of scriptIds) timeouts.set(id, perScript);
  console.log(`[API] 动态超时: 脚本数=${realAvailableCount}, 每脚本=${perScript}ms`);
  return timeouts;
}

// POST /api/music/url - 核心接口，支持换脚本和换源（含熔断/统计/重试/换源）
async function handleGetMusicUrl(request: Request, storage: ScriptStorage): Promise<Response> {
  let scriptId = 'unknown';
  let scriptName = 'unknown';

  try {
    const body = await request.json() as any;
    if (!body.source || !body.quality) return jsonResponse(null, 400, '缺少必要参数: source, quality');

    const allowToggleSource = body.allowToggleSource !== false;
    const excludeSources = body.excludeSources || [];
    const songId = body.songmid || body.id || body.songId || body.musicInfo?.id || body.musicInfo?.songmid || body.musicInfo?.hash || '';
    const name = body.name || body.musicInfo?.name || '未知歌曲';
    const singer = body.singer || body.musicInfo?.singer || '未知歌手';
    const originalSource = body.source;

    // 步骤1：获取可用脚本（按成功率排序，跳过已熔断的）
    const allScripts = await storage.getScripts();
    let availableScriptIds: string[] = [];
    const trippedScriptIds: string[] = [];

    for (const s of allScripts) {
      if (s.supportedSources.includes(originalSource)) {
        const isTripped = await storage.isScriptCircuitBreakerTripped(s.id);
        if (isTripped) { trippedScriptIds.push(s.id); console.log(`[API] ⚠️ 脚本 ${s.name} 已熔断但仍支持 ${originalSource}`); }
        else availableScriptIds.push(s.id);
      }
    }

    // 如果正常脚本为空但有熔断脚本（或完全无脚本），降级使用所有支持的脚本 + 标记需要换源
    let needForceToggle = false;
    if (availableScriptIds.length === 0) {
      if (trippedScriptIds.length > 0) {
        // ★★★ 关键优化：如果唯一支持的脚本被熔断，直接降级使用（不走复杂换源路径避免QuickJS崩溃）★★★
        availableScriptIds = [...trippedScriptIds];
        needForceToggle = true;
        console.log(`[API] ⚠️ 所有支持${originalSource}的脚本均已熔断(${trippedScriptIds.length}个)，降级使用`);
      }
      else {
        for (const s of allScripts) { if (s.supportedSources.includes(originalSource)) availableScriptIds.push(s.id); }
        if (availableScriptIds.length === 0) {
          // ★★★ 没有任何脚本支持该源 → 立即换源 ★★★
          if (allowToggleSource && originalSource !== 'local') {
            console.log(`[API] 🔄 无脚本支持 ${originalSource}，立即换源, allScripts=${allScripts.length}, allSources=${allScripts.map(s => s.supportedSources.join(',')).join(';')}`);
            return await handleForceToggle(body, songId, name, singer, originalSource, excludeSources, storage);
          }
          return jsonResponse(null, 500, `没有支持 ${originalSource} 源的脚本`, { source: originalSource, allScriptsCount: allScripts.length, allScriptsSources: allScripts.map(s => ({ id: s.id, name: s.name, sources: s.supportedSources })) });
        } else { needForceToggle = true; }
      }
    }

    // 按成功率排序
    const sortedIds = await storage.getSortedScriptsBySuccessRate(availableScriptIds, (await storage.getDefaultScript())?.id ?? null);
    const scriptTimeouts = calculateScriptTimeouts(sortedIds, sortedIds.length);

    const triedScripts: { scriptId: string; scriptName: string; message: string; responseTime: number; diagnostics?: any }[] = [];
    let lastResult: any = null;

    // 预先启动歌词获取（并行）
    const lyricPromise = getLyricForMusicUrl(body, songId, name, singer, originalSource);

    // 步骤2：依次尝试每个脚本
    for (const currentScriptId of sortedIds) {
      const currentScript = allScripts.find(s => s.id === currentScriptId);
      if (!currentScript) continue;

      scriptId = currentScriptId;
      scriptName = currentScript.name;
      const startTime = Date.now();

      let rawScript: string | null = null;
      try { rawScript = await storage.getScriptRaw(currentScriptId); } catch (_e) {}
      if (!rawScript) { triedScripts.push({ scriptId: currentScriptId, scriptName: currentScript.name, message: '无法获取脚本内容', responseTime: Date.now() - startTime }); continue; }

      console.log(`[API] Initializing script ${currentScript.name}...`);
      let runner: ScriptRunner | undefined;
      try {
        runner = await getOrCreateRunner({ id: currentScriptId, name: currentScript.name, rawScript });
        console.log(`[API] Script ${currentScript.name} initialized OK`);
      } catch (error: any) {
        const diag = (runner as any)._featureDiagnostic ? ' | features: ' + (runner as any)._featureDiagnostic : '';
        const initErr = (runner as any)._scriptInitError || '';
        console.log(`[API] Script ${currentScript.name} init FAILED:`, error.message, '| diag:', diag, '| initErr:', initErr);
        triedScripts.push({ scriptId: currentScriptId, scriptName: currentScript.name, message: error.message + diag + (initErr ? ' | raw:' + initErr : ''), responseTime: Date.now() - startTime });
        await storage.updateScriptStats(currentScriptId, false, Date.now() - startTime);
        await storage.recordScriptFailure(currentScriptId); continue;
      }

      try {
        const musicInfoSource = body.musicInfo?.source || body.source || 'unknown';
        const result = await runner.request({
          source: musicInfoSource, action: 'musicUrl',
          info: {
            type: body.quality,
            musicInfo: {
              id: songId,
              name,
              singer,
              source: musicInfoSource,
              songmid: songId,
              interval: body.interval || body.musicInfo?.interval || 0,
              meta: {
                songId: songId,
                albumName: body.albumName || body.musicInfo?.albumName || body.musicInfo?.album || '',
                picUrl: body.picUrl || body.musicInfo?.picUrl || null,
                hash: body.hash || body.musicInfo?.hash || body.musicInfo?.songmid || '',
                strMediaMid: body.strMediaMid || body.musicInfo?.strMediaMid || '',
                copyrightId: body.copyrightId || body.musicInfo?.copyrightId || '',
              },
              albumName: body.albumName || body.musicInfo?.albumName || body.musicInfo?.album || '',
              img: body.picUrl || body.musicInfo?.picUrl || body.musicInfo?.img || '',
              typeUrl: {},
              albumId: body.albumId || body.musicInfo?.albumId || '',
              types: body.types || body.qualitys || body.musicInfo?.qualitys || [],
              _types: {},
              hash: body.hash || body.musicInfo?.hash || body.musicInfo?.songmid || '',
              copyrightId: body.copyrightId || body.musicInfo?.copyrightId || '',
              strMediaMid: body.strMediaMid || body.musicInfo?.strMediaMid || '',
              albumMid: body.albumMid || body.musicInfo?.albumMid || '',
              songId: body.songId || body.musicInfo?.songId || songId,
              lrcUrl: body.lrcUrl || body.musicInfo?.lrcUrl || '',
              mrcUrl: body.mrcUrl || body.musicInfo?.mrcUrl || '',
              trcUrl: body.trcUrl || body.musicInfo?.trcUrl || ''
            }
          },
          timeoutMs: scriptTimeouts.get(currentScriptId),
        });
        const responseTime = Date.now() - startTime;

        if (result.data.url) {
          if (result.data.url.endsWith('2149972737147268278.mp3')) {
            console.log(`[API] ⚠️ 检测到无效URL(黑名单)，触发换源`);
            triedScripts.push({ scriptId: currentScriptId, scriptName: currentScript.name, message: '黑名单URL', responseTime });
            await storage.updateScriptStats(currentScriptId, false, responseTime);
            await storage.updateSourceStats(currentScriptId, originalSource, false);
            if (allowToggleSource) {
              const elapsedMs = responseTime;
              const toggleResult = await tryToggleSourceInternal(body, songId, name, singer, originalSource, excludeSources, currentScriptId, currentScript.name, runner, storage, elapsedMs);
              if (toggleResult.success && toggleResult.url) {
                return jsonResponse({
                  url: toggleResult.url, type: toggleResult.type || body.quality, source: toggleResult.newSource,
                  quality: body.quality, lyric: '', cached: false,
                  fallback: { toggled: true, originalSource, newSource: toggleResult.newSource, matchedSong: { name: toggleResult.matchedName, singer: toggleResult.matchedSinger } },
                  scriptId: currentScriptId, scriptName: currentScript.name,
                  triedScripts: triedScripts.length > 0 ? triedScripts : undefined,
                }, 200, '获取成功（换源）');
              }
            }
            return jsonResponse(null, 500, '获取播放URL失败（黑名单）', { source: originalSource, scriptId: currentScriptId, scriptName: currentScript.name, triedScripts });
          }

          await storage.updateScriptStats(currentScriptId, true, responseTime);
          await storage.recordScriptSuccess(currentScriptId);
          await storage.updateSourceStats(currentScriptId, originalSource, true);

          const lyricResult = await Promise.race([lyricPromise, new Promise<any>(r => setTimeout(() => r({ lyric: '', tlyric: '', rlyric: '', lxlyric: '' }), 2000))]);

          return jsonResponse({
            url: result.data.url, type: result.data.type || body.quality, source: originalSource,
            quality: body.quality, lyric: lyricResult.lyric, tlyric: lyricResult.tlyric,
            rlyric: lyricResult.rlyric, lxlyric: lyricResult.lxlyric,
            cached: false, fallback: { toggled: false, originalSource },
            scriptId: currentScriptId, scriptName: currentScript.name,
            triedScripts: triedScripts.length > 0 ? triedScripts : undefined,
          }, 200, '获取成功');
        }
        throw new Error('获取播放URL失败');
      } catch (error: any) {
        const responseTime = Date.now() - startTime;
        const _diag = runner.getDiagnostics ? runner.getDiagnostics() : null;
        console.log(`[API] ❌ 脚本 ${currentScript.name} 失败: ${error.message}, 耗时: ${responseTime}ms`);
        triedScripts.push({ scriptId: currentScriptId, scriptName: currentScript.name, message: error.message || '未知错误', responseTime, diagnostics: _diag });

        if (allowToggleSource) {
          console.log(`[API] 🔄 调用 tryToggleSourceInternal (原始源: ${originalSource})`);
          const elapsedMs = responseTime;
          const toggleResult = await tryToggleSourceInternal(body, songId, name, singer, originalSource, excludeSources, currentScriptId, currentScript.name, runner, storage, elapsedMs);
          if (toggleResult.success && toggleResult.url) {
            console.log(`[API] ✅ tryToggleSourceInternal 换源成功: ${originalSource} -> ${toggleResult.newSource}`);
            return jsonResponse({
              url: toggleResult.url, type: toggleResult.type || body.quality, source: toggleResult.newSource,
              quality: body.quality, lyric: '', cached: false,
              fallback: { toggled: true, originalSource, newSource: toggleResult.newSource, matchedSong: { name: toggleResult.matchedName, singer: toggleResult.matchedSinger } },
              scriptId: currentScriptId, scriptName: currentScript.name,
              triedScripts: triedScripts.length > 0 ? triedScripts : undefined,
            }, 200, '获取成功（换源）');
          }
          console.log(`[API] tryToggleSourceInternal 失败: ${toggleResult.message}`);
        } else {
          console.log(`[API] 换源已禁用(allowToggleSource=false)`);
        }

        await storage.updateScriptStats(currentScriptId, false, responseTime);
        await storage.updateSourceStats(currentScriptId, originalSource, false);
        const circuitTripped = await storage.recordScriptFailure(currentScriptId);
        if (circuitTripped) console.log(`[API] 🔴 脚本 ${currentScript.name} 已触发熔断`);

        lastResult = { scriptId: currentScriptId, scriptName: currentScript.name, message: error.message };
      }
    }

    if (allowToggleSource && triedScripts.length > 0) {
      console.log(`[API] 🔄 所有支持 ${originalSource} 的脚本均失败(${triedScripts.length}个)，触发最终跨脚本换源...`);
      try {
        const fallbackResp = await handleForceToggle(body, songId, name, singer, originalSource, [], storage);
        return fallbackResp;
      } catch (e: any) {
        console.log(`[API] 最终跨脚本换源也失败: ${e.message}`);
      }
    }

    return jsonResponse(null, 500, '所有脚本均获取失败', { source: originalSource, scriptId: lastResult?.scriptId || 'unknown', scriptName: lastResult?.scriptName || 'unknown', triedScripts });
  } catch (error: any) {
    return jsonResponse(null, 500, error.message || 'Internal Server Error', { scriptId, scriptName });
  }
}

// ==================== 强制换源（无脚本支持原始源时） ====================
async function fastBuiltinMusicUrl(source: string, quality: string, songmid: string, name: string, singer: string): Promise<string | null> {
  const keyword = `${name} - ${singer}`;
  if (source === 'kw') {
    try {
      const searchResp = await fetch(`http://search.kuwo.cn/r.s?all=${encodeURIComponent(keyword)}&ft=music&itemset=web_2013&client=kt&rformat=json&encoding=utf8`, {
        headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'http://www.kuwo.cn' }
      });
      const searchData = await searchResp.json() as any;
      const abslist = searchData?.abslist?.filter((s: any) => s?.RID) || [];
      if (abslist.length > 0) {
        const rid = abslist[0].RID;
        const proxyResp = await fetch(`https://api.nobb.cc/kuwo/url?rid=${rid}&br=${quality === 'flac' ? '999k' : quality === '320k' ? '320kmp3' : '128kmp3'}`);
        const proxyData = await proxyResp.json() as any;
        if (proxyData.code === 200 && proxyData.data?.url) return proxyData.data.url;
      }
    } catch (_e) {}
    throw new Error('kw fast path failed');
  }
  if (source === 'kg') {
    try {
      const searchResp = await fetch(`http://msearchcdn.kugou.com/api/v3/search/song?format=json&keyword=${encodeURIComponent(keyword)}&page=1&pagesize=5`, {
        headers: { 'User-Agent': 'Mozilla/5.0', 'KG-RC': '1' }
      });
      const searchData = await searchResp.json() as any;
      const hash = searchData?.data?.info?.[0]?.hash;
      const albumId = searchData?.data?.info?.[0]?.album_id;
      if (hash && albumId) {
        const playResp = await fetch(`https://wwwapi.kugou.com/yy/index.php?r=play/getdata&hash=${hash}&album_id=${albumId}&mid=1_1`, {
          headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.kugou.com/', 'Origin': 'https://www.kugou.com' }
        });
        const playData = await playResp.json() as any;
        if (playData.data?.play_url) return playData.data.play_url;
      }
      throw new Error('kg play API blocked, try kw');
    } catch (kgErr: any) {
      console.log(`[FastPath] kg failed: ${kgErr.message}, falling back to kw...`);
      return fastBuiltinMusicUrl('kw', quality, songmid, name, singer);
    }
  }
  throw new Error(`fast path unsupported source: ${source}`);
}

async function handleForceToggle(
  body: any, songId: string, name: string, singer: string,
  originalSource: string, excludeSources: string[], storage: ScriptStorage
): Promise<Response> {
  const allScripts = await storage.getScripts();
  const toggleSources = ['kw', 'kg', 'tx', 'wy', 'mg'].filter(s => s !== originalSource && !excludeSources.includes(s));
  console.log(`[ForceToggle] 原始源 ${originalSource} 无脚本，尝试: [${toggleSources.join(',')}]`);
  const forceToggleLogs: string[] = [];

  for (const trySource of toggleSources) {
    for (const s of allScripts) {
      if (!s.supportedSources.includes(trySource)) {
        console.log(`[ForceToggle] ⏭️ ${s.name} 不支持 ${trySource}，但仍尝试（builtin可能支持）`);
      }
      const isTripped = await storage.isScriptCircuitBreakerTripped(s.id);
      if (isTripped) { console.log(`[ForceToggle] 跳过熔断脚本 ${s.name}`); forceToggleLogs.push(`跳过熔断: ${s.name}+${trySource}`); continue; }

      let rawScript: string | null = null;
      try { rawScript = await storage.getScriptRaw(s.id); } catch (_e) {}
      if (!rawScript) { forceToggleLogs.push(`无rawScript: ${s.name}+${trySource}`); continue; }

      if (trySource === 'kw' || trySource === 'kg') {
        console.log(`[ForceToggle] ⚡ 快速路径 ${s.name} + ${trySource} (跳过QuickJS)...`);
        try {
          const fastUrl = await fastBuiltinMusicUrl(trySource, body.quality, songId || '', name, singer);
          if (fastUrl) {
            await storage.updateScriptStats(s.id, true, 0);
            await storage.recordScriptSuccess(s.id);
            return jsonResponse({ url: fastUrl, type: body.quality, source: trySource, quality: body.quality, lyric: '', cached: false, fallback: { toggled: true, originalSource, newSource: trySource }, scriptId: s.id, scriptName: s.name }, 200, '获取成功（快速换源）');
          }
        } catch (fe: any) {
          console.log(`[ForceToggle] ⚡ 快速路径失败: ${fe.message?.substring(0, 100)}, 回退到完整路径...`);
          forceToggleLogs.push(`快速路径失败: ${s.name}+${trySource}: ${fe.message?.substring(0, 80)}`);
        }
      }

      console.log(`[ForceToggle] 🔄 尝试 ${s.name} + ${trySource} 源...`);
      const runner = await getOrCreateRunner({ id: s.id, name: s.name, rawScript });
      try {
        console.log(`[ForceToggle] ✅ ${s.name} 初始化成功，发起请求...`);
        const result = await runner.request({
          source: trySource, action: 'musicUrl',
          info: { type: body.quality, musicInfo: { id: songId, name, singer, source: trySource, songmid: songId, meta: { songId: songId } } },
        });
        console.log(`[ForceToggle] 📊 ${s.name}+${trySource} 结果: url=${!!result.data.url}, data=${JSON.stringify(result.data || {}).substring(0, 100)}`);
        if (result.data.url) {
          await storage.updateScriptStats(s.id, true, 0);
          await storage.recordScriptSuccess(s.id);
          return jsonResponse({ url: result.data.url, type: result.data.type || body.quality, source: trySource, quality: body.quality, lyric: '', cached: false, fallback: { toggled: true, originalSource, newSource: trySource }, scriptId: s.id, scriptName: s.name }, 200, '获取成功（强制换源）');
        }
        forceToggleLogs.push(`${s.name}+${trySource}: url为空`);
      } catch (ftErr: any) {
        console.log(`[ForceToggle] ❌ ${s.name}+${trySource} 异常: ${ftErr.message?.substring(0, 120)}`);
        const diag = runner.getDiagnostics ? runner.getDiagnostics() : null;
        forceToggleLogs.push(`${s.name}+${trySource} 异常: ${ftErr.message?.substring(0, 80)}`);
        if (diag?.keyLogs) forceToggleLogs.push(...diag.keyLogs.slice(-20));
      }
    }
  }

  console.log(`[ForceToggle] 所有正常脚本失败，尝试降级(忽略熔断)...`);
  for (const s of allScripts) {
    if (!s.supportedSources.includes('wy')) continue;
    let rawScript: string | null = null;
    try { rawScript = await storage.getScriptRaw(s.id); } catch (_e) {}
    if (!rawScript) continue;
    const runner = await getOrCreateRunner({ id: s.id, name: s.name, rawScript });
    try {
      const result = await runner.request({ source: 'wy', action: 'musicUrl', info: { type: body.quality, musicInfo: { id: songId || '', name, singer, source: 'wy', songmid: songId || '', meta: { songId: songId || '' } } } });
      if (result.data.url) return jsonResponse({ url: result.data.url, type: result.data.type || body.quality, source: 'wy', quality: body.quality, lyric: '', cached: false, fallback: { toggled: true, originalSource, newSource: 'wy' }, scriptId: s.id, scriptName: s.name }, 200, '获取成功（强制换源-降级）');
      const diag = runner.getDiagnostics ? runner.getDiagnostics() : null;
      forceToggleLogs.push(`降级wy: url为空`);
      if (diag?.keyLogs) forceToggleLogs.push(...diag.keyLogs.slice(-20));
    } catch (e: any) {
      const diag = runner.getDiagnostics ? runner.getDiagnostics() : null;
      forceToggleLogs.push(`降级wy异常: ${e.message?.substring(0, 80)}`);
      if (diag?.keyLogs) forceToggleLogs.push(...diag.keyLogs.slice(-20));
    }
  }

  for (const s of allScripts) {
    if (!s.supportedSources.includes('kw')) continue;
    let rawScript: string | null = null;
    try { rawScript = await storage.getScriptRaw(s.id); } catch (_e) {}
    if (!rawScript) continue;
    const runner = await getOrCreateRunner({ id: s.id, name: s.name, rawScript });
    try {
      const result = await runner.request({ source: 'kw', action: 'musicUrl', info: { type: body.quality, musicInfo: { id: songId || '', name, singer, source: 'kw', songmid: songId || '', meta: { songId: songId || '' } } } });
      if (result.data.url) return jsonResponse({ url: result.data.url, type: result.data.type || body.quality, source: 'kw', quality: body.quality, lyric: '', cached: false, fallback: { toggled: true, originalSource, newSource: 'kw' }, scriptId: s.id, scriptName: s.name }, 200, '获取成功（强制换源-降级）');
      const diag = runner.getDiagnostics ? runner.getDiagnostics() : null;
      forceToggleLogs.push(`降级kw: url为空`);
      if (diag?.keyLogs) forceToggleLogs.push(...diag.keyLogs.slice(-20));
    } catch (e: any) {
      const diag = runner.getDiagnostics ? runner.getDiagnostics() : null;
      forceToggleLogs.push(`降级kw异常: ${e.message?.substring(0, 80)}`);
      if (diag?.keyLogs) forceToggleLogs.push(...diag.keyLogs.slice(-20));
    } finally { /* 不 dispose — runner 被缓存复用 */ }
  }

  return jsonResponse(null, 500, `没有支持 ${originalSource} 源的脚本且换源失败`, { source: originalSource, forceToggleLogs });
}

// ==================== 换源逻辑 ====================

interface ToggleResult {
  success: boolean;
  url?: string;
  type?: string;
  newSource?: string;
  matchedName?: string;
  matchedSinger?: string;
  message: string;
}

async function tryToggleSourceInternal(
  body: any, songId: string, name: string, singer: string,
  originalSource: string, excludeSources: string[],
  scriptId: string, scriptName: string, runner: ScriptRunner,
  storage: ScriptStorage, elapsedMs: number
): Promise<ToggleResult> {
  console.log(`[ToggleSource] === 函数被调用! originalSource=${originalSource}, name=${name}, singer=${singer}, songId=${songId} ===`);
  const keyword = `${name} ${singer}`.trim();
  const allSources = ['kw', 'kg', 'tx', 'wy', 'mg'];
  const sourcesToTry = allSources.filter(s => s !== originalSource && !excludeSources.includes(s));
  if (sourcesToTry.length === 0) return { success: false, message: '没有可用的换源源' };

  console.log(`[ToggleSource] 开始换源: "${keyword}", 原始源: ${originalSource}, 候选: [${sourcesToTry.join(',')}], 已耗时: ${elapsedMs}ms`);

  // 策略1：先尝试搜索匹配（精确）
  let matchedSongs: any[] = [];
  try {
    const searchPromises = sourcesToTry.map(async (source) => {
      try {
        const results = await searchService.search(keyword, source, 1, 10);
        const platformResult = results.find(r => r.platform === source);
        return { source, results: platformResult?.results || [] };
      } catch (e: any) { return { source, results: [] as any[] }; }
    });
    const searchResultsArray = await Promise.all(searchPromises);
    for (const { source, results } of searchResultsArray) {
      if (results.length === 0 || (results.length === 1 && !results[0].name)) continue;
      const matched = findBestMatch(results, name, singer, body.interval || body.musicInfo?.interval, body.albumName || body.musicInfo?.albumName || body.musicInfo?.album || '');
      if (matched) { matchedSongs.push({ ...matched, source }); console.log(`[ToggleSource] 搜索匹配 ${source}: ${matched.name} - ${matched.singer} (${(matched.matchScore || 0).toFixed(2)})`); }
    }
  } catch (e: any) { console.log(`[ToggleSource] 搜索阶段异常: ${e.message}`); }

  // 策略2：搜索无结果时，直接用原歌曲信息重试其他源（适用于聚合脚本如juhe）
  if (matchedSongs.length === 0) {
    console.log('[ToggleSource] 搜索未找到匹配，切换到直接重试模式（用原歌曲信息尝试所有候选源）');
    for (const src of sourcesToTry) {
      matchedSongs.push({ name, singer, source: src, songmid: songId || '', id: songId || '', hash: songId || '', interval: body.interval || body.musicInfo?.interval || '', albumName: body.albumName || body.musicInfo?.albumName || '', picUrl: body.picUrl || '', musicInfo: { name, singer, source: src, songmid: songId }, matchScore: 0.5 });
    }
  }

  // 按匹配度和成功率排序
  const sourceStats = await storage.getSourceStats();
  const sortedSongs = sortByMatchAndSuccessRate(matchedSongs, sourceStats[scriptId] || {});

  for (const song of sortedSongs) {
    const newSource = song.source;
    const newSongId = song.musicInfo?.songmid || song.songmid || song.id || song.hash;
    console.log(`[ToggleSource] 尝试 ${newSource} (songId: ${newSongId || '(原)'})`);

    try {
      const result = await runner.request({
        source: newSource, action: 'musicUrl',
        info: { type: body.quality, musicInfo: { id: newSongId || songId, name: song.name, singer: song.singer, source: newSource,
          songmid: newSongId || songId, interval: song.interval || '',
          meta: { songId: newSongId || songId },
          albumName: song.albumName || '', img: song.picUrl || '' }},
      });

      if (result.data.url) {
        await storage.updateSourceStats(scriptId, newSource, true);
        await storage.updateScriptStats(scriptId, true, 0);
        await storage.recordScriptSuccess(scriptId);
        return { success: true, url: result.data.url, type: result.data.type, newSource, matchedName: song.name, matchedSinger: song.singer, message: 'ok' };
      }
      await storage.updateSourceStats(scriptId, newSource, false);
    } catch (e: any) {
      console.log(`[ToggleSource] ${newSource} 异常: ${e.message}`);
      await storage.updateSourceStats(scriptId, newSource, false);
    }
  }

  return { success: false, message: '所有音源均获取失败' };
}

function findBestMatch(results: any[], targetName: string, targetSinger: string, targetInterval?: string, targetAlbumName?: string): any | null {
  if (results.length === 0) return null;

  const singersRxp = /、|&|;|；|\/|,|，|\|/;
  const sortSingle = (s: string) => singersRxp.test(s) ? s.split(singersRxp).sort((a, b) => a.localeCompare(b)).join('、') : (s || '');
  const filterStr = (s: string) => typeof s === 'string' ? s.replace(/\s|'|\.|,|，|&|"|、|\(|\)|（|）|`|~|-|<|>|\||\/|\]|\[|!|！/g, '').toLowerCase() : String(s || '').toLowerCase();
  const trimStr = (s: string) => typeof s === 'string' ? s.trim() : (s || '');
  const getIntv = (intv: string | number | undefined): number => {
    if (!intv) return 0;
    if (typeof intv === 'number') return intv;
    const parts = intv.split(':'); let result = 0, unit = 1;
    while (parts.length) { result += parseInt(parts.pop() || '0') * unit; unit *= 60; }
    return result;
  };

  const fName = filterStr(targetName), fSinger = filterStr(sortSingle(targetSinger)), fAlbum = filterStr(targetAlbumName || ''), fIntv = getIntv(targetInterval);

  const processed = results.map(item => ({
    ...item,
    fName: filterStr(trimStr(item.name || '')),
    fSinger: filterStr(sortSingle(trimStr(item.singer || ''))),
    fAlbum: filterStr(trimStr(item.albumName || '')),
    fIntv: getIntv(item.interval),
    intervalMatch: Math.abs((getIntv(item.interval) || fIntv) - (fIntv || getIntv(item.interval))) < 5 && !!fIntv,
    nameMatch: filterStr(trimStr(item.name || '')) === fName,
    singerMatch: filterStr(sortSingle(trimStr(item.singer || ''))) === fSinger,
    albumMatch: filterStr(trimStr(item.albumName || '')) === fAlbum,
  }));

  const sortMusic = (list: any[], fn: (item: any) => boolean) => ([...list.filter(fn), ...list.filter(item => !fn(item))]);
  let sorted = [...processed];
  sorted = sortMusic(sorted, i => i.singerMatch && i.nameMatch && i.intervalMatch);
  sorted = sortMusic(sorted, i => i.nameMatch && i.singerMatch && i.fAlbum === fAlbum);
  sorted = sortMusic(sorted, i => i.singerMatch && i.nameMatch);
  sorted = sortMusic(sorted, i => i.nameMatch && i.intervalMatch);
  sorted = sortMusic(sorted, i => i.singerMatch && i.intervalMatch);
  sorted = sortMusic(sorted, i => i.intervalMatch);
  sorted = sortMusic(sorted, i => i.nameMatch);
  sorted = sortMusic(sorted, i => i.singerMatch);

  const best = sorted[0];
  if (!best) return null;

  let score = 0;
  if (best.nameMatch) score += 0.4; else if (fName.includes(best.fName) || best.fName.includes(fName)) score += 0.2;
  if (best.singerMatch) score += 0.3; else if (fSinger.includes(best.fSinger) || best.fSinger.includes(fSinger)) score += 0.15;
  if (best.intervalMatch) score += 0.2;
  if (fAlbum && best.albumMatch) score += 0.1;
  score += Math.max(0, (processed.length - 1) / processed.length * 0.1);

  if (score < 0.3 && !best.intervalMatch) return null;
  return { ...best, matchScore: score };
}

function sortByMatchAndSuccessRate(songs: any[], sourceStats: { [source: string]: { success: number; fail: number } }): any[] {
  const getRate = (src: string) => { const s = sourceStats[src]; if (!s) return 0.5; const t = s.success + s.fail; return t === 0 ? 0.5 : s.success / t; };
  return songs.sort((a, b) => {
    const sA = (a.matchScore || 0) * 0.5 + getRate(a.source) * 0.3 + Math.min((sourceStats[a.source]?.success || 0) / 100, 0.2);
    const sB = (b.matchScore || 0) * 0.5 + getRate(b.source) * 0.3 + Math.min((sourceStats[b.source]?.success || 0) / 100, 0.2);
    return sB - sA;
  });
}

async function getLyricForMusicUrl(body: any, songId: string, name: string, singer: string, source: string): Promise<{ lyric: string; tlyric: string; rlyric: string; lxlyric: string }> {
  try {
    const musicInfo: any = { source };
    switch (source) {
      case 'kw': musicInfo.songmid = songId; break;
      case 'kg': musicInfo.hash = songId; musicInfo.name = name; break;
      case 'tx': musicInfo.songId = songId; break;
      case 'wy': musicInfo.songId = songId; break;
      case 'mg': musicInfo.copyrightId = songId; musicInfo.name = name; musicInfo.singer = singer; break;
    }
    const result = await lyricService.getLyric(musicInfo);
    return { lyric: result.lyric || '', tlyric: result.tlyric || '', rlyric: result.rlyric || '', lxlyric: result.lxlyric || '' };
  } catch (_e) { return { lyric: '', tlyric: '', rlyric: '', lxlyric: '' }; }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders() });

    const apiKey = await getApiKey(env.SCRIPTS_KV);
    const storage = new ScriptStorage(env.SCRIPTS_KV);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const apiKeyInPath = pathParts[0];
    
    const isApiCall = pathParts.length >= 2 && (pathParts[1] === 'api' || pathParts[1] === 'scripts');
    if (isApiCall && apiKeyInPath !== apiKey) return jsonResponse(null, 401, '无效的 API Key');

    try {
      switch (`${request.method} ${url.pathname}`) {
        case `GET /setup`:
          return jsonResponse({ apiKey, endpoints: {
            importScript: `POST /${apiKey}/api/scripts/import/url`,
            getMusicUrl: `POST /${apiKey}/api/music/url`,
            loadedScripts: `GET /${apiKey}/api/scripts/loaded`,
            search: `GET /${apiKey}/api/search?keyword=xxx&source=kw&page=1&limit=20`,
            songListDetail: `POST /${apiKey}/api/songlist/detail`,
            songListByLink: `POST /${apiKey}/api/songlist/detail/by-link`,
          }});

        case `POST /${apiKey}/api/scripts/import/url`:
          return await withTimeout(handleImportScriptFromUrl(request, storage), REQUEST_TIMEOUT_MS);

        case `POST /${apiKey}/api/scripts/import/raw`:
          return await withTimeout(handleImportScriptRaw(request, storage), REQUEST_TIMEOUT_MS);

        case `POST /${apiKey}/api/music/url`:
          return await withTimeout(handleGetMusicUrl(request, storage), REQUEST_TIMEOUT_MS);

        case `POST /${apiKey}/api/music/lyric`:
          return await withTimeout(handleGetLyric(request), REQUEST_TIMEOUT_MS);

        case `POST /${apiKey}/api/music/url/inline`:
          return await withTimeout(handleGetMusicUrlWithScript(request), REQUEST_TIMEOUT_MS);

        case `GET /${apiKey}/api/scripts/loaded`:
          return await withTimeout(handleGetLoadedScripts(request, storage), REQUEST_TIMEOUT_MS);

        case `POST /${apiKey}/api/scripts/default`:
          return await withTimeout(handleSetDefaultScript(request, storage), REQUEST_TIMEOUT_MS);

        case `GET /${apiKey}/api/scripts/default`:
          return await withTimeout(handleGetDefaultScript(storage), REQUEST_TIMEOUT_MS);

        case `POST /${apiKey}/api/scripts/delete`:
          return await withTimeout(handleDeleteScript(request, storage), REQUEST_TIMEOUT_MS);

        case `GET /${apiKey}/api/search`: case `GET /${apiKey}/api/search/`:
          return await withTimeout(handleSearch(request), REQUEST_TIMEOUT_MS);

        case `POST /${apiKey}/api/songlist/detail`:
          return await withTimeout(handleGetSongListDetail(request), REQUEST_TIMEOUT_MS);

        case `POST /${apiKey}/api/songlist/detail/by-link`:
          return await withTimeout(handleGetSongListDetailByLink(request), REQUEST_TIMEOUT_MS);

        case `GET /${apiKey}`:
          return jsonResponse({ status: 'ok', version: '1.0.0', endpoints: [
            'POST /{key}/api/scripts/import/url - 导入脚本',
            'POST /{key}/api/music/url - 获取音乐URL',
            'GET /{key}/api/scripts/loaded - 已加载脚本列表',
            'POST /{key}/api/scripts/default - 设置默认脚本',
            'GET /{key}/api/scripts/default - 获取默认脚本',
            'POST /{key}/api/scripts/delete - 删除脚本',
            'GET /{key}/api/search?keyword=xxx - 搜索歌曲',
            'POST /{key}/api/songlist/detail - 歌单详情',
            'POST /{key}/api/songlist/detail/by-link - 链接解析歌单',
          ]});

        default:
          if (url.pathname === '/' || url.pathname === '/health') return jsonResponse({ status: 'ok', service: 'cf-phg-music-server' });
          if (url.pathname === '/debug/fetch-test') {
            const testUrl = url.searchParams.get('url') || 'https://88.lxmusic.xn--fiqs8s/lxmusicv4/url/tx/000mNo691TTyRP/128k?sign=3d70d2d3dfde12d07c892b458cb768e8ee94418966c96654f66c9cad6e269814';
            try {
              const resp = await fetch(testUrl, { headers: { 'Content-Type': 'application/json', 'User-Agent': 'lx-music-desktop/2.0.0', 'X-Request-Key': 'lxmusic' } });
              const body = await resp.text();
              return jsonResponse({ status: resp.status, statusText: resp.statusText, bodyPreview: body.substring(0, 500) });
            } catch (e: any) {
              return jsonResponse({ error: e.message });
            }
          }
          return jsonResponse(null, 404, 'Not Found');
      }
    } catch (error: any) { return jsonResponse(null, 500, error.message || 'Internal Server Error'); }
  },
};

function corsHeaders(): Record<string, string> {
  return { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' };
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ms);
  try { const result = await promise; clearTimeout(timeoutId); return result; }
  catch (error: any) { clearTimeout(timeoutId); if (error.name === 'AbortError') throw new Error('请求超时 (' + ms + 'ms)'); throw error; }
}
