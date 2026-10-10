// EXP-DV-PRICES: the Déjà Vu shop priced so one run cannot buy it out. Memories at their new prices, Recurrence and
// the shop's levels scaled; the shop shows exactly what it charges; Déjà Vu earned is unchanged; switching it either
// way never takes anything bought away; and the original Memories section (without the shop) uses the same prices.
const { open, Checker } = require('./harness');

(async () => {
  const c = new Checker('EXP-DV-PRICES: Déjà Vu prices');
  const g = await open('');
  const { ev } = g;

  const prices = await ev(() => {
    const H = HUM, E = H.Exp, djv = E.ask('djv:api');
    H.replaceState(H.sanitizeState({ v: 2 }));
    H.rt.saveBlocked = true;
    const table = () => ({
      memories: Object.fromEntries(H.MEMORIES.map((M) => [M.id, H.memoryCost(M)])),
      shop: Object.fromEntries(djv.ids().map((id) => [id, djv.cost(id)])),
    });
    const on = table();
    H.S.memories.recur = 1; H.S.memories.friends = 1;
    H.S.ext.djv = { levels: { stash: 1, bargain: 1, friends: 1 } };
    const on2 = table();
    E.set('EXP-DV-PRICES', false);
    const off2 = table();
    H.S.memories.recur = 0; H.S.memories.friends = 0; H.S.ext.djv = { levels: {} };
    const off = table();
    E.set('EXP-DV-PRICES', true);
    return { on, on2, off, off2 };
  });
  const want = { muscle: 10, friends: 20, thirst: 30, hoard: 30, lucid: 40, remembers: 50, shift: 50, sleep: 50, route: 60, procure: 80 };
  c.check('each Memory has its new price (10 to 80; 420 for all ten, was 45)', Object.entries(want).every(([id, p]) => prices.on.memories[id] === p) && Object.values(want).reduce((a, b) => a + b, 0) === 420, prices.on.memories);
  c.check('Recurrence ×5 (40, then 80) and the shop’s levels scaled (Stashed Salvage ×4, Remembered Prices ×5, Old Friends ×6)',
    prices.on.memories.recur === 40 && prices.on2.memories.recur === 80 && prices.on.shop.stash === 16 && prices.on2.shop.stash === 40
      && prices.on.shop.bargain === 30 && prices.on2.shop.bargain === 70 && prices.on.shop.friends === 20 && prices.on2.shop.friends === 30, prices);
  c.check('switched off, every price is the shop’s own again', prices.off.memories.muscle === 1 && prices.off.memories.procure === 10 && prices.off.memories.recur === 8
    && prices.off.shop.stash === 4 && prices.off.shop.friends === 2 && prices.off2.shop.friends === 5 && prices.off2.memories.recur === 16, prices.off);

  const shop = await ev(() => {
    const H = HUM, E = H.Exp, djv = E.ask('djv:api'), out = {};
    H.replaceState(H.sanitizeState({ v: 2 }));
    H.rt.saveBlocked = true;
    // The shop shows exactly what buying charges, for a Memory and for a level.
    H.S.dv = 1000;
    H.S.seen.tab_noclip = true;
    H.rt.noclipTab = 'djv';
    H.UI.selectTab('noclip'); H.rt.structureDirty = true; H.UI.update(true);
    const card = (id) => { H.UI.update(true); const n = document.querySelector(`#panel-noclip .slip.djv[data-id="${id}"] button .sub`); return n && n.textContent; };
    const charged = (id) => { const shown = card(id); const before = H.S.dv; djv.buy(id); return { shown, paid: before - H.S.dv }; };
    out.muscle = charged('muscle');
    out.stash = charged('stash');
    out.recur = charged('recur');
    // One run cannot buy it out: the top of a first run, spent cheapest first.
    H.replaceState(H.sanitizeState({ v: 2 }));
    H.rt.saveBlocked = true;
    H.S.dv = 175;
    const bought = [];
    for (let k = 0; k < 60; k++) {
      const ids = djv.ids().filter((id) => djv.can(id)).sort((x, y) => djv.cost(x) - djv.cost(y));
      if (!ids.length || !djv.buy(ids[0])) break;
      bought.push(ids[0]);
    }
    out.bought = bought;
    out.notMaxed = djv.ids().filter((id) => djv.level(id) < djv.max(id)).length;
    out.memoriesOwned = H.MEMORIES.filter((M) => !M.repeatable && H.S.memories[M.id]).length;
    // Everything with a limit, priced level by level.
    H.replaceState(H.sanitizeState({ v: 2 }));
    H.rt.saveBlocked = true;
    let total = 0;
    H.S.dv = 1e9;
    for (const id of djv.ids()) { if (djv.max(id) === Infinity) continue; while (djv.level(id) < djv.max(id)) { total += djv.cost(id); if (!djv.buy(id)) break; } }
    out.total = total;
    // Switching it either way takes nothing bought away and never touches Déjà Vu or what it earns.
    const kept = JSON.stringify([H.S.memories, H.S.ext.djv, H.S.dv]);
    H.S.run.stats.salvage = 1e12;
    const dvOn = H.dvPreview();
    E.set('EXP-DV-PRICES', false);
    out.keptOff = kept === JSON.stringify([H.S.memories, H.S.ext.djv, H.S.dv]);
    out.dvSame = H.dvPreview() === dvOn;
    E.set('EXP-DV-PRICES', true);
    out.keptOn = kept === JSON.stringify([H.S.memories, H.S.ext.djv, H.S.dv]);
    return out;
  });
  c.check('the shop shows exactly what buying charges, for a Memory, a level and Recurrence',
    shop.muscle.shown === '10 Déjà Vu' && shop.muscle.paid === 10 && shop.stash.shown === '16 Déjà Vu' && shop.stash.paid === 16 && shop.recur.shown === '40 Déjà Vu' && shop.recur.paid === 40, shop);
  c.check(`one run cannot buy it out: 175 Déjà Vu, spent cheapest first, buys ${shop.bought.length} things (${shop.memoriesOwned} of the 10 Memories)`,
    shop.bought.length <= 7 && shop.memoriesOwned <= 5 && shop.notMaxed >= 9, shop);
  c.check(`everything with a limit costs ${shop.total.toLocaleString('en')} Déjà Vu, about a hundred first runs`, shop.total > 15000, shop.total);
  c.check('switching it either way takes nothing bought away, and Déjà Vu earned is unchanged', shop.keptOff && shop.keptOn && shop.dvSame, shop);
  c.check('no console or page errors so far', g.errors.length === 0, g.errors.slice(0, 5));
  await g.browser.close();

  // Without the shop experiment, the original Memories section uses the same prices.
  const g2 = await open('?exp=-EXP-DEJA-VU-SHOP');
  const plain = await g2.ev(() => {
    const H = HUM;
    H.replaceState(H.sanitizeState({ v: 2 }));
    H.rt.saveBlocked = true;
    H.S.dv = 12;
    H.S.seen.tab_noclip = true;
    H.rt.noclipTab = 'noclip';
    H.UI.selectTab('noclip'); H.rt.structureDirty = true; H.UI.update(true);
    const text = document.getElementById('panel-noclip').textContent;
    const M = (id) => H.MEMORIES.find((x) => x.id === id);
    const can = H.canBuyMemory(M('muscle')), cannot = H.canBuyMemory(M('friends'));
    const ok = H.buyMemory('muscle');
    return { route: /60 Déjà Vu/.test(text), procure: /80 Déjà Vu/.test(text), can, cannot, ok, left: H.S.dv };
  });
  c.check('without the shop, the original Memories section shows and charges the same prices', plain.route && plain.procure && plain.can && !plain.cannot && plain.ok && plain.left === 2, plain);
  c.finish(g2.errors);
  await g2.browser.close();
})();
