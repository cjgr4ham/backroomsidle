// Interface regression at several screen sizes: every tab and every sub-tab present in this build (they are
// found at run time, so the suite still works when an experiment is reverted), served by the game server and
// signed in, and opened from disk, in a developed game twice: in the middle of the survey (Level 4) and with the
// survey complete (Level FUN, noclip open). Nothing may scroll sideways, no control may stick out of the window, and
// nothing may log an error.
const { Checker, url: fileUrl } = require('./harness');
const { startServer, has } = require('./server-harness');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node22/lib/node_modules/playwright'); }

const SIZES = [[360, 740, 'phone'], [768, 1024, 'tablet'], [1024, 700, 'small laptop'], [1366, 860, 'desktop']];
const STAGES = ['Level 4', 'Level FUN'];
// The game's own tabs, which a developed game always shows. Tabs and sub-tabs added by experiments are found at run time.
const CORE_TABS = ['facilities', 'upgrades', 'crew', 'expeditions', 'research', 'noclip', 'archive', 'settings'];

/** Develops the game to `stage`, opens every tab and sub-tab, and reports any that overflow sideways. */
function sweep(stage) {
  const H = HUM, S = H.S, r = S.run, out = [];
  if (stage === 'Level 4') {
    // In the middle of the survey: facilities, specialists, a mission and a research project under way, so the later
    // tabs and panels have content, and the facility waves and missions still to come show as locked.
    Object.assign(r, { level: 4, levelRooms: 20000, rooms: 60000, salvage: 5e7, aw: 900 });
    r.flags.water = true; r.flags.expedition = true;
    r.facilities = { cart: 40, bench: 30, condenser: 10, beacon: 12, dampener: 6, vat: 20, foundry: 12, boiler: 6, array: 4, switchboard: 3 };
    for (const id of ['gloves', 'flashlight', 'wheel', 'notebook', 'bunks', 'maps']) r.upgrades[id] = true;
    r.specialists = { scavenge: 8, chart: 4, dowse: 3, watch: 2, archive: 1 };
    r.missions = { stairwell: { start: S.time, end: S.time + 120, salvage: 4000, hazard: 0.05 } };
    r.stats.salvage = 2e8;
    Object.assign(S, { iteration: 4, dv: 120, dvTotal: 900, echoes: 60 });
    S.life.noclips = 3; S.life.maxLevel = 4; S.seen.echoes = true; S.research.pattern = true;
    S.researching = { id: 'hum', rank: 0, cost: 4, start: S.time, end: S.time + 45 };
    for (const id of ['upgrades', 'crew', 'expeditions', 'research', 'noclip']) S.seen['tab_' + id] = true;
  } else {
    // The survey complete: the last room of Level 5 mapped, the run in Level FUN with noclip open.
    r.level = H.FINAL_LEVEL;
    H.completeFiniteSurvey();
    r.facilities.fold = 8;
    r.stats.salvage = 1e12;
  }
  const state = { level: r.level, exitFound: r.exitFound, canNoclip: H.canNoclip() };
  const wide = () => document.documentElement.scrollWidth <= window.innerWidth + 1;
  const sticking = () => [...document.querySelectorAll('#tabpanels button, #tabpanels input, #tabpanels select, .topbar button')]
    .filter((n) => n.offsetParent !== null).filter((n) => { const b = n.getBoundingClientRect(); return b.width > 0 && (b.right > window.innerWidth + 1 || b.left < -1); })
    .map((n) => (n.textContent || n.getAttribute('aria-label') || n.id || n.tagName).trim().slice(0, 30));
  for (const t of H.TABS) {
    if (document.getElementById('tab-' + t.id).hidden) continue;
    H.UI.selectTab(t.id); H.rt.structureDirty = true; H.UI.update(true);
    const panel = document.getElementById('panel-' + t.id);
    out.push({ tab: t.id, view: t.id, wide: wide(), stick: sticking() });
    for (const b of [...panel.querySelectorAll('.subtabs button')].map((x) => x.dataset.id)) {
      const btn = panel.querySelector(`.subtabs button[data-id="${b}"]`);
      if (!btn) continue;
      btn.click(); H.UI.update(true);
      out.push({ tab: t.id, view: `${t.id}:${b}`, wide: wide(), stick: sticking() });
    }
  }
  return { state, rows: out };
}

(async () => {
  const c = new Checker('Interface at several screen sizes: every tab and sub-tab');
  const errors = [];
  const browser = await playwright.chromium.launch();
  const watch = (page) => {
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource: the server responded with a status of 4\d\d/.test(m.text())) errors.push(m.text()); });
  };
  /** Sweeps both stages in the open page and checks every view at this size. */
  const run = async (where, size, page) => {
    const swept = [];
    for (const stage of STAGES) swept.push({ stage, ...(await page.evaluate(sweep, stage)) });
    const [mid, fun] = swept.map((x) => x.state);
    const missing = swept.flatMap(({ stage, rows }) => CORE_TABS.filter((id) => !rows.some((x) => x.tab === id)).map((id) => `${stage}: ${id}`));
    const bad = swept.flatMap(({ stage, rows }) => rows.filter((x) => !x.wide || x.stick.length).map((x) => [`${stage}: ${x.view}`, x.wide, x.stick]));
    const views = swept.reduce((n, x) => n + x.rows.length, 0);
    c.check(`${where}, ${size[2]} (${size[0]} px): ${views} views of every tab and sub-tab, on Level 4 and in Level FUN; none scroll sideways or stick out`,
      mid.level === 4 && !mid.exitFound && fun.level === 6 && fun.exitFound && fun.canNoclip && !missing.length && !bad.length, { states: [mid, fun], missing, bad });
  };

  // From disk.
  for (const size of SIZES) {
    const page = await browser.newPage({ viewport: { width: size[0], height: size[1] } });
    watch(page);
    await page.goto(fileUrl(''));
    await page.waitForTimeout(250);
    await page.evaluate(() => { HUM.rt.saveBlocked = true; });
    await run('Opened from disk', size, page);
    await page.close();
  }

  // Served by the game server, signed in, when this build has accounts.
  if (has('auth.js')) {
    const s = await startServer({});
    for (const size of SIZES) {
      const ctx = await browser.newContext({ viewport: { width: size[0], height: size[1] } });
      const page = await ctx.newPage();
      watch(page);
      await page.goto(s.url + '/#debug');
      await page.waitForFunction(() => window.HUM && (!HUM.Exp.ask('account:service') || HUM.Exp.ask('account:service').state().status !== 'checking'));
      await page.evaluate(async (n) => {
        HUM.UI.closeModal();
        const svc = HUM.Exp.ask('account:service');
        if (svc) await svc.register(`Viewer${n}`, 'pale light in every room');
        await new Promise((res) => setTimeout(res, 400));
        HUM.UI.closeModal();
        HUM.rt.saveBlocked = true;
      }, size[0]);
      await run('Served and signed in', size, page);
      await ctx.close();
    }
    await s.stop();
  } else console.log('  (served pages not checked: EXP-ACCOUNT-AUTH is not in this build)');

  await browser.close();
  c.finish(errors);
})();
