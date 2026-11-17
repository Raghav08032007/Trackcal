// Explicit opt-in, local-only account service smoke test. Test account is deactivated in finally.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
if (process.env.RUN_LIVE_ACCOUNTS !== 'true') throw new Error('Set RUN_LIVE_ACCOUNTS=true to test the local account service.');
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3002';
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base)) throw new Error('This test only supports loopback URLs.');
const jar = new Map();
async function call(action, body) {
  const result = await fetch(`${base}/api/account/${action}`, { method: body === undefined ? 'GET' : 'POST', headers: { Cookie: [...jar].map(([k,v]) => `${k}=${v}`).join('; '), Origin: base, ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  for (const cookie of result.headers.getSetCookie()) { const [name, value] = cookie.split(';')[0].split('='); if (value) jar.set(name, value); else jar.delete(name); }
  return { result, data: await result.json() };
}
const email = `qa-web-${randomUUID()}@tests.example.com`, password = 'Smoke-test-123!';
let cleanupToken;
try {
  const signup = await call('signup', { email, password, display_name: 'Smoke test' }); assert.equal(signup.result.status, 200, JSON.stringify(signup.data));
  cleanupToken = jar.get('trackcal_access');
  assert.ok(signup.result.headers.getSetCookie().every(value => /httponly/i.test(value) && /samesite=lax/i.test(value)));
  assert.equal(JSON.stringify(signup.data).includes('token'), false);
  assert.equal((await call('session')).data.email, email);
  assert.equal((await call('profile', { display_name: 'Verified smoke test' })).result.status, 200);
  assert.equal((await call('session')).data.profile.display_name, 'Verified smoke test');
  const entries = { 'trackcal:journal:2026-10-21': [{ name: 'Egg', time: '12:00', calories: 78, protein: 6, carbs: 1, fat: 5, method: 'Test' }] };
  assert.equal((await call('backup', { entries })).result.status, 200);
  assert.deepEqual((await call('backup')).data.entries, entries);
  await call('logout', {}); assert.equal(jar.size, 0); assert.equal((await call('session')).result.status, 401);
  assert.equal((await call('login', { email, password: 'incorrect' })).result.status, 401);
  assert.equal((await call('login', { email, password })).result.status, 200);
  cleanupToken = jar.get('trackcal_access');
  jar.delete('trackcal_access'); assert.equal((await call('session')).result.status, 200); // Real refresh-cookie path.
  await call('logout', {});
  console.log('PASS: signup, secure cookies, session, profile, backup, logout, invalid login, login and refresh');
} finally {
  if (cleanupToken) { const response = await fetch('http://127.0.0.1:8000/api/v1/users/account', { method: 'DELETE', headers: { Authorization: `Bearer ${cleanupToken}` } }); assert.ok(response.ok, 'Test account cleanup failed'); }
}
