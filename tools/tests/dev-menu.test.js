// EXP-DEV-MENU: opt-in developer tools.
const { open, Checker } = require('./harness');

const ID = 'EXP-DEV-MENU';
(async () => {
  const c = new Checker(`${ID}: developer menu`);
  const g = await open(`?exp=none,${ID}`);
  const { ev, page } = g;
  const btn = (text) => page.click(`#panel-dev button:text-is("${text}")`);
  const confirmIfAsked = async () => { const m = await page.$('.modal button:has-text("Change this save")'); if (m) { await m.click(); await page.waitForTimeout(50); return true; } return false; };

  // Hidden until you opt in.
  const hidden = await ev(() => ({ tab: !document.getElementById('tab-dev').hidden, badge: !document.querySelector('.dev-badge').hidden, key: (() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: '9' })); return HUM.rt.tab; })() }));
  c.check('the developer menu is hidden by default and key 9 does nothing', !hidden.tab && !hidden.badge && hidden.key !== 'dev', hidden);

  await ev(() => { HUM.UI.selectTab('settings'); });
  await page.click('#set-dev');
  await page.waitForTimeout(100);
  const opened = await ev(() => ({ tab: !document.getElementById('tab-dev').hidden, badge: !document.querySelector('.dev-badge').hidden, stored: JSON.parse(localStorage.getItem('the-hum.dev') || '{}') }));
  c.check('Settings → Developer tools opens a Dev tab and shows a DEV badge', opened.tab && opened.badge && opened.stored.enabled === true, opened);
  await ev(() => document.activeElement && document.activeElement.blur());   // shortcuts are ignored while a form field has focus
  await page.keyboard.press('9');
  await page.waitForTimeout(100);
  c.check('key 9 opens the Dev tab', await ev(() => HUM.rt.tab === 'dev'));

  // Resource injection, with the one-time confirmation.
  await ev(() => { HUM.rt.saveBlocked = true; HUM.S.run.salvage = 0; });
  await page.fill('#panel-dev input[aria-label="Amount"]', '1000');
  await btn('+ Salvage');
  await page.waitForTimeout(50);
  const asked = await confirmIfAsked();
  const injected = await ev(() => ({ salvage: HUM.S.run.salvage, stats: HUM.S.run.stats.salvage, mark: HUM.S.ext.dev }));
  c.check('the first change asks before touching the save', asked === true, asked);
  c.check('adding salvage adds exactly the amount and does not count toward Déjà Vu', injected.salvage >= 1000 && injected.salvage < 1001 && injected.stats < 1, injected);
  c.check('the save is marked as changed with developer tools', injected.mark && injected.mark.actions === 1 && injected.mark.kinds.includes('add salvage'), injected.mark);
  await btn('− Salvage');
  await page.waitForTimeout(50);
  const removed = await ev(() => ({ salvage: HUM.S.run.salvage, modal: !!document.querySelector('.modal') }));
  c.check('later changes do not ask again, and removing never goes below zero', !removed.modal && removed.salvage < 1, removed);

  // Infinite salvage.
  await ev(() => { HUM.S.run.salvage = 0; HUM.S.run.rooms = 10; });
  await btn('Salvage: normal');
  await page.waitForTimeout(50);
  const inf = await ev(() => {
    const H = HUM, r = H.S.run;
    const before = { carts: r.facilities.cart || 0, salvage: r.salvage };
    H.setBuyMode(1);
    const quote = H.buyQuote(H.FAC.cart);
    const ok = H.buyFacility('cart');
    const next = H.buyQuote(H.FAC.cart);
    const up = H.buyUpgrade('flashlight');
    const again = H.buyUpgrade('flashlight');
    H.UI.update(true);
    return { ok, up, again, before, carts: r.facilities.cart, salvage: r.salvage, quote: quote.cost, next: next.cost, flashlight: r.upgrades.flashlight,
      marker: !document.querySelector('.res-salvage .dev-inf').hidden, mark: H.S.ext.dev.kinds };
  });
  c.check('with infinite salvage, purchases go through without spending', inf.ok && inf.up && inf.carts === inf.before.carts + 1 && inf.salvage === 0, inf);
  c.check('prices still show and rise, and one-off upgrades cannot be bought twice', inf.quote === 15 && inf.next > inf.quote && inf.flashlight === true && inf.again === false, inf);
  c.check('infinite mode is visible on the resource and recorded in the save mark', inf.marker && inf.mark.includes('infinite salvage'), inf);
  await btn('Salvage: infinite');
  await page.waitForTimeout(50);
  const normal = await ev(() => { HUM.S.run.salvage = 5; const ok = HUM.buyFacility('cart'); return { ok, salvage: HUM.S.run.salvage, marker: !document.querySelector('.res-salvage .dev-inf').hidden }; });
  c.check('switching infinite off restores the normal rules and takes nothing away', normal.ok === false && normal.salvage === 5 && !normal.marker, normal);

  // Levels and rooms.
  await page.selectOption('#panel-dev select[aria-label="Level"]', '3');
  await btn('Go to level');
  await page.waitForTimeout(50);
  const lvl = await ev(() => ({ level: HUM.S.run.level, max: HUM.S.life.maxLevel, levelRooms: HUM.S.run.levelRooms }));
  c.check('Go to level uses the game’s level change', lvl.level === 3 && lvl.max >= 3 && lvl.levelRooms === 0, lvl);
  await page.fill('#panel-dev input[aria-label="Rooms"]', '250');
  await btn('Map rooms');
  await page.waitForTimeout(50);
  c.check('Map rooms adds rooms toward the next level', await ev(() => HUM.S.run.levelRooms === 250));
  await btn('Find the exit');
  await page.waitForTimeout(50);
  c.check('Find the exit reaches Level 5 and opens the exit', await ev(() => HUM.S.run.level === 5 && HUM.S.run.exitFound === true));

  // Research, requisitions, machines, crew.
  const before = await ev(() => ({ echoes: HUM.S.echoes, research: Object.keys(HUM.S.research).length }));
  await page.selectOption('#panel-dev select[aria-label="Research"]', 'pattern');
  await btn('Complete');
  await page.waitForTimeout(50);
  const rs = await ev(() => ({ pattern: HUM.S.research.pattern === true, echoes: HUM.S.echoes }));
  c.check('completing research sets it without spending Echoes', rs.pattern && rs.echoes === before.echoes, { before, rs });
  await page.selectOption('#panel-dev select[aria-label="Machine"]', 'vat');
  await page.fill('#panel-dev input[aria-label="Count"]', '7');
  const vat0 = await ev(() => ({ n: HUM.S.run.facilities.vat || 0, salvage: HUM.S.run.salvage }));
  await btn('Add machines');
  await page.waitForTimeout(50);
  const vat1 = await ev(() => ({ n: HUM.S.run.facilities.vat || 0, salvage: HUM.S.run.salvage }));
  c.check('adding machines adds that many and changes nothing else', vat1.n === vat0.n + 7 && Math.abs(vat1.salvage - vat0.salvage) < 50, { vat0, vat1 });
  await page.fill('#panel-dev input[aria-label="Wanderers"]', '4');
  await btn('Add wanderers');
  await page.waitForTimeout(50);
  c.check('adding wanderers brings them idle, with the radio', await ev(() => HUM.S.run.crew.total === 4 && HUM.S.run.upgrades.radio === true));
  const free = await ev(() => {
    const u = HUM.UPGRADES.find((x) => HUM.upgradeAvailable(x) && x.cost.salvage > 1000);
    return u ? u.id : null;
  });
  if (free) {
    await page.selectOption('#panel-dev select[aria-label="Requisition"]', free);
    const s0 = await ev(() => HUM.S.run.salvage);
    await btn('Install for free');
    await page.waitForTimeout(50);
    const fr = await ev((id) => ({ owned: HUM.S.run.upgrades[id] === true, salvage: HUM.S.run.salvage }), free);
    c.check('Install for free uses the normal purchase without charging', fr.owned && Math.abs(fr.salvage - s0) < 50, { free, s0, fr });
  } else c.check('Install for free has something to install', false, 'no candidate');

  // Meters, events and time.
  await page.fill('#panel-dev input[aria-label="Attention"]', '80');
  await btn('Set attention');
  await page.fill('#panel-dev input[aria-label="Sanity"]', '33');
  await btn('Set sanity');
  await page.waitForTimeout(50);
  c.check('attention and sanity can be set', await ev(() => Math.abs(HUM.S.run.attention - 80) < 1 && Math.abs(HUM.S.run.sanity - 33) < 1));
  await btn('Schedule an incident');
  await page.waitForTimeout(50);
  const inc = await ev(() => !!HUM.S.run.pendingIncident);
  await btn('Clear incident and blackout');
  await page.waitForTimeout(50);
  c.check('an incident can be scheduled and cleared', inc && await ev(() => HUM.S.run.pendingIncident === null), inc);
  const t0 = await ev(() => HUM.S.time);
  await page.fill('#panel-dev input[aria-label="Minutes away"]', '30');
  await btn('Simulate time away');
  await page.waitForTimeout(100);
  const away = await ev((t0) => ({ dt: HUM.S.time - t0, report: !!document.querySelector('.modal') }), t0);
  c.check('time away runs the offline simulation and shows its report', away.dt >= 1800 && away.dt < 1810 && away.report, away);
  await ev(() => HUM.UI.closeModal && HUM.UI.closeModal());

  // Production view and experiment switches.
  const prod = await ev(() => { HUM.UI.selectTab('dev'); HUM.UI.update(true); return document.querySelector('#panel-dev .dev-prod').textContent; });
  c.check('production figures are shown live', /Salvage\/s/.test(prod) && /Facility multiplier/.test(prod), prod.slice(0, 120));
  const sw = await ev(() => {
    const rows = [...document.querySelectorAll('#panel-dev .dev-exp')];
    const row = rows.find((r) => /EXP-CLICK-POWER/.test(r.textContent));
    row.querySelector('button').click();
    const on = HUM.Exp.on('EXP-CLICK-POWER');
    const stored = JSON.parse(localStorage.getItem('the-hum.experiments') || '{}');
    [...document.querySelectorAll('#panel-dev button')].find((b) => /Reset all experiments/.test(b.textContent)).click();
    return { on, stored, after: HUM.Exp.on('EXP-CLICK-POWER'), kept: localStorage.getItem('the-hum.experiments') };
  });
  c.check('the experiment switches turn experiments on and off and can be reset', sw.on === true && sw.stored['EXP-CLICK-POWER'] === true && sw.after === true && sw.kept === null, sw);

  // Developer settings stay out of the save.
  const saved = await ev(() => { const st = JSON.parse(JSON.stringify(HUM.S)); return { dev: st.ext.dev, hasInfinite: JSON.stringify(st).includes('"infinite"'), devKey: !!localStorage.getItem('the-hum.dev') }; });
  c.check('developer settings live in this browser, never in the save; the save only carries the mark', saved.devKey && !saved.hasInfinite && saved.dev && saved.dev.actions > 5, saved);

  // Turning the tools off.
  await ev(() => { HUM.UI.selectTab('dev'); HUM.rt.structureDirty = true; HUM.UI.update(true); });
  await btn('Salvage: normal');
  await btn('Turn off developer tools');
  await page.waitForTimeout(100);
  const off = await ev(() => ({ tab: HUM.rt.tab, hidden: document.getElementById('tab-dev').hidden, badge: document.querySelector('.dev-badge').hidden, buy: (() => { HUM.S.run.salvage = 0; return HUM.buyFacility('cart'); })(), stored: JSON.parse(localStorage.getItem('the-hum.dev')) }));
  c.check('turning the tools off hides them and ends infinite resources', off.tab !== 'dev' && off.hidden && off.badge && off.buy === false && off.stored.enabled === false && !off.stored.infinite.salvage, off);

  // With the experiment switched off, nothing of it remains in play, even with the tools and infinite salvage on.
  await ev(() => { HUM.UI.selectTab('settings'); });
  await page.click('#set-dev');
  await ev(() => { HUM.UI.selectTab('dev'); HUM.rt.structureDirty = true; HUM.UI.update(true); });
  await btn('Salvage: normal');
  await page.waitForTimeout(50);
  const gone = await ev(() => {
    const H = HUM;
    H.S.run.salvage = 0;
    const withTools = H.buyFacility('cart');
    H.Exp.session['EXP-DEV-MENU'] = false;
    H.UI.selectTab('settings'); H.rt.structureDirty = true; H.UI.update(true);
    const res = { withTools, section: !!document.getElementById('set-dev'), tab: !document.getElementById('tab-dev').hidden,
      badge: !document.querySelector('.dev-badge').hidden, marker: !document.querySelector('.res-salvage .dev-inf').hidden, buy: H.buyFacility('cart') };
    H.Exp.session['EXP-DEV-MENU'] = true;
    return res;
  });
  c.check('switched off, the menu, its Settings entry and infinite resources are gone', gone.withTools === true && !gone.section && !gone.tab && !gone.badge && !gone.marker && gone.buy === false, gone);

  c.finish(g.errors);
  await g.browser.close();
})();
