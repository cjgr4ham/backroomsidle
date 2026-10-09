// EXP-FACILITY-TIERS: tier upgrades are installed from their facility's row.
const { open, Checker } = require('./harness');

const ID = 'EXP-FACILITY-TIERS';

(async () => {
  const c = new Checker(`${ID}: facility tiers on facility rows`);
  const g = await open(`?exp=none,${ID}`);
  const { ev, page } = g;

  await ev(() => {
    const H = HUM; H.rt.saveBlocked = true;
    H.replaceState(H.sanitizeState({ v: 1 }));
    const r = H.S.run;
    r.rooms = 100; r.salvage = 179; r.facilities = { cart: 8 };
    H.S.seen.tab_upgrades = true;
    H.UI.selectTab('facilities');
    H.rt.structureDirty = true; H.UI.update(true);
  });
  await page.waitForTimeout(150);
  const locked = await ev(() => {
    const row = document.querySelector('#panel-facilities .rows .row');
    const line = row.querySelector('.tier-line');
    return { text: line && line.textContent, btnHidden: line && line.querySelector('.tier-btn').hidden, home: HUM.upgradeHome(HUM.UPG.tier_cart_0) };
  });
  c.check('tier upgrades belong to their facility, not the Upgrades tab', locked.home === 'facilities', locked);
  c.check('a locked tier says what it needs', /Tiers 0\/3/.test(locked.text) && /Next: Oiled Wheel, ×2 output, at 10 owned \(you have 8\)/.test(locked.text) && locked.btnHidden === true, locked);

  const ready = await ev(() => {
    const H = HUM, r = H.S.run;
    r.facilities.cart = 10;
    H.UI.update();
    const line = document.querySelector('#panel-facilities .rows .row .tier-line');
    const btn = line.querySelector('.tier-btn');
    H.UI.selectTab('upgrades'); H.rt.structureDirty = true; H.UI.update(true);
    const inUpgrades = [...document.querySelectorAll('#panel-upgrades .slip [data-action="buy-upg"]')].some((b) => b.dataset.id.startsWith('tier_'));
    H.UI.selectTab('facilities'); H.UI.update(true);
    return { text: line.textContent, hidden: btn.hidden, disabled: btn.disabled, id: btn.dataset.id, inUpgrades, dot: !document.querySelector('#tab-facilities .dot').hidden };
  });
  c.check('at 10 owned the row offers the tier with its price', !ready.hidden && ready.id === 'tier_cart_0' && /180 salvage/.test(ready.text), ready);
  c.check('it cannot be installed without the salvage', ready.disabled === true, ready);
  c.check('the Upgrades tab no longer lists tiers', ready.inUpgrades === false, ready);

  await ev(() => { HUM.S.run.salvage = 1000; HUM.UI.update(); });
  const dot = await ev(() => { HUM.UI.selectTab('upgrades'); HUM.UI.update(true); const d = !document.querySelector('#tab-facilities .dot').hidden; HUM.UI.selectTab('facilities'); HUM.UI.update(true); return d; });
  c.check('the Facilities tab is marked when a tier is affordable', dot === true, dot);
  // Hold exactly the price, and every achievement already earned so their +1% bonuses cannot move the output.
  const each0 = await ev(() => { for (const a of HUM.ACHIEVEMENTS) HUM.S.achievements[a.id] = true; HUM.S.run.salvage = 180; HUM.UI.update(); return HUM.derive().fac.cart.each; });
  await page.click('#panel-facilities .rows .row .tier-btn');
  await page.waitForTimeout(100);
  const after = await ev(() => ({ owned: HUM.S.run.upgrades.tier_cart_0 === true, salvage: HUM.S.run.salvage, each: HUM.derive().fac.cart.each,
    text: document.querySelector('#panel-facilities .rows .row .tier-line').textContent }));
  // What is left is only the production of the moment since the click.
  c.check('installing from the row charges the price and doubles the output', after.owned && after.salvage < 2 && Math.abs(after.each - 2 * each0) < 1e-9, { after, each0 });
  c.check('the row then shows the installed tier and the next one', /Tiers 1\/3 · output ×2/.test(after.text) && /Second Basket/.test(after.text), after.text);

  const done = await ev(() => {
    const H = HUM, r = H.S.run;
    r.upgrades.tier_cart_1 = true; r.upgrades.tier_cart_2 = true;
    H.UI.update();
    const line = document.querySelector('#panel-facilities .rows .row .tier-line');
    return { text: line.textContent, hidden: line.querySelector('.tier-btn').hidden };
  });
  c.check('with every tier installed the row says so', /Tiers 3\/3 · output ×8\. Every tier is installed\./.test(done.text) && done.hidden, done);

  const damp = await ev(() => {
    const H = HUM, r = H.S.run;
    r.level = 1; r.facilities.dampener = 2;
    H.rt.structureDirty = true; H.UI.update(true);
    const rows = [...document.querySelectorAll('#panel-facilities .rows .row')];
    const row = rows.find((x) => /Acoustic Dampener/.test(x.textContent));
    return row ? !!row.querySelector('.tier-line') : 'no row';
  });
  c.check('facilities without tiers show no tier line', damp === false, damp);

  const off = await ev(() => {
    const H = HUM;
    H.Exp.set('EXP-FACILITY-TIERS', false);
    H.S.run.facilities.bench = 12;
    H.rt.structureDirty = true; H.UI.update(true);
    const line = !!document.querySelector('#panel-facilities .tier-line');
    H.UI.selectTab('upgrades'); H.rt.structureDirty = true; H.UI.update(true);
    const listed = [...document.querySelectorAll('#panel-upgrades .slip [data-action="buy-upg"]')].map((b) => b.dataset.id);
    const res = { line, home: H.upgradeHome(H.UPG.tier_bench_0), listed: listed.includes('tier_bench_0') };
    H.Exp.reset();
    return res;
  });
  c.check('switched off, tiers return to the Upgrades tab and rows lose the tier line', !off.line && off.home === 'upgrades' && off.listed, off);

  c.finish(g.errors);
  await g.browser.close();
})();
