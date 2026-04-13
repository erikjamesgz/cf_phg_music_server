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
}

interface StorageData {
  scripts: ScriptInfo[];
  defaultSourceId: string | null;
}

const STORAGE_KEY = "dn_music_scripts";
const SOURCE_STATS_KEY = "source_stats";
const SCRIPT_STATS_KEY = "script_stats";
const CIRCUIT_BREAKER_KEY = "circuit_breaker";

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

const ALL_SOURCES = ['kw', 'kg', 'tx', 'wy', 'mg'] as const;
const MIN_SAMPLES = 5;
const EPSILON = 0.05;
const CIRCUIT_BREAKER_THRESHOLD = 3;
const CIRCUIT_BREAKER_RESET_TIME = 2 * 60 * 60 * 1000;

export class ScriptStorage {
  private kv: KVNamespace;

  constructor(kv: KVNamespace) {
    this.kv = kv;
  }

  async importScriptFromUrl(url: string): Promise<ScriptInfo> {
    if (!/^https?:\/\//.test(url)) throw new Error("无效的URL格式");
    const response = await fetch(url, { redirect: 'follow' });
    if (!response.ok) throw new Error(`下载失败: ${response.status}`);
    const script = await response.text();
    const scriptInfo = this.parseScriptInfo(script);
    let supportedSources = this.parseSupportedSources(script);
    if (supportedSources.length === 0 || (supportedSources.length === 1 && supportedSources[0] === 'unknown')) {
      supportedSources = ['kw', 'kg', 'tx', 'wy', 'mg'];
    }
    const data = await this.getStorageData();
    const isFirstScript = data.scripts.length === 0;
    const storageItem: ScriptInfo = { ...scriptInfo, scriptUrl: url, isDefault: isFirstScript, supportedSources, createdAt: Date.now(), updatedAt: Date.now() };
    data.scripts.push(storageItem);
    if (isFirstScript) data.defaultSourceId = storageItem.id;
    await this.kv.put(STORAGE_KEY, JSON.stringify(data));
    await this.kv.put(`raw_script_${storageItem.id}`, script);
    return storageItem;
  }

  async importScriptRaw(name: string, content: string, url: string = ''): Promise<ScriptInfo> {
    let scriptContent = content;
    try { scriptContent = atob(content); } catch (_e) {}
    const scriptInfo = this.parseScriptInfo(scriptContent);
    const supportedSources = this.parseSupportedSources(scriptContent);
    const data = await this.getStorageData();
    const isFirstScript = data.scripts.length === 0;
    const storageItem: ScriptInfo = { ...scriptInfo, name: name || scriptInfo.name, scriptUrl: url, isDefault: isFirstScript, supportedSources, createdAt: Date.now(), updatedAt: Date.now() };
    data.scripts.push(storageItem);
    if (isFirstScript) data.defaultSourceId = storageItem.id;
    await this.kv.put(STORAGE_KEY, JSON.stringify(data));
    await this.kv.put(`raw_script_${storageItem.id}`, scriptContent);
    return storageItem;
  }

  async getScripts(): Promise<ScriptInfo[]> {
    const data = await this.getStorageData();
    return data.scripts.map(s => ({ ...s, isDefault: s.id === data.defaultSourceId }));
  }

  async getScript(id: string): Promise<ScriptInfo | null> {
    const data = await this.getStorageData();
    const script = data.scripts.find(s => s.id === id);
    if (!script) return null;
    return { ...script, isDefault: script.id === data.defaultSourceId };
  }

  async getScriptRaw(id: string): Promise<string | null> {
    const kvContent = await this.kv.get(`raw_script_${id}`);
    if (kvContent) return kvContent;
    const item = await this.getScript(id);
    if (!item?.scriptUrl) return null;
    try {
      const response = await fetch(item.scriptUrl);
      if (response.ok) { const content = await response.text(); await this.kv.put(`raw_script_${id}`, content); return content; }
    } catch (e) { console.error(`[Storage] Failed to fetch script from URL:`, e); }
    return null;
  }

  getDefaultSourceId(): string | null { return null; }
  getScriptMetadata(id: string): ScriptInfo | null { return null; }

  private parseScriptInfo(script: string): ScriptInfo & { id: string } {
    const commentMatch = /^\/\*[\s\S]+?\*\//.exec(script);
    if (!commentMatch) throw new Error("无效的自定义源文件：缺少注释头部");
    const commentBlock = commentMatch[0];
    const info = this.parseCommentBlock(commentBlock);
    const supportedSources = this.parseSupportedSources(script);
    return { id: `user_api_${Math.random().toString(36).substring(2, 8)}_${Date.now()}`, name: info.name || 'unknown', description: info.description || '', author: info.author || '', homepage: info.homepage || '', version: info.version || '', supportedSources };
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

  private async getStorageData(): Promise<StorageData> {
    const cached = await this.kv.get(STORAGE_KEY);
    if (cached) return JSON.parse(cached);
    return { scripts: [], defaultSourceId: null };
  }

  async setDefaultScript(id: string): Promise<void> {
    const data = await this.getStorageData();
    data.defaultSourceId = id;
    await this.kv.put(STORAGE_KEY, JSON.stringify(data));
  }
  async getDefaultScript(): Promise<{id:string;name:string}|null> {
    const data = await this.getStorageData();
    if (!data.defaultSourceId) return null;
    const script = data.scripts.find(s => s.id === data.defaultSourceId);
    if (!script) return null;
    return { id: script.id, name: script.name };
  }

  async deleteScript(id: string): Promise<void> {
    await this.kv.delete(`raw_script_${id}`);
    await this.kv.delete('default_script');
    const data = await this.getStorageData();
    const filtered = data.scripts.filter(s => s.id !== id);
    if (data.defaultSourceId === id) data.defaultSourceId = filtered.length > 0 ? filtered[0].id : null;
    await this.kv.put(STORAGE_KEY, JSON.stringify({ scripts: filtered, defaultSourceId: data.defaultSourceId }));
  }

  // ==================== 脚本统计 ====================
  async getScriptStats(): Promise<ScriptStatsData> {
    try { const d = await this.kv.get(SCRIPT_STATS_KEY); if (d) return JSON.parse(d); } catch (_e) {}
    return {};
  }

  private async saveScriptStats(stats: ScriptStatsData): Promise<void> {
    await this.kv.put(SCRIPT_STATS_KEY, JSON.stringify(stats));
  }

  async updateScriptStats(scriptId: string, success: boolean, responseTime: number = 0): Promise<void> {
    const stats = await this.getScriptStats();
    if (!stats[scriptId]) stats[scriptId] = { success: 0, fail: 0, lastSuccessAt: 0, lastFailAt: 0, avgResponseTime: 0, totalRequests: 0 };
    const s = stats[scriptId];
    s.totalRequests++;
    if (success) { s.success++; s.lastSuccessAt = Date.now(); if (responseTime > 0) s.avgResponseTime = (s.avgResponseTime * (s.success - 1) + responseTime) / s.success; }
    else { s.fail++; s.lastFailAt = Date.now(); }
    await this.saveScriptStats(stats);
  }

  getScriptSuccessRate(stats: ScriptStats): number {
    const total = stats.success + stats.fail;
    if (total === 0) return 0.5;
    return stats.success / total;
  }

  // ==================== 源统计 ====================
  async getSourceStats(): Promise<ScriptSourceStats> {
    try { const d = await this.kv.get(SOURCE_STATS_KEY); if (d) return JSON.parse(d); } catch (_e) {}
    return {};
  }

  private async saveSourceStats(stats: ScriptSourceStats): Promise<void> {
    await this.kv.put(SOURCE_STATS_KEY, JSON.stringify(stats));
  }

  async updateSourceStats(scriptId: string, source: string, success: boolean): Promise<void> {
    const stats = await this.getSourceStats();
    if (!stats[scriptId]) stats[scriptId] = {};
    if (!stats[scriptId][source]) stats[scriptId][source] = { success: 0, fail: 0 };
    if (success) stats[scriptId][source].success++; else stats[scriptId][source].fail++;
    await this.saveSourceStats(stats);
  }

  private getSuccessRate(stats: SourceStats): number {
    const total = stats.success + stats.fail;
    if (total < MIN_SAMPLES) return -1;
    return stats.success / total;
  }

  async getSortedSourcesBySuccessRate(scriptId: string, excludeSources: string[] = []): Promise<string[]> {
    const stats = await this.getSourceStats();
    const scriptStats = stats[scriptId] || {};
    const sources = [...ALL_SOURCES].filter(s => !excludeSources.includes(s));
    if (Math.random() < EPSILON) { for (let i = sources.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [sources[i], sources[j]] = [sources[j], sources[i]]; } return sources; }
    return sources.sort((a, b) => {
      const rateA = this.getSuccessRate(scriptStats[a] || { success: 0, fail: 0 });
      const rateB = this.getSuccessRate(scriptStats[b] || { success: 0, fail: 0 });
      if (rateA === -1 && rateB === -1) return Math.random() - 0.5;
      if (rateA === -1) return 1; if (rateB === -1) return -1;
      if (Math.abs(rateA - rateB) < 0.01) return Math.random() - 0.5;
      return rateB - rateA;
    });
  }

  async getSortedScriptsBySuccessRate(scriptIds: string[], defaultScriptId: string | null): Promise<string[]> {
    const stats = await this.getScriptStats();
    return [...scriptIds].sort((a, b) => {
      if (a === defaultScriptId) return -1; if (b === defaultScriptId) return 1;
      const rateA = stats[a] ? this.getScriptSuccessRate(stats[a]) : 0.5;
      const rateB = stats[b] ? this.getScriptSuccessRate(stats[b]) : 0.5;
      return rateB - rateA;
    });
  }

  // ==================== 熔断器 ====================
  async getCircuitBreakerState(): Promise<CircuitBreakerData> {
    try { const d = await this.kv.get(CIRCUIT_BREAKER_KEY); if (d) return JSON.parse(d); } catch (_e) {}
    return {};
  }

  private async saveCircuitBreakerState(states: CircuitBreakerData): Promise<void> {
    await this.kv.put(CIRCUIT_BREAKER_KEY, JSON.stringify(states));
  }

  async isScriptCircuitBreakerTripped(scriptId: string): Promise<boolean> {
    const states = await this.getCircuitBreakerState();
    const state = states[scriptId];
    if (!state || !state.isTripped) return false;
    if (Date.now() >= state.resetAt) { state.isTripped = false; state.consecutiveFails = 0; await this.saveCircuitBreakerState(states); return false; }
    return true;
  }

  async recordScriptFailure(scriptId: string): Promise<boolean> {
    const states = await this.getCircuitBreakerState();
    if (!states[scriptId]) states[scriptId] = { isTripped: false, tripCount: 0, lastTripAt: 0, resetAt: 0, consecutiveFails: 0 };
    const state = states[scriptId];
    state.consecutiveFails++;
    if (state.consecutiveFails >= CIRCUIT_BREAKER_THRESHOLD && !state.isTripped) {
      state.isTripped = true; state.tripCount++; state.lastTripAt = Date.now(); state.resetAt = Date.now() + CIRCUIT_BREAKER_RESET_TIME;
      await this.saveCircuitBreakerState(states);
      return true;
    }
    await this.saveCircuitBreakerState(states);
    return false;
  }

  async recordScriptSuccess(scriptId: string): Promise<void> {
    const states = await this.getCircuitBreakerState();
    if (states[scriptId]) { const wasTripped = states[scriptId].isTripped; states[scriptId].consecutiveFails = 0; if (wasTripped) { states[scriptId].isTripped = false; await this.saveCircuitBreakerState(states); } }
  }

  // ==================== 获取脚本活跃ID列表（兼容dn接口）====================
  async getActiveScriptIds(): Promise<string[]> {
    const scripts = await this.getScripts();
    return scripts.map(s => s.id);
  }
}
