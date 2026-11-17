// Lists English-looking strings that wrap.mjs left alone (list data, labels kept in variables, texts built in code), so a
// screen can be finished by hand. Review aid only: some hits are code (ids, CSS), which is fine to leave.
//   node scripts/i18n/leftover.mjs src/components/food-workspace.tsx [more files]
import fs from "node:fs";
import ts from "typescript";

const CODE_ATTRS = new Set(["className", "key", "href", "type", "name", "id", "autoComplete", "accept", "capture", "inputMode", "role", "src", "rel", "target", "method", "pattern", "htmlFor", "lang", "dir", "mode", "variant"]);
// Human text: two words, or one capitalised word; not a run of lowercase CSS-like tokens (text-lg font-bold mt-0.5).
const cssLike = x => /^[a-z0-9:/_[\].%#!-]+(\s+[a-z0-9:/_[\].%#!-]+)*$/.test(x);
const human = s => { const x = s.trim(); return (/[A-Za-z]{2,}\s+[A-Za-z]{2,}/.test(x) || /^[A-Z][a-z]{2,}/.test(x)) && !cssLike(x); };

for (const file of process.argv.slice(2)) {
  const src = fs.readFileSync(file, "utf8"), sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const hits = [];
  const skip = node => { for (let p = node.parent; p; p = p.parent) {
    if (ts.isCallExpression(p) && ts.isIdentifier(p.expression) && ["t", "msg", "wellnessRequest", "personalRequest", "fetch", "matchMedia", "querySelector", "addEventListener", "useLocalState", "includes", "startsWith", "endsWith", "split", "replace", "getItem", "setItem"].includes(p.expression.text)) return true;
    if (ts.isCallExpression(p) && ts.isPropertyAccessExpression(p.expression) && ["includes", "startsWith", "endsWith", "split", "replace", "getItem", "setItem", "removeItem", "querySelector", "addEventListener", "toLocaleDateString", "toLocaleString"].includes(p.expression.name.text)) return true;
    if (ts.isImportDeclaration(p) || ts.isExportDeclaration(p)) return true;
    if (ts.isJsxAttribute(p) && CODE_ATTRS.has(p.name.getText(sf))) return true;
    if (ts.isBinaryExpression(p) && [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken].includes(p.operatorToken.kind)) return true;
    if (ts.isCaseClause(p) || ts.isElementAccessExpression(p) && p.argumentExpression === node) return true;
  } return false; };
  const visit = node => {
    if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && !ts.isPropertyAssignment(node.parent) || ts.isStringLiteral(node) && ts.isPropertyAssignment(node.parent) && node.parent.initializer === node) {
      if (human(node.text) && !skip(node)) hits.push(node);
    } else if (ts.isTemplateExpression(node)) {
      const text = node.head.text + node.templateSpans.map(s => " " + s.literal.text).join("");
      if (human(text) && !skip(node)) hits.push(node);
    } else if (ts.isJsxText(node) && /[A-Za-z]{3,}/.test(node.text) && !skip(node)) hits.push(node);
    ts.forEachChild(node, visit);
  };
  visit(sf);
  console.log(`${file}: ${hits.length}`);
  for (const h of hits) console.log(`   ${sf.getLineAndCharacterOfPosition(h.getStart(sf)).line + 1}  ${h.getText(sf).replace(/\s+/g, " ").slice(0, 120)}`);
}
