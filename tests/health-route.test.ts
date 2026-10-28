// @vitest-environment node
import { it, expect, vi } from "vitest";
import { GET } from "../src/app/api/health/route";
it("uses the runtime container API address and returns only public health status",async()=>{
  vi.stubEnv("BACKEND_API_URL","http://api:8000/api/v1");const request=vi.fn().mockResolvedValue(Response.json({status:"ok",environment:"private"}));vi.stubGlobal("fetch",request);
  const response=await GET();expect(request.mock.calls[0][0]).toBe("http://api:8000/api/health");expect(await response.json()).toEqual({status:"ok"});
});
it("fails readiness when the API cannot be reached",async()=>{
  vi.stubGlobal("fetch",vi.fn().mockRejectedValue(new Error("private connection details")));const response=await GET();expect(response.status).toBe(503);expect(await response.text()).not.toContain("private connection details");
});
