interface ScriptInfo {
  id: string;
  name: string;
  description: string;
  author: string;
  homepage: string;
  version: string;
  supportedSources: string[];
  scriptUrl?: string;
  isDefault: boolean;
  createdAt: number;
  updatedAt: number;
  rawScript?: string;
}

export interface SourceStats {
  success: number;
  fail: number;
}

export interface ScriptSourceStats {
  [scriptId: string]: { [source: string]: SourceStats };
}

export interface ScriptStats {
  success: number;
  fail: number;
  lastSuccessAt: number;
  lastFailAt: number;
  avgResponseTime: number;
  totalRequests: number;
}

export interface ScriptStatsData {
  [scriptId: string]: ScriptStats;
}

export interface CircuitBreakerState {
  isTripped: boolean;
  tripCount: number;
  lastTripAt: number;
  resetAt: number;
  consecutiveFails: number;
}

export interface CircuitBreakerData {
  [scriptId: string]: CircuitBreakerState;
}

export interface AppData {
  scripts: ScriptInfo[];
  scriptStats: ScriptStatsData;
  sourceStats: ScriptSourceStats;
  circuitBreakers: CircuitBreakerData;
  defaultSourceId: string | null;
}

const ALL_SOURCES = ['kw', 'kg', 'tx', 'wy', 'mg'] as const;
const MIN_SAMPLES = 5;
const EPSILON = 0.05;
const CIRCUIT_BREAKER_THRESHOLD = 3;
const CIRCUIT_BREAKER_RESET_TIME = 2 * 60 * 60 * 1000;
const STORAGE_KEY = 'app_data';

function emptyAppData(): AppData {
  return {
    scripts: [],
    scriptStats: {},
    sourceStats: {},
    circuitBreakers: {},
    defaultSourceId: null,
  };
}

export class ScriptStorage {
  private db: D1Database;
  private _cache: AppData | null = null;
  private _dirty = false;

  constructor(db: D1Database) {
    this.db = db;
  }

  private async ensureCache(): Promise<void> {
    if (this._cache !== null) return;
    try {
      const row = await this.db.prepare('SELECT value FROM storage WHERE key=?').bind(STORAGE_KEY).first<{value:string}>();
      if (!row) {
        this._cache = emptyAppData();
        this._dirty = true;
        return;
      }
      try {
        const parsed = JSON.parse(row.value) as Partial<AppData>;
        this._cache = {
          ...emptyAppData(),
          ...parsed,
          scriptStats: { ...emptyAppData().scriptStats, ...(parsed.scriptStats || {}) },
          sourceStats: { ...emptyAppData().sourceStats, ...(parsed.sourceStats || {}) },
          circuitBreakers: { ...emptyAppData().circuitBreakers, ...(parsed.circuitBreakers || {}) },
        };
      } catch {
        this._cache = emptyAppData();
      }
    } catch (e: any) {
      if (e.message?.includes('no such table')) {
        await this.db.exec(`CREATE TABLE IF NOT EXISTS storage (key TEXT PRIMARY KEY, value TEXT)`);
        this._cache = emptyAppData();
        this._dirty = true;
        return;
      }
      throw e;
    }
    this._dirty = false;
  }

  private markDirty(): void {
    this._dirty = true;
  }

  async flush(): Promise<void> {
    if (!this._dirty || !this._cache) return;
    try {
      await this.db.prepare('INSERT OR REPLACE INTO storage (key,value) VALUES (?,?)').bind(STORAGE_KEY, JSON.stringify(this._cache)).run();
    } catch (e: any) {
      console.error('[Storage] flush error:', e.message, e.stack);
      if (e.message?.includes('no such table')) {
        try {
          await this.db.exec(`CREATE TABLE IF NOT EXISTS storage (key TEXT PRIMARY KEY, value TEXT)`);
          await this.db.prepare('INSERT OR REPLACE INTO storage (key,value) VALUES (?,?)').bind(STORAGE_KEY, JSON.stringify(this._cache)).run();
        } catch (e2: any) {
          console.error('[Storage] flush after create table error:', e2.message);
        }
      }
    }
    this._dirty = false;
  }

  async importScriptFromUrl(url: string): Promise<ScriptInfo> {
    if (!/^https?:\/\//.test(url)) throw new Error("无效的URL格式");
    const response = await fetch(url, { redirect: 'follow' });
    if (!response.ok) throw new Error(`下载失败: ${response.status}`);
    const script = await response.text();
    await this.ensureCache();
    return this.importScriptInternal(script, url);
  }

  async importScriptRaw(name: string, content: string, url: string = ''): Promise<ScriptInfo> {
    let scriptContent = content;
    try { scriptContent = atob(content); } catch (_e) {}
    await this.ensureCache();
    return this.importScriptInternal(scriptContent, url, name);
  }

  private importScriptInternal(scriptContent: string, url: string = '', overrideName?: string): ScriptInfo {
    const data = this._cache!;
    const scriptInfo = this.parseScriptInfo(scriptContent);
    let supportedSources = this.parseSupportedSources(scriptContent);
    if (supportedSources.length === 0 || (supportedSources.length === 1 && supportedSources[0] === 'unknown')) {
      supportedSources = ['kw', 'kg', 'tx', 'wy', 'mg'];
    }
    const isFirstScript = data.scripts.length === 0;
    const now = Date.now();
    const item: ScriptInfo = {
      ...scriptInfo,
      name: overrideName || scriptInfo.name,
      scriptUrl: url,
      isDefault: isFirstScript,
      supportedSources,
      rawScript: scriptContent,
      createdAt: now,
      updatedAt: now
    };
    data.scripts.push(item);
    if (isFirstScript) {
      data.defaultSourceId = item.id;
    }
    this.markDirty();
    return item;
  }

  async getScripts(): Promise<ScriptInfo[]> {
    await this.ensureCache();
    const data = this._cache!;
    return data.scripts.map(s => ({
      ...s,
      isDefault: s.id === data.defaultSourceId,
    }));
  }

  async getScript(id: string): Promise<ScriptInfo | null> {
    await this.ensureCache();
    const data = this._cache!;
    const s = data.scripts.find(s => s.id === id);
    if (!s) return null;
    return { ...s, isDefault: s.id === data.defaultSourceId };
  }

  async getScriptRaw(id: string): Promise<string | null> {
    await this.ensureCache();
    const data = this._cache!;
    const s = data.scripts.find(s => s.id === id);
    if (!s) return null;
    if (s.rawScript) return s.rawScript;
    if (!s.scriptUrl) return null;
    try {
      const resp = await fetch(s.scriptUrl);
      if (resp.ok) {
        const content = await resp.text();
        s.rawScript = content;
        s.updatedAt = Date.now();
        this.markDirty();
        return content;
      }
    } catch (e) { console.error('[Storage] Failed to fetch script from URL:', e); }
    return null;
  }

  async setDefaultScript(id: string): Promise<void> {
    await this.ensureCache();
    const data = this._cache!;
    if (!data.scripts.find(s => s.id === id)) throw new Error('脚本不存在');
    data.defaultSourceId = id;
    this.markDirty();
  }

  async getDefaultScript(): Promise<{id:string;name:string}|null> {
    await this.ensureCache();
    const data = this._cache!;
    if (!data.defaultSourceId) return null;
    const s = data.scripts.find(s => s.id === data.defaultSourceId);
    if (!s) return null;
    return { id: s.id, name: s.name };
  }

  async deleteScript(id: string): Promise<void> {
    await this.ensureCache();
    const data = this._cache!;
    if (!data.scripts.find(s => s.id === id)) throw new Error('脚本不存在');
    data.scripts = data.scripts.filter(s => s.id !== id);
    delete data.scriptStats[id];
    delete data.sourceStats[id];
    delete data.circuitBreakers[id];
    if (data.defaultSourceId === id) {
      data.defaultSourceId = data.scripts[0]?.id || null;
    }
    this.markDirty();
  }

  async getScriptStats(): Promise<ScriptStatsData> {
    await this.ensureCache();
    return { ...this._cache!.scriptStats };
  }

  async updateScriptStats(scriptId: string, success: boolean, responseTime: number = 0): Promise<void> {
    await this.ensureCache();
    const data = this._cache!;
    const stats = data.scriptStats[scriptId] || { success: 0, fail: 0, lastSuccessAt: 0, lastFailAt: 0, avgResponseTime: 0, totalRequests: 0 };
    const newTotal = stats.totalRequests + 1;
    const newSuccess = stats.success + (success ? 1 : 0);
    const newFail = stats.fail + (success ? 0 : 1);
    const newAvg = success && responseTime > 0 ? (stats.avgResponseTime * (newSuccess - 1) + responseTime) / newSuccess : stats.avgResponseTime;
    data.scriptStats[scriptId] = {
      success: newSuccess, fail: newFail,
      lastSuccessAt: success ? Date.now() : stats.lastSuccessAt,
      lastFailAt: success ? stats.lastFailAt : Date.now(),
      avgResponseTime: newAvg, totalRequests: newTotal,
    };
    this.markDirty();
  }

  getScriptSuccessRate(stats: ScriptStats): number {
    const total = stats.success + stats.fail;
    if (total === 0) return 0.5;
    return stats.success / total;
  }

  async getSourceStats(): Promise<ScriptSourceStats> {
    await this.ensureCache();
    return JSON.parse(JSON.stringify(this._cache!.sourceStats));
  }

  async updateSourceStats(scriptId: string, source: string, success: boolean): Promise<void> {
    await this.ensureCache();
    const data = this._cache!;
    if (!data.sourceStats[scriptId]) data.sourceStats[scriptId] = {};
    const s = data.sourceStats[scriptId][source] || { success: 0, fail: 0 };
    data.sourceStats[scriptId][source] = {
      success: s.success + (success ? 1 : 0),
      fail: s.fail + (success ? 0 : 1),
    };
    this.markDirty();
  }

  private getSuccessRate(stats: SourceStats): number {
    const total = stats.success + stats.fail;
    if (total < MIN_SAMPLES) return -1;
    return stats.success / total;
  }

  async getSortedSourcesBySuccessRate(scriptId: string, excludeSources: string[] = []): Promise<string[]> {
    await this.ensureCache();
    const data = this._cache!;
    const stats = data.sourceStats[scriptId] || {};
    const sources = [...ALL_SOURCES].filter(s => !excludeSources.includes(s));
    if (Math.random() < EPSILON) {
      for (let i = sources.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [sources[i], sources[j]] = [sources[j], sources[i]];
      }
      return sources;
    }
    return sources.sort((a, b) => {
      const rateA = this.getSuccessRate(stats[a] || { success: 0, fail: 0 });
      const rateB = this.getSuccessRate(stats[b] || { success: 0, fail: 0 });
      if (rateA === -1 && rateB === -1) return Math.random() - 0.5;
      if (rateA === -1) return 1; if (rateB === -1) return -1;
      if (Math.abs(rateA - rateB) < 0.01) return Math.random() - 0.5;
      return rateB - rateA;
    });
  }

  async getSortedScriptsBySuccessRate(scriptIds: string[], defaultScriptId: string | null): Promise<string[]> {
    await this.ensureCache();
    const stats = this._cache!.scriptStats;
    return [...scriptIds].sort((a, b) => {
      if (a === defaultScriptId) return -1; if (b === defaultScriptId) return 1;
      const rateA = stats[a] ? this.getScriptSuccessRate(stats[a]) : 0.5;
      const rateB = stats[b] ? this.getScriptSuccessRate(stats[b]) : 0.5;
      return rateB - rateA;
    });
  }

  async isScriptCircuitBreakerTripped(scriptId: string): Promise<boolean> {
    await this.ensureCache();
    const data = this._cache!;
    const cb = data.circuitBreakers[scriptId];
    if (!cb || !cb.isTripped) return false;
    if (Date.now() >= cb.resetAt) {
      cb.isTripped = false;
      cb.consecutiveFails = 0;
      this.markDirty();
      return false;
    }
    return true;
  }

  async recordScriptFailure(scriptId: string): Promise<boolean> {
    await this.ensureCache();
    const data = this._cache!;
    if (!data.circuitBreakers[scriptId]) {
      data.circuitBreakers[scriptId] = { isTripped: false, tripCount: 0, lastTripAt: 0, resetAt: 0, consecutiveFails: 0 };
    }
    const cb = data.circuitBreakers[scriptId];
    cb.consecutiveFails++;
    if (cb.consecutiveFails >= CIRCUIT_BREAKER_THRESHOLD && !cb.isTripped) {
      cb.isTripped = true;
      cb.tripCount++;
      cb.lastTripAt = Date.now();
      cb.resetAt = Date.now() + CIRCUIT_BREAKER_RESET_TIME;
      this.markDirty();
      return true;
    }
    this.markDirty();
    return false;
  }

  async recordScriptSuccess(scriptId: string): Promise<void> {
    await this.ensureCache();
    const data = this._cache!;
    const cb = data.circuitBreakers[scriptId];
    if (cb?.isTripped) {
      cb.isTripped = false;
      cb.consecutiveFails = 0;
      this.markDirty();
    }
  }

  async getActiveScriptIds(): Promise<string[]> {
    await this.ensureCache();
    return this._cache!.scripts.map(s => s.id);
  }

  private parseScriptInfo(script: string): ScriptInfo & { id: string } {
    const commentMatch = /^\/\*[\s\S]+?\*\//.exec(script);
    if (!commentMatch) throw new Error("无效的自定义源文件：缺少注释头部");
    const commentBlock = commentMatch[0];
    const info = this.parseCommentBlock(commentBlock);
    const supportedSources = this.parseSupportedSources(script);
    return { id: `user_api_${Math.random().toString(36).substring(2, 8)}_${Date.now()}`, name: info.name || 'unknown', description: info.description || '', author: info.author || '', homepage: info.homepage || '', version: info.version || '', supportedSources, isDefault: false, createdAt: 0, updatedAt: 0 } as ScriptInfo & { id: string };
  }

  private parseCommentBlock(commentBlock: string): Record<string, string> {
    const INFO_NAMES: Record<string, number> = { name: 24, description: 36, author: 56, homepage: 1024, version: 36 };
    const infoArr = commentBlock.split(/\r?\n/);
    const rxp = /^\s?\*\s?@(\w+)\s(.+)$/;
    const infos: Record<string, string> = {};
    for (const info of infoArr) { const result = rxp.exec(info); if (!result) continue; const key = result[1] as keyof typeof INFO_NAMES; if (INFO_NAMES[key] == null) continue; infos[key] = result[2].trim(); }
    for (const [key, len] of Object.entries(INFO_NAMES)) { infos[key] ||= ''; if (infos[key] && infos[key].length > len) infos[key] = infos[key].substring(0, len); }
    return infos;
  }

  private parseSupportedSources(script: string): string[] {
    const sources: string[] = [];
    const ALL_POSSIBLE = ['kw', 'kg', 'tx', 'wy', 'mg'];
    const patterns = [
      /['"]?(kw|kg|tx|wy|mg)['"]?\s*:/g,
      /source[s]?\s*[:=]\s*\[([^\]]+)\]/g,
      /MUSIC_SOURCE\s*[=:]\s*Object\.keys\s*\(\s*MUSIC_QUALITY\s*\)/g,
      /MUSIC_QUALITY\s*[=\{]/g,
    ];
    for (const pattern of patterns) {
      const matches = script.matchAll(pattern);
      for (const match of matches) {
        if (match[1]) {
          const sourceList = match[1].match(/['"]?(kw|kg|tx|wy|mg)['"]?/g);
          if (sourceList) { for (const s of sourceList) { const clean = s.replace(/['"]/g, '').trim(); if (!sources.includes(clean)) sources.push(clean); } }
        } else {
          for (const src of ALL_POSSIBLE) { if (match[0].includes(src) && !sources.includes(src)) sources.push(src); }
        }
      }
    }
    if (sources.length === 0) {
      for (const src of ALL_POSSIBLE) {
        const regex = new RegExp(`['"]${src}['"]|\\b${src}\\b\\s*:`, 'gi');
        if (regex.test(script)) { sources.push(src); }
      }
      if (sources.length === 0) {
        for (const src of ALL_POSSIBLE) {
          const obfuscatedPatterns = [
            new RegExp(`[|&'\\"]${src}[|&'\\"]`, 'g'),
            new RegExp(`[|&'\\"]${src}`, 'g'),
            new RegExp(`${src}[|&'\\"]`, 'g'),
            new RegExp(`\\d*${src}\\b`, 'g'),
            new RegExp(`\\b${src}\\d*`, 'g'),
          ];
          for (const pat of obfuscatedPatterns) { if (pat.test(script)) { if (!sources.includes(src)) sources.push(src); break; } }
        }
      }
      if (sources.length === 0 && script.includes('@name')) { return [...ALL_POSSIBLE]; }
      if (sources.length === 0 && (script.includes('jsjiami') || script.includes('聚合') || script.includes('MUSIC_SOURCE') || script.includes('musicUrl'))) { return [...ALL_POSSIBLE]; }
    }
    return sources.length > 0 ? sources : ['unknown'];
  }
}
