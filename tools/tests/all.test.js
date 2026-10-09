// Whole-game regression with every experiment on: an existing save from the original build loads,
// a session plays, every tab and section opens, the camera keeps rendering, and saving and loading work.
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');
const { open, Checker } = require('./harness');

const BASELINE = 'ebfa0c6';

(async () => {
  const c = new Checker('Regression: every experiment on');

  // A save made by the original build, with progress in it.
  const baseFile = path.join(os.tmpdir(), `the-hum-baseline-${BASELINE}.html`);
  fs.writeFileSync(baseFile, execFileSync('git', ['-C', path.resolve(__dirname, '..', '..'), 'show', `${BASELINE}:index.html`]));
  const playwright = require('/opt/node22/lib/node_modules/playwright');
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
    r.crew.total = 10; r.crew.jobs = { scavenge: 6, chart: 1, dowse: 2, watch: 1, archive: 0 };
    H.S.echoes = 17; H.S.research = { pattern: true }; H.S.dv = 5; H.S.dvTotal = 12; H.S.iteration = 2; H.S.memories = { muscle: 1 };
    const D = H.derive();
    const sorted = (o) => Object.keys(o).sort().map((k) => `${k}=${o[k]}`).join(',');
    return { text: H.encodeSave(), sal: D.facSalvage, aws: D.aws, surveys: D.autoSurveys, run: [sorted(r.facilities), sorted(r.upgrades), sorted(r.crew.jobs), r.crew.total].join(' | ') };
  });
  await b0.close();

  const g = await open('?exp=all', { width: 1366, height: 860 });
  const { ev, page } = g;
  const loaded = await ev((text) => {
    const H = HUM;
    const st = H.decodeSave(text);
    H.replaceState(st);
    H.rt.saveBlocked = true;
    const r = H.S.run, D = H.derive();
    const sorted = (o) => Object.keys(o).sort().map((k) => `${k}=${o[k]}`).join(',');
    return { sal: D.facSalvage, aws: D.aws, surveys: D.autoSurveys, salvage: r.salvage, aw: r.aw, echoes: H.S.echoes, dv: H.S.dv, level: r.level, rooms: r.rooms,
      run: [sorted(r.facilities), sorted(r.upgrades), sorted(r.crew.jobs), r.crew.total].join(' | '), legacy: !!(r.ext.crew && r.ext.crew.legacy) };
  }, old.text);
  c.check('a save from the original build loads with every resource, level and room count intact', loaded.salvage === 123456 && loaded.aw === 321 && loaded.echoes === 17 && loaded.dv === 5 && loaded.level === 2 && loaded.rooms === 9000, loaded);
  c.check('its machines, upgrades and crew assignments are unchanged', loaded.run === old.run, { old: old.run, now: loaded.run });
  c.check('its production carries over exactly', Math.abs(loaded.sal - old.sal) < 1e-9 * old.sal && Math.abs(loaded.aws - old.aws) < 1e-9 && Math.abs(loaded.surveys - old.surveys) < 1e-9, { old, loaded });

  // Play: surveys, purchases, crew and time, through the game's own functions.
  const played = await ev(() => {
    const H = HUM, r = H.S.run;
    const t0 = H.S.time;
    for (let s = 0; s < 1200; s++) {   // two minutes of game time in 0.1 s steps
      if (s % 3 === 0) { H.rt.lastSurveyReal = -1e9; H.survey(); }
      if (s % 10 === 0) {
        for (const f of H.FACILITIES) if (H.facVisible(f)) H.buyFacility(f.id);
        for (const u of H.UPGRADES) if (H.upgradeAvailable(u)) H.buyUpgrade(u.id);
        H.hire(); H.assign('scavenge', 1);
      }
      H.step(0.1, false);
    }
    const rep = H.catchUp(1800);
    const D = H.derive();
    const finite = [D.sps, D.aws, D.eps, D.manualSalvage, D.noise, D.absorb, D.attnTarget, r.salvage, r.aw, H.S.echoes, r.attention, r.sanity].every(Number.isFinite);
    return { dt: H.S.time - t0, finite, report: !!rep, level: r.level };
  });
  c.check('two minutes of play and half an hour away run without errors, and every figure stays finite', played.dt > 1900 && played.finite && played.report, played);

  // Every tab and section opens.
  const tabs = await ev(() => {
    const H = HUM, seen = [];
    for (const id of ['upgrades', 'crew', 'expeditions', 'research', 'noclip']) H.S.seen['tab_' + id] = true;
    for (const t of H.TABS) {
      if (document.getElementById('tab-' + t.id).hidden) continue;
      H.UI.selectTab(t.id); H.rt.structureDirty = true; H.UI.update(true);
      seen.push([t.id, document.getElementById('panel-' + t.id).textContent.length]);
    }
    H.UI.selectTab('archive');
    for (const b of [...document.querySelectorAll('#panel-archive .subtabs button')]) { b.click(); H.UI.update(true); seen.push(['archive:' + b.dataset.id, document.getElementById('panel-archive').textContent.length]); }
    return seen;
  });
  c.check('every visible tab and Archive section builds with content', tabs.length >= 10 && tabs.every(([, n]) => n > 40), tabs);

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
  const before = await ev(() => { HUM.rt.saveBlocked = false; HUM.save(); const r = HUM.S.run; return JSON.stringify({ l: r.level, f: r.facilities, u: Object.keys(r.upgrades).sort(), c: r.crew, res: HUM.S.research, e: HUM.S.ext }); });
  await g.reload();
  const after = await ev(() => { const r = HUM.S.run; return JSON.stringify({ l: r.level, f: r.facilities, u: Object.keys(r.upgrades).sort(), c: r.crew, res: HUM.S.research, e: HUM.S.ext }); });
  c.check('the game saves and loads with everything, experiment data included', before === after, { before: before.slice(0, 200), after: after.slice(0, 200) });

  // Narrow screens.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(200);
  const narrow = await ev(() => {
    const out = [];
    for (const t of HUM.TABS) { if (document.getElementById('tab-' + t.id).hidden) continue; HUM.UI.selectTab(t.id); HUM.UI.update(true); out.push([t.id, document.documentElement.scrollWidth <= window.innerWidth + 1]); }
    return out;
  });
  c.check('no tab scrolls sideways at phone width', narrow.every(([, ok]) => ok), narrow);

  c.finish(g.errors);
  await g.browser.close();
})();
