import {it,expect,vi,beforeEach} from 'vitest';
const mocks=vi.hoisted(()=>({auth:vi.fn(),origin:vi.fn(()=>true)}));
vi.mock('../src/lib/server-account',()=>({authenticated:mocks.auth,sameOrigin:mocks.origin,json:(v:unknown,s=200)=>Response.json(v,{status:s}),forward:async(r:Response)=>Response.json(await r.json(),{status:r.status})}));
import {GET,POST,PUT} from '../src/app/api/wellness/[...path]/route';
const context=(path:string[])=>({params:Promise.resolve({path})});
beforeEach(()=>{mocks.auth.mockReset().mockResolvedValue(Response.json({ok:true}));mocks.origin.mockReturnValue(true);});
it('preserves pagination filters and authenticates food/diary access',async()=>{expect((await GET(new Request('http://localhost/api/wellness/foods?q=dosa&offset=12'),context(['foods']))).status).toBe(200);expect(mocks.auth.mock.calls[0][0]).toBe('/wellness/foods?q=dosa&offset=12');});
it('rejects foreign origins, malformed bodies and unsupported resources',async()=>{mocks.origin.mockReturnValue(false);expect((await POST(new Request('http://localhost',{method:'POST',body:'{}'}),context(['diary']))).status).toBe(403);expect((await GET(new Request('http://localhost'),context(['users','private']))).status).toBe(404);expect(mocks.auth).not.toHaveBeenCalled();});
it('forwards supported workout updates without exposing an arbitrary upstream path',async()=>{const response=await PUT(new Request('http://localhost',{method:'PUT',body:'{}'}),context(['sessions','abc-123']));expect(response.status).toBe(200);expect(mocks.auth.mock.calls[0][0]).toBe('/wellness/sessions/abc-123');});
