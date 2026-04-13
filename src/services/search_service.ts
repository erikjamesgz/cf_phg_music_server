// 搜索服务
export interface SearchResult {
  platform: string;
  results: Array<{id:string;name:string;singer:string;albumName:string;interval:string;source:string;songmid?:string;hash?:string;img?:string}>;
}
class KuwoSearchService {
  async search(kw:string,p:number,l:number):Promise<SearchResult> {
    const url="http://search.kuwo.cn/r.s?all="+encodeURIComponent(kw)+"&pn="+(p-1)+"&rn="+l+"&reqsource=kwplayer";
    const r=await fetch(url,{headers:{"User-Agent":"Mozilla/5.0","Referer":"http://www.kuwo.cn"}});const d=await r.json();
    return {platform:"kw",results:(d.abslist||[]).map((i:any)=>({id:String(i.MUSICRID),name:i.NAME,singer:i.ARTIST,albumName:i.ALBUM||"",interval:i.DURATION?Math.floor(i.DURATION/60)+":"+String(i.DURATION%60).padStart(2,"0"):"00:00",source:"kw",songmid:String(i.MUSICRID),img:i.albumpic?.replace("{size}","100")||""}))};
  }
}
class KugouSearchService {
  async search(kw:string,p:number,l:number):Promise<SearchResult> {
    const url="http://mobileservice.kugou.com/api/v3/search/song?format=json&keyword="+encodeURIComponent(kw)+"&page="+p+"&pagesize="+l;
    const r=await fetch(url,{headers:{"User-Agent":"Mozilla/5.0"}});const d=await r.json();
    return {platform:"kg",results:(d.data?.info||[]).map((i:any)=>({id:i.hash||"",name:i.songname,singer:i.singername,albumName:i.album_name||"",interval:i.duration?Math.floor(i.duration/60)+":"+String(i.duration%60).padStart(2,"0"):"00:00",source:"kg",hash:i.hash,img:i.album_img?.replace("{size}","100")||""}))};
  }
}
class QQMusicSearchService {
  async search(kw:string,p:number,l:number):Promise<SearchResult> {
    const url="https://c.y.qq.com/soso/fcgi-bin/client_search_cp?g_tk=5381&format=json&w="+encodeURIComponent(kw)+"&perPage="+l+"&p="+p+"&n="+l;
    const r=await fetch(url,{headers:{"Referer":"https://y.qq.com"}});const d=await r.json();
    return {platform:"tx",results:(d.data?.song?.list||[]).map((i:any)=>({id:String(i.id),name:i.songname,singer:i.singer?.map((s:any)=>s.name).join("\u3001")||"",albumName:i.albumname||"",interval:i.interval||"00:00",source:"tx",songmid:i.mid,img:"https://y.gtimg.cn/music/photo_new/T002R500x500M000"+i.albummid+".jpg"}))};
  }
}
class NeteaseSearchService {
  async search(kw:string,p:number,l:number):Promise<SearchResult> {
    const body=JSON.stringify({s:kw,type:1,offset:(p-1)*l,total:true,limit:l});
    const r=await fetch("https://music.163.com/weapi/cloudsearch/pc",{method:"POST",headers:{"Content-Type":"application/json","Referer":"https://music.163.com/"},body});const d=await r.json();
    return {platform:"wy",results:(d.result?.songs||[]).map((i:any)=>({id:String(i.id),name:i.name,singer:i.ar?.map((a:any)=>a.name).join("\u3001")||"",albumName:i.al?.name||"",interval:i.dt?Math.floor(i.dt/60000)+":"+String(Math.floor(i.dt/1000)%60).padStart(2,"0"):"00:00",source:"wy",songmid:String(i.id),img:i.al?.picUrl||""}))};
  }
}
class MiguSearchService {
  async search(kw:string,p:number,l:number):Promise<SearchResult> {
    const url="https://app.c.nf.migu.cn/MIGUM2.0/v1.0/content/search_all.do?text="+encodeURIComponent(kw)+"&pageNo="+p+"&pageSize="+l;
    const r=await fetch(url,{headers:{"User-Agent":"Mozilla/5.0 iPhone","Referer":"https://m.music.migu.cn/"}});const d=await r.json();
    return {platform:"mg",results:(d.songResultData?.resultList||[]).map((i:any)=>({id:String(i.copyrightId||i.songId),name:i.name||i.title,singer:i.artists?.map((a:any)=>a.name).join("\u3001")||i.singer||"",albumName:i.albums?.[0]?.albumName||i.album||"",interval:i.length||"00:00",source:"mg",copyrightId:String(i.copyrightId),img:i.albumImgs?.[0]?.img||""}))};
  }
}
export class SearchService { private kw=new KuwoSearchService();private kg=new KugouSearchService();private tx=new QQMusicSearchService();private wy=new NeteaseSearchService();private mg=new MiguSearchService();
  async search(keyword:string,source?:string,page:number=1,limit:number=20):Promise<SearchResult[]> { if(!source) return Promise.all([this.kw.search(keyword,page,limit),this.kg.search(keyword,page,limit),this.tx.search(keyword,page,limit),this.wy.search(keyword,page,limit),this.mg.search(keyword,page,limit)]);
    switch(source){case"kw":return[this.kw.search(keyword,page,limit)];case"kg":return[this.kg.search(keyword,page,limit)];case"tx":return[this.tx.search(keyword,page,limit)];case"wy":return[this.wy.search(keyword,page,limit)];case"mg":return[this.mg.search(keyword,page,limit)];default:throw new Error("Unsupported source: "+source);} } }
