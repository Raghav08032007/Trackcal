import {authenticated,forward,json,sameOrigin} from "@/lib/server-account";
type Context={params:Promise<{path:string[]}>};
async function handle(request:Request,context:Context){
 const {path}=await context.params;const [resource,id]=path;
 if(path.length>2||!['state','onboarding','measurements','plans','activities','education','reminders'].includes(resource)||id&&!/^[0-9a-f-]{36}$/i.test(id))return json({error:'Not found'},404);
 const method=request.method;
 const allowed=method==='GET'?['state','reminders'].includes(resource)&&!id:method==='DELETE'?resource==='measurements'&&!!id:method==='POST'&&(['onboarding','education','measurements','plans'].includes(resource)&&(!id||resource==='plans')||['activities','reminders'].includes(resource)&&!!id);
 if(!allowed)return json({error:'Not found'},404);
 if(method!=='GET'&&!sameOrigin(request))return json({error:'Origin rejected'},403);
 try{
  let body: string|undefined;
  if(method==='POST'){body=await request.text();if(body.length>16000)return json({error:'Request too large'},413);try{const data=JSON.parse(body);if(!data||Array.isArray(data)||typeof data!=='object')throw new Error();}catch{return json({error:'Invalid input'},400);}}
  return await forward(await authenticated('/personalization/'+path.join('/'),{method,...(body?{headers:{'Content-Type':'application/json'},body}:{})},20000));
 }catch{return json({error:'Personalization service unavailable. Your draft remains on screen; retry when connected.'},503);}
}
export const GET=handle,POST=handle,DELETE=handle;
