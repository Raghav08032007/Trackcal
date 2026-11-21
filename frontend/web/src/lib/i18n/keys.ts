// Which English texts a source file shows, for translation coverage (tests/i18n.test.ts and scripts/i18n-keys.mjs).
// Literal t("...") calls, plus texts that reach t() through variables: the section structure (titles, texts, labels, page names)
// and the hub pages' intros.
export function keysOf(path: string, source: string): string[] {
  const keys = new Set<string>();
  const add = (raw: string) => keys.add(JSON.parse(`"${raw}"`) as string);
  for (const m of source.matchAll(/\b(?:t|msg)\(\s*"((?:[^"\\]|\\.)*)"/g)) add(m[1]);
  for (const m of source.matchAll(/\b(?:t|msg)\(\s*'((?:[^'\\]|\\.)*)'/g)) keys.add(m[1].replace(/\\'/g, "'"));   // t('…') too
  if (/sections\.ts$/.test(path)) {
    for (const m of source.matchAll(/\b(?:title|text|label): "((?:[^"\\]|\\.)*)"/g)) add(m[1]);
    for (const m of source.matchAll(/\["\/[^"]*", "((?:[^"\\]|\\.)*)"\]/g)) add(m[1]);
    for (const m of source.matchAll(/"\/[^"]*": "((?:[^"\\]|\\.)*)"/g)) add(m[1]);
  }
  for (const m of source.matchAll(/<SectionHub [^>]*intro="([^"]+)"/g)) keys.add(m[1]);
  return [...keys];
}
