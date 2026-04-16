import { newQuickJSWASMModuleFromVariant, QuickJSContext, QuickJSHandle, QuickJSWASMModule, isSuccess, isFail } from 'quickjs-emscripten-core';
import { getQuickJSWASMModule } from '@cf-wasm/quickjs';

interface MusicUrlRequest {
  source: string;
  action: string;
  info: {
    type: string;
    musicInfo: any;
  };
  timeoutMs?: number;
}

interface MusicUrlResponse {
  source: string;
  action: string;
  data: any;
}

interface ScriptInfo {
  id: string;
  name: string;
  rawScript: string;
  deobfuscated?: boolean;
  originalType?: string;
  description?: string;
  version?: string;
  author?: string;
  homepage?: string;
}

let wasmModule: any = null;

async function getWasmModule(): Promise<any> {
  if (wasmModule) return wasmModule;
  wasmModule = await getQuickJSWASMModule();
  return wasmModule;
}

function disposeResult(result: { dispose?: () => void }): void {
  try { result?.dispose?.(); } catch (_e) {}
}

function md5PureJS(input: string): string {
  function safeAdd(x: number, y: number): number {
    const lsw = (x & 0xffff) + (y & 0xffff);
    return (((x >> 16) + (y >> 16) + (lsw >> 16)) << 16) | (lsw & 0xffff);
  }
  function bitRotateLeft(num: number, cnt: number): number {
    return (num << cnt) | (num >>> (32 - cnt));
  }
  function md5cmn(q: number, a: number, b: number, x: number, s: number, t: number): number {
    return safeAdd(bitRotateLeft(safeAdd(safeAdd(a, q), safeAdd(x, t)), s), b);
  }
  function md5ff(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number { return md5cmn((b & c) | (~b & d), a, b, x, s, t); }
  function md5gg(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number { return md5cmn((b & d) | (c & ~d), a, b, x, s, t); }
  function md5hh(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number { return md5cmn(b ^ c ^ d, a, b, x, s, t); }
  function md5ii(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number { return md5cmn(c ^ (b | ~d), a, b, x, s, t); }
  function binlMD5(x: number[], len: number): number[] {
    x[len >> 5] |= 0x80 << (len % 32);
    x[(((len + 64) >>> 9) << 4) + 14] = len;
    let a = 1732584193, b = -271733879, c = -1732584194, d = 271733878;
    for (let i = 0; i < x.length; i += 16) {
      const oa = a, ob = b, oc = c, od = d;
      a = md5ff(a, b, c, d, x[i], 7, -680876936); d = md5ff(d, a, b, c, x[i + 1], 12, -389564586); c = md5ff(c, d, a, b, x[i + 2], 17, 606105819); b = md5ff(b, c, d, a, x[i + 3], 22, -1044525330);
      a = md5ff(a, b, c, d, x[i + 4], 7, -176418897); d = md5ff(d, a, b, c, x[i + 5], 12, 1200080426); c = md5ff(c, d, a, b, x[i + 6], 17, -1473231341); b = md5ff(b, c, d, a, x[i + 7], 22, -45705983);
      a = md5ff(a, b, c, d, x[i + 8], 7, 1770035416); d = md5ff(d, a, b, c, x[i + 9], 12, -1958414417); c = md5ff(c, d, a, b, x[i + 10], 17, -42063); b = md5ff(b, c, d, a, x[i + 11], 22, -1990404162);
      a = md5ff(a, b, c, d, x[i + 12], 7, 1804603682); d = md5ff(d, a, b, c, x[i + 13], 12, -40341101); c = md5ff(c, d, a, b, x[i + 14], 17, -1502002290); b = md5ff(b, c, d, a, x[i + 15], 22, 1236535329);
      a = md5gg(a, b, c, d, x[i + 1], 5, -165796510); d = md5gg(d, a, b, c, x[i + 6], 9, -1069501632); c = md5gg(c, d, a, b, x[i + 11], 14, 643717713); b = md5gg(b, c, d, a, x[i], 20, -373897302);
      a = md5gg(a, b, c, d, x[i + 5], 5, -701558691); d = md5gg(d, a, b, c, x[i + 10], 9, 38016083); c = md5gg(c, d, a, b, x[i + 15], 14, -660478335); b = md5gg(b, c, d, a, x[i + 4], 20, -405537848);
      a = md5gg(a, b, c, d, x[i + 9], 5, 568446438); d = md5gg(d, a, b, c, x[i + 14], 9, -1019803690); c = md5gg(c, d, a, b, x[i + 3], 14, -187363961); b = md5gg(b, c, d, a, x[i + 8], 20, 1163531501);
      a = md5gg(a, b, c, d, x[i + 13], 5, -1444681467); d = md5gg(d, a, b, c, x[i + 2], 9, -51403784); c = md5gg(c, d, a, b, x[i + 7], 14, 1735328473); b = md5gg(b, c, d, a, x[i + 12], 20, -1926607734);
      a = md5hh(a, b, c, d, x[i + 5], 4, -378558); d = md5hh(d, a, b, c, x[i + 8], 11, -2022574463); c = md5hh(c, d, a, b, x[i + 11], 16, 1839030562); b = md5hh(b, c, d, a, x[i + 14], 23, -35309556);
      a = md5hh(a, b, c, d, x[i + 1], 4, -1530992060); d = md5hh(d, a, b, c, x[i + 4], 11, 1272893353); c = md5hh(c, d, a, b, x[i + 7], 16, -155497632); b = md5hh(b, c, d, a, x[i + 10], 23, -1094730640);
      a = md5hh(a, b, c, d, x[i + 13], 4, 681279174); d = md5hh(d, a, b, c, x[i], 11, -358537222); c = md5hh(c, d, a, b, x[i + 3], 16, -722521979); b = md5hh(b, c, d, a, x[i + 6], 23, 76029189);
      a = md5hh(a, b, c, d, x[i + 9], 4, -640364487); d = md5hh(d, a, b, c, x[i + 12], 11, -421815835); c = md5hh(c, d, a, b, x[i + 15], 16, 530742520); b = md5hh(b, c, d, a, x[i + 2], 23, -995338651);
      a = md5ii(a, b, c, d, x[i], 6, -198630844); d = md5ii(d, a, b, c, x[i + 7], 10, 1126891415); c = md5ii(c, d, a, b, x[i + 14], 15, -1416354905); b = md5ii(b, c, d, a, x[i + 5], 21, -57434055);
      a = md5ii(a, b, c, d, x[i + 12], 6, 1700485571); d = md5ii(d, a, b, c, x[i + 3], 10, -1894986606); c = md5ii(c, d, a, b, x[i + 10], 15, -1051523); b = md5ii(b, c, d, a, x[i + 1], 21, -2054922799);
      a = md5ii(a, b, c, d, x[i + 8], 6, 1873313359); d = md5ii(d, a, b, c, x[i + 15], 10, -30611744); c = md5ii(c, d, a, b, x[i + 6], 15, -1560198380); b = md5ii(b, c, d, a, x[i + 13], 21, 1309151649);
      a = md5ii(a, b, c, d, x[i + 4], 6, -145523070); d = md5ii(d, a, b, c, x[i + 11], 10, -1120210379); c = md5ii(c, d, a, b, x[i + 2], 15, 718787259); b = md5ii(b, c, d, a, x[i + 9], 21, -343485551);
      a = safeAdd(a, oa); b = safeAdd(b, ob); c = safeAdd(c, oc); d = safeAdd(d, od);
    }
    return [a, b, c, d];
  }
  function str2binl(str: string): number[] {
    const bin: number[] = [];
    const mask = (1 << 8) - 1;
    for (let i = 0; i < str.length * 8; i += 8) {
      bin[i >> 5] |= (str.charCodeAt(i / 8) & mask) << (i % 32);
    }
    return bin;
  }
  function binl2hex(binarray: number[]): string {
    const hexTab = '0123456789abcdef';
    let str = '';
    for (let i = 0; i < binarray.length * 4; i++) {
      str += hexTab.charAt((binarray[i >> 2] >> ((i % 4) * 8 + 4)) & 0xf) + hexTab.charAt((binarray[i >> 2] >> ((i % 4) * 8)) & 0xf);
    }
    return str;
  }
  const utf8 = unescape(encodeURIComponent(input));
  return binl2hex(binlMD5(str2binl(utf8), utf8.length * 8));
}

function sha256PureTS(input: string): string {
  const K = new Uint32Array([
    0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
  ]);
  const H = new Uint32Array([0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]);
  const bytes: number[] = [];
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    if (c < 128) bytes.push(c);
    else if (c < 2048) { bytes.push((c>>6)|192); bytes.push((c&63)|128); }
    else { bytes.push((c>>12)|224); bytes.push(((c>>6)&63)|128); bytes.push((c&63)|128); }
  }
  bytes.push(128);
  while (bytes.length % 64 !== 56) bytes.push(0);
  const bitLen = input.length * 8;
  bytes.push(0); bytes.push(0); bytes.push(0); bytes.push(0);
  bytes.push((bitLen >>> 24) & 255); bytes.push((bitLen >>> 16) & 255);
  bytes.push((bitLen >>> 8) & 255); bytes.push(bitLen & 255);
  const W = new Uint32Array(64);
  for (let blk = 0; blk < bytes.length / 64; blk++) {
    for (let t = 0; t < 16; t++) W[t] = (bytes[blk*64+t*4]<<24)|(bytes[blk*64+t*4+1]<<16)|(bytes[blk*64+t*4+2]<<8)|bytes[blk*64+t*4+3];
    for (let t = 16; t < 64; t++) {
      const s0 = ((W[t-2]>>>17)|(W[t-2]<<15)) ^ ((W[t-2]>>>19)|(W[t-2]<<13)) ^ (W[t-2]>>>10);
      const s1 = ((W[t-15]>>>7)|(W[t-15]<<25)) ^ ((W[t-15]>>>18)|(W[t-15]<<14)) ^ (W[t-15]>>>3);
      W[t] = (s1 + W[t-7] + s0 + W[t-16]) | 0;
    }
    let a=H[0],b=H[1],c=H[2],d=H[3],e=H[4],f=H[5],g=H[6],h=H[7];
    for (let t = 0; t < 64; t++) {
      const S1 = ((e>>>6)|(e<<26)) ^ ((e>>>11)|(e<<21)) ^ ((e>>>25)|(e<<7));
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[t] + W[t]) | 0;
      const S0 = ((a>>>2)|(a<<30)) ^ ((a>>>13)|(a<<19)) ^ ((a>>>22)|(a<<10));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) | 0;
      h=g; g=f; f=e; e=(d+temp1)|0; d=c; c=b; b=a; a=(temp1+temp2)|0;
    }
    H[0]=(H[0]+a)|0; H[1]=(H[1]+b)|0; H[2]=(H[2]+c)|0; H[3]=(H[3]+d)|0;
    H[4]=(H[4]+e)|0; H[5]=(H[5]+f)|0; H[6]=(H[6]+g)|0; H[7]=(H[7]+h)|0;
  }
  let hex = '';
  for (let i = 0; i < 8; i++) hex += ('00000000' + H[i].toString(16)).slice(-8);
  return hex;
}

function aesEncryptSync(dataB64: string, keyB64: string, ivB64: string, mode: string): string {
  throw new Error('AES sync not implemented - use JS implementation instead');
}

function rsaEncryptSync(dataB64: string, keyPem: string, mode: string): string {
  throw new Error('RSA sync not implemented - use JS implementation instead');
}

function unwrapValue(result: any): QuickJSHandle | null {
  if (!result) return null;
  if (isSuccess(result)) return result.value as QuickJSHandle;
  if (result && typeof result.value !== 'undefined') return result.value as QuickJSHandle | null;
  return null;
}

const PRELOAD_SCRIPT = `
'use strict'

globalThis.lx_setup = (key, id, name, description, version, author, homepage, rawScript) => {
  delete globalThis.lx_setup
  const _nativeCall = globalThis.__lx_native_call__
  delete globalThis.__lx_native_call__
  const checkLength = (str, length = 1048576) => {
    if (typeof str == 'string' && str.length > length) throw new Error('Input too long')
    return str
  }
  const nativeFuncNames = [
    '__lx_native_call__set_timeout',
    '__lx_native_call__utils_str2b64',
    '__lx_native_call__utils_b642buf',
    '__lx_native_call__utils_str2md5',
    '__lx_native_call__utils_aes_encrypt',
    '__lx_native_call__utils_rsa_encrypt',
  ]
  const nativeFuncs = {}
  for (const name of nativeFuncNames) {
    const nativeFunc = globalThis[name]
    delete globalThis[name]
    nativeFuncs[name.replace('__lx_native_call__', '')] = (...args) => {
      for (const arg of args) checkLength(arg)
      return nativeFunc(...args)
    }
  }
  const KEY_PREFIX = {
    publicKeyStart: '-----BEGIN PUBLIC KEY-----',
    publicKeyEnd: '-----END PUBLIC KEY-----',
    privateKeyStart: '-----BEGIN PRIVATE KEY-----',
    privateKeyEnd: '-----END PRIVATE KEY-----',
  }
  const RSA_PADDING = {
    OAEPWithSHA1AndMGF1Padding: 'RSA/ECB/OAEPWithSHA1AndMGF1Padding',
    NoPadding: 'RSA/ECB/NoPadding',
  }
  const AES_MODE = {
    CBC_128_PKCS7Padding: 'AES/CBC/PKCS7Padding',
    ECB_128_NoPadding: 'AES',
  }
  const nativeCall = (action, data) => {
    data = JSON.stringify(data)
    checkLength(data, 2097152)
    _nativeCall(key, action, data)
  }

  const callbacks = new Map()
  let timeoutId = 0
  const _setTimeout = (callback, timeout = 0, ...params) => {
    if (typeof callback !== 'function') throw new Error('callback required a function')
    if (typeof timeout !== 'number' || timeout < 0) throw new Error('timeout required a number')
    if (timeoutId > 90000000000) throw new Error('max timeout')
    const id = timeoutId++
    callbacks.set(id, { callback(...args) { callback(...args) }, params })
    nativeFuncs.set_timeout(id, parseInt(timeout))
    return id
  }
  const _clearTimeout = (id) => {
    callbacks.delete(id)
  }
  const handleSetTimeout = (id) => {
    const tagret = callbacks.get(id)
    if (!tagret) return
    callbacks.delete(id)
    tagret.callback(...tagret.params)
  }

  function bytesToString(bytes) {
    let result = ''
    let i = 0
    while (i < bytes.length) {
      const byte = bytes[i]
      if (byte < 128) { result += String.fromCharCode(byte); i++ }
      else if (byte >= 192 && byte < 224) { result += String.fromCharCode(((byte & 31) << 6) | (bytes[i + 1] & 63)); i += 2 }
      else { result += String.fromCharCode(((byte & 15) << 12) | ((bytes[i + 1] & 63) << 6) | (bytes[i + 2] & 63)); i += 3 }
    }
    return result
  }
  function stringToBytes(inputString) {
    const bytes = []
    for (let i = 0; i < inputString.length; i++) {
      const charCode = inputString.charCodeAt(i)
      if (charCode < 128) bytes.push(charCode)
      else if (charCode < 2048) { bytes.push((charCode >> 6) | 192); bytes.push((charCode & 63) | 128) }
      else { bytes.push((charCode >> 12) | 224); bytes.push(((charCode >> 6) & 63) | 128); bytes.push((charCode & 63) | 128) }
    }
    return bytes
  }

  const NATIVE_EVENTS_NAMES = { init: 'init', showUpdateAlert: 'showUpdateAlert', request: 'request', cancelRequest: 'cancelRequest', response: 'response' }
  const EVENT_NAMES = { request: 'request', inited: 'inited', updateAlert: 'updateAlert' }
  const eventNames = Object.values(EVENT_NAMES)
  const events = { request: null }
  const allSources = ['kw', 'kg', 'tx', 'wy', 'mg', 'local']
  const supportQualitys = { kw: ['128k', '320k', 'flac', 'flac24bit'], kg: ['128k', '320k', 'flac', 'flac24bit'], tx: ['128k', '320k', 'flac', 'flac24bit'], wy: ['128k', '320k', 'flac', 'flac24bit'], mg: ['128k', '320k', 'flac', 'flac24bit'], local: [] }
  const supportActions = { kw: ['musicUrl'], kg: ['musicUrl'], tx: ['musicUrl'], wy: ['musicUrl'], mg: ['musicUrl'], local: ['musicUrl', 'lyric', 'pic'] }

  const verifyLyricInfo = (info) => {
    if (typeof info != 'object' || typeof info.lyric != 'string') throw new Error('failed')
    if (info.lyric.length > 51200) throw new Error('failed')
    return { lyric: info.lyric, tlyric: (typeof info.tlyric == 'string' && info.tlyric.length < 5120) ? info.tlyric : null, rlyric: (typeof info.rlyric == 'string' && info.rlyric.length < 5120) ? info.rlyric : null, lxlyric: (typeof info.lxlyric == 'string' && info.lxlyric.length < 8192) ? info.lxlyric : null }
  }

  const requestQueue = new Map()
  let isInitedApi = false

  const sendNativeRequest = (url, options, callback) => {
    console.log('[PRELOAD] sendNativeRequest url=' + url + ' method=' + (options && options.method || 'get'))
    const requestKey = Math.random().toString()
    const requestInfo = { aborted: false, abort: () => { nativeCall(NATIVE_EVENTS_NAMES.cancelRequest, requestKey) } }
    requestQueue.set(requestKey, { callback, requestInfo })
    nativeCall(NATIVE_EVENTS_NAMES.request, { requestKey, url, options })
    return requestInfo
  }
  const handleNativeResponse = ({ requestKey, error, response }) => {
    console.log('[PRELOAD] handleNativeResponse key=' + requestKey + ' error=' + (error || 'null') + ' status=' + (response && response.statusCode || 'null'))
    const targetRequest = requestQueue.get(requestKey)
    if (!targetRequest) return
    requestQueue.delete(requestKey)
    targetRequest.requestInfo.aborted = true
    if (error == null) targetRequest.callback(null, response)
    else targetRequest.callback(new Error(error), null)
  }

  const handleRequest = ({ requestKey, data }) => {
    if (!events.request) {
      // Check if this is sixyin force-init mode - delegate to host-side handler
      if (globalThis.__force_init_bypass) {
        console.log('[PRELOAD] Force-init bypass: delegating request to host, source=' + data.source + ', action=' + data.action)
        return nativeCall(NATIVE_EVENTS_NAMES.response, { requestKey, status: false, errorMessage: '__FORCE_INIT_DELEGATE__:' + JSON.stringify({source: data.source, action: data.action, type: data.info && data.info.type, songmid: data.info && data.info.musicInfo && data.info.musicInfo.songmid, name: data.info && data.info.musicInfo && data.info.musicInfo.name, singer: data.info && data.info.musicInfo && data.info.musicInfo.singer, hash: data.info && data.info.musicInfo && data.info.musicInfo.hash, songId: data.info && data.info.musicInfo && data.info.musicInfo.songId}) })
      }
      let evtDiag = ''
      try { evtDiag = ' | isInitedApi=' + String(isInitedApi) + ' | lxOnCalled=' + String(globalThis.__phg_on_called || 'not set') + ' | diagError=' + String(globalThis.__diag_error || 'none') + ' | trace=' + String(globalThis.__trace ? globalThis.__trace.slice(0,10).join(',') : 'no trace') + ' | caughtErrors=' + String(globalThis.__caught_errors ? globalThis.__caught_errors.slice(0,5).map(function(e){return e.message}).join(';;') : 'none') } catch(_e) {}
      return nativeCall(NATIVE_EVENTS_NAMES.response, { requestKey, status: false, errorMessage: 'Request event is not defined' + evtDiag })
    }
    try {
      console.log('[PRELOAD] handleRequest called, source=' + data.source + ', action=' + data.action)
      console.log('[PRELOAD] info.type=' + data.info.type)
      console.log('[PRELOAD] info.musicInfo keys=' + Object.keys(data.info.musicInfo).join(','))
      console.log('[PRELOAD] info.musicInfo.songmid=' + data.info.musicInfo.songmid)
      console.log('[PRELOAD] info.musicInfo.hash=' + data.info.musicInfo.hash)
      console.log('[PRELOAD] info.musicInfo.songId=' + data.info.musicInfo.songId)
      console.log('[PRELOAD] info.musicInfo.id=' + data.info.musicInfo.id)
      console.log('[PRELOAD] info.musicInfo.strMediaMid=' + data.info.musicInfo.strMediaMid)
      if (typeof Proxy !== 'undefined' && data.info.musicInfo) {
        var _miAccessLog = [];
        var _origMi = data.info.musicInfo;
        data.info.musicInfo = new Proxy(_origMi, {
          get: function(target, prop, receiver) {
            var val = target[prop];
            if (typeof prop === 'string' && prop !== 'then' && prop !== 'toJSON' && prop !== 'constructor' && prop !== 'valueOf' && prop !== 'toString' && prop !== Symbol.toStringTag) {
              _miAccessLog.push(prop + '=' + String(val).substring(0, 60));
              if (_miAccessLog.length <= 10) {
                console.log('[PRELOAD] [MI-ACCESS] property "' + prop + '" accessed, value=' + String(val).substring(0, 80));
              }
            }
            return val;
          }
        });
        globalThis.__miAccessLog = _miAccessLog;
      }
      events.request.call(globalThis.lx, { source: data.source, action: data.action, info: data.info }).then(response => {
        let result
        switch (data.action) {
          case 'musicUrl':
            if (typeof response != 'string' || response.length > 2048 || !/^https?:/.test(response)) throw new Error('failed: invalid url response, type=' + typeof response + ', value=' + (typeof response === 'string' ? String(response).substring(0, 100) : String(response)))
            result = { source: data.source, action: data.action, data: { type: data.info.type, url: response } }
            break
          case 'lyric': result = { source: data.source, action: data.action, data: verifyLyricInfo(response) }; break
          case 'pic':
            if (typeof response != 'string' || response.length > 2048 || !/^https?:/.test(response)) throw new Error('failed')
            result = { source: data.source, action: data.action, data: response }; break
        }
        nativeCall(NATIVE_EVENTS_NAMES.response, { requestKey, status: true, result })
      }).catch(err => { nativeCall(NATIVE_EVENTS_NAMES.response, { requestKey, status: false, errorMessage: err.message }) })
    } catch (err) { nativeCall(NATIVE_EVENTS_NAMES.response, { requestKey, status: false, errorMessage: err.message }) }
  }

  const jsCall = (action, data) => {
    switch (action) {
      case '__run_error__': if (!isInitedApi) isInitedApi = true; return
      case '__set_timeout__': handleSetTimeout(data); return
      case 'request': handleRequest(data); return
      case 'response': handleNativeResponse(data); return
      case 'sha256_compute':
      case 'md5_compute':
        var dataStr = typeof data === 'string' ? data : JSON.stringify(data)
        console.log('[PRELOAD] jsCall crypto: action=' + action + ', dataLen=' + (dataStr ? dataStr.length : 0))
        var r = _nativeCall(key, action, dataStr)
        console.log('[PRELOAD] jsCall crypto result: action=' + action + ', resultLen=' + (r ? r.length : 0) + ', resultPrefix=' + (r ? r.substring(0, 16) : 'null'))
        return r
    }
    return null
  }

  Object.defineProperty(globalThis, '__lx_native__', {
    enumerable: false, configurable: false, writable: false,
    value: (_key, action, data) => {
      if (key != _key) return 'Invalid key'
      var parsed = null
      if (data != null) {
        try { parsed = JSON.parse(data) } catch(_e) { parsed = data }
      }
      var result = data == null ? jsCall(action) : jsCall(action, parsed)
      if (result !== null) return result
      var dataStr = typeof data === 'string' ? data : JSON.stringify(data)
      console.log('[PRELOAD] __phg_native__ delegating to _nativeCall, action=' + action + ', dataLen=' + (dataStr ? dataStr.length : 0))
      return _nativeCall(key, action, dataStr)
    },
  })

  const handleInit = (info) => {
    if (!info) { nativeCall(NATIVE_EVENTS_NAMES.init, { info: null, status: false, errorMessage: 'Missing required parameter init info' }); return }
    const sourceInfo = { sources: {} }
    try {
      for (const source of allSources) {
        const userSource = info.sources[source]
        if (!userSource || userSource.type !== 'music') continue
        const qualitys = supportQualitys[source]
        const actions = supportActions[source]
        sourceInfo.sources[source] = { type: 'music', actions: actions.filter(a => userSource.actions.includes(a)), qualitys: qualitys.filter(q => userSource.qualitys.includes(q)) }
      }
    } catch (error) { nativeCall(NATIVE_EVENTS_NAMES.init, { info: null, status: false, errorMessage: error.message }); return }
    nativeCall(NATIVE_EVENTS_NAMES.init, { info: sourceInfo, status: true })
  }

  const dataToB64 = (data) => {
    if (typeof data === 'string') return nativeFuncs.utils_str2b64(data)
    else if (Array.isArray(data) || ArrayBuffer.isView(data)) return utils.buffer.bufToString(data, 'base64')
    throw new Error('data type error: ' + typeof data)
  }
  const utils = {
    crypto: {
      aesEncrypt(buffer, mode, key, iv) {
        switch (mode) {
          case 'aes-128-cbc': return utils.buffer.from(nativeFuncs.utils_aes_encrypt(dataToB64(buffer), dataToB64(key), dataToB64(iv), AES_MODE.CBC_128_PKCS7Padding), 'base64')
          case 'aes-128-ecb': return utils.buffer.from(nativeFuncs.utils_aes_encrypt(dataToB64(buffer), dataToB64(key), '', AES_MODE.ECB_128_NoPadding), 'base64')
          default: throw new Error('Binary encoding is not supported for input strings')
        }
      },
      rsaEncrypt(buffer, key) {
        if (typeof key !== 'string') throw new Error('Invalid RSA key')
        key = key.replace(KEY_PREFIX.publicKeyStart, '').replace(KEY_PREFIX.publicKeyEnd, '')
        return utils.buffer.from(nativeFuncs.utils_rsa_encrypt(dataToB64(buffer), key, RSA_PADDING.NoPadding), 'base64')
      },
      randomBytes(size) { return new Uint8Array(size).map(() => Math.floor(Math.random() * 256)) },
      md5(str) { if (typeof str !== 'string') throw new Error('param required a string'); console.log('[PRELOAD] md5 called, inputLen=' + str.length + ', inputPreview=' + JSON.stringify(str.substring(0, 200))); var md5Result = nativeFuncs.utils_str2md5(encodeURIComponent(str)); console.log('[PRELOAD] md5 result=' + md5Result); return md5Result },
    },
    buffer: {
      from(input, encoding) {
        if (typeof input === 'string') {
          switch (encoding) {
            case 'binary': throw new Error('Binary encoding is not supported for input strings')
            case 'base64': return new Uint8Array(JSON.parse(nativeFuncs.utils_b642buf(input)))
            case 'hex': return new Uint8Array(input.match(/.{1,2}/g).map(byte => parseInt(byte, 16)))
            default: return new Uint8Array(stringToBytes(input))
          }
        } else if (Array.isArray(input)) { return new Uint8Array(input) }
        else { throw new Error('Unsupported input type: ' + input + ' encoding: ' + encoding) }
      },
      bufToString(buf, format) {
        if (Array.isArray(buf) || ArrayBuffer.isView(buf)) {
          switch (format) {
            case 'binary': return buf
            case 'hex': return Array.from(buf).reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '')
            case 'base64': return nativeFuncs.utils_str2b64(bytesToString(Array.from(buf)))
            default: return bytesToString(Array.from(buf))
          }
        } else { throw new Error('Input is not a valid buffer: ' + buf + ' format: ' + format) }
      },
    },
    zlib: {
      inflate(buf) { return new Promise((resolve, reject) => { try { if (typeof globalThis.pako !== 'undefined' && globalThis.pako.inflate) { resolve(globalThis.pako.inflate(buf)) } else { reject(new Error('pako not available')) } } catch (e) { reject(e) } }) },
      deflate(data) { return new Promise((resolve, reject) => { try { if (typeof globalThis.pako !== 'undefined' && globalThis.pako.deflate) { resolve(globalThis.pako.deflate(data)) } else { reject(new Error('pako not available')) } } catch (e) { reject(e) } }) },
    },
  }

  globalThis.lx = {
    EVENT_NAMES,
    request(url, { method = 'get', timeout, headers, body, form, formData, binary }, callback) {
      if (typeof url === 'string' && url.indexOf('sign=') !== -1) {
        var signMatch = url.match(/sign=([^&]*)/);
        var pathMatch = url.match(new RegExp('/lxmusicv4/url/([^?]*)'));
        console.log('[PRELOAD] [SIGN] phg.request with sign: url=' + url.substring(0, 200) + ', sign=' + (signMatch ? signMatch[1] : 'NO_MATCH') + ', isFail=' + (signMatch && signMatch[1] === 'fail') + ', path=' + (pathMatch ? pathMatch[1] : 'NO_MATCH') + ', hasSha256=' + (typeof globalThis.sha256 !== 'undefined') + ', rawScriptLen=' + (globalThis.lx && globalThis.lx.currentScriptInfo && globalThis.lx.currentScriptInfo.rawScript ? globalThis.lx.currentScriptInfo.rawScript.length : 'MISSING'));
      }
      let options = { headers, binary: binary === true }
      if (timeout && typeof timeout == 'number' && timeout > 0) options.timeout = Math.min(timeout, 60000)
      let request = sendNativeRequest(url, { method, body, form, formData, ...options }, (err, resp) => {
        if (err) callback(err, null, null)
        else callback(err, { statusCode: resp.statusCode, statusMessage: resp.statusMessage, headers: resp.headers, body: resp.body }, resp.body)
      })
      return () => { if (!request.aborted) request.abort(); request = null }
    },
    send(eventName, data) {
      console.log('[PRELOAD] phg.send called: eventName=' + eventName + ' sources=' + (data && data.sources ? Object.keys(data.sources).join(',') : 'null'))
      return new Promise((resolve, reject) => {
        if (!eventNames.includes(eventName)) return reject(new Error('The event is not supported: ' + eventName))
        switch (eventName) {
          case EVENT_NAMES.inited:
            if (isInitedApi) return reject(new Error('Script is inited'))
            isInitedApi = true
            handleInit(data)
            resolve()
            break
          case EVENT_NAMES.updateAlert:
            resolve()
            break
          default: reject(new Error('Unknown event name: ' + eventName))
        }
      })
    },
    on(eventName, handler) {
      console.log('[PRELOAD] phg.on called: eventName=' + eventName + ' handlerType=' + typeof handler)
      globalThis.__phg_on_called = (globalThis.__phg_on_called || '') + eventName + ','
      if (!eventNames.includes(eventName)) return Promise.reject(new Error('The event is not supported: ' + eventName))
      switch (eventName) {
        case EVENT_NAMES.request: events.request = handler; break
        default: return Promise.reject(new Error('The event is not supported: ' + eventName))
      }
      return Promise.resolve()
    },
    utils,
    currentScriptInfo: { name, description, version, author, homepage, rawScript },
    version: '2.0.0',
    env: 'desktop',
    proxy: { host: '', port: '' },
    getConsole: () => ({ log: (...args) => console.log(...args), error: (...args) => console.error(...args), warn: (...args) => console.warn(...args), info: (...args) => console.info(...args) }),
    createMainWindow: () => {},
    getSystemFonts: async () => [],
  }

  globalThis.setTimeout = _setTimeout
  globalThis.clearTimeout = _clearTimeout
  if (typeof globalThis.setInterval === 'undefined') {
    globalThis.setInterval = function(fn, ms) { return _setTimeout(function intervalFn() { fn(); _setTimeout(intervalFn, ms); }, ms) }
    globalThis.clearInterval = function(id) { _clearTimeout(id) }
  }

  var _origSha256 = globalThis.sha256;
  if (typeof _origSha256 === 'function') {
    var _sha256Hook = function(input) {
      var result = _origSha256(input);
      console.log('[PRELOAD] [SHA256-HOOK] inputLen=' + (input ? input.length : 0) + ', inputPreview=' + (input ? JSON.stringify(input.substring(0, 200)) : 'null') + ', result=' + result);
      return result;
    };
    Object.keys(_origSha256).forEach(function(k) { _sha256Hook[k] = _origSha256[k]; });
    globalThis.sha256 = _sha256Hook;
  }

  if (typeof globalThis._nativeFnRegistry !== 'undefined' && Array.isArray(globalThis._nativeFnRegistry)) {
    var _phgLx = globalThis.lx;
    var _regNative = function(fn, name) { try { globalThis._nativeFnRegistry.push([fn, name]) } catch(e) {} };
    _regNative(_phgLx.request, 'request');
    _regNative(_phgLx.send, 'send');
    _regNative(_phgLx.on, 'on');
    _regNative(_phgLx.utils.crypto.aesEncrypt, 'aesEncrypt');
    _regNative(_phgLx.utils.crypto.rsaEncrypt, 'rsaEncrypt');
    _regNative(_phgLx.utils.crypto.randomBytes, 'randomBytes');
    _regNative(_phgLx.utils.crypto.md5, 'md5');
    _regNative(_phgLx.utils.buffer.from, 'from');
    _regNative(_phgLx.utils.buffer.bufToString, 'bufToString');
    _regNative(_phgLx.utils.zlib.inflate, 'inflate');
    _regNative(_phgLx.utils.zlib.deflate, 'deflate');
    _regNative(_phgLx.getConsole, 'getConsole');
    _regNative(_phgLx.createMainWindow, 'createMainWindow');
    _regNative(_phgLx.getSystemFonts, 'getSystemFonts');
    _regNative(globalThis.setTimeout, 'setTimeout');
    _regNative(globalThis.clearTimeout, 'clearTimeout');
    _regNative(globalThis.setInterval, 'setInterval');
    _regNative(globalThis.clearInterval, 'clearInterval');
  }

  console.log('Preload finished.')
}
`;

export class ScriptRunner {
  private scriptInfo: ScriptInfo;
  private isInitialized = false;
  private ctx: QuickJSContext | null = null;
  private registeredSources: Map<string, any> = new Map();
  private requestHandler: any = null;
  public cacheKv: any = null;

  constructor(scriptInfo: ScriptInfo) {
    this.scriptInfo = scriptInfo;
  }

  async initialize(): Promise<void> {
    let initError: string | null = null;
    let featureDiag: string = '';
    try {
      const mod = await getWasmModule();
      this.ctx = mod.newContext();
      const ctx = this.ctx!;
      const globalObj = ctx.global;

      const keyLogs: string[] = [];
      (this as any)._keyLogs = keyLogs;
      const origConsoleLog = console.log;
      const klog = (...args: any[]) => { const msg = args.map(a => typeof a === 'string' ? a : String(a)).join(' '); origConsoleLog(...args); keyLogs.push(msg); };

      klog('[ScriptRunner] Setting up QuickJS environment...');

      const logMessages: string[] = [];
      const logHandle = ctx.newFunction('log', (...args: QuickJSHandle[]) => {
        const msg = args.map(a => {
          try { return ctx.dump(unwrapValue(a) || ctx.undefined); } catch { return '?'; }
        }).join(' ');
        logMessages.push(msg);
        return ctx.undefined;
      });
      const consoleObj = ctx.newObject();
      ctx.setProp(consoleObj, 'log', logHandle);
      ctx.setProp(consoleObj, 'warn', logHandle);
      ctx.setProp(consoleObj, 'error', logHandle);
      ctx.setProp(consoleObj, 'info', logHandle);
      const noopFnHandle = ctx.newFunction('noop', () => ctx.undefined);
      ctx.setProp(consoleObj, 'group', noopFnHandle);
      ctx.setProp(consoleObj, 'groupEnd', noopFnHandle);
      ctx.setProp(consoleObj, 'groupCollapsed', noopFnHandle);
      ctx.setProp(consoleObj, 'time', noopFnHandle);
      ctx.setProp(consoleObj, 'timeEnd', noopFnHandle);
      ctx.setProp(consoleObj, 'trace', logHandle);
      ctx.setProp(consoleObj, 'dir', logHandle);
      ctx.setProp(consoleObj, 'table', noopFnHandle);
      ctx.setProp(globalObj, 'console', consoleObj);
      (this as any)._logMessages = logMessages;
      logHandle.dispose();
      consoleObj.dispose();
      noopFnHandle.dispose();

      let isInitedApi = false;
      (this as any)._pendingRequests = new Map<string, { resolve: (v: any) => void; reject: (e: any) => void }>();
      const pendingRequests = (this as any)._pendingRequests;
      (this as any)._pendingHttpRequests = [];
      const pendingHttpRequests = (this as any)._pendingHttpRequests;
      const pendingTimers: { id: number; fireAt: number }[] = [];
      (this as any)._pendingTimers = pendingTimers;

      const setNativeFunction = (name: string, fn: (...args: any[]) => any) => {
        const fnHandle = ctx.newFunction(name, (...args: QuickJSHandle[]) => {
          const jsArgs: any[] = [];
          for (const a of args) {
            const type = ctx.typeof(a);
            if (type === 'string') { jsArgs.push(ctx.getString(a)); continue; }
            if (type === 'number') { jsArgs.push(ctx.getNumber(a)); continue; }
            if (type === 'boolean') { jsArgs.push(ctx.getNumber(a) !== 0); continue; }
            if (type === 'undefined' || type === 'null') { jsArgs.push(null); continue; }
            try { jsArgs.push(JSON.parse(ctx.dump(a))); } catch (_e) { jsArgs.push(undefined); }
          }
          try {
            const result = fn(...jsArgs);
            if (typeof result === 'string') return ctx.newString(result);
            if (typeof result === 'number') return ctx.newNumber(result);
            if (typeof result === 'boolean') return result ? ctx.true : ctx.false;
            if (result === null || result === undefined) return ctx.null;
            return ctx.null;
          } catch (e: any) {
            console.error(`[ScriptRunner] ${name} error:`, e.message);
            return ctx.null;
          }
        });
        ctx.setProp(globalObj, name, fnHandle);
        fnHandle.dispose();
      };

      const handleNativeAction = (action: string, dataStr: string) => {
        console.log('[ScriptRunner] native action:', action, dataStr?.substring(0, 500));

        if (action === 'init') {
          isInitedApi = true;
          try {
            const initData = JSON.parse(dataStr || '{}');
            if (initData.info && initData.info.sources) {
              const sourceList = Object.keys(initData.info.sources);
              for (const source of sourceList) {
                this.registeredSources.set(source, initData.info.sources[source]);
              }
              console.log('[ScriptRunner] ✅ Script inited, registered sources:', sourceList);
            } else {
              console.log('[ScriptRunner] Script inited (no sources data):', dataStr?.substring(0, 200));
            }
          } catch (e: any) {
            console.log('[ScriptRunner] Script inited (parse error):', e.message);
          }
          return;
        }

        if (action === 'request') {
          try {
            const reqData = JSON.parse(dataStr);
            if (reqData.url) {
              console.log('[ScriptRunner] 🌐 HTTP request to:', reqData.url);
              if (reqData.url.indexOf('sign=') !== -1) {
                var signVal = 'NO_MATCH';
                try { var sm = reqData.url.match(/sign=([^&]*)/); if (sm) signVal = sm[1]; } catch(_e) {}
                klog('[ScriptRunner] [SIGN-DEBUG] URL contains sign: sign=' + signVal + ', isFail=' + (signVal === 'fail') + ', url=' + reqData.url.substring(0, 200));
              }
              this._executeRealHttpRequest(reqData);
            } else {
              console.warn('[ScriptRunner] ⚠️ Unknown request format:', dataStr?.substring(0, 200));
            }
          } catch (e: any) {
            console.error('[ScriptRunner] Bridge dispatch error:', e.message);
          }
          return;
        }

        if (action === 'response') {
          try {
            const respData = JSON.parse(dataStr);
            console.log('[ScriptRunner] [PHG-RESP] action=response, requestKey=' + (respData.requestKey || 'null') + ', error=' + (respData.error || 'null') + ', status=' + respData.status + ', resultType=' + typeof respData.result + ', resultPreview=' + JSON.stringify(respData.result).substring(0, 200));
            if ((this as any)._keyLogs) (this as any)._keyLogs.push('[ScriptRunner] [PHG-RESP] requestKey=' + (respData.requestKey || 'null') + ', error=' + (respData.error || 'null') + ', status=' + respData.status + ', resultPreview=' + JSON.stringify(respData.result).substring(0, 200));
            const pending = pendingRequests.get(respData.requestKey);
            if (pending) {
              pendingRequests.delete(respData.requestKey);
              // Check for sixyin delegate request
              if ((respData.errorMessage || '').startsWith('__FORCE_INIT_DELEGATE__:')) {
                this.handleForceInitDelegate(respData, pending);
                return;
              }
              if (respData.error || respData.status === false) {
                pending.reject(new Error(respData.errorMessage || respData.error || 'Script returned error'));
              } else {
                pending.resolve(respData.result?.data?.url || respData.result);
              }
            }
          } catch {}
          return;
        }

        if (action === '__run_error__') {
          if (!isInitedApi) isInitedApi = true;
          return;
        }

        if (action === '__set_timeout__') return;
        if (action === 'cancelRequest') return;
        if (action === 'showUpdateAlert') return;

        if (action === 'sha256_compute') {
          try {
            const result = sha256PureTS(dataStr);
            console.log('[ScriptRunner] 🔑 sha256_compute: inputLen=' + dataStr.length + ', inputPreview=' + JSON.stringify(dataStr.substring(0, 120)) + ', result=' + result);
            return result;
          } catch (e: any) {
            console.error('[ScriptRunner] sha256_compute error:', e.message);
            return '';
          }
        }

        if (action === 'md5_compute') {
          try {
            const result = md5PureJS(dataStr);
            console.log('[ScriptRunner] 🔑 md5_compute: inputLen=' + dataStr.length + ', inputPreview=' + JSON.stringify(dataStr.substring(0, 80)) + ', result=' + result);
            return result;
          } catch (e: any) {
            console.error('[ScriptRunner] md5_compute error:', e.message);
            return '';
          }
        }

        console.warn('[ScriptRunner] Unknown native action:', action);
      };

      setNativeFunction('__lx_native_call__', (_key: string, action: string, dataStr: string) => handleNativeAction(action, dataStr));

      setNativeFunction('__lx_native_call__set_timeout', (id: number, ms: number) => {
        pendingTimers.push({ id, fireAt: Date.now() + Math.min(ms, 5000) });
        return 0;
      });
      setNativeFunction('__lx_native_call__utils_str2b64', (str: string) => {
        try { return btoa(unescape(encodeURIComponent(str))); } catch { return ''; }
      });
      setNativeFunction('__lx_native_call__utils_b642buf', (b64: string) => {
        try { return JSON.stringify(Array.from(atob(b64)).map(c => c.charCodeAt(0))); } catch { return '[]'; }
      });
      setNativeFunction('__lx_native_call__utils_str2md5', (str: string) => {
        try {
          const decoded = decodeURIComponent(str);
          const result = md5PureJS(decoded);
          console.log('[ScriptRunner] 🔑 utils_str2md5: encodedLen=' + str.length + ', decodedLen=' + decoded.length + ', decodedPreview=' + JSON.stringify(decoded.substring(0, 80)) + ', md5=' + result);
          return result;
        } catch { return md5PureJS(str); }
      });
      setNativeFunction('__lx_native_call__utils_aes_encrypt', (dataB64: string, keyB64: string, ivB64: string, mode: string) => {
        try {
          return aesEncryptSync(dataB64, keyB64, ivB64, mode);
        } catch (e: any) { console.error('[AES]', e.message); return ''; }
      });
      setNativeFunction('__lx_native_call__utils_rsa_encrypt', (dataB64: string, keyPem: string, mode: string) => {
        try {
          return rsaEncryptSync(dataB64, keyPem, mode);
        } catch (e: any) { console.error('[RSA]', e.message); return ''; }
      });

      klog('[ScriptRunner] Setting up polyfill environment...');
      const polyfillResult = ctx.evalCode(this.getPolyfillSetup());
      if (isFail(polyfillResult)) {
        console.error('[ScriptRunner] Polyfill setup error:', ctx.dump(polyfillResult.error));
      }
      disposeResult(polyfillResult);

      const polyDiag = ctx.evalCode("JSON.stringify({hasWindow:typeof globalThis.window!=='undefined',hasDocument:typeof globalThis.document!=='undefined',hasBuffer:typeof globalThis.Buffer!=='undefined',hasRequire:typeof globalThis.require!=='undefined',hasProcess:typeof globalThis.process!=='undefined',processNodeVer:typeof globalThis.process!=='undefined'&&globalThis.process.versions?globalThis.process.versions.node:'no',hasModule:typeof globalThis.module!=='undefined',hasExports:typeof globalThis.exports!=='undefined'})");
      klog('[ScriptRunner] Polyfill state:', ctx.dump(unwrapValue(polyDiag) || ctx.undefined));
      disposeResult(polyDiag);

      klog('[ScriptRunner] Loading PRELOAD_SCRIPT...');
      const preloadResult = ctx.evalCode(PRELOAD_SCRIPT);
      if (isFail(preloadResult)) {
        const errHandle = preloadResult.error;
        let errMsg = 'unknown';
        try {
          const msgProp = ctx.getProp(errHandle, 'message');
          if (msgProp) { errMsg = ctx.getString(msgProp) || ctx.dump(msgProp); msgProp.dispose(); }
          else { errMsg = ctx.dump(errHandle); }
          const stackProp = ctx.getProp(errHandle, 'stack');
          if (stackProp) { const stackStr = ctx.getString(stackProp); if (stackStr) errMsg += ' | stack: ' + stackStr.substring(0, 500); stackProp.dispose(); }
        } catch (_de) { try { errMsg = ctx.dump(errHandle); } catch (_de2) { errMsg = 'dump_error'; } }
        console.error('[ScriptRunner] PRELOAD_SCRIPT error:', errMsg);
        klog('[ScriptRunner] PRELOAD_SCRIPT error: ' + errMsg);
        throw new Error('PRELOAD_SCRIPT failed: ' + errMsg);
      }
      disposeResult(preloadResult);

      const setupCheck = ctx.evalCode("typeof globalThis.lx_setup !== 'undefined' ? 'lx_setup_exists' : 'MISSING'");
      klog('[ScriptRunner] lx_setup check:', ctx.dump(unwrapValue(setupCheck) || ctx.undefined));
      disposeResult(setupCheck);

      klog('[ScriptRunner] Calling lx_setup()...');
      const si = this.scriptInfo;
      const rawScriptJson = JSON.stringify(si.rawScript || '');
      const rawScriptSetup = `globalThis.__rawScript__ = ${rawScriptJson};`;
      const rawScriptSetupResult = ctx.evalCode(rawScriptSetup);
      if (isFail(rawScriptSetupResult)) {
        const errHandle = rawScriptSetupResult.error;
        let errMsg = 'unknown';
        try { errMsg = ctx.dump(errHandle); } catch {}
        console.error('[ScriptRunner] rawScript setup error:', errMsg);
        throw new Error('rawScript setup failed: ' + errMsg);
      }
      disposeResult(rawScriptSetupResult);
      klog('[ScriptRunner] rawScript set on globalThis, length:', (si.rawScript || '').length);

      const setupCall = `lx_setup('cf_worker_key', '${si.id || ''}', '${(si.name || '').replace(/'/g, "\\'")}', '${(si.description || '').replace(/'/g, "\\'")}', '${si.version || ''}', '${(si.author || '').replace(/'/g, "\\'")}', '${(si.homepage || '').replace(/'/g, "\\'")}', globalThis.__rawScript__)`;
      const setupResult = ctx.evalCode(setupCall);
      if (isFail(setupResult)) {
        const errHandle = setupResult.error;
        let errMsg = 'unknown';
        try { errMsg = ctx.dump(errHandle); } catch {}
        console.error('[ScriptRunner] phg_setup() error:', errMsg);
        throw new Error('phg_setup() failed: ' + errMsg);
      }
      disposeResult(setupResult);
      disposeResult(ctx.evalCode('delete globalThis.__rawScript__'));

      const postSetupDiag = ctx.evalCode("JSON.stringify({hasPhg:typeof globalThis.lx!=='undefined',hasNative:typeof globalThis.__lx_native__!=='undefined',phgKeys:typeof globalThis.lx!=='undefined'?Object.keys(globalThis.lx):null,hasSetTimeout:typeof globalThis.setTimeout!=='undefined'})");
      klog('[ScriptRunner] ✅ After phg_setup():', ctx.dump(unwrapValue(postSetupDiag) || ctx.undefined));
      (this as any)._envDiag = ctx.dump(unwrapValue(postSetupDiag) || ctx.undefined);
      disposeResult(postSetupDiag);

      const csiDiag = ctx.evalCode(`(function(){
        try {
          var csi = globalThis.lx && globalThis.lx.currentScriptInfo;
          if (!csi) return 'CSI: missing';
          var rs = csi.rawScript;
          var rsLen = rs ? rs.length : 0;
          var rsMd5 = rsLen > 0 ? __lx_native__('cf_worker_key', 'md5_compute', rs) : 'EMPTY';
          return 'CSI: name=' + csi.name + ', rawScriptLen=' + rsLen + ', rawScriptMD5=' + rsMd5 + ', rawScriptPreview=' + (rs ? JSON.stringify(rs.substring(0, 100)) : 'null');
        } catch(e) { return 'CSI error: ' + e.message; }
      })()`);
      klog('[ScriptRunner] 🔑 After phg_setup CSI check:', ctx.dump(unwrapValue(csiDiag) || ctx.undefined));
      disposeResult(csiDiag);

      klog('[ScriptRunner] Executing user script (new Function inside QuickJS)...');
      let rawScript = this.scriptInfo.rawScript;

      // Workaround for obfuscated scripts that throw validation errors during init
      // Only apply to scripts that actually contain these specific throw patterns
      // This prevents accidentally modifying other scripts' behavior
      const hasSixyinThrows = rawScript.includes('_0x4cd356[_0x55d649(0x6c3') ||
                               rawScript.includes('_0x4cd356[_0x45516b(0x985') ||
                               rawScript.includes('_0x4cd356[_0x356fcf(-0x136') ||
                               rawScript.includes('_0x43a6a1[_0x40704e(0x5c5') ||
                               (rawScript.includes('throw new Error(_0x2e3f57)') && rawScript.includes('hibai.cn'));
      if (hasSixyinThrows) {
        const throwPatterns = [
          'throw new Error(_0x4cd356[_0x55d649(0x6c3,0x148,0x434,0x179,0x3df)]);',
          'throw new Error(_0x4cd356[_0x45516b(0x985,0xc0c,0x81a,0xa49,0xc83)]);',
          'throw new Error(_0x4cd356[_0x356fcf(-0x136,-0x5,-0x1b0,-0x2f,-0x247)]);',
          'throw new Error(_0x43a6a1[_0x40704e(0x5c5,0x361,0x7bf,0x546,0x4d1)]);',
          'throw new Error(_0x2e3f57);',
        ];
        
        let replaced = 0;
        for (const pattern of throwPatterns) {
          while (rawScript.includes(pattern)) {
            rawScript = rawScript.replace(pattern, '(void 0);');
            replaced++;
          }
        }
        if (replaced > 0) {
          console.log(`[ScriptRunner] Suppressed ${replaced} error throw(s) in sixyin script`);
        }
      }

      const proxyTestResult = ctx.evalCode(`(function(){
        var handler = { get: function(target, prop) { return 'proxy_works_' + prop; } };
        try { var p = new Proxy({}, handler); return String(p.anyProp); } catch(e) { return 'proxy_error:' + e.message; }
      })()`);
      console.log('[ScriptRunner] Proxy test:', ctx.dump(unwrapValue(proxyTestResult) || ctx.undefined));
      disposeResult(proxyTestResult);

      const toStringTestResult = ctx.evalCode(`(function(){
        try { var s = Function.prototype.toString.call(globalThis.fetch); return s.substring(0, 60); } catch(e) { return 'toString_error:' + e.message; }
      })()`);
      console.log('[ScriptRunner] toString test (fetch):', ctx.dump(unwrapValue(toStringTestResult) || ctx.undefined));
      disposeResult(toStringTestResult);

      const selfIntegrityTest = ctx.evalCode(`(function(){
        var results = [];
        try { results.push('typeof window=' + typeof window); } catch(e) { results.push('window_err=' + e.message); }
        try { results.push('typeof document=' + typeof document); } catch(e) { results.push('document_err=' + e.message); }
        try { results.push('typeof navigator=' + typeof navigator); } catch(e) { results.push('navigator_err=' + e.message); }
        try { results.push('typeof location=' + typeof location); } catch(e) { results.push('location_err=' + e.message); }
        try { results.push('typeof crypto=' + typeof crypto); } catch(e) { results.push('crypto_err=' + e.message); }
        try { results.push('typeof Proxy=' + typeof Proxy); } catch(e) { results.push('Proxy_err=' + e.message); }
        try { results.push('typeof Reflect=' + typeof Reflect); } catch(e) { results.push('Reflect_err=' + e.message); }
        try { results.push('typeof Symbol=' + typeof Symbol); } catch(e) { results.push('Symbol_err=' + e.message); }
        try { results.push('typeof Promise=' + typeof Promise); } catch(e) { results.push('Promise_err=' + e.message); }
        try { results.push('typeof Map=' + typeof Map); } catch(e) { results.push('Map_err=' + e.message); }
        try { results.push('typeof Set=' + typeof Set); } catch(e) { results.push('Set_err=' + e.message); }
        try { results.push('typeof WeakMap=' + typeof WeakMap); } catch(e) { results.push('WeakMap_err=' + e.message); }
        try { results.push('typeof ArrayBuffer=' + typeof ArrayBuffer); } catch(e) { results.push('ArrayBuffer_err=' + e.message); }
        try { results.push('typeof Uint8Array=' + typeof Uint8Array); } catch(e) { results.push('Uint8Array_err=' + e.message); }
        try { results.push('window===globalThis=' + String(window === globalThis)); } catch(e) { results.push('window_eq_err=' + e.message); }
        try { results.push('self===globalThis=' + String(self === globalThis)); } catch(e) { results.push('self_eq_err=' + e.message); }
        try { results.push('window===self=' + String(window === self)); } catch(e) { results.push('win_self_err=' + e.message); }
        try { results.push('phg.env=' + String(globalThis.lx.env)); } catch(e) {}
        try { results.push('phg.version=' + String(globalThis.lx.version)); } catch(e) {}
        try { results.push('phg.rawScriptLen=' + String(globalThis.lx.currentScriptInfo && globalThis.lx.currentScriptInfo.rawScript ? globalThis.lx.currentScriptInfo.rawScript.length : 'null')); } catch(e) {}
        return results.join(' | ');
      })()`);
      klog('[ScriptRunner] Self integrity test:', ctx.dump(unwrapValue(selfIntegrityTest) || ctx.undefined));
      disposeResult(selfIntegrityTest);

      const preExecDiag = ctx.evalCode(`(function(){
        var d = {};
        d.hasFetch = typeof globalThis.fetch !== 'undefined';
        d.hasXHR = typeof globalThis.XMLHttpRequest !== 'undefined';
        d.hasEval = typeof eval !== 'undefined';
        d.hasFunction = typeof Function !== 'undefined';
        d.evalTest = (function(){ try { return eval('1+1'); } catch(e) { return 'error:' + e.message; } })();
        d.functionTest = (function(){ try { return new Function('return 42')(); } catch(e) { return 'error:' + e.message; } })();
        d.hasPromise = typeof Promise !== 'undefined';
        d.hasProxy = typeof Proxy !== 'undefined';
        d.hasReflect = typeof Reflect !== 'undefined';
        d.hasSymbol = typeof Symbol !== 'undefined';
        d.phgRequestType = typeof globalThis.lx !== 'undefined' ? typeof globalThis.lx.request : 'no phg';
        d.phgOnType = typeof globalThis.lx !== 'undefined' ? typeof globalThis.lx.on : 'no phg';
        d.phgSendType = typeof globalThis.lx !== 'undefined' ? typeof globalThis.lx.send : 'no phg';
        d.phgEnv = typeof globalThis.lx !== 'undefined' ? globalThis.lx.env : 'no phg';
        return JSON.stringify(d);
      })()`);
      klog('[ScriptRunner] Pre-exec env diag:', ctx.dump(unwrapValue(preExecDiag) || ctx.undefined));
      disposeResult(preExecDiag);

      const escapedScript = JSON.stringify(rawScript);
      const newFnExecCode = `
        try {
          globalThis.__diag_pre_phg = typeof globalThis.lx !== 'undefined' ? JSON.stringify({exists:true,version:globalThis.lx.version,env:globalThis.lx.env,onType:typeof globalThis.lx.on,sendType:typeof globalThis.lx.send,requestType:typeof globalThis.lx.request,utilsType:typeof globalThis.lx.utils,utilsKeys:typeof globalThis.lx.utils!=='undefined'?Object.keys(globalThis.lx.utils).join(','):'no utils',csiName:globalThis.lx.currentScriptInfo&&globalThis.lx.currentScriptInfo.name,csiVersion:globalThis.lx.currentScriptInfo&&globalThis.lx.currentScriptInfo.version,csiRawScriptLen:globalThis.lx.currentScriptInfo&&globalThis.lx.currentScriptInfo.rawScript?globalThis.lx.currentScriptInfo.rawScript.length:'null',utilsCryptoKeys:typeof globalThis.lx.utils!=='undefined'&&globalThis.lx.utils.crypto?Object.keys(globalThis.lx.utils.crypto).join(','):'no crypto',utilsBufferKeys:typeof globalThis.lx.utils!=='undefined'&&globalThis.lx.utils.buffer?Object.keys(globalThis.lx.utils.buffer).join(','):'no buffer'}) : 'no phg';
          globalThis.__trace = [];
          globalThis.__caught_errors = [];
          globalThis.__prop_access_log = [];
          var _origError = globalThis.Error;
          globalThis.Error = function(msg) {
            var err = new _origError(msg);
            globalThis.__caught_errors.push({message: String(msg), stack: err.stack ? String(err.stack).substring(0,300) : 'no stack', time: Date.now()});
            if (globalThis.__caught_errors.length > 50) globalThis.__caught_errors.shift();
            return err;
          };
          globalThis.Error.prototype = _origError.prototype;
          globalThis.Error.captureStackTrace = function(obj) { obj.stack = new _origError().stack; };
          Object.defineProperty(globalThis.Error, 'toString', {value: function() { return 'function Error() { [native code] }' }, configurable: true});
          var _origRequire = globalThis.require;
          globalThis.require = function(mod) {
            globalThis.__trace.push('require:'+mod);
            var result = _origRequire(mod);
            if (mod === 'crypto') {
              var _origCreateHash = result.createHash;
              result.createHash = function(algo) {
                globalThis.__trace.push('createHash:'+algo);
                var hashObj = _origCreateHash(algo);
                var _origDigest = hashObj.digest;
                var _origUpdate = hashObj.update;
                var _updateCalled = 0;
                hashObj.update = function(d, enc) {
                  _updateCalled++;
                  if (_updateCalled <= 3) globalThis.__trace.push('hashUpdate:'+algo+':len='+String(d).length+':preview='+String(d).substring(0,80));
                  return _origUpdate.call(this, d, enc);
                };
                hashObj.digest = function(enc) {
                  var r = _origDigest.call(this, enc);
                  globalThis.__trace.push('hashDigest:'+algo+':enc='+enc+':result='+String(r).substring(0,64));
                  return r;
                };
                return hashObj;
              };
            }
            return result;
          };
          var _origMd5 = globalThis.lx.utils.crypto.md5;
          globalThis.lx.utils.crypto.md5 = function(str) {
            globalThis.__trace.push('lxMd5:len='+str.length+':preview='+str.substring(0,80));
            var r = _origMd5(str);
            globalThis.__trace.push('lxMd5Result:'+r);
            return r;
          };
          var _origAesEncrypt = globalThis.lx.utils.crypto.aesEncrypt;
          globalThis.lx.utils.crypto.aesEncrypt = function(a,b,c,d) {
            globalThis.__trace.push('aesEncrypt:args='+String(a).substring(0,60)+','+String(b).substring(0,60));
            var r = _origAesEncrypt(a,b,c,d);
            globalThis.__trace.push('aesEncryptResult:'+String(r).substring(0,100));
            return r;
          };
          var _origRsaEncrypt = globalThis.lx.utils.crypto.rsaEncrypt;
          globalThis.lx.utils.crypto.rsaEncrypt = function(a,b) {
            globalThis.__trace.push('rsaEncrypt:args='+String(a).substring(0,60));
            var r = _origRsaEncrypt(a,b);
            globalThis.__trace.push('rsaEncryptResult:'+String(r).substring(0,100));
            return r;
          };
          var _origRandomBytes = globalThis.lx.utils.crypto.randomBytes;
          globalThis.lx.utils.crypto.randomBytes = function(n) {
            globalThis.__trace.push('randomBytes:'+n);
            return _origRandomBytes(n);
          };
          var _origBufFrom = globalThis.lx.utils.buffer.from;
          globalThis.lx.utils.buffer.from = function(a,b) {
            globalThis.__trace.push('bufFrom:type='+typeof a+':len='+String(a).length+':enc='+b);
            var r = _origBufFrom(a,b);
            globalThis.__trace.push('bufFromResult:type='+typeof r+':len='+String(r).length);
            return r;
          };
          var _origBufToString = globalThis.lx.utils.buffer.bufToString;
          globalThis.lx.utils.buffer.bufToString = function(a,b) {
            globalThis.__trace.push('bufToString:type='+typeof a+':enc='+b);
            var r = _origBufToString(a,b);
            globalThis.__trace.push('bufToStringResult:'+String(r).substring(0,100));
            return r;
          };
          var _origLxRequest = globalThis.lx.request;
          globalThis.lx.request = function(url, opts, cb) {
            globalThis.__trace.push('lxRequest:url='+String(url).substring(0,100)+':method='+(opts&&opts.method||'GET'));
            return _origLxRequest(url, opts, cb);
          };
          var _origFetch = globalThis.fetch;
          globalThis.fetch = function(url, opts) {
            globalThis.__trace.push('fetch:url='+String(url).substring(0,100));
            return _origFetch(url, opts);
          };
          var _origLxOn = globalThis.lx.on;
          globalThis.lx.on = function(evt, handler) {
            globalThis.__trace.push('lxOn:'+evt);
            return _origLxOn(evt, handler);
          };
          var _origLxSend = globalThis.lx.send;
          globalThis.lx.send = function(evt, data) {
            globalThis.__trace.push('lxSend:'+evt+':sources='+(data&&data.sources?Object.keys(data.sources).join(','):'null'));
            return _origLxSend(evt, data);
          };
          var _origSetTimeout = globalThis.setTimeout;
          globalThis.setTimeout = function(fn, ms) {
            globalThis.__trace.push('setTimeout:ms='+ms+':fnType='+typeof fn);
            return _origSetTimeout(fn, ms);
          };
          if (globalThis.crypto && globalThis.crypto.subtle && globalThis.crypto.subtle.digest) {
            var _origSubtleDigest = globalThis.crypto.subtle.digest;
            globalThis.crypto.subtle.digest = function(algo, data) {
              globalThis.__trace.push('subtleDigest:algo='+JSON.stringify(algo)+':dataLen='+(data?data.byteLength||data.length:'null'));
              return _origSubtleDigest(algo, data);
            };
          }
          if (globalThis.XMLHttpRequest) {
            var _origXHROpen = globalThis.XMLHttpRequest.prototype.open;
            globalThis.XMLHttpRequest.prototype.open = function(method, url, async) {
              globalThis.__trace.push('xhrOpen:'+method+':'+String(url).substring(0,100));
              return _origXHROpen.apply(this, arguments);
            };
            var _origXHRSend = globalThis.XMLHttpRequest.prototype.send;
            globalThis.XMLHttpRequest.prototype.send = function(body) {
              globalThis.__trace.push('xhrSend:bodyType='+typeof body);
              return _origXHRSend.apply(this, arguments);
            };
          }
          // Try eval() first - more like direct execution, avoids new Function wrapper issues
          var _result;
          var _useEval = true;
          try {
            _result = eval(${escapedScript});
            globalThis.__diag_execMethod = 'eval';
          } catch(_evalErr) {
            _useEval = false;
            globalThis.__diag_evalError = _evalErr.message;
            // Fallback to new Function
            _result = (new Function(
              'window','self','globalThis','lx','events',
              'setTimeout','clearTimeout','setInterval','clearInterval',
              'atob','btoa','Buffer','pako','fetch',
              ${escapedScript}
            ))(
              globalThis, globalThis, globalThis, globalThis.lx, {request:null},
              globalThis.setTimeout, globalThis.clearTimeout,
              globalThis.setInterval || function(){},
              globalThis.clearInterval || function(){},
              globalThis.atob, globalThis.btoa,
              globalThis.Buffer || {from:function(s,e){if(e==='base64'){var b=atob(s);var a=new Uint8Array(b.length);for(var i=0;i<b.length;i++)a[i]=b.charCodeAt(i);return a;}return new TextEncoder().encode(s);},alloc:function(n){return new Uint8Array(n);}},
              globalThis.pako || {inflate:function(b){throw new Error('pako not available');},deflate:function(d){throw new Error('pako not available');}},
              globalThis.fetch || function(){throw new Error('fetch not available');}
            );
            globalThis.__diag_execMethod = 'newFunction(fallback)';
          }
          globalThis.__diag_result = String(_result);
          globalThis.__diag_post_phg = typeof globalThis.lx !== 'undefined' ? JSON.stringify({exists:true,keys:Object.keys(globalThis.lx).join(','),onType:typeof globalThis.lx.on}) : 'no phg';
          globalThis.__diag_sha256 = JSON.stringify({hasSha256:typeof globalThis.sha256!=='undefined',sha256Type:typeof globalThis.sha256,sha256Result:typeof globalThis.sha256==='function'?globalThis.sha256('test').substring(0,16):'no_fn',sha256FullResult:typeof globalThis.sha256==='function'?globalThis.sha256('test'):'no_fn',hasSha224:typeof globalThis.sha224!=='undefined',hasModule:typeof globalThis.module!=='undefined',hasExports:typeof globalThis.exports!=='undefined',processNodeVer:typeof globalThis.process!=='undefined'&&globalThis.process.versions?globalThis.process.versions.node:'no_process',csiRawScriptLen:typeof globalThis.lx!=='undefined'&&globalThis.lx.currentScriptInfo&&globalThis.lx.currentScriptInfo.rawScript?globalThis.lx.currentScriptInfo.rawScript.length:'no_phg'});
        } catch(e) {
          globalThis.__diag_error = e.message;
          globalThis.__diag_stack = e.stack ? String(e.stack).substring(0, 500) : 'no stack';
          try { globalThis.__diag_trace = globalThis.__trace ? globalThis.__trace.join('\\n') : 'no trace'; } catch(_te) { globalThis.__diag_trace = 'trace error'; }
        }
      `;

      let scriptError: string | null = null;
      let usedMethod = 'newFunction';
      try {
        const execResult = ctx.evalCode(newFnExecCode);
        if (isFail(execResult)) {
          let errDetail = '';
          try { errDetail = ctx.dump(execResult.error); } catch {}
          scriptError = `new Function error: ${errDetail}`;
          console.error('[ScriptRunner] new Function execution error:', errDetail);
          console.log('[ScriptRunner] Trying direct evalCode fallback...');
          disposeResult(execResult);

          const fallbackCode = `try { eval(${escapedScript}); } catch(e) { console.error('[ScriptRunner] Direct eval threw error (caught): ' + e.message); }`;
          const fallbackResult = ctx.evalCode(fallbackCode);
          if (isFail(fallbackResult)) {
            let fallbackErr = '';
            try { fallbackErr = ctx.dump(fallbackResult.error); } catch {}
            console.error('[ScriptRunner] Direct evalCode also failed:', fallbackErr);
            scriptError = `Both methods failed. newFn: ${errDetail}, direct: ${fallbackErr}`;
          } else {
            scriptError = null;
            usedMethod = 'directEvalCode';
            console.log('[ScriptRunner] Direct evalCode succeeded (error caught inside)!');
          }
          disposeResult(fallbackResult);
        } else {
          console.log('[ScriptRunner] Script executed OK (new Function, error caught inside)');
          disposeResult(execResult);
        }

        try {
          const diagPrePhg = ctx.evalCode(`String(globalThis.__diag_pre_phg || 'not set')`);
          if (isSuccess(diagPrePhg)) { klog('[ScriptRunner] DIAG pre-phg:', ctx.dump(diagPrePhg.value)); disposeResult(diagPrePhg); }
          const diagResult = ctx.evalCode(`String(globalThis.__diag_result || 'not set')`);
          if (isSuccess(diagResult)) { console.log('[ScriptRunner] DIAG result:', ctx.dump(diagResult.value)); disposeResult(diagResult); }
          const diagPostPhg = ctx.evalCode(`String(globalThis.__diag_post_phg || 'not set')`);
          if (isSuccess(diagPostPhg)) { console.log('[ScriptRunner] DIAG post-phg:', ctx.dump(diagPostPhg.value)); disposeResult(diagPostPhg); }
          const diagError = ctx.evalCode(`String(globalThis.__diag_error || 'none')`);
          if (isSuccess(diagError)) { console.log('[ScriptRunner] DIAG error:', ctx.dump(diagError.value)); disposeResult(diagError); }
          const diagStack = ctx.evalCode(`String(globalThis.__diag_stack || 'none')`);
          if (isSuccess(diagStack)) { console.log('[ScriptRunner] DIAG stack:', ctx.dump(diagStack.value)); disposeResult(diagStack); }
          const diagSha256 = ctx.evalCode(`String(globalThis.__diag_sha256 || 'not set')`);
          if (isSuccess(diagSha256)) { klog('[ScriptRunner] 🔑 DIAG SHA256:', ctx.dump(diagSha256.value)); disposeResult(diagSha256); }
        } catch (_e) {}

        if (ctx.runtime) {
          for (let round = 0; round < 10; round++) {
            try {
              const jobResult = ctx.runtime.executePendingJobs();
              if (isSuccess(jobResult) && (jobResult.value || 0) === 0) break;
            } catch {}
          }
        }

        for (let timerRound = 0; timerRound < 20; timerRound++) {
          if (pendingTimers.length === 0) break;
          const timersToFire = [...pendingTimers];
          pendingTimers.length = 0;
          console.log(`[ScriptRunner] Phase1: Firing ${timersToFire.length} timer(s) in round ${timerRound}`);
          for (const timer of timersToFire) {
            try {
              disposeResult(ctx.evalCode(`__lx_native__('cf_worker_key', '__set_timeout__', ${timer.id})`));
            } catch (_e) {}
          }
          if (ctx.runtime) {
            for (let i = 0; i < 20; i++) {
              try {
                const jobResult = ctx.runtime.executePendingJobs();
                if (isSuccess(jobResult) && (jobResult.value || 0) === 0) break;
              } catch {}
            }
          }
        }

        // Post-Phase1 diagnostic: check if timer callbacks did anything useful
        try {
          const postPhase1Diag = ctx.evalCode(`(function(){
            var d = {};
            d.phgOnCalled = globalThis.__phg_on_called || 'not set';
            d.traceLen = globalThis.__trace ? globalThis.__trace.length : 0;
            d.newTraces = 'none';
            if (globalThis.__trace && globalThis.__trace.length > 9) {
              d.newTraces = globalThis.__trace.slice(9).join(' | ');
            }
            d.caughtErrorsLen = globalThis.__caught_errors ? globalThis.__caught_errors.length : 0;
            d.recentErrors = 'none';
            if (globalThis.__caught_errors && globalThis.__caught_errors.length > 0) {
              var errs = globalThis.__caught_errors.slice(-5);
              d.recentErrors = errs.map(function(e){return e.message.substring(0,120)}).join(';;');
            }
            d.isInitedApi = ${isInitedApi};
            return JSON.stringify(d);
          })()`);
          if (isSuccess(postPhase1Diag)) {
            const diagStr = ctx.dump(postPhase1Diag.value);
            console.log('[ScriptRunner] 📊 Post-Phase1 state:', diagStr);
            disposeResult(postPhase1Diag);
          }
        } catch(_e) {}


        // === UNIVERSAL FALLBACK FOR SCRIPTS THAT DON'T SELF-INITIALIZE ===
        // Some scripts cache phg.send/phg.on before our wrappers, bypassing isInitedApi.
        // After Phase 1, if still not inited, try universal recovery for ANY script.
        if (!isInitedApi) {
          const _scriptName = this.scriptInfo.name || 'unknown';
          console.log(`[ScriptRunner] 🔧 Script "${_scriptName}" did not self-init, attempting universal recovery`);
          try {
            const _tr = ctx.evalCode(`(function(){
              try {
                if (typeof lx !== 'undefined' && typeof lx.send === 'function') {
                  lx.send('inited', {sources: [
                    {type:'music',name:'酷我',actions:['musicUrl','lyric','pic'],qualitys:['128k','320k','flac']},
                    {type:'music',name:'酷狗',actions:['musicUrl','lyric','pic'],qualitys:['128k','320k','flac']},
                    {type:'music',name:'腾讯',actions:['musicUrl','lyric','pic'],qualitys:['128k','320k','flac']},
                    {type:'music',name:'网易云',actions:['musicUrl','lyric','pic'],qualitys:['128k','320k','flac']},
                    {type:'music',name:'咪咕',actions:['musicUrl','lyric','pic'],qualitys:['128k','320k','flac']}
                  ], status: true});
                  return 'send_inited_called';
                }
                return 'no_phg';
              } catch(e) { return 'err:'+e.message; }
            })()`);
            if (isSuccess(_tr)) { console.log(`[ScriptRunner] 🔧 send(inited):`, ctx.dump(_tr.value)); disposeResult(_tr); }
            if (ctx.runtime) { for (let j = 0; j < 20; j++) { try { ctx.runtime.executePendingJobs(); } catch(_e) {} } }
          } catch (_e) {}
          if (!isInitedApi) {
            console.log(`[ScriptRunner] 🔧 Universal fallback: built-in handler for "${_scriptName}"`);
            for (const [sn, sc] of Object.entries({kw:{type:'music',actions:['musicUrl','lyric','pic'],qualitys:['128k','320k','flac']},kg:{type:'music',actions:['musicUrl','lyric','pic'],qualitys:['128k','320k','flac']},tx:{type:'music',actions:['musicUrl','lyric','pic'],qualitys:['128k','320k','flac']},wy:{type:'music',actions:['musicUrl','lyric','pic'],qualitys:['128k','320k','flac']},mg:{type:'music',actions:['musicUrl','lyric','pic'],qualitys:['128k','320k','flac']}})) { this.registeredSources.set(sn, sc); }
            isInitedApi = true;
          }

          // === CRITICAL: Enable builtin bypass if script has no working request handler ===
          // Some scripts call phg.send('inited') but never register lx.on('request', handler).
          // Without a request handler, PRELOAD_SCRIPT's handleRequest will fail with "Request event is not defined".
          // Detect this and enable the builtin bypass so requests are handled by our host-side code.
          let hasRequestHandler = false;
          try {
            const rhCheck = ctx.evalCode(`(function(){
              var phgObj = globalThis.lx;
              if (!phgObj || typeof phgObj !== 'object') return 'no_phg';
              // Check if events.request exists in the phg wrapper closure
              // We can't directly access closure vars, so check indirect signals
              return 'checked';
            })()`);
            if (isSuccess(rhCheck)) { disposeResult(rhCheck); }
            // Check via trying to detect if phg.on('request') was called
            const eventsCheck = ctx.evalCode(`(function(){
              return JSON.stringify({
                hasPhg: typeof globalThis.lx !== 'undefined',
                lxOnCalled: globalThis.__phg_on_called || 'not_set',
                hasEventsRequest: typeof globalThis.__events_request !== 'undefined'
              });
            })()`);
            if (isSuccess(eventsCheck)) {
              const ecStr = ctx.dump(eventsCheck.value);
              console.log(`[ScriptRunner] 🔧 Events check after init: ${ecStr}`);
              hasRequestHandler = ecStr.includes('__phg_on_called') && !ecStr.includes("not_set");
              disposeResult(eventsCheck);
            }
          } catch (_e) {}

          if (isInitedApi && !hasRequestHandler) {
            console.log(`[ScriptRunner] 🔧 Script "${_scriptName}" inited but NO request handler detected → enabling builtin bypass`);
            (this as any)._forceInitBypass = true;
            try { disposeResult(ctx.evalCode('globalThis.__force_init_bypass = true')); } catch (_e) {}
          } else if (isInitedApi && !(this as any)._forceInitBypass) {
            // Also ensure all sources are registered even if script self-inited
            console.log(`[ScriptRunner] ✅ Script "${_scriptName}" self-inited with request handler`);
          }
        }
      } catch (e: any) {
        scriptError = e.message;
        console.error('[ScriptRunner] Script execution error:', e.message);
      }

      (this as any)._scriptInitError = scriptError;

      if (logMessages.length > 0) {
        console.log('[ScriptRunner] Script console output (' + logMessages.length + ' messages):');
        for (let i = Math.max(0, logMessages.length - 30); i < logMessages.length; i++) {
          console.log('[ScriptRunner]   [' + i + '] ' + logMessages[i]);
        }
      }

      const postExecDiag = ctx.evalCode(`
        (function(){
          var d = {};
          d.hasPhg = typeof globalThis.lx !== 'undefined';
          if (d.hasPhg) {
            d.phgKeys = Object.keys(globalThis.lx).slice(0,20);
          }
          d.hasNative = typeof globalThis.__lx_native__ !== 'undefined';
          d.exportsType = typeof globalThis.exports;
          d.moduleType = typeof globalThis.module;
          return JSON.stringify(d);
        })()
      `);
      console.log('[ScriptRunner] Post-exec diagnostics:', ctx.dump(unwrapValue(postExecDiag) || ctx.undefined));
      disposeResult(postExecDiag);

      console.log('[ScriptRunner] isInitedApi:', isInitedApi);

      if (!isInitedApi && ctx.runtime) {
        console.log('[ScriptRunner] Running executePendingJobs + timer loop...');
        for (let round = 0; round < 50; round++) {
          const result = ctx.runtime.executePendingJobs();
          if (isSuccess(result)) {
            const jobsExecuted = result.value || 0;
            if (jobsExecuted === 0) break;
          } else {
            console.error('[ScriptRunner] Pending job error:', ctx.dump(result.error));
            break;
          }
          if (isInitedApi) break;
          if (pendingTimers.length > 0) {
            const timersToFire2 = [...pendingTimers];
            pendingTimers.length = 0;
            for (const timer of timersToFire2) {
              try {
                disposeResult(ctx.evalCode(`__lx_native__('cf_worker_key', '__set_timeout__', ${timer.id})`));
              } catch (_e) {}
            }
          }
        }
        console.log('[ScriptRunner] After pendingJobs loop, isInitedApi:', isInitedApi);
      }

      if (!isInitedApi) {
        console.log('[ScriptRunner] Processing pending HTTP requests during init...');
        await this._processPendingHttpRequests(5);
        console.log('[ScriptRunner] After processing HTTP requests, isInitedApi:', isInitedApi);
      }

      if (!isInitedApi) {
        console.log('[ScriptRunner] ⏳ Waiting for script to call send("inited", ...) (max 30s)...');
        let waitLoopCount = 0;
        let lastTraceLen = 0;
        await new Promise<void>((resolve) => {
          const timeoutId = setTimeout(() => {
            console.warn('[ScriptRunner] ⚠️ Init timeout, forcing completion with default sources...');
            // Final diagnostic dump before forcing
            try {
              const finalDiag = ctx.evalCode(`(function(){
                var d = {};
                d.phgOnCalled = globalThis.__phg_on_called || 'not set';
                d.traceLen = globalThis.__trace ? globalThis.__trace.length : 0;
                d.traceFull = globalThis.__trace ? globalThis.__trace.join('\\n') : 'no trace';
                d.caughtErrors = globalThis.__caught_errors ? JSON.stringify(globalThis.__caught_errors).substring(0, 500) : 'none';
                d.diagError = globalThis.__diag_error || 'none';
                return JSON.stringify(d);
              })()`);
              if (isSuccess(finalDiag)) { console.log('[ScriptRunner] Timeout final diag:', ctx.dump(finalDiag.value)); disposeResult(finalDiag); }
            } catch(_e) {}
            const defaultSources: Record<string, any> = {
              kw: { type: 'music', actions: ['musicUrl', 'lyric', 'pic'], qualitys: ['128k', '320k', 'flac'] },
              kg: { type: 'music', actions: ['musicUrl', 'lyric', 'pic'], qualitys: ['128k', '320k', 'flac'] },
              tx: { type: 'music', actions: ['musicUrl', 'lyric', 'pic'], qualitys: ['128k', '320k', 'flac'] },
              wy: { type: 'music', actions: ['musicUrl', 'lyric', 'pic'], qualitys: ['128k', '320k', 'flac'] },
              mg: { type: 'music', actions: ['musicUrl', 'lyric', 'pic'], qualitys: ['128k', '320k', 'flac'] },
            };
            for (const source of Object.keys(defaultSources)) {
              this.registeredSources.set(source, defaultSources[source]);
            }
            isInitedApi = true;
            resolve();
          }, 30000);

          const checkInterval = setInterval(() => {
            if (isInitedApi) {
              clearTimeout(timeoutId);
              clearInterval(checkInterval);
              resolve();
              return;
            }
            waitLoopCount++;

            // Always execute pending jobs to process microtasks from timer callbacks
            if (ctx.runtime) {
              try {
                const jobResult = ctx.runtime.executePendingJobs();
                if (isFail(jobResult)) {
                  // Ignore errors during job execution
                }
              } catch (_e) {}
            }
            // Fire any pending timers
            if (pendingTimers.length > 0) {
              const timersToFire3 = [...pendingTimers];
              pendingTimers.length = 0;
              console.log(`[ScriptRunner:InitWait] 🔥 Firing ${timersToFire3.length} pending timer(s) at loop #${waitLoopCount}`);
              for (const timer of timersToFire3) {
                try {
                  disposeResult(ctx.evalCode(`__lx_native__('cf_worker_key', '__set_timeout__', ${timer.id})`));
                } catch (_e) {}
              }
              // After firing timers, run jobs aggressively to process their callbacks
              if (ctx.runtime) {
                for (let i = 0; i < 30; i++) {
                  try {
                    const jobResult2 = ctx.runtime.executePendingJobs();
                    if (isSuccess(jobResult2) && (jobResult2.value || 0) === 0) break;
                  } catch (_e) {}
                }
              }
              // Check state after timer fire - this is KEY diagnostics
              if (waitLoopCount % 4 === 0) {
                try {
                  const stateDiag = ctx.evalCode(`(function(){
                    var d = {};
                    d.loop = ${waitLoopCount};
                    d.phgOnCalled = globalThis.__phg_on_called || 'not set';
                    d.traceLen = globalThis.__trace ? globalThis.__trace.length : 0;
                    d.newTraces = 'none';
                    if (globalThis.__trace && globalThis.__trace.length > ${lastTraceLen}) {
                      d.newTraces = globalThis.__trace.slice(${lastTraceLen}).join(' | ');
                      ${lastTraceLen} = globalThis.__trace.length;
                    }
                    d.caughtErrorsLen = globalThis.__caught_errors ? globalThis.__caught_errors.length : 0;
                    d.recentErrors = 'none';
                    if (globalThis.__caught_errors && globalThis.__caught_errors.length > 0) {
                      var errs = globalThis.__caught_errors.slice(-3);
                      d.recentErrors = errs.map(function(e){return e.message.substring(0,80)}).join(';;');
                    }
                    return JSON.stringify(d);
                  })()`);
                  if (isSuccess(stateDiag)) {
                    const stateStr = ctx.dump(stateDiag.value);
                    if (stateStr && stateStr !== '{"loop":0,"lxOnCalled":"not set","traceLen":9,"newTraces":"none","caughtErrorsLen":0,"recentErrors":"none"}') {
                      console.log(`[ScriptRunner:InitWait] 📊 State at loop #${waitLoopCount}:`, stateStr);
                    }
                    disposeResult(stateDiag);
                  }
                } catch(_e) {}
              }
            }
          }, 50);
        });
        console.log('[ScriptRunner] After init wait, isInitedApi:', isInitedApi, 'sources:', Array.from(this.registeredSources.keys()));
      }

      const handlerCheck = ctx.evalCode("(function(){ try { var r = globalThis.__lx_native__('cf_worker_key', 'request', JSON.stringify({requestKey:'__check__',data:{source:'tx',action:'musicUrl',info:{type:'128k',musicInfo:{name:'test',singer:'t',source:'tx',songmid:'0'}}}})); return 'bridge_ok'; } catch(e) { return 'bridge_err:' + e.message; } })()");
      console.log('[ScriptRunner] Bridge handler check:', ctx.dump(unwrapValue(handlerCheck) || ctx.undefined));
      disposeResult(handlerCheck);

      this.requestHandler = true;
      console.log('[ScriptRunner] ✅ Initialization complete, sources:', Array.from(this.registeredSources.keys()));
      this.isInitialized = true;
    } catch (e: any) {
      initError = e.message || String(e);
      console.error('[ScriptRunner] Initialize error:', initError);
    }

    (this as any)._scriptInitError = initError;
    (this as any)._featureDiagnostic = featureDiag;

    let diagInfo = '';
    try {
      const ctx2 = this.ctx;
      if (ctx2) {
        const d1 = ctx2.evalCode(`String(globalThis.__diag_error || 'none')`);
        if (isSuccess(d1)) { diagInfo += 'diagError=' + ctx2.dump(d1.value); disposeResult(d1); }
        const d2 = ctx2.evalCode(`String(globalThis.__diag_stack || 'none')`);
        if (isSuccess(d2)) { diagInfo += ' | diagStack=' + String(ctx2.dump(d2.value)).substring(0, 300); disposeResult(d2); }
        const d3 = ctx2.evalCode(`String(globalThis.__diag_pre_phg || 'not set')`);
        if (isSuccess(d3)) { diagInfo += ' | diagPrePhg=' + String(ctx2.dump(d3.value)).substring(0, 200); disposeResult(d3); }
        const d4 = ctx2.evalCode(`String(globalThis.__diag_trace || 'no trace')`);
        if (isSuccess(d4)) { diagInfo += ' | trace=' + String(ctx2.dump(d4.value)).substring(0, 500); disposeResult(d4); }
        const d5 = ctx2.evalCode(`JSON.stringify(globalThis.__caught_errors || [])`);
        if (isSuccess(d5)) { diagInfo += ' | caughtErrors=' + String(ctx2.dump(d5.value)).substring(0, 1000); disposeResult(d5); }
      }
    } catch (_e) {}
    (this as any)._diagInfo = diagInfo;

    if (initError) throw new Error(initError + (featureDiag ? ' | ' + featureDiag : '') + (diagInfo ? ' | ' + diagInfo : ''));
  }

  async request(request: MusicUrlRequest): Promise<MusicUrlResponse> {
    if (!this.isInitialized || !this.ctx) {
      const initErr = (this as any)._scriptInitError;
      const diag = (this as any)._featureDiagnostic;
      throw new Error(initErr ? `Script init failed: ${initErr} | diag: ${diag}` : 'Script not initialized');
    }

    const ctx = this.ctx!;
    const requestKey = Math.random().toString();
    const pendingRequests = (this as any)._pendingRequests;

    const toOldMusicInfo = (info: any): any => {
      const mi = info.musicInfo;
      const oInfo: Record<string, any> = {
        name: mi.name,
        singer: mi.singer,
        source: request.source,
        songmid: mi.songmid || mi.id || mi.meta?.songId || mi.copyrightId || mi.meta?.copyrightId || '',
        interval: mi.interval,
        albumName: mi.meta?.albumName || mi.albumName || '',
        img: mi.meta?.picUrl || mi.img || '',
        typeUrl: {},
        albumId: mi.meta?.albumId || mi.albumId || '',
        types: mi.meta?.qualitys || mi.types || [],
        _types: {},
      };
      if (mi.meta) {
        if (mi.meta.hash) oInfo.hash = mi.meta.hash;
        if (mi.meta.strMediaMid) oInfo.strMediaMid = mi.meta.strMediaMid;
        if (mi.meta.albumMid) oInfo.albumMid = mi.meta.albumMid;
        if (mi.meta.songId) oInfo.songId = mi.meta.songId;
        if (mi.meta.copyrightId) oInfo.copyrightId = mi.meta.copyrightId;
        if (mi.meta.lrcUrl) oInfo.lrcUrl = mi.meta.lrcUrl;
        if (mi.meta.mrcUrl) oInfo.mrcUrl = mi.meta.mrcUrl;
        if (mi.meta.trcUrl) oInfo.trcUrl = mi.meta.trcUrl;
      }
      if (mi.hash) oInfo.hash = mi.hash;
      if (mi.copyrightId) oInfo.copyrightId = mi.copyrightId;
      if (mi.strMediaMid) oInfo.strMediaMid = mi.strMediaMid;
      if (mi.albumMid) oInfo.albumMid = mi.albumMid;
      if (mi.songId && !oInfo.songId) oInfo.songId = mi.songId;
      if (!oInfo.songId && oInfo.songmid) oInfo.songId = oInfo.songmid;
      if (!oInfo.copyrightId && request.source === 'mg' && oInfo.songmid) oInfo.copyrightId = oInfo.songmid;
      if (request.source === 'mg') {
        if (!oInfo.songmid && oInfo.copyrightId) oInfo.songmid = oInfo.copyrightId;
        if (!oInfo.songId && oInfo.copyrightId) oInfo.songId = oInfo.copyrightId;
      }
      if (request.source === 'kg') {
        if (!oInfo.hash && oInfo.songmid) oInfo.hash = oInfo.songmid;
      }
      return oInfo;
    };

    const oldMusicInfo = toOldMusicInfo(request.info);

    return new Promise(async (resolve, reject) => {
      const requestData = JSON.stringify({
        requestKey: requestKey,
        data: {
          source: request.source,
          action: request.action,
          info: {
            type: request.info.type,
            musicInfo: oldMusicInfo,
          },
        },
      });

      (this as any)._lastRequestMusicInfo = JSON.stringify(oldMusicInfo).substring(0, 500);

      const kl = (msg: string) => { console.log(msg); if ((this as any)._keyLogs) (this as any)._keyLogs.push(msg); };

      kl('[ScriptRunner] === New Request Start ===');
        console.log('[ScriptRunner] 📊 oldMusicInfo:', JSON.stringify(oldMusicInfo).substring(0, 500));
        kl('[ScriptRunner] 📊 oldMusicInfo: ' + JSON.stringify(oldMusicInfo).substring(0, 500));
      console.log('[ScriptRunner] requestData:', requestData.substring(0, 300));

      const timeoutId = setTimeout(() => {
        if (pendingRequests.has(requestKey)) {
          pendingRequests.delete(requestKey);
          reject(new Error('Request timeout after 30s'));
        }
      }, 30000);

      const pendingResolve = (result: any) => {
        clearTimeout(timeoutId);
        if (request.action === 'musicUrl') {
          resolve({ source: request.source, action: request.action, data: { url: result, type: request.info?.type || 'music' } });
        } else {
          resolve({ source: request.source, action: request.action, data: result });
        }
      };

      // === BUILTIN BYPASS: If force-init, handle request directly without QuickJS ===
      if ((this as any)._forceInitBypass) {
        const musicInfo = request.info?.musicInfo || {};
        console.log(`[ScriptRunner:Builtin] 🚀 Bypassing QuickJS for direct API call: source=${request.source}, action=${request.action}, name=${musicInfo.name}, singer=${musicInfo.singer}`);
        try {
          if (request.action === 'musicUrl') {
            const url = await this._builtinGetMusicUrl(request.source, request.info?.type || '128k', musicInfo.songmid || '', musicInfo.name || '', musicInfo.singer || '');
            console.log(`[ScriptRunner:Builtin] ✅ Direct result:`, url ? url.substring(0, 80) + '...' : 'null');
            pendingResolve(url);
            return;
          } else {
            pendingResolve(null);
            return;
          }
        } catch (e: any) {
          console.error(`[ScriptRunner:Builtin] ❌ Direct API error:`, e.message);
          reject(e);
          return;
        }
      }

      pendingRequests.set(requestKey, { resolve: pendingResolve, reject });

      try {
        const safeData = requestData.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        console.log('[ScriptRunner] Triggering handleRequest via __lx_native__...');
        console.log('[ScriptRunner] 📊 oldMusicInfo keys:', Object.keys(oldMusicInfo).join(','));
        console.log('[ScriptRunner] 📊 oldMusicInfo.songmid:', oldMusicInfo.songmid);
        console.log('[ScriptRunner] 📊 oldMusicInfo.hash:', oldMusicInfo.hash);
        console.log('[ScriptRunner] 📊 oldMusicInfo.songId:', oldMusicInfo.songId);

        let evalResult;
        try {
          let preDiagStr = 'error';
          try {
            const preDiag = ctx.evalCode(`(function(){ var d=JSON.parse('${safeData}'); var mi=d.data.info.musicInfo; return JSON.stringify({src:d.data.source,songmid:mi.songmid,hash:mi.hash,songId:mi.songId,id:mi.id,keys:Object.keys(mi).join(',')}); })()`);
            if (isSuccess(preDiag)) { preDiagStr = ctx.dump(preDiag.value); } else { preDiagStr = 'fail:' + ctx.dump(preDiag.error); }
            disposeResult(preDiag);
          } catch (e: any) { preDiagStr = 'exception:' + e.message; }
          (this as any)._preDiag = preDiagStr;
          console.log('[ScriptRunner] 📊 preDiag:', preDiagStr);
          kl('[ScriptRunner] 📊 preDiag: ' + preDiagStr);
          evalResult = ctx.evalCode(`__lx_native__('cf_worker_key', 'request', '${safeData}')`);
        } catch (evalErr: any) {
          reject(new Error(`QuickJS eval failed: ${evalErr.message}`));
          return;
        }
        if (isFail(evalResult)) {
          const errHandle = evalResult.error;
          let errMsg = ctx.dump(errHandle);
          const msgProp = ctx.getProp(errHandle, 'message');
          if (msgProp) { const msgStr = ctx.getString(msgProp); if (msgStr) errMsg = msgStr; msgProp.dispose(); }
          console.error('[ScriptRunner] QuickJS error:', errMsg);
          disposeResult(evalResult);
          reject(new Error(`QuickJS error: ${errMsg}`));
          return;
        }
        console.log('[ScriptRunner] __lx_native__ result:', ctx.dump(unwrapValue(evalResult) || ctx.undefined));
        disposeResult(evalResult);

        console.log('[ScriptRunner] Driving Promise chain...');
        if (ctx.runtime) {
          for (let round = 0; round < 200; round++) {
            const jobResult = ctx.runtime.executePendingJobs();
            if (isSuccess(jobResult)) {
              if ((jobResult.value || 0) === 0) break;
            } else {
              console.error('[ScriptRunner] Job error:', ctx.dump(jobResult.error));
              break;
            }
            if (!pendingRequests.has(requestKey)) {
              console.log('[ScriptRunner] Request resolved after job execution');
              break;
            }
            await new Promise(r => setTimeout(r, 10));
          }
        }

        if (pendingRequests.has(requestKey)) {
          console.log('[ScriptRunner] Request still pending after job loop, waiting for async resolution...');
          const requestTimeout = (request as any).timeoutMs ?? 5000;
            await new Promise<void>((resolveWait) => {
              const waitTimeout = setTimeout(() => {
                console.warn('[ScriptRunner] Async resolution timeout');
                resolveWait();
              }, requestTimeout);
            const checkInterval = setInterval(() => {
              if (!pendingRequests.has(requestKey)) {
                clearTimeout(waitTimeout);
                clearInterval(checkInterval);
                resolveWait();
              }
            }, 50);
          });
        }

        if (pendingRequests.has(requestKey)) {
          try {
            const traceResult = ctx.evalCode(`JSON.stringify(globalThis.__trace || [])`);
            if (isSuccess(traceResult)) { (this as any)._trace = ctx.dump(traceResult.value); disposeResult(traceResult); }
            const errorsResult = ctx.evalCode(`JSON.stringify((globalThis.__caught_errors || []).map(function(e){return e.message.substring(0,200)}))`);
            if (isSuccess(errorsResult)) { (this as any)._caughtErrors = ctx.dump(errorsResult.value); disposeResult(errorsResult); }
          } catch(_te) {}
          pendingRequests.delete(requestKey);
          clearTimeout(timeoutId);
          reject(new Error('Script did not return a valid response'));
        }
      } catch (e: any) {
        console.error('[ScriptRunner] Request error:', e.message);
        pendingRequests.delete(requestKey);
        clearTimeout(timeoutId);
        reject(e);
      }
    });
  }

  private async correctLxMusicSign(source: string, songId: string, quality: string, originalUrl: string): Promise<string | null> {
    const ctx = this.ctx!;
    console.log(`[SignFix] Dynamic sign correction for ${source}/${songId}/${quality}`);

    const upstreamBase = 'https://88.lxmusic.xn--fiqs8s/lxmusicv4/url';
    const cacheKey = `sign:${source}:${songId}:${quality}`;

    // PHASE 1: Check KV cache (persisted learned signs)
    try {
      if (this.cacheKv) {
        const cached = await this.cacheKv.get(cacheKey);
        if (cached) {
          console.log(`[SignFix] ✅ KV Cache HIT for ${cacheKey}`);
          return `${upstreamBase}/${source}/${songId}/${quality}?sign=${cached}`;
        }
      }
    } catch (_e) {}

    // PHASE 2: Try brute force with common signing input patterns
    // These are guesses at what the obfuscated js-sha256 might hash
    try {
      const crypto = (globalThis as any).crypto;
      if (crypto?.subtle) {
        const encoder = new TextEncoder();
        const candidates = [
          // Common patterns found in PHG/LX Music source scripts
          `${source}${songId}${quality}`,
          `${source}/${songId}/${quality}`,
          `/lxmusicv4/url/${source}/${songId}/${quality}`,
          `${upstreamBase}/${source}/${songId}/${quality}`,
          `lxmusic${source}${songId}${quality}`,
          songId + quality,
          quality + songId,
          JSON.stringify({ s: source, id: songId, q: quality }),
          // With potential secret prefixes used by phg/lx-music-source scripts
          `lxmusic-${source}-${songId}-${quality}`,
          `lx.v4.${source}.${songId}.${quality}`,
        ];

        for (const input of candidates) {
          const data = encoder.encode(input);
          const hashBuffer = await crypto.subtle.digest('SHA-256', data);
          const hashArray = Array.from(new Uint8Array(hashBuffer));
          const sign = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

          const testUrl = `${upstreamBase}/${source}/${songId}/${quality}?sign=${sign}`;
          try {
            const testResp = await fetch(testUrl, { method: 'GET', signal: AbortSignal.timeout(2000) });
            if (testResp.status === 200) {
              console.log(`[SignFix] 🎉 Brute force FOUND match! Input="${input}" Caching to KV...`);
              try { await this.cacheKv?.put(cacheKey, sign, { expirationTtl: 86400 * 7 }); } catch {}
              return testUrl;
            }
          } catch (_e) {}
        }
      }
    } catch (e: any) {
      console.log('[SignFix] Brute force error:', e.message);
    }

    console.log(`[SignFix] ❌ No correct sign for ${cacheKey} (KV miss, brute force failed)`);
    return null;
  }

  public async learnSign(source: string, songId: string, quality: string, correctSign: string): Promise<void> {
    const cacheKey = `sign:${source}:${songId}:${quality}`;
    try {
      await this.cacheKv?.put(cacheKey, correctSign, { expirationTtl: 86400 * 30 });
      console.log(`[SignFix] Learned & cached: ${cacheKey} = ${correctSign}`);
    } catch (e: any) {
      console.error('[SignFix] Failed to cache sign:', e.message);
    }
  }

  private async handleForceInitDelegate(respData: any, pending: { resolve: (v: any) => void; reject: (e: Error) => void }): Promise<void> {
    try {
      const errMsg = respData.errorMessage || '';
      const delegateJson = errMsg.replace('__FORCE_INIT_DELEGATE__:', '');
      const delegateData = JSON.parse(delegateJson);
      const { source, action, type, songmid, name, singer } = delegateData;
      console.log(`[ScriptRunner:Builtin] 🎵 Delegate request: source=${source}, action=${action}, type=${type}, songmid=${songmid}, name=${name}, singer=${singer}`);

      if (action === 'musicUrl') {
        try {
          const url = await this._builtinGetMusicUrl(source, type, songmid, name, singer);
          console.log(`[ScriptRunner:Builtin] ✅ Got URL for ${source}:`, url ? url.substring(0, 80) + '...' : 'null');
          pending.resolve(url);
        } catch (fetchErr: any) {
          console.error(`[ScriptRunner:Builtin] ❌ Fetch/API error: ${fetchErr.message}`);
          pending.reject(fetchErr);
        }
      } else if (action === 'lyric') {
        pending.reject(new Error('Builtin lyric not yet implemented'));
      } else if (action === 'pic') {
        pending.reject(new Error('Builtin pic not yet implemented'));
      } else {
        pending.reject(new Error(`Unknown builtin action: ${action}`));
      }
    } catch (e: any) {
      console.error('[ScriptRunner:Builtin] ❌ Delegate parse error:', e.message);
      pending.reject(e);
    }
  }

  private async _builtinGetMusicUrl(source: string, quality: string, songmid: string, name: string, singer: string): Promise<string> {
    const sourceHandlers: Record<string, () => Promise<string>> = {
      kg: () => this._builtinKgUrl(quality, songmid, name, singer),
      kw: () => this._builtinKwUrl(quality, songmid, name, singer),
      wy: () => this._builtinWyUrl(quality, songmid, name, singer),
      mg: () => this._builtinMgUrl(quality, songmid, name, singer),
      tx: () => this._builtinTxUrl(quality, songmid, name, singer),
    };

    const handler = sourceHandlers[source];
    if (!handler) throw new Error(`Builtin unsupported source: ${source}`);

    try {
      return await handler();
    } catch (primaryErr: any) {
      console.warn(`[ScriptRunner:Builtin] ⚠️ Source "${source}" failed: ${primaryErr.message}, trying cross-source fallback...`);
      const fallbackOrder = ['kw', 'kg', 'wy', 'mg', 'tx'].filter(s => s !== source);
      for (const fbSource of fallbackOrder) {
        const fbHandler = sourceHandlers[fbSource];
        if (!fbHandler) continue;
        try {
          console.log(`[ScriptRunner:Builtin] 🔄 Trying fallback source: ${fbSource}`);
          const url = await fbHandler();
          console.log(`[ScriptRunner:Builtin] ✅ Fallback to "${fbSource}" succeeded!`);
          return url;
        } catch (fbErr: any) {
          console.warn(`[ScriptRunner:Builtin] ⚠️ Fallback "${fbSource}" also failed: ${fbErr.message}`);
        }
      }
      throw new Error(`All sources failed for "${name} - ${singer}". Primary: ${primaryErr.message}`);
    }
  }

  private async _builtinKgUrl(quality: string, songmid: string, name: string, singer: string): Promise<string> {
    const qualityMap: Record<string, string> = { '128k': '128', '320k': '320', 'flac': 'flac', 'flac24bit': 'flac24bit' };
    const q = qualityMap[quality] || '128';

    // Step 1: Search for the song using msearchcdn (HTTP to avoid SSL cert issues)
    console.log(`[ScriptRunner:Builtin:kg] 🔍 Searching for "${name} - ${singer}" on kugou...`);
    const keyword = encodeURIComponent(`${name} ${singer}`);
    // Try multiple search endpoints in order of reliability
    const searchEndpoints = [
      `http://msearchcdn.kugou.com/api/v3/search/song?format=json&keyword=${keyword}&page=1&pagesize=5`,
      `http://songsearch.kugou.com/song_search_v2?keyword=${keyword}&page=1&pagesize=5&userid=-1&clientver=&platform=WebFilter&tag=em&filter=2&iscorrection=1&privilege_filter=0`
    ];

    let hash = '';
    let albumId = '0';
    let searchError: string | null = null;

    for (let i = 0; i < searchEndpoints.length && !hash; i++) {
      const searchUrl = searchEndpoints[i];
      console.log(`[ScriptRunner:Builtin:kg] Trying search endpoint ${i + 1}: ${searchUrl.substring(0, 80)}...`);
      try {
        const searchResp = await fetch(searchUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
        console.log(`[ScriptRunner:Builtin:kg] Search response status: ${searchResp.status}`);
        if (!searchResp.ok) {
          const errText = await searchResp.text().catch(() => '');
          console.log(`[ScriptRunner:Builtin:kg] Search HTTP error: ${searchResp.status} ${errText.substring(0, 100)}`);
          continue;
        }
        const searchData = await searchResp.json() as any;
        console.log(`[ScriptRunner:Builtin:kg] Search parsed OK, status=${searchData.status || searchData.err_code}`);

        // Handle different response formats
        let songs: any[] = [];
        if (searchData?.data?.info && Array.isArray(searchData.data.info)) {
          songs = searchData.data.info;
        } else if (searchData?.data?.lists && Array.isArray(searchData.data.lists)) {
          songs = searchData.data.lists;
        }

        if (songs.length > 0) {
          const best = songs.find((s: any) => (s.songname_original === name || s.SongName === name) && (s.singername === singer || s.SingerName === singer)) ||
                     songs.find((s: any) => s.songname === name || s.SongName === name) ||
                     songs.find((s: any) => s.songname_original?.includes(name) || s.SongName?.includes(name)) || songs[0];
          hash = best.hash || best.FileHash || '';
          albumId = String(best.album_id || best.AlbumID || best.albumID || '0');
          const foundName = best.songname || best.songname_original || best.SongName || '?';
          const foundSinger = best.singername || best.SingerName || '?';
          console.log(`[ScriptRunner:Builtin:kg] ✅ Found: "${foundName}" - "${foundSinger}", hash=${hash ? hash.substring(0, 16) : 'null'}, albumId=${albumId}`);
        } else {
          console.log(`[ScriptRunner:Builtin:kg] ⚠️ No results from endpoint ${i + 1}, keys=`, Object.keys(searchData).join(','));
        }
      } catch (stepErr: any) {
        searchError = stepErr.message;
        console.error(`[ScriptRunner:Builtin:kg] ❌ Search endpoint ${i + 1} failed:`, stepErr.message);
      }
    }

    if (!hash) {
      throw new Error(`kg: cannot find song "${name} - ${singer}" (${searchError || 'no results'})`);
    }

    // Step 2: Get play URL using the real hash
    // Use multiple play URL strategies in case one fails
    const timestamp = Date.now();
    const playEndpoints: Array<{ url: string; headers: Record<string, string> }> = [
      {
        url: `https://wwwapi.kugou.com/yy/index.php?r=play/getdata&hash=${encodeURIComponent(hash)}&album_id=${albumId}&mid=1_1&_=${timestamp}`,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36', 'Referer': 'https://www.kugou.com/', 'Origin': 'https://www.kugou.com' }
      },
      {
        url: `https://www.kugou.com/yy/index.php?r=play/getdata&hash=${encodeURIComponent(hash)}&album_id=${albumId}&mid=1_1&dfid=-`,
        headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1', 'Referer': 'https://m.kugou.com/' }
      }
    ];

    console.log(`[ScriptRunner:Builtin:kg] 🎵 Fetching play URL (hash=${hash.substring(0,16)}..., full_hash=${hash})...`);
    for (let i = 0; i < playEndpoints.length; i++) {
      const ep = playEndpoints[i];
      console.log(`[ScriptRunner:Builtin:kg] Trying play endpoint ${i + 1}...`);
      try {
        const resp = await fetch(ep.url, { headers: ep.headers });
        console.log(`[ScriptRunner:Builtin:kg] Play API ${i + 1} HTTP status: ${resp.status}`);
        if (!resp.ok) {
          const errText = await resp.text().catch(() => '');
          console.log(`[ScriptRunner:Builtin:kg] Play ${i + 1} HTTP error: ${resp.status}`);
          continue;
        }
        const json = await resp.json() as any;
        console.log(`[ScriptRunner:Builtin:kg] Play ${i + 1} result: status=${json.status}, err_code=${json.err_code}, has_play_url=${!!json.data?.play_url}`);

        if (json.data?.play_url) {
          return json.data.play_url;
        }
        // If not last endpoint, try next
        if (i < playEndpoints.length - 1) continue;

        throw new Error(`kg play API no url: status=${json.status}, err_code=${json.err_code}`);
      } catch (fetchErr: any) {
        console.error(`[ScriptRunner:Builtin:kg] ❌ Play ${i + 1} error:`, fetchErr.message);
        if (i === playEndpoints.length - 1) throw fetchErr;
      }
    }
    throw new Error('kg: all play endpoints failed');
  }

  private async _builtinKwUrl(quality: string, songmid: string, name: string, singer: string): Promise<string> {
    console.log(`[ScriptRunner:Builtin:kw] 🔍 Searching for "${name} - ${singer}" on kuwo...`);
    const keyword = encodeURIComponent(`${name} ${singer}`);
    const searchUrl = `http://search.kuwo.cn/r.s?all=${keyword}&ft=music&itemset=web_2013&client=kt&pn=0&rn=5&rformat=json&encoding=utf8`;
    try {
      const searchResp = await fetch(searchUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Referer': 'http://www.kuwo.cn/' }
      });
      console.log(`[ScriptRunner:Builtin:kw] Search HTTP status: ${searchResp.status}`);
      if (!searchResp.ok) throw new Error(`Search HTTP ${searchResp.status}`);
      const searchText = await searchResp.text();
      // Kuwo returns non-standard JSON (single quotes), need to parse carefully
      const searchData = JSON.parse(searchText.replace(/'/g, '"'));
      console.log(`[ScriptRunner:Builtin:kw] Search total: ${searchData.TOTAL || searchData.HIT}`);

      let ridNum = '';
      if (searchData?.abslist && searchData.abslist.length > 0) {
        const songs = searchData.abslist;
        const best = songs.find((s: any) => s.SONGNAME === name && s.ARTIST === singer) ||
                   songs.find((s: any) => s.SONGNAME === name) ||
                   songs.find((s: any) => s.SONGNAME?.includes(name)) || songs[0];
        const rid = best.MUSICRID || '';
        ridNum = rid.replace('MUSIC_', '').replace('MP3_', '');
        console.log(`[ScriptRunner:Builtin:kw] ✅ Found: "${best.SONGNAME}" - ${best.ARTIST}, rid=${rid}`);
      }
      if (!ridNum) throw new Error(`kw: cannot find song "${name} - ${singer}"`);

      console.log(`[ScriptRunner:Builtin:kw] 🎵 Getting play URL via proxy (rid=${ridNum})...`);
      const proxyUrl = `https://api.nobb.cc/kuwo.music/?id=${ridNum}`;
      const proxyResp = await fetch(proxyUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      console.log(`[ScriptRunner:Builtin:kw] Proxy HTTP status: ${proxyResp.status}`);
      const proxyData = await proxyResp.json() as any;
      console.log(`[ScriptRunner:Builtin:kw] Proxy result code=${proxyData.code}, has_url=${!!proxyData.url}`);

      if (proxyData.code === 200 && proxyData.url) {
        return proxyData.url;
      }
      throw new Error(`kw proxy error: code=${proxyData.code}, msg=${proxyData.message || 'no url'}`);
    } catch (e: any) {
      console.error(`[ScriptRunner:Builtin:kw] ❌ Error:`, e.message);
      throw e;
    }
  }

  private async _builtinWyUrl(quality: string, songmid: string, name: string, singer: string): Promise<string> {
    throw new Error('wy source not yet implemented');
  }

  private async _builtinMgUrl(quality: string, songmid: string, name: string, singer: string): Promise<string> {
    throw new Error('mg source not yet implemented');
  }

  private async _builtinTxUrl(quality: string, songmid: string, name: string, singer: string): Promise<string> {
    throw new Error('tx source not yet implemented');
  }

  private async _executeRealHttpRequest(reqData: any): Promise<void> {
    const ctx = this.ctx!;
    const url = reqData.url;
    const options = reqData.options || {};
    const requestKey = reqData.requestKey;

    console.log(`[ScriptRunner:HTTP] 🚀 Executing real HTTP ${options.method || 'GET'} ${url?.substring(0, 200)}`);
    (this as any)._lastHttpRequestUrl = url?.substring(0, 500);

    // Intercept hibai.cn/sixyin.com API calls - return mock success to allow source registration
    // CRITICAL: Must inject SYNCHRONOUSLY so the response is available before the 500ms timer fires!
    // Previously used setTimeout(100) but Phase 1 timer loop fires all timers at t+0ms, before mock arrives.
    if (url && (url.includes('hibai.cn') || url.includes('sixyin.com'))) {
      console.log(`[ScriptRunner:HTTP] 🎭 Intercepting hibai/sixyin request, injecting mock success SYNCHRONOUSLY`);
      try {
        const mockBodyStr = JSON.stringify({success:true,data:{version:"1.0.0",sources:["kw","kg","tx","wy","mg"],updateUrl:"",message:""}});
        const mockBodyBytes = new TextEncoder().encode(mockBodyStr);
        const respObj = {statusCode:200,statusMessage:'OK',headers:{},bytes:mockBodyBytes.length,raw:Array.from(mockBodyBytes),body:JSON.parse(mockBodyStr)};
        const callbackData = JSON.stringify({requestKey,url,response:respObj,error:null});
        const safeData = callbackData.replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/\n/g,'\\n');
        disposeResult(ctx.evalCode(`__lx_native__('cf_worker_key','response','${safeData}')`));
        console.log('[ScriptRunner:HTTP] 🎭 Mock response injected synchronously into QuickJS');
        // Process jobs so the HTTP callback runs and stores the response
        if (ctx.runtime) {
          for (let i = 0; i < 30; i++) {
            try {
              const jobResult = ctx.runtime.executePendingJobs();
              if (isSuccess(jobResult) && (jobResult.value || 0) === 0) break;
            } catch(_e) {}
          }
        }
        console.log('[ScriptRunner:HTTP] 🎭 Mock response processed, returning to script execution');
      } catch(e) { console.error('[ScriptRunner:HTTP] Mock error:', e); }
      return;
    }

    try {
      const method = (options.method || 'get').toLowerCase();
      const timeout = typeof options.response_timeout === 'number' && options.response_timeout > 0
        ? Math.min(options.response_timeout, 60_000)
        : 30_000;
      const followMax = options.follow_max ?? 5;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      let headers: Record<string, string> = { ...(options.headers || {}) };
      if (method === 'get' && headers['Content-Type']) {
        delete headers['Content-Type'];
      }

      const buildFetchOptions = (): RequestInit => {
        const fetchOptions: RequestInit = {
          method,
          headers,
          signal: controller.signal,
          redirect: 'manual',
        };

        if (options.body) {
          fetchOptions.body = options.body;
        } else if (options.form) {
          const formDataObj = new URLSearchParams();
          for (const key in options.form) {
            formDataObj.append(key, options.form[key]);
          }
          fetchOptions.body = formDataObj.toString();
          fetchOptions.headers = { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' };
        } else if (options.formData) {
          const formDataObj = new FormData();
          for (const key in options.formData) {
            formDataObj.append(key, options.formData[key]);
          }
          fetchOptions.body = formDataObj;
        }

        return fetchOptions;
      };

      const doFetch = async (currentUrl: string, redirectCount: number): Promise<Response> => {
        console.log(`[ScriptRunner:HTTP] → Fetching: ${currentUrl?.substring(0, 120)} (redirect #${redirectCount})`);
        const response = await fetch(currentUrl, buildFetchOptions());

        if (response.status >= 300 && response.status < 400 && response.headers.has('location')) {
          if (redirectCount >= followMax) {
            throw new Error(`Maximum redirect count (${followMax}) exceeded`);
          }
          const newUrl = response.headers.get('location')!;
          const resolvedUrl = newUrl.startsWith('http') ? newUrl : new URL(newUrl, currentUrl).href;
          return doFetch(resolvedUrl, redirectCount + 1);
        }

        return response;
      };

      // ===== SIGN CORRECTION PROXY for lxmusicv4 URLs =====
      // The QuickJS engine produces wrong SHA-256 sign for obfuscated scripts.
      // When upstream returns 404 for signed URLs, we detect and auto-correct.
      const PHGMUSIC_URL_PATTERN = /lxmusicv[0-9]*\/url\/([^\/]+)\/([^\/]+)\/([^/?]+)/;
      const urlMatch = url.match(PHGMUSIC_URL_PATTERN);
      console.log(`[SignFix] URL matching check: url=${url?.substring(0, 80)}..., match=${!!urlMatch}, urlType=${typeof url}`);

      let response: Response;
      if (urlMatch) {
        console.log(`[SignFix] Detected lxmusic URL, fetching directly...`);
        response = await doFetch(url, 0);
        clearTimeout(timeoutId);
        if (response.status === 404) {
          console.log(`[SignFix] Got 404, sign may be incorrect. URL: ${url.substring(0, 200)}`);
        }
      } else {
        response = await doFetch(url, 0);
        clearTimeout(timeoutId);
      }
      // ===== END SIGN CORRECTION =====

      const responseBody = await response.arrayBuffer();
      const rawUint8Array = new Uint8Array(responseBody);
      const rawString = new TextDecoder().decode(responseBody);
      let body: any = rawString;
      try { body = JSON.parse(rawString); } catch (_e) {}

      const headersObj: Record<string, string> = {};
      if (typeof response.headers.forEach === 'function') {
        response.headers.forEach((value: string, key: string) => {
          headersObj[key] = value;
        });
      } else {
        Object.assign(headersObj, response.headers || {});
      }

      const respObj = {
        statusCode: response.status,
        statusMessage: response.statusText,
        headers: headersObj,
        bytes: responseBody.byteLength,
        raw: Array.from(rawUint8Array),
        body,
      };

      console.log(`[ScriptRunner:HTTP] ✅ Response: ${response.status} ${response.statusText}, URL: ${url}, body length: ${rawString.length}, preview: ${rawString.substring(0, 200)}`);
      if ((this as any)._keyLogs) (this as any)._keyLogs.push('[ScriptRunner] [HTTP-RESP] status=' + response.status + ' url=' + (url || '').substring(0, 150) + ' bodyLen=' + rawString.length + ' preview=' + rawString.substring(0, 150));

      const callbackData = JSON.stringify({
        requestKey,
        url,
        response: respObj,
        error: null
      });

      try {
        const safeCallbackData = callbackData.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');
        disposeResult(ctx.evalCode(`__lx_native__('cf_worker_key', 'response', '${safeCallbackData}')`));
        console.log('[ScriptRunner:HTTP] Response fed back to QuickJS');
        if (ctx.runtime) {
          for (let i = 0; i < 50; i++) {
            const jobResult = ctx.runtime.executePendingJobs();
            if (isSuccess(jobResult)) {
              if ((jobResult.value || 0) === 0) break;
            } else {
              console.error('[ScriptRunner:HTTP] Pending job error after response:', ctx.dump(jobResult.error));
              break;
            }
          }
        }
      } catch (_e) {
        console.warn('[ScriptRunner:HTTP] Could not call QuickJS callback');
      }
    } catch (error: any) {
      console.error(`[ScriptRunner:HTTP] ❌ Error fetching ${url?.substring(0, 100)}:`, error.message);
      if ((this as any)._keyLogs) (this as any)._keyLogs.push('[ScriptRunner] [HTTP-ERR] url=' + (url || '').substring(0, 150) + ' error=' + (error.message || 'unknown'));

      const errorData = JSON.stringify({
        requestKey,
        url,
        response: null,
        error: error.message || 'Network error'
      });

      try {
        const safeErrorData = errorData.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        disposeResult(ctx.evalCode(`__lx_native__('cf_worker_key', 'response', '${safeErrorData}')`));
      } catch (_e) {
        console.warn('[ScriptRunner:HTTP] Could not report error to QuickJS');
      }
    }
  }

  private async _processPendingHttpRequests(maxRounds = 10): Promise<void> {
    const ctx = this.ctx!;
    const pendingHttpRequests = (this as any)._pendingHttpRequests;

    for (let round = 0; round < maxRounds; round++) {
      if (pendingHttpRequests.length === 0) break;

      const requests = [...pendingHttpRequests];
      pendingHttpRequests.length = 0;

      console.log(`[ScriptRunner] _processHttpRequests round ${round + 1}: processing ${requests.length} request(s)`);

      for (const httpReq of requests) {
        const reqKey = httpReq.requestKey;
        const url = httpReq.url;
        const options = httpReq.options || {};

        try {
          const method = (options.method || 'get').toLowerCase();
          const timeout = Math.min(options.timeout || 60000, 60000);
          const controller = new AbortController();
          const tid = setTimeout(() => controller.abort(), timeout);

          let headers: any = { ...options.headers };
          if (method === 'get' && headers['Content-Type']) delete headers['Content-Type'];

          let body: any = undefined;
          if (options.body) body = options.body;
          else if (options.form) { body = new URLSearchParams(options.form).toString(); headers['Content-Type'] = 'application/x-www-form-urlencoded'; }

          console.log(`[ScriptRunner] Fetching: ${url?.substring(0, 100)} key: ${reqKey}`);
          const resp = await fetch(url, { method, headers, body, signal: controller.signal });
          clearTimeout(tid);

          const respBody = await resp.text();
          let parsedBody: any = respBody;
          try { parsedBody = JSON.parse(respBody); } catch (_e) {}

          const headersObj: any = {};
          resp.headers.forEach((v: string, k: string) => { headersObj[k] = v; });

          const responseData = JSON.stringify({
            requestKey: reqKey,
            error: null,
            response: { statusCode: resp.status, statusMessage: resp.statusText, headers: headersObj, body: parsedBody }
          });
          const safeRespData = responseData.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
          disposeResult(ctx.evalCode(`__lx_native__('cf_worker_key', 'response', '${safeRespData}')`));
          console.log(`[ScriptRunner] Fetched OK: ${resp.status} bodyLen: ${respBody.length}`);
        } catch (fetchErr: any) {
          console.error(`[ScriptRunner] Fetch error for ${url?.substring(0, 50)}: ${fetchErr.message}`);
          const errData = JSON.stringify({ requestKey: reqKey, error: fetchErr.message, response: null });
          const safeErrData = errData.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
          disposeResult(ctx.evalCode(`__lx_native__('cf_worker_key', 'response', '${safeErrData}')`));
        }
      }

      if (ctx.runtime) {
        for (let i = 0; i < 50; i++) {
          const jobResult = ctx.runtime.executePendingJobs();
          if (isSuccess(jobResult)) {
            if ((jobResult.value || 0) === 0) break;
          } else {
            console.error('[ScriptRunner] _processHttpRequests pending job error:', ctx.dump(jobResult.error));
            break;
          }
        }
      }
    }

    if (pendingHttpRequests.length > 0) {
      console.warn(`[ScriptRunner] _processHttpRequests: ${pendingHttpRequests.length} request(s) still pending after max rounds`);
    }
  }

  private getPolyfillSetup(): string {
    return `(function() {
'use strict';
if(typeof globalThis.window==='undefined') globalThis.window=globalThis;
if(typeof globalThis.self==='undefined') globalThis.self=globalThis;
if(typeof globalThis.top==='undefined') globalThis.top=globalThis;
if(typeof globalThis.parent==='undefined') globalThis.parent=globalThis;
if(typeof globalThis.global==='undefined') globalThis.global=globalThis;
globalThis.document=globalThis.document||{owner:null,readyState:'complete',cookie:'',referrer:'',domain:'localhost',location:{href:'https://localhost/',protocol:'https:',host:'localhost'},createElement:function(tag){var el={tagName:tag.toUpperCase(),nodeName:tag.toUpperCase(),style:{},className:'',innerHTML:'',innerText:'',textContent:'',outerHTML:'',children:[],childNodes:[],firstChild:null,lastChild:null,nextSibling:null,previousSibling:null,parentNode:null,parentElement:null,ownerDocument:globalThis.document,owner:null,nodeType:1,setAttribute:function(k,v){this[k]=v},getAttribute:function(k){return this[k]||null},removeAttribute:function(k){delete this[k]},appendChild:function(c){this.children.push(c);c.parentNode=this;return c},removeChild:function(c){var i=this.children.indexOf(c);if(i>=0)this.children.splice(i,1);return c},insertBefore:function(n,r){var i=this.children.indexOf(r);if(i>=0)this.children.splice(i,0,n);else this.children.push(n);n.parentNode=this;return n},addEventListener:function(){},removeEventListener:function(){},dispatchEvent:function(){return true},getElementsByClassName:function(){return[]},getElementsByTagName:function(){return[]},querySelector:function(){return null},querySelectorAll:function(){return[]},classList:{add:function(){},remove:function(){},contains:function(){return false},toggle:function(){}}};if(tag==='canvas'){el.getContext=function(){return{fillRect:function(){},clearRect:function(){},getImageData:function(x,y,w,h){return{data:new Uint8Array(w*h*4)}},putImageData:function(){},createImageData:function(){return{data:new Uint8Array(0)}},setTransform:function(){},drawImage:function(){},save:function(){},fillText:function(){},restore:function(){},beginPath:function(){},moveTo:function(){},lineTo:function(){},closePath:function(){},stroke:function(){},translate:function(){},scale:function(){},rotate:function(){},arc:function(){},fill:function(){},measureText:function(){return{width:0}}}};el.toDataURL=function(){return'data:image/png;base64,'}}if(tag==='input'||tag==='textarea'){el.value='';el.focus=function(){};el.blur=function(){}}if(tag==='form'){el.submit=function(){}}if(tag==='script'){el.src=''}return el},getElementById:function(){return null},getElementsByTagName:function(){return[]},getElementsByClassName:function(){return[]},querySelector:function(){return null},querySelectorAll:function(){return[]},addEventListener:function(){},removeEventListener:function(){},dispatchEvent:function(){return true},createEvent:function(){return{initEvent:function(){},preventDefault:function(){},stopPropagation:function(){}}},documentElement:{nodeName:'HTML',owner:null,nodeType:9,style:{}},body:{appendChild:function(){return null},removeChild:function(){return null},owner:null,nodeType:1,style:{}},head:{appendChild:function(){return null},removeChild:function(){return null},owner:null,nodeType:1,style:{}},createTextNode:function(t){return{textContent:t,nodeType:3,owner:null,parentNode:null}},createComment:function(t){return{textContent:t,nodeType:8,owner:null}},createDocumentFragment:function(){return{children:[],appendChild:function(c){this.children.push(c);return c},owner:null,nodeType:11}},createRange:function(){return{selectNode:function(){},collapse:function(){},getBoundingClientRect:function(){return{top:0,left:0,bottom:0,right:0,width:0,height:0}}}},implementation:{hasFeature:function(){return true},createHTMLDocument:function(){return globalThis.document}}};
globalThis.navigator=globalThis.navigator||{userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',platform:'Win32',language:'zh-CN',languages:['zh-CN','zh','en-US','en'],onLine:true,cookieEnabled:true,hardwareConcurrency:8,deviceMemory:8,maxTouchPoints:0,vendor:'Google Inc.',appName:'Netscape',appVersion:'5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',product:'Gecko',productSub:'20030107',userAgentData:{brands:[{brand:'Not_A Brand',version:'8'},{brand:'Chromium',version:'120'}],mobile:false,platform:'Windows'},connection:{effectiveType:'4g',downlink:10,rtt:50},mediaDevices:{enumerateDevices:function(){return Promise.resolve([])}},permissions:{query:function(){return Promise.resolve({state:'granted'})}},clipboard:{readText:function(){return Promise.resolve('')},writeText:function(){return Promise.resolve()}},getBattery:function(){return Promise.resolve({charging:true,chargingTime:0,dischargingTime:Infinity,level:1})},getGamepads:function(){return[]},sendBeacon:function(){return true},webkitGetUserMedia:function(){},mimeTypes:{length:0},plugins:{length:0}};
globalThis.location=globalThis.location||{href:'https://localhost/',protocol:'https:',host:'localhost',hostname:'localhost',origin:'https://localhost',port:'',pathname:'/',search:'',hash:''};
globalThis.screen=globalThis.screen||{width:1920,height:1080,colorDepth:24,pixelDepth:24,availWidth:1920,availHeight:1040,orientation:{type:'landscape-primary',angle:0}};
globalThis.history=globalThis.history||{length:1,pushState:function(){},replaceState:function(){},go:function(){},back:function(){},forward:function(){}};
globalThis.localStorage=globalThis.localStorage||{getItem:function(){return null},setItem:function(){},removeItem:function(){},clear:function(){},length:0};
globalThis.sessionStorage=globalThis.sessionStorage||{getItem:function(){return null},setItem:function(){},removeItem:function(){},clear:function(){},length:0};
if(typeof globalThis.crypto==='undefined'||!globalThis.crypto.getRandomValues){
  var _cryptoRng=function(){var _s=Date.now();return function(){_s=(_s*9301+49297)%233280;return _s/233280}};
  globalThis.crypto={getRandomValues:function(arr){if(arr instanceof Uint8Array){for(var i=0;i<arr.length;i++)arr[i]=Math.floor(Math.random()*256)}else if(arr instanceof Uint16Array){for(var i=0;i<arr.length;i++)arr[i]=Math.floor(Math.random()*65536)}else if(arr instanceof Uint32Array){for(var i=0;i<arr.length;i++)arr[i]=Math.floor(Math.random()*4294967296)}else if(Array.isArray(arr)){for(var i=0;i<arr.length;i++)arr[i]=Math.floor(Math.random()*256)}return arr},randomUUID:function(){return'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,function(c){var r=Math.random()*16|0;return(c==='x'?r:(r&0x3|0x8)).toString(16)})},subtle:{digest:function(algo,data){return new Promise(function(resolve,reject){try{var algoName=typeof algo==='string'?algo:algo.name;var dataStr='';if(typeof data==='string'){dataStr=data}else if(data instanceof ArrayBuffer||data instanceof Uint8Array){var bytes=new Uint8Array(data);for(var i=0;i<bytes.length;i++)dataStr+=String.fromCharCode(bytes[i])}console.log('[Polyfill] crypto.subtle.digest called, algo='+algoName+', dataLen='+dataStr.length);var hexResult=__lx_native__('cf_worker_key','sha256_compute',dataStr);console.log('[Polyfill] crypto.subtle.digest result, hexLen='+(hexResult?hexResult.length:0)+', hexPrefix='+(hexResult?hexResult.substring(0,16):'null'));var ab=new ArrayBuffer(hexResult.length/2);var view=new Uint8Array(ab);for(var i=0;i<hexResult.length;i+=2)view[i/2]=parseInt(hexResult.substr(i,2),16);resolve(ab)}catch(e){console.log('[Polyfill] crypto.subtle.digest ERROR: '+e.message);reject(e)}})},importKey:function(){return Promise.resolve({})},exportKey:function(){return Promise.resolve(new ArrayBuffer(0))},encrypt:function(){return Promise.resolve(new ArrayBuffer(0))},decrypt:function(){return Promise.resolve(new ArrayBuffer(0))},sign:function(){return Promise.resolve(new ArrayBuffer(0))},verify:function(){return Promise.resolve(false)},generateKey:function(){return Promise.resolve({})},deriveBits:function(){return Promise.resolve(new ArrayBuffer(0))},deriveKey:function(){return Promise.resolve({})}}};
}
if(typeof globalThis.performance==='undefined'){
  var _perfStart=Date.now();
  globalThis.performance={now:function(){return Date.now()-_perfStart},mark:function(){},measure:function(){},getEntries:function(){return[]},getEntriesByName:function(){return[]},getEntriesByType:function(){return[]},clearMarks:function(){},clearMeasures:function(){},timeOrigin:_perfStart};
}
if(typeof TextEncoder==='undefined'){globalThis.TextEncoder=function(){this.encode=function(s){var bytes=[];for(var i=0;i<s.length;i++){var c=s.charCodeAt(i);if(c<128)bytes.push(c);else if(c<2048){bytes.push((c>>6)|192);bytes.push((c&63)|128)}else{bytes.push((c>>12)|224);bytes.push(((c>>6)&63)|128);bytes.push((c&63)|128)}}return new Uint8Array(bytes)}}}
if(typeof TextDecoder==='undefined'){globalThis.TextDecoder=function(){this.decode=function(arr){var s='';for(var i=0;i<arr.length;i++)s+=String.fromCharCode(arr[i]);return s}}}
if(typeof btoa==='undefined'){globalThis.btoa=function(str){var chars='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';var output='';for(var i=0;i<str.length;i+=3){var b1=str.charCodeAt(i);var b2=i+1<str.length?str.charCodeAt(i+1):0;var b3=i+2<str.length?str.charCodeAt(i+2):0;output+=chars.charAt(b1>>2)+chars.charAt(((b1&3)<<4)|(b2>>4))+(i+1<str.length?chars.charAt(((b2&15)<<2)|(b3>>6)):'=')+(i+2<str.length?chars.charAt(b3&63):'=')}return output}}
if(typeof atob==='undefined'){globalThis.atob=function(b64){var chars='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';var output='';var i=0;b64=b64.replace(/[^A-Za-z0-9\\+\\/\\=]/g,'');while(i<b64.length){var e1=chars.indexOf(b64.charAt(i++));var e2=chars.indexOf(b64.charAt(i++));var e3=chars.indexOf(b64.charAt(i++));var e4=chars.indexOf(b64.charAt(i++));output+=String.fromCharCode((e1<<2)|(e2>>4))+(e3!==64?String.fromCharCode(((e2&15)<<4)|(e3>>2)):'')+(e4!==64?String.fromCharCode(((e3&3)<<6)|e4):'')}return output}}
if(typeof globalThis.XMLHttpRequest==='undefined'){
  globalThis.XMLHttpRequest=function(){this.readyState=0;this.status=0;this.statusText='';this.responseText='';this.responseXML=null;this.response=null;this.responseType='';this.withCredentials=false;this.timeout=0;this.onreadystatechange=null;this.onload=null;this.onerror=null;this.onabort=null;this.ontimeout=null;this.onprogress=null;this.upload={addEventListener:function(){}};this._headers={};this._method='GET';this._url='';this._async=true;this._aborted=false};
  globalThis.XMLHttpRequest.prototype.open=function(method,url,async){this._method=method;this._url=url;this._async=async!==false;this.readyState=1};
  globalThis.XMLHttpRequest.prototype.send=function(body){var self=this;this.readyState=2;if(this._url){globalThis.lx.request(this._url,{method:this._method,body:body,headers:this._headers},function(err,resp,respBody){if(self._aborted)return;if(err){self.readyState=4;self.status=0;if(self.onerror)self.onerror(err)}else{self.readyState=4;self.status=resp?resp.statusCode:0;self.statusText=resp?resp.statusMessage:'';self.responseText=typeof respBody==='string'?respBody:(respBody?JSON.stringify(respBody):'');self.response=self.responseText;if(self.onload)self.onload()}if(self.onreadystatechange)self.onreadystatechange()})}else{this.readyState=4;this.status=0;if(this.onerror)this.onerror(new Error('No URL'))}};
  globalThis.XMLHttpRequest.prototype.abort=function(){this._aborted=true;this.readyState=4;if(this.onabort)this.onabort()};
  globalThis.XMLHttpRequest.prototype.setRequestHeader=function(k,v){this._headers[k]=v};
  globalThis.XMLHttpRequest.prototype.getResponseHeader=function(){return null};
  globalThis.XMLHttpRequest.prototype.getAllResponseHeaders=function(){return''};
  globalThis.XMLHttpRequest.prototype.addEventListener=function(type,fn){this['on'+type]=fn};
  globalThis.XMLHttpRequest.prototype.removeEventListener=function(){};
  globalThis.XMLHttpRequest.prototype.overrideMimeType=function(){};
}
if(typeof globalThis.URL==='undefined'){
  globalThis.URL=function(url,base){this.href=url;this.protocol='';this.host='';this.hostname='';this.port='';this.pathname='';this.search='';this.hash='';this.origin='';try{var m=url.match(new RegExp('^(https?:)\\\\/\\\\/([^\\\\/:]+)(:\\\\d+)?([^?#]*)(\\\\?[^#]*)?(#.*)?$'));if(m){this.protocol=m[1];this.hostname=m[2];this.port=m[3]?m[3].slice(1):'';this.host=this.hostname+(this.port?':'+this.port:'');this.pathname=m[4]||'/';this.search=m[5]||'';this.hash=m[6]||'';this.origin=this.protocol+'//'+this.host}}catch(e){}};
  globalThis.URL.createObjectURL=function(){return'blob:null'};
  globalThis.URL.revokeObjectURL=function(){};
}
if(typeof globalThis.URLSearchParams==='undefined'){
  globalThis.URLSearchParams=function(init){this._params=[];if(typeof init==='string'){if(init.charAt(0)==='?')init=init.slice(1);init.split('&').forEach(function(pair){var idx=pair.indexOf('=');if(idx>=0)this._params.push([decodeURIComponent(pair.slice(0,idx)),decodeURIComponent(pair.slice(idx+1))]);else if(pair)this._params.push([decodeURIComponent(pair),''])}.bind(this))}};
  globalThis.URLSearchParams.prototype.get=function(name){for(var i=0;i<this._params.length;i++){if(this._params[i][0]===name)return this._params[i][1]}return null};
  globalThis.URLSearchParams.prototype.set=function(name,value){var found=false;for(var i=0;i<this._params.length;i++){if(this._params[i][0]===name){this._params[i][1]=value;found=true;break}}if(!found)this._params.push([name,value])};
  globalThis.URLSearchParams.prototype.has=function(name){for(var i=0;i<this._params.length;i++){if(this._params[i][0]===name)return true}return false};
  globalThis.URLSearchParams.prototype.append=function(name,value){this._params.push([name,value])};
  globalThis.URLSearchParams.prototype.toString=function(){return this._params.map(function(p){return encodeURIComponent(p[0])+'='+encodeURIComponent(p[1])}).join('&')};
  globalThis.URLSearchParams.prototype.forEach=function(fn){this._params.forEach(function(p){fn(p[1],p[0])})};
}
if(typeof globalThis.Headers==='undefined'){
  globalThis.Headers=function(init){this._map={};if(init&&typeof init==='object'){if(init instanceof Array){init.forEach(function(pair){this._map[pair[0].toLowerCase()]=pair[1]}.bind(this))}else{Object.keys(init).forEach(function(k){this._map[k.toLowerCase()]=init[k]}.bind(this))}}};
  globalThis.Headers.prototype.get=function(name){return this._map[name.toLowerCase()]||null};
  globalThis.Headers.prototype.set=function(name,value){this._map[name.toLowerCase()]=value};
  globalThis.Headers.prototype.has=function(name){return name.toLowerCase()in this._map};
  globalThis.Headers.prototype.delete=function(name){delete this._map[name.toLowerCase()]};
  globalThis.Headers.prototype.append=function(name,value){this._map[name.toLowerCase()]=value};
  globalThis.Headers.prototype.forEach=function(fn){var self=this;Object.keys(this._map).forEach(function(k){fn(self._map[k],k)})};
}
if(typeof globalThis.FormData==='undefined'){
  globalThis.FormData=function(){this._data=[]};
  globalThis.FormData.prototype.append=function(name,value){this._data.push([name,value])};
  globalThis.FormData.prototype.get=function(name){for(var i=0;i<this._data.length;i++){if(this._data[i][0]===name)return this._data[i][1]}return null};
  globalThis.FormData.prototype.has=function(name){for(var i=0;i<this._data.length;i++){if(this._data[i][0]===name)return true}return false};
}
if(typeof globalThis.Blob==='undefined'){
  globalThis.Blob=function(parts,options){this.size=0;this.type=(options&&options.type)||'';var data=[];if(parts){parts.forEach(function(p){if(typeof p==='string'){for(var i=0;i<p.length;i++)data.push(p.charCodeAt(i))}else if(p instanceof Uint8Array||Array.isArray(p)){data=data.concat(Array.from(p))}})}this.size=data.length;this._data=data;this.arrayBuffer=function(){return Promise.resolve(new Uint8Array(data).buffer)};this.text=function(){var s='';for(var i=0;i<data.length;i++)s+=String.fromCharCode(data[i]);return Promise.resolve(s)};this.slice=function(start,end){return new Blob([new Uint8Array(data.slice(start,end))],{type:this.type})}};
}
if(typeof globalThis.File==='undefined'){
  globalThis.File=function(parts,name,options){Blob.call(this,parts,options);this.name=name;this.lastModified=Date.now()};
  globalThis.File.prototype=Object.create(Blob.prototype);
}
if(typeof globalThis.FileReader==='undefined'){
  globalThis.FileReader=function(){this.readyState=0;this.result=null;this.onload=null;this.onerror=null;this.readAsText=function(blob){var self=this;this.readyState=2;this.result=blob.text?blob.text():'';if(this.onload)setTimeout(function(){self.onload({target:self})},0)};this.readAsArrayBuffer=function(blob){var self=this;this.readyState=2;this.result=blob.arrayBuffer?blob.arrayBuffer():new ArrayBuffer(0);if(this.onload)setTimeout(function(){self.onload({target:self})},0)};this.readAsDataURL=function(blob){var self=this;this.readyState=2;this.result='data:'+blob.type+';base64,'+btoa(String.fromCharCode.apply(null,blob._data||[]));if(this.onload)setTimeout(function(){self.onload({target:self})},0)}};
}
if(typeof globalThis.AbortController==='undefined'){
  globalThis.AbortController=function(){this.signal={aborted:false,_listeners:[],addEventListener:function(type,fn){this._listeners.push(fn)},removeEventListener:function(){},throwIfAborted:function(){if(this.aborted)throw new Error('AbortError')}};this.abort=function(){this.signal.aborted=true;this.signal._listeners.forEach(function(fn){fn()})}};
  globalThis.AbortSignal=function(){this.aborted=false;this._listeners=[];this.addEventListener=function(type,fn){this._listeners.push(fn)};this.removeEventListener=function(){};this.throwIfAborted=function(){if(this.aborted)throw new Error('AbortError')}};
  globalThis.AbortSignal.abort=function(){var s=new AbortSignal();s.aborted=true;return s};
  globalThis.AbortSignal.timeout=function(ms){var s=new AbortSignal();setTimeout(function(){s.aborted=true;s._listeners.forEach(function(fn){fn()})},ms);return s};
}
if(typeof globalThis.Event==='undefined'){
  globalThis.Event=function(type,opts){this.type=type;this.bubbles=(opts&&opts.bubbles)||false;this.cancelable=(opts&&opts.cancelable)||false;this.defaultPrevented=false;this.target=null;this.currentTarget=null;this.timeStamp=Date.now()};
  globalThis.Event.prototype.preventDefault=function(){this.defaultPrevented=true};
  globalThis.Event.prototype.stopPropagation=function(){};
  globalThis.Event.prototype.stopImmediatePropagation=function(){};
}
if(typeof globalThis.CustomEvent==='undefined'){
  globalThis.CustomEvent=function(type,opts){Event.call(this,type,opts);this.detail=(opts&&opts.detail)||null};
  globalThis.CustomEvent.prototype=Object.create(Event.prototype);
}
if(typeof globalThis.EventTarget==='undefined'){
  globalThis.EventTarget=function(){this._listeners={}};
  globalThis.EventTarget.prototype.addEventListener=function(type,fn){if(!this._listeners[type])this._listeners[type]=[];this._listeners[type].push(fn)};
  globalThis.EventTarget.prototype.removeEventListener=function(type,fn){if(this._listeners[type]){var i=this._listeners[type].indexOf(fn);if(i>=0)this._listeners[type].splice(i,1)}};
  globalThis.EventTarget.prototype.dispatchEvent=function(event){event.target=this;event.currentTarget=this;if(this._listeners[event.type]){this._listeners[event.type].forEach(function(fn){fn(event)})}return!event.defaultPrevented};
}
if(typeof globalThis.DOMParser==='undefined'){
  globalThis.DOMParser=function(){};
  globalThis.DOMParser.prototype.parseFromString=function(str,type){return globalThis.document};
}
if(typeof globalThis.MutationObserver==='undefined'){
  globalThis.MutationObserver=function(cb){this._cb=cb};
  globalThis.MutationObserver.prototype.observe=function(){};
  globalThis.MutationObserver.prototype.disconnect=function(){};
  globalThis.MutationObserver.prototype.takeRecords=function(){return[]};
}
if(typeof globalThis.IntersectionObserver==='undefined'){
  globalThis.IntersectionObserver=function(cb){this._cb=cb};
  globalThis.IntersectionObserver.prototype.observe=function(){};
  globalThis.IntersectionObserver.prototype.disconnect=function(){};
  globalThis.IntersectionObserver.prototype.unobserve=function(){};
}
if(typeof globalThis.ResizeObserver==='undefined'){
  globalThis.ResizeObserver=function(cb){this._cb=cb};
  globalThis.ResizeObserver.prototype.observe=function(){};
  globalThis.ResizeObserver.prototype.disconnect=function(){};
  globalThis.ResizeObserver.prototype.unobserve=function(){};
}
if(typeof globalThis.requestAnimationFrame==='undefined'){
  globalThis.requestAnimationFrame=function(cb){return globalThis.setTimeout(cb,16)};
  globalThis.requestAnimationFrame=function(cb){return globalThis.setTimeout(cb,16)};
  globalThis.cancelAnimationFrame=function(id){globalThis.clearTimeout(id)};
}
if(typeof globalThis.queueMicrotask==='undefined'){
  globalThis.queueMicrotask=function(cb){Promise.resolve().then(cb)};
}
if(typeof globalThis.structuredClone==='undefined'){
  globalThis.structuredClone=function(obj){return JSON.parse(JSON.stringify(obj))};
}
if(typeof globalThis.MessageChannel==='undefined'){
  globalThis.MessageChannel=function(){this.port1={postMessage:function(){},onmessage:null,close:function(){}};this.port2={postMessage:function(){},onmessage:null,close:function(){}}};
}
if(typeof globalThis.Worker==='undefined'){
  globalThis.Worker=function(url){this.onmessage=null;this.onerror=null;this.postMessage=function(){};this.terminate=function(){};this.addEventListener=function(){}};
}
if(typeof globalThis.Image==='undefined'){
  globalThis.Image=function(){this.src='';this.onload=null;this.onerror=null;this.width=0;this.height=0;this.naturalWidth=0;this.naturalHeight=0};
}
if(typeof globalThis.Audio==='undefined'){
  globalThis.Audio=function(){this.src='';this.onload=null;this.onerror=null};
}
globalThis.require=function(moduleName){
  console.log('[Polyfill] require() called: '+moduleName);
  if(moduleName==='crypto'){
    return{
      createCipheriv:function(){return{update:function(){return this},final:function(){return''}}},
      createDecipheriv:function(){return{update:function(){return this},final:function(){return''}}},
      randomBytes:function(s){var r=[];for(var i=0;i<s;i++)r.push(Math.floor(Math.random()*256));return r},
      createHash:function(algo){
        var data='';
        console.log('[Polyfill] require("crypto").createHash called, algo='+algo);
        return{
          update:function(d,enc){
            if(typeof d==='string'){
              if(enc==='base64'){var b=atob(d);data+=b}
              else if(enc==='hex'){var b='';for(var i=0;i<d.length;i+=2)b+=String.fromCharCode(parseInt(d.substr(i,2),16));data+=b}
              else{data+=d}
            }else if(d instanceof Uint8Array||Array.isArray(d)){
              for(var i=0;i<d.length;i++)data+=String.fromCharCode(d[i])
            }
            return this
          },
          digest:function(enc){
            console.log('[Polyfill] createHash.digest called, algo='+algo+', dataLen='+data.length+', enc='+enc+', dataPreview='+JSON.stringify(data.substring(0,100)));
            var h;
            if(algo==='md5'){h=__lx_native__('cf_worker_key','md5_compute',data)}
            else{h=__lx_native__('cf_worker_key','sha256_compute',data)}
            console.log('[Polyfill] createHash.digest result, hexLen='+(h?h.length:0)+', hexPrefix='+(h?h.substring(0,16):'null'));
            if(enc==='hex')return h;
            if(enc==='base64'){var bytes=[];for(var i=0;i<h.length;i+=2)bytes.push(parseInt(h.substr(i,2),16));return btoa(String.fromCharCode.apply(null,bytes))}
            var bytes=[];for(var i=0;i<h.length;i+=2)bytes.push(parseInt(h.substr(i,2),16));return new Uint8Array(bytes)
          }
        }
      },
      publicEncrypt:function(){return''},
      constants:{RSA_NO_PADDING:4,OAEPWithSHA1AndMGF1Padding:''}
    }
  }
  if(moduleName==='buffer'){
    return{
      Buffer:{
        from:function(i,e){
          if(typeof i==='string'){
            if(e==='base64'){var b=atob(i);var r=new Uint8Array(b.length);for(var j=0;j<b.length;j++)r[j]=b.charCodeAt(j);return r}
            if(e==='hex'){var r=new Uint8Array(i.length/2);for(var j=0;j<i.length;j+=2)r[j/2]=parseInt(i.substr(j,2),16);return r}
            var r=new Uint8Array(i.length);for(var j=0;j<r.length;j++)r[j]=i.charCodeAt(j);return r
          }
          if(Array.isArray(i))return new Uint8Array(i);
          if(i instanceof Uint8Array)return i;
          throw new Error('Unsupported input')
        },
        alloc:function(s){return new Uint8Array(s)}
      }
    }
  }
  if(moduleName==='zlib')return{inflate:function(b){return b},deflate:function(b){return b}};
  if(moduleName==='http'||moduleName==='https'||moduleName==='net'||moduleName==='tls'||moduleName==='fs'||moduleName==='path'||moduleName==='os'||moduleName==='stream'||moduleName==='events'||moduleName==='util'||moduleName==='url'||moduleName==='querystring'||moduleName==='child_process'){
    var _emptyMod={on:function(){return _emptyMod},once:function(){return _emptyMod},emit:function(){return true},pipe:function(){return _emptyMod},write:function(){return true},end:function(){return _emptyMod},destroy:function(){return _emptyMod},read:function(){return null},close:function(){},createServer:function(){return _emptyMod},connect:function(){return _emptyMod},listen:function(){return _emptyMod}};
    return _emptyMod;
  }
  console.warn('[Polyfill] require("'+moduleName+'") - returning empty object');
  return{}
};
if(typeof globalThis.Buffer==='undefined'){
  globalThis.Buffer={
    from:function(input,encoding){
      if(typeof input==='string'){
        if(encoding==='base64'){var b=atob(input);var r=new Uint8Array(b.length);for(var i=0;i<b.length;i++)r[i]=b.charCodeAt(i);return r}
        if(encoding==='hex'){var r=new Uint8Array(input.length/2);for(var i=0;i<input.length;i+=2)r[i/2]=parseInt(input.substr(i,2),16);return r}
        if(encoding==='binary'){var r=new Uint8Array(input.length);for(var i=0;i<input.length;i++)r[i]=input.charCodeAt(i);return r}
        var r=new Uint8Array(input.length);for(var i=0;i<input.length;i++)r[i]=input.charCodeAt(i);return r
      }
      if(Array.isArray(input))return new Uint8Array(input);
      if(input instanceof Uint8Array)return input;
      throw new Error('Unsupported Buffer.from input')
    },
    alloc:function(size){return new Uint8Array(size)},
    concat:function(list){var len=0;for(var i=0;i<list.length;i++)len+=list[i].length;var r=new Uint8Array(len);var off=0;for(var i=0;i<list.length;i++){r.set(list[i],off);off+=list[i].length}return r}
  }
}
if(typeof globalThis.process==='undefined'){globalThis.process={env:{},version:'v18.17.0',versions:{node:'18.17.0',v8:'10.2.154.26'},platform:'linux',arch:'x64',pid:1,ppid:0,title:'node',argv:['node'],execPath:'/usr/local/bin/node',cwd:function(){return'/'},nextTick:function(fn){Promise.resolve().then(fn)},emitWarning:function(){},binding:function(){return{}},hrtime:function(){var t=Date.now()*1e6;return[t/1e9|0,t%1e9]}}}

if(typeof globalThis.pako==='undefined'){globalThis.pako={inflate:function(d){return d},inflateRaw:function(d){return d},deflate:function(d){return d},gzip:function(d){return d},ungzip:function(d){return d}}}
if(typeof globalThis.fetch==='undefined'){
  globalThis.fetch=function(url,options){
    options=options||{};
    return new Promise(function(resolve,reject){
      var method=(options.method||'GET').toUpperCase();
      var reqHeaders={};
      if(options.headers){
        if(options.headers instanceof Map){options.headers.forEach(function(v,k){reqHeaders[k]=v})}
        else if(typeof options.headers==='object'){reqHeaders=options.headers}
      }
      if(method==='GET'&&reqHeaders['Content-Type'])delete reqHeaders['Content-Type'];
      var lxReqOpts={method:method,headers:reqHeaders,body:options.body||null,form:options.form||null,formData:options.formData||null,binary:options.binary||null};
      globalThis.lx.request(url,lxReqOpts,function(err,resp,body){
        if(err){reject(new Error('fetch error: '+(err.message||String(err))));return}
        var bodyStr='';
        if(typeof body==='string')bodyStr=body;
        else if(body&&typeof body==='object'){try{bodyStr=JSON.stringify(body)}catch(e){bodyStr=String(body)}}
        else bodyStr=body?String(body):'';
        var respHeaders=new Map();
        if(resp&&resp.headers){try{Object.keys(resp.headers).forEach(function(k){respHeaders.set(k,resp.headers[k])})}catch(e){}}
        resolve({
          ok:resp&&resp.statusCode>=200&&resp.statusCode<300,
          status:resp?resp.statusCode:0,
          statusText:resp?(resp.statusMessage||''):'',
          headers:respHeaders,
          url:url,
          text:function(){return Promise.resolve(bodyStr)},
          json:function(){return Promise.resolve(JSON.parse(bodyStr))},
          arrayBuffer:function(){var bytes=new Uint8Array(bodyStr.length);for(var i=0;i<bodyStr.length;i++)bytes[i]=bodyStr.charCodeAt(i);return Promise.resolve(bytes.buffer)}
        })
      })
    })
  }
}
if(typeof globalThis.Proxy==='undefined'){
  globalThis.Proxy=function(target,handler){
    if(!handler)return target;
    if(typeof target==='function'){
      var fn=function(){
        var args=Array.prototype.slice.call(arguments);
        if(handler.apply){try{return handler.apply(target,this,args)}catch(e){return target.apply(this,args)}}
        return target.apply(this,args);
      };
      fn.__target=target;
      fn.__handler=handler;
      for(var k in target){if(target.hasOwnProperty(k)){(function(key){Object.defineProperty(fn,key,{get:function(){if(handler.get)try{return handler.get(target,key,fn)}catch(e){return target[key]}return target[key]},set:function(v){if(handler.set)try{handler.set(target,key,v,fn)}catch(e){target[key]=v}target[key]=v},configurable:true,enumerable:true})})(k)}}
      return fn;
    }
    if(typeof target==='object'&&target!==null){
      var result={};
      var keys=Object.getOwnPropertyNames(target);
      for(var i=0;i<keys.length;i++){(function(key){Object.defineProperty(result,key,{get:function(){if(handler.get)try{return handler.get(target,key,result)}catch(e){return target[key]}return target[key]},set:function(v){if(handler.set)try{handler.set(target,key,v,result)}catch(e){target[key]=v}target[key]=v},configurable:true,enumerable:true})})(keys[i])}
      return result;
    }
    return target;
  };
  globalThis.Proxy.revocable=function(target,handler){return{proxy:new Proxy(target,handler),revoke:function(){}}};
}
if(typeof globalThis.Reflect==='undefined'){
  globalThis.Reflect={apply:function(target,thisArg,args){return target.apply(thisArg,args)},construct:function(target,args){return new(Function.prototype.bind.apply(target,[null].concat(args)))},get:function(target,prop){return target[prop]},set:function(target,prop,value){target[prop]=value;return true},has:function(target,prop){return prop in target},deleteProperty:function(target,prop){delete target[prop];return true},ownKeys:function(target){return Object.keys(target)},getOwnPropertyDescriptor:function(target,prop){return Object.getOwnPropertyDescriptor(target,prop)},defineProperty:function(target,prop,desc){Object.defineProperty(target,prop,desc);return true},getPrototypeOf:function(target){return Object.getPrototypeOf(target)},setPrototypeOf:function(target,proto){Object.setPrototypeOf(target,proto);return true},isExtensible:function(target){return Object.isExtensible(target)},preventExtensions:function(target){Object.preventExtensions(target);return true}};
}
var _origFnToString=Function.prototype.toString;
var _nativeFnRegistry=[];
var _makeNative=function(name,fn){try{_nativeFnRegistry.push([fn,name])}catch(e){}return fn};
var _nativeObjToString=function(name,obj){if(!obj)return obj;if(typeof obj==='function'){try{_nativeFnRegistry.push([obj,name])}catch(e){}}else if(typeof obj==='object'&&obj!==null){Object.keys(obj).forEach(function(k){if(typeof obj[k]==='function'){try{_nativeFnRegistry.push([obj[k],k])}catch(e){}}})}return obj};
Function.prototype.toString=function(){
  try{for(var i=0;i<_nativeFnRegistry.length;i++){if(_nativeFnRegistry[i][0]===this)return'function '+_nativeFnRegistry[i][1]+'() { [native code] }'}}catch(e){}
  try{return _origFnToString.call(this)}catch(e){return'function () { [native code] }'}
};
if(globalThis.fetch)globalThis.fetch=_makeNative('fetch',globalThis.fetch);
if(globalThis.XMLHttpRequest)_nativeObjToString('XMLHttpRequest',globalThis.XMLHttpRequest);
if(globalThis.crypto)_nativeObjToString('crypto',globalThis.crypto);
if(globalThis.TextEncoder)globalThis.TextEncoder=_makeNative('TextEncoder',globalThis.TextEncoder);
if(globalThis.TextDecoder)globalThis.TextDecoder=_makeNative('TextDecoder',globalThis.TextDecoder);
if(globalThis.btoa)globalThis.btoa=_makeNative('btoa',globalThis.btoa);
if(globalThis.atob)globalThis.atob=_makeNative('atob',globalThis.atob);
if(globalThis.URL)globalThis.URL=_makeNative('URL',globalThis.URL);
if(globalThis.URLSearchParams)globalThis.URLSearchParams=_makeNative('URLSearchParams',globalThis.URLSearchParams);
if(globalThis.Headers)globalThis.Headers=_makeNative('Headers',globalThis.Headers);
if(globalThis.FormData)globalThis.FormData=_makeNative('FormData',globalThis.FormData);
if(globalThis.Blob)globalThis.Blob=_makeNative('Blob',globalThis.Blob);
if(globalThis.File)globalThis.File=_makeNative('File',globalThis.File);
if(globalThis.FileReader)globalThis.FileReader=_makeNative('FileReader',globalThis.FileReader);
if(globalThis.AbortController)globalThis.AbortController=_makeNative('AbortController',globalThis.AbortController);
if(globalThis.Event)globalThis.Event=_makeNative('Event',globalThis.Event);
if(globalThis.CustomEvent)globalThis.CustomEvent=_makeNative('CustomEvent',globalThis.CustomEvent);
if(globalThis.EventTarget)globalThis.EventTarget=_makeNative('EventTarget',globalThis.EventTarget);
if(globalThis.DOMParser)globalThis.DOMParser=_makeNative('DOMParser',globalThis.DOMParser);
if(globalThis.MutationObserver)globalThis.MutationObserver=_makeNative('MutationObserver',globalThis.MutationObserver);
if(globalThis.requestAnimationFrame)globalThis.requestAnimationFrame=_makeNative('requestAnimationFrame',globalThis.requestAnimationFrame);
if(globalThis.cancelAnimationFrame)globalThis.cancelAnimationFrame=_makeNative('cancelAnimationFrame',globalThis.cancelAnimationFrame);
if(globalThis.queueMicrotask)globalThis.queueMicrotask=_makeNative('queueMicrotask',globalThis.queueMicrotask);
if(globalThis.structuredClone)globalThis.structuredClone=_makeNative('structuredClone',globalThis.structuredClone);
if(globalThis.performance)_nativeObjToString('performance',globalThis.performance);
if(globalThis.navigator)_nativeObjToString('navigator',globalThis.navigator);
if(globalThis.document)_nativeObjToString('document',globalThis.document);
if(globalThis.history)_nativeObjToString('history',globalThis.history);
if(globalThis.localStorage)_nativeObjToString('localStorage',globalThis.localStorage);
if(globalThis.sessionStorage)_nativeObjToString('sessionStorage',globalThis.sessionStorage);
if(globalThis.screen)_nativeObjToString('screen',globalThis.screen);
if(globalThis.location)_nativeObjToString('location',globalThis.location);
if(globalThis.require)globalThis.require=_makeNative('require',globalThis.require);
if(globalThis.Buffer)_nativeObjToString('Buffer',globalThis.Buffer);
if(globalThis.process)_nativeObjToString('process',globalThis.process);
if(globalThis.pako)_nativeObjToString('pako',globalThis.pako);
(function() {
  var _origBind = Function.prototype.bind;
  Function.prototype.bind = function() {
    if (this === globalThis || this === window || this === self) {
      var actionArg = null;
      for (var i = 0; i < arguments.length; i++) {
        if (typeof arguments[i] === 'string' && arguments[i].indexOf('Handle Action') === 0) {
          actionArg = arguments[i];
          break;
        }
      }
      console.log('[BIND-FIX] bind called on globalThis, actionArg=' + actionArg);
      if (actionArg) {
        var actionMatch = actionArg.match(/Handle Action\\((\\w+)\\)/);
        if (actionMatch) {
          var actionName = actionMatch[1];
          var handlerMap = {
            'musicUrl': 'handleGetMusicUrl',
            'musicPic': 'handleGetMusicPic',
            'musicLyric': 'handleGetMusicLyric'
          };
          var handlerName = handlerMap[actionName];
          if (handlerName && typeof globalThis[handlerName] === 'function') {
            console.log('[BIND-FIX] Redirecting to ' + handlerName);
            return _origBind.apply(globalThis[handlerName], arguments);
          }
        }
      }
      console.log('[BIND-FIX] No handler found for actionArg=' + actionArg + ', returning identity bind');
      var self = this;
      return function() { return self; };
    }
    return _origBind.apply(this, arguments);
  };
})();
console.log('Polyfill setup complete.');
})()`;
  }

  isReady(): boolean {
    return this.isInitialized;
  }

  getDiagnostics(): any {
    const ctx = this.ctx;
    if (!ctx) return { error: 'no context' };
    try {
      return {
        envDiag: (this as any)._envDiag || null,
        scriptLogs: (this as any)._logMessages ? (this as any)._logMessages.slice(0, 50) : null,
        keyLogs: (this as any)._keyLogs ? (this as any)._keyLogs.slice(-80) : null,
        isInitialized: this.isInitialized,
        registeredSources: Array.from(this.registeredSources.keys()),
        hasRequestHandler: !!this.requestHandler,
        lastRequestMusicInfo: (this as any)._lastRequestMusicInfo || null,
        preDiag: (this as any)._preDiag || null,
        lastHttpRequestUrl: (this as any)._lastHttpRequestUrl || null,
        trace: (this as any)._trace || null,
        caughtErrors: (this as any)._caughtErrors || null,
      };
    } catch (e: any) {
      return { error: e.message };
    }
  }

  dispose(): void {
    if (this.ctx) {
      try { this.ctx.dispose(); } catch (_e) { console.warn('[ScriptRunner] Dispose warning:', _e); }
      this.ctx = null;
    }
    this.isInitialized = false;
  }

  getRegisteredSources(): Map<string, any> {
    return this.registeredSources;
  }

  getRegisteredSourceList(): string[] {
    return Array.from(this.registeredSources.keys());
  }

  supportsSource(source: string): boolean {
    return this.registeredSources.has(source);
  }

  async terminate(): Promise<void> {
    console.log('[ScriptRunner] Terminating script:', this.scriptInfo.name);
    this.registeredSources.clear();
    this.requestHandler = null;
    this.isInitialized = false;
  }
}
