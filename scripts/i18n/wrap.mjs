// Wraps a screen's English texts in t() using the TypeScript compiler, so 1,750 texts don't have to be wrapped by hand.
//   node scripts/i18n/wrap.mjs src/components/auth-form.tsx [more files]      (add --dry to only list)
// Wraps: text between JSX tags; aria-label, placeholder, title, alt, label attributes; string messages passed to setError,
// setNotice, setStatus, setMessage, companion, say and new Error(...), and "..." fallbacks after || in those calls.
// Leaves alone: code-like text, numbers and symbols, text already in t()/msg(). Prints what it could not wrap (template
// literals with ${...}) so those are done by hand.
import fs from "node:fs";
import ts from "typescript";

const ATTRS = new Set(["aria-label", "placeholder", "title", "alt", "label"]);
const CALLS = new Set(["setError", "setNotice", "setStatus", "setMessage", "companion", "say", "setFormTip", "Error", "setNote", "setInfo", "setWarning", "setHint"]);
// Human text, not code: has a word, and isn't a brand, a file name, a path, an email, a key such as "password" or "new-password",
// a camelCase name or a format placeholder such as TC-XXXX-XXXX.
const words = s => { const x = s.trim(); return /[A-Za-z]{2,}/.test(x) && !/^(trackcal\.?|TrackCal)$/i.test(x) && !/^[\w.-]+\.(tsx?|css|png|webp|svg|json)$/.test(x)
  && !/^[a-z][a-z0-9_-]*$/.test(x) && !/^[a-z]+[A-Z]\w*$/.test(x) && !x.startsWith("/") && !/^\S+@\S+$/.test(x) && !/^[A-Z0-9]+(-[A-Z0-9X]+)+$/.test(x); };
const decode = s => s.replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ");
const q = s => JSON.stringify(s);

// Every English string a value can end up as: through ?: branches, || fallbacks and && results, however deeply chained.
// Template literals are included; templateToT() turns the simple ones into t("… {name} …", { name: … }).
function stringsIn(e, out = []) {
  if (!e) return out;
  if (ts.isParenthesizedExpression(e)) return stringsIn(e.expression, out);
  if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e) || ts.isTemplateExpression(e)) out.push(e);
  else if (ts.isConditionalExpression(e)) { stringsIn(e.whenTrue, out); stringsIn(e.whenFalse, out); }
  else if (ts.isBinaryExpression(e) && (e.operatorToken.kind === ts.SyntaxKind.BarBarToken || e.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken || e.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken)) stringsIn(e.right, out);
  return out;
}

// `Logged ${food.name} for ${journalDate}` → t("Logged {name} for {journalDate}", { name: food.name, journalDate }).
// Returns null when a ${…} holds English itself (such as ${n === 1 ? 'meal' : 'meals'}): those need a plural by hand.
function templateToT(tpl, sf) {
  if (ts.isNoSubstitutionTemplateLiteral(tpl)) return `t(${q(tpl.text)})`;
  let key = tpl.head.text; const vars = [], used = new Set();
  for (const span of tpl.templateSpans) {
    const e = span.expression, code = e.getText(sf);
    if (/["'`][^"'`]*[A-Za-z]{2,}[^"'`]*["'`]/.test(code)) return null;
    let name = ts.isIdentifier(e) ? e.text : ts.isPropertyAccessExpression(e) ? e.name.text : "n";
    if (used.has(name)) { let i = 2; while (used.has(name + i)) i++; name += i; }
    used.add(name);
    vars.push(name === code ? name : `${name}: ${code}`);
    key += `{${name}}` + span.literal.text;
  }
  return `t(${q(key)}, { ${vars.join(", ")} })`;
}
const textOf = node => ts.isTemplateExpression(node) ? node.head.text + node.templateSpans.map(s => " " + s.literal.text).join("") : node.text;

function wrapFile(file, dry) {
  const src = fs.readFileSync(file, "utf8");
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const edits = [], manual = [];
  const insideT = node => { for (let p = node.parent; p; p = p.parent) if (ts.isCallExpression(p) && ts.isIdentifier(p.expression) && (p.expression.text === "t" || p.expression.text === "msg")) return true; return false; };
  const done = new Set();
  function wrapString(str) {
    if (done.has(str.getStart(sf)) || insideT(str) || !words(textOf(str))) return;
    done.add(str.getStart(sf));
    const out = ts.isStringLiteral(str) ? `t(${q(str.text)})` : templateToT(str, sf);
    if (out) edits.push([str.getStart(sf), str.getEnd(), out]);
    else manual.push(`${file}:${sf.getLineAndCharacterOfPosition(str.getStart(sf)).line + 1} ${str.getText(sf).slice(0, 110)}`);
  }
  const calleeName = call => ts.isIdentifier(call.expression) ? call.expression.text : ts.isPropertyAccessExpression(call.expression) ? call.expression.name.text : "";
  function visit(node) {
    if (ts.isJsxText(node)) {
      const raw = node.getText(sf), text = decode(raw).replace(/\s+/g, " ").trim();
      if (text && words(text) && !insideT(node)) {
        const lead = raw.match(/^\s*/)[0], trail = raw.match(/\s*$/)[0];
        const keepLead = lead && !lead.includes("\n") ? "{\" \"}" : "", keepTrail = trail && !trail.includes("\n") ? "{\" \"}" : "";
        edits.push([node.getStart(sf), node.getEnd(), `${keepLead}{t(${q(text)})}${keepTrail}`]);
      }
    } else if (ts.isJsxAttribute(node) && node.initializer && ts.isStringLiteral(node.initializer) && ATTRS.has(node.name.getText(sf))) {
      const text = node.initializer.text;
      if (words(text)) edits.push([node.initializer.getStart(sf), node.initializer.getEnd(), `{t(${q(text)})}`]);
    } else if ((ts.isCallExpression(node) || ts.isNewExpression(node)) && CALLS.has(calleeName(node)) && node.arguments) {
      for (const arg of node.arguments) for (const str of stringsIn(arg)) wrapString(str);
    } else if (ts.isJsxExpression(node) && node.expression && !insideT(node) && (!ts.isJsxAttribute(node.parent) || ATTRS.has(node.parent.name.getText(sf)))) {
      // {"text"}, {`text ${x}`}, {cond ? "a" : "b"} and {cond && "text"} inside JSX, however deeply chained: wrap each English branch.
      for (const str of stringsIn(node.expression)) wrapString(str);
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);
  let out = src;
  for (const [a, b, text] of edits.sort((x, y) => y[0] - x[0])) out = out.slice(0, a) + text + out.slice(b);
  if (edits.length && !/from "@\/lib\/i18n"/.test(out)) {
    const at = out.search(/^import .*$/m);
    out = at >= 0 ? out.slice(0, at) + 'import { t } from "@/lib/i18n";\n' + out.slice(at) : 'import { t } from "@/lib/i18n";\n' + out;
  } else if (edits.length && !/\bt\b[^"]*from "@\/lib\/i18n"/.test(out.match(/^import .*from "@\/lib\/i18n";$/m)?.[0] ?? "")) {
    out = out.replace(/^import \{([^}]*)\} from "@\/lib\/i18n";$/m, (all, names) => `import {${names.trim() ? " t, " + names.trim() + " " : " t "}} from "@/lib/i18n";`);
  }
  if (!dry && out !== src) fs.writeFileSync(file, out);
  return { file, wrapped: edits.length, manual };
}

const args = process.argv.slice(2), dry = args.includes("--dry");
for (const f of args.filter(a => a !== "--dry")) {
  const r = wrapFile(f, dry);
  console.log(`${r.file}: ${r.wrapped} wrapped${r.manual.length ? `, ${r.manual.length} by hand:` : ""}`);
  r.manual.forEach(m => console.log("   " + m));
}
