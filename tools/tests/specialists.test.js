// Specialists replace the workforce: one of each, recruited once and upgraded with salvage. Missions replace expeditions.
const { open, Checker } = require('./harness');

(async () => {
  const c = new Checker('Specialists and missions');
  const g = await open('');
  const { ev, page, reload } = g;

  const content = await ev(() => {
    const H = HUM;
    return { ids: H.SPECIALISTS.map((s) => s.id), roles: H.SPECIALISTS.map((s) => s.role), hire: H.SPECIALISTS.map((s) => [s.id, s.hire, s.level]),
      api: { hire: typeof H.hire, assign: typeof H.assign, crew: 'crew' in H.S.run, jobs: 'JOBS' in H, expeditions: 'EXPEDITIONS' in H },
      fresh: JSON.stringify(H.sanitizeState({ v: 2 }).run.specialists), max: H.CONFIG.specialists.max,
      missions: H.MISSIONS.map((m) => ({ id: m.id, level: m.level, needs: m.needs, crew: 'crew' in m })) };
  });
  c.check('there are exactly five specialists: Scavenger, Cartographer, Dowser, Watcher, Archivist', content.ids.join() === 'scavenge,chart,dowse,watch,archive', content.ids);
  c.check('each has a distinct role', new Set(content.roles).size === 5, content.roles);
  c.check('no hiring, assigning, workers, jobs or expeditions remain', content.api.hire === 'undefined' && content.api.assign === 'undefined' && !content.api.crew && !content.api.jobs && !content.api.expeditions, content.api);
  c.check('a new game starts with no specialists', content.fresh === '{}', content.fresh);
  const scavHire = content.hire.find((x) => x[0] === 'scavenge');
  c.check('the Scavenger is open from Level 0 for a modest price (not a random drop)', scavHire[2] === 0 && scavHire[1] > 0 && scavHire[1] <= 1000, scavHire);

  // Recruiting and upgrading: once each, for salvage, working at once.
  const hire = await ev(() => {
    const H = HUM;
    H.replaceState(H.sanitizeState({ v: 2 }));
    H.rt.saveBlocked = true;
    const r = H.S.run;
    const out = {};
    r.level = 3;
    for (const s of H.SPECIALISTS) {
      r.salvage = s.hire;
      const before = H.derive();
      const ok = H.hireSpecialist(s.id);
      const lvl1 = r.specialists[s.id];
      const D = H.derive();
      const paid = s.hire - r.salvage;
      const up = H.specCost(s, 1);
      r.salvage = up;
      const ok2 = H.hireSpecialist(s.id);
      const D2 = H.derive();
      out[s.id] = { ok, paid, lvl1, level: r.specialists[s.id], ok2, paid2: up - r.salvage, expectUp: Math.ceil(s.cost * s.growth),
        before: [before.sps, before.autoSurveys, before.aws, before.watchAbsorb, before.eps], after: [D.sps, D.autoSurveys, D.aws, D.watchAbsorb, D.eps], after2: [D2.sps, D2.autoSurveys, D2.aws, D2.watchAbsorb, D2.eps],
        warn: D.watchWarn, rps: D.roomsPerSec };
    }
    return out;
  });
  c.check('recruiting charges the stated price and starts at level 1', Object.entries(hire).every(([id, h]) => h.ok && h.lvl1 === 1 && h.paid === content.hire.find((x) => x[0] === id)[1]), hire);
  c.check('each level costs cost × growth^level', Object.values(hire).every((h) => h.ok2 && h.paid2 === h.expectUp), Object.fromEntries(Object.entries(hire).map(([k, v]) => [k, [v.paid2, v.expectUp]])));
  c.check('the Scavenger makes passive salvage at once', hire.scavenge.before[0] === 0 && hire.scavenge.after[0] > 0, hire.scavenge);
  c.check('the Cartographer maps rooms automatically at once', hire.chart.after[1] > 0 && hire.chart.rps > 0, hire.chart);
  c.check('the Dowser finds almond water at once', hire.dowse.after[2] > 0, hire.dowse);
  c.check('the Watcher absorbs noise and warns of entities earlier at once', hire.watch.after[3] > 0 && hire.watch.warn > 0, hire.watch);
  c.check('the Archivist records Echoes at once', hire.archive.after[4] > 0, hire.archive);
  c.check('a second level makes each specialist better', [['scavenge', 0], ['chart', 1], ['dowse', 2], ['watch', 3], ['archive', 4]].every(([id, i]) => hire[id].after2[i] > hire[id].after[i]), hire);

  const gates = await ev(() => {
    const H = HUM;
    H.replaceState(H.sanitizeState({ v: 2 }));
    H.rt.saveBlocked = true;
    const r = H.S.run;
    r.salvage = 1e12;
    const at0 = H.SPECIALISTS.map((s) => [s.id, H.canHire(s)]);
    const watch0 = H.hireSpecialist('watch');
    r.level = 1;
    const watch1 = H.hireSpecialist('watch');
    r.specialists.scavenge = H.CONFIG.specialists.max;
    const atMax = H.canHire(H.SPEC.scavenge) || H.hireSpecialist('scavenge');
    // The Foreman's Whistle makes upgrades 10% cheaper; recruiting is unchanged.
    const s = H.SPEC.dowse;
    const plain = [H.specCost(s, 0), H.specCost(s, 3)];
    r.upgrades.whistle = true;
    const whistle = [H.specCost(s, 0), H.specCost(s, 3)];
    const expect = Math.ceil(s.cost * Math.pow(s.growth, 3) * 0.9);
    return { at0, watch0, watch1, atMax, level: r.specialists.scavenge, plain, whistle, expect };
  });
  c.check('specialists open by level: the Watcher on Level 1, the Archivist on Level 3', JSON.stringify(gates.at0) === JSON.stringify([['scavenge', true], ['chart', true], ['dowse', true], ['watch', false], ['archive', false]]) && !gates.watch0 && gates.watch1, gates);
  c.check('a specialist cannot go past the highest level', gates.atMax === false && gates.level === 60, gates);
  c.check('the Foreman’s Whistle makes upgrades 10% cheaper, not recruiting', gates.whistle[0] === gates.plain[0] && gates.whistle[1] === gates.expect && gates.expect < gates.plain[1], gates);

  // The Crew tab: one row per specialist with current effect, next effect and cost; recruiting from the row.
  await ev(() => {
    const H = HUM;
    H.replaceState(H.sanitizeState({ v: 2 }));
    H.rt.saveBlocked = true;
    const r = H.S.run;
    r.rooms = 20; r.salvage = 499; r.nextEncounterAt = 1e12;
    H.UI.update(true);   // the Crew tab appears once its condition (8 rooms) is seen
    H.UI.selectTab('crew'); H.rt.structureDirty = true; H.UI.update(true);
  });
  const row = (id) => ev((id) => { const R = document.querySelector(`#panel-crew .row[data-spec="${id}"]`); const b = R.querySelector('[data-action="hire-spec"]');
    return { chip: R.querySelector('.chip').textContent, now: R.querySelector('.spec-now').textContent, next: R.querySelector('.spec-next').textContent, btn: b.textContent, disabled: b.disabled }; }, id);
  const r0 = await row('scavenge');
  const rw = await row('watch');
  const rows = await ev(() => document.querySelectorAll('#panel-crew .row.spec').length);
  c.check('the Crew tab lists the five specialists', rows === 5, rows);
  c.check('before recruiting, a row shows what level 1 does, what level 2 adds, and the price', r0.chip === 'Not recruited' && /^Recruited: \+[\d.]+ salvage\/s$/.test(r0.now) && /^Level 2: \+[\d.]+ salvage\/s$/.test(r0.next) && /Recruit500 salvage/.test(r0.btn) && r0.disabled, r0);
  c.check('a specialist of a deeper level says where it opens', rw.chip === 'Opens on Level 1' && /Reach Level 1: The Annex to recruit\./.test(rw.now), rw);
  await ev(() => { HUM.S.run.salvage = 500; HUM.UI.update(); });
  await page.click('#panel-crew .row[data-spec="scavenge"] [data-action="hire-spec"]');
  await page.waitForTimeout(150);
  const r1 = await row('scavenge');
  const after = await ev(() => ({ level: HUM.S.run.specialists.scavenge, salvage: HUM.S.run.salvage, sps: HUM.derive().sps, idle: document.getElementById('spowerIdle').textContent }));
  // What is left is the Scavenger's own salvage since the click (the game keeps running while the test waits).
  c.check('recruiting from the row: level 1, price paid, salvage per second starts', after.level === 1 && after.sps > 0 && after.salvage <= after.sps * 5, after);
  c.check('the row then shows level 1, its effect now, the next level and the upgrade price', r1.chip === 'Level 1' && /^Now: \+[\d.]+ salvage\/s$/.test(r1.now) && /^Level 2: /.test(r1.next) && /Upgrade to level 2[\d.,]+[A-Za-z]* salvage/.test(r1.btn), r1);
  c.check('the passive line under Survey names the Scavenger', /^Passive salvage: \+[\d.]+\/s from the Scavenger$/.test(after.idle), after.idle);

  // Crew requisitions only make sense with a specialist, and multiply their work.
  const req = await ev(() => {
    const H = HUM, u = H.UPG.bunks;
    const home = H.upgradeHome(u);
    H.S.run.salvage = u.cost.salvage;
    const s0 = H.derive().sps;
    const ok = H.buyUpgrade('bunks');
    return { home, ok, ratio: H.derive().sps / s0 };
  });
  c.check('crew requisitions live in the Crew tab and multiply specialist output', req.home === 'crew' && req.ok && Math.abs(req.ratio - 1.25) < 1e-12, req);

  // A taken specialist stops working for a while and always comes back at the same level.
  const taken = await ev(() => {
    const H = HUM, r = H.S.run;
    r.specialists.scavenge = 4;
    r.pendingIncident = { type: 'taken', at: H.S.time, warn: 0, target: null };
    H.step(0.1, false);
    const away = { until: r.away.scavenge, working: H.derive().spec.scavenge.working, sps: H.derive().sps, level: r.specialists.scavenge };
    const wait = r.away.scavenge - H.S.time;
    for (let t = 0; t < wait + 1; t += 1) H.step(1, false);
    return { away, back: { away: r.away.scavenge, working: H.derive().spec.scavenge.working, sps: H.derive().sps, level: r.specialists.scavenge }, wait };
  });
  c.check('an incident can take a specialist away: they stop working but keep their level', taken.away.until > 0 && !taken.away.working && taken.away.sps === 0 && taken.away.level === 4, taken);
  c.check('they come back on their own after a few minutes, still at the same level', taken.wait >= 120 && taken.wait <= 480 && taken.back.away === undefined && taken.back.working && taken.back.sps > 0 && taken.back.level === 4, taken);

  // Missions: a specialist level and water; no allocation; complete on the game clock, once.
  c.check('every mission needs a specialist at a level, and none takes crew', content.missions.length === 6 && content.missions.every((m) => m.needs && content.ids.includes(m.needs.id) && m.needs.level >= 1 && m.needs.level <= content.max && !m.crew), content.missions);
  c.check('missions open by level, from Level 0 to Level 5', content.missions.map((m) => m.level).join() === '0,1,2,3,4,5', content.missions.map((m) => m.level));
  const mis = await ev(() => {
    const H = HUM;
    H.replaceState(H.sanitizeState({ v: 2 }));
    H.rt.saveBlocked = true;
    const r = H.S.run, m = H.MIS.stairwell;
    r.aw = 100; r.salvage = 1e6;
    const noSpec = H.canLaunch(m);
    r.specialists.chart = 1; r.specialists.scavenge = 2;
    const ok = H.launchMission('stairwell');
    const x = { ...r.missions.stairwell };
    const again = H.launchMission('stairwell');
    const aw = r.aw;
    const chartWorking = H.derive().spec.chart.working;
    const s0 = r.salvage, n0 = r.stats.expeditions;
    const dur = x.end - x.start;
    for (let t = 0; t < dur - 1; t += 1) H.step(1, false);
    const early = { inFlight: !!r.missions.stairwell, stats: r.stats.expeditions - n0 };
    Math.random = () => 0.99;   // the hazard roll misses
    H.step(2, false);
    const done = { inFlight: !!r.missions.stairwell, stats: r.stats.expeditions - n0 };
    for (let t = 0; t < 600; t++) H.step(1, false);
    const later = r.stats.expeditions - n0;
    return { noSpec, ok, x, again, paidWater: 100 - aw, water: H.MIS.stairwell.water, chartWorking, dur, early, done, later, relaunch: H.canLaunch(m) };
  });
  c.check('a mission cannot launch without its specialist level', mis.noSpec === false, mis);
  c.check('launching pays its water and records start, end, haul and hazard', mis.ok && mis.paidWater === mis.water && mis.x.end > mis.x.start && mis.x.salvage > 0 && mis.x.hazard >= 0, mis);
  c.check('the same mission cannot run twice at once', mis.again === false, mis);
  c.check('the specialist keeps working while a mission is out', mis.chartWorking === true, mis);
  c.check('a mission finishes on the game clock, once', mis.early.inFlight && mis.early.stats === 0 && !mis.done.inFlight && mis.done.stats === 1 && mis.later === 1, mis);
  c.check('once back, the mission can be sent again', mis.relaunch === true, mis);

  const offline = await ev(() => {
    const H = HUM, r = H.S.run;
    H.launchMission('stairwell');
    const haul = r.missions.stairwell.salvage, s0 = r.salvage, n0 = r.stats.expeditions;
    const sps = H.derive().sps;
    H.catchUp(3600);
    return { haul, n: r.stats.expeditions - n0, gained: r.salvage - s0, sps, back: !r.missions.stairwell };
  });
  c.check('a mission under way completes while you are away and pays its haul', offline.back && offline.n === 1 && offline.gained >= offline.haul * 0.5, offline);

  const misUi = await ev(() => {
    const H = HUM;
    H.UI.update(true);
    H.UI.selectTab('expeditions'); H.rt.structureDirty = true; H.UI.update(true);
    const tab = document.getElementById('tab-expeditions');
    return { label: tab && tab.textContent, cards: document.querySelectorAll('#panel-expeditions .exp:not(.locked)').length,
      inputs: document.querySelectorAll('#panel-expeditions input').length, locked: (document.querySelector('#panel-expeditions .exp.locked') || {}).textContent };
  });
  c.check('the Missions tab lists missions without any crew allocation', /Missions/.test(misUi.label) && misUi.cards >= 1 && misUi.inputs === 0, misUi);
  c.check('the next mission says which level opens it', /Reach Level 1: The Annex to send teams here\./.test(misUi.locked || ''), misUi);

  // Specialist levels are saved.
  await ev(() => {
    const H = HUM;
    H.replaceState(H.sanitizeState({ v: 2 }));
    const r = H.S.run;
    r.level = 3; r.specialists = { scavenge: 7, chart: 3, dowse: 2, watch: 1, archive: 1 };
    H.rt.saveBlocked = false; H.save(); H.rt.saveBlocked = true;
  });
  await reload();
  const kept = await ev(() => ({ ...HUM.S.run.specialists }));
  c.check('specialist levels survive a reload', JSON.stringify(kept) === JSON.stringify({ scavenge: 7, chart: 3, dowse: 2, watch: 1, archive: 1 }), kept);

  c.finish(g.errors);
  await g.browser.close();
})();
