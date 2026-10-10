// EXP-CREW-EQUIPMENT: kit at level milestones. One piece per milestone and slot, a better piece replacing the one in
// its slot (never two of a kind), base props replaced rather than drawn twice, a Kit line in the Crew tab with or
// without the visible crew, actually drawn on the figures, and nothing at all changed in the game.
const { open, Checker } = require('./harness');

(async () => {
  const c = new Checker('EXP-CREW-EQUIPMENT: crew equipment');
  const g = await open('', null, { manualFrames: true });
  const { ev } = g;

  const kit = await ev(() => {
    const H = HUM, api = H.Exp.ask('kit:api');
    const out = { roles: {}, slotsUnique: true, oneNewPerMilestone: true, recognisable: true };
    for (const id of Object.keys(api.KIT)) {
      const byLevel = {};
      let prev = [];
      for (const lvl of [1, 4, 5, 14, 15, 29, 30, 44, 45, 60]) {
        const items = api.kitFor(id, lvl);
        byLevel[lvl] = items.map((x) => x.id);
        const slots = items.map((x) => x.slot);
        if (new Set(slots).size !== slots.length) out.slotsUnique = false;
        if (api.MILESTONES.includes(lvl)) {
          const added = items.filter((x) => !prev.some((p) => p.id === x.id));
          if (added.length !== 1 || added[0].at !== lvl) out.oneNewPerMilestone = false;
        }
        prev = items;
      }
      out.roles[id] = byLevel;
      if (new Set(api.KIT[id].map((x) => x.id)).size !== 4) out.recognisable = false;
    }
    // Replacements: a better piece takes the old one's slot.
    out.torch = api.kitFor('scavenge', 45).map((x) => x.id);
    out.laser = api.kitFor('chart', 45).map((x) => x.id);
    out.pendulum = api.kitFor('dowse', 45).map((x) => x.id);
    // Base props replaced, not drawn twice: the Scavenger's sack goes once the trolley comes.
    const hides = (id, lvl) => { H.S.run.specialists = { [id]: lvl }; const h = {}; H.Exp.run('crew:kitHide', { id }, h); return Object.keys(h).sort().join(); };
    out.hides = { sack29: hides('scavenge', 29), sack30: hides('scavenge', 30), notebook: hides('chart', 15), bucket: hides('dowse', 30), beam: hides('watch', 15), recorder: hides('archive', 30), none: hides('archive', 14) };
    return out;
  });
  c.check('four milestones per role (5, 15, 30, 45), each bringing exactly one new piece', kit.oneNewPerMilestone && kit.recognisable, kit.roles);
  c.check('never two pieces in one slot: a better piece replaces the old (cutting torch for crowbar, theodolite for tripod, pendulum for rod)',
    kit.slotsUnique && !kit.torch.includes('crowbar') && kit.torch.includes('torch') && !kit.laser.includes('tripod') && kit.laser.includes('laser') && !kit.pendulum.includes('divining'), kit);
  c.check('kit that replaces a base prop hides it (sack, notebook, bucket, beam, recorder), only from its milestone on',
    kit.hides.sack29 === '' && kit.hides.sack30 === 'sack' && kit.hides.notebook === 'notebook' && kit.hides.bucket === 'bucket' && kit.hides.beam === 'beam' && kit.hides.recorder === 'recorder' && kit.hides.none === '', kit.hides);

  const tab = await ev(() => {
    const H = HUM;
    H.replaceState(H.sanitizeState({ v: 2 }));
    H.rt.saveBlocked = true;
    H.S.run.specialists = { scavenge: 4, chart: 15, dowse: 60 };
    H.S.seen.tab_crew = true; H.UI.selectTab('crew');
    H.UI.update(true);
    const row = (id) => document.querySelector(`.row.spec[data-spec="${id}"] .spec-kit`);
    const out = { scavenge: row('scavenge').textContent, chart: row('chart').textContent, dowse: row('dowse').textContent, watchHidden: row('watch').hidden };
    // Crossing a milestone updates the line; nothing changes while the level stays the same.
    H.S.run.specialists.scavenge = 5;
    H.UI.update(true);
    out.after = row('scavenge').textContent;
    let mutations = 0;
    const mo = new MutationObserver((l) => { mutations += l.length; });
    mo.observe(row('scavenge'), { subtree: true, childList: true, characterData: true, attributes: true });
    for (let i = 0; i < 30; i++) H.UI.update();
    mo.disconnect();
    out.mutations = mutations;
    // Switched off, the line goes; on again, it is back.
    H.Exp.set('EXP-CREW-EQUIPMENT', false);
    H.UI.update(true);
    out.off = !document.querySelector('.spec-kit');
    H.Exp.set('EXP-CREW-EQUIPMENT', true);
    H.UI.update(true);
    out.on = !!document.querySelector('.spec-kit');
    return out;
  });
  c.check('the Crew tab says what each carries and what comes next',
    tab.scavenge === 'Kit: standard issue · level 5: crowbar' && tab.chart === 'Kit: survey rod, mapping tablet · level 30: tripod level'
      && tab.dowse === 'Kit: water tank, wheeled barrel, brass pendulum · complete' && tab.watchHidden, tab);
  c.check('crossing a milestone updates the line, and nothing in it changes while the level stays the same', tab.after === 'Kit: crowbar · level 15: headlamp' && tab.mutations === 0, tab);
  c.check('switched off the line goes, on again it is back', tab.off && tab.on, tab);

  const drawn = await ev(() => {
    const H = HUM;
    H.replaceState(H.sanitizeState({ v: 2 }));
    H.rt.saveBlocked = true;
    H.S.settings.crt = false; H.S.settings.flicker = false;
    H.S.settings.motion = 'reduce'; H.rt.reducedMotion = true;   // still poses: frames repeat exactly while nothing changes
    H.S.run.nextAnomalyAt = H.S.time + 1e9;
    H.S.run.specialists = { scavenge: 1, chart: 1 };
    let T = (window.__T || 1000);
    const frame = () => { T += 40; H.View.render(T); window.__T = T; return H.View.canvas.toDataURL(); };
    for (let i = 0; i < 40; i++) frame();
    const a = frame(), b = frame();
    H.S.run.specialists = { scavenge: 45, chart: 45 };
    const k = frame();
    H.S.settings.motion = 'auto'; H.rt.reducedMotion = false;
    return { still: a === b, differs: b !== k };
  });
  c.check('the kit is actually drawn: the same still scene differs once the crew reach level 45', drawn.still && drawn.differs, drawn);
  c.check('no console or page errors so far', g.errors.length === 0, g.errors.slice(0, 5));
  await g.browser.close();

  // The same seeded session, rendered every frame, with the equipment on and off: the game must not differ at all.
  const session = (seed) => {
    let a = seed >>> 0;
    Math.random = () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const H = HUM;
    H.UI.floatGain = () => {};
    H.replaceState(H.sanitizeState({ v: 2 }));
    H.rt.saveBlocked = true;
    H.rt.checkAcc = 0; H.rt.autobuyAcc = 0;
    H.S.run.specialists = { scavenge: 44, chart: 29, dowse: 14, watch: 4, archive: 46 };
    H.S.run.salvage = 1e12;
    let T = 5000;
    for (let i = 0; i < 1500; i++) {
      if (i % 4 === 0) { H.rt.lastSurveyReal = -1e9; H.survey(); }
      if (i % 100 === 0) { H.hireSpecialist('scavenge'); H.hireSpecialist('chart'); H.hireSpecialist('dowse'); H.hireSpecialist('watch'); }
      H.step(0.1, false);
      T += 40; H.View.render(T);
      if (i % 10 === 0) H.UI.update();
    }
    return JSON.stringify(H.S, (k, v) => (k === 'created' || k === 'lastSaved' ? undefined : v));
  };
  const on = await open('', null, { manualFrames: true });
  const off = await open('?exp=-EXP-CREW-EQUIPMENT', null, { manualFrames: true });
  const [sOn, sOff] = await Promise.all([on.ev(session, 5), off.ev(session, 5)]);
  c.check('zero effect on the game: the same seeded session ends in the same state with the equipment on and off', sOn === sOff && sOn.length > 1000, { on: sOn.length, off: sOff.length });
  const crewOff = await open('?exp=-EXP-CREW-VISIBLE', null, { manualFrames: true });
  const alone = await crewOff.ev(() => {
    const H = HUM;
    H.replaceState(H.sanitizeState({ v: 2 }));
    H.rt.saveBlocked = true;
    H.S.run.specialists = { archive: 31 };
    H.S.seen.tab_crew = true; H.UI.selectTab('crew');
    H.UI.update(true);
    return document.querySelector('.row.spec[data-spec="archive"] .spec-kit').textContent;
  });
  c.check('with the visible crew off, the Crew tab still lists the kit', alone === 'Kit: satchel of tapes, boom microphone, reel-to-reel recorder · level 45: antenna pack', alone);
  c.check('no console or page errors on or off', [on, off, crewOff].every((x) => x.errors.length === 0), [...on.errors, ...off.errors, ...crewOff.errors].slice(0, 4));
  for (const x of [on, off, crewOff]) await x.browser.close();
  c.finish();
})();
