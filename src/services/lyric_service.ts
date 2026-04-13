import { inflate, inflateRaw } from 'pako';

interface MusicInfo {
  source: string;
  songId?: string;
  songmid?: string;
  hash?: string;
  name?: string;
  singer?: string;
  copyrightId?: string;
}

interface LyricResult {
  lyric: string;
  tlyric: string;
  rlyric: string;
  lxlyric: string;
}

function encodeBase64(data: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < data.length; i++) binary += String.fromCharCode(data[i]);
  return btoa(binary);
}

function decodeBase64(str: string): Uint8Array {
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

class KuwoLyricService {
  private static readonly buf_key = new Uint8Array([0x79, 0x65, 0x65, 0x6c, 0x69, 0x6f, 0x6e]);

  async getLyric(musicInfo: MusicInfo): Promise<LyricResult> {
    const songId = musicInfo.songmid || musicInfo.songId;
    if (!songId) throw new Error('缺少songmid或songId参数');
    const params = this.buildParams(songId, true);
    const url = `http://newlyric.kuwo.cn/newlyric.lrc?${params}`;
    const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36' } });
    if (response.status !== 200) throw new Error(`请求失败: ${response.status}`);
    const buf = new Uint8Array(await response.arrayBuffer());
    const headerStr = new TextDecoder().decode(buf);
    const index = headerStr.indexOf('\r\n\r\n');
    if (index === -1) throw new Error('未找到数据分隔符');
    const headerLines = headerStr.slice(0, index).split('\r\n');
    const headers: Record<string, string> = {};
    for (const line of headerLines) { const ci = line.indexOf('='); if (ci !== -1) headers[line.slice(0, ci)] = line.slice(ci + 1); }
    const isGetLyricx = headers['lrcx'] === '1';
    const lrcData = buf.slice(index + 4);
    let result: Uint8Array;
    try { result = inflate(lrcData); if (!result || result.length === 0) throw new Error('解压结果为空'); } catch (e) { throw new Error(`解压失败: ${e}`); }
    if (!isGetLyricx) return { lyric: this.decodeGB18030(result), tlyric: '', rlyric: '', lxlyric: '' };
    const base64Str = new TextDecoder().decode(result);
    const buf_str = decodeBase64(base64Str);
    const buf_str_len = buf_str.length;
    const output = new Uint8Array(buf_str_len);
    let i = 0;
    while (i < buf_str_len) { let j = 0; while (j < KuwoLyricService.buf_key.length && i < buf_str_len) { output[i] = KuwoLyricService.buf_key[j] ^ buf_str[i]; i++; j++; } }
    const decrypted = this.decodeGB18030(output);
    return this.parseLyric(decrypted);
  }

  private buildParams(id: string, isGetLyricx: boolean): string {
    let params = `user=12345,web,web,web&requester=localhost&req=1&rid=MUSIC_${id}`;
    if (isGetLyricx) params += '&lrcx=1';
    const buf_str = new TextEncoder().encode(params);
    const output = new Uint8Array(buf_str.length);
    let i = 0;
    while (i < buf_str.length) { let j = 0; while (j < KuwoLyricService.buf_key.length && i < buf_str.length) { output[i] = KuwoLyricService.buf_key[j] ^ buf_str[i]; i++; j++; } }
    return encodeBase64(output);
  }

  private parseLyric(str: string): LyricResult {
    const lines = str.split('\n');
    const lrcLines: string[] = [];
    const lxlrcLines: string[] = [];
    for (const line of lines) {
      const trimmed = line.trim(); if (!trimmed) continue;
      const timeMatch = /^\[(\d{2}):(\d{2})\.(\d{2,3})\]/.exec(trimmed);
      if (!timeMatch) { lrcLines.push(trimmed); lxlrcLines.push(trimmed); continue; }
      const content = trimmed.replace(/^\[\d{2}:\d{2}\.\d{2,3}\]/, '');
      lrcLines.push(`[${timeMatch[1]}:${timeMatch[2]}.${timeMatch[3]}]${content.replace(/<\d+,\d+>/g, '')}`);
      const wordMatches = content.match(/<(\d+),(\d+)>([^<]*)/g);
      if (wordMatches) { const words = wordMatches.map(m => { const mm = /<(\d+),(\d+)>([^<]*)/.exec(m); return mm ? `<${mm[1]},${mm[2]}>${mm[3]}` : ''; }).join(''); lxlrcLines.push(`[${timeMatch[1]}:${timeMatch[2]}.${timeMatch[3]}]${words}`); }
      else lxlrcLines.push(`[${timeMatch[1]}:${timeMatch[2]}.${timeMatch[3]}]${content}`);
    }
    return { lyric: lrcLines.join('\n'), tlyric: '', rlyric: '', lxlyric: lxlrcLines.join('\n') };
  }

  private decodeGB18030(buf: Uint8Array): string {
    try { return new TextDecoder('gb18030').decode(buf); } catch (_e) { return new TextDecoder('gbk').decode(buf); }
  }
}

class KugouLyricService {
  async getLyric(musicInfo: MusicInfo): Promise<LyricResult> {
    const hash = musicInfo.hash;
    const name = musicInfo.name;
    if (!hash || !name) throw new Error('缺少hash或name参数');
    const searchUrl = `http://lyrics.kugou.com/search?ver=1&man=yes&client=pc&keyword=${encodeURIComponent(name)}&hash=${hash}&timelength=0&lrctxt=1`;
    const searchResponse = await fetch(searchUrl, { headers: { 'KG-RC': '1', 'KG-THash': 'expand_search_manager.cpp:852736169:451', 'User-Agent': 'KuGou2012-9020-ExpandSearchManager' } });
    if (searchResponse.status !== 200) throw new Error(`搜索请求失败: ${searchResponse.status}`);
    const searchData = await searchResponse.json();
    if (searchData.status !== 200 || !searchData.candidates || searchData.candidates.length === 0) throw new Error('未找到歌词候选');
    const candidate = searchData.candidates[0];
    const downloadUrl = `http://lyrics.kugou.com/download?ver=1&client=pc&id=${candidate.id}&accesskey=${candidate.accesskey}&fmt=krc&charset=utf8`;
    const downloadResponse = await fetch(downloadUrl, { headers: { 'User-Agent': 'KuGou2012-9020-ExpandSearchManager' } });
    if (downloadResponse.status !== 200) throw new Error(`下载请求失败: ${downloadResponse.status}`);
    const downloadData = await downloadResponse.json();
    if (downloadData.fmt === 'krc') return this.decodeKrc(downloadData.content);
    else if (downloadData.fmt === 'lrc') { const decoded = decodeBase64(downloadData.content); return { lyric: new TextDecoder().decode(decoded), tlyric: '', rlyric: '', lxlyric: '' }; }
    else throw new Error(`不支持的歌词格式: ${downloadData.fmt}`);
  }

  private async decodeKrc(content: string): Promise<LyricResult> {
    const enc_key = new Uint8Array([0x40, 0x47, 0x61, 0x77, 0x5e, 0x32, 0x74, 0x47, 0x51, 0x36, 0x31, 0x2d, 0xce, 0xd2, 0x6e, 0x69]);
    const buf_str = decodeBase64(content).slice(4);
    const decrypted = new Uint8Array(buf_str.length);
    for (let i = 0; i < buf_str.length; i++) decrypted[i] = buf_str[i] ^ enc_key[i % 16];
    let result: Uint8Array;
    try { result = inflate(decrypted); } catch (_e) { try { result = inflateRaw(decrypted); } catch (e2: any) { throw new Error('KRC解压失败: ' + e2.message); } }
    return this.parseKrc(new TextDecoder().decode(result));
  }

  private parseKrc(str: string): LyricResult {
    str = str.replace(/\r/g, '');
    const headExp = /^.*\[id:\$\w+\]\n/;
    if (headExp.test(str)) str = str.replace(headExp, '');
    let tlyric = '';
    let rlyric = '';
    const transMatch = str.match(/\[language:([\w=\\/+]+)\]/);
    if (transMatch) {
      str = str.replace(/\[language:[\w=\\/+]+\]\n/, '');
      try { const jsonStr = new TextDecoder().decode(decodeBase64(transMatch[1])); const json = JSON.parse(jsonStr); if (json.content) { for (const item of json.content) { if (item.type === 0) rlyric = item.lyricContent?.join('\n') || ''; else if (item.type === 1) tlyric = item.lyricContent?.join('\n') || ''; } } } catch (_e) {}
    }
    let li = 0;
    let lxlyric = str.replace(/\[((\d+),\d+)\].*/g, (match) => {
      const result = match.match(/\[((\d+),\d+)\].*/);
      if (!result) return match;
      let time = parseInt(result[2]); let ms = time % 1000; time = Math.floor(time / 1000);
      const m = Math.floor(time / 60).toString().padStart(2, '0'); const s = (time % 60).toString().padStart(2, '0');
      const timeStr = `${m}:${s}.${ms}`;
      if (rlyric) { const rl = rlyric.split('\n'); if (rl[li]) { rl[li] = `[${timeStr}]${rl[li]}`; rlyric = rl.join('\n'); } }
      if (tlyric) { const tl = tlyric.split('\n'); if (tl[li]) { tl[li] = `[${timeStr}]${tl[li]}`; tlyric = tl.join('\n'); } }
      li++;
      return match.replace(result[1], timeStr);
    });
    lxlyric = lxlyric.replace(/<(\d+,\d+),\d+>/g, '<$1>');
    const lyric = lxlyric.replace(/<\d+,\d+>/g, '');
    return { lyric, tlyric, rlyric, lxlyric };
  }
}

class QQMusicLyricService {
  async getLyric(musicInfo: MusicInfo): Promise<LyricResult> {
    const songId = musicInfo.songId || musicInfo.songmid;
    if (!songId) throw new Error('缺少songId参数');
    const url = `https://c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric_new.fcg?songmid=${songId}&g_tk=5381&loginUin=0&hostUin=0&format=json&inCharset=utf8&outCharset=utf-8&platform=yqq`;
    const response = await fetch(url, { headers: { 'Referer': 'https://y.qq.com/portal/player.html', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36' } });
    if (response.status !== 200) throw new Error(`请求失败: ${response.status}`);
    const data = await response.json();
    if (data.code !== 0) throw new Error(`API返回错误: code=${data.code}`);
    const result: LyricResult = { lyric: '', tlyric: '', rlyric: '', lxlyric: '' };
    if (data.lyric) result.lyric = this.decodeLyric(data.lyric);
    if (data.trans) result.tlyric = this.decodeLyric(data.trans);
    return result;
  }

  private decodeLyric(base64Str: string): string {
    try { const decoded = decodeBase64(base64Str); return new TextDecoder().decode(decoded); } catch (_e) { return ''; }
  }
}

class NeteaseLyricService {
  async getLyric(musicInfo: MusicInfo): Promise<LyricResult> {
    const songId = musicInfo.songId;
    if (!songId) throw new Error('缺少songId参数');
    const url = `https://music.163.com/api/song/lyric?id=${songId}&lv=1&kv=1&tv=-1`;
    const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Referer': 'https://music.163.com/' } });
    if (response.status !== 200) throw new Error(`请求失败: ${response.status}`);
    const data = await response.json();
    if (data.code !== 200) throw new Error(`API返回错误: code=${data.code}`);
    return { lyric: data.lrc?.lyric || '', tlyric: data.tlyric?.lyric || '', rlyric: data.romalrc?.lyric || '', lxlyric: '' };
  }
}

class MiguLyricService {
  private static readonly DELTA = 2654435769n;
  private static readonly MIN_LENGTH = 32;
  private static readonly keyArr = [27303562373562475n, 18014862372307051n, 22799692160172081n, 34058940340699235n, 30962724186095721n, 27303523720101991n, 27303523720101998n, 31244139033526382n, 28992395054481524n];

  private static toLong(str: string | bigint): bigint {
    const num = typeof str === 'string' ? BigInt('0x' + str) : str;
    const MAX = 9223372036854775807n; const MIN = -9223372036854775808n;
    if (num > MAX) return MiguLyricService.toLong(num - (1n << 64n)); else if (num < MIN) return MiguLyricService.toLong(num + (1n << 64n)); return num;
  }
  private static longToBytes(l: bigint): Uint8Array { const result = new Uint8Array(8); let num = l; for (let i = 0; i < 8; i++) { result[i] = Number(num & 0xffn); num >>= 8n; } return result; }
  private static toBigintArray(data: string): bigint[] { const length = Math.floor(data.length / 16); const jArr: bigint[] = []; for (let i = 0; i < length; i++) { const hex = data.substring(i * 16, (i * 16) + 16); jArr.push(MiguLyricService.toLong(hex)); } return jArr; }
  private static teaDecrypt(data: bigint[], key: bigint[]): bigint[] {
    const length = data.length; const lengthBitint = BigInt(length);
    if (length >= 1) {
      let j2 = data[0]; let j3 = MiguLyricService.toLong((6n + (52n / lengthBitint)) * MiguLyricService.DELTA);
      while (true) {
        const j4 = j3; if (j4 === 0n) break;
        const j5 = MiguLyricService.toLong(3n & (j4 >> 2n)); let j6 = lengthBitint;
        while (true) { j6--; if (j6 > 0n) { const j7 = data[Number(j6 - 1n)]; const temp1 = MiguLyricService.toLong(j2 ^ j4) + MiguLyricService.toLong(j7 ^ key[Number(MiguLyricService.toLong(3n & j6) ^ j5)]); const temp2 = MiguLyricService.toLong((j7 >> 5n) ^ (j2 << 2n)) + MiguLyricService.toLong((j2 >> 3n) ^ (j7 << 4n)); j2 = MiguLyricService.toLong(data[Number(j6)] - (temp1 ^ temp2)); data[Number(j6)] = j2; } else break; }
        const j8 = data[Number(lengthBitint - 1n)]; const temp1 = MiguLyricService.toLong(MiguLyricService.toLong(key[Number(MiguLyricService.toLong(j6 & 3n) ^ j5)] ^ j8) + MiguLyricService.toLong(j2 ^ j4));
        const temp2 = MiguLyricService.toLong((j8 >> 5n) ^ (j2 << 2n)) + MiguLyricService.toLong((j2 >> 3n) ^ (j8 << 4n)); j2 = MiguLyricService.toLong(data[0] - (temp1 ^ temp2)); data[0] = j2; j3 = MiguLyricService.toLong(j4 - MiguLyricService.DELTA);
      }
    }
    return data;
  }
  private static longArrToString(data: bigint[]): string { const result: string[] = []; for (const j of data) { const bytes = MiguLyricService.longToBytes(j); result.push(new TextDecoder('utf-16le').decode(bytes)); } return result.join(''); }
  private static decrypt(data: string): string { if (data == null || data.length < MiguLyricService.MIN_LENGTH) return data; const bigIntArray = MiguLyricService.toBigintArray(data); const decrypted = MiguLyricService.teaDecrypt(bigIntArray, MiguLyricService.keyArr); return MiguLyricService.longArrToString(decrypted); }

  private async getLyricText(url: string, tryNum = 0): Promise<string> {
    const response = await fetch(url, { headers: { 'Referer': 'https://app.c.nf.migu.cn/', 'User-Agent': 'Mozilla/5.0 (Linux; Android 5.1.1)', 'channel': '0146921' } });
    if (response.status === 200) return await response.text();
    if (tryNum > 5 || response.status === 404) throw new Error('歌词获取失败');
    await new Promise(r => setTimeout(r, 1000)); return this.getLyricText(url, tryNum + 1);
  }
  private parseLyric(str: string): LyricResult {
    const lines = str.replace(/\r/g, '').split('\n'); const lxlrcLines: string[] = []; const lrcLines: string[] = [];
    const lineTimeExp = /^\s*\[(\d+),\d+\]/; const wordTimeAllExp = /(\(\d+,\d+\))/g;
    for (const line of lines) { if (line.length < 6) continue; const result = lineTimeExp.exec(line); if (!result) continue;
      const startTime = parseInt(result[1]); let time = startTime; let ms = time % 1000; time = Math.floor(time / 1000);
      const m = Math.floor(time / 60).toString().padStart(2, '0'); time = time % 60; const s = Math.floor(time).toString().padStart(2, '0'); const timeStr = `${m}:${s}.${ms}`;
      let words = line.replace(lineTimeExp, ''); lrcLines.push(`[${timeStr}]${words.replace(wordTimeAllExp, '')}`);
      const times = words.match(wordTimeAllExp); if (!times) continue;
      const parsedTimes = times.map(t => { const m = /\((\d+),(\d+)\)/.exec(t); return m ? `<${parseInt(m[1]) - startTime},${m[2]}>` : ''; });
      const wordArr = words.split(/\(\d+,\d+\)/); lxlrcLines.push(`[${timeStr}]${parsedTimes.map((t, i) => `${t}${wordArr[i] || ''}`).join('')}`);
    }
    return { lyric: lrcLines.join('\n'), tlyric: '', rlyric: '', lxlyric: lxlrcLines.join('\n') };
  }
  private async getMrc(url: string): Promise<LyricResult> { const text = await this.getLyricText(url); return this.parseLyric(MiguLyricService.decrypt(text)); }
  private async getLrc(url: string): Promise<LyricResult> { const text = await this.getLyricText(url); return { lyric: text, tlyric: '', rlyric: '', lxlyric: '' }; }

  async getLyric(musicInfo: MusicInfo): Promise<LyricResult> {
    if (!musicInfo.copyrightId) throw new Error('缺少copyrightId参数');
    const searchUrl = `https://app.c.nf.migu.cn/MIGUM2.0/v1.0/content/search_all.do?isCopyright=1&isCorrect=1&pageNo=1&pageSize=10&searchSwitch=%7B%22song%22%3A1%7D&sort=0&text=${encodeURIComponent((musicInfo.name || '') + ' ' + (musicInfo.singer || ''))}`;
    const response = await fetch(searchUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36', 'Accept': 'application/json' } });
    if (response.status !== 200) throw new Error(`搜索歌曲失败: ${response.status}`);
    const data = await response.json();
    if (data.code !== '000000' || !data.songResultData || !data.songResultData.resultList) throw new Error('搜索歌曲失败: 无效的响应');
    let matchedSong: any = null;
    for (const item of data.songResultData.resultList) { const songs = Array.isArray(item) ? item : [item]; for (const song of songs) { if (song.copyrightId === musicInfo.copyrightId) { matchedSong = song; break; } } if (matchedSong) break; }
    if (!matchedSong) throw new Error('未找到匹配的歌曲');
    if (matchedSong.mrcurl) return this.getMrc(matchedSong.mrcurl);
    if (matchedSong.lyricUrl) return this.getLrc(matchedSong.lyricUrl);
    throw new Error('未找到歌词链接');
  }
}

export class LyricService {
  private kwService = new KuwoLyricService();
  private kgService = new KugouLyricService();
  private txService = new QQMusicLyricService();
  private wyService = new NeteaseLyricService();
  private mgService = new MiguLyricService();

  async getLyric(musicInfo: MusicInfo): Promise<LyricResult> {
    switch (musicInfo.source) {
      case 'kw': return await this.kwService.getLyric(musicInfo);
      case 'kg': return await this.kgService.getLyric(musicInfo);
      case 'tx': return await this.txService.getLyric(musicInfo);
      case 'wy': return await this.wyService.getLyric(musicInfo);
      case 'mg': return await this.mgService.getLyric(musicInfo);
      default: throw new Error(`不支持的歌词源: ${musicInfo.source}`);
    }
  }
}
