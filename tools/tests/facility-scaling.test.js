// EXP-FACILITY-SALVAGE-SCALING: the salvage-first Facilities shop, purchase previews, locked facilities and price curves.
const { open, Checker } = require('./harness');
const ID = 'EXP-FACILITY-SALVAGE-SCALING';
const CURVES = { cart: 1.12, bench: 1.13, vat: 1.14, foundry: 1.15, boiler: 1.16, switchboard: 1.165, fold: 1.17 };

(async () => {
  const c = new Checker('EXP-FACILITY-SALVAGE-SCALING: salvage-first Facilities shop');
  const g = await open('');
  const { ev, page } = g;
  c.check('the experiment is on by default', await ev((id) => HUM.Exp.on(id), ID));

  // ------------------------------------------------------------- the first purchase and the row
  const first = await ev(() => {
    const H = HUM, r = H.S.run;
    r.salvage = 15;
    H.setBuyMode(1);
    const D0 = H.derive();
    H.UI.selectTab('facilities'); H.rt.structureDirty = true; H.UI.update(true);
    const row = () => document.querySelector('#panel-facilities [data-group="salvage"] .row');
    const before = { count: row().querySelector('.count').textContent, gain: row().querySelector('.fs-gain').textContent, cost: row().querySelector('[data-action="buy-fac"] .sub').textContent };
    const ok = H.buyFacility('cart');
    H.UI.update();
    const D1 = H.derive();
    const after = { count: row().querySelector('.count').textContent, gain: row().querySelector('.fs-gain').textContent, cost: row().querySelector('[data-action="buy-fac"] .sub').textContent };
    return { ok, gainedPerSec: D1.facSalvage - D0.facSalvage, facMult: D1.facMult, manual: [D0.manualSalvage, D1.manualSalvage], crew: [D0.crewSalvage, D1.crewSalvage], before, after, salvage: r.salvage };
  });
  c.check('the first Salvage Cart adds its documented 0.2 salvage per second (× the facility multiplier, 1 at the start)', first.ok && Math.abs(first.gainedPerSec - 0.2 * first.facMult) < 1e-12 && first.facMult === 1, first);
  c.check('before buying, the row shows ownership, the gain of the next unit with its unit, the totals after it, and the price',
    first.before.count === '×0' && /^Buy 1: \+0\.20 salvage\/s → carts 0\.20\/s, all passive salvage 0\.20\/s/.test(first.before.gain) && /12% more/.test(first.before.gain) && first.before.cost === '15 salvage', first.before);
  c.check('right after buying, the count, the preview and the next price update', first.after.count === '×1' && /→ carts 0\.40\/s/.test(first.after.gain) && first.after.cost === '17 salvage' && first.salvage === 0, first.after);
  c.check('a facility does not change crew output or what a survey by hand recovers', first.manual[0] === first.manual[1] && first.crew[0] === first.crew[1], first);

  // ------------------------------------------------------------- prices
  const prices = await ev((CURVES) => {
    const H = HUM;
    H.replaceState(H.sanitizeState({ v: 1 })); H.rt.saveBlocked = true;
    const r = H.S.run;
    H.setBuyMode(1);
    r.salvage = 1e9;
    const paid = [];
    for (let k = 0; k < 12; k++) { const s0 = r.salvage; H.buyFacility('cart'); paid.push(s0 - r.salvage); }
    const expected = paid.map((_, k) => Math.ceil(15 * Math.pow(CURVES.cart, k)));
    const curves = Object.fromEntries(H.FACILITIES.map((f) => [f.id, H.facPrice(f).growth]));
    // Accuracy at high ownership: the closed form against a unit-by-unit sum.
    const acc = [];
    for (const [id, owned, n] of [['cart', 800, 25], ['bench', 400, 100], ['fold', 1200, 10], ['beacon', 300, 50]]) {
      const f = H.FAC[id], p = H.facPrice(f);
      let sum = 0;
      for (let i = 0; i < n; i++) sum += p.base * Math.pow(p.growth, owned + i);
      const v = H.facilityCost(f, owned, n);
      acc.push({ id, rel: Math.abs(v - sum) / sum, finite: Number.isFinite(v) });
    }
    // The MAX quantity is the largest affordable one.
    const maxOk = [];
    for (const budget of [15, 100, 12345, 9.9e6, 3.3e12]) {
      for (const owned of [0, 37, 250]) {
        const f = H.FAC.vat, n = H.maxAffordable(f, owned, budget);
        maxOk.push((n === 0 || Math.ceil(H.facilityCost(f, owned, n)) <= budget) && Math.ceil(H.facilityCost(f, owned, n + 1)) > budget);
      }
    }
    // Ownership far beyond any budget: the price is shown as such and cannot be bought.
    r.facilities.cart = 7000; r.salvage = 1e300;   // 15 × 1.12^7000 is beyond the largest number
    const huge = H.buyQuote(H.FAC.cart);
    H.UI.selectTab('facilities'); H.rt.structureDirty = true; H.UI.update(true);
    const hugeText = document.querySelector('#panel-facilities [data-group="salvage"] [data-action="buy-fac"] .sub').textContent;
    return { paid, expected, curves, acc, maxOk, huge: { ok: huge.ok, finite: Number.isFinite(huge.cost) }, hugeText, bought: H.buyFacility('cart') };
  }, CURVES);
  c.check('each cart costs 15 × 1.12^owned, rounded up', JSON.stringify(prices.paid) === JSON.stringify(prices.expected), prices);
  c.check('every salvage machine has its own price curve; support equipment keeps its original one',
    Object.entries(CURVES).every(([id, gr]) => prices.curves[id] === gr) && prices.curves.condenser === 1.16 && prices.curves.beacon === 1.18 && prices.curves.dampener === 1.19 && prices.curves.array === 1.2, prices.curves);
  c.check('prices stay accurate at high ownership (closed form equals the unit-by-unit sum)', prices.acc.every((a) => a.finite && a.rel < 1e-9), prices.acc);
  c.check('the MAX quantity is always the largest affordable one', prices.maxOk.every(Boolean), prices.maxOk);
  c.check('a price beyond any budget says so and cannot be bought', !prices.huge.ok && !prices.huge.finite && prices.hugeText === 'beyond any budget' && prices.bought === false, prices);

  // ------------------------------------------------------------- different facilities, different effects; layout; locked list
  const layout = await ev(() => {
    const H = HUM;
    H.replaceState(H.sanitizeState({ v: 1 })); H.rt.saveBlocked = true;
    const r = H.S.run;
    Object.assign(r, { level: 2, rooms: 100, salvage: 1e7 });
    r.flags.water = true;
    H.setBuyMode(1);
    const per = {};
    for (const id of ['cart', 'bench', 'vat', 'foundry']) {
      if (id === 'bench') for (let i = 0; i < 3; i++) H.buyFacility('cart');
      const D0 = H.derive(); H.buyFacility(id); const D1 = H.derive();
      per[id] = (D1.facSalvage - D0.facSalvage) / D1.facMult;   // output of one unit before multipliers
    }
    H.UI.selectTab('facilities'); H.rt.structureDirty = true; H.UI.update(true);
    const p = document.getElementById('panel-facilities');
    const ids = (sel) => [...p.querySelectorAll(`[data-group="${sel}"] [data-action="buy-fac"]`)].map((b) => b.dataset.id);
    const locked = [...p.querySelectorAll('[data-group="locked"] li')].map((li) => [li.dataset.id, li.querySelector('.fs-what').textContent, li.querySelector('.fs-req').textContent]);
    return { per, salvageRows: ids('salvage'), supportRows: ids('support'), locked, sums: [...p.querySelectorAll('.fs-sum')].map((n) => n.textContent),
      titles: [...p.querySelectorAll('.fs-group .section-title')].map((n) => n.textContent) };
  });
  c.check('each machine adds its own documented output (cart 0.2, bench 1.2, vat 7, foundry 40 salvage/s before multipliers)',
    Math.abs(layout.per.cart - 0.2) < 1e-9 && Math.abs(layout.per.bench - 1.2) < 1e-9 && Math.abs(layout.per.vat - 7) < 1e-9 && Math.abs(layout.per.foundry - 40) < 1e-9, layout.per);
  c.check('salvage machines come first, then support equipment, then every locked facility',
    layout.titles[0] === 'Salvage machines' && layout.titles[1] === 'Support equipment' && /^Locked \(4\)$/.test(layout.titles[2]) &&
    layout.salvageRows.join() === 'cart,bench,vat,foundry' && layout.supportRows.join() === 'condenser,beacon,dampener', layout);
  const lk = Object.fromEntries(layout.locked.map(([id, what, req]) => [id, { what, req }]));
  c.check('a locked salvage machine shows its salvage per second, its price and what unlocks it, with progress',
    /^\+[\d.,]+[KM]? salvage\/s each at your current multipliers · first one 190K salvage, then \+16% per unit$/.test(lk.boiler.what) && lk.boiler.req === 'Unlocks: Own 5 Ceiling Tile Foundries (you have 1).', lk.boiler);
  c.check('locked machines on deeper levels name the level', lk.switchboard.req === 'Unlocks: Reach Level 4: The Night Office.' && lk.fold.req === 'Unlocks: Reach Level 5: The Long Hallway.' && /Echoes\/s each/.test(lk.array.what), lk);
  c.check('no unlock requirement mentions crew or wanderers', layout.locked.every(([, , req]) => !/crew|wanderer/i.test(req)), layout.locked);
  c.check('the section summaries give totals in explicit units', /^Machines make [\d.,]+[KM]? salvage\/s, \d+% of your passive salvage\./.test(layout.sums[0]) && /^Now: beacons|^None built yet\.|^Now: condensers|^Now: dampeners/.test(layout.sums[1]), layout.sums);

  const support = await ev(() => {
    const H = HUM;
    H.buyFacility('beacon'); H.buyFacility('condenser'); H.buyFacility('dampener');
    H.UI.update(true);
    const g = (id) => document.querySelector(`#panel-facilities [data-action="buy-fac"][data-id="${id}"]`).closest('.row').querySelector('.fs-gain').textContent;
    return { beacon: g('beacon'), condenser: g('condenser'), dampener: g('dampener') };
  });
  c.check('support rows state their own units: surveys (with rooms and salvage), water, noise absorbed',
    /^Buy 1: \+0\.08 surveys\/s \(\+[\d.]+ rooms\/s, \+[\d.]+ salvage\/s\) → beacons 0\.16 surveys\/s/.test(support.beacon) && /^Buy 1: \+[\d.]+ water\/s → condensers/.test(support.condenser) && /^Buy 1: absorbs \+0\.12 noise → dampeners 0\.24/.test(support.dampener), support);

  // ------------------------------------------------------------- unaffordable, persistence, noclip
  const blocked = await ev(() => {
    const H = HUM; H.S.run.salvage = 0; H.UI.update(true);
    const btn = document.querySelector('#panel-facilities [data-action="buy-fac"][data-id="vat"]');
    return { buy: H.buyFacility('vat'), disabled: btn.disabled };
  });
  c.check('an unaffordable purchase is refused and its button is disabled', blocked.buy === false && blocked.disabled, blocked);

  const facs = () => Object.keys(HUM.S.run.facilities).sort().map((k) => `${k}=${HUM.S.run.facilities[k]}`).join();
  const saved = await ev((f) => { const H = HUM; H.S.run.salvage = 1e6; H.rt.saveBlocked = false; H.save(); return { fac: (0, eval)(f)(), next: H.buyQuote(H.FAC.vat).cost }; }, `(${facs})`);
  await g.reload();
  const loaded = await ev((f) => ({ fac: (0, eval)(f)(), next: HUM.buyQuote(HUM.FAC.vat).cost }), `(${facs})`);
  c.check('ownership and the next prices are the same after a reload', saved.fac === loaded.fac && saved.next === loaded.next, { saved, loaded });

  const nc = await ev(() => {
    const H = HUM, r = H.S.run;
    H.rt.saveBlocked = true;
    r.level = 3; r.stats.salvage = 1e9;
    H.noclip();
    return { fac: JSON.stringify(H.S.run.facilities), price: H.buyQuote(H.FAC.cart).cost, rows: (H.UI.update(true), document.querySelectorAll('#panel-facilities [data-action="buy-fac"]').length) };
  });
  c.check('a noclip resets facilities and their prices to the first unit, as before', nc.fac === '{}' && nc.price === 15 && nc.rows === 1, nc);

  // ------------------------------------------------------------- developer infinite salvage
  await ev(() => { localStorage.setItem('the-hum.dev', JSON.stringify({ enabled: true, infinite: { salvage: true } })); });
  await g.reload();
  const inf = await ev(() => {
    const H = HUM; H.rt.saveBlocked = true;
    H.replaceState(H.sanitizeState({ v: 1 })); H.rt.saveBlocked = true;
    H.S.run.salvage = 0; H.setBuyMode(10);
    const ok = H.buyFacility('cart');
    return { ok, carts: H.S.run.facilities.cart, salvage: H.S.run.salvage, next: H.buyQuote(H.FAC.cart).cost };
  });
  c.check('developer infinite salvage buys facilities without spending, at the normal rising prices', inf.ok && inf.carts === 10 && inf.salvage === 0 && inf.next > 15 * Math.pow(1.12, 10) * 10, inf);
  await ev(() => { localStorage.removeItem('the-hum.dev'); });

  // ------------------------------------------------------------- switching it off
  const off = await ev((id) => {
    const H = HUM;
    H.replaceState(H.sanitizeState({ v: 1, run: { facilities: { cart: 10 } } })); H.rt.saveBlocked = true;
    const onPrice = H.facilityCost(H.FAC.cart, 10, 1);
    H.Exp.set(id, false);
    H.UI.selectTab('facilities'); H.rt.structureDirty = true; H.UI.update(true);
    const p = document.getElementById('panel-facilities');
    const res = { onPrice, offPrice: H.facilityCost(H.FAC.cart, 10, 1), groups: p.querySelectorAll('.fs-group').length, gain: p.querySelectorAll('.fs-gain').length,
      lockedRows: p.querySelectorAll('.row.locked').length, carts: H.S.run.facilities.cart };
    H.Exp.set(id, true);
    res.again = H.facilityCost(H.FAC.cart, 10, 1);
    H.Exp.reset();
    return res;
  }, ID);
  c.check('switched off, prices return to the original curve and the tab to its original layout; nothing owned changes',
    Math.abs(off.offPrice - 15 * Math.pow(1.15, 10)) < 1e-9 && Math.abs(off.onPrice - 15 * Math.pow(1.12, 10)) < 1e-9 && off.groups === 0 && off.gain === 0 && off.lockedRows === 1 && off.carts === 10 && off.again === off.onPrice, off);

  c.finish(g.errors);
  await g.browser.close();
  void page;
})();
