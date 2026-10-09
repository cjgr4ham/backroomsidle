// EXP-FACILITY-INDEPENDENCE: no facility needs crew to be bought, built or run.
const { open, Checker } = require('./harness');
const ID = 'EXP-FACILITY-INDEPENDENCE';

/** Every facility, bought five at a time by a player with no crew at all, on Level 5 with plenty of salvage. */
function buyEverything() {
  const H = HUM;
  H.replaceState(H.sanitizeState({ v: 1 }));
  H.rt.saveBlocked = true;
  const r = H.S.run;
  Object.assign(r, { level: 5, rooms: 1e6, levelRooms: 0, salvage: 1e15 });
  r.flags.water = true;
  H.setBuyMode(1);
  const bought = [];
  for (const f of H.FACILITIES) {
    let n = 0;
    for (let i = 0; i < 5; i++) if (H.buyFacility(f.id)) n++;
    bought.push([f.id, H.facVisible(f), n, r.facilities[f.id] || 0]);
  }
  const D = H.derive();
  const near = (a, b) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
  return {
    crew: r.crew.total, bought,
    full: H.FACILITIES.every((f) => near(D.fac[f.id].total, D.fac[f.id].each * r.facilities[f.id])),
    ops: D.ops === undefined,
    rates: { sal: D.facSalvage, aws: D.aws, eps: D.eps, surveys: D.autoSurveys, absorb: D.absorb, noise: D.noise },
  };
}

(async () => {
  const c = new Checker('EXP-FACILITY-INDEPENDENCE: facilities never need crew');

  // ------------------------------------------------------------- with the game's defaults (every default experiment on)
  const g = await open('');
  const { ev, page } = g;
  const on = await ev(buyEverything);
  c.check('the experiment is on by default', await ev(() => HUM.Exp.on('EXP-FACILITY-INDEPENDENCE')));
  c.check('a player with no crew can buy every facility once its level and other requirements are met',
    on.crew === 0 && on.bought.every(([, vis, n, have]) => vis && n === 5 && have === 5), on.bought);
  c.check('with no crew, every facility produces its full output', on.full && on.ops, on);
  c.check('no facility has a crew requirement', await ev(() => HUM.FACILITIES.every((f) => !f.req || f.req.crew == null)));

  // The same machines produce exactly what they produce in the original game.
  const orig = await open('?exp=none');
  const base = await orig.ev(buyEverything);
  await orig.browser.close();
  c.check('facility output with every default experiment on equals the original game, for every resource',
    JSON.stringify(on.rates) === JSON.stringify(base.rates), { on: on.rates, original: base.rates });

  // Crew are a separate system: assigning them never gates a machine, scavengers add their documented bonus once.
  const crew = await ev(() => {
    const H = HUM, r = H.S.run;
    const before = H.derive();
    r.upgrades.radio = true; r.crew.total = 20;
    r.crew.jobs = { scavenge: 0, chart: 6, dowse: 6, watch: 4, archive: 4 };
    const jobs = H.derive();
    r.crew.jobs = { scavenge: 10, chart: 4, dowse: 2, watch: 2, archive: 2 };
    const scav = H.derive();
    const facOnly = (D) => H.FACILITIES.filter((f) => f.kind === 'salvage').reduce((n, f) => n + D.fac[f.id].total, 0);
    return {
      sameMachines: H.FACILITIES.every((f) => f.kind === 'salvage' || Math.abs(jobs.fac[f.id].total - before.fac[f.id].total) < 1e-9),
      salvageMachines: Math.abs(facOnly(jobs) - facOnly(before)) < 1e-9 * facOnly(before),
      boost: scav.scavengeBoost, ratio: facOnly(scav) / facOnly(before), crewSal: scav.crewSalvage,
    };
  });
  c.check('assigning crew to jobs leaves every machine’s output unchanged', crew.sameMachines && crew.salvageMachines, crew);
  c.check('scavengers add their documented +5% facility salvage each, once', Math.abs(crew.boost - 1.5) < 1e-9 && Math.abs(crew.ratio - 1.5) < 1e-9 && crew.crewSal > 0, crew);

  // Time away with no crew pays the full rate.
  const away = await ev(() => {
    const H = HUM;
    H.replaceState(H.sanitizeState({ v: 1, run: { level: 0, rooms: 10, facilities: { cart: 40, bench: 20 } } }));
    H.rt.saveBlocked = true;
    const D = H.derive();
    const s0 = H.S.run.stats.salvage;
    H.catchUp(600);
    return { rate: D.facSalvage, got: H.S.run.stats.salvage - s0, crew: H.S.run.crew.total };
  });
  c.check('ten minutes away with no crew earn the full facility rate', away.crew === 0 && Math.abs(away.got - away.rate * 600) <= 0.02 * away.rate * 600, away);

  // The interface says so.
  const ui = await ev(() => {
    HUM.UI.selectTab('facilities'); HUM.UI.update(true);
    const p = document.getElementById('panel-facilities');
    return { sub: p.querySelector('.panel-sub').textContent, notes: p.querySelectorAll('.ops-note:not([hidden])').length, running: /running/.test(p.textContent) };
  });
  c.check('the Facilities tab says facilities run with or without crew, with no staffing notes', /full output with or without crew/.test(ui.sub) && ui.notes === 0 && !ui.running, ui);

  // ------------------------------------------------------------- switching it off brings the staffing rule back, and on again removes it
  // (only meaningful while EXP-CREW-AUTOMATION, which owns the staffing rule, is in this build)
  const hasCrew = await ev(() => !!HUM.Exp.defs['EXP-CREW-AUTOMATION']);
  if (hasCrew) {
  const toggle = await ev(() => {
    const H = HUM;
    H.replaceState(H.sanitizeState({ v: 1, run: { facilities: { cart: 30 } } }));
    H.rt.saveBlocked = true;
    const full = H.derive().fac.cart.total;
    H.Exp.set('EXP-FACILITY-INDEPENDENCE', false);
    // The crew experiment converts the save as it always does: machines already built keep running (the
    // previous shift), and machines built from now on need crew.
    const converted = H.derive();
    H.S.run.salvage = 1e9; H.setBuyMode(10); H.buyFacility('cart');
    const staffed = H.derive();
    const res = { full, convertedTotal: converted.fac.cart.total, staffedTotal: staffed.fac.cart.total, each: staffed.fac.cart.each, staffedOps: !!staffed.ops, converted: !!H.S.ext.crew };
    H.Exp.set('EXP-FACILITY-INDEPENDENCE', true);
    const again = H.derive();
    res.again = again.fac.cart.total; res.againOps = !!again.ops;
    H.Exp.reset();
    return res;
  });
  c.check('switched off, the crew staffing rule returns: existing machines keep running, new ones with nobody on them work at 25%',
    toggle.staffedOps && toggle.converted && Math.abs(toggle.convertedTotal - toggle.full) < 1e-9 && Math.abs(toggle.staffedTotal - toggle.each * (30 + 10 * 0.25)) < 1e-9, toggle);
  c.check('switched on again, every machine is back at full output at once', !toggle.againOps && Math.abs(toggle.again - toggle.each * 40) < 1e-9, toggle);
  } else console.log('  (staffing toggle not checked: EXP-CREW-AUTOMATION is not in this build)');

  // ------------------------------------------------------------- alone with the crew experiment, and without it
  const solo = await open(`?exp=none,EXP-CREW-AUTOMATION,${ID}`);
  const s = await solo.ev(buyEverything);
  c.check('with only the crew experiment and this one on, no crew are needed either', s.crew === 0 && s.full && s.ops && s.bought.every(([, , n]) => n === 5), s);
  await solo.browser.close();
  const without = await open(`?exp=none,${ID}`);
  const w = await without.ev(buyEverything);
  c.check('without the crew experiment it changes nothing (there is no staffing rule to switch off)', JSON.stringify(w.rates) === JSON.stringify(base.rates), w.rates);
  await without.browser.close();

  c.finish(g.errors);
  await g.browser.close();
  void page;
})();
