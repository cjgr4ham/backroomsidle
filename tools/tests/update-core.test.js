// EXP-CORE, update 2.1: the shared infrastructure the update's features build on, tested with probe content so it
// is tested on its own. It has no effect on the game by itself (tools/equivalence-check.js proves that against the
// build before the update); these checks prove each piece works: content switches by content id, content registered
// from a slot, data-driven effects, independent research ranks, research set aside and resumed, dormant facility
// counts and projects, the kept pre-update save, step splitting, mission returns and the purchase extension points.
const fs = require('fs');
const path = require('path');
const { open, Checker } = require('./harness');

const PRE = (name) => JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', `pre-update-${name}.json`), 'utf8'));

(async () => {
  const c = new Checker('EXP-CORE (update 2.1): content switches, effects, ranks, paused research, dormant data');
  const g = await open('');
  const { ev, page, fresh } = g;

  // ---------------------------------------------------------------- content switches
  const sw = await ev(() => {
    const H = HUM, E = H.Exp;
    E.define({ id: 'EXP-PROBE', name: 'Probe' });
    const f = H.Content.facility('EXP-PROBE', { id: 'probefac', code: 'F-99', name: 'Probe Facility', kind: 'salvage', icon: 'cart', level: 0,
      cost: 10, growth: 1.2, bonus: 1, noise: 0, flavor: 'probe', tiers: [{ name: 'T1', flavor: '' }] });
    const u = H.Content.upgrade('EXP-PROBE', { id: 'probeupg', cat: 'Survey', name: 'Probe Requisition', cost: { salvage: 5 }, req: {}, fx: { survey: 2 }, effect: '', flavor: '' });
    const out = {
      cids: [f.cid, u.cid, H.UPG.tier_probefac_0.cid, H.UPG.tier_probefac_0.exp],
      listed: [H.facs().includes(f), H.upgs().includes(u)],
    };
    E.setItem('facility:probefac', false);
    out.offItem = [H.contentOn(f), H.contentOn(H.UPG.tier_probefac_0), H.facs().includes(f), H.contentOn(u)];
    out.stored = JSON.parse(localStorage.getItem('the-hum.content'));
    out.notInSave = !JSON.stringify(H.S).includes('probefac');
    E.setItem('facility:probefac', true);
    out.backOn = H.contentOn(f) && H.facs().includes(f);
    E.set('EXP-PROBE', false);
    out.expOff = [H.contentOn(f), H.contentOn(u), H.facs().includes(f), H.upgs().includes(u)];
    E.set('EXP-PROBE', true);
    E.setItem('upgrade:probeupg', false);
    E.reset();
    out.afterReset = [H.contentOn(u), localStorage.getItem('the-hum.content'), localStorage.getItem('the-hum.experiments')];
    return out;
  });
  c.check('registered content gets the experiment tag and a stable content id; tiers share the facility’s',
    sw.cids.join() === 'facility:probefac,upgrade:probeupg,facility:probefac,EXP-PROBE' && sw.listed.every(Boolean), sw);
  c.check('switching one content id off removes only that content (and its tiers) from the live lists',
    sw.offItem.join() === 'false,false,false,true', sw.offItem);
  c.check('content switches are stored in their own key, never in the save', sw.stored['facility:probefac'] === false && sw.notInSave, sw.stored);
  c.check('switched back on, the content is live again', sw.backOn);
  c.check('switching the experiment off removes all of its content', sw.expOff.every((x) => x === false), sw.expOff);
  c.check('reset() restores every experiment and content switch and clears both keys', sw.afterReset[0] === true && sw.afterReset[1] === null && sw.afterReset[2] === null, sw.afterReset);

  // ---------------------------------------------------------------- data-driven effects follow ownership and switches
  const fx = await ev(() => {
    const H = HUM, E = H.Exp;
    H.replaceState(H.sanitizeState({ v: 2 }));
    H.rt.saveBlocked = true;
    const before = H.derive().surveyPower;
    H.S.run.upgrades.probeupg = true;
    const owned = H.derive().surveyPower;
    E.setItem('upgrade:probeupg', false);
    const off = H.derive().surveyPower;
    const keptOwned = H.S.run.upgrades.probeupg === true;
    E.setItem('upgrade:probeupg', true);
    const back = H.derive().surveyPower;
    // A share facility toward specialist work
    H.Content.facility('EXP-PROBE', { id: 'probeshare', code: 'F-98', name: 'Probe Share', kind: 'share', target: 'spec', shareLabel: 'specialist work', icon: 'doc', level: 0,
      cost: 10, growth: 1.2, bonus: 0.1, noise: 0, flavor: 'probe' });
    H.S.run.specialists.scavenge = 3;
    const sps0 = H.derive().sps;
    H.S.run.facilities.probeshare = 5;
    const sps1 = H.derive().sps;
    E.setItem('facility:probeshare', false);
    const sps2 = H.derive().sps;
    const count = H.S.run.facilities.probeshare;
    E.setItem('facility:probeshare', true);
    return { before, owned, off, back, keptOwned, sps: [sps0, sps1, sps2], count };
  });
  c.check('an installed requisition with fx {survey: 2} doubles survey power', Math.abs(fx.owned / fx.before - 2) < 1e-9, fx);
  c.check('switched off it gives nothing at once, and stays owned; switched on it applies again, once',
    fx.off === fx.before && fx.keptOwned && fx.back === fx.owned, fx);
  c.check('a share facility adds its share to its target (5 × 10% → specialists ×1.5), nothing when switched off, count kept',
    Math.abs(fx.sps[1] / fx.sps[0] - 1.5) < 1e-9 && fx.sps[2] === fx.sps[0] && fx.count === 5, fx);

  // ---------------------------------------------------------------- independent repeatable research ranks
  const ranks = await ev(() => {
    const H = HUM;
    H.replaceState(H.sanitizeState({ v: 2 }));
    H.rt.saveBlocked = true;
    H.Content.research('EXP-PROBE', { id: 'probe_rep', tier: 5, name: 'Probe Repeatable', repeatable: true, baseCost: 10, growth: 2, time: 10, timeGrowth: 1.5, req: [], fxRank: { rooms: 0.1 }, effect: '', flavor: '' });
    const R = H.RES.probe_rep, DT = H.RES.deeptheory;
    H.S.echoes = 1000;
    const out = { cost0: H.researchCost(R), time1: H.researchTime(R) };
    const rooms0 = H.derive().roomsPerSurvey;
    H.doResearch('probe_rep');
    out.rank = H.S.researching.rank;
    H.step(11, false);
    out.after = { probe: H.rankOf(R), deep: H.S.deepTheory, ext: H.S.ext.ranks };
    out.cost1 = H.researchCost(R); out.time2 = H.researchTime(R);
    out.roomsRatio = H.derive().roomsPerSurvey / rooms0;
    out.deepCost = H.researchCost(DT);
    // Ranks survive a save round trip and a noclip.
    const again = H.sanitizeState(JSON.parse(JSON.stringify(H.S)));
    out.kept = again.ext.ranks;
    return out;
  });
  c.check('a second repeatable keeps its own rank; Deep Survey Theory is untouched',
    ranks.rank === 1 && ranks.after.probe === 1 && ranks.after.deep === 0 && ranks.after.ext.probe_rep === 1 && ranks.deepCost === 60, ranks);
  c.check('cost and time follow that project’s own rank', ranks.cost0 === 10 && ranks.cost1 === 20 && ranks.time1 === 10 && Math.abs(ranks.time2 - 15) < 1e-9, ranks);
  c.check('fxRank applies per rank (+10% rooms at rank 1)', Math.abs(ranks.roomsRatio - 1.1) < 1e-9, ranks);
  c.check('ranks are kept in the save (ext.ranks)', ranks.kept && ranks.kept.probe_rep === 1, ranks.kept);

  // ---------------------------------------------------------------- a project of switched-off content is set aside
  const pause = await ev(() => {
    const H = HUM, E = H.Exp;
    H.replaceState(H.sanitizeState({ v: 2 }));
    H.rt.saveBlocked = true;
    H.Content.research('EXP-PROBE', { id: 'probe_one', tier: 5, name: 'Probe Project', cost: 7, time: 100, req: [], fx: { survey: 1.5 }, effect: '', flavor: '' });
    H.S.echoes = 100;
    H.doResearch('probe_one');
    H.step(40, false);
    const echoesPaid = H.S.echoes;
    E.setItem('research:probe_one', false);
    H.step(0.1, false);
    const out = { slotFree: H.S.researching === null, queued: JSON.parse(JSON.stringify(H.S.ext.resq || null)), echoesPaid };
    // The slot is free: another project can start while it is set aside.
    out.other = H.doResearch('pattern');
    H.step(50, false);
    out.otherDone = H.S.research.pattern === true;
    out.waiting = H.S.researching === null && (H.S.ext.resq || []).length === 1;
    E.setItem('research:probe_one', true);
    H.step(0.1, false);
    out.resumed = H.S.researching && { id: H.S.researching.id, left: H.S.researching.end - H.S.time, total: H.S.researching.end - H.S.researching.start };
    out.notCharged = H.S.echoes === echoesPaid - 3;   // only Wallpaper Pattern Analysis (3) was paid since
    H.step(61, false);
    out.done = H.S.research.probe_one === true && H.S.researching === null && !H.S.ext.resq;
    return out;
  });
  c.check('switching off the content of the project under way sets it aside: the slot is freed, the time left kept',
    pause.slotFree && pause.queued && pause.queued[0].id === 'probe_one' && Math.abs(pause.queued[0].left - 60) < 0.2, pause);
  c.check('another project can run meanwhile', pause.other && pause.otherDone && pause.waiting, pause);
  c.check('switched back on, it resumes by itself with its time left and is not charged again', pause.resumed && pause.resumed.id === 'probe_one' && Math.abs(pause.resumed.left - 60) < 0.2 && Math.abs(pause.resumed.total - 100) < 0.2 && pause.notCharged, pause);
  c.check('it then completes once', pause.done, pause);

  // ---------------------------------------------------------------- dormant facility counts and projects (content removed from the code)
  const dormant = await ev(() => {
    const H = HUM;
    const raw = { v: 2, researching: { id: 'gone_project', rank: 0, cost: 50, start: 0, end: 300 },
      run: { facilities: { cart: 3, gone_fac: 7 }, autobuy: { cart: true, gone_fac: true } } };
    const st = H.sanitizeState(raw);
    const again = H.sanitizeState(JSON.parse(JSON.stringify(st)));
    // The content comes back (a reverted commit restored): its count and project return.
    H.FACILITIES.push({ id: 'gone_fac', code: 'F-97', name: 'Back', kind: 'salvage', icon: 'cart', level: 0, cost: 1, growth: 1.2, bonus: 1, noise: 0, tiers: [], flavor: '' });
    H.RESEARCH.push({ id: 'gone_project', tier: 5, name: 'Back', cost: 50, time: 300, req: [], effect: '', flavor: '' });
    H.RES.gone_project = H.RESEARCH[H.RESEARCH.length - 1];
    const back = H.sanitizeState(JSON.parse(JSON.stringify(again)));
    H.FACILITIES.pop(); H.RESEARCH.pop(); delete H.RES.gone_project;
    return { facilities: st.run.facilities, dormant: again.run.dormant, researching: st.researching, dr: again.dormant.researching,
      back: { fac: back.run.facilities.gone_fac, auto: back.run.autobuy.gone_fac, res: back.researching && back.researching.id, dormantLeft: back.run.dormant.facilities } };
  });
  c.check('counts and auto-buy choices of a facility the build does not know are kept dormant, not dropped',
    dormant.facilities.cart === 3 && !dormant.facilities.gone_fac && dormant.dormant.facilities.gone_fac === 7 && dormant.dormant.autobuy.includes('gone_fac'), dormant);
  c.check('a project under way the build does not know is kept dormant, not dropped', dormant.researching === null && dormant.dr && dormant.dr.id === 'gone_project', dormant);
  c.check('when the content returns, its count, choice and project come back', dormant.back.fac === 7 && dormant.back.auto === true && dormant.back.res === 'gone_project' && !dormant.back.dormantLeft, dormant.back);

  // ---------------------------------------------------------------- saves from before the update
  for (const name of ['l4', 'l5', 'fun']) {
    const fx2 = PRE(name);
    const res = await ev((raw) => {
      const H = HUM;
      localStorage.setItem('the-hum.save', JSON.stringify(raw));
      localStorage.removeItem('the-hum.save.pre-2.1');
      const L = H.loadGame();
      const kept = localStorage.getItem('the-hum.save.pre-2.1');
      const st = L.state;
      return { status: L.status, kept: kept === JSON.stringify(raw), facilities: st.run.facilities, autobuy: st.run.autobuy, research: Object.keys(st.research).length,
        researching: st.researching, missions: Object.keys(st.run.missions), deep: st.deepTheory, level: st.run.level, drills: st.run.drills, specialists: st.run.specialists };
    }, fx2);
    c.check(`pre-update save (${name}) loads with every facility, choice, project, mission, rank and level kept, and an untouched copy kept`,
      res.status === 'loaded' && res.kept && JSON.stringify(res.facilities) === JSON.stringify(fx2.run.facilities) && JSON.stringify(res.autobuy) === JSON.stringify(fx2.run.autobuy)
      && res.research === Object.keys(fx2.research).length && JSON.stringify(res.researching) === JSON.stringify(fx2.researching) && res.missions.length === Object.keys(fx2.run.missions).length
      && res.deep === fx2.deepTheory && res.level === fx2.run.level && res.drills === fx2.run.drills && JSON.stringify(res.specialists) === JSON.stringify(fx2.run.specialists), res);
  }
  const marked = await ev(() => {
    const H = HUM;
    H.rt.saveBlocked = false; H.save(); H.rt.saveBlocked = true;
    const raw = localStorage.getItem('the-hum.save');
    localStorage.setItem('the-hum.save.pre-2.1', 'sentinel');
    H.loadGame();
    return { build: JSON.parse(raw).ext.build, copy: localStorage.getItem('the-hum.save.pre-2.1') };
  });
  c.check('a save written by this build is marked, and loading it never replaces the kept pre-update copy', marked.build && marked.build.v === '2.1.0' && marked.copy === 'sentinel', marked);
  await ev(() => { localStorage.clear(); });

  // ---------------------------------------------------------------- step splitting and mission returns
  const split = await ev(() => {
    const H = HUM, E = H.Exp;
    H.replaceState(H.sanitizeState({ v: 2 }));
    H.rt.saveBlocked = true;
    const seen = [];
    E.hook('step:split', 'EXP-PROBE', (t0, t1) => { const ev2 = Math.ceil((t0 + 1e-6) / 7) * 7; return ev2 < t1 ? ev2 : undefined; });
    E.hook('step', 'EXP-PROBE', () => seen.push(+H.S.time.toFixed(6)));
    const t0 = H.S.time;
    H.step(30, true);
    E.hooks['step:split'] = E.hooks['step:split'].filter((h) => h.id !== 'EXP-PROBE');
    E.hooks.step = E.hooks.step.filter((h) => h.id !== 'EXP-PROBE');
    return { t0, seen, end: H.S.time };
  });
  const expect = [7, 14, 21, 28, 30].map((x) => x + split.t0);
  c.check('step:split cuts a long step at every event inside it, and the step still covers its whole length',
    JSON.stringify(split.seen) === JSON.stringify(expect) && Math.abs(split.end - split.t0 - 30) < 1e-9, split);

  const ret = await ev(() => {
    const H = HUM, E = H.Exp;
    H.replaceState(H.sanitizeState({ v: 2 }));
    H.rt.saveBlocked = true;
    H.S.run.specialists.chart = 1; H.S.run.aw = 1000;
    const done = [];
    E.hook('mission:done', 'EXP-PROBE', (id, end) => { done.push([id, end]); if (done.length < 3) H.launchMission(id, { at: end, quiet: true }); });
    const logBefore = H.S.log.length;
    H.launchMission('stairwell');
    const dur = H.missionDuration(H.MIS.stairwell);
    const start = H.S.time;
    H.step(dur * 3.5, true);   // one coarse step: three returns inside it, each at its own time
    E.hooks['mission:done'] = E.hooks['mission:done'].filter((h) => h.id !== 'EXP-PROBE');
    return { done, start, dur, expeditions: H.S.run.stats.expeditions, active: !!H.S.run.missions.stairwell, logs: H.S.log.length - logBefore };
  });
  c.check('a mission sent again at its return time can return again inside one long step: each return handled once, at its own time',
    ret.done.length === 3 && ret.done.every(([id, end], i) => id === 'stairwell' && Math.abs(end - (ret.start + ret.dur * (i + 1))) < 1e-6) && ret.expeditions === 3 && !ret.active, ret);

  // ---------------------------------------------------------------- purchase extension points
  const buy = await ev(() => {
    const H = HUM;
    H.replaceState(H.sanitizeState({ v: 2 }));
    H.rt.saveBlocked = true;
    H.S.run.salvage = 1e6;
    H.setBuyMode('max');
    const logs = H.S.log.length;
    const one = H.buyFacility('cart', { n: 1, quiet: true });
    const out = { one, count: H.S.run.facilities.cart, quietLog: H.S.log.length === logs, quote: H.unitQuote(H.FAC.cart, 1) };
    out.unitPrice = Math.ceil(H.facilityCost(H.FAC.cart, 1, 1));
    H.S.run.salvage = out.unitPrice - 1;
    out.refused = H.buyFacility('cart', { n: 1, quiet: true }) === false && H.S.run.facilities.cart === 1;
    out.notNegative = H.S.run.salvage === out.unitPrice - 1;
    H.setBuyMode(1);
    return out;
  });
  c.check('buyFacility can buy exactly one unit at its exact price, whatever the buy mode, quietly', buy.one && buy.count === 1 && buy.quietLog && buy.quote.n === 1, buy);
  c.check('one unit is refused when it costs a salvage more than you have, and nothing is paid', buy.refused && buy.notNegative, buy);

  c.finish(g.errors);
  await g.browser.close();
})();
