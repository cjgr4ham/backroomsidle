// Compares pacing between builds or experiment settings with the balance bot: medians over seeds.
// Usage: node tools/pacing-compare.js [--seeds=7] [--runs=2] [--max=150] [--profiles=active:3:0.8,casual:1:0.5] <label=query|file> ...
//   e.g. node tools/pacing-compare.js "now="                                 (this build, experiments at their defaults)
//        node tools/pacing-compare.js "now=" "off=?exp=none"                  (with every experiment off)
//        node tools/pacing-compare.js "before=@07846e5" "now="                (@rev builds that git revision)
//        node tools/pacing-compare.js "variant=/tmp/build.html?exp=none,EXP-A"   (another file, with flags)
//        node tools/pacing-compare.js "now=" "tuned=|--tune=/tmp/numbers.js"     (extra bot options after |)
// Columns: minutes to each level and the end of the survey (exit), Déjà Vu at the end of the iteration, the shares
// of salvage from surveys made by hand and from the Scavenger, attention at 5 and 10 minutes, peak attention,
// drinks, averted incidents, and entities seen and caught (the bot stands still unless given --reckless).
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
  } else if (!target.startsWith('?') && target) {
    const q = target.indexOf('?');   // a file with experiment flags: path/to/build.html?exp=none,EXP-A
    file = path.resolve(q < 0 ? target : target.slice(0, q)); query = q < 0 ? '' : target.slice(q);
  }
  return { label, file, query, extra };
});
if (!builds.length) { console.log('Give at least one build, e.g. "original=?exp=none"'); process.exit(1); }
const SEEDS = Number(opt.seeds || 7), RUNS = Number(opt.runs || 2), MAX = opt.max || '150';
const PROFILES = (opt.profiles || 'active:3:0.8,casual:1:0.5').split(',').map((s) => s.split(':'));
const med = (a) => { const s = a.filter((x) => x != null && !Number.isNaN(x)).sort((x, y) => x - y); return s.length ? s[Math.floor((s.length - 1) / 2)] : null; };
const at = (r, m, k) => { const s = r.shots.find((x) => x.min === m); return s ? s[k] : null; };

const cols = ['profile', 'build', 'iter', 'L1', 'L2', 'L3', 'L4', 'L5', 'exit', 'dv', 'hand%', 'idle%', 'att@5', 'att@10', 'peak', 'drinks', 'averted', 'enc', 'caught'];
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
      row['idle%'] = Math.round(100 * med(rs.map((r) => r.idleShare || 0)));
      row.enc = med(rs.map((r) => r.stats.encounters));
      row.caught = med(rs.map((r) => r.stats.caught));
      row['att@5'] = med(rs.map((r) => at(r, 5, 'att')));
      row['att@10'] = med(rs.map((r) => at(r, 10, 'att')));
      row.peak = Math.round(med(rs.map((r) => r.peakAttention)));
      row.drinks = med(rs.map((r) => r.stats.drinks));
      row.averted = med(rs.map((r) => r.stats.averted));
      console.log(cols.map((c) => (row[c] == null ? '-' : row[c])).join('\t'));
    });
  }
}
