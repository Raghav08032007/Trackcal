/* Public offline journal. Never reads account namespaces or caches private API responses. */
"use strict";
const form = document.querySelector("#meal"), status = document.querySelector("#status"), list = document.querySelector("#entries");
const dateField = form.elements.namedItem("date");
const now = new Date(); dateField.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
const key = () => `trackcal:journal:${dateField.value}`;
function read() { const raw = localStorage.getItem(key()); const entries = raw ? JSON.parse(raw) : []; if (!Array.isArray(entries) || entries.some(entry => !entry || typeof entry.name !== "string" || ["calories","protein","carbs","fat"].some(field => typeof entry[field] !== "number" || !Number.isFinite(entry[field]) || entry[field] < 0))) throw new Error("Existing journal data needs recovery. Reconnect and export it before adding meals."); return entries; }
function render() { list.replaceChildren(); try { for (const meal of read()) { const item = document.createElement("li"); item.textContent = `${meal.name} · ${meal.calories} kcal · ${meal.protein}g protein`; list.append(item); } } catch (error) { status.textContent = error.message; } }
form.addEventListener("submit", event => { event.preventDefault(); try {
  if (!form.reportValidity()) return;
  const values = Object.fromEntries(["calories","protein","carbs","fat"].map(field => [field,Number(form.elements.namedItem(field).value)]));
  const name = form.elements.namedItem("name").value.trim();
  if (!name || Object.values(values).some(value => !Number.isFinite(value) || value < 0 || value > 20000)) throw new Error("Check the meal name and nutrition values.");
  const entries = read(); entries.push({name,...values,time:new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}),method:"Manual offline entry"});
  localStorage.setItem(key(),JSON.stringify(entries)); status.textContent = "Meal saved to your guest journal on this device."; form.elements.namedItem("name").value = ""; render();
} catch (error) { status.textContent = error.message || "Storage is unavailable. Export before closing this page."; } });
dateField.addEventListener("change",render);
document.querySelector("#export").addEventListener("click", () => { try { const entries = {}; for (let i=0;i<localStorage.length;i++) { const name=localStorage.key(i); if (/^trackcal:journal:\d{4}-\d{2}-\d{2}$/.test(name)) entries[name]=JSON.parse(localStorage.getItem(name)); } const url=URL.createObjectURL(new Blob([JSON.stringify({entries},null,2)],{type:"application/json"})); const link=document.createElement("a"); link.href=url; link.download="trackcal-offline-journal.json"; link.click(); setTimeout(()=>URL.revokeObjectURL(url),1000); } catch { status.textContent="Export failed. Keep this page open and reconnect to recover your data."; } });
render();
