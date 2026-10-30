// Code health for a checkout (defaults to this repo): size, big files, duplication, complexity, type escapes,
// dependencies (outdated / vulnerable) and test coverage per module. Runs the projects' own test suites.
import {spawnSync} from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {config, ROOT, readJson} from './common.mjs';
const require = createRequire(import.meta.url);

// Only npm needs a shell on Windows (it is npm.cmd); a shell would split paths with spaces for everything else.
const run = (cmd, args, opts = {}) => spawnSync(cmd, args, {encoding: 'utf8', maxBuffer: 1 << 28, shell: process.platform === 'win32' && cmd === 'npm', ...opts});
const SOURCE = /\.(py|ts|tsx|mjs|css)$/;

async function files(repo, sub = '') {
  const r = run('git', ['-C', path.join(repo, sub), 'ls-files']);
  return r.stdout.split('\n').filter(f => SOURCE.test(f) && !/(^|\/)(alembic\/versions|runtime|migrations|node_modules|dist|public\/pose)\//.test(f)).map(f => path.join(repo, sub, f));
}

export async function runCodeHealth({repo = config.repo, label = config.label} = {}) {
  const all = [...await files(repo), ...await files(repo, 'frontend/web')].filter((f, i, a) => a.indexOf(f) === i && !f.includes(path.join('frontend', 'web') + path.sep + 'frontend'));
  const rows = [];
  for (const f of all) { try { const text = await fs.readFile(f, 'utf8'); rows.push({file: path.relative(repo, f).replace(/\\/g, '/'), lines: text.split('\n').length, test: /(^|\/)tests?\//.test(path.relative(repo, f).replace(/\\/g, '/'))}); } catch { /* deleted */ } }
  const app = rows.filter(r => !r.test && !r.file.startsWith('tools/'));
  const size = {appFiles: app.length, appLines: app.reduce((a, r) => a + r.lines, 0), testFiles: rows.filter(r => r.test).length, testLines: rows.filter(r => r.test).reduce((a, r) => a + r.lines, 0),
                over400: app.filter(r => r.lines > 400).sort((a, b) => b.lines - a.lines).map(r => `${r.file} (${r.lines})`)};
  // Duplication (jscpd) over application code only.
  const dupDir = path.join(ROOT, 'tools/bench/.jscpd'); await fs.rm(dupDir, {recursive: true, force: true});
  run(process.execPath, [path.join(path.dirname(require.resolve('jscpd/package.json')), 'run-jscpd.js'), '--min-tokens', '70', '--reporters', 'json', '--output', dupDir, '--ignore', '**/tests/**,**/node_modules/**,**/dist/**,**/alembic/**,**/runtime/**,**/public/**',
       path.join(repo, 'frontend/web/src'), path.join(repo, 'backend/routers'), path.join(repo, 'backend/services'), path.join(repo, 'backend/flask_app')]);
  const dup = await readJson(path.join(dupDir, 'jscpd-report.json'), {statistics: {total: {}}});
  const duplication = {percentage: dup.statistics?.total?.percentage ?? null, clones: dup.statistics?.total?.clones ?? null, duplicatedLines: dup.statistics?.total?.duplicatedLines ?? null};
  // Complexity (lizard): functions with cyclomatic complexity over 15.
  const lz = run(config.python, ['-m', 'lizard', '--csv', '-l', 'python', '-l', 'typescript', '-l', 'tsx', '-x', '*/tests/*', '-x', '*/node_modules/*', '-x', '*/alembic/*', '-x', '*/runtime/*', '-x', '*/dist/*', '-x', '*/public/*',
                 path.join(repo, 'backend/routers'), path.join(repo, 'backend/services'), path.join(repo, 'backend/flask_app'), path.join(repo, 'frontend/web/src')]);
  const fns = lz.stdout.split('\n').filter(Boolean).map(l => l.split(',')).filter(c => c.length > 7).map(c => ({ccn: Number(c[1]), nloc: Number(c[0]), fn: c[7].replace(/"/g, ''), file: path.relative(repo, c[6].replace(/"/g, '')).replace(/\\/g, '/')}));
  const complexity = {functions: fns.length, over15: fns.filter(f => f.ccn > 15).length, hotspots: fns.sort((a, b) => b.ccn - a.ccn).slice(0, 15)};
  // Type escapes in the web app.
  const tsx = rows.filter(r => /^frontend\/web\/src\/.*\.tsx?$/.test(r.file));
  let anyCount = 0, ignores = 0;
  for (const r of tsx) { const t = await fs.readFile(path.join(repo, r.file), 'utf8'); anyCount += (t.match(/:\s*any\b|as any\b|<any>/g) || []).length; ignores += (t.match(/@ts-ignore|@ts-expect-error|@ts-nocheck/g) || []).length; }
  // Dependencies.
  const pkg = await readJson(path.join(repo, 'frontend/web/package.json'), {});
  const outdated = run('npm', ['outdated', '--json'], {cwd: path.join(repo, 'frontend/web')}); const audit = run('npm', ['audit', '--json'], {cwd: path.join(repo, 'frontend/web')});
  const pyOutdated = run(config.python, ['-m', 'pip', 'list', '--outdated', '--format', 'json']);
  const requirements = (await fs.readFile(path.join(repo, 'backend/requirements.txt'), 'utf8')).split('\n').filter(l => /^[A-Za-z0-9_.-]+==/.test(l)).length;
  let npmOutdated = {}, npmVulns = {}, pipOutdated = [];
  try { npmOutdated = JSON.parse(outdated.stdout || '{}'); } catch { /* none */ }
  try { npmVulns = JSON.parse(audit.stdout || '{}').metadata?.vulnerabilities || {}; } catch { /* none */ }
  try { pipOutdated = JSON.parse(pyOutdated.stdout || '[]'); } catch { /* none */ }
  const dependencies = {npmDirect: Object.keys(pkg.dependencies || {}).length, npmDev: Object.keys(pkg.devDependencies || {}).length, npmOutdated: Object.keys(npmOutdated).length, npmVulnerabilities: npmVulns,
                        pythonPinned: requirements, pythonOutdatedInEnv: pipOutdated.length, osv: 'See docs/TEST_REPORT_P6.md for the OSV scan; rerun tools/bench via QUICK to refresh'};
  // Coverage per module: backend (pytest-cov) and web (Vitest + v8).
  const covDir = path.join(ROOT, 'tools/bench/.coverage'); await fs.mkdir(covDir, {recursive: true});
  const py = run(config.python, [path.join(ROOT, 'tools/bench/run_pytest.py'), 'tests', '-q', '-p', 'no:cacheprovider', '--disable-warnings', `--cov=routers`, '--cov=services', '--cov=flask_app', `--cov-report=json:${path.join(covDir, 'backend.json')}`, `--basetemp=${path.join(covDir, 'pyt')}`],
                 {cwd: path.join(repo, 'backend'), env: {...process.env, BENCH_REPO: repo, DB_NAME: config.dbName, COVERAGE_FILE: path.join(covDir, 'backend.cov'), PYTHONWARNINGS: 'ignore'}});
  // pytest prints "3 failed, 611 passed", failed first, and collection problems as "errors".
  const pyCount = word => Number(py.stdout.match(new RegExp(`([0-9]+) ${word}`))?.[1] || 0);
  const back = await readJson(path.join(covDir, 'backend.json'), {files: {}, totals: {}});
  const byDir = {};
  for (const [f, v] of Object.entries(back.files || {})) { const d = 'backend/' + f.replace(/\\/g, '/').split('/')[0]; byDir[d] = byDir[d] || {covered: 0, statements: 0}; byDir[d].covered += v.summary.covered_lines; byDir[d].statements += v.summary.num_statements; }
  const web = run(process.execPath, [path.join(repo, 'frontend/web/node_modules/vitest/vitest.mjs'), 'run', '--coverage.enabled', '--coverage.provider=custom', `--coverage.customProviderModule=${require.resolve('@vitest/coverage-v8')}`,
                 '--coverage.reporter=json-summary', `--coverage.reportsDirectory=${path.join(covDir, 'web')}`, '--coverage.include=src/**'],
                {cwd: path.join(repo, 'frontend/web'), env: {...process.env, NODE_OPTIONS: `--import=${pathToFileURL(path.join(ROOT, 'tools/bench/lib/coverage-hook.mjs')).href}`}});
  const webTotals = (web.stdout.match(/Tests\s+(?:(\d+) failed \| )?(\d+) passed/) || []);
  const webSummary = await readJson(path.join(covDir, 'web/coverage-summary.json'), {});
  for (const [f, v] of Object.entries(webSummary)) { if (f === 'total') continue; const rel = path.relative(repo, f).replace(/\\/g, '/'); const d = rel.split('/').slice(0, 4).join('/'); byDir[d] = byDir[d] || {covered: 0, statements: 0}; byDir[d].covered += v.lines.covered; byDir[d].statements += v.lines.total; }
  const coverage = {backendLinePct: back.totals?.percent_covered ? Math.round(back.totals.percent_covered * 10) / 10 : null, webLinePct: webSummary.total?.lines?.pct ?? null,
                    byModule: Object.fromEntries(Object.entries(byDir).map(([d, v]) => [d, v.statements ? Math.round(v.covered / v.statements * 1000) / 10 : null])),
                    backendTests: {passed: pyCount('passed'), failed: pyCount('failed') + pyCount('errors?'), exit: py.status}, webTests: {passed: Number(webTotals[2] || 0), failed: Number(webTotals[1] || 0), exit: web.status}};
  const addField = await readJson(path.join(ROOT, `docs/bench/results/${label}/add-field-experiment.json`), null);
  return {size, duplication, complexity, typeEscapes: {any: anyCount, tsIgnore: ignores}, dependencies, coverage, addField};
}
