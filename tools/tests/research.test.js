// Timed research: paid once, finishes on the game clock, once, and is kept through reloads, time away and noclips.
const { open, Checker } = require('./harness');

(async () => {
  const c = new Checker('Timed research');
  const g = await open('');
  const { ev, page, reload } = g;

  const start = await ev(() => {
    const H = HUM;
    H.replaceState(H.sanitizeState({ v: 2 }));
    H.rt.saveBlocked = true;
    H.S.echoes = 10;
    const R = H.RESEARCH.find((x) => x.id === 'pattern');
    const p0 = H.derive().surveyPower;
    const ok = H.doResearch('pattern');
    const A = { ...H.S.researching };
    const echoes = H.S.echoes;
    const dupSame = H.doResearch('pattern');
    const dupOther = H.doResearch('hum');
    return { ok, A, echoes, dupSame, dupOther, echoesAfterDup: H.S.echoes, done: H.S.research.pattern === true, p0, p1: H.derive().surveyPower, time: R.time, cost: R.cost, now: H.S.time };
  });
  c.check('starting a project pays its Echoes once', start.ok && start.echoes === 10 - start.cost, start);
  c.check('the project records when it started and when it will finish', start.A.id === 'pattern' && start.A.start === start.now && start.A.end === start.now + start.time && start.A.cost === start.cost, start.A);
  c.check('its effect does not apply while it is under way', !start.done && start.p1 === start.p0, start);
  c.check('no second project can start, and nothing more is charged', start.dupSame === false && start.dupOther === false && start.echoesAfterDup === start.echoes, start);

  // The research panel: a progress bar and the time left.
  const panel = await ev(() => {
    const H = HUM;
    H.S.seen.echoes = true;
    for (let i = 0; i < 150; i++) H.step(0.1, false);   // 15 seconds
    H.UI.update(true);
    H.UI.selectTab('research'); H.rt.structureDirty = true; H.UI.update(true);
    const box = document.querySelector('#panel-research .res-active');
    const other = document.querySelector('#panel-research [data-action="research"][data-id="hum"]');
    return { name: box.querySelector('b').textContent, left: box.querySelector('.num').textContent, value: box.querySelector('.bar').getAttribute('aria-valuenow'),
      otherDisabled: other.disabled, otherText: other.textContent };
  });
  // 15 of 45 seconds have passed (plus whatever the live frame loop added while the test waited).
  c.check('the panel shows the project under way, the time left and its progress', panel.name === 'Wallpaper Pattern Analysis' && /^(29|30)s left of 45s$/.test(panel.left) && Number(panel.value) >= 33 && Number(panel.value) <= 36, panel);
  c.check('other projects wait for the current one', panel.otherDisabled && /after the current project/.test(panel.otherText), panel);

  const finish = await ev(() => {
    const H = HUM;
    const A = H.S.researching;
    while (H.S.time < A.end - 0.25) H.step(0.1, false);
    const before = { done: H.S.research.pattern === true, active: !!H.S.researching };
    const p0 = H.derive().surveyPower;
    for (let i = 0; i < 10; i++) H.step(0.1, false);
    const logs = H.S.log.filter((l) => /Research complete: Wallpaper Pattern Analysis/.test(l.text)).length;
    for (let i = 0; i < 100; i++) H.step(0.1, false);
    const logsLater = H.S.log.filter((l) => /Research complete: Wallpaper Pattern Analysis/.test(l.text)).length;
    return { before, done: H.S.research.pattern === true, active: H.S.researching, ratio: H.derive().surveyPower / p0, logs, logsLater, echoes: H.S.echoes, again: H.doResearch('pattern') };
  });
  c.check('just before its end it is still under way', !finish.before.done && finish.before.active, finish);
  c.check('at its end the effect applies (survey power ×1.5)', finish.done && finish.active === null && Math.abs(finish.ratio - 1.5) < 1e-12, finish);
  c.check('it completes exactly once and is never charged again', finish.logs === 1 && finish.logsLater === 1 && finish.echoes === 7 && finish.again === false, finish);

  // A step that crosses the end is split there: the benefit never applies to time before completion.
  const split = await ev(() => {
    const H = HUM;
    H.replaceState(H.sanitizeState({ v: 2 }));
    H.rt.saveBlocked = true;
    const r = H.S.run;
    r.specialists.dowse = 5;
    H.S.echoes = 100;
    const rate = H.derive().aws;
    H.doResearch('condense');   // almond water ×2, from every source, after 60 seconds
    const t = H.RESEARCH.find((x) => x.id === 'condense').time;
    const w0 = r.aw;
    H.step(t + 30, false);          // one big step across the end
    const oneStep = r.aw - w0;
    // The same through offline catch-up.
    H.replaceState(H.sanitizeState({ v: 2 }));
    H.rt.saveBlocked = true;
    H.S.run.specialists.dowse = 5;
    H.S.echoes = 100;
    H.doResearch('condense');
    const w1 = H.S.run.aw;
    const rep = H.catchUp(600);
    const away = H.S.run.aw - w1;
    return { rate, t, oneStep, expectOne: rate * t + 2 * rate * 30, away, expectAway: rate * t + 2 * rate * (600 - t), doneAway: H.S.research.condense === true, notes: rep.notes };
  });
  c.check('a single step across the end applies the bonus only after it', Math.abs(split.oneStep - split.expectOne) / split.expectOne < 1e-9, split);
  c.check('time away applies the bonus only after completion, not to the whole absence', Math.abs(split.away - split.expectAway) / split.expectAway < 1e-6 && split.doneAway, split);
  c.check('the time-away report says the research finished', split.notes.some((n) => /Research complete: Condensation Dynamics/.test(n)), split.notes);

  // Kept across a reload: the same end time, no restart, no second charge.
  const saved = await ev(() => {
    const H = HUM;
    H.replaceState(H.sanitizeState({ v: 2 }));
    H.S.echoes = 50;
    H.doResearch('recursion' in H.S.research ? 'hum' : 'hum');
    for (let i = 0; i < 100; i++) H.step(0.1, false);
    H.rt.saveBlocked = false; H.save(); H.rt.saveBlocked = true;
    return { A: { ...H.S.researching }, echoes: H.S.echoes, time: H.S.time };
  });
  await reload();
  const loaded = await ev(() => ({ A: HUM.S.researching && { ...HUM.S.researching }, echoes: HUM.S.echoes, time: HUM.S.time }));
  c.check('a reload keeps the project with the same start and end (the countdown is not reset)', loaded.A && loaded.A.id === 'hum' && loaded.A.start === saved.A.start && loaded.A.end === saved.A.end && loaded.time >= saved.time, { saved, loaded });
  c.check('a reload charges nothing', loaded.echoes === saved.echoes, { saved, loaded });
  const after = await ev(() => {
    const H = HUM;
    H.rt.saveBlocked = true;
    const A = H.S.researching;
    while (H.S.time < A.end + 1) H.step(0.5, false);
    return { done: H.S.research.hum === true, active: H.S.researching, logs: H.S.log.filter((l) => /Research complete: Hum Frequency Study/.test(l.text)).length };
  });
  c.check('after the reload it completes on time, once', after.done && after.active === null && after.logs === 1, after);

  // Finished while the page was closed: completed during catch-up on load.
  await ev(() => {
    const H = HUM;
    H.replaceState(H.sanitizeState({ v: 2 }));
    H.S.echoes = 50;
    H.doResearch('condense');
    H.rt.saveBlocked = false; H.save(); H.rt.saveBlocked = true;
    const raw = JSON.parse(localStorage.getItem('the-hum.save'));
    raw.lastSaved = Date.now() - 3600 * 1000;   // closed an hour ago
    localStorage.setItem('the-hum.save', JSON.stringify(raw));
  });
  await reload();
  const away = await ev(() => ({ done: HUM.S.research.condense === true, active: HUM.S.researching, echoes: HUM.S.echoes,
    logs: HUM.S.log.filter((l) => /Research complete: Condensation Dynamics/.test(l.text)).length }));
  c.check('a project that finished while the page was closed is completed on load, once', away.done && away.active === null && away.logs === 1 && away.echoes === 45, away);

  // Corrupted or impossible projects in a save are dropped, never granted.
  const bad = await ev(() => {
    const H = HUM;
    const base = { v: 2, time: 100, research: { pattern: true } };
    return {
      unknown: H.sanitizeState({ ...base, researching: { id: 'nope', start: 0, end: 10 } }).researching,
      done: H.sanitizeState({ ...base, researching: { id: 'pattern', start: 0, end: 10 } }).researching,
      backwards: H.sanitizeState({ ...base, researching: { id: 'hum', start: 50, end: 10 } }).researching,
      tooLong: H.sanitizeState({ ...base, researching: { id: 'hum', start: 50, end: 1e9 } }).researching,
      granted: H.sanitizeState({ ...base, researching: { id: 'hum', start: 50, end: 60 } }).research.hum,
    };
  });
  c.check('a save naming an unknown or already finished project drops it', bad.unknown === null && bad.done === null, bad);
  c.check('a project cannot end before it starts or take longer than it should', bad.backwards === null && bad.tooLong && bad.tooLong.end <= 50 + 45 + 1, bad);
  c.check('loading a project under way never grants its effect early', bad.granted !== true, bad);

  // Noclip keeps completed research and the project under way.
  const noclip = await ev(() => {
    const H = HUM;
    H.replaceState(H.sanitizeState({ v: 2 }));
    H.rt.saveBlocked = true;
    H.S.research.pattern = true;
    H.S.echoes = 50;
    H.doResearch('recursion');
    const A = { ...H.S.researching };
    const r = H.S.run;
    r.level = 5; r.stats.salvage = 1e12; r.stats.time = 900;
    H.completeFiniteSurvey();
    const ok = H.noclip();
    return { ok, A, after: H.S.researching && { ...H.S.researching }, kept: H.S.research.pattern === true, iteration: H.S.iteration };
  });
  c.check('a noclip keeps finished research and the project under way, unchanged', noclip.ok && noclip.kept && noclip.after && noclip.after.id === 'recursion' && noclip.after.end === noclip.A.end && noclip.iteration === 2, noclip);

  // Deep Survey Theory: rank and cost fixed when it starts, the rank only counts when it finishes.
  const deep = await ev(() => {
    const H = HUM;
    H.replaceState(H.sanitizeState({ v: 2 }));
    H.rt.saveBlocked = true;
    Object.assign(H.S.research, { pattern: true, hum: true, recursion: true, listening: true });
    const R = H.RESEARCH.find((x) => x.id === 'deeptheory');
    H.S.echoes = 1e6;
    const cost1 = H.researchCost(R), time1 = H.researchTime(R);
    const fb0 = H.derive().facBoost;
    H.doResearch('deeptheory');
    const A = { ...H.S.researching };
    const during = { rank: H.S.deepTheory, fb: H.derive().facBoost, echoes: 1e6 - H.S.echoes };
    H.step(time1 + 1, false);
    const after = { rank: H.S.deepTheory, fb: H.derive().facBoost, cost2: H.researchCost(R), time2: H.researchTime(R) };
    return { R: { base: R.baseCost, growth: R.growth, time: R.time, tg: R.timeGrowth }, cost1, time1, A, during, after, fb0 };
  });
  c.check('Deep Survey Theory records its rank and cost when it starts', deep.A.rank === 1 && deep.A.cost === deep.cost1 && deep.during.echoes === deep.cost1, deep);
  c.check('its rank (and +15% facility bonuses) only counts once it finishes', deep.during.rank === 0 && deep.during.fb === deep.fb0 && deep.after.rank === 1 && Math.abs(deep.after.fb / deep.fb0 - 1.15) < 1e-12, deep);
  c.check('the next rank costs more and takes longer', deep.after.cost2 === Math.ceil(deep.R.base * deep.R.growth) && Math.abs(deep.after.time2 - deep.R.time * deep.R.tg) < 1e-9, deep);

  // Doctrines can only be adopted once their research has finished.
  const doc = await ev(() => {
    const H = HUM;
    H.replaceState(H.sanitizeState({ v: 2 }));
    H.rt.saveBlocked = true;
    Object.assign(H.S.research, { pattern: true, recursion: true });
    H.S.echoes = 100;
    H.doResearch('doc_industry');
    const early = H.adoptDoctrine('doc_industry');
    H.step(H.S.researching.end - H.S.time + 0.1, false);
    const late = H.adoptDoctrine('doc_industry');
    return { early, late, doctrine: H.S.run.doctrine };
  });
  c.check('a doctrine cannot be adopted while its research is under way, and can be once it finishes', doc.early === false && doc.late === true && doc.doctrine === 'doc_industry', doc);

  c.finish(g.errors);
  await g.browser.close();
})();
