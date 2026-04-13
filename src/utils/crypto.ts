import { aesEncryptECB } from "./aes";

const iv = new Uint8Array([0x30,0x31,0x32,0x33,0x34,0x35,0x36,0x37,0x38,0x39,0x30,0x31,0x32,0x33,0x34,0x35,0x36,0x37,0x38]);
const presetKey = new Uint8Array([0x30,0x43,0x6f,0x4a,0x55,0x6d,0x36,0x51,0x79,0x77,0x38,0x57,0x38,0x6a,0x75,0x64]);
const linuxapiKey = new Uint8Array([0x72,0x46,0x67,0x42,0x26,0x68,0x23,0x25,0x32,0x3f,0x5e,0x65,0x44,0x67,0x3a,0x51]);
const base62 = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function base64Encode(data: Uint8Array): string {
  const c = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"; let r = ""; let i = 0;
  while (i < data.length) { const b1=data[i++],b2=i<data.length?data[i++]:0,b3=i<data.length?data[i++]:0; r+=c[b1>>2]+c[((b1&3)<<4)|(b2>>4)]+(i-2<data.length?c[((b2&0xf)<<2)|(b3>>6)]:"=")+(i-1<data.length?c[b3&0x3f]:"="); }
  return r;
}
function generateSecretKey(): Uint8Array { const k=new Uint8Array(16);for(let i=0;i<16;i++)k[i]=base62.charCodeAt(Math.floor(Math.random()*62));return k; }

async function aesEncryptCBC(buffer:Uint8Array,key:Uint8Array,civ:Uint8Array):Promise<Uint8Array> {
  const ck=await crypto.subtle.importKey("raw",key,{name:"AES-CBC"},false,["encrypt"]);
  return new Uint8Array(await crypto.subtle.encrypt({name:"AES-CBC",iv:civ},ck,buffer));
}

export async function weapi(object:any):Promise<{params:string;encSecKey:string}> {
  const text=JSON.stringify(object);const sk=generateSecretKey();
  const e1=await aesEncryptCBC(new TextEncoder().encode(text),presetKey,iv);
  const e2=await aesEncryptCBC(new TextEncoder().encode(base64Encode(e1)),sk,iv);
  return {params:base64Encode(e2),encSecKey:"257348aecb5e556c066de214e531faadd1c55d814f9be95fd06d6bff9f4c7a41f831f6394d5a3fd2e3881736d94a02ca919d952872e7d0a50ebfa1769a7a62d512f5f1ca21aec60bc3819a04c476f323190e640c2ea7dcef6d9f0b7e1e9b4b0e0e6b0e0e6b0e0e6b0e0e6b0"};
}

export function linuxapi(object:any):{eparams:string} {
  const text=JSON.stringify(object);const d=new TextEncoder().encode(text);
  const bs=16;const p=bs-(d.length%bs);const pd=new Uint8Array(d.length+p);pd.set(d);
  for(let i=d.length;i<pd.length;i++)pd[i]=p;
  const enc=aesEncryptECB(pd,linuxapiKey);
  return {eparams:Array.from(enc).map(b=>b.toString(16).padStart(2,"0")).join("").toUpperCase()};
}
