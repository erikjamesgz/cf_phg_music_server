// 歌单服务 - 支持5个平台
import { linuxapi } from '../utils/crypto.ts';
import { md5 } from '../utils/md5.ts';

export interface SongInfo {
  id: string; name: string; singer: string; albumName: string; albumId?: string;
  interval: string; source: string; songmid?: string; hash?: string; songId?: string;
  copyrightId?: string; strMediaMid?: string; img?: string;
}
export interface SongListInfo { name: string; img: string; desc: string; author: string; play_count: string; }
export interface SongListResult { list: SongInfo[]; page: number; limit: number; total: number; source: string; info: SongListInfo; }

// ==================== 网易云音乐歌单服务 ====================
class NeteaseSongListService {
  private static readonly API_URL = "https://music.163.com/api/linux/forward";
  private static readonly SUCCESS_CODE = 200;

  private parseListId(input: string): string {
    const regExp = /[?&]id=(\d+)/;
    if (regExp.test(input)) return input.replace(regExp, "$1");
    return input;
  }

  private formatPlayCount(count: number): string {
    if (count > 10000) return (count / 10000).toFixed(1) + "万";
    return String(count);
  }

  private formatPlayTime(interval: number): string {
    const m = Math.floor(interval / 60).toString().padStart(2, "0");
    const s = (interval % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }

  private async getMusicDetail(ids: number[]): Promise<any[]> {
    if (ids.length === 0) return [];
    try {
      const encrypted = linuxapi({
        method: "POST",
        url: "https://music.163.com/api/v3/song/detail",
        params: { c: '[' + ids.map(id => ('{"id":' + id + '}')).join(',') + ']' },
      });
      const response = await fetch(NeteaseSongListService.API_URL, {
        method: "POST",
        headers: {
          "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.90 Safari/537.36",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams(encrypted),
      });
      if (!response.ok) throw new Error(`获取歌曲详情失败: ${response.status}`);
      const data = await response.json();
      if (data.code !== NeteaseSongListService.SUCCESS_CODE) throw new Error("获取歌曲详情失败");
      return data.songs || [];
    } catch (error: any) {
      console.error("[SongList] 获取歌曲详情失败:", error.message);
      return [];
    }
  }

  async getListDetail(rawId: string): Promise<SongListResult> {
    const id = this.parseListId(rawId);
    console.log("[SongList] 获取网易云歌单详情, id:", id);
    try {
      const encrypted = linuxapi({
        method: "POST",
        url: "https://music.163.com/api/v3/playlist/detail",
        params: { id: parseInt(id), n: 100000, s: 8 },
      });
      const response = await fetch(NeteaseSongListService.API_URL, {
        method: "POST",
        headers: {
          "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.90 Safari/537.36",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams(encrypted),
      });
      if (!response.ok) throw new Error(`请求失败: ${response.status}`);
      const data = await response.json();
      if (data.code !== NeteaseSongListService.SUCCESS_CODE || !data.playlist) throw new Error("获取歌单失败");

      const playlist = data.playlist;
      const privileges = data.privileges || [];
      const trackIds = playlist.trackIds || [];
      let list: SongInfo[] = [];

      if (trackIds.length === privileges.length && playlist.tracks.length === trackIds.length) {
        list = playlist.tracks.map((item: any, index: number) => {
          const privilege = privileges[index] || {};
          return {
            id: String(item.id), name: item.name, singer: item.ar?.map((a: any) => a.name).join("、") || "",
            albumName: item.al?.name || "", albumId: String(item.al?.id || ""),
            interval: this.formatPlayTime(Math.floor(item.dt / 1000)), source: "wy",
            songmid: String(item.id), img: item.al?.picUrl || "",
          };
        });
      } else {
        const batchSize = 1000;
        for (let i = 0; i < trackIds.length; i += batchSize) {
          const batchTrackIds = trackIds.slice(i, i + batchSize);
          const ids = batchTrackIds.map((t: any) => t.id);
          const songs = await this.getMusicDetail(ids);
          const batchList = songs.map((item: any) => ({
            id: String(item.id), name: item.name, singer: item.ar?.map((a: any) => a.name).join("、") || "",
            albumName: item.al?.name || "", albumId: String(item.al?.id || ""),
            interval: this.formatPlayTime(Math.floor(item.dt / 1000)), source: "wy",
            songmid: String(item.id), img: item.al?.picUrl || "",
          }));
          list = list.concat(batchList);
        }
      }

      return {
        list, page: 1, limit: list.length, total: list.length, source: "wy",
        info: {
          name: playlist.name, img: playlist.coverImgUrl, desc: playlist.description || "",
          author: playlist.creator?.nickname || "", play_count: this.formatPlayCount(playlist.playCount),
        },
      };
    } catch (error: any) {
      console.error("[SongList] 获取网易云歌单失败:", error.message);
      throw error;
    }
  }
}

// ==================== QQ音乐歌单服务 ====================
class QQMusicSongListService {
  private static readonly SUCCESS_CODE = 0;

  private parseListId(input: string): string {
    const regExp1 = /\/playlist\/(\d+)/;
    const regExp2 = /[?&]id=(\d+)/;
    if (regExp1.test(input)) return input.replace(regExp1, "$1");
    if (regExp2.test(input)) return input.replace(regExp2, "$1");
    return input;
  }

  private formatPlayCount(count: number): string {
    if (count > 10000) return (count / 10000).toFixed(1) + "万";
    return String(count);
  }

  private formatPlayTime(interval: number): string {
    const m = Math.floor(interval / 60).toString().padStart(2, "0");
    const s = (interval % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }

  private decodeName(name: string): string {
    return name.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&#x2F;/g, "/").replace(/&#x60;/g, "`").replace(/&#39;/g, "'").replace(/&nbsp;/g, " ");
  }

  async getListDetail(rawId: string, page: number = 1): Promise<SongListResult> {
    const id = this.parseListId(rawId);
    console.log("[SongList] 获取QQ音乐歌单详情, id:", id);
    try {
      const url = `https://c.y.qq.com/qzone/fcg-bin/fcg_ucc_getcdinfo_byids_cp.fcg?type=1&json=1&utf8=1&onlysong=0&new_format=1&disstid=${id}&loginUin=0&hostUin=0&format=json&inCharset=utf8&outCharset=utf-8&notice=0&platform=yqq.json&needNewCode=0`;
      const response = await fetch(url, {
        headers: {
          "Origin": "https://y.qq.com",
          "Referer": `https://y.qq.com/n/yqq/playsquare/${id}.html`,
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });
      if (!response.ok) throw new Error(`请求失败: ${response.status}`);
      const data = await response.json();
      if (data.code !== QQMusicSongListService.SUCCESS_CODE || !data.cdlist || data.cdlist.length === 0) throw new Error("获取歌单失败");

      const cdlist = data.cdlist[0];
      const list: SongInfo[] = cdlist.songlist.map((item: any) => ({
        id: String(item.id), name: item.title, singer: item.singer?.map((s: any) => s.name).join("、") || "",
        albumName: item.album?.name || "", albumId: item.album?.mid || "",
        interval: this.formatPlayTime(item.interval), source: "tx",
        songmid: item.mid, songId: String(item.id), strMediaMid: item.file?.media_mid || "",
        img: item.album?.name ? `https://y.gtimg.cn/music/photo_new/T002R500x500M000${item.album.mid}.jpg` : (item.singer?.length ? `https://y.gtimg.cn/music/photo_new/T001R500x500M000${item.singer[0].mid}.jpg` : ""),
      }));

      return {
        list, page: 1, limit: list.length + 1, total: cdlist.songlist.length, source: "tx",
        info: {
          name: cdlist.dissname, img: cdlist.logo, desc: this.decodeName(cdlist.desc).replace(/<br>/g, "\n"),
          author: cdlist.nickname, play_count: this.formatPlayCount(cdlist.visitnum),
        },
      };
    } catch (error: any) {
      console.error("[SongList] 获取QQ音乐歌单失败:", error.message);
      throw error;
    }
  }
}

// ==================== 酷狗音乐歌单服务 ====================
class KugouSongListService {
  private parseListId(input: string): string {
    const regExp = /\/single\/(\d+)/;
    if (regExp.test(input)) return input.replace(regExp, "$1");
    return input;
  }

  private formatPlayTime(time: number): string {
    const m = Math.floor(time / 60).toString().padStart(2, "0");
    const s = Math.floor(time % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }

  private formatPlayCount(count: number): string {
    if (count > 10000) return (count / 10000).toFixed(1) + "万";
    return String(count);
  }

  private signatureParams(paramsObj: Record<string, string | number>, platform: string = "android"): string {
    const key = platform === "web" ? "NVPh5oo715z5DIWAeQlhMDsWXXQV4hwt" : "OIlwieks28dk2k092lksi2UIkp";
    const sortedKeys = Object.keys(paramsObj).sort();
    const paramsStr = sortedKeys.map(k => `${k}=${paramsObj[k]}`).join("");
    const text = key + paramsStr + key;
    return md5(text);
  }

  async getListDetail(rawId: string, page: number = 1): Promise<SongListResult> {
    if (rawId.length > 20 || /[a-zA-Z]/.test(rawId)) {
      console.log("[SongList] 检测到 global_collection_id:", rawId);
      return this.getListDetailByGlobalCollectionId(rawId);
    }

    const id = this.parseListId(rawId);
    console.log("[SongList] 获取酷狗歌单详情, id:", id);
    try {
      const url = `http://www2.kugou.kugou.com/yueku/v9/special/single/${id}-5-9999.html`;
      const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" } });
      if (!response.ok) throw new Error(`请求失败: ${response.status}`);
      const html = await response.text();

      const listDataMatch = html.match(/global\.data = (\[.+\]);/);
      const listInfoMatch = html.match(/global = {[\s\S]+?name: "(.+)"[\s\S]+?pic: "(.+)"[\s\S]+?};/);
      if (!listDataMatch) throw new Error("解析歌单数据失败");

      let listData: any[];
      try { listData = JSON.parse(listDataMatch[1]); } catch (e) { throw new Error("解析歌单 JSON 失败"); }

      let name = "", pic = "";
      if (listInfoMatch) { name = listInfoMatch[1]; pic = listInfoMatch[2]; }

      let desc = "";
      const descMatch = html.match(/<div class="pc_specail_text pc_singer_tab_content" id="specailIntroduceWrap">([\s\S]*?)<\/div>/);
      if (descMatch) desc = descMatch[1].replace(/<[^>]+>/g, "").trim();

      const list: SongInfo[] = listData.map((item: any) => ({
        id: String(item.hash), name: item.songname, singer: item.singername || "",
        albumName: item.album_name || "", interval: this.formatPlayTime(item.duration || 0),
        source: "kg", hash: item.hash, img: item.album_img?.replace("{size}", "150") || "",
      }));

      return {
        list, page: 1, limit: 10000, total: list.length, source: "kg",
        info: { name, img: pic, desc, author: "", play_count: "" },
      };
    } catch (error: any) {
      console.error("[SongList] 获取酷狗歌单失败:", error.message);
      throw error;
    }
  }

  private async getListDetailByGlobalCollectionId(globalCollectionId: string): Promise<SongListResult> {
    console.log("[SongList] 通过 global_collection_id 获取酷狗歌单:", globalCollectionId);
    try {
      const clienttime = Date.now();
      const paramsObj: Record<string, string | number> = {
        appid: 1058, specialid: 0, global_specialid: globalCollectionId, format: "jsonp",
        srcappid: 2919, clientver: 20000, clienttime: clienttime, mid: clienttime, uuid: clienttime, dfid: "-",
      };
      const signature = this.signatureParams(paramsObj, "web");
      const params = Object.entries(paramsObj).map(([k, v]) => `${k}=${v}`).join("&");

      const infoResponse = await fetch(`https://mobiles.kugou.com/api/v5/special/info_v2?${params}&signature=${signature}`, {
        headers: {
          "mid": String(clienttime), "Referer": "https://m3ws.kugou.com/share/index.php",
          "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 11_0 like Mac OS X) AppleWebKit/604.1.38 (KHTML, like Gecko) Version/11.0 Mobile/15A372 Safari/604.1",
          "dfid": "-", "clienttime": String(clienttime),
        },
      });
      if (!infoResponse.ok) throw new Error(`获取歌单信息失败: ${infoResponse.status}`);
      const result = await infoResponse.json();
      if (result.status !== 1 || !result.data?.specialname) throw new Error("获取歌单信息失败");

      const info = result.data;
      const songCount = info.songcount || info.count || 0;
      const songList = await this.getSongListByGlobalCollectionId(globalCollectionId, songCount, clienttime);
      const list = this.getMusicInfos(songList);

      return {
        list, page: 1, limit: 10000, total: list.length, source: "kg",
        info: {
          name: info.specialname, img: info.imgurl?.replace("{size}", "240") || "",
          desc: info.intro || "", author: info.nickname || "", play_count: this.formatPlayCount(info.playcount || 0),
        },
      };
    } catch (error: any) {
      console.error("[SongList] 通过 global_collection_id 获取酷狗歌单失败:", error.message);
      throw error;
    }
  }

  private async getSongListByGlobalCollectionId(globalCollectionId: string, songCount: number, clienttime: number): Promise<any[]> {
    const list: any[] = [];
    const pageSize = 100;
    const totalPages = Math.ceil(songCount / pageSize);

    for (let page = 1; page <= totalPages; page++) {
      const paramsObj: Record<string, string | number> = {
        appid: 1005, need_sort: 1, module: "CloudMusic", clientver: 11589, pagesize: pageSize,
        global_collection_id: globalCollectionId, userid: 0, page: page, type: 0, area_code: 1,
      };
      const signature = this.signatureParams(paramsObj, "android");
      const params = Object.entries(paramsObj).map(([k, v]) => `${k}=${v}`).join("&");

      const response = await fetch(`http://pubsongs.kugou.com/v2/get_other_list_file?${params}&signature=${signature}`, {
        headers: { "User-Agent": "Android10-AndroidPhone-11589-201-0-playlist-wifi" },
      });
      if (!response.ok) continue;
      const data = await response.json();
      if (data.data?.info && Array.isArray(data.data.info)) list.push(...data.data.info);
    }
    return list;
  }

  private getMusicInfos(songList: any[]): SongInfo[] {
    return songList.map((item: any) => {
      let songName = item.name || item.songname || item.songName || "";
      let singerName = item.singername || item.singerName || "";
      if (songName && songName.includes(" - ")) {
        const parts = songName.split(" - ");
        if (parts.length >= 2) { singerName = parts[0].trim(); songName = parts.slice(1).join(" - ").trim(); }
      }
      const albumName = item.album_name || item.albumName || item.remark || "";
      let duration = item.duration || 0;
      if (duration > 10000) duration = Math.floor(duration / 1000);
      let img = item.album_img || item.img || "{size}";
      if (img && !img.includes("http")) img = "{size}";

      return {
        id: String(item.hash), name: songName, singer: singerName, albumName,
        interval: this.formatPlayTime(duration), source: "kg", hash: item.hash,
        img: img.replace("{size}", "150"),
      };
    });
  }
}

// ==================== 酷我音乐歌单服务 ====================
class KuwoSongListService {
  private static readonly LIMIT_SONG = 100;

  private parseListId(input: string): { id: string; digest?: string } {
    const regExp = /\/playlist(?:_detail)?\/(\d+)/;
    const digestRegExp = /^digest-(\d+)__(\d+)$/;
    if (digestRegExp.test(input)) { const match = input.match(digestRegExp); if (match) return { id: match[2], digest: match[1] }; }
    if (regExp.test(input)) return { id: input.replace(regExp, "$1") };
    return { id: input };
  }

  private formatPlayCount(count: number): string {
    if (count > 100000000) return (count / 100000000).toFixed(1) + "亿";
    if (count > 10000) return (count / 10000).toFixed(1) + "万";
    return String(count);
  }

  private formatPlayTime(time: number): string {
    const m = Math.floor(time / 60).toString().padStart(2, "0");
    const s = Math.floor(time % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }

  private async getListDetailDigest8(id: string, page: number, tryNum: number = 0): Promise<SongListResult> {
    if (tryNum > 2) throw new Error("try max num");
    const url = `http://nplserver.kuwo.cn/pl.svc?op=getlistinfo&pid=${id}&pn=${page - 1}&rn=${KuwoSongListService.LIMIT_SONG}&encode=utf8&keyset=pl2012&identity=kuwo&pcmp4=1&vipver=MUSIC_9.0.5.0_W1&newver=1`;
    console.log("[SongList] [Kuwo] 请求URL (尝试", tryNum + 1, "):", url);

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*", "Accept-Language": "zh-CN,zh;q=0.9", "Referer": "http://www.kuwo.cn/",
      },
    });
    if (!response.ok) {
      if (tryNum < 2) { await new Promise(r => setTimeout(r, 500)); return this.getListDetailDigest8(id, page, tryNum + 1); }
      throw new Error(`请求失败: ${response.status}`);
    }
    const data = await response.json();
    if (data.result !== "ok") {
      if (tryNum < 2) { await new Promise(r => setTimeout(r, 500)); return this.getListDetailDigest8(id, page, tryNum + 1); }
      throw new Error("获取歌单失败");
    }

    const list: SongInfo[] = (data.musiclist || []).map((item: any) => ({
      id: String(item.id), name: item.name, singer: item.artist || "",
      albumName: item.album || "", albumId: item.albumid,
      interval: this.formatPlayTime(parseInt(item.duration) || 0), source: "kw",
      songmid: String(item.id), img: item.pic || "",
    }));

    return {
      list, page, limit: data.rn || 100, total: data.total || list.length, source: "kw",
      info: {
        name: data.title || "", img: data.pic || "", desc: data.info || "",
        author: data.uname || "", play_count: this.formatPlayCount(data.playnum || 0),
      },
    };
  }

  private async getListDetailDigest5(id: string, page: number): Promise<SongListResult> {
    const infoUrl = `http://qukudata.kuwo.cn/q.k?op=query&cont=ninfo&node=${id}&pn=0&rn=1&fmt=json&src=mbox&level=2`;
    const infoResponse = await fetch(infoUrl, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" } });
    if (!infoResponse.ok) throw new Error(`获取歌单信息失败: ${infoResponse.status}`);
    const infoData = await infoResponse.json();
    if (!infoData.child || infoData.child.length === 0) throw new Error("无法获取歌单信息");
    const realId = infoData.child[0].sourceid;
    if (!realId) throw new Error("无法获取歌单真实ID");
    return this.getListDetailDigest8(realId, page);
  }

  async getListDetail(rawId: string, page: number = 1): Promise<SongListResult> {
    const { id, digest } = this.parseListId(rawId);
    console.log("[SongList] 获取酷我歌单详情, id:", id, "digest:", digest, "page:", page);
    try {
      if (digest === "5") return await this.getListDetailDigest5(id, page);
      return await this.getListDetailDigest8(id, page);
    } catch (error: any) {
      console.error("[SongList] 获取酷我歌单失败:", error.message);
      throw error;
    }
  }
}

// ==================== 咪咕音乐歌单服务 ====================
class MiguSongListService {
  private static readonly SUCCESS_CODE = "000000";

  private parseListId(input: string): string {
    const regExp1 = /\/playlist\/(\d+)/;
    const regExp2 = /[?&]id=(\d+)/;
    if (regExp1.test(input)) return input.replace(regExp1, "$1");
    if (regExp2.test(input)) return input.replace(regExp2, "$1");
    return input;
  }

  private formatPlayCount(count: number): string {
    if (count > 10000) return (count / 10000).toFixed(1) + "万";
    return String(count);
  }

  private formatPlayTime(time: number): string {
    const m = Math.floor(time / 60).toString().padStart(2, "0");
    const s = Math.floor(time % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }

  async getListDetail(rawId: string, page: number = 1): Promise<SongListResult> {
    const id = this.parseListId(rawId);
    console.log("[SongList] 获取咪咕歌单详情, id:", id, "page:", page);
    try {
      const [listData, infoData] = await Promise.all([this.getListDetailList(id, page), this.getListDetailInfo(id)]);
      return { ...listData, info: infoData };
    } catch (error: any) {
      console.error("[SongList] 获取咪咕歌单失败:", error.message);
      throw error;
    }
  }

  private async getListDetailList(id: string, page: number): Promise<any> {
    const url = `https://app.c.nf.migu.cn/MIGUM2.0/v1.0/user/queryMusicListSongs.do?musicListId=${id}&pageNo=${page}&pageSize=50`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1",
        "Referer": "https://m.music.migu.cn/",
      },
    });
    if (!response.ok) throw new Error(`请求失败: ${response.status}`);
    const data = await response.json();
    if (data.code !== MiguSongListService.SUCCESS_CODE) throw new Error("获取歌曲列表失败");

    const list: SongInfo[] = (data.list || []).map((item: any) => {
      const singerNames = item.artists?.map((s: any) => s.name).join("、") || item.singer || "";
      let interval = "00:00";
      if (item.length) {
        if (typeof item.length === "string" && item.length.includes(":")) interval = item.length;
        else interval = this.formatPlayTime(parseInt(item.length) || 0);
      }
      return {
        id: String(item.copyrightId || item.songId), name: item.songName || item.title, singer: singerNames,
        albumName: item.album || "", albumId: item.albumId, interval, source: "mg",
        copyrightId: String(item.copyrightId), songId: String(item.songId || item.id),
        img: item.albumImgs?.length ? item.albumImgs[0].img : (item.albumImg?.replace("{size}", "150") || ""),
      };
    });

    return { list, page, limit: 50, total: data.totalCount || list.length, source: "mg" };
  }

  private async getListDetailInfo(id: string): Promise<SongListInfo> {
    const url = `https://c.musicapp.migu.cn/MIGUM3.0/resource/playlist/v2.0?playlistId=${id}`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1",
        "Referer": "https://m.music.migu.cn/",
      },
    });
    if (!response.ok) throw new Error(`请求失败: ${response.status}`);
    const data = await response.json();
    if (data.code !== MiguSongListService.SUCCESS_CODE) throw new Error("获取歌单信息失败");
    const playlist = data.data || {};
    return {
      name: playlist.title || "", img: playlist.imgItem?.img || "", desc: playlist.summary || "",
      author: playlist.ownerName || "", play_count: this.formatPlayCount(playlist.opNumItem?.playNum || 0),
    };
  }
}

// ==================== 歌单服务主类 ====================
export class SongListService {
  private neteaseService = new NeteaseSongListService();
  private qqService = new QQMusicSongListService();
  private kugouService = new KugouSongListService();
  private kuwoService = new KuwoSongListService();
  private miguService = new MiguSongListService();

  async getListDetail(source: string, id: string): Promise<SongListResult> {
    console.log("[SongList] 获取歌单详情, source:", source, "id:", id);
    switch (source) {
      case "wy": return this.neteaseService.getListDetail(id);
      case "tx": return this.qqService.getListDetail(id);
      case "kg": return this.kugouService.getListDetail(id);
      case "kw": return this.kuwoService.getListDetail(id);
      case "mg": return this.miguService.getListDetail(id);
      default: throw new Error(`不支持的歌单来源: ${source}`);
    }
  }
}
