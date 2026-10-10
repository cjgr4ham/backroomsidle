// EXP-LATE-FACILITIES: two more facilities in the Level 4 wave and two in the Level 5 wave. None produces anything on
// its own; each joins its level's wave, has three tiers, and disappears without a trace when switched off, keeping
// what you own of it.
const { open, Checker } = require('./harness');

const NEW = ['copier', 'tubes', 'lathe', 'relay'];

(async () => {
  const c = new Checker('EXP-LATE-FACILITIES: late facilities');
  const g = await open('');
  const { ev } = g;

  const waves = await ev(() => {
    const H = HUM;
    H.replaceState(H.sanitizeState({ v: 2 }));
    H.rt.saveBlocked = true;
    H.enterLevel(3);
    H.UI.selectTab('facilities'); H.UI.update(true);
    const coming = [...document.querySelectorAll('#panel-facilities .fs-wave')].map((w) => [w.querySelector('h4').textContent, [...w.querySelectorAll('li')].map((li) => li.dataset.id)]);
    H.enterLevel(4);
    const open4 = H.facs().filter(H.facVisible).map((f) => f.id);
    H.enterLevel(5);
    const open5 = H.facs().filter(H.facVisible).map((f) => f.id);
    return { coming, open4, open5, codes: ['copier', 'tubes', 'lathe', 'relay'].map((id) => H.FAC[id].code + ' ' + H.FAC[id].level + ' ' + H.FAC[id].kind) };
  });
  c.check('the coming waves list the new facilities with their level', JSON.stringify(waves.coming) === JSON.stringify([
    ['Next wave: Level 4: The Night Office', ['switchboard', 'copier', 'tubes']], ['Later wave: Level 5: The Long Hallway', ['fold', 'lathe', 'relay']]]), waves.coming);
  c.check('reaching Level 4 opens the whole wave, Level 5 the next', waves.open4.includes('copier') && waves.open4.includes('tubes') && !waves.open4.includes('lathe') && waves.open5.includes('lathe') && waves.open5.includes('relay'), waves);
  c.check('codes, waves and kinds', waves.codes.join('|') === 'F-12 4 share|F-13 4 survey|F-14 5 salvage|F-15 5 share', waves.codes);

  const fx = await ev(() => {
    const H = HUM;
    H.replaceState(H.sanitizeState({ v: 2 }));
    H.rt.saveBlocked = true;
    H.enterLevel(5);
    H.S.run.salvage = 1e15;
    const D0 = H.derive();
    const out = { sps0: D0.sps, pow0: D0.surveyPower, rps0: D0.roomsPerSurvey, facM0: D0.facMult, noise0: D0.noise };
    // Nothing produces on its own: no specialist, no passive income, whatever is bought.
    for (const id of ['copier', 'tubes', 'lathe', 'relay']) H.buyFacility(id, { n: 1 });
    const D1 = H.derive();
    out.noPassive = D1.sps === 0 && D1.aws === 0 && D1.eps === 0 && D1.autoSurveys === 0;
    out.lathePoints = D1.facMult - D0.facMult;
    out.facBoost = D1.facBoost;
    out.rps1 = D1.roomsPerSurvey;
    out.noise1 = D1.noise;
    // The Copier: a share of specialist work
    H.S.run.specialists = { scavenge: 10 };
    const a = H.derive().sps;
    H.buyFacility('copier', { n: 4 });   // 5 owned
    const b = H.derive().sps;
    out.copierRatio = b / a;   // (1 + 5 × 0.04) / (1 + 1 × 0.04)
    // The Relay: research started now is faster; one under way keeps its time.
    H.S.echoes = 1e6;
    const t0 = H.researchTime(H.RES.pattern);
    H.buyFacility('relay', { n: 3 });    // 4 owned: +20% speed
    out.relayTime = H.researchTime(H.RES.pattern) / t0;   // 1 owned before (1.05), 4 owned now (1.2)
    // Prices: exact, the same curve as every facility
    out.price = [H.unitQuote(H.FAC.lathe, 1).cost, Math.ceil(2e11 * 1.22)];
    return out;
  });
  c.check('none of them produces anything on its own', fx.noPassive, fx);
  c.check('the Lathe adds 600 × facility bonuses to the facility multiplier', Math.abs(fx.lathePoints - 600 * fx.facBoost) < 1e-6 * fx.lathePoints, fx);
  c.check('the Tube Network adds 10% rooms per survey per unit', Math.abs(fx.rps1 / fx.rps0 - 1.1) < 1e-9, fx);
  c.check('each Copier adds 4% to specialist work', Math.abs(fx.copierRatio - 1.2 / 1.04) < 1e-9, fx);
  c.check('each Relay makes research started after it 5% faster', Math.abs(fx.relayTime - 1.05 / 1.2) < 1e-9, fx);
  c.check('they make noise like other facilities', fx.noise1 > fx.noise0, fx);
  c.check('prices follow the exact geometric curve', fx.price[0] === fx.price[1], fx.price);

  const tiers = await ev(() => {
    const H = HUM;
    H.replaceState(H.sanitizeState({ v: 2 }));
    H.rt.saveBlocked = true;
    H.enterLevel(5);
    H.S.run.salvage = 1e18;
    H.S.run.specialists = { scavenge: 10 };
    const list = ['copier', 'tubes', 'lathe', 'relay'].map((id) => H.UPGRADES.filter((u) => u.fac === id).map((u) => [u.id, u.req.n, u.cid]));
    H.buyFacility('copier', { n: 10 });
    const before = H.derive().sps;
    const ok = H.buyUpgrade('tier_copier_0');
    const after = H.derive().sps;
    H.UI.selectTab('facilities'); H.UI.update(true);
    const row = document.querySelector('#panel-facilities [data-fac="copier"]');
    return { list, ok, ratio: after / before, text: row && row.querySelector('.fs-effect').textContent, tier: row && row.querySelector('.tier-line').textContent };
  });
  c.check('each has three tiers at 10, 25 and 50 owned, switched with it', tiers.list.every((l) => l.length === 3 && l.map((x) => x[1]).join() === '10,25,50' && l.every((x) => x[2] && x[2].startsWith('facility:'))), tiers.list);
  c.check('a support tier multiplies its share by 1.5', tiers.ok && Math.abs(tiers.ratio - (1 + 10 * 0.06) / (1 + 10 * 0.04)) < 1e-9, tiers);
  c.check('the row says what each one does, in fixed words', /^Each: \+6% specialist work · 10 owned: \+60% · noise /.test(tiers.text) && /Tiers 1\/3/.test(tiers.tier), tiers);

  // Switched off: gone from every list, no effect, nothing purchasable; what you own is kept and returns intact.
  const off = await ev(() => {
    const H = HUM, E = H.Exp;
    H.replaceState(H.sanitizeState({ v: 2 }));
    H.rt.saveBlocked = true;
    H.enterLevel(5);
    H.S.run.salvage = 1e18;
    H.S.run.specialists = { scavenge: 10 };
    const base = H.derive();
    for (const id of ['copier', 'tubes', 'lathe', 'relay']) H.buyFacility(id, { n: 12 });
    H.buyUpgrade('tier_copier_0');
    const on = H.derive();
    const salvageBefore = H.S.run.salvage;
    E.set('EXP-LATE-FACILITIES', false);
    const D = H.derive();
    H.UI.selectTab('facilities'); H.UI.update(true);
    const out = {
      same: D.sps === base.sps && D.surveyPower === base.surveyPower && D.roomsPerSurvey === base.roomsPerSurvey && D.noise === base.noise && D.facMult === base.facMult,
      changed: on.sps !== base.sps,
      listed: document.querySelectorAll('#panel-facilities [data-fac="copier"], #panel-facilities [data-fac="lathe"]').length,
      total: H.totalFacilities(),
      buy: H.buyFacility('lathe', { n: 1 }) || H.buyUpgrade('tier_copier_1'),
      kept: [H.S.run.facilities.copier, H.S.run.facilities.lathe, H.S.run.upgrades.tier_copier_0],
      salvageSame: H.S.run.salvage === salvageBefore,
    };
    const round = H.sanitizeState(JSON.parse(JSON.stringify(H.S)));
    out.roundKept = [round.run.facilities.copier, round.run.facilities.relay, round.run.upgrades.tier_copier_0];
    E.set('EXP-LATE-FACILITIES', true);
    const back = H.derive();
    out.back = back.sps === on.sps && back.surveyPower === on.surveyPower && back.roomsPerSurvey === on.roomsPerSurvey;
    out.countsAfter = [H.S.run.facilities.copier, H.S.run.facilities.lathe];
    // One facility on its own
    E.setItem('facility:lathe', false);
    const one = H.derive();
    out.single = one.facMult < back.facMult && one.sps === back.sps && one.roomsPerSurvey === back.roomsPerSurvey && !H.facs().some((f) => f.id === 'lathe') && H.facs().some((f) => f.id === 'copier');
    E.setItem('facility:lathe', true);
    E.reset();
    return out;
  });
  c.check('switched off: every number is exactly the game without them, though they are owned', off.same && off.changed, off);
  c.check('switched off: not listed, not counted in the facility total, not purchasable', off.listed === 0 && off.buy === false && off.total === 0, off);
  c.check('switched off: counts and tiers are kept, also through a save round trip, and no salvage changes', off.kept.join() === '12,12,true' && off.roundKept.join() === '12,12,true' && off.salvageSame, off);
  c.check('switched back on: the same numbers as before, nothing granted twice', off.back && off.countsAfter.join() === '12,12', off);
  c.check('one facility can be switched off on its own (facility:lathe)', off.single, off);

  const reb = await ev(() => {
    const H = HUM;
    H.replaceState(H.sanitizeState({ v: 2 }));
    H.rt.saveBlocked = true;
    H.enterLevel(5);
    H.completeFiniteSurvey(0);
    H.S.run.salvage = 1e18; H.S.run.stats.salvage = 1e13;
    H.buyFacility('lathe', { n: 3 });
    H.noclip();
    return { lathe: H.S.run.facilities.lathe || 0, level: H.S.run.level };
  });
  c.check('a noclip resets them like every facility', reb.lathe === 0 && reb.level === 0, reb);

  c.finish(g.errors);
  await g.browser.close();
})();
