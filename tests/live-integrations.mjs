// Local-only opt-in smoke test, real services and libraries. Synthetic account is deactivated in finally.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
if (process.env.RUN_LIVE_INTEGRATIONS !== 'true') throw new Error('Set RUN_LIVE_INTEGRATIONS=true');
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3002';
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base)) throw new Error('Loopback only');
const jar = new Map();
async function call(path, body) {
  const response = await fetch(base + path, { method: body === undefined ? 'GET' : 'POST', headers: { Origin: base, Cookie: [...jar].map(([k,v]) => `${k}=${v}`).join('; '), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(110000) });
  for (const cookie of response.headers.getSetCookie()) { const [name,value] = cookie.split(';')[0].split('='); if (value) jar.set(name,value); else jar.delete(name); }
  return { status: response.status, data: await response.json() };
}
let cleanupToken;
try {
  const signup = await call('/api/account/signup', { email: `qa-tools-${randomUUID()}@tests.example.com`, password: 'Tools-smoke-123!', display_name: 'Integration smoke test' }); assert.equal(signup.status,200,JSON.stringify(signup.data)); cleanupToken = jar.get('trackcal_access');
  const owner = (await call('/api/account/session')).data.id;
  const parsed = await call('/api/tools/ingredients',{ lines:['200 g rice','1 cup vegetables'] }); assert.equal(parsed.status,200,JSON.stringify(parsed.data)); assert.equal(parsed.data.ingredients[0].grams,200); assert.equal(parsed.data.ingredients[1].grams,null); console.log('PASS real ingredient parser through web proxy');
  const foods = ['a','b','c'].map(id=>({ id,name:`Recipe ${id}`,calories:600,protein:30,carbs:50,fat:10,cost:50,minutes:20,tags:[] }));
  const plan = await call('/api/tools/plan',{ foods,slots:3,calories_min:1600,calories_max:2000,protein_min:60,budget:200 }); assert.equal(plan.status,200,JSON.stringify(plan.data)); assert.equal(plan.data.totals.calories,1800); assert.equal(plan.data.totals.cost,150); console.log('PASS real OR-Tools optimizer through web proxy');
  const list = await call('/api/tools/shopping',{ ingredients:[{name:'Rice',grams:200}],pantry:[{name:'rice',grams:50,expires:null}],today:'2026-10-21' }); assert.equal(list.data.items[0].buy_g,150); console.log('PASS pantry-aware shopping');
  const baseline = await call('/api/account/backup'); assert.equal((await call('/api/account/backup',{ entries:{'trackcal:studio:pantry':[]},expected_revision:baseline.data.revision,owner_id:owner })).status,200); assert.equal((await call('/api/account/backup',{ entries:{},expected_revision:baseline.data.revision,owner_id:owner })).status,409); console.log('PASS cloud conflict protection');
  const audio = await readFile(new URL('../../../backend/tests/fixtures/meal-voice.wav',import.meta.url));
  const voice = await call('/api/tools/transcribe',{data:audio.toString('base64')}); assert.equal(voice.status,200,JSON.stringify(voice.data)); assert.match(voice.data.text.toLowerCase(),/egg/); console.log('PASS real whisper.cpp meal transcription');
  const image = await readFile(new URL('../../../backend/tests/fixtures/nutrition-label.png',import.meta.url));
  const label = await call('/api/tools/label',{data:image.toString('base64')}); assert.equal(label.status,200,JSON.stringify(label.data)); assert.deepEqual(label.data.values,{calories:200,protein:12,carbs:20,fat:8}); console.log('PASS real PaddleOCR label recognition');
  if (process.env.TEST_PUBLIC_APIS === 'true') {
    const prices=await call('/api/tools/prices?code=3017620422003&currency=EUR'); assert.equal(prices.status,200,JSON.stringify(prices.data)); assert.ok(prices.data.observations.length); console.log(`PASS Open Prices: ${prices.data.observations.length} observations`);
    const workouts=await call('/api/tools/exercises?query=squat'); assert.equal(workouts.status,200,JSON.stringify(workouts.data)); assert.ok(workouts.data.exercises.length); assert.equal(typeof workouts.data.exercises[0].license,'string'); console.log(`PASS wger: ${workouts.data.exercises.length} matching exercises`);
  }
  const status = await call('/api/tools/status'); assert.equal(status.status,200); assert.equal(status.data.integrations.length,10); console.log('PASS integration status');
} finally {
  if (cleanupToken) { const result = await fetch('http://127.0.0.1:8000/api/v1/users/account',{ method:'DELETE',headers:{Authorization:`Bearer ${cleanupToken}`} }); assert.ok(result.ok,'Synthetic account cleanup failed'); }
}
