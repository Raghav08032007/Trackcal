// Opt-in real public recipe extraction and private-household access controls.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
if(process.env.RUN_LIVE_RECIPE!=='true')throw new Error('Set RUN_LIVE_RECIPE=true');
const base='http://127.0.0.1:3002';const jar=new Map();let cleanupToken;
async function call(path,body){
 const response=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{Origin:base,Cookie:[...jar].map(([k,v])=>`${k}=${v}`).join('; '),...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(45000)});
 for(const cookie of response.headers.getSetCookie()){const [key,value]=cookie.split(';')[0].split('=');if(value)jar.set(key,value);else jar.delete(key);}
 return {status:response.status,data:await response.json()};
}
try{
 const signup=await call('/api/account/signup',{email:`qa-recipe-${randomUUID()}@tests.example.com`,password:'Synthetic-recipe-test-123!',display_name:'Disposable recipe test'});
 cleanupToken=jar.get('trackcal_access');assert.equal(signup.status,200);assert.ok(cleanupToken);
 for(const service of ['grocy','mealie']){const response=await call(`/api/tools/${service}`);assert.ok([403,503].includes(response.status),`Private ${service} must reject an unbound QA account`);console.log(`PASS ${service} denies unbound account (${response.status}); service connection not certified`);}
 const imported=await call('/api/tools/recipe-import',{url:'https://www.allrecipes.com/recipe/10813/best-chocolate-chip-cookies/'});
 assert.equal(imported.status,200,JSON.stringify(imported.data));assert.ok(imported.data.ingredients?.length);console.log(`PASS public recipe extraction: ${imported.data.ingredients.length} ingredient lines`);
}finally{
 if(cleanupToken){const response=await fetch('http://127.0.0.1:8000/api/v1/users/account',{method:'DELETE',headers:{Authorization:`Bearer ${cleanupToken}`},signal:AbortSignal.timeout(20000)});assert.ok(response.ok,'Disposable recipe account cleanup failed');console.log('Disposable recipe account deactivated');}
}
