// Makes the save fixtures from the game as it was before update 2.1 (commit c903362), with that build's own code.
// Usage:
//   node tools/tests/fixtures/make-pre-update-saves.js            (extracts c903362 with git)
//   node tools/tests/fixtures/make-pre-update-saves.js <file>     (any other build)
// Each fixture is what that build itself wrote to localStorage after its own validation (sanitizeState + save): a
// late game on Level 4, on Level 5 and in Level FUN, with everything update 2.1 touches (facility counts and
// auto-buy choices, research and its repeatable rank, a project under way, missions under way, Survey Drills).
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node22/lib/node_modules/playwright'); }

const REV = 'c903362';
let FILE = process.argv[2] ? path.resolve(process.argv[2]) : null;
if (!FILE) {
  FILE = path.join(os.tmpdir(), `the-hum-${REV}.html`);
  fs.writeFileSync(FILE, execFileSync('git', ['-C', path.resolve(__dirname, '..', '..', '..'), 'show', `${REV}:index.html`]));
}

const FIXTURES = {
  // Level 4, first iteration: every specialist, the Night Office wave, a mission and a research project under way.
  l4: () => {
    const H = HUM, T = 4000;
    H.S.time = T;
    Object.assign(H.S, { echoes: 5200, deepTheory: 3 });
    for (const id of ['pattern', 'hum', 'condense', 'recursion', 'listening', 'sharewater', 'nightshift', 'exposure', 'autodoc', 'doc_industry', 'phantom']) H.S.research[id] = true;
    H.S.researching = { id: 'expcart', rank: 0, cost: 80, start: T - 100, end: T + 380 };
    H.S.life.maxLevel = 4;
    const r = H.S.run;
    Object.assign(r, { level: 4, levelRooms: 120000, rooms: 260000, salvage: 4.2e9, aw: 1800, attention: 35, sanity: 82, drills: 11, doctrine: 'doc_industry' });
    r.stats.salvage = 2.4e11; r.stats.time = 3300; r.stats.surveys = 6000;
    r.flags = { water: true, expedition: true };
    r.facilities = { cart: 95, bench: 80, condenser: 12, beacon: 30, dampener: 6, vat: 62, foundry: 46, boiler: 28, array: 15, switchboard: 7 };
    for (const id of ['gloves', 'flashlight', 'prybar', 'wheel', 'satchel', 'notebook', 'boots', 'cutters', 'sounder', 'chalk', 'clipboard', 'pedometer', 'spreader',
      'breakroom', 'valve', 'earplugs', 'cot', 'bunks', 'whistle', 'shifts', 'canteens', 'lanterns', 'breakers', 'tripwire', 'foamglue', 'firedoors',
      'maps', 'packs', 'rope', 'ledger', 'tier_cart_0', 'tier_cart_1', 'tier_cart_2', 'tier_bench_0', 'tier_bench_1', 'tier_bench_2', 'tier_vat_0', 'tier_vat_1', 'tier_vat_2',
      'tier_foundry_0', 'tier_foundry_1', 'tier_boiler_0', 'tier_beacon_0', 'tier_beacon_1', 'tier_condenser_0', 'tier_array_0']) r.upgrades[id] = true;
    r.specialists = { scavenge: 18, chart: 10, dowse: 24, watch: 9, archive: 10 };
    r.missions = { records: { start: T - 600, end: T + 3720, salvage: 3e9, hazard: 0.2 }, deepend: { start: T - 100, end: T + 2060, salvage: 2e8, hazard: 0.09 } };
  },
  // Level 5, second iteration: Procurement Notes with auto-buy on three facilities, the Fold Engine, Deep Survey
  // Theory under way, The Long Walk under way, a specialist taken by an incident.
  l5: () => {
    const H = HUM, T = 9000;
    H.S.time = T;
    Object.assign(H.S, { iteration: 2, dv: 30, dvTotal: 190, echoes: 41000, deepTheory: 6 });
    H.S.memories = { muscle: 1, friends: 1, procure: 1, route: 1 };
    for (const R of H.RESEARCH) if (!R.repeatable && !R.doctrine) H.S.research[R.id] = true;
    H.S.research.doc_industry = true;
    H.S.researching = { id: 'deeptheory', rank: 7, cost: Math.ceil(60 * Math.pow(2.2, 6)), start: T - 500, end: T + 600 };
    H.S.life.maxLevel = 5; H.S.life.noclips = 1; H.S.life.exits = 1;
    const r = H.S.run;
    Object.assign(r, { level: 5, levelRooms: 210000, rooms: 680000, salvage: 6.5e10, aw: 9000, attention: 44, sanity: 76, drills: 16, doctrine: 'doc_industry' });
    r.stats.salvage = 9e11; r.stats.time = 4100; r.stats.surveys = 7000;
    r.flags = { water: true, expedition: true };
    r.facilities = { cart: 112, bench: 97, condenser: 12, beacon: 36, dampener: 10, vat: 79, foundry: 62, boiler: 44, array: 15, switchboard: 24, fold: 2 };
    r.autobuy = { cart: true, bench: true, switchboard: true };
    for (const u of H.UPGRADES) if (!u.repeatable && !/^tier_(fold|switchboard)/.test(u.id)) r.upgrades[u.id] = true;
    delete r.upgrades.carbon;
    r.specialists = { scavenge: 22, chart: 13, dowse: 28, watch: 12, archive: 15 };
    r.away = { watch: T + 200 };
    r.missions = { longwalk: { start: T - 1800, end: T + 5760, salvage: 2e10, hazard: 0.3 } };
  },
  // Level FUN, third iteration: the completed survey, floors, Recurrence, a doctrine, relics and a mission under way.
  fun: () => {
    const H = HUM, T = 20000;
    H.S.time = T;
    Object.assign(H.S, { iteration: 3, dv: 85, dvTotal: 520, echoes: 120000, deepTheory: 9 });
    H.S.memories = { muscle: 1, friends: 1, hoard: 1, thirst: 1, procure: 1, route: 1, sleep: 1, recur: 2 };
    for (const R of H.RESEARCH) if (!R.repeatable) H.S.research[R.id] = true;
    H.S.relics = { keys: 1, vhs: 1, tape: 2, shoe: 1 };
    H.S.life.maxLevel = 6; H.S.life.noclips = 2; H.S.life.exits = 2; H.S.life.rooms = 3.4e6;
    const r = H.S.run;
    Object.assign(r, { level: 6, levelRooms: 127000, rooms: 1.15e6, exitFound: true, salvage: 8e11, aw: 30000, attention: 51, sanity: 70, drills: 22, doctrine: 'doc_wet' });
    r.stats.salvage = 6e12; r.stats.time = 6500; r.stats.surveys = 9000;
    r.flags = { water: true, expedition: true };
    r.facilities = { cart: 130, bench: 110, condenser: 12, beacon: 40, dampener: 12, vat: 90, foundry: 72, boiler: 55, array: 15, switchboard: 33, fold: 9 };
    r.autobuy = { fold: true, switchboard: true };
    for (const u of H.UPGRADES) if (!u.repeatable && !/^tier_fold_2/.test(u.id)) r.upgrades[u.id] = true;
    r.specialists = { scavenge: 26, chart: 15, dowse: 31, watch: 16, archive: 18 };
    r.missions = { longwalk: { start: T - 100, end: T + 7460, salvage: 9e10, hazard: 0.3 }, records: { start: T - 3000, end: T + 780, salvage: 1e10, hazard: 0.2 } };
  },
};

(async () => {
  const browser = await playwright.chromium.launch();
  for (const [name, build] of Object.entries(FIXTURES)) {
    const page = await browser.newPage();
    await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
    await page.goto('file://' + FILE + '#debug');
    await page.evaluate(() => { HUM.rt.saveBlocked = true; localStorage.clear(); });
    await page.reload();
    await page.waitForTimeout(250);
    const json = await page.evaluate((src) => {
      const H = HUM;
      H.rt.saveBlocked = true;
      H.replaceState(H.sanitizeState({ v: 2 }));
      new Function(src)();
      // The build's own validation, then its own save.
      H.replaceState(H.sanitizeState(JSON.parse(JSON.stringify(H.S))));
      H.rt.saveBlocked = false; H.save(); H.rt.saveBlocked = true;
      return localStorage.getItem('the-hum.save');
    }, `(${build.toString()})()`);
    const out = path.join(__dirname, `pre-update-${name}.json`);
    fs.writeFileSync(out, JSON.stringify(JSON.parse(json), null, 1) + '\n');
    console.log('wrote', path.relative(process.cwd(), out));
    await page.close();
  }
  await browser.close();
})();
