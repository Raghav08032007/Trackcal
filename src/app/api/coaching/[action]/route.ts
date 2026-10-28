import { authenticated,forward,json,sameOrigin } from "@/lib/server-account";
type Context={params:Promise<{action:string}>};
export async function GET(request:Request,context:Context){const {action}=await context.params;if(!["coaches","slots","bookings"].includes(action))return json({error:"Not found"},404);try{const coach=new URL(request.url).searchParams.get("coach_id");return await forward(await authenticated(`/coaching/${action}${action==="slots"&&coach?`?coach_id=${encodeURIComponent(coach)}`:""}`));}catch{return json({error:"Scheduling service is unavailable. Please try again."},503);}}
export async function POST(request:Request,context:Context){
  if(!sameOrigin(request))return json({error:"Request origin is not allowed."},403);
  const {action}=await context.params;
  try{const raw=await request.text();if(raw.length>4000)return json({error:"Request is too large"},413);let data;try{data=JSON.parse(raw);}catch{return json({error:"Invalid request"},400);}if(!data||typeof data!=="object"||Array.isArray(data))return json({error:"Invalid request"},400);
    if(action==="publish")return await forward(await authenticated("/coaching/slots",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({starts_at:data.starts_at,minutes:data.minutes})}));
    if(action==="reserve")return await forward(await authenticated("/coaching/bookings",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({slot_id:data.slot_id})}));
    if(!["cancel","move","unpublish"].includes(action))return json({error:"Not found"},404);
    if(typeof data.id!=="string"||!/^[-a-fA-F0-9]{36}$/.test(data.id))return json({error:"Invalid appointment identifier"},400);
    return await forward(await authenticated(`/coaching/${action==="unpublish"?"slots":"bookings"}/${data.id}`,{method:action==="move"?"PATCH":"DELETE",...(action==="move"?{headers:{"Content-Type":"application/json"},body:JSON.stringify({slot_id:data.slot_id})}:{})}));
  }catch{return json({error:"Scheduling service is unavailable. Please try again."},503);}
}
