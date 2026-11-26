// labels.csv for the Mendeley "Multi-View Raw Video Dataset of Seven Fitness Exercises with Good/Bad Form Labels"
// (Prashanth et al., 2026, DOI 10.17632/kgbb3yn47p.2, CC BY 4.0: credit the authors wherever results from it are shown).
//
//   node tools/video-bench/mendeley-labels.mjs <unzipped dataset folder>     then   node tools/video-bench/run.mjs <same folder>
//
// Walks every video, reads the exercise, good/bad and the camera view from its folder names and file name, and writes
// labels.csv with paths relative to the folder. The dataset has no rep counts, so it measures coaching: a "bad" video
// should draw a form fix, a "good" one none. Only one layout of the three in the download is needed (it repeats the videos).
import {readdirSync, statSync, writeFileSync} from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] ?? '');
const EXERCISE = [[/side.?bend/i, 'sidebend'], [/row/i, 'row'], [/curl/i, 'curl'], [/push.?up/i, 'pushup'], [/shoulder.?press|overhead.?press/i, 'press'],
  [/squat/i, 'squat'], [/tri?ceps?|extension/i, 'overhead']];
const VIDEO = /\.(mp4|mov|m4v|webm)$/i, rows = [], skipped = [];
const walk = dir => { for (const name of readdirSync(dir)) { const p = path.join(dir, name); statSync(p).isDirectory() ? walk(p) : VIDEO.test(name) && add(p); } };
function add(file) {
  const rel = path.relative(root, file), text = rel.replace(/\\/g, '/');
  // Prefer one layout so each video is counted once.
  if (/subject.?wise|exercise.?wise/i.test(text) && seenLayouts.size > 0 && !seenLayouts.has(text.split('/')[0])) return;
  seenLayouts.add(text.split('/')[0]);
  const kind = EXERCISE.find(([re]) => re.test(text))?.[1], quality = /\bbad\b|incorrect|wrong/i.test(text.replace(/[_\-/.]/g, ' ')) ? 'bad' : /\bgood\b|correct/i.test(text.replace(/[_\-/.]/g, ' ')) ? 'good' : null;
  if (!kind || !quality) { skipped.push(text); return; }
  rows.push(`${text},${kind},,${quality === 'bad' ? 'bad' : ''}`);
}
const seenLayouts = new Set();
walk(root);
writeFileSync(path.join(root, 'labels.csv'), ['file,exercise,reps,mistake', ...rows].join('\n') + '\n');
console.log(`${rows.length} videos labelled (${rows.filter(r => r.endsWith(',bad')).length} bad form), written to labels.csv`);
if (skipped.length) console.log(`${skipped.length} skipped (exercise or good/bad not in the name), e.g. ${skipped.slice(0, 3).join(' | ')}`);
