import {authenticated,forward,json,sameOrigin} from '@/lib/server-account';
type Context={params:Promise<{path:string[]}>};
async function handle(request:Request,context:Context){
 const {path}=await context.params;const [resource,id]=path;
 const resources=['foods','diary','saved-meals','favorites','exercises','templates','sessions','training'];
 if(path.length>2||!resources.includes(resource)||id&&!/^[a-zA-Z0-9_-]{1,100}$/.test(id))return json({error:'Not found'},404);
 const method=request.method;const allowed=method==='GET'?['foods','diary','exercises','sessions','training'].includes(resource):method==='POST'?['diary','saved-meals','favorites','templates','sessions'].includes(resource)&&!id:method==='PUT'?['diary','sessions'].includes(resource)&&!!id:method==='DELETE'?['diary','saved-meals','favorites','templates','sessions'].includes(resource)&&!!id:false;
 if(!allowed)return json({error:'Not found'},404);
 if(method!=='GET'&&!sameOrigin(request))return json({error:'Origin rejected'},403);
 try{let body:string|undefined;if(['POST','PUT'].includes(method)){body=await request.text();if(body.length>64000)return json({error:'Request too large'},413);try{const data=JSON.parse(body);if(!data||typeof data!=='object'||Array.isArray(data))throw new Error();}catch{return json({error:'Invalid JSON'},400);}}
 const search=new URLSearchParams();const incoming=new URL(request.url).searchParams;for(const key of ['q','category','equipment','offset','limit','day'])if(incoming.has(key))search.set(key,incoming.get(key)!);
 return await forward(await authenticated('/wellness/'+path.join('/')+(search.size?'?'+search:''),{method,...(body?{headers:{'Content-Type':'application/json'},body}:{})},20000));
 }catch{return json({error:'Your saved records are safe. The service is unavailable; keep this draft open and retry.'},503);}
}
export const GET=handle,POST=handle,PUT=handle,DELETE=handle;
