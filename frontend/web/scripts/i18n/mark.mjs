// Marks the human texts inside named data tables with msg(), so they can be translated where they are shown.
//   node scripts/i18n/mark.mjs src/lib/pose/types.ts EXERCISES EXERCISE_GROUPS ...   (add --dry to list only, --all for the whole file)
// Inside each `const NAME = …` initializer: quoted strings with a space or a capital first letter become msg("…"). Values of
// code keys (id, template, view, equipment, group, …) and object keys are left alone. Adds `import { msg }` when needed.
import fs from "node:fs";
import ts from "typescript";

const CODE_KEYS = new Set(["id", "template", "view", "equipment", "group", "difficulty", "kind", "gear", "style", "plane", "icon", "href", "key", "type", "unit", "mode", "side", "base", "sport", "metric", "color", "tone"]);
const human = s => /[A-Za-z]{2,}/.test(s) && !/^[A-Z0-9_]+$/.test(s) && (/\s/.test(s) || /^[A-Z]/.test(s)) && !/^[a-z0-9_-]+(\.[a-z]+)?$/.test(s) && !s.startsWith("/");

const args = process.argv.slice(2), dry = args.includes("--dry"), all = args.includes("--all"), [file, ...names] = args.filter(a => !a.startsWith("--"));
const src = fs.readFileSync(file, "utf8"), sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const edits = [];
const insideMsg = n => { for (let p = n.parent; p; p = p.parent) if (ts.isCallExpression(p) && ts.isIdentifier(p.expression) && (p.expression.text === "msg" || p.expression.text === "t")) return true; return false; };
function mark(node) {
  if (ts.isTypeNode(node) || ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return;   // 'a'|'b' types and module paths stay
  if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && human(node.text) && !insideMsg(node)) {
    const parent = node.parent;
    const isKey = ts.isPropertyAssignment(parent) && parent.name === node;
    const codeValue = ts.isPropertyAssignment(parent) && parent.initializer === node && CODE_KEYS.has(parent.name.getText(sf).replace(/['"]/g, ""));
    if (!isKey && !codeValue && !(ts.isBinaryExpression(parent) && [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken].includes(parent.operatorToken.kind)))
      edits.push([node.getStart(sf), node.getEnd(), `msg(${JSON.stringify(node.text)})`]);
  }
  ts.forEachChild(node, mark);
}
function visit(node) {
  if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return;
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && names.includes(node.name.text) && node.initializer) { mark(node.initializer); return; }
  ts.forEachChild(node, visit);
}
if (all) mark(sf); else visit(sf);   // --all: every human text in the file (messages that reach the screen through state)
let out = src;
for (const [a, b, text] of edits.sort((x, y) => y[0] - x[0])) out = out.slice(0, a) + text + out.slice(b);
if (edits.length && !/import \{[^}]*\bmsg\b[^}]*\} from ["'](@\/lib\/i18n|\.\.?\/(\.\.\/)*i18n)["']/.test(out)) {
  const depth = file.replace(/^src\/lib\//, "").split("/").length - 1, spec = depth ? "../".repeat(depth) + "i18n" : "./i18n";
  out = `import { msg } from "${file.startsWith("src/lib/") ? spec : "@/lib/i18n"}";\n` + out;
}
if (!dry) fs.writeFileSync(file, out);
console.log(`${file}: ${edits.length} marked`);
if (dry) for (const [a, b] of edits.slice(0, 40)) console.log("   " + src.slice(a, b).slice(0, 100));
