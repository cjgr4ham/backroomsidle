// Behavioural equivalence check: plays the same seeded, scripted session in two builds of the game and compares the
// full saved state and every derived rate at each checkpoint.
//
// Usage:
//   node tools/equivalence-check.js [baselineRev] [query] [--seeds=N] [--file=path]
//     baselineRev  git revision of the reference build (default c903362, the game before update 2.1)
//     query        query string for the current build (default: every update-2.1 experiment off, see UPDATE_FLAGS)
//     --file       compare this file instead of index.html (for example a build with a planted change)
//
// With every experiment of update 2.1 off, and every other experiment at its default, the current build must match
// the build before the update exactly: the same state, rates and log at every checkpoint. Other experiments keep their
// defaults on purpose: the baseline is the game as players had it, not a build with unrelated features removed.
// Needs git, Node.js and Playwright.
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node22/lib/node_modules/playwright'); }

const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const opt = Object.fromEntries(args.filter((a) => a.startsWith('--')).map((a) => { const [k, ...v] = a.slice(2).split('='); return [k, v.length ? v.join('=') : true]; }));
const pos = args.filter((a) => !a.startsWith('--'));
// Every experiment update 2.1 added. Keep in step with docs/experiments/UPDATE-2.1.md.
const UPDATE_FLAGS = ['EXP-CREW-VISIBLE', 'EXP-ROOM-VARIETY', 'EXP-PRODUCTION-FEEDBACK', 'EXP-AMBIENT-EVENTS', 'EXP-CREW-EQUIPMENT',
  'EXP-MISSION-AUTOREPEAT', 'EXP-AUTO-UPGRADE', 'EXP-LATE-FACILITIES', 'EXP-LATE-UPGRADES', 'EXP-LATE-RESEARCH', 'EXP-LATE-BALANCE'];
const REV = pos[0] || 'c903362';
const QUERY = pos[1] || '?exp=' + UPDATE_FLAGS.map((id) => '-' + id).join(',');
const SEEDS = Array.from({ length: Number(opt.seeds || 8) }, (_, i) => i + 1);
const CURRENT = path.resolve(opt.file || path.join(ROOT, 'index.html'));

// Fields that legitimately differ: wall-clock timestamps and the namespaces only one build has.
const IGNORE = new Set(['created', 'lastSaved', 'ext', 'dormant']);

function session(seed) {
  // Runs inside the page. Deterministic given the seed: Math.random is replaced by a seeded generator.
  let a = seed >>> 0;
  Math.random = () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const H = window.HUM;
  H.rt.saveBlocked = true;
  H.UI.floatGain = () => {};
  H.replaceState(H.sanitizeState({ v: 2 }));
  // The live frame loop advances these runtime timers by a varying amount before this session starts.
  H.rt.checkAcc = 0;
  H.rt.autobuyAcc = 0;
  const rnd = Math.random;
  const checkpoints = [];
  // Content of a switched-off experiment does not exist in the game, so the scripted player never picks it.
  const exists = (list) => (H.contentOn ? list.filter(H.contentOn) : list);
  const pickOne = (list) => list[Math.floor(rnd() * list.length)];
  const deriveFields = (D) => {
    const out = {};
    for (const k of Object.keys(D).sort()) {
      const v = D[k];
      if (typeof v === 'number' || typeof v === 'boolean') out[k] = v;
      else if (k === 'fac') for (const id of Object.keys(v).sort()) out['fac.' + id] = [v[id].each, v[id].total, v[id].off, v[id].n];
      else if (k === 'spec') for (const id of Object.keys(v).sort()) out['spec.' + id] = [v[id].level, v[id].working, v[id].base];
      else if (k === 'sanityBand') out.sanityBand = v.id;
    }
    return out;
  };
  const strip = (st) => JSON.parse(JSON.stringify(st, (k, v) => (['created', 'lastSaved', 'ext', 'dormant'].includes(k) ? undefined : v)));
  for (let t = 0; t < 2400; t++) {
    const roll = rnd();
    const r = H.S.run;
    if (roll < 0.46) { H.rt.lastSurveyReal = -1e9; H.survey(); }
    else if (roll < 0.58) { H.setBuyMode(pickOne([1, 10, 25, 'max'])); H.buyFacility(pickOne(exists(H.FACILITIES)).id); }
    else if (roll < 0.66) H.buyUpgrade(pickOne(exists(H.UPGRADES)).id);
    else if (roll < 0.72) H.hireSpecialist(pickOne(H.SPECIALISTS).id);
    else if (roll < 0.76) H.launchMission(pickOne(H.MISSIONS).id);
    else if (roll < 0.79) H.doResearch(pickOne(exists(H.RESEARCH)).id);
    else if (roll < 0.80) H.adoptDoctrine(pickOne(['doc_industry', 'doc_quiet', 'doc_wet']));
    else if (roll < 0.81) H.drink(false);
    else if (roll < 0.82) H.killLights();
    else if (roll < 0.835) H.documentAnomaly();
    else if (roll < 0.838) { if (r.level < 5 && !r.exitFound) H.enterLevel(r.level + 1); }
    else if (roll < 0.842) { r.salvage *= 3; r.aw += 120; H.S.echoes += 40; }
    else if (roll < 0.846) { if (H.S.memories.procure) r.autobuy[pickOne(exists(H.FACILITIES)).id] = true; }
    else if (roll < 0.8466) {
      if (r.level < 5) H.enterLevel(5);
      H.completeFiniteSurvey(0);
      r.stats.salvage += 1e8;
      H.noclip();
      H.S.dv += 12;
      H.buyMemory(rnd() < 0.5 ? 'procure' : pickOne(exists(H.MEMORIES)).id);
    }
    else if (roll < 0.8476) H.catchUp(600 + rnd() * 5000);
    else if (roll < 0.8486) H.replaceState(H.sanitizeState(JSON.parse(JSON.stringify(H.S))));
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
  const browser = await playwright.chromium.launch();
  const run = async (file, query, seed) => {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    // The frame loop is stopped, so only the session moves the game.
    await page.addInitScript(() => { window.requestAnimationFrame = () => 0; try { localStorage.clear(); } catch (e) { /* storage blocked */ } });
    await page.goto('file://' + file + (query || '') + '#debug');
    await page.waitForTimeout(150);
    const result = await page.evaluate(session, seed);
    await page.close();
    if (errors.length) throw new Error(`${path.basename(file)}: ${errors.join('; ')}`);
    return result;
  };
  console.log(`Baseline ${REV} against ${path.relative(ROOT, CURRENT)}${QUERY}`);
  let total = 0, bad = 0;
  for (const seed of SEEDS) {
    const [base, cur] = await Promise.all([run(baselineFile, '', seed), run(CURRENT, QUERY, seed)]);
    const diffs = [];
    for (let i = 0; i < Math.max(base.length, cur.length); i++) {
      compare(base[i] && base[i].D, cur[i] && cur[i].D, `seed ${seed} checkpoint ${i} derive`, diffs, true);
      compare(base[i] && base[i].S, cur[i] && cur[i].S, `seed ${seed} checkpoint ${i} state`, diffs);
    }
    total += base.length;
    const last = base[base.length - 1].S;
    if (diffs.length) { bad++; console.log(`seed ${seed}: ${diffs.length} differences`); for (const d of diffs.slice(0, 8)) console.log('   ' + d); }
    else console.log(`seed ${seed}: ${base.length} checkpoints identical (level ${last.run.level}, iteration ${last.iteration}, ${Object.keys(last.run.facilities).length} facility kinds, ${Object.keys(last.research).length} research)`);
  }
  await browser.close();
  console.log(bad ? `\nNOT EQUIVALENT: ${bad} of ${SEEDS.length} seeds differ` : `\nEQUIVALENT: ${total} checkpoints across ${SEEDS.length} seeds match the baseline (${REV})`);
  process.exit(bad ? 1 : 0);
})();
