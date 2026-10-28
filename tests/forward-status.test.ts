// @vitest-environment node
import {it,expect}from'vitest';
import {forward}from'../src/lib/server-account';
it('preserves Created responses through the authenticated proxy',async()=>{const response=await forward(Response.json({id:'appointment'},{status:201}));expect(response.status).toBe(201);expect(await response.json()).toEqual({id:'appointment'});});
