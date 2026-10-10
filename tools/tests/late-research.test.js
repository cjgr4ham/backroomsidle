// EXP-LATE-RESEARCH: six research projects that open once Level 4 or 5 has been reached, two of them repeatable with
// their own ranks. Research stays timed and one project at a time. Switched off, a project under way is set aside
// (already paid) and resumes when it comes back.
const { open, Checker } = require('./harness');

const IDS = ['late_filing', 'late_acoustics', 'late_logistics', 'late_crewcraft', 'late_cartography', 'late_signal'];

(async () => {
  const c = new Checker('EXP-LATE-RESEARCH: late research');
  const g = await open('');
  const { ev } = g;

  const gate = await ev((ids) => {
    const H = HUM;
    H.replaceState(H.sanitizeState({ v: 2 }));
    H.rt.saveBlocked = true;
    for (const R of H.RESEARCH) if (!R.repeatable && !R.cid) H.S.research[R.id] = true;   // every older project done
    const avail = () => ids.filter((id) => H.RES[id] && (H.RES[id].req.every((r) => H.S.research[r] === true) && (H.RES[id].reqLevel == null || H.S.life.maxLevel >= H.RES[id].reqLevel)));
    const out = { l3: (H.enterLevel(3), avail()) };
    out.l4 = (H.enterLevel(4), avail());
    H.S.research.late_logistics = true;
    H.S.research.late_crewcraft = true;   // Signal Theory needs Crew Craft
    out.l5 = (H.enterLevel(5), avail());
    // The deepest level ever reached counts: after a noclip they stay open.
    H.completeFiniteSurvey(0); H.S.run.stats.salvage = 1e13; H.noclip();
    out.afterNoclip = avail();
    out.level = H.S.run.level;
    out.cids = ids.map((id) => H.RES[id].cid).join();
    out.tier = ids.map((id) => H.RES[id].tier).join();
    out.repeat = ids.filter((id) => H.RES[id].repeatable).join();
    return out;
  }, IDS);
  c.check('nothing opens before Level 4, even with every prerequisite researched', gate.l3.length === 0, gate);
  c.check('Level 4 opens Filing Theory, Corridor Acoustics and Night Logistics', gate.l4.join() === 'late_filing,late_acoustics,late_logistics', gate);
  c.check('Level 5 opens Crew Craft and the two repeatable projects (with their prerequisites)', gate.l5.join() === IDS.join(), gate);
  c.check('they stay open after a noclip: the deepest level ever reached counts', gate.afterNoclip.join() === IDS.join() && gate.level === 0, gate);
  c.check('stable content ids, a sixth tier, two repeatables', gate.cids === IDS.map((id) => `research:${id}`).join() && gate.tier === '5,5,5,5,5,5' && gate.repeat === 'late_cartography,late_signal', gate);

  const fx = await ev(() => {
    const H = HUM;
    H.replaceState(H.sanitizeState({ v: 2 }));
    H.rt.saveBlocked = true;
    for (const R of H.RESEARCH) if (!R.repeatable && !R.cid) H.S.research[R.id] = true;
    H.enterLevel(5);
    H.S.echoes = 1e7;
    H.S.run.specialists = { scavenge: 8, chart: 4 };
    H.S.run.facilities = { switchboard: 5 };
    const D0 = H.derive();
    const m = H.MIS.stairwell;
    const t0 = H.researchTime(H.RES.late_acoustics), dur0 = H.missionDuration(m);
    const run = (id) => { const ok = H.doResearch(id); const A = H.S.researching; const one = { ok, busy: H.canResearch(H.RES.late_crewcraft), time: A ? A.end - A.start : 0 }; H.step(one.time + 0.01, true); return one; };
    const out = { filing: run('late_filing') };
    out.timeAfterFiling = H.researchTime(H.RES.late_acoustics) / t0;
    out.acoustics = run('late_acoustics');
    out.logistics = run('late_logistics');
    // Same moment, with and without it (achievements earned meanwhile also raise the Scavenger's salvage).
    const withIt = H.missionSalvage(m, H.derive());
    delete H.S.research.late_logistics;
    const without = H.missionSalvage(m, H.derive());
    H.S.research.late_logistics = true;
    out.haul = withIt / without;
    out.crewcraft = run('late_crewcraft');
    const D1 = H.derive();
    out.noise = D1.noise / D0.noise;
    out.absorb = D1.absorb - D0.absorb;
    out.dur = H.missionDuration(m) / dur0;
    out.spec = D1.specEff / D0.specEff;
    return out;
  });
  c.check('each is paid once and runs one at a time', fx.filing.ok && fx.acoustics.ok && fx.logistics.ok && fx.crewcraft.ok && fx.filing.busy === false, fx);
  c.check('Filing Theory: research started afterwards takes 25% less time', Math.abs(fx.timeAfterFiling - 0.75) < 1e-9 && Math.abs(fx.acoustics.time - 600 * 0.75) < 1e-6, fx);
  c.check('Corridor Acoustics: noise ×0.7 and +2 absorption', Math.abs(fx.noise - 0.7) < 1e-9 && Math.abs(fx.absorb - 2) < 1e-9, fx);
  c.check('Night Logistics: missions 25% shorter, ×1.5 salvage', Math.abs(fx.dur - 0.75) < 1e-9 && Math.abs(fx.haul - 1.5) < 1e-9, fx);
  c.check('Crew Craft: specialists ×1.5', Math.abs(fx.spec - 1.5) < 1e-9, fx);

  const ranks = await ev(() => {
    const H = HUM;
    H.replaceState(H.sanitizeState({ v: 2 }));
    H.rt.saveBlocked = true;
    for (const R of H.RESEARCH) if (!R.repeatable) H.S.research[R.id] = true;
    H.enterLevel(5);
    H.S.echoes = 1e8;
    H.S.run.specialists = { scavenge: 8 };
    H.S.deepTheory = 4;
    const C = H.RES.late_cartography, Sg = H.RES.late_signal;
    const rooms0 = H.derive().roomsPerSurvey, spec0 = H.derive().specEff;
    const costs = [H.researchCost(C)];
    const go = (R) => { H.doResearch(R.id); const A = H.S.researching; H.step(A.end - H.S.time + 0.01, true); };
    go(C); costs.push(H.researchCost(C)); go(C);
    go(Sg);
    const out = { cost: costs, rankC: H.rankOf(C), rankS: H.rankOf(Sg), deep: H.S.deepTheory, ext: { ...H.S.ext.ranks },
      rooms: H.derive().roomsPerSurvey / rooms0, spec: H.derive().specEff / spec0, deepCost: H.researchCost(H.RES.deeptheory) };
    H.UI.selectTab('research');
    H.S.seen.echoes = true; H.UI.update(true); H.UI.selectTab('research'); H.UI.update(true);
    const node = [...document.querySelectorAll('#panel-research .node')].find((n) => n.querySelector('[data-id="late_cartography"]'));
    out.node = node ? [node.querySelector('.slip-head span').textContent, node.querySelector('button span').textContent] : null;
    out.tierLabels = [...document.querySelectorAll('#panel-research .tier-label')].map((x) => x.textContent);
    // Through a noclip and a save round trip
    H.completeFiniteSurvey(0); H.S.run.stats.salvage = 1e13; H.noclip();
    const again = H.sanitizeState(JSON.parse(JSON.stringify(H.S)));
    out.kept = again.ext.ranks;
    return out;
  });
  c.check('each repeatable keeps its own rank; Deep Survey Theory keeps its own', ranks.rankC === 2 && ranks.rankS === 1 && ranks.deep === 4 && ranks.deepCost === Math.ceil(60 * Math.pow(2.2, 4)), ranks);
  c.check('cost grows with that project’s own rank', ranks.cost[0] === 8000 && ranks.cost[1] === Math.ceil(8000 * 1.7), ranks.cost);
  c.check('Hallway Cartography +10% rooms per rank; Signal Theory +12% specialist work per rank', Math.abs(ranks.rooms - 1.2) < 1e-9 && Math.abs(ranks.spec - 1.12) < 1e-9, ranks);
  c.check('the Research tab shows the sixth tier and each repeatable’s own rank', ranks.node && ranks.node[0] === 'Rank 2' && ranks.node[1] === 'Research rank 3' && ranks.tierLabels.includes('Tier 6'), ranks);
  c.check('ranks are kept through a noclip and in the save', ranks.kept && ranks.kept.late_cartography === 2 && ranks.kept.late_signal === 1, ranks.kept);

  const off = await ev(() => {
    const H = HUM, E = H.Exp;
    H.replaceState(H.sanitizeState({ v: 2 }));
    H.rt.saveBlocked = true;
    for (const R of H.RESEARCH) if (!R.repeatable && !R.cid) H.S.research[R.id] = true;
    H.enterLevel(5);
    H.S.echoes = 1e8;
    H.S.run.specialists = { scavenge: 8 };
    const base = H.derive();
    H.S.research.late_crewcraft = true; H.S.research.late_logistics = true;
    H.setRank(H.RES.late_cartography, 3);
    const on = H.derive();
    H.doResearch('late_signal');
    const A = { ...H.S.researching };
    H.step(100, false);
    const echoes = H.S.echoes;
    E.set('EXP-LATE-RESEARCH', false);
    H.step(0.1, false);
    const D = H.derive();
    H.S.seen.echoes = true; H.UI.update(true); H.UI.selectTab('research'); H.UI.update(true);
    const out = {
      same: D.specEff === base.specEff && D.roomsPerSurvey === base.roomsPerSurvey,
      kept: H.S.research.late_crewcraft === true && H.rankOf(H.RES.late_cartography) === 3,
      slot: H.S.researching === null && (H.S.ext.resq || []).map((q) => q.id).join() === 'late_signal',
      listed: document.querySelectorAll('#panel-research [data-id^="late_"]').length,
      paused: (document.querySelector('#panel-research .res-paused') || {}).textContent || '',
      canStart: H.canResearch(H.RES.late_signal),
      other: H.doResearch('deeptheory'),
    };
    const deepEnd = H.S.researching.end;
    H.step(deepEnd - H.S.time + 0.01, false);
    E.set('EXP-LATE-RESEARCH', true);
    H.step(0.1, false);
    out.resumed = H.S.researching && H.S.researching.id === 'late_signal' && Math.abs((H.S.researching.end - H.S.time) - (A.end - A.start - 100.1)) < 0.5;
    out.charged = echoes - H.S.echoes;   // only Deep Survey Theory's price since
    out.deepPrice = Math.ceil(60 * Math.pow(2.2, 0));
    const back = H.derive();
    out.back = back.specEff === on.specEff && back.roomsPerSurvey === on.roomsPerSurvey;
    E.setItem('research:late_cartography', false);
    out.single = H.derive().roomsPerSurvey === base.roomsPerSurvey && H.derive().specEff === on.specEff;
    E.reset();
    return out;
  });
  c.check('switched off: every number is the game without them; research done and ranks are kept', off.same && off.kept, off);
  c.check('switched off: a project under way is set aside, already paid, and frees the slot for another', off.slot && off.other && off.canStart === false, off);
  c.check('switched off: not listed; the Research tab says what is set aside', off.listed === 0 && /Set aside, already paid: Signal Theory/.test(off.paused), off);
  c.check('switched back on: the set-aside project resumes with its time left, without a second charge', off.resumed && off.charged === off.deepPrice, off);
  c.check('switched back on: the same numbers as before', off.back, off);
  c.check('one project can be switched off on its own (research:late_cartography)', off.single, off);

  c.finish(g.errors);
  await g.browser.close();
})();
