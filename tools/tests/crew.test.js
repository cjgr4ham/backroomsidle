// EXP-CREW-AUTOMATION: crew run the machines; crew and shift upgrades live in the Crew tab.
const { open, Checker } = require('./harness');

const ID = 'EXP-CREW-AUTOMATION';
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps * Math.max(1, Math.abs(a), Math.abs(b));

(async () => {
  const c = new Checker(`${ID}: crew-run operation`);
  const g = await open(`?exp=none,${ID}`);
  const { ev, page } = g;

  // ------------------------------------------------------------- staffing arithmetic
  const solo = await ev(() => {
    const H = HUM; H.rt.saveBlocked = true;
    H.replaceState(H.sanitizeState({ v: 1 }));
    H.S.achievements = {};
    const r = H.S.run;
    r.facilities = { cart: 12 };
    const D = H.derive();
    return { each: D.fac.cart.each, total: D.fac.cart.total, staffed: D.fac.cart.staffed, sal: D.facSalvage, self: D.ops.selfUsed };
  });
  c.check('with no crew, you run the first 10 machines and the rest work at 25%', solo.staffed === 10 && solo.self === 10 && near(solo.total, solo.each * (10 + 2 * 0.25)), solo);
  c.check('facility salvage is the sum of the machines', near(solo.sal, solo.total), solo);

  const crew = await ev(() => {
    const H = HUM, r = H.S.run;
    r.upgrades.radio = true;
    r.facilities = { cart: 20, bench: 10 };
    r.crew.total = 3; r.crew.jobs.scavenge = 1;
    const D1 = H.derive();
    const one = { benchCrew: D1.fac.bench.byCrew, benchStaffed: D1.fac.bench.staffed, cartStaffed: D1.fac.cart.staffed, each: D1.ops.each, cap: D1.ops.lines.scavenge.capacity };
    H.assign('scavenge', 2);
    const D3 = H.derive();
    return { one, three: { cap: D3.ops.lines.scavenge.capacity, staffed: D3.ops.lines.scavenge.staffed, idle: D3.ops.lines.scavenge.idle,
      cartTotal: D3.fac.cart.total, cartEach: D3.fac.cart.each, cartStaffed: D3.fac.cart.staffed }, sal1: D1.facSalvage, sal3: D3.facSalvage };
  });
  c.check('one scavenger runs 4 machines, taking the most productive first', crew.one.each === 4 && crew.one.cap === 4 && crew.one.benchCrew === 4, crew.one);
  c.check('your own 10 go to the next most productive machines', crew.one.benchStaffed === 10 && crew.one.cartStaffed === 4, crew.one);
  c.check('assigning crew raises production at once', crew.sal3 > crew.sal1 && crew.three.cap === 12 && crew.three.staffed === 22 && crew.three.idle === 8, crew);
  c.check('a part-run facility pays staffed machines in full and the rest at 25%', near(crew.three.cartTotal, crew.three.cartEach * (crew.three.cartStaffed + (20 - crew.three.cartStaffed) * 0.25)), crew.three);

  const lines = await ev(() => {
    const H = HUM, r = H.S.run;
    r.level = 3;
    r.facilities = { cart: 30, condenser: 6, beacon: 9, array: 5, dampener: 7 };
    r.crew.total = 6; r.crew.jobs = { scavenge: 0, chart: 2, dowse: 1, watch: 0, archive: 1 };
    const D = H.derive();
    const off = (id) => D.fac[id];
    return {
      condenser: { staffed: off('condenser').staffed, total: off('condenser').total, each: off('condenser').each },
      beacon: { staffed: off('beacon').staffed, total: off('beacon').total, each: off('beacon').each },
      array: { staffed: off('array').staffed, total: off('array').total, each: off('array').each },
      damp: { total: off('dampener').total, each: off('dampener').each, staffed: off('dampener').staffed },
      aws: D.aws, crewWater: D.jobOut.dowse,
    };
  });
  c.check('Dowsers run condensers: 4 of 6 at full speed, 2 at 25%', lines.condenser.staffed === 4 && near(lines.condenser.total, lines.condenser.each * 4.5), lines.condenser);
  c.check('Cartographers run beacons: 8 of 9', lines.beacon.staffed === 8 && near(lines.beacon.total, lines.beacon.each * 8.25), lines.beacon);
  c.check('Archivists run arrays: 4 of 5', lines.array.staffed === 4 && near(lines.array.total, lines.array.each * 4.25), lines.array);
  c.check('dampeners need nobody', lines.damp.staffed === undefined && near(lines.damp.total, lines.damp.each * 7), lines.damp);
  c.check('water per second is the condensers plus the dowsers\' own work, counted once', near(lines.aws, lines.condenser.total + lines.crewWater), lines);

  const eff = await ev(() => {
    const H = HUM, r = H.S.run;
    r.salvage = 1e9; r.aw = 1e6; r.crew.total = 20;
    const base = H.derive().ops.each;
    r.upgrades.bunks = true;
    const bunks = H.derive().ops.each;
    H.buyUpgrade('roster');
    const roster = H.derive().ops.each;
    return { base, bunks, roster, owned: r.upgrades.roster === true };
  });
  c.check('crew efficiency and the Duty Roster raise the machines each crew member runs', eff.base === 4 && eff.bunks === 5 && eff.owned && eff.roster === 7.5, eff);

  const phantom = await ev(() => {
    const H = HUM, r = H.S.run;
    H.S.research.phantom = true;
    r.crew.total = 10; r.crew.jobs = { scavenge: 2, chart: 0, dowse: 0, watch: 0, archive: 0 };
    r.facilities = { cart: 100 };
    const D = H.derive();
    const res = { idle: D.idle, cap: D.ops.lines.scavenge.capacity, each: D.ops.each };
    delete H.S.research.phantom;
    return res;
  });
  c.check('Phantom Labour: idle wanderers count as half a scavenger, once', phantom.cap === Math.floor((2 + phantom.idle * 0.5) * phantom.each), phantom);

  const noise = await ev(() => {
    const H = HUM, r = H.S.run;
    r.facilities = { cart: 40, bench: 30, vat: 20, beacon: 10, condenser: 5 };
    r.crew.jobs = { scavenge: 1, chart: 0, dowse: 0, watch: 1, archive: 0 };
    const on = H.derive();
    H.Exp.session['EXP-CREW-AUTOMATION'] = false;
    const off = H.derive();
    H.Exp.session['EXP-CREW-AUTOMATION'] = true;
    return { on: [on.noise, on.absorb, on.attnTarget], off: [off.noise, off.absorb, off.attnTarget] };
  });
  c.check('noise, absorption and attention are unchanged', noise.on.every((v, i) => near(v, noise.off[i])), noise);

  const offline = await ev(() => {
    const H = HUM, r = H.S.run;
    r.facilities = { cart: 40, bench: 30 };
    r.crew.jobs = { scavenge: 3, chart: 0, dowse: 0, watch: 0, archive: 0 };
    r.attention = 0; r.sanity = 100; r.lightsUntil = 0;
    // Every achievement already earned, so the +1% bonuses cannot change during the catch-up.
    for (const a of H.ACHIEVEMENTS) H.S.achievements[a.id] = true;
    const keep = JSON.stringify(H.S);
    const run = (on) => {
      H.replaceState(H.sanitizeState(JSON.parse(keep)));
      H.Exp.session['EXP-CREW-AUTOMATION'] = on;
      const D = H.derive(), s0 = H.S.run.salvage;
      H.catchUp(600);
      return { expected: D.sps * 600, got: H.S.run.salvage - s0 };
    };
    const res = { off: run(false), on: run(true) };
    H.replaceState(H.sanitizeState(JSON.parse(keep)));
    return res;
  });
  c.check('offline progress uses the staffed rates', near(offline.on.got, offline.on.expected, 1e-6) && offline.on.got < offline.off.got && near(offline.off.got, offline.off.expected, 1e-6), offline);

  // ------------------------------------------------------------- converting an existing save
  const conv = await ev(() => {
    const H = HUM;
    // A save made before this experiment: lots of machines, few crew, one cartographer.
    const st = H.sanitizeState({ v: 1 });
    const r = st.run;
    Object.assign(r, { level: 2, rooms: 9000, levelRooms: 1000, salvage: 123456, aw: 77 });
    r.upgrades = { radio: true, whistle: true, flashlight: true };
    r.facilities = { cart: 50, bench: 40, condenser: 12, beacon: 20, vat: 30, foundry: 5, dampener: 3 };
    r.crew = { total: 9, jobs: { scavenge: 6, chart: 1, dowse: 1, watch: 1, archive: 0 }, missing: [], defaultJob: 'scavenge' };
    const raw = JSON.parse(JSON.stringify(st));
    delete raw.ext.crew; delete raw.run.ext.crew;
    // Production as the original rules compute it.
    H.Exp.session['EXP-CREW-AUTOMATION'] = false;
    H.replaceState(H.sanitizeState(JSON.parse(JSON.stringify(raw))));
    const D0 = H.derive();
    const before = { sal: D0.facSalvage, aws: D0.aws, surveys: D0.autoSurveys, eps: D0.eps };
    H.Exp.session['EXP-CREW-AUTOMATION'] = true;
    const logs = H.S.log.length;
    H.replaceState(H.sanitizeState(JSON.parse(JSON.stringify(raw))));
    const D1 = H.derive();
    const after = { sal: D1.facSalvage, aws: D1.aws, surveys: D1.autoSurveys, eps: D1.eps };
    const res = { before, after, legacy: H.S.run.ext.crew && H.S.run.ext.crew.legacy, mark: H.S.ext.crew,
      jobs: JSON.stringify(H.S.run.crew.jobs) === JSON.stringify(raw.run.crew.jobs), total: H.S.run.crew.total,
      salvage: H.S.run.salvage, aw: H.S.run.aw, facs: H.FACILITIES.every((f) => (H.S.run.facilities[f.id] || 0) === (raw.run.facilities[f.id] || 0)),
      reported: H.S.log.some((l) => /previous shift/.test(l.text || l.t || JSON.stringify(l))), legacyUsed: D1.ops.legacyUsed };
    // Loading the converted save again must not convert it twice.
    const again = H.sanitizeState(JSON.parse(JSON.stringify(H.S)));
    H.replaceState(again);
    res.legacyAgain = H.S.run.ext.crew && H.S.run.ext.crew.legacy;
    res.salAgain = H.derive().facSalvage;
    res.logsAgain = H.S.log.filter((l) => /previous shift/.test(JSON.stringify(l))).length;
    // New machines need crew; the previous shift only keeps what was there.
    const nBefore = H.derive().ops.idle;
    H.S.run.salvage = 1e9;
    H.buyFacility('cart');
    res.idleAfterBuy = H.derive().ops.idle - nBefore;
    return res;
  });
  c.check('an old save converts with exactly the production it had', near(conv.after.sal, conv.before.sal) && near(conv.after.aws, conv.before.aws) && near(conv.after.surveys, conv.before.surveys) && near(conv.after.eps, conv.before.eps), conv);
  c.check('conversion keeps crew, jobs, machines and resources untouched', conv.jobs && conv.total === 9 && conv.salvage === 123456 && conv.aw === 77 && conv.facs, conv);
  c.check('conversion records itself and reports what the previous shift runs', conv.mark && conv.legacy && conv.legacyUsed > 0 && conv.reported, conv);
  c.check('loading a converted save again changes nothing', JSON.stringify(conv.legacyAgain) === JSON.stringify(conv.legacy) && near(conv.salAgain, conv.after.sal) && conv.logsAgain === 1, conv);
  c.check('machines bought after conversion need crew', conv.idleAfterBuy === 1, conv);

  const reborn = await ev(() => {
    const H = HUM;
    const r = H.S.run;
    r.level = 3; r.stats.salvage = 1e9;
    H.S.memories = { friends: 1, hoard: 1 };
    const preview = H.dvPreview();
    H.Exp.session['EXP-CREW-AUTOMATION'] = false;
    const previewOff = H.dvPreview();
    H.Exp.session['EXP-CREW-AUTOMATION'] = true;
    const ok = H.noclip();
    const n = H.S.run;
    const res = { ok, preview, previewOff, legacy: n.ext.crew, radio: n.upgrades.radio === true, total: n.crew.total, facs: { ...n.facilities }, mark: !!H.S.ext.crew };
    H.replaceState(H.sanitizeState(JSON.parse(JSON.stringify(H.S))));
    res.legacyAfterLoad = H.S.run.ext.crew;
    return res;
  });
  c.check('Déjà Vu from a noclip is the same with the experiment on or off', reborn.ok && reborn.preview === reborn.previewOff, reborn);
  c.check('a noclip ends the previous shift, and reloading does not bring it back', reborn.legacy === undefined && reborn.legacyAfterLoad === undefined && reborn.mark, reborn);
  c.check('Old Friends and Habitual Hoarding work as before', reborn.radio && reborn.total === 3 && reborn.facs.cart === 10 && reborn.facs.bench === 5 && reborn.facs.beacon === 2, reborn);

  // ------------------------------------------------------------- where the upgrades live
  const homes = await ev(() => {
    const H = HUM;
    const ids = ['radio', 'bunks', 'whistle', 'canteens', 'lanterns', 'nightwatch', 'ledger', 'shifts', 'overtime', 'roster', 'gangs', 'nightcrew'];
    return { crew: ids.filter((id) => H.upgradeHome(H.UPG[id]) === 'crew'), others: H.UPGRADES.filter((u) => H.upgradeHome(u) === 'crew' && !ids.includes(u.id)).map((u) => u.id) };
  });
  c.check('crew upgrades and the shift upgrades are listed in the Crew tab', homes.crew.length === 12 && homes.others.length === 0, homes);

  // Locked Crew tab: the radio is requisitioned there.
  await ev(() => {
    const H = HUM; H.rt.saveBlocked = true;
    H.replaceState(H.sanitizeState({ v: 1 }));
    const r = H.S.run;
    r.flags.water = true; r.rooms = 30; r.salvage = 90; r.facilities = { cart: 5 }; r.upgrades.flashlight = true;
    H.S.seen.tab_crew = true; H.S.seen.tab_upgrades = true;
    H.UI.selectTab('upgrades');
  });
  await page.waitForTimeout(150);
  const upgTab = await ev(() => [...document.querySelectorAll('#panel-upgrades .slip h3')].map((h) => h.textContent));
  c.check('the Upgrades tab no longer lists the Shortwave Radio', !upgTab.includes('Shortwave Radio'), upgTab);
  const objective = await ev(() => document.getElementById('objective').textContent);
  c.check('the objective says where the radio is', /Shortwave Radio in the Crew tab/.test(objective), objective);
  await page.click('#tab-crew');
  await page.waitForTimeout(150);
  const locked = await ev(() => ({ slips: [...document.querySelectorAll('#panel-crew .slip h3')].map((h) => h.textContent), text: document.getElementById('panel-crew').textContent }));
  c.check('the locked Crew tab offers the radio', locked.slips.length === 1 && locked.slips[0] === 'Shortwave Radio' && /Shortwave Radio above/.test(locked.text), locked);
  await page.click('#panel-crew .slip [data-action="buy-upg"]');
  await page.waitForTimeout(150);
  const bought = await ev(() => ({ radio: HUM.S.run.upgrades.radio, salvage: HUM.S.run.salvage, roster: !!document.querySelector('#panel-crew [data-action="hire"]'), ops: !!document.querySelector('#panel-crew .ops') }));
  // It cost all 90 salvage held; what is left is a moment of production since.
  c.check('buying the radio in the Crew tab charges 90 and opens the roster', bought.radio === true && bought.salvage < 2 && bought.roster && bought.ops, bought);

  // Unlocked: operation summary, job notes, requisitions, tab dot.
  await ev(() => {
    const H = HUM, r = H.S.run;
    r.salvage = 1e5; r.aw = 50;
    r.facilities = { cart: 30, bench: 12, condenser: 6, beacon: 5 };
    r.crew.total = 6; r.crew.jobs = { scavenge: 3, chart: 0, dowse: 1, watch: 0, archive: 0 };
    H.rt.structureDirty = true; H.UI.update(true);
  });
  await page.waitForTimeout(150);
  const panel = await ev(() => ({
    sum: document.querySelector('#panel-crew .ops-sum').textContent,
    lines: [...document.querySelectorAll('#panel-crew .ops-line')].filter((l) => !l.hidden).map((l) => l.textContent),
    notes: [...document.querySelectorAll('#panel-crew .rows .ops-note')].map((n) => n.textContent),
    req: [...document.querySelectorAll('#panel-crew .ops-req .slip h3')].map((h) => h.textContent),
  }));
  c.check('the Crew tab summarises who runs what', /Your crew run \d+ of 53 machines/.test(panel.sum) && /Crew work makes \d+% of your salvage/.test(panel.sum) && panel.lines.length === 3, panel);
  c.check('job rows say how many more crew would run every machine', panel.notes.some((t) => /5 beacons idle\. 2 more Cartographers would run them all\./.test(t)), panel.notes);
  c.check('crew requisitions are listed in the Crew tab', panel.req.includes('Inventory Ledger') || panel.req.includes('Duty Roster'), panel.req);
  const dot = await ev(() => { HUM.UI.selectTab('facilities'); HUM.UI.update(true); return !document.querySelector('#tab-crew .dot').hidden; });
  c.check('the Crew tab shows a dot when a crew requisition is affordable', dot === true, dot);

  const fac = await ev(() => ({ sub: document.querySelector('#panel-facilities .panel-sub').textContent, cart: document.querySelector('#panel-facilities .rows .row').textContent }));
  c.check('the Facilities tab explains staffing and shows it on each row', /crew member/.test(fac.sub) && /\d+\/30 running/.test(fac.cart) && /nobody on them, working at 25%/.test(fac.cart), fac);

  // ------------------------------------------------------------- switching it off and on
  const off = await ev(() => {
    const H = HUM;
    const near = (a, b) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
    const mark = JSON.stringify(H.S.ext.crew);
    H.Exp.set('EXP-CREW-AUTOMATION', false);
    const D = H.derive();
    H.UI.selectTab('crew'); H.rt.structureDirty = true; H.UI.update(true);
    const res = {
      ops: D.ops, cart: near(D.fac.cart.total, D.fac.cart.each * 30), sal: D.facSalvage,
      home: H.upgradeHome(H.UPG.radio), roster: H.UPGRADES.some((u) => u.id === 'roster' && H.upgradeAvailable(u)),
      panelOps: !!document.querySelector('#panel-crew .ops'), panelReq: !!document.querySelector('#panel-crew .ops-req'),
    };
    H.UI.selectTab('facilities'); H.UI.update(true);
    res.facSub = document.querySelector('#panel-facilities .panel-sub').textContent;
    res.facNote = !!document.querySelector('#panel-facilities .ops-note:not([hidden])');
    H.Exp.set('EXP-CREW-AUTOMATION', true);
    res.markKept = JSON.stringify(H.S.ext.crew) === mark;
    res.backOn = !!H.derive().ops;
    H.Exp.reset();
    return res;
  });
  c.check('switched off, every machine produces in full, as originally', off.ops === undefined && off.cart, off);
  c.check('switched off, crew upgrades return to the Upgrades tab and new ones disappear', off.home === 'upgrades' && off.roster === false, off);
  c.check('switched off, the Crew and Facilities tabs look as they did', !off.panelOps && !off.panelReq && /^Facilities run whether you watch or not/.test(off.facSub) && !off.facNote, off);
  c.check('switched back on, staffing returns without converting the save again', off.backOn && off.markKept, off);

  c.finish(g.errors);
  await g.browser.close();
})();
