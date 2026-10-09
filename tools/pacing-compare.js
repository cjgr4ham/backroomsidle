// Compares pacing between builds or experiment settings with the balance bot: medians over seeds.
// Usage: node tools/pacing-compare.js [--seeds=7] [--runs=2] [--max=150] [--profiles=active:3:0.8,casual:1:0.5] <label=query|file> ...
//   e.g. node tools/pacing-compare.js "original=?exp=none" "click=?exp=none,EXP-CLICK-POWER"
//        node tools/pacing-compare.js "crew=?exp=none,EXP-CREW-AUTOMATION" "neglect=?exp=none,EXP-CREW-AUTOMATION|--crew=base"
//        node tools/pacing-compare.js "baseline=@ebfa0c6" "now=?exp=none"    (@rev builds that git revision)
// Columns: minutes to each level and the exit, Déjà Vu at the end of the iteration, the share of salvage from
// surveys made by hand, attention at 5 and 10 minutes, peak attention, drinks and averted incidents.
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');

const args = process.argv.slice(2);
const opt = Object.fromEntries(args.filter((a) => a.startsWith('--')).map((a) => { const [k, ...v] = a.slice(2).split('='); return [k, v.join('=')]; }));
const builds = args.filter((a) => !a.startsWith('--')).map((spec) => {
  const [label, rest] = spec.split(/=(.*)/s);
  const [target, ...extra] = rest.split('|');
  let file = path.join(__dirname, '..', 'index.html'), query = target;
  if (target.startsWith('@')) {
    file = path.join(os.tmpdir(), `the-hum-${target.slice(1)}.html`);
    fs.writeFileSync(file, execFileSync('git', ['-C', path.join(__dirname, '..'), 'show', `${target.slice(1)}:index.html`]));
    query = '';
  } else if (!target.startsWith('?') && target) { file = path.resolve(target); query = ''; }
  return { label, file, query, extra };
});
if (!builds.length) { console.log('Give at least one build, e.g. "original=?exp=none"'); process.exit(1); }
const SEEDS = Number(opt.seeds || 7), RUNS = Number(opt.runs || 2), MAX = opt.max || '150';
const PROFILES = (opt.profiles || 'active:3:0.8,casual:1:0.5').split(',').map((s) => s.split(':'));
const med = (a) => { const s = a.filter((x) => x != null && !Number.isNaN(x)).sort((x, y) => x - y); return s.length ? s[Math.floor((s.length - 1) / 2)] : null; };
const at = (r, m, k) => { const s = r.shots.find((x) => x.min === m); return s ? s[k] : null; };

const cols = ['profile', 'build', 'iter', 'L1', 'L2', 'L3', 'L4', 'L5', 'exit', 'dv', 'hand%', 'att@5', 'att@10', 'peak', 'drinks', 'averted'];
console.log(cols.join('\t'));
for (const [pname, clicks, doc] of PROFILES) {
  for (const b of builds) {
    const perRun = [];
    for (let seed = 1; seed <= SEEDS; seed++) {
      const text = execFileSync('node', [path.join(__dirname, 'balance-bot.js'), clicks, doc, MAX, String(RUNS), `--file=${b.file}`, `--query=${b.query}`, `--seed=${seed}`, '--json', ...b.extra], { maxBuffer: 64e6 }).toString();
      const out = JSON.parse(text.trim().split('\n').pop());
      if (out.errors.length) console.log(`  ${b.label} seed ${seed}: ${out.errors.slice(0, 2).join(' | ')}`);
      out.runs.forEach((r, i) => { (perRun[i] = perRun[i] || []).push(r); });
    }
    perRun.forEach((rs, i) => {
      const row = { profile: pname, build: b.label, iter: i + 1 };
      for (const k of ['L1', 'L2', 'L3', 'L4', 'L5', 'exit']) row[k] = med(rs.map((r) => r.ms[k]));
      row.dv = med(rs.map((r) => r.dv));
      row['hand%'] = Math.round(100 * med(rs.map((r) => r.manualShare)));
      row['att@5'] = med(rs.map((r) => at(r, 5, 'att')));
      row['att@10'] = med(rs.map((r) => at(r, 10, 'att')));
      row.peak = Math.round(med(rs.map((r) => r.peakAttention)));
      row.drinks = med(rs.map((r) => r.stats.drinks));
      row.averted = med(rs.map((r) => r.stats.averted));
      console.log(cols.map((c) => (row[c] == null ? '-' : row[c])).join('\t'));
    });
  }
}
