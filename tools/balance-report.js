// Balance report for Levels 4 and 5: runs the balance bot over seeds and profiles, in parallel, and prints medians.
// Usage: node tools/balance-report.js [--seeds=3] [--jobs=4] [--json=out.json] <label=build> ...
//   build: "" (this build, defaults), "?exp=..." (flags), "@rev" (a git revision), "path.html?flags"
//   e.g. node tools/balance-report.js "before=@c903362" "now="
// Profiles: active (2 surveys/s, two iterations: the second is the modest-prestige profile), idle (0.3 surveys/s with
// the bot's specialist investment), both with --auto (the Dispatch Protocol and the Procurement Controller with every
// switch on), and fun (active, then 30 minutes in Level FUN before noclipping, two iterations). Every profile plays as a patient player
// (--save=180: it saves for a one-off requisition worth up to 3 minutes of income). For each it reports, as medians
// over seeds:
//   L4, L5, exit       minutes from the start of the iteration; inL4/inL5 minutes spent in each level
//   pow4/pow5/powX     survey power on reaching L4, L5 and at the exit; sps4/sps5/spsX the Scavenger's salvage/s
//   map4/map5          rooms mapped per second on reaching L4 and L5 (the Cartographer plus the bot's surveys)
//   buys4/buys5        purchases made in L4 and in L5; gap4/gap5 the longest wait between two purchases there (s)
//   res45              research projects started in L4 and L5
//   unlock classes     for every salvage item that first went on sale in L4 or L5, its price ÷ income at that
//                      moment, counted as <30 s, small (30–90 s), 90–120 s, meaningful (2–5 min), major (5–12 min) and
//                      >12 min, across all seeds
//   dv                 Déjà Vu at the end of the iteration
//   funBuys, funRanks  purchases made in Level FUN, and ranks of repeatable research bought there (the fun profile)
//   mem, lvls          from iteration 2 on: Memories owned and Déjà Vu shop levels bought with the Déjà Vu of the runs
//                      before (Recurrence ranks count as levels)
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFile, execFileSync } = require('child_process');

const args = process.argv.slice(2);
const opt = Object.fromEntries(args.filter((a) => a.startsWith('--')).map((a) => { const [k, ...v] = a.slice(2).split('='); return [k, v.join('=')]; }));
const builds = args.filter((a) => !a.startsWith('--')).map((spec) => {
  const [label, target = ''] = spec.split(/=(.*)/s);
  let file = path.join(__dirname, '..', 'index.html'), query = target;
  if (target.startsWith('@')) {
    file = path.join(os.tmpdir(), `the-hum-${target.slice(1)}.html`);
    fs.writeFileSync(file, execFileSync('git', ['-C', path.join(__dirname, '..'), 'show', `${target.slice(1)}:index.html`]));
    query = '';
  } else if (target && !target.startsWith('?')) {
    const q = target.indexOf('?');
    file = path.resolve(q < 0 ? target : target.slice(0, q)); query = q < 0 ? '' : target.slice(q);
  }
  return { label, file, query };
});
if (!builds.length) builds.push({ label: 'now', file: path.join(__dirname, '..', 'index.html'), query: '' });
const SEEDS = Number(opt.seeds || 3), JOBS = Number(opt.jobs || 4);
const PROFILES = [
  { name: 'active', args: ['2', '0.8', '170', '2', '--save=180'] },
  { name: 'idle', args: ['0.3', '0.5', '280', '1', '--save=180'] },
  { name: 'active+auto', args: ['2', '0.8', '170', '2', '--auto', '--save=180'] },
  { name: 'idle+auto', args: ['0.3', '0.5', '280', '1', '--auto', '--save=180'] },
  { name: 'fun', args: ['2', '0.8', '200', '2', '--save=180', '--fun=30'] },
].filter((p) => !opt.profiles || opt.profiles.split(',').includes(p.name));

const med = (a) => { const s = a.filter((x) => x != null && Number.isFinite(x)).sort((x, y) => x - y); return s.length ? s[Math.floor((s.length - 1) / 2)] : null; };
const shotAt = (r, minute) => r.shots.reduce((best, s) => (s.min <= minute + 1e-9 && (!best || s.min > best.min) ? s : best), null);

function summarise(r) {
  const out = { L4: r.ms.L4, L5: r.ms.L5, exit: r.ms.exit, dv: r.dv };
  out.inL4 = r.ms.L5 != null && r.ms.L4 != null ? r.ms.L5 - r.ms.L4 : null;
  out.inL5 = r.ms.exit != null && r.ms.L5 != null ? r.ms.exit - r.ms.L5 : null;
  const at = (m) => (m == null ? null : r.shots.find((s) => s.min >= m) || null);
  const s4 = at(r.ms.L4), s5 = at(r.ms.L5), sx = at(r.ms.exit);
  const num = (s, k) => (s ? Number(s[k]) : null);
  Object.assign(out, { pow4: num(s4, 'power'), pow5: num(s5, 'power'), powX: num(sx, 'power'), sps4: num(s4, 'sps'), sps5: num(s5, 'sps'), spsX: num(sx, 'sps') });
  out.map4 = s4 ? Number(s4.auto) : null;
  out.map5 = s5 ? Number(s5.auto) : null;
  const inLevel = (L) => r.buys.filter((b) => b.L === L && b.cur !== 'echoes');
  out.buys4 = inLevel(4).length; out.buys5 = inLevel(5).length;
  const gap = (L) => { const t = inLevel(L).map((b) => b.t * 60).sort((a, b) => a - b); let g = 0; for (let i = 1; i < t.length; i++) g = Math.max(g, t[i] - t[i - 1]); return t.length > 1 ? g : null; };
  out.gap4 = gap(4); out.gap5 = gap(5);
  out.res45 = r.buys.filter((b) => (b.L === 4 || b.L === 5) && b.kind === 'research').length;
  out.unlocks = (r.unlocks || []).filter((u) => (u.L === 4 || u.L === 5) && u.secs != null);
  const fun = r.buys.filter((b) => b.L === 6);
  out.funBuys = fun.length;
  out.funRanks = fun.filter((b) => b.kind === 'research' && /#\d+$/.test(b.id)).length;
  if (r.shop) {
    const m = r.shop.memories || {};
    out.mem = Object.keys(m).filter((k) => k !== 'recur' && m[k] > 0).length;
    out.lvls = (m.recur || 0) + Object.values(r.shop.levels || {}).reduce((a, b) => a + b, 0);
  }
  return out;
}
const CLASSES = [['<30s', 0, 30], ['30-90s', 30, 90], ['90-120s', 90, 120], ['2-5m', 120, 300], ['5-12m', 300, 720], ['>12m', 720, Infinity]];

function runBot(b, p, seed) {
  return new Promise((resolve, reject) => {
    execFile('node', [path.join(__dirname, 'balance-bot.js'), ...p.args, `--file=${b.file}`, `--query=${b.query}`, `--seed=${seed}`, '--json', '--every=1'], { maxBuffer: 256e6 }, (err, stdout) => {
      if (err) { reject(err); return; }
      try { resolve(JSON.parse(stdout.trim().split('\n').pop())); } catch (e) { reject(e); }
    });
  });
}

(async () => {
  const jobs = [];
  for (const b of builds) for (const p of PROFILES) for (let seed = 1; seed <= SEEDS; seed++) jobs.push({ b, p, seed });
  const results = new Map();
  let next = 0, done = 0;
  const worker = async () => {
    while (next < jobs.length) {
      const j = jobs[next++];
      const out = await runBot(j.b, j.p, j.seed);
      if (out.errors.length) console.error(`${j.b.label} ${j.p.name} seed ${j.seed}: ${out.errors.slice(0, 2).join(' | ')}`);
      results.set(`${j.b.label}|${j.p.name}|${j.seed}`, out);
      process.stderr.write(`\r${++done}/${jobs.length} runs`);
    }
  };
  await Promise.all(Array.from({ length: JOBS }, worker));
  process.stderr.write('\n');

  const cols = ['profile', 'build', 'iter', 'L4', 'L5', 'exit', 'inL4', 'inL5', 'pow4', 'pow5', 'powX', 'sps4', 'sps5', 'spsX', 'map4', 'map5', 'buys4', 'buys5', 'gap4', 'gap5', 'res45', 'dv', 'funBuys', 'funRanks', 'mem', 'lvls'];
  const rows = [];
  const classRows = [];
  for (const p of PROFILES) {
    for (const b of builds) {
      const per = [];
      for (let seed = 1; seed <= SEEDS; seed++) {
        const out = results.get(`${b.label}|${p.name}|${seed}`);
        out.runs.forEach((r, i) => { (per[i] = per[i] || []).push(summarise(r)); });
      }
      per.forEach((list, i) => {
        const row = { profile: p.name, build: b.label, iter: i + 1 };
        for (const c of cols.slice(3)) row[c] = med(list.map((x) => x[c]));
        rows.push(row);
        const all = list.flatMap((x) => x.unlocks);
        const counts = Object.fromEntries(CLASSES.map(([n, lo, hi]) => [n, all.filter((u) => u.secs >= lo && u.secs < hi).length]));
        classRows.push({ profile: p.name, build: b.label, iter: i + 1, items: all.length, ...counts,
          examples: all.filter((u) => /^(upg|fac):/.test(u.key)).sort((x, y) => x.secs - y.secs).map((u) => `${u.key.split(':')[1]} ${Math.round(u.secs)}s`).filter((x, k, arr) => arr.findIndex((y) => y.split(' ')[0] === x.split(' ')[0]) === k).join(', ') });
      });
    }
  }
  const fmt = (v) => (v == null ? '-' : typeof v === 'number' ? (Math.abs(v) >= 1e4 ? v.toExponential(1) : Number.isInteger(v) ? String(v) : v.toFixed(1)) : String(v));
  console.log('| ' + cols.join(' | ') + ' |');
  console.log('|' + cols.map(() => ' --- ').join('|') + '|');
  for (const r of rows) console.log('| ' + cols.map((c) => fmt(r[c])).join(' | ') + ' |');
  console.log('\nItems first on sale in Levels 4 and 5: price ÷ income at that moment (counts over all seeds)\n');
  const ccols = ['profile', 'build', 'iter', 'items', ...CLASSES.map(([n]) => n)];
  console.log('| ' + ccols.join(' | ') + ' |');
  console.log('|' + ccols.map(() => ' --- ').join('|') + '|');
  for (const r of classRows) console.log('| ' + ccols.map((c) => fmt(r[c])).join(' | ') + ' |');
  console.log('\nPer item (first seed order, deduplicated), seconds of income when first on sale:');
  for (const r of classRows) console.log(`  ${r.profile} ${r.build} iteration ${r.iter}: ${r.examples}`);
  if (opt.json) fs.writeFileSync(opt.json, JSON.stringify({ rows, classRows }, null, 1));
})();
