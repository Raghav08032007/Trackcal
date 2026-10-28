// @vitest-environment node
import { beforeEach, it, expect, vi } from "vitest";
const jar=vi.hoisted(()=>({get:vi.fn(()=>({value:"test-session"})),set:vi.fn(),delete:vi.fn()}));
vi.mock("next/headers",()=>({cookies:async()=>jar}));
import { POST } from "../src/app/api/analyze/route";
import { sameOrigin } from "../src/lib/server-account";
beforeEach(()=>{vi.stubEnv("NODE_ENV","production");vi.stubEnv("ENABLE_AUTHENTICATED_AI","true");vi.stubEnv("ENABLE_LOCAL_AI","false");vi.stubEnv("OPENROUTER_API_KEY","test-key");vi.stubEnv("PUBLIC_APP_URL","https://trackcal.example");});
const request=()=>new Request("http://web:3000/api/analyze",{method:"POST",headers:{Origin:"https://trackcal.example","Content-Type":"application/json"},body:JSON.stringify({text:"one egg"})});
it("accepts the configured HTTPS origin behind a private HTTP proxy and rejects other origins",()=>{
  expect(sameOrigin(request())).toBe(true);expect(sameOrigin(new Request("http://web:3000/api/analyze",{headers:{Origin:"https://attacker.example"}}))).toBe(false);
});
it("never calls the AI provider when the verified-account quota is denied",async()=>{
  const fetcher=vi.fn().mockResolvedValue(Response.json({detail:"Verify your email"},{status:403}));vi.stubGlobal("fetch",fetcher);
  const response=await POST(request());expect(response.status).toBe(403);expect(fetcher).toHaveBeenCalledTimes(1);expect(fetcher.mock.calls[0][0]).toContain("/auth/consume-ai");
});
