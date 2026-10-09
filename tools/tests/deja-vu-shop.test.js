// EXP-DEJA-VU-SHOP: the Déjà Vu shop, its leveled permanent upgrades, and starting bonuses applied exactly once.
const { open, Checker } = require('./harness');
const ID = 'EXP-DEJA-VU-SHOP';

(async () => {
  const c = new Checker('EXP-DEJA-VU-SHOP: permanent upgrades bought with Déjà Vu');
  const g = await open('');
  const { ev, page } = g;
  c.check('the experiment is on by default', await ev((id) => HUM.Exp.on(id), ID));

  // ------------------------------------------------------------- a first noclip, then the shop
  const first = await ev(() => {
    const H = HUM, r = H.S.run;
    H.rt.saveBlocked = true;
    Object.assign(r, { level: 3, rooms: 30000 });
    r.stats.salvage = 1e9;
    const preview = H.dvPreview();
    const ok = H.noclip();
    return { ok, preview, dv: H.S.dv, dvTotal: H.S.dvTotal, salvage: H.S.run.salvage, recovered: H.S.run.stats.salvage };
  });
  c.check('a valid noclip awards the previewed Déjà Vu once', first.ok && first.dv === first.preview && first.dvTotal === first.preview && first.preview === Math.floor(Math.pow(1e4, 0.3)), first);
  c.check('with no shop upgrades the next iteration starts empty, as before', first.salvage === 0 && first.recovered === 0, first);

  const shop = await ev(() => {
    const H = HUM;
    H.S.dv = 7;   // enough for some upgrades and not others
    H.S.seen.tab_noclip = true;
    H.rt.noclipTab = 'noclip';
    H.UI.selectTab('noclip'); H.rt.structureDirty = true; H.UI.update(true);
    const p = document.getElementById('panel-noclip');
    const out = { subs: [...p.querySelectorAll('.subtabs [data-action="noclip-subtab"]')].map((b) => b.dataset.id), memoriesInMain: !!p.querySelector('[data-action="memory"]'),
      pointer: !!p.querySelector('[data-action="noclip-subtab"][data-id="djv"].btn') };
    p.querySelector('.subtabs [data-id="djv"]').click();
    const cards = [...p.querySelectorAll('.slip.djv')];
    const card = (id) => { const n = p.querySelector(`.slip.djv[data-id="${id}"]`); return { head: n.querySelector('.slip-head').textContent, now: n.querySelector('.djv-now').textContent, next: n.querySelector('.djv-next').hidden ? null : n.querySelector('.djv-next').textContent, btn: n.querySelector('button').textContent, disabled: n.querySelector('button').disabled }; };
    out.count = cards.length;
    out.groups = [...p.querySelectorAll('.djv-shop .section-title')].map((n) => n.textContent);
    out.stash = card('stash'); out.recur = card('recur'); out.procure = card('procure'); out.muscle = card('muscle');
    out.intro = p.querySelector('.djv-intro').textContent;
    return out;
  });
  c.check('the shop is a Noclip sub-tab; the noclip view points to it instead of listing Memories', shop.subs[0] === 'noclip' && shop.subs[1] === 'djv' && !shop.memoriesInMain && shop.pointer, shop);
  c.check('it lists all 13 permanent upgrades in five groups', shop.count === 13 && shop.groups.join('|') === 'Production|Starting each iteration|Prices|Survival and travel|Automation', shop);
  c.check('it says plainly that these are permanent, unlike run purchases', /never are/.test(shop.intro) && /Permanent/.test(shop.stash.head), shop.intro);
  c.check('each card shows level and maximum, the current effect, the next effect and the next price',
    shop.stash.head.startsWith('Level 0 / 8') && shop.stash.now === 'Now: Iterations start with no salvage.' && shop.stash.next === 'Next: Every iteration starts with 250 salvage. You also get it now if you have less.' && /^Remember4 Déjà Vu$/.test(shop.stash.btn), shop.stash);
  c.check('Recurrence shows that it has no limit', shop.recur.head.startsWith('Level 0 · no limit') && /×1\.25/.test(shop.recur.next), shop.recur);
  c.check('an upgrade it cannot afford says how much more Déjà Vu it needs', shop.procure.disabled && /^Remember10 Déjà Vu · need 3 more$/.test(shop.procure.btn), shop.procure);

  // ------------------------------------------------------------- buying: rising costs, immediate effects, double clicks
  await page.click('.slip.djv[data-id="stash"] button');
  await page.waitForTimeout(30);
  const afterClick = await ev(() => {
    const api = HUM.Exp.ask('djv:api');
    return { level: api.level('stash'), dv: HUM.S.dv, salvage: HUM.S.run.salvage, recovered: HUM.S.run.stats.salvage, next: api.cost('stash'), disabled: document.querySelector('.slip.djv[data-id="stash"] button').disabled };
  });
  c.check('buying Stashed Salvage costs 4 Déjà Vu and gives its salvage at once, without counting it as recovered',
    afterClick.level === 1 && afterClick.dv === 3 && afterClick.salvage === 250 && afterClick.recovered === 0, afterClick);
  c.check('right after a purchase the card refuses clicks for a moment', afterClick.disabled, afterClick);
  const dbl = await ev(async () => {
    const H = HUM, api = H.Exp.ask('djv:api');
    H.S.dv = 1000;
    await new Promise((res) => setTimeout(res, 550));
    H.UI.update();
    const b = () => document.querySelector('.slip.djv[data-id="bargain"] button');
    const before = { level: api.level('bargain'), dv: H.S.dv };
    b().click(); b().click(); b().click();
    return { before, level: api.level('bargain'), dv: H.S.dv };
  });
  c.check('a burst of clicks buys one level only', dbl.before.level === 0 && dbl.level === 1 && dbl.dv === 1000 - 6, dbl);
  const costs = await ev(async () => {
    const H = HUM, api = H.Exp.ask('djv:api');
    const wait = () => new Promise((res) => setTimeout(res, 520));
    const paid = [];
    for (let i = 0; i < 4; i++) { await wait(); const d0 = H.S.dv; api.buy('bargain'); paid.push(d0 - H.S.dv); }
    await wait();
    const maxed = api.buy('bargain');
    H.UI.update();
    const card = document.querySelector('.slip.djv[data-id="bargain"]');
    return { paid, level: api.level('bargain'), maxed, btn: card.querySelector('button').textContent, disabled: card.querySelector('button').disabled, next: card.querySelector('.djv-next').hidden, done: card.classList.contains('done') };
  });
  c.check('each level costs more than the last (6 × 2.2^level)', JSON.stringify(costs.paid) === JSON.stringify([14, 30, 64, 141]), costs.paid);
  c.check('at its maximum an upgrade says "Max level", hides the next effect and cannot be bought', costs.level === 5 && costs.maxed === false && costs.btn === 'Max level' && costs.disabled && costs.next && costs.done, costs);
  const prices = await ev(() => ({ cart: HUM.facilityCost(HUM.FAC.cart, 0, 1), vat: HUM.facilityCost(HUM.FAC.vat, 3, 1), growthVat: HUM.facPrice(HUM.FAC.vat).growth }));
  c.check('Remembered Prices lowers facility prices at once (30% at level 5), curve unchanged', Math.abs(prices.cart - 15 * 0.7) < 1e-9 && Math.abs(prices.vat - 1400 * 0.7 * Math.pow(prices.growthVat, 3)) < 1e-6, prices);

  const friends = await ev(async () => {
    const H = HUM, api = H.Exp.ask('djv:api'), r = H.S.run;
    const wait = () => new Promise((res) => setTimeout(res, 520));
    const out = { before: api.level('friends') };
    api.buy('friends'); out.l1 = { level: api.level('friends'), crew: r.crew.total, radio: r.upgrades.radio === true, mem: H.S.memories.friends };
    await wait(); api.buy('friends'); out.l2 = { level: api.level('friends'), crew: r.crew.total };
    return out;
  });
  c.check('Old Friends level 1 is the original Memory (radio and 3 wanderers now)', friends.before === 0 && friends.l1.level === 1 && friends.l1.mem === 1 && friends.l1.crew === 3 && friends.l1.radio, friends);
  c.check('Old Friends level 2 adds two more wanderers at once', friends.l2.level === 2 && friends.l2.crew === 5, friends);

  // ------------------------------------------------------------- the next iteration: applied once, survives the reset and reloads
  const next = await ev(async () => {
    const H = HUM, api = H.Exp.ask('djv:api');
    await new Promise((res) => setTimeout(res, 520));
    api.buy('stash');   // level 2: 1,500 salvage
    const r = H.S.run;
    Object.assign(r, { level: 3, rooms: 30000 }); r.stats.salvage = 1e9;
    H.rt.saveBlocked = false;
    const ok = H.noclip();
    const s = H.S;
    return { ok, salvage: s.run.salvage, recovered: s.run.stats.salvage, crew: s.run.crew.total, radio: s.run.upgrades.radio === true,
      levels: { stash: api.level('stash'), bargain: api.level('bargain'), friends: api.level('friends') }, memories: JSON.stringify(s.memories), cart: H.facilityCost(H.FAC.cart, 0, 1) };
  });
  c.check('the next iteration starts with the bonuses applied once: 1,500 salvage and 5 wanderers with the radio',
    next.ok && next.salvage === 1500 && next.crew === 5 && next.radio, next);
  c.check('starting salvage is not salvage recovered, so it earns no Déjà Vu', next.recovered === 0, next);
  c.check('levels survive the noclip and the discount still applies', next.levels.stash === 2 && next.levels.bargain === 5 && next.levels.friends === 2 && Math.abs(next.cart - 10.5) < 1e-9, next);
  await g.reload();
  const reloaded = await ev(() => {
    const api = HUM.Exp.ask('djv:api');
    return { salvage: HUM.S.run.salvage, crew: HUM.S.run.crew.total, levels: { stash: api.level('stash'), bargain: api.level('bargain'), friends: api.level('friends') }, dv: HUM.S.dv };
  });
  c.check('reloading after the noclip keeps the levels and does not apply the starting bonuses again',
    reloaded.salvage === 1500 && reloaded.crew === 5 && reloaded.levels.stash === 2 && reloaded.levels.bargain === 5 && reloaded.levels.friends === 2, reloaded);
  await g.reload();
  const twice = await ev(() => ({ salvage: HUM.S.run.salvage, crew: HUM.S.run.crew.total }));
  c.check('loading the save again still adds nothing', twice.salvage === 1500 && twice.crew === 5, twice);

  // ------------------------------------------------------------- the original Memories through the shop; compatibility
  const memories = await ev(() => {
    const H = HUM, api = H.Exp.ask('djv:api');
    H.rt.saveBlocked = true;
    const before = H.S.dv;
    const ok = api.buy('muscle');
    return { ok, rank: H.S.memories.muscle, spent: before - H.S.dv, again: api.buy('muscle'), level: api.level('muscle'), max: api.max('muscle') };
  });
  c.check('an original Memory bought in the shop is the same Memory, at its original price, once', memories.ok && memories.rank === 1 && memories.spent === 1 && memories.again === false && memories.level === 1 && memories.max === 1, memories);
  const compat = await ev(() => {
    const H = HUM;
    // A save from before the shop, and one with out-of-range shop data.
    const old = H.sanitizeState({ v: 1, dv: 40, dvTotal: 300, memories: { muscle: 1, friends: 1, recur: 3 } });
    const odd = H.sanitizeState({ v: 1, ext: { djv: { levels: { stash: 99, bargain: -2, friends: 'x', unknown: 4 } } } });
    H.replaceState(old); H.rt.saveBlocked = true;
    const api = H.Exp.ask('djv:api');
    return { dv: H.S.dv, levels: [api.level('muscle'), api.level('friends'), api.level('recur'), api.level('stash')], recurCost: api.cost('recur'), odd: JSON.stringify(odd.ext.djv) };
  });
  c.check('a save from before the shop loads with its Déjà Vu and Memories, shown as levels', compat.dv === 40 && compat.levels.join() === '1,1,3,0' && compat.recurCost === 64, compat);
  c.check('shop levels in a save are validated: clamped to the maximum, nonsense dropped', compat.odd === '{"levels":{"stash":8}}', compat.odd);

  // ------------------------------------------------------------- developer infinite Déjà Vu (when the developer menu is in this build)
  if (await ev(() => !!HUM.Exp.defs['EXP-DEV-MENU'])) {
  await ev(() => { localStorage.setItem('the-hum.dev', JSON.stringify({ enabled: true, infinite: { dv: true } })); });
  await g.reload();
  const inf = await ev(() => {
    const H = HUM; H.rt.saveBlocked = true;
    H.replaceState(H.sanitizeState({ v: 1 })); H.rt.saveBlocked = true;
    const api = H.Exp.ask('djv:api');
    const ok = api.buy('stash');
    return { ok, level: api.level('stash'), dv: H.S.dv, mark: (H.S.ext.dev || {}).kinds || [] };
  });
  c.check('developer infinite Déjà Vu buys without spending and marks the save', inf.ok && inf.level === 1 && inf.dv === 0 && inf.mark.includes('infinite dv'), inf);
  await ev(() => { localStorage.removeItem('the-hum.dev'); });
  await g.reload();
  } else console.log('  (developer infinite Déjà Vu not checked: EXP-DEV-MENU is not in this build)');

  // ------------------------------------------------------------- switching it off keeps every bit of data
  const off = await ev((id) => {
    const H = HUM;
    H.replaceState(H.sanitizeState({ v: 1, dv: 9, dvTotal: 500, iteration: 4, memories: { muscle: 1, friends: 1 }, ext: { djv: { levels: { stash: 3, bargain: 2, friends: 3 } } } }));
    H.rt.saveBlocked = true;
    H.Exp.set(id, false);
    H.S.seen.tab_noclip = true;
    H.UI.selectTab('noclip'); H.rt.structureDirty = true; H.UI.update(true);
    const p = document.getElementById('panel-noclip');
    const res = { subs: p.querySelectorAll('.subtabs [data-action="noclip-subtab"]').length, memories: p.querySelectorAll('[data-action="memory"]').length, cart: H.facilityCost(H.FAC.cart, 0, 1) };
    const r = H.S.run; Object.assign(r, { level: 3, rooms: 30000 }); r.stats.salvage = 1e9;
    H.noclip();
    res.next = { salvage: H.S.run.salvage, crew: H.S.run.crew.total };
    res.kept = JSON.stringify(H.S.ext.djv);
    res.savedKept = JSON.parse(JSON.stringify(H.S)).ext.djv !== undefined;
    H.Exp.set(id, true);
    const api = H.Exp.ask('djv:api');
    res.back = [api.level('stash'), api.level('bargain'), api.level('friends')];
    H.Exp.reset();
    return res;
  }, ID);
  c.check('switched off, the original Memories section returns and prices are the originals', off.subs === 0 && off.memories === 11 && Math.abs(off.cart - 15) < 1e-9, off);
  c.check('switched off, a noclip starts as in the original game (Old Friends level 1 only)', off.next.salvage === 0 && off.next.crew === 3, off.next);
  c.check('switched off, the shop levels stay in the save, and come back when it is on again',
    off.kept === '{"levels":{"stash":3,"bargain":2,"friends":3}}' && off.savedKept && off.back.join() === '3,2,3', off);

  c.finish(g.errors);
  await g.browser.close();
})();
