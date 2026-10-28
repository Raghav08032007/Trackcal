import {it,expect,vi,beforeEach} from 'vitest';
const mocks=vi.hoisted(()=>({auth:vi.fn(),origin:vi.fn(()=>true)}));
vi.mock('../src/lib/server-account',()=>({authenticated:mocks.auth,sameOrigin:mocks.origin,json:(data:unknown,status=200)=>Response.json(data,{status}),forward:async(response:Response)=>Response.json(await response.json(),{status:response.status})}));
import {GET,POST,DELETE} from '../src/app/api/personalization/[...path]/route';
beforeEach(()=>{mocks.auth.mockReset().mockResolvedValue(Response.json({status:'ok'}));mocks.origin.mockReturnValue(true);});
const context=(path:string[])=>({params:Promise.resolve({path})});
it('uses the authenticated backend proxy and allowlisted routes',async()=>{
 const response=await GET(new Request('http://localhost/api/personalization/state'),context(['state']));expect(response.status).toBe(200);expect(mocks.auth.mock.calls[0][0]).toBe('/personalization/state');
 expect((await GET(new Request('http://localhost'),context(['users','other']))).status).toBe(404);
});
it('rejects foreign-origin writes and invalid IDs without contacting the API',async()=>{
 mocks.origin.mockReturnValue(false);expect((await POST(new Request('http://localhost',{method:'POST',body:'{}'}),context(['onboarding']))).status).toBe(403);
 expect((await DELETE(new Request('http://localhost',{method:'DELETE'}),context(['measurements','invalid']))).status).toBe(404);expect(mocks.auth).not.toHaveBeenCalled();
});
it('rejects malformed and oversized input while preserving authentication errors',async()=>{
 expect((await POST(new Request('http://localhost',{method:'POST',body:'[]'}),context(['onboarding']))).status).toBe(400);
 expect((await POST(new Request('http://localhost',{method:'POST',body:'x'.repeat(17000)}),context(['onboarding']))).status).toBe(413);
 mocks.auth.mockResolvedValue(Response.json({error:'Sign in'},{status:401}));expect((await GET(new Request('http://localhost'),context(['state']))).status).toBe(401);
});
