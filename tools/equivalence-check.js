// Behavioural equivalence check: plays the same seeded, scripted session in two builds of the game and
// compares the full saved state and every derived rate at each checkpoint.
//
// Usage:
//   node tools/equivalence-check.js [baselineRev] [query]
//     baselineRev  git revision of the reference build (default ebfa0c6, the pre-experiment baseline)
//     query        query string for the current build (default ?exp=none: every experiment off)
//
// With every experiment off, the current build must match the baseline exactly. Needs git, Node.js and Playwright.
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node22/lib/node_modules/playwright'); }

const ROOT = path.resolve(__dirname, '..');
const REV = process.argv[2] || 'ebfa0c6';
const QUERY = process.argv[3] || '?exp=none';
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];

// Fields that legitimately differ: wall-clock timestamps and the experiment namespaces the baseline does not have.
const IGNORE = new Set(['created', 'lastSaved', 'ext', 'dormant']);

function session(seed) {
  // Runs inside the page. Deterministic given the seed: Math.random is replaced by a seeded generator.
  let a = seed >>> 0;
  Math.random = () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const H = window.HUM;
  H.rt.saveBlocked = true;
  H.replaceState(H.sanitizeState({ v: 1 }));
  // The live frame loop advances these runtime timers by a varying amount before this session starts.
  H.rt.checkAcc = 0;
  H.rt.autobuyAcc = 0;
  const rnd = Math.random;
  const checkpoints = [];
  const pickOne = (list) => list[Math.floor(rnd() * list.length)];
  const deriveFields = (D) => {
    const out = {};
    for (const k of Object.keys(D).sort()) {
      const v = D[k];
      if (typeof v === 'number') out[k] = v;
      else if (k === 'fac') for (const id of Object.keys(v).sort()) out['fac.' + id] = [v[id].each, v[id].total, v[id].off, v[id].n];
      else if (k === 'jobOut') for (const id of Object.keys(v).sort()) out['job.' + id] = v[id];
      else if (k === 'sanityBand') out.sanityBand = v.id;
      else if (typeof v === 'boolean') out[k] = v;
    }
    return out;
  };
  const strip = (st) => JSON.parse(JSON.stringify(st, (k, v) => (['created', 'lastSaved', 'ext', 'dormant'].includes(k) ? undefined : v)));
  for (let t = 0; t < 2400; t++) {
    const roll = rnd();
    if (roll < 0.5) { H.rt.lastSurveyReal = -1e9; H.survey(); }
    else if (roll < 0.62) { H.setBuyMode(pickOne([1, 10, 'max'])); H.buyFacility(pickOne(H.FACILITIES).id); }
    else if (roll < 0.7) H.buyUpgrade(pickOne(H.UPGRADES).id);
    else if (roll < 0.74) H.hire();
    else if (roll < 0.8) H.assign(pickOne(['scavenge', 'chart', 'dowse', 'watch', 'archive']), rnd() < 0.7 ? 1 : -1);
    else if (roll < 0.82) H.launchExpedition(pickOne(H.EXPEDITIONS).id);
    else if (roll < 0.84) H.doResearch(pickOne(H.RESEARCH).id);
    else if (roll < 0.85) H.drink(false);
    else if (roll < 0.86) H.killLights();
    else if (roll < 0.875) H.documentAnomaly();
    else if (roll < 0.877) { const r = H.S.run; r.level = Math.min(5, r.level + 1); }
    else if (roll < 0.879) H.S.run.salvage *= 3;
    else if (roll < 0.8795) { H.S.run.level = 3; H.S.run.stats.salvage += 1e7; H.noclip(); H.buyMemory(pickOne(H.MEMORIES).id); }
    else if (roll < 0.8805) H.catchUp(600 + rnd() * 5000);
    else if (roll < 0.8815) H.replaceState(H.sanitizeState(JSON.parse(JSON.stringify(H.S))));
    for (let i = 0; i < 5; i++) H.step(0.1, false);
    if (t % 200 === 199) checkpoints.push({ t, D: deriveFields(H.derive()), S: strip(H.S) });
  }
  return checkpoints;
}

// `a` is the baseline. With baselineKeysOnly, values the current build adds (new derived fields) are not compared.
function compare(a, b, where, diffs, baselineKeysOnly) {
  if (typeof a !== typeof b) { diffs.push(`${where}: type ${typeof a} vs ${typeof b}`); return; }
  if (a && typeof a === 'object') {
    const keys = baselineKeysOnly ? Object.keys(a) : new Set([...Object.keys(a), ...Object.keys(b || {})]);
    for (const k of keys) {
      if (IGNORE.has(k)) continue;
      compare(a[k], b ? b[k] : undefined, `${where}.${k}`, diffs, baselineKeysOnly);
    }
    return;
  }
  if (a !== b && !(Number.isNaN(a) && Number.isNaN(b))) diffs.push(`${where}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`);
}

(async () => {
  const baselineFile = path.join(os.tmpdir(), `the-hum-baseline-${REV}.html`);
  fs.writeFileSync(baselineFile, execFileSync('git', ['-C', ROOT, 'show', `${REV}:index.html`]));
  const currentFile = path.join(ROOT, 'index.html');
  const browser = await playwright.chromium.launch();
  const run = async (file, query, seed) => {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('file://' + file + (query || '') + '#debug');
    await page.evaluate(() => { window.HUM.rt.saveBlocked = true; localStorage.clear(); });
    await page.reload();
    await page.waitForTimeout(150);
    const result = await page.evaluate(session, seed);
    await page.close();
    if (errors.length) throw new Error(`${path.basename(file)}: ${errors.join('; ')}`);
    return result;
  };
  let total = 0, bad = 0;
  for (const seed of SEEDS) {
    const [base, cur] = await Promise.all([run(baselineFile, '', seed), run(currentFile, QUERY, seed)]);
    const diffs = [];
    for (let i = 0; i < Math.max(base.length, cur.length); i++) {
      compare(base[i] && base[i].D, cur[i] && cur[i].D, `seed ${seed} checkpoint ${i} derive`, diffs, true);
      compare(base[i] && base[i].S, cur[i] && cur[i].S, `seed ${seed} checkpoint ${i} state`, diffs);
    }
    total += base.length;
    if (diffs.length) { bad++; console.log(`seed ${seed}: ${diffs.length} differences`); for (const d of diffs.slice(0, 8)) console.log('   ' + d); }
    else console.log(`seed ${seed}: ${base.length} checkpoints identical (level ${base[base.length - 1].S.run.level}, iteration ${base[base.length - 1].S.iteration})`);
  }
  await browser.close();
  console.log(bad ? `\nNOT EQUIVALENT: ${bad} of ${SEEDS.length} seeds differ` : `\nEQUIVALENT: ${total} checkpoints across ${SEEDS.length} seeds match the baseline (${REV})`);
  process.exit(bad ? 1 : 0);
})();
