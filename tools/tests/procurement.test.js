// EXP-AUTO-UPGRADE: the Procurement Controller. Individual auto-upgrade switches (off by default) on crew rows, facility
// rows and salvage requisitions, bought by one shared purchaser, strictly cheapest first, one purchase at a time
// through the normal purchase functions. Takes over Procurement Notes' auto-buy without a second purchaser. Time away
// buys in the same order as small steps, with no income before a purchase.
const fs = require('fs');
const path = require('path');
const { open, Checker } = require('./harness');

const PRE_L5 = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'pre-update-l5.json'), 'utf8'));
const setup = () => {
  const H = HUM;
  H.replaceState(H.sanitizeState({ v: 2 }));
  H.rt.saveBlocked = true;
  H.enterLevel(2);
  H.S.run.rooms = 2000;
  H.S.seen.tab_crew = true; H.S.seen.tab_upgrades = true;
  return H;
};

(async () => {
  const c = new Checker('EXP-AUTO-UPGRADE: Procurement Controller');
  const g = await open('');
  const { ev } = g;

  const unlock = await ev(`(${setup})() && (() => {
    const H = HUM, u = H.UPG.procurement;
    const out = { avail: H.upgradeAvailable(u), home: H.upgradeHome(u), cur: H.upgradeCurrency(u), cid: u.cid, cat: u.cat };
    H.S.run.level = 1; out.l1 = H.upgradeAvailable(u); H.S.run.level = 2;
    // Choices saved before it is installed do nothing.
    H.S.ext.procure = { on: { 'fac:cart': true, 'spec:scavenge': true } };
    H.S.run.salvage = 1e5; H.S.run.specialists = { scavenge: 1 };
    for (let i = 0; i < 30; i++) H.step(0.1, false);
    out.dormant = !H.S.run.facilities.cart && H.S.run.specialists.scavenge === 1;
    H.UI.update(true); H.UI.selectTab('crew'); H.UI.update(true);
    out.crewToggles = document.querySelectorAll('#panel-crew .auto-toggle').length;
    H.S.run.salvage = 1e8;
    H.buyUpgrade('procurement');
    H.UI.update(true);
    const act = document.querySelector('#panel-crew [data-spec="scavenge"] .row-act');
    out.crewOrder = [...act.children].map((x) => x.className.split(' ').slice(-1)[0] + ':' + x.textContent);
    out.crewAll = [...document.querySelectorAll('#panel-crew .row.spec')].map((r) => r.querySelector('.auto-toggle') && r.querySelector('.auto-toggle').textContent);
    H.UI.selectTab('facilities'); H.UI.update(true);
    const fact = document.querySelector('#panel-facilities [data-fac="cart"] .row-act');
    out.facOrder = [...fact.children].map((x) => x.textContent);
    H.UI.selectTab('upgrades'); H.UI.update(true);
    out.box = (document.querySelector('#panel-upgrades .procure-bar') || {}).textContent;
    out.slipToggles = [...document.querySelectorAll('#panel-upgrades .slip')].map((s) => [s.querySelector('h3').textContent, (s.querySelector('.auto-toggle') || {}).textContent]);
    out.waterSlip = out.slipToggles.filter(([n]) => /Auto-Drink Valve|Folding Cot/.test(n));
    out.listRows = [...document.querySelectorAll('#panel-upgrades .procure-row .procure-name')].map((x) => x.textContent);
    return out;
  })()`);
  c.check('a salvage requisition from Level 2, in the Upgrades tab (Automation), with its own content id',
    unlock.avail && unlock.l1 === false && unlock.home === 'upgrades' && unlock.cur === 'salvage' && unlock.cid === 'upgrade:procurement' && unlock.cat === 'Automation', unlock);
  c.check('choices saved before it is installed do nothing, and there are no switches', unlock.dormant && unlock.crewToggles === 0, unlock);
  c.check('on each crew row the switch sits directly under the yellow recruit/upgrade button',
    /^primary:Upgrade to level 2/.test(unlock.crewOrder[0]) && unlock.crewOrder[1] === 'auto-toggle:Auto-upgrade: ON' && unlock.crewAll.every((t) => /^Auto-upgrade: (ON|OFF)$/.test(t)), unlock);
  c.check('facility rows get Auto-buy and Auto-tier under the buy button', /^Buy 1/.test(unlock.facOrder[0]) && unlock.facOrder[1] === 'Auto-buy: ON' && unlock.facOrder[2] === 'Auto-tier: OFF', unlock.facOrder);
  c.check('salvage requisitions get Auto-buy, off by default; water requisitions get none', unlock.slipToggles.filter(([, t]) => t).every(([, t]) => t === 'Auto-buy: OFF') && unlock.waterSlip.every(([, t]) => !t), unlock.slipToggles);
  c.check('the Upgrades tab shows the purchaser, Pause all, and every salvage requisition (also those not on sale yet)',
    /Procurement Controller/.test(unlock.box) && /Pause all/.test(unlock.box) && unlock.listRows.includes('Hydraulic Spreader') && unlock.listRows.includes('Master Key') && !unlock.listRows.includes('Auto-Drink Valve'), unlock);

  const example = await ev(() => {
    const H = HUM, E = H.Exp;
    E.define({ id: 'EXP-PROBE', name: 'Probe' });
    H.Content.facility('EXP-PROBE', { id: 'pa', code: 'P-A', name: 'A', kind: 'salvage', icon: 'cart', level: 0, cost: 100, growth: 2, bonus: 0, noise: 0, flavor: '', tiers: [] });
    H.Content.facility('EXP-PROBE', { id: 'pb', code: 'P-B', name: 'B', kind: 'salvage', icon: 'cart', level: 0, cost: 150, growth: 2, bonus: 0, noise: 0, flavor: '', tiers: [] });
    H.Content.upgrade('EXP-PROBE', { id: 'pc', cat: 'Survey', name: 'C', cost: { salvage: 220 }, req: {}, effect: '', flavor: '' });
    H.replaceState(H.sanitizeState({ v: 2 }));
    H.rt.saveBlocked = true;
    H.S.run.upgrades.procurement = true;
    const api = E.ask('procure:api');
    for (const k of ['fac:pa', 'fac:pb', 'upg:pc']) api.setOn(k, true);
    H.setBuyMode('max');
    H.S.run.salvage = 670;
    const got = api.procure(50).map((b) => `${b.name}${b.price}`);
    const out = { got, left: H.S.run.salvage, counts: [H.S.run.facilities.pa, H.S.run.facilities.pb, !!H.S.run.upgrades.pc], next: api.nextUp().price };
    // Ties go to the target bought least recently, then a fixed order.
    H.replaceState(H.sanitizeState({ v: 2 }));
    H.rt.saveBlocked = true;
    H.S.run.upgrades.procurement = true;
    H.Content.facility('EXP-PROBE', { id: 'pd', code: 'P-D', name: 'D', kind: 'salvage', icon: 'cart', level: 0, cost: 100, growth: 1.0000001, bonus: 0, noise: 0, flavor: '', tiers: [] });
    H.Content.facility('EXP-PROBE', { id: 'pe', code: 'P-E', name: 'E', kind: 'salvage', icon: 'cart', level: 0, cost: 100, growth: 1.0000001, bonus: 0, noise: 0, flavor: '', tiers: [] });
    api.setOn('fac:pd', true); api.setOn('fac:pe', true);
    H.S.run.salvage = 1000;
    out.ties = api.procure(6).map((b) => b.name).join('');
    E.set('EXP-PROBE', false);
    H.setBuyMode(1);
    return out;
  });
  c.check('the example: A 100→200, B 150→300, C 220 buys A100, B150, A200, C220 in that order', example.got.join() === 'A100,B150,A200,C220', example);
  c.check('then it stops: the cheapest (B at 300) cannot be paid for; nothing goes negative', example.left === 0 && example.next === 300 && example.counts.join() === '2,1,true', example);
  c.check('one unit at a time whatever the buy mode (MAX was selected)', example.counts[0] === 2, example);
  c.check('equal prices take turns: the one bought least recently goes first', /^(DEDEDE|EDEDED)$/.test(example.ties), example.ties);

  const rules = await ev(`(${setup})() && (() => {
    const H = HUM, api = H.Exp.ask('procure:api');
    H.S.run.upgrades.procurement = true;
    H.S.run.specialists = { scavenge: 3, chart: 2 };
    // Independent switches: Auto-buy does not switch on Auto-tier; one specialist does not switch on the others.
    api.setOn('fac:cart', true); api.setOn('spec:scavenge', true);
    const keys = api.targets().map((t) => t.key).sort().join();
    // Current discounts: the Foreman's Whistle makes specialist levels 10% cheaper, and the purchaser pays that price.
    H.S.run.upgrades.whistle = true;
    const pays = [];
    const pay = H.Wallet.pay;
    H.Wallet.pay = function (cur, n) { pays.push([cur, n]); return pay.call(this, cur, n); };
    const price = H.specCost(H.SPEC.scavenge);
    H.S.run.salvage = price;
    api.setOn('fac:cart', false);
    const got = api.procure(5);
    H.Wallet.pay = pay;
    const out = { keys, paid: pays.map(([, n]) => n), price, got: got.map((b) => b.key), salvage: H.S.run.salvage };
    // Unaffordable: nothing is bought and nothing paid.
    H.S.run.salvage = 1;
    out.none = api.procure(5).length === 0 && H.S.run.salvage === 1;
    // A capped specialist shows Max level and is skipped; a one-off shows Complete; a tier waits for its count.
    H.S.run.specialists.scavenge = H.CONFIG.specialists.max;
    H.S.run.salvage = 1e9;
    api.setOn('tier:cart', true); api.setOn('upg:gloves', true);
    H.S.run.facilities.cart = 3;
    const got2 = api.procure(10).map((b) => b.key);
    H.UI.update(true); H.UI.selectTab('crew'); H.UI.update(true);
    out.maxed = document.querySelector('#panel-crew [data-spec="scavenge"] .auto-toggle').textContent;
    H.UI.selectTab('facilities'); H.UI.update(true);
    out.tierWait = document.querySelector('#panel-facilities [data-fac="cart"] .auto-status').textContent;
    H.UI.selectTab('upgrades'); H.UI.update(true);
    const row = [...document.querySelectorAll('#panel-upgrades .procure-row')].find((r) => r.querySelector('.procure-name').textContent === 'Work Gloves');
    out.complete = row && row.querySelector('.auto-toggle').textContent;
    out.got2 = got2;
    return out;
  })()`);
  c.check('switches are independent: Auto-buy on a facility does not switch on Auto-tier, one specialist not the others', rules.keys === 'fac:cart,spec:scavenge', rules);
  c.check('it pays the price the game charges now, discounts included (Foreman’s Whistle)', rules.got.join() === 'spec:scavenge' && rules.paid.length === 1 && rules.paid[0] === rules.price && rules.salvage === 0, rules);
  c.check('when the cheapest cannot be paid for, nothing is bought and nothing paid', rules.none, rules);
  c.check('a specialist at the highest level shows Max level and is never bought', rules.maxed === 'Max level' && !rules.got2.includes('spec:scavenge'), rules);
  c.check('a bought one-off shows Complete; a tier switched on says what it waits for', rules.complete === 'Complete' && rules.tierWait === 'Auto-tier waits for 10 owned.' && rules.got2.includes('upg:gloves'), rules);

  const run = await ev(`(${setup})() && (() => {
    const H = HUM, api = H.Exp.ask('procure:api');
    H.S.run.upgrades.procurement = true;
    H.S.run.specialists = { scavenge: 6 };
    api.setOn('fac:cart', true); api.setOn('fac:bench', true); api.setOn('spec:scavenge', true);
    H.UI.update(true); H.UI.selectTab('settings'); H.UI.update(true);
    H.S.run.salvage = 5e5;
    const logs0 = H.S.log.length;
    for (let i = 0; i < 15; i++) H.step(0.1, false);
    const out = { tab: H.rt.tab, bought: (H.S.run.facilities.cart || 0) + (H.S.run.facilities.bench || 0) + H.S.run.specialists.scavenge - 6, perItem: H.S.log.length - logs0 };
    for (let i = 0; i < 210; i++) H.step(0.1, false);
    out.summary = H.S.log.filter((e) => e.tag === 'PROCURE').map((e) => e.text);
    out.single = H.S.log.slice(0, H.S.log.length - logs0).filter((e) => /commissioned|installed|level \\d+:/.test(e.text)).length;
    // Pause all
    api.setPaused(true);
    const before = JSON.stringify([H.S.run.facilities, H.S.run.specialists]);
    H.S.run.salvage = 1e9;
    for (let i = 0; i < 30; i++) H.step(0.1, false);
    out.paused = JSON.stringify([H.S.run.facilities, H.S.run.specialists]) === before && H.S.ext.procure.on['fac:cart'] === true;
    api.setPaused(false);
    for (let i = 0; i < 15; i++) H.step(0.1, false);
    out.resumed = JSON.stringify([H.S.run.facilities, H.S.run.specialists]) !== before;
    // A bounded budget per run, even with infinite money.
    H.S.run.salvage = 1e300;
    const c0 = H.S.run.facilities.cart;
    H.rt.autobuyAcc = 0;
    for (let i = 0; i < 10; i++) H.step(0.1, false);
    out.bounded = (H.S.run.facilities.cart - c0) + 0 <= 50;
    return out;
  })()`);
  c.check('it buys whatever tab is open (the Settings tab here)', run.tab === 'settings' && run.bought > 3, run);
  c.check('purchases are reported together: no line per purchase, one Procurement line', run.single === 0 && run.summary.length >= 1 && /^Procurement bought /.test(run.summary[0]), run);
  c.check('Pause all holds everything and keeps the choices; resuming buys again', run.paused && run.resumed, run);
  c.check('each run is bounded (at most 50 purchases a second)', run.bounded, run);

  // Procurement Notes: taken over without a second purchaser, choices kept, no twice-the-price reserve.
  const legacy = await ev((raw) => {
    const H = HUM;
    const st = H.sanitizeState(raw);
    H.replaceState(st);
    H.rt.saveBlocked = true;
    const counts0 = { ...H.S.run.facilities };
    const sal0 = H.S.run.salvage;
    let calls = 0;
    const bf = H.buyFacility;
    H.rt.autobuyAcc = 0;
    H.step(1.01, false);
    const api = H.Exp.ask('procure:api');
    const out = { on: Object.keys(H.S.ext.procure.on).sort().join(), merged: H.S.ext.procure.merged === true };
    const bought = Object.keys(counts0).reduce((n, id) => n + (H.S.run.facilities[id] - counts0[id]), 0);
    // Without a reserve the cheapest affordable unit is always bought: what is left cannot buy the cheapest enabled unit.
    const cheapest = Math.min(...['cart', 'bench', 'switchboard'].map((id) => H.unitQuote(H.FAC[id], 1).cost));
    out.bought = bought; out.left = H.S.run.salvage; out.cheapest = cheapest; out.spent = sal0 - H.S.run.salvage;
    H.UI.update(true); H.S.seen.tab_upgrades = true; H.UI.selectTab('facilities'); H.UI.update(true);
    out.checkbox = document.querySelectorAll('#panel-facilities input[data-action="autobuy"]').length;
    out.toggle = (document.querySelector('#panel-facilities [data-fac="cart"] .auto-toggle') || {}).textContent;
    out.tier = !!document.querySelector('#panel-facilities [data-fac="cart"] .auto-toggle + .auto-toggle');
    return out;
  }, PRE_L5);
  c.check('a pre-update save’s Procurement Notes choices are taken over as Auto-buy switches', legacy.merged && legacy.on === 'fac:bench,fac:cart,fac:switchboard', legacy);
  c.check('they are bought cheapest first with no twice-the-price reserve', legacy.bought > 0 && legacy.left < legacy.cheapest, legacy);
  c.check('Procurement Notes alone show Auto-buy switches (no Auto-tier) instead of the old checkboxes', legacy.checkbox === 0 && legacy.toggle === 'Auto-buy: ON' && !legacy.tier, legacy);

  const off = await ev((raw) => {
    const H = HUM, E = H.Exp;
    H.replaceState(H.sanitizeState(raw));
    H.rt.saveBlocked = true;
    H.S.run.upgrades.procurement = true;
    const api = E.ask('procure:api');
    api.setOn('spec:scavenge', true);
    H.rt.autobuyAcc = 0; H.step(1.01, false);
    E.set('EXP-AUTO-UPGRADE', false);
    // The old auto-buy is back, with its rule: a unit is bought only while twice its price is in hand.
    H.S.run.salvage = 1e11;
    const spec0 = H.S.run.specialists.scavenge;
    const fac0 = { ...H.S.run.facilities };
    const prices = [];
    const pay = H.Wallet.pay;
    H.rt.autobuyAcc = 0;
    let held = true;
    // The old loop pays directly, so its rule is checked on the counts: each unit's price was at most half the salvage then.
    for (let i = 0; i < 12; i++) {
      const before = { sal: H.S.run.salvage, f: { ...H.S.run.facilities } };
      H.step(0.1, false);
      for (const id of ['cart', 'bench', 'switchboard']) {
        for (let k = before.f[id]; k < H.S.run.facilities[id]; k++) { const price = Math.ceil(H.facilityCost(H.FAC[id], k, 1)); prices.push(price); }
      }
      if (H.S.run.salvage < 0) held = false;
    }
    H.UI.update(true); H.UI.selectTab('facilities'); H.UI.update(true);
    const boughtLegacy = ['cart', 'bench', 'switchboard'].reduce((n, id) => n + H.S.run.facilities[id] - fac0[id], 0);
    const out = { legacyReserve: boughtLegacy > 0 && held && H.S.run.salvage >= Math.min(...prices), boughtLegacy, specSame: H.S.run.specialists.scavenge === spec0,
      checkbox: document.querySelectorAll('#panel-facilities input[data-action="autobuy"]').length, toggles: document.querySelectorAll('#panel-facilities .auto-toggle').length,
      kept: H.S.ext.procure.on['spec:scavenge'] === true && H.S.run.upgrades.procurement === true, listed: H.upgradeAvailable(H.UPG.procurement) };
    // A choice changed in the old checkboxes while switched off counts when it comes back.
    H.S.run.autobuy.condenser = true; delete H.S.run.autobuy.bench;
    E.set('EXP-AUTO-UPGRADE', true);
    out.imported = H.S.ext.procure.on['fac:condenser'] === true && !H.S.ext.procure.on['fac:bench'];
    // Cheapest first: the condenser switched on in the old checkboxes is far cheaper, so it is bought before the rest.
    const spec1 = H.S.run.specialists.scavenge, cond1 = H.S.run.facilities.condenser || 0;
    H.S.run.salvage = 1e13;
    H.rt.autobuyAcc = 0; H.step(1.01, false);
    out.back = (H.S.run.facilities.condenser || 0) > cond1;
    for (let i = 0; i < 20 && H.S.run.specialists.scavenge === spec1; i++) { H.rt.autobuyAcc = 0; H.step(1.01, false); }
    out.backSpec = H.S.run.specialists.scavenge > spec1;
    // The content switch alone: Procurement Notes' facility switches keep working, the Controller's do not.
    E.setItem('upgrade:procurement', false);
    const spec2 = H.S.run.specialists.scavenge;
    const facN = () => ['cart', 'switchboard', 'condenser'].reduce((n, id) => n + (H.S.run.facilities[id] || 0), 0);
    const fac2 = facN();
    H.S.run.salvage = 1e14;
    for (let i = 0; i < 5; i++) { H.rt.autobuyAcc = 0; H.step(1.01, false); }
    out.itemOff = H.S.run.specialists.scavenge === spec2 && facN() > fac2;
    E.reset();
    return out;
  }, PRE_L5);
  c.check('switched off: the old auto-buy returns with its own rule and checkboxes; the Controller buys nothing', off.legacyReserve && off.specSame && off.checkbox > 0 && off.toggles === 0, off);
  c.check('switched off: the requisition and every choice are kept, and it is not offered again', off.kept && off.listed === false, off);
  c.check('switched back on: changes made in the old checkboxes count, and buying resumes, cheapest first', off.imported && off.back && off.backSpec, off);
  c.check('the content switch upgrade:procurement alone leaves Procurement Notes’ Auto-buy working', off.itemOff, off);

  const reb = await ev(`(${setup})() && (() => {
    const H = HUM, api = H.Exp.ask('procure:api');
    H.S.run.upgrades.procurement = true;
    api.setOn('fac:cart', true); api.setOn('spec:scavenge', true);
    H.enterLevel(5); H.completeFiniteSurvey(0); H.S.run.stats.salvage = 1e13; H.noclip();
    H.S.run.salvage = 1e6; H.S.run.specialists = { scavenge: 1 };
    H.rt.autobuyAcc = 0; H.step(1.01, false);
    return { prefs: Object.keys(H.S.ext.procure.on).sort().join(), owned: !!H.S.run.upgrades.procurement, cart: H.S.run.facilities.cart || 0, scav: H.S.run.specialists.scavenge };
  })()`);
  c.check('choices are kept through a noclip and do nothing until the Controller is installed again', reb.prefs === 'fac:cart,spec:scavenge' && !reb.owned && reb.cart === 0 && reb.scav === 1, reb);

  // Time away: the same purchases in the same order as small steps, never income before a purchase, bounded.
  const away = await ev(`(${setup})() && (() => {
    const H = HUM, api = H.Exp.ask('procure:api');
    H.S.run.upgrades.procurement = true;
    H.S.run.specialists = { scavenge: 4 };
    for (const k of ['fac:cart', 'fac:bench', 'fac:condenser', 'spec:scavenge', 'upg:notebook', 'upg:boots']) api.setOn(k, true);
    H.S.run.salvage = 0;
    const base = JSON.parse(JSON.stringify(H.S));
    // Reference: one-second steps.
    H.replaceState(H.sanitizeState(JSON.parse(JSON.stringify(base)))); H.rt.saveBlocked = true;
    api.clearHistory();
    H.rt.autobuyAcc = 0;
    for (let i = 0; i < 1800; i++) H.step(1, true);
    const seqA = api.history();
    const fine = { salvage: H.S.run.stats.salvage, sps: H.derive().sps, cart: H.S.run.facilities.cart, scav: H.S.run.specialists.scavenge };
    // Coarse: the catch-up of time away (600 steps of 3 s).
    H.replaceState(H.sanitizeState(JSON.parse(JSON.stringify(base)))); H.rt.saveBlocked = true;
    api.clearHistory();
    H.rt.autobuyAcc = 0;
    H.rt.offline = true; H.rt.offlineNotes = [];
    for (let i = 0; i < 600; i++) H.step(3, true);
    const seqB = api.history();
    const notes = H.rt.offlineNotes.slice();
    H.rt.offline = false; H.rt.offlineNotes = null;
    const coarse = { salvage: H.S.run.stats.salvage, sps: H.derive().sps, cart: H.S.run.facilities.cart, scav: H.S.run.specialists.scavenge };
    const n = Math.min(seqA.length, seqB.length);
    let same = 0; while (same < n && seqA[same] === seqB[same]) same++;
    return { fine, coarse, lenA: seqA.length, lenB: seqB.length, same, notes };
  })()`);
  c.check(`time away buys the same things in the same order as one-second steps (${away.same} of ${away.lenA} and ${away.lenB} in the same order)`, away.same >= Math.min(away.lenA, away.lenB) - 1 && away.lenB > 10, away);
  c.check('time away never credits income from a purchase before it is made (coarse ≤ fine)', away.coarse.salvage <= away.fine.salvage * 1.0001 && away.coarse.salvage >= away.fine.salvage * 0.9, away);
  c.check('time away ends within a few purchases of the small-step reference', Math.abs(away.coarse.cart - away.fine.cart) <= 3 && Math.abs(away.coarse.scav - away.fine.scav) <= 1, away);
  c.check('the report of time away gets one line for every purchase made', away.notes.filter((t) => /^Procurement bought /.test(t)).length === 1, away.notes);

  c.check('no console or page errors so far', g.errors.length === 0, g.errors.slice(0, 5));
  await g.browser.close();

  // Independent of the other update-2.1 experiments.
  const g2 = await open('?exp=-EXP-MISSION-AUTOREPEAT,-EXP-CREW-VISIBLE,-EXP-ROOM-VARIETY,-EXP-PRODUCTION-FEEDBACK,-EXP-AMBIENT-EVENTS,-EXP-CREW-EQUIPMENT,-EXP-LATE-FACILITIES,-EXP-LATE-UPGRADES,-EXP-LATE-RESEARCH,-EXP-LATE-BALANCE');
  const alone = await g2.ev(`(${setup})() && (() => {
    const H = HUM, api = H.Exp.ask('procure:api');
    H.S.run.upgrades.procurement = true;
    api.setOn('fac:cart', true);
    H.S.run.salvage = 1000;
    H.rt.autobuyAcc = 0; H.step(1.01, false);
    return H.S.run.facilities.cart || 0;
  })()`);
  c.check('with every other update-2.1 experiment off, it works on its own', alone > 3, alone);
  c.finish(g2.errors);
  await g2.browser.close();
})();
