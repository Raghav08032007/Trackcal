import { readFileSync } from "node:fs";
import { it, expect, vi } from "vitest";
it("serves a complete cached journal when navigation fails and never caches private routes", async()=>{
  const handlers: Record<string,(event: {request: {url:string;method:string;mode:string};respondWith: (response:Promise<unknown>)=>void})=>void>={};
  const match=vi.fn(async(path:string)=>({cached:path})), fetcher=vi.fn().mockRejectedValue(new Error("offline"));
  const self={location:{origin:"https://trackcal.test"},addEventListener:(name:string,handler:typeof handlers[string])=>{handlers[name]=handler;}};
  new Function("self","caches","fetch","importScripts",readFileSync("public/sw.js","utf8"))(self,{match},fetcher,()=>{});
  let response:Promise<unknown>|undefined; const respondWith=(value:Promise<unknown>)=>{response=value;};
  handlers.fetch({request:{url:"https://trackcal.test/tools",method:"GET",mode:"navigate"},respondWith});
  expect(await response).toEqual({cached:"/offline.html"});
  response=undefined; handlers.fetch({request:{url:"https://trackcal.test/api/account/session",method:"GET",mode:"cors"},respondWith}); expect(response).toBeUndefined();
  handlers.fetch({request:{url:"https://trackcal.test/offline.js",method:"GET",mode:"no-cors"},respondWith}); expect(await response).toEqual({cached:"/offline.js"});
});
