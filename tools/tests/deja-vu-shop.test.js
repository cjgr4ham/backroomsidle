// EXP-DEJA-VU-SHOP: the Déjà Vu shop, its leveled permanent upgrades, and starting bonuses applied exactly once.
// In v2 Old Friends brings starting specialists (the Scavenger first, then the Cartographer, Dowser, Watcher and
// Archivist), Remembered Prices lowers facility prices through the facility:price hook, and starting salvage is never
// salvage recovered (stats.salvage), so it earns no Déjà Vu.
const { open, Checker } = require('./harness');
const ID = 'EXP-DEJA-VU-SHOP';

(async () => {
  const c = new Checker('EXP-DEJA-VU-SHOP: permanent upgrades bought with Déjà Vu');
  const g = await open('');
  const { ev, page } = g;
  c.check('the experiment is on by default', await ev((id) => HUM.Exp.on(id), ID));

  // ------------------------------------------------------------- a first noclip (the survey completed first), then the shop
  const first = await ev(() => {
    const H = HUM, r = H.S.run, P = H.CONFIG.prestige;
    H.rt.saveBlocked = true;
    Object.assign(r, { level: H.FINAL_LEVEL, rooms: 30000 });
    r.stats.salvage = 1e9; r.stats.time = 900;
    H.completeFiniteSurvey();
    const preview = H.dvPreview();
    const ok = H.noclip();
    return { ok, preview, expected: Math.floor(Math.pow(1e9 / P.divisor, P.exponent) * P.exitMult), dv: H.S.dv, dvTotal: H.S.dvTotal, salvage: H.S.run.salvage,
      recovered: H.S.run.stats.salvage, specialists: JSON.stringify(H.S.run.specialists), facilities: JSON.stringify(H.S.run.facilities) };
  });
  c.check('a valid noclip awards the previewed Déjà Vu once', first.ok && first.dv === first.preview && first.dvTotal === first.preview && first.preview === first.expected, first);
  c.check('with no shop upgrades the next iteration starts empty: no salvage, specialists or facilities', first.salvage === 0 && first.recovered === 0 && first.specialists === '{}' && first.facilities === '{}', first);

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
    out.stash = card('stash'); out.recur = card('recur'); out.procure = card('procure'); out.muscle = card('muscle'); out.friends = card('friends');
    out.friendsCost = H.MEMORIES.find((m) => m.id === 'friends').cost;
    out.intro = p.querySelector('.djv-intro').textContent;
    return out;
  });
  c.check('the shop is a Noclip sub-tab; the noclip view points to it instead of listing Memories', shop.subs[0] === 'noclip' && shop.subs[1] === 'djv' && !shop.memoriesInMain && shop.pointer, shop);
  c.check('it lists all 13 permanent upgrades in five groups', shop.count === 13 && shop.groups.join('|') === 'Production|Starting each iteration|Prices|Survival and travel|Automation', shop);
  c.check('it says plainly that these are permanent, unlike run purchases (specialists included)', /specialists are lost when you noclip; these never are/.test(shop.intro) && /Permanent/.test(shop.stash.head), shop.intro);
  c.check('each card shows level and maximum, the current effect, the next effect and the next price',
    shop.stash.head.startsWith('Level 0 / 8') && shop.stash.now === 'Now: Iterations start with no salvage.' && shop.stash.next === 'Next: Every iteration starts with 250 salvage. You also get it now if you have less.' && /^Remember4 Déjà Vu$/.test(shop.stash.btn), shop.stash);
  c.check('Old Friends starts as the original Memory: the Scavenger, at its original price',
    shop.friends.head.startsWith('Level 0 / 5') && shop.friends.now === 'Now: Not remembered yet.' && shop.friends.next === 'Next: Every iteration starts with the Scavenger recruited, at level 1. They join you now too.'
      && shop.friends.btn === `Remember${shop.friendsCost} Déjà Vu`, shop.friends);
  c.check('Recurrence shows that it has no limit', shop.recur.head.startsWith('Level 0 · no limit') && /×1\.25/.test(shop.recur.next), shop.recur);
  c.check('an upgrade it cannot afford says how much more Déjà Vu it needs', shop.procure.disabled && /^Remember10 Déjà Vu · need 3 more$/.test(shop.procure.btn), shop.procure);

  // ------------------------------------------------------------- buying: rising costs, immediate effects, double clicks
  const pre = await ev(() => ({ recovered: HUM.S.run.stats.salvage, life: HUM.S.life.salvage, preview: HUM.dvPreview() }));
  await page.click('.slip.djv[data-id="stash"] button');
  await page.waitForTimeout(30);
  const afterClick = await ev(() => {
    const api = HUM.Exp.ask('djv:api');
    return { level: api.level('stash'), dv: HUM.S.dv, salvage: HUM.S.run.salvage, recovered: HUM.S.run.stats.salvage, life: HUM.S.life.salvage, preview: HUM.dvPreview(), next: api.cost('stash'),
      disabled: document.querySelector('.slip.djv[data-id="stash"] button').disabled };
  });
  c.check('buying Stashed Salvage costs 4 Déjà Vu and gives its salvage at once',
    afterClick.level === 1 && afterClick.dv === 3 && afterClick.salvage === 250 && afterClick.next === 10, afterClick);
  c.check('stashed salvage is not salvage recovered: this iteration’s and lifetime totals and the Déjà Vu preview are unchanged',
    afterClick.recovered === pre.recovered && afterClick.life === pre.life && afterClick.preview === pre.preview, { pre, afterClick });
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
  const prices = await ev(() => {
    const H = HUM, api = H.Exp.ask('djv:api'), r = H.S.run;
    const all = H.FACILITIES.map((f) => { const p = H.facPrice(f); return { id: f.id, base: p.base, growth: p.growth, cost: f.cost, g: f.growth }; });
    r.salvage = 100;
    H.setBuyMode(1);
    const quote = H.buyQuote(H.FAC.cart);
    const ok = H.buyFacility('cart');
    return { all, discount: api.discount(), cart: H.facilityCost(H.FAC.cart, 0, 1), vat: H.facilityCost(H.FAC.vat, 3, 1), cartBase: H.FAC.cart.cost, vatBase: H.FAC.vat.cost, vatGrowth: H.FAC.vat.growth,
      quote: quote.cost, ok, paid: 100 - r.salvage, carts: r.facilities.cart };
  });
  c.check('Remembered Prices lowers every facility’s price at once through facility:price (30% at level 5), curve unchanged',
    Math.abs(prices.discount - 0.3) < 1e-12 && prices.all.every((x) => Math.abs(x.base - x.cost * 0.7) <= 1e-12 * x.cost && x.growth === x.g)
      && Math.abs(prices.cart - prices.cartBase * 0.7) < 1e-9 && Math.abs(prices.vat - prices.vatBase * 0.7 * Math.pow(prices.vatGrowth, 3)) < 1e-6, prices);
  c.check('a facility bought now is charged the lowered price', prices.ok && prices.carts === 1 && prices.quote === Math.ceil(prices.cartBase * 0.7) && prices.paid === prices.quote, prices);

  // ------------------------------------------------------------- Old Friends: starting specialists, one more per level
  const friends = await ev(() => {
    const H = HUM, api = H.Exp.ask('djv:api'), r = H.S.run;
    const specs = () => H.SPECIALISTS.map((s) => r.specialists[s.id] || 0).join();
    const out = { order: H.SPECIALISTS.map((s) => s.id).join(), before: api.level('friends'), max: api.max('friends'), level: r.level, steps: [] };
    for (let i = 0; i < 5; i++) {
      const d0 = H.S.dv, s0 = r.salvage;
      const ok = api.buy('friends');
      out.steps.push({ ok, level: api.level('friends'), paid: d0 - H.S.dv, specs: specs(), mem: H.S.memories.friends || 0, salvageBefore: s0, salvage: r.salvage });
      // The Scavenger raised to level 3 in this iteration (later levels must never lower it), and the balance spent.
      if (i === 0) { r.salvage = 1e6; H.hireSpecialist('scavenge'); H.hireSpecialist('scavenge'); r.salvage = 0; }
    }
    out.maxed = api.buy('friends');
    out.cost = H.MEMORIES.find((m) => m.id === 'friends').cost;
    H.UI.update(true);
    const n = document.querySelector('.slip.djv[data-id="friends"]');
    out.card = { now: n.querySelector('.djv-now').textContent, btn: n.querySelector('button').textContent, nextHidden: n.querySelector('.djv-next').hidden };
    return out;
  });
  const fs = friends.steps;
  c.check('the five specialists come in order: Scavenger, Cartographer, Dowser, Watcher, Archivist', friends.order === 'scavenge,chart,dowse,watch,archive', friends.order);
  c.check('Old Friends level 1 is the original Memory, at its price: the Scavenger joins at once', friends.before === 0 && fs[0].ok && fs[0].level === 1 && fs[0].mem === 1 && fs[0].paid === friends.cost && fs[0].specs === '1,0,0,0,0', fs[0]);
  c.check('each further level brings the next specialist at once, at level 1, even below its level requirement', friends.level === 0
    && fs.slice(1).every((s) => s.ok) && fs[1].specs === '3,1,0,0,0' && fs[2].specs === '3,1,1,0,0' && fs[3].specs === '3,1,1,1,0' && fs[4].specs === '3,1,1,1,1', fs);
  c.check('a specialist already raised is never lowered', fs.slice(1).every((s) => s.specs.startsWith('3,')), fs.map((s) => s.specs));
  c.check('levels 2–5 cost 5 × 2^(level−1): 5, 10, 20, 40; it stops at level 5', JSON.stringify(fs.slice(1).map((s) => s.paid)) === '[5,10,20,40]' && fs[4].level === 5 && friends.max === 5 && friends.maxed === false, { paid: fs.map((s) => s.paid), max: friends.max });
  c.check('at level 5 its card names all five and says "Max level"', friends.card.now === 'Now: Every iteration starts with the Scavenger, the Cartographer, the Dowser, the Watcher and the Archivist recruited, at level 1.'
    && friends.card.btn === 'Max level' && friends.card.nextHidden, friends.card);
  c.check('buying a level of Old Friends brings its specialist only: the iteration’s starting salvage (250, already spent) is not handed out again',
    fs.every((s) => s.salvageBefore < 250 && s.salvage === s.salvageBefore), fs.map((s) => ({ level: s.level, salvageBefore: s.salvageBefore, salvageAfter: s.salvage })));

  // ------------------------------------------------------------- the next iteration: applied once, survives the reset and reloads
  const next = await ev(() => {
    const H = HUM, api = H.Exp.ask('djv:api');
    api.buy('stash');   // level 2: 1,500 salvage
    const r = H.S.run;
    r.level = H.FINAL_LEVEL; r.stats.salvage = 1e9; r.stats.time = 900;
    H.completeFiniteSurvey();
    H.rt.saveBlocked = false;
    const ok = H.noclip();
    const s = H.S;
    const out = { ok, level: s.run.level, salvage: s.run.salvage, recovered: s.run.stats.salvage, preview: H.dvPreview(), specialists: JSON.stringify(s.run.specialists),
      levels: { stash: api.level('stash'), bargain: api.level('bargain'), friends: api.level('friends') }, memories: JSON.stringify(s.memories), cart: H.facilityCost(H.FAC.cart, 0, 1), cartBase: H.FAC.cart.cost };
    // Spend below the starting amount, so starting salvage handed out again on load would show.
    s.run.nextEncounterAt = 1e12;
    H.setBuyMode('max');
    out.bought = H.buyFacility('cart');
    H.setBuyMode(1);
    out.left = s.run.salvage; out.carts = s.run.facilities.cart || 0;
    H.save();
    return out;
  });
  const five = '{"scavenge":1,"chart":1,"dowse":1,"watch":1,"archive":1}';
  c.check('the next iteration starts with the bonuses applied once: 1,500 salvage and all five specialists at level 1',
    next.ok && next.level === 0 && next.salvage === 1500 && next.specialists === five, next);
  c.check('starting salvage is not salvage recovered, so it earns no Déjà Vu', next.recovered === 0 && next.preview === 0, next);
  c.check('levels survive the noclip and the discount still applies', next.levels.stash === 2 && next.levels.bargain === 5 && next.levels.friends === 5 && Math.abs(next.cart - next.cartBase * 0.7) < 1e-9, next);
  c.check('(setup) part of the starting salvage is spent before reloading', next.bought && next.carts > 0 && next.left < 1500, next);
  const loaded = () => ev(() => {
    const H = HUM, api = H.Exp.ask('djv:api'), r = H.S.run;
    // Salvage on hand = what was left + what the specialists recovered since; anything more was handed out on load.
    return { net: r.salvage - r.stats.salvage, specialists: JSON.stringify(r.specialists), carts: r.facilities.cart || 0, iteration: H.S.iteration,
      levels: { stash: api.level('stash'), bargain: api.level('bargain'), friends: api.level('friends') } };
  });
  await g.reload();
  const reloaded = await loaded();
  c.check('reloading after the noclip keeps the levels and does not apply the starting bonuses again',
    Math.abs(reloaded.net - next.left) < 1e-6 && reloaded.specialists === five && reloaded.carts === next.carts && reloaded.iteration === 3
      && reloaded.levels.stash === 2 && reloaded.levels.bargain === 5 && reloaded.levels.friends === 5, { reloaded, left: next.left });
  await g.reload();
  const twice = await loaded();
  c.check('loading the save again still adds nothing', Math.abs(twice.net - next.left) < 1e-6 && twice.specialists === five && twice.carts === next.carts, { twice, left: next.left });

  // ------------------------------------------------------------- the original Memories through the shop; compatibility
  const memories = await ev(() => {
    const H = HUM, api = H.Exp.ask('djv:api');
    H.rt.saveBlocked = true;
    const before = H.S.dv;
    const ok = api.buy('muscle');
    return { ok, rank: H.S.memories.muscle, spent: before - H.S.dv, price: H.MEMORIES.find((m) => m.id === 'muscle').cost, again: api.buy('muscle'), level: api.level('muscle'), max: api.max('muscle') };
  });
  c.check('an original Memory bought in the shop is the same Memory, at its original price, once', memories.ok && memories.rank === 1 && memories.spent === memories.price && memories.again === false && memories.level === 1 && memories.max === 1, memories);
  const compat = await ev(() => {
    const H = HUM;
    // A save with Déjà Vu and Memories but no shop levels; a version-1 save with shop levels; one with out-of-range shop data.
    const plain = H.sanitizeState({ v: 2, dv: 40, dvTotal: 300, memories: { muscle: 1, friends: 1, recur: 3 } });
    const v1 = H.sanitizeState({ v: 1, dv: 12, dvTotal: 90, memories: { friends: 1, hoard: 1 }, ext: { djv: { levels: { stash: 3, bargain: 2, friends: 4 } } } });
    const odd = H.sanitizeState({ v: 2, ext: { djv: { levels: { stash: 99, bargain: -2, friends: 'x', unknown: 4 } } } });
    H.replaceState(v1); H.rt.saveBlocked = true;
    let api = H.Exp.ask('djv:api');
    const migrated = { v: H.S.v, dv: H.S.dv, levels: ['stash', 'bargain', 'friends', 'hoard'].map((id) => api.level(id)) };
    H.replaceState(plain); H.rt.saveBlocked = true;
    api = H.Exp.ask('djv:api');
    return { dv: H.S.dv, levels: [api.level('muscle'), api.level('friends'), api.level('recur'), api.level('stash')], recurCost: api.cost('recur'), migrated, odd: JSON.stringify(odd.ext.djv) };
  });
  c.check('a save without shop levels loads with its Déjà Vu and Memories, shown as levels', compat.dv === 40 && compat.levels.join() === '1,1,3,0' && compat.recurCost === 64, compat);
  c.check('a version-1 save keeps its Déjà Vu, Memories and shop levels through the migration', compat.migrated.v === 2 && compat.migrated.dv === 12 && compat.migrated.levels.join() === '3,2,4,1', compat.migrated);
  c.check('shop levels in a save are validated: clamped to the maximum, nonsense dropped', compat.odd === '{"levels":{"stash":8}}', compat.odd);

  // ------------------------------------------------------------- developer infinite Déjà Vu (when the developer menu is in this build)
  if (await ev(() => !!HUM.Exp.defs['EXP-DEV-MENU'])) {
    await ev(() => { localStorage.setItem('the-hum.dev', JSON.stringify({ enabled: true, infinite: { dv: true } })); });
    await g.reload();
    const inf = await ev(() => {
      const H = HUM; H.rt.saveBlocked = true;
      H.replaceState(H.sanitizeState({ v: 2 })); H.rt.saveBlocked = true;
      const api = H.Exp.ask('djv:api');
      const ok = api.buy('stash');
      return { ok, level: api.level('stash'), dv: H.S.dv, mark: (H.S.ext.dev || {}).kinds || [], actions: (H.S.ext.dev || {}).actions || 0 };
    });
    c.check('developer infinite Déjà Vu buys without spending and marks the save', inf.ok && inf.level === 1 && inf.dv === 0 && inf.mark.includes('infinite dv') && inf.actions >= 1, inf);
    await ev(() => { localStorage.removeItem('the-hum.dev'); });
    await g.reload();
  } else console.log('  (developer infinite Déjà Vu not checked: EXP-DEV-MENU is not in this build)');

  // ------------------------------------------------------------- switching it off keeps every bit of data
  const off = await ev((id) => {
    const H = HUM;
    H.replaceState(H.sanitizeState({ v: 2, dv: 9, dvTotal: 500, iteration: 4, memories: { muscle: 1, friends: 1 }, ext: { djv: { levels: { stash: 3, bargain: 2, friends: 3 } } } }));
    H.rt.saveBlocked = true;
    H.Exp.set(id, false);
    H.S.seen.tab_noclip = true;
    H.UI.selectTab('noclip'); H.rt.structureDirty = true; H.UI.update(true);
    const p = document.getElementById('panel-noclip');
    const res = { subs: p.querySelectorAll('.subtabs [data-action="noclip-subtab"]').length, memories: p.querySelectorAll('[data-action="memory"]').length, all: H.MEMORIES.length,
      cart: H.facilityCost(H.FAC.cart, 0, 1), cartBase: H.FAC.cart.cost };
    const r = H.S.run;
    r.level = H.FINAL_LEVEL; r.stats.salvage = 1e9; r.stats.time = 900;
    H.completeFiniteSurvey();
    res.ok = H.noclip();
    res.next = { salvage: H.S.run.salvage, specialists: JSON.stringify(H.S.run.specialists) };
    res.kept = JSON.stringify(H.S.ext.djv);
    res.savedKept = JSON.parse(JSON.stringify(H.S)).ext.djv !== undefined;
    H.Exp.set(id, true);
    const api = H.Exp.ask('djv:api');
    res.back = [api.level('stash'), api.level('bargain'), api.level('friends')];
    H.Exp.reset();
    return res;
  }, ID);
  c.check('switched off, the original Memories section returns and prices are the originals', off.subs === 0 && off.memories === off.all && Math.abs(off.cart - off.cartBase) < 1e-9, off);
  c.check('switched off, a noclip starts as in the original game: Old Friends brings the Scavenger only, no starting salvage', off.ok && off.next.salvage === 0 && off.next.specialists === '{"scavenge":1}', off.next);
  c.check('switched off, the shop levels stay in the save, and come back when it is on again',
    off.kept === '{"levels":{"stash":3,"bargain":2,"friends":3}}' && off.savedKept && off.back.join() === '3,2,3', off);

  c.finish(g.errors);
  await g.browser.close();
})();
