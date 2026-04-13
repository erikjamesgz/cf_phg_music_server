const log = {
  debug: (...args: any[]) => console.log("[ShortLink]", ...args),
  info: (...args: any[]) => console.log("[ShortLink]", ...args),
  warn: (...args: any[]) => console.warn("[ShortLink]", ...args),
  error: (...args: any[]) => console.error("[ShortLink]", ...args),
};

export interface ParseResult { source: string; id: string; }

export class ShortLinkService {
  private static readonly DOMAIN_MAP: Record<string, string> = {
    "music.163.com": "wy",
    "y.qq.com": "tx",
    "i.y.qq.com": "tx",
    "c6.y.qq.com": "tx",
    "kugou.com": "kg",
    "kugou.kugou.com": "kg",
    "m.kugou.com": "kg",
    "www2.kugou.kugou.com": "kg",
    "kuwo.cn": "kw",
    "www.kuwo.cn": "kw",
    "m.kuwo.cn": "kw",
    "music.migu.cn": "mg",
    "m.music.migu.cn": "mg",
    "app.c.nf.migu.cn": "mg",
  };

  private static readonly REGEXPS = {
    wy: {
      listDetailLink: /^.+(?:\?|&)id=(\d+)(?:&.*$|#.*$|$)/,
      listDetailLink2: /^.+\/playlist\/(\d+)\/\d+\/.+$/,
    },
    tx: {
      listDetailLink: /\/playlist\/(\d+)/,
      listDetailLink2: /[?&]id=(\d+)/,
    },
    kg: {
      listDetailLink: /^.+\/(\d+)\.html(?:\?.*|&.*$|#.*$|$)/,
      chainLink: /chain=(\w+)/,
      globalCollectionId: /global_collection_id=(\w+)/,
    },
    kw: {
      listDetailLink: /[?&]pid=(\d+)/,
      listDetailLink2: /\/playlist_detail\/(\d+)/,
    },
    mg: {
      listDetailLink: /[?&]id=(\d+)/,
      listDetailLink2: /\/playlist\/(\d+)/,
    },
  };

  async parseShortLink(link: string): Promise<ParseResult> {
    log.info("开始解析短链接:", link);
    const result = this.extractUrl(link);
    if (result) { log.info("从URL直接提取成功:", result); return result; }
    log.info("无法直接提取，尝试获取重定向...");
    return this.resolveRedirect(link);
  }

  async extractIdFromUrl(url: string, source: string): Promise<string | null> {
    log.info(`从URL提取ID, source: ${source}, url: ${url}`);
    if (source === "kg" && /^\d+$/.test(url)) {
      log.info("检测到酷狗码:", url);
      const listId = await this.getKugouListIdByCode(url);
      if (listId) { log.info("酷狗码解析成功, 歌单ID:", listId); return listId; }
    }
    const id = this.extractIdBySource(url, source);
    if (id) { log.info("直接从URL提取ID成功:", id); return id; }
    log.info("直接提取失败，尝试获取重定向...");
    try {
      const response = await fetch(url, { method: "HEAD", redirect: "manual", headers: { "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15" } });
      if (response.status >= 500) {
        const getResponse = await fetch(url, { method: "GET", redirect: "manual", headers: { "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15" } });
        const location = getResponse.headers.get("location");
        if (location) {
          log.info("获取到重定向地址:", location);
          const redirectId = this.extractIdBySource(location, source);
          if (redirectId) return redirectId;
        }
      } else {
        const location = response.headers.get("location");
        if (location) {
          log.info("获取到重定向地址:", location);
          const redirectId = this.extractIdBySource(location, source);
          if (redirectId) return redirectId;
        }
      }
    } catch (error: any) { log.error("获取重定向失败:", error.message); }
    return null;
  }

  extractUrl(url: string): ParseResult | null {
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname.replace(/^www\./, "");
      const source = (ShortLinkService.DOMAIN_MAP as any)[domain] || (ShortLinkService.DOMAIN_MAP as any)[urlObj.hostname];
      if (!source) { log.warn("未知的域名:", urlObj.hostname); return null; }
      const id = this.extractIdBySource(url, source);
      if (id) return { source, id };
      return null;
    } catch (error) { log.error("URL解析失败:", error); return null; }
  }

  private extractIdBySource(url: string, source: string): string | null {
    const regexps = (ShortLinkService.REGEXPS as any)[source];
    if (!regexps) return null;
    for (const key of Object.keys(regexps)) {
      const regExp = regexps[key];
      if (regExp.test(url)) {
        const match = url.match(regExp);
        if (match && match[1]) return match[1];
      }
    }
    return null;
  }

  private async getKugouListIdByCode(code: string): Promise<string | null> {
    try {
      log.info("通过酷狗码获取歌单ID:", code);
      const response = await fetch("http://t.kugou.com/command/", {
        method: "POST",
        headers: { "Content-Type": "application/json", "KG-RC": "1", "KG-THash": "network_super_call.cpp:3676261689:379", "User-Agent": "" },
        body: JSON.stringify({ appid: 1001, clientver: 9020, mid: "21511157a05844bd085308bc76ef3343", clienttime: 640612895, key: "36164c4015e704673c588ee202b9ecb8", data: code }),
      });
      if (!response.ok) throw new Error(`请求失败: ${response.status}`);
      const data = await response.json();
      log.info("酷狗码解析结果:", data);
      if (data.status !== 1 || !data.data?.info) { log.error("酷狗码解析失败:", data); return null; }
      const info = data.data.info;
      if (info.type === 2 || info.type === 4) {
        if (info.global_collection_id) return info.global_collection_id;
        if (info.id) return String(info.id);
      }
      log.error("不支持的酷狗码类型:", info.type);
      return null;
    } catch (error: any) { log.error("通过酷狗码获取歌单ID失败:", error.message); return null; }
  }

  private async resolveRedirect(link: string, retryNum: number = 0): Promise<ParseResult> {
    if (retryNum > 2) throw new Error("短链接解析重试次数超过限制");
    try {
      log.info(`发送HTTP请求获取重定向 (尝试 ${retryNum + 1}/3)...`);
      let response = await fetch(link, {
        method: "HEAD",
        redirect: "manual",
        headers: { "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1", "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8", "Accept-Language": "zh-CN,zh;q=0.9" },
      });
      if (response.status >= 500) {
        log.warn(`HEAD请求返回 ${response.status}，尝试GET请求...`);
        response = await fetch(link, {
          method: "GET",
          redirect: "manual",
          headers: { "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1", "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8", "Accept-Language": "zh-CN,zh;q=0.9" },
        });
        const location = response.headers.get("location");
        if (location && location !== link) {
          log.info("获取到重定向地址:", location);
          const result = this.extractUrl(location);
          if (result) { log.info("从重定向地址提取成功:", result); return result; }
          return this.resolveRedirect(location, retryNum + 1);
        }
        log.info("GET请求返回" + response.status + "，尝试从响应体提取...");
        try {
          const text = await response.text();
          if (text) {
            const fromBody = this.extractIdFromHtmlOrJs(text);
            if (fromBody) { log.info("从500响应体提取成功:", fromBody); return fromBody; }
          }
        } catch (_e: any) { log.warn("读取500响应体失败:", _e.message); }
        return this.extractFromPage(link);
      }
    } catch (error: any) {
      log.error("解析重定向失败:", error.message, error.stack);
      if (retryNum < 2) { log.warn("等待后重试..."); await new Promise(r => setTimeout(r, 500)); return this.resolveRedirect(link, retryNum + 1); }
      throw error;
    }
  }

  private async extractFromPage(link: string): Promise<ParseResult> {
    try {
      const response = await fetch(link, {
        headers: { "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1", "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8", "Accept-Language": "zh-CN,zh;q=0.9" },
      });
      if (!response.ok) throw new Error(`请求失败: ${response.status}`);
      const html = await response.text();
      if (html.includes("此歌单已被创建者设为隐私")) throw new Error("该歌单已被创建者设为隐私，无法访问");
      if (html.includes("歌单不存在") || html.includes("内容已失效")) throw new Error("歌单不存在或链接已失效");
      const kgGlobalMatch = html.match(/"global_collection_id":"(\w+)"/);
      if (kgGlobalMatch) return { source: "kg", id: kgGlobalMatch[1] };
      const wyMatch = html.match(/playlist\?id=(\d+)/);
      if (wyMatch) return { source: "wy", id: wyMatch[1] };
      const txMatch = html.match(/playlist\/(\d+)/);
      if (txMatch) return { source: "tx", id: txMatch[1] };
      const txMobileMatch = html.match(/playsquare\/(\d+)/);
      if (txMobileMatch) return { source: "tx", id: txMobileMatch[1] };
      const txDataMatch = html.match(/"disstid":\s*"?(\d+)"?/);
      if (txDataMatch) return { source: "tx", id: txDataMatch[1] };
      throw new Error("无法从页面内容中提取歌单信息，可能是链接已失效或歌单不存在");
    } catch (error: any) { log.error("从页面提取失败:", error.message, error.stack); throw error; }
  }

  private extractIdFromHtmlOrJs(text: string): ParseResult | null {
    const patterns = [
      { source: "tx", regex: /playlist[/_]?(\d{5,})/ },
      { source: "tx", regex: /"disstid":\s*"?(\d+)"?/ },
      { source: "tx", regex: /"playlistid"?:\s*"?(\d{5,})"?/i },
      { source: "wy", regex: /playlist\?id=(\d+)/ },
      { source: "kg", regex: /global_collection_id[=:]['"]?(\w{10,})/ },
      { source: "kw", regex: /pid[=:]\s*['"]?(\d+)/ },
    ];
    for (const { source, regex } of patterns) {
      const match = text.match(regex);
      if (match && match[1]) { log.info(`从JS/HTML中提取到${source} ID:`, match[1]); return { source, id: match[1] }; }
    }
    return null;
  }
}