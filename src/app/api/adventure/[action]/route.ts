import { authenticated,forward,json,sameOrigin } from "@/lib/server-account";
type Context={params:Promise<{action:string}>};
export async function GET(_request:Request,context:Context){
  if((await context.params).action!=="summary")return json({error:"Not found"},404);
  try{return await forward(await authenticated('/adventure/summary'));}catch{return json({error:"Your adventure service is unavailable. Saved meals are safe."},503);}
}
export async function POST(request:Request,context:Context){
  if(!sameOrigin(request))return json({error:"Origin rejected."},403);
  const action=(await context.params).action;
  const paths:Record<string,string>={workout:'review-workout',rest:'rest-day',settings:'companion-settings',initialize:'initialize',review:'review-meal',start:'game/start',submit:'game/submit'};
  if(!paths[action])return json({error:"Not found"},404);
  try{
    const raw=await request.text();if(raw.length>12000)return json({error:"Request too large"},413);
    let body;try{body=JSON.parse(raw);}catch{return json({error:"Invalid JSON"},400);}
    if(!body||typeof body!=="object"||Array.isArray(body))return json({error:"Invalid input"},400);
    return await forward(await authenticated(`/adventure/${paths[action]}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}));
  }catch{return json({error:"Could not connect. Refresh before retrying; rewards are awarded only once."},503);}
}
