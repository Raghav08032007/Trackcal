// Explicit opt-in: sends only synthetic fixture data through the local AI route.
import assert from "node:assert/strict";
import sharp from "sharp";
import { randomUUID } from "node:crypto";
const base = process.env.TRACKCAL_TEST_URL || "http://127.0.0.1:3002";
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base)) throw new Error("Loopback only");
const jar = new Map(); let cleanupToken;
function remember(response) { for (const cookie of response.headers.getSetCookie()) { const [name,value]=cookie.split(';')[0].split('='); if(value)jar.set(name,value);else jar.delete(name); } }
const cookieHeader=()=>[...jar].map(([k,v])=>`${k}=${v}`).join('; ');
async function post(body, origin) {
  return fetch(`${base}/api/analyze`, { method: "POST", headers: { "Content-Type": "application/json", Cookie:cookieHeader(), ...(origin ? { Origin: origin } : {}) }, body: JSON.stringify(body), signal:AbortSignal.timeout(90000) });
}
try {
assert.equal((await post({})).status, 400);
assert.equal((await post({ image: "data:text/html;base64,aGVsbG8=" })).status, 400);
assert.equal((await post({ text: "Egg" }, "https://example.invalid")).status, 403);
console.log("Request validation and cross-origin rejection: passed");
if (process.env.RUN_LIVE_AI === "true") {
  const signupResponse=await fetch(base+'/api/account/signup',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({email:`qa-ai-${randomUUID()}@tests.example.com`,password:'Synthetic-ai-test-123!',display_name:'Disposable AI test'}),signal:AbortSignal.timeout(20000)});
  remember(signupResponse); cleanupToken=jar.get('trackcal_access'); assert.equal(signupResponse.status,200); assert.ok(cleanupToken);
  assert.equal((await fetch(base+'/api/analyze',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({text:'One egg'})})).status,401,'Anonymous AI must remain blocked');
  const textResponse = await post({ text: "Two boiled eggs and one slice of whole wheat toast" });
  const textData = await textResponse.json();
  assert.equal(textResponse.status, 200, JSON.stringify(textData));
  assert.equal(textData.is_mock, false);
  assert.ok(textData.total_nutrition.calories > 0);
  console.log("Live text test: passed", JSON.stringify({ model: textData.model, nutrition: textData.total_nutrition }));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="100%" height="100%" fill="white"/><g fill="black" font-family="Arial" font-size="38"><text x="40" y="70">NUTRITION FACTS — TEST PRODUCT</text><text x="40" y="150">Serving size: 100 g</text><text x="40" y="230">Calories: 200 kcal</text><text x="40" y="310">Total Fat: 8 g</text><text x="40" y="390">Total Carbohydrate: 20 g</text><text x="40" y="470">Protein: 12 g</text></g></svg>`;
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  const response = await post({ text: "Read this synthetic nutrition label. Use one 100g serving.", image: `data:image/png;base64,${png.toString("base64")}` });
  const data = await response.json();
  assert.equal(response.status, 200, JSON.stringify(data));
  assert.equal(data.is_mock, false);
  assert.ok(data.components.length > 0);
  assert.equal(data.total_nutrition.calories, 200);
  assert.equal(data.total_nutrition.protein_g, 12);
  assert.equal(data.total_nutrition.carbs_g, 20);
  assert.equal(data.total_nutrition.fat_g, 8);
  console.log("Live vision label test: passed", JSON.stringify({ model: data.model, nutrition: data.total_nutrition }));
}
if (process.env.RUN_LIVE_BARCODE === "true") {
  const response = await fetch(`${base}/api/barcode?code=3017620422003`);
  const data = await response.json();
  assert.equal(response.status, 200, JSON.stringify(data));
  assert.equal(data.source, "Open Food Facts");
  assert.ok(data.nutrients_per_100g.energy_kcal > 0);
  console.log("Live Open Food Facts lookup: passed", data.product_name);
}

} finally {
  if(cleanupToken){const response=await fetch('http://127.0.0.1:8000/api/v1/users/account',{method:'DELETE',headers:{Authorization:`Bearer ${cleanupToken}`},signal:AbortSignal.timeout(20000)});assert.ok(response.ok,'Disposable AI account cleanup failed');console.log('Disposable AI account deactivated');}
}

