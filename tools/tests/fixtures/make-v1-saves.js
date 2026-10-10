// Makes the version-1 save fixtures used by migration.test.js, with a version-1 build of the game and its own code.
// Usage:
//   git show a177c49:index.html > /tmp/the-hum-v1.html
//   node tools/tests/fixtures/make-v1-saves.js /tmp/the-hum-v1.html
// Each fixture is what that build itself wrote to localStorage after its own validation (sanitizeState + save).
const fs = require('fs');
const path = require('path');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node22/lib/node_modules/playwright'); }

const FILE = path.resolve(process.argv[2] || '');
if (!fs.existsSync(FILE)) { console.error('Give the path to a version-1 index.html.'); process.exit(1); }

const FIXTURES = {
  // Mid-game: crew in every state (assigned, idle, missing, away on an expedition), an expedition under way,
  // research, Memories, relics, achievements, Déjà Vu, tiers and Survey Drills (kept by the click experiment).
  midgame: () => {
    const H = HUM, T = H.S.time;
    Object.assign(H.S, { iteration: 2, dv: 15, dvTotal: 40, echoes: 9, deepTheory: 2 });
    H.S.memories = { muscle: 1, friends: 1 };
    H.S.relics = { keys: 1, vhs: 2 };
    Object.assign(H.S.research, { pattern: true, hum: true, condense: true, recursion: true, listening: true });
    H.S.life.noclips = 1; H.S.life.exits = 0; H.S.life.maxLevel = 3;
    const r = H.S.run;
    Object.assign(r, { level: 2, levelRooms: 12000, rooms: 20000, salvage: 5e6, aw: 800, attention: 30, sanity: 80 });
    r.flags.water = true;
    r.facilities = { cart: 40, bench: 30, condenser: 8, beacon: 12, vat: 20, foundry: 6 };
    for (const id of ['gloves', 'flashlight', 'prybar', 'wheel', 'notebook', 'boots', 'cutters', 'tier_cart_0', 'tier_cart_1', 'bunks', 'whistle']) r.upgrades[id] = true;
    r.crew = { total: 24, jobs: { scavenge: 8, chart: 4, dowse: 3, watch: 2, archive: 0 }, missing: [{ returnAt: T + 900 }, { returnAt: T + 1200 }], defaultJob: 'scavenge' };
    r.expeditions = { flooded: { start: T - 100, end: T + 380, crew: 3, sps: 4000, hazard: 0.1 } };
    r.ext.click = { drills: 4 };
  },
  // The exit of Level 5 found: in version 2 this is the completed survey, leading into Level FUN.
  completed: () => {
    const H = HUM;
    Object.assign(H.S, { iteration: 3, dv: 60, dvTotal: 160, echoes: 120 });
    H.S.life.noclips = 2; H.S.life.exits = 1; H.S.life.maxLevel = 5;
    const r = H.S.run;
    Object.assign(r, { level: 5, levelRooms: 503000, rooms: 1.2e6, exitFound: true, salvage: 3e11, aw: 4000 });
    r.stats.salvage = 2e12; r.stats.time = 4800;
    r.facilities = { cart: 120, bench: 100, vat: 80, foundry: 60, boiler: 40, switchboard: 20, fold: 5 };
    r.crew = { total: 30, jobs: { scavenge: 10, chart: 6, dowse: 5, watch: 5, archive: 4 }, missing: [], defaultJob: 'scavenge' };
  },
  // A very large crew early on: far more wanderers on one job than a version-2 run would have levels.
  bigcrew: () => {
    const H = HUM;
    const r = H.S.run;
    Object.assign(r, { level: 1, levelRooms: 1000, rooms: 1800, salvage: 20000, aw: 50 });
    r.crew = { total: 80, jobs: { scavenge: 60, chart: 10, dowse: 5, watch: 5, archive: 0 }, missing: [], defaultJob: 'scavenge' };
  },
  // A save changed with the developer menu: it must stay marked after migration.
  devmarked: () => {
    const H = HUM;
    H.S.ext.dev = { actions: 3, first: Date.now() - 60000, last: Date.now(), kinds: ['currency'] };
    const r = H.S.run;
    Object.assign(r, { level: 3, levelRooms: 100, rooms: 40000, salvage: 1e9 });
    r.crew = { total: 5, jobs: { scavenge: 5, chart: 0, dowse: 0, watch: 0, archive: 0 }, missing: [], defaultJob: 'scavenge' };
  },
};

(async () => {
  const browser = await playwright.chromium.launch();
  for (const [name, build] of Object.entries(FIXTURES)) {
    const page = await browser.newPage();
    await page.goto('file://' + FILE + '#debug');
    await page.evaluate(() => { HUM.rt.saveBlocked = true; localStorage.clear(); });
    await page.reload();
    await page.waitForTimeout(250);
    const json = await page.evaluate((src) => {
      const H = HUM;
      H.rt.saveBlocked = true;
      H.replaceState(H.sanitizeState({ v: 1 }));
      new Function(src)();
      // The build's own validation, then its own save.
      H.replaceState(H.sanitizeState(JSON.parse(JSON.stringify(H.S))));
      H.rt.saveBlocked = false; H.save(); H.rt.saveBlocked = true;
      return localStorage.getItem('the-hum.save');
    }, `(${build.toString()})()`);
    const out = path.join(__dirname, `v1-${name}.json`);
    fs.writeFileSync(out, JSON.stringify(JSON.parse(json), null, 1) + '\n');
    console.log('wrote', path.relative(process.cwd(), out));
    await page.close();
  }
  await browser.close();
})();
