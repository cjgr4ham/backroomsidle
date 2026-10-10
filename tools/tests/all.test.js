// Whole-game regression with every experiment on: a save from the original build (format 1) is converted to the
// current game (format 2), both when imported and when found in this browser at start-up; a session plays with
// every system (facilities, requisitions, specialists, missions, timed research, time away); every tab and section
// opens; the camera keeps rendering; and saving and loading keep everything.
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');
const { open, Checker } = require('./harness');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node22/lib/node_modules/playwright'); }

const BASELINE = 'ebfa0c6';

(async () => {
  const c = new Checker('Regression: every experiment on');

  // A save made by the original build, with progress in it: 12 wanderers (10 in jobs, 2 idle), one expedition out.
  const baseFile = path.join(os.tmpdir(), `the-hum-baseline-${BASELINE}.html`);
  fs.writeFileSync(baseFile, execFileSync('git', ['-C', path.resolve(__dirname, '..', '..'), 'show', `${BASELINE}:index.html`]));
  const b0 = await playwright.chromium.launch();
  const p0 = await b0.newPage();
  await p0.goto('file://' + baseFile + '#debug');
  await p0.waitForTimeout(300);
  const old = await p0.evaluate(() => {
    const H = HUM; H.rt.saveBlocked = true;
    const r = H.S.run;
    Object.assign(r, { level: 2, rooms: 9000, levelRooms: 2000, salvage: 123456, aw: 321 });
    r.flags.water = true;
    r.upgrades = { flashlight: true, radio: true, whistle: true, bunks: true, ledger: true, tier_cart_0: true };
    r.facilities = { cart: 40, bench: 30, condenser: 10, beacon: 20, vat: 15, foundry: 5, dampener: 4 };
    r.crew.total = 12; r.crew.jobs = { scavenge: 6, chart: 1, dowse: 2, watch: 1, archive: 0 };
    H.S.echoes = 17; H.S.research = { pattern: true }; H.S.dv = 5; H.S.dvTotal = 12; H.S.iteration = 2; H.S.memories = { muscle: 1 };
    H.rt.D = H.derive();                          // the expedition records the production of this operation
    const sent = H.launchExpedition('flooded');   // two of the idle wanderers go
    H.S.lastSaved = Date.now();
    return { v: H.S.v, sent, text: H.encodeSave(), json: JSON.stringify(H.S), salvage: r.salvage, aw: r.aw, rooms: r.rooms, levelRooms: r.levelRooms, level: r.level,
      facilities: { ...r.facilities }, upgrades: Object.keys(r.upgrades), crew: r.crew.total, jobs: { ...r.crew.jobs }, expedition: r.expeditions.flooded };
  });
  await b0.close();
  if (old.v !== 1 || !old.sent || !(old.expedition.sps > 0)) throw new Error('The original build did not make the expected format-1 save.');

  // What the conversion should give: each job's wanderers become that specialist's levels, and every wanderer
  // without a job (idle, missing or away) joins the Scavenger.
  const SPEC_IDS = ['scavenge', 'chart', 'dowse', 'watch', 'archive'];
  const wantSpecs = {};
  let inJobs = 0;
  for (const id of SPEC_IDS) { const k = old.jobs[id] || 0; inJobs += k; if (k > 0) wantSpecs[id] = k; }
  wantSpecs.scavenge = (wantSpecs.scavenge || 0) + (old.crew - inJobs);
  const sortedJSON = (o) => JSON.stringify(Object.keys(o).sort().map((k) => [k, o[k]]));

  const g = await open('?exp=all', { width: 1366, height: 860 });
  const { ev, page } = g;
  const loaded = await ev((text) => {
    const H = HUM;
    const st = H.decodeSave(text);
    H.replaceState(st);
    H.rt.saveBlocked = true;
    const r = H.S.run;
    return { v: H.S.v, salvage: r.salvage, aw: r.aw, echoes: H.S.echoes, dv: H.S.dv, dvTotal: H.S.dvTotal, iteration: H.S.iteration, level: r.level, rooms: r.rooms, levelRooms: r.levelRooms,
      research: Object.keys(H.S.research), memories: H.S.memories, facilities: r.facilities, upgrades: Object.keys(r.upgrades), dormant: r.dormant.upgrades || [],
      specialists: r.specialists, crewGone: !('crew' in r) && !('expeditions' in r), missions: r.missions,
      notes: H.S.log.filter((e) => e.tag === 'UPDATE').map((e) => e.text) };
  }, old.text);
  c.check('a save from the original build loads as format 2 with every resource, level and room count intact',
    loaded.v === 2 && loaded.salvage === old.salvage && loaded.aw === old.aw && loaded.echoes === 17 && loaded.dv === 5 && loaded.dvTotal === 12 && loaded.iteration === 2
    && loaded.level === old.level && loaded.rooms === old.rooms && loaded.levelRooms === old.levelRooms && loaded.research.join() === 'pattern' && loaded.memories.muscle === 1, loaded);
  c.check('its facilities and upgrades are kept, and an upgrade this version no longer has is kept aside',
    sortedJSON(loaded.facilities) === sortedJSON(old.facilities) && JSON.stringify(loaded.upgrades.slice().sort()) === JSON.stringify(old.upgrades.filter((u) => u !== 'radio').sort())
    && loaded.dormant.join() === 'radio', { old: [old.facilities, old.upgrades], now: [loaded.facilities, loaded.upgrades, loaded.dormant] });
  c.check('its wanderers become specialists, one level per wanderer in a job, the rest joining the Scavenger',
    sortedJSON(loaded.specialists) === sortedJSON(wantSpecs) && loaded.crewGone, { want: wantSpecs, now: loaded.specialists });
  const ex = old.expedition, mi = loaded.missions.flooded;
  c.check('its expedition under way carries on as a mission with the same timing and a salvage haul',
    Object.keys(loaded.missions).join() === 'flooded' && mi.start === ex.start && mi.end === ex.end && mi.salvage === Math.max(2000, ex.sps * 600) && mi.hazard === ex.hazard, { ex, mi });
  c.check('the terminal says what changed', loaded.notes.length >= 2 && loaded.notes.some((t) => /became specialists/.test(t)) && loaded.notes.some((t) => /carried on as a mission/.test(t)), loaded.notes);

  // Production after the conversion follows the current rules.
  const prod = await ev(() => {
    const H = HUM, r = H.S.run, D = H.derive();
    const sc = H.SPEC.scavenge, lvl = r.specialists.scavenge;
    const scav = sc.rate * lvl * Math.pow(sc.step, lvl - 1);
    const parts = D.base * D.facMult * D.surveyUpg * D.depth * D.global * D.drill;
    const keepFac = r.facilities; r.facilities = {}; const noFac = H.derive(); r.facilities = keepFac;
    const keepSpec = r.specialists; r.specialists = {}; const noSpec = H.derive(); r.specialists = keepSpec;
    return { power: D.surveyPower, parts, manual: D.manualSalvage, condition: D.condition, sps: D.sps, scavWant: scav * D.specEff * D.depth * D.global, facMult: D.facMult,
      noFac: { sps: noFac.sps, power: noFac.surveyPower, facMult: noFac.facMult }, noSpec: { sps: noSpec.sps, power: noSpec.surveyPower } };
  });
  c.check('survey power is base × facility multiplier × survey upgrades × depth × global bonuses × drills, and one survey is that × your condition',
    prod.power > 1 && Math.abs(prod.power - prod.parts) < 1e-9 * prod.parts && Math.abs(prod.manual - prod.power * prod.condition) < 1e-9 * prod.power && prod.facMult > 1, prod);
  c.check('passive salvage comes from the Scavenger alone, and survey power and passive salvage never depend on each other',
    prod.sps > 0 && Math.abs(prod.sps - prod.scavWant) < 1e-9 * prod.sps && prod.noFac.sps === prod.sps && prod.noFac.power < prod.power && prod.noFac.facMult === 1
    && prod.noSpec.sps === 0 && prod.noSpec.power === prod.power, prod);

  // The same format-1 save found in this browser when the game starts: converted, the original kept, the player told.
  await ev((json) => { HUM.rt.saveBlocked = true; localStorage.setItem('the-hum.save', json); localStorage.removeItem('the-hum.save.v1'); }, old.json);
  await g.reload();
  const boot = await ev(() => {
    const H = HUM, modal = document.querySelector('.modal');
    const stored = JSON.parse(localStorage.getItem('the-hum.save'));
    return { v: H.S.v, specialists: H.S.run.specialists, missions: Object.keys(H.S.run.missions), copy: localStorage.getItem('the-hum.save.v1'), storedV: stored && stored.v,
      title: modal && modal.querySelector('h2').textContent, items: modal ? [...modal.querySelectorAll('li')].map((li) => li.textContent) : [],
      notes: H.S.log.filter((e) => e.tag === 'UPDATE').map((e) => e.text) };
  });
  c.check('a format-1 save in this browser is converted at start-up, the original kept aside, and the player told what changed',
    boot.v === 2 && boot.storedV === 2 && boot.copy === old.json && sortedJSON(boot.specialists) === sortedJSON(wantSpecs) && boot.missions.join() === 'flooded'
    && boot.title === 'The Hum has changed' && boot.items.length === boot.notes.length && boot.notes.length >= 2 && boot.items.every((t) => boot.notes.includes(t)),
    { ...boot, copy: boot.copy && boot.copy.slice(0, 60) });
  await ev(() => { HUM.UI.closeModal(); HUM.rt.saveBlocked = true; });

  // Play: surveys, purchases, specialists, missions, research and time, through the game's own functions.
  const played = await ev(() => {
    const H = HUM, r = H.S.run;
    H.CONFIG.encounters.firstRooms = 1e12;   // no hostile entities: they are random, and have their own tests
    const t0 = H.S.time, back0 = H.S.life.expeditions;
    const got = { surveys: 0, facilities: 0, upgrades: 0, specialists: 0, missions: 0, research: 0 };
    for (let s = 0; s < 1200; s++) {   // two minutes of game time in 0.1 s steps
      if (s % 3 === 0) { H.rt.lastSurveyReal = -1e9; if (H.survey()) got.surveys++; }
      if (s % 10 === 0) {
        for (const f of H.FACILITIES) if (H.facVisible(f) && H.buyFacility(f.id)) got.facilities++;
        for (const u of H.UPGRADES) if (H.upgradeAvailable(u) && H.buyUpgrade(u.id)) got.upgrades++;
        for (const sp of H.SPECIALISTS) if (H.hireSpecialist(sp.id)) got.specialists++;
        for (const m of H.MISSIONS) if (H.launchMission(m.id)) got.missions++;
        for (const R of H.RESEARCH) if (H.doResearch(R.id)) got.research++;
      }
      H.step(0.1, false);
    }
    const rep = H.catchUp(1800);
    const D = H.derive();
    const finite = [D.surveyPower, D.manualSalvage, D.sps, D.aws, D.eps, D.roomsPerSec, D.noise, D.absorb, D.attnTarget,
      r.salvage, r.aw, H.S.echoes, r.attention, r.sanity, r.rooms, r.levelRooms].every(Number.isFinite);
    return { dt: H.S.time - t0, finite, report: !!rep, level: r.level, got, back: H.S.life.expeditions - back0, hum: H.S.research.hum === true, researching: H.S.researching };
  });
  c.check('two minutes of play and half an hour away run without errors, and every figure stays finite', played.dt > 1900 && played.finite && played.report, played);
  c.check('specialists, missions and timed research all work in play and while away',
    played.got.surveys === 400 && played.got.facilities > 0 && played.got.upgrades > 0 && played.got.specialists > 0 && played.got.missions > 0 && played.got.research > 0
    && played.back >= 1 && played.hum, played);

  // Every tab, and every section of the Archive and Noclip tabs, opens.
  const tabs = await ev(() => {
    const H = HUM, seen = [];
    for (const id of ['upgrades', 'crew', 'expeditions', 'research', 'noclip']) H.S.seen['tab_' + id] = true;
    for (const t of H.TABS) {
      if (document.getElementById('tab-' + t.id).hidden) continue;
      H.UI.selectTab(t.id); H.rt.structureDirty = true; H.UI.update(true);
      seen.push([t.id, document.getElementById('panel-' + t.id).textContent.length, true]);
    }
    for (const tab of ['archive', 'noclip']) {
      H.UI.selectTab(tab); H.UI.update(true);
      const ids = [...document.querySelectorAll(`#panel-${tab} .subtabs button`)].map((b) => b.dataset.id);
      for (const id of ids) {
        // Each click rebuilds the panel, so the button is found again every time.
        document.querySelector(`#panel-${tab} .subtabs button[data-id="${id}"]`).click();
        H.UI.update(true);
        const on = document.querySelector(`#panel-${tab} .subtabs button[aria-pressed="true"]`);
        seen.push([`${tab}:${id}`, document.getElementById('panel-' + tab).textContent.length, !!on && on.dataset.id === id]);
      }
    }
    return seen;
  });
  const names = tabs.map(([id]) => id);
  const wanted = ['facilities', 'upgrades', 'crew', 'expeditions', 'research', 'noclip', 'archive', 'settings',
    'archive:docs', 'archive:relics', 'archive:ach', 'archive:ledger', 'archive:stats', 'archive:manual', 'archive:lb', 'noclip:noclip', 'noclip:djv'];
  c.check('every visible tab, and every Archive and Noclip section the experiments add, builds with content',
    wanted.every((id) => names.includes(id)) && tabs.every(([, n, on]) => n > 40 && on), tabs);

  // The camera keeps rendering and the loop keeps running.
  const frames = await ev(async () => {
    const cv = document.getElementById('view');
    const a = cv.toDataURL();
    const w0 = HUM.rt.lastWall;
    await new Promise((res) => setTimeout(res, 600));
    return { changed: cv.toDataURL() !== a, loop: HUM.rt.lastWall > w0, toasts: document.querySelectorAll('.toast').length };
  });
  c.check('the moving camera feed keeps rendering and the main loop keeps running', frames.changed && frames.loop, frames);
  c.check('on-screen messages stay bounded', frames.toasts <= 6, frames);

  // Save and load in this browser.
  const snapshot = () => ev(() => {
    const H = HUM, r = H.S.run;
    return JSON.stringify({ v: H.S.v, l: r.level, f: r.facilities, u: Object.keys(r.upgrades).sort(), dormant: r.dormant, sp: r.specialists, drills: r.drills,
      m: Object.keys(r.missions).sort(), res: H.S.research, deep: H.S.deepTheory, rr: H.S.researching, mem: H.S.memories, rel: H.S.relics, it: H.S.iteration, e: H.S.ext });
  });
  await ev(() => { HUM.rt.saveBlocked = false; HUM.save(); });
  const before = await snapshot();
  await g.reload();
  const after = await snapshot();
  c.check('the game saves and loads with everything, experiment data included', before === after && JSON.parse(after).v === 2, { before: before.slice(0, 300), after: after.slice(0, 300) });

  // Narrow screens.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(200);
  const narrow = await ev(() => {
    const out = [];
    for (const t of HUM.TABS) { if (document.getElementById('tab-' + t.id).hidden) continue; HUM.UI.selectTab(t.id); HUM.UI.update(true); out.push([t.id, document.documentElement.scrollWidth <= window.innerWidth + 1]); }
    return out;
  });
  c.check('no tab scrolls sideways at phone width', narrow.length >= 8 && narrow.every(([, ok]) => ok), narrow);

  c.finish(g.errors);
  await g.browser.close();
})();
