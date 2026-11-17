// Runs the real public/sw.js in a fake service-worker scope.
import {it,expect,vi} from 'vitest';
import {readFileSync} from 'node:fs';
const source=readFileSync('public/sw.js','utf8');
function load(){
 const handlers:Record<string,(e:unknown)=>void>={},shown:{title:string;options:Record<string,unknown>}[]=[];
 const client={url:'http://localhost/home',focus:vi.fn(async()=>{}),navigate:vi.fn(async()=>{})};
 const subscription={endpoint:'https://push.example.com/new',toJSON:()=>({endpoint:'https://push.example.com/new',keys:{p256dh:'p'.repeat(40),auth:'a'.repeat(16)}})};
 const self={location:{origin:'http://localhost'},addEventListener:(type:string,fn:(e:unknown)=>void)=>{handlers[type]=fn;},skipWaiting:vi.fn(),
  registration:{showNotification:vi.fn(async(title:string,options:Record<string,unknown>)=>{shown.push({title,options});}),pushManager:{subscribe:vi.fn(async()=>subscription)}},
  clients:{claim:vi.fn(),matchAll:vi.fn(async()=>[client]),openWindow:vi.fn()}};
 const fetcher=vi.fn<(url:string,init?:RequestInit)=>Promise<Response>>(async url=>url.endsWith('/config')?Response.json({enabled:true,public_key:'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U'}):Response.json({}));
 const caches={open:vi.fn(async()=>({addAll:vi.fn(async()=>{})})),keys:vi.fn(async()=>[]),match:vi.fn()};
 new Function('self','importScripts','caches','fetch','atob',source)(self,()=>{},caches,fetcher,atob);
 const fire=async(type:string,event:Record<string,unknown>)=>{let work:Promise<unknown>=Promise.resolve();handlers[type]({...event,waitUntil:(p:Promise<unknown>)=>{work=p;}});await work;};
 return {self,shown,client,fetcher,fire};
}
it('shows only a short title, neutral body, safe link and id from a push',async()=>{
 const {shown,fire}=load();
 await fire('push',{data:{json:()=>({id:'n1',type:'meal_log',title:'Meal check-in',body:'Log a meal if you like.',url:'/nutrition',extra:'ignored'})}});
 expect(shown[0]).toMatchObject({title:'Meal check-in',options:{body:'Log a meal if you like.',tag:'meal_log',data:{url:'/nutrition',id:'n1'}}});
 await fire('push',{data:{json:()=>{throw Error('not json');}}});
 expect(shown[1].title).toBe('TrackCal');
 await fire('push',{data:{json:()=>({title:'x',url:'//evil.example/phish'})}});
 expect(shown[2].options.data).toMatchObject({url:'/'});
});
it('a click focuses TrackCal, opens the link and records the open',async()=>{
 const {client,fetcher,fire}=load();const close=vi.fn();
 await fire('notificationclick',{notification:{close,data:{url:'/plan',id:'0f6a1e9e-1111-4222-8333-444455556666'}}});
 expect(close).toHaveBeenCalled();expect(client.focus).toHaveBeenCalled();expect(client.navigate).toHaveBeenCalledWith('http://localhost/plan');
 expect(fetcher).toHaveBeenCalledWith('/api/push/opened/0f6a1e9e-1111-4222-8333-444455556666',expect.objectContaining({method:'POST'}));
});
it('a click with a foreign link stays inside TrackCal',async()=>{
 const {client,fire}=load();await fire('notificationclick',{notification:{close:vi.fn(),data:{url:'https://evil.example/',id:'x'}}});
 expect(client.navigate).toHaveBeenCalledWith('http://localhost/');
});
it('installing never takes over by itself; only the page can ask for the update',async()=>{
 const {self,fire}=load();await fire('install',{});expect(self.skipWaiting).not.toHaveBeenCalled();
 await fire('message',{data:{type:'SKIP_WAITING'}});expect(self.skipWaiting).toHaveBeenCalledOnce();
});
it('re-subscribes when the browser replaces the subscription and names the old one',async()=>{
 const {fetcher,fire}=load();await fire('pushsubscriptionchange',{oldSubscription:{endpoint:'https://push.example.com/old'}});
 const call=fetcher.mock.calls.find(([url])=>url==='/api/push/subscribe')!;
 expect(JSON.parse(call[1]!.body as string)).toMatchObject({endpoint:'https://push.example.com/new',old_endpoint:'https://push.example.com/old'});
});
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
