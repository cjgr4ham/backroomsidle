// Interface regression at several screen sizes: every tab and every sub-tab present in this build (they are
// found at run time, so the suite still works when an experiment is reverted), served by the game server and
// signed in, and opened from disk. Nothing may scroll sideways, no control may stick out of the window, and
// nothing may log an error.
const { Checker, url: fileUrl } = require('./harness');
const { startServer, has } = require('./server-harness');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node22/lib/node_modules/playwright'); }

const SIZES = [[360, 740, 'phone'], [768, 1024, 'tablet'], [1024, 700, 'small laptop'], [1366, 860, 'desktop']];

/** Opens every tab and sub-tab and reports any that overflow sideways. */
function sweep() {
  const H = HUM, out = [];
  // A developed save, so the later tabs and panels have content.
  const r = H.S.run;
  Object.assign(r, { level: 4, rooms: 60000, salvage: 5e7, aw: 900 });
  r.flags.water = true; r.flags.expedition = true;
  r.facilities = { cart: 40, bench: 30, condenser: 10, beacon: 12, dampener: 6, vat: 20, foundry: 12, boiler: 6, array: 4, switchboard: 3 };
  r.upgrades.radio = true; r.crew.total = 12; r.crew.jobs.scavenge = 5; r.crew.jobs.chart = 3;
  H.S.iteration = 4; H.S.dv = 120; H.S.dvTotal = 900; H.S.life.noclips = 3; H.S.echoes = 60; H.S.seen.echoes = true;
  for (const id of ['upgrades', 'crew', 'expeditions', 'research', 'noclip']) H.S.seen['tab_' + id] = true;
  const wide = () => document.documentElement.scrollWidth <= window.innerWidth + 1;
  const sticking = () => [...document.querySelectorAll('#tabpanels button, #tabpanels input, #tabpanels select, .topbar button')]
    .filter((n) => n.offsetParent !== null).filter((n) => { const b = n.getBoundingClientRect(); return b.width > 0 && (b.right > window.innerWidth + 1 || b.left < -1); })
    .map((n) => (n.textContent || n.getAttribute('aria-label') || n.id || n.tagName).trim().slice(0, 30));
  for (const t of H.TABS) {
    if (document.getElementById('tab-' + t.id).hidden) continue;
    H.UI.selectTab(t.id); H.rt.structureDirty = true; H.UI.update(true);
    const panel = document.getElementById('panel-' + t.id);
    out.push([t.id, wide(), sticking()]);
    for (const b of [...panel.querySelectorAll('.subtabs button')].map((x) => x.dataset.id)) {
      const btn = panel.querySelector(`.subtabs button[data-id="${b}"]`);
      if (!btn) continue;
      btn.click(); H.UI.update(true);
      out.push([`${t.id}:${b}`, wide(), sticking()]);
    }
  }
  return out;
}

(async () => {
  const c = new Checker('Interface at several screen sizes: every tab and sub-tab');
  const errors = [];
  const browser = await playwright.chromium.launch();
  const watch = (page) => {
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource: the server responded with a status of 4\d\d/.test(m.text())) errors.push(m.text()); });
  };
  const report = (where, size, rows) => {
    const bad = rows.filter(([, ok, stick]) => !ok || stick.length);
    c.check(`${where}, ${size[2]} (${size[0]} px): ${rows.length} tabs and sub-tabs, none scroll sideways or stick out`, rows.length >= 8 && !bad.length, bad);
  };

  // From disk.
  for (const size of SIZES) {
    const page = await browser.newPage({ viewport: { width: size[0], height: size[1] } });
    watch(page);
    await page.goto(fileUrl(''));
    await page.waitForTimeout(250);
    await page.evaluate(() => { HUM.rt.saveBlocked = true; });
    report('Opened from disk', size, await page.evaluate(sweep));
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
      report('Served and signed in', size, await page.evaluate(sweep));
      await ctx.close();
    }
    await s.stop();
  } else console.log('  (served pages not checked: EXP-ACCOUNT-AUTH is not in this build)');

  await browser.close();
  c.finish(errors);
})();
