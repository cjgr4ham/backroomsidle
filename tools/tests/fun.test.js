// Completing the finite survey and Level FUN: noclip locked until completion, an endless level after it, optional rebirth.
const { open, Checker } = require('./harness');

(async () => {
  const c = new Checker('Completion and Level FUN');
  const g = await open('');
  const { ev, page, reload } = g;

  const levels = await ev(() => {
    const H = HUM;
    return { n: H.LEVELS.length, final: H.FINAL_LEVEL, fun: H.FUN_LEVEL, finalName: H.LEVELS[H.FINAL_LEVEL].name, funName: H.LEVELS[H.FUN_LEVEL].name,
      endless: H.LEVELS.map((L) => !!L.endless), funExit: H.exitRooms(H.FUN_LEVEL), finalExit: H.exitRooms(H.FINAL_LEVEL) };
  });
  c.check('the last finite level is the Long Hallway (Level 5), not the last entry of the level list', levels.final === 5 && levels.finalName === 'The Long Hallway' && levels.n === 7 && levels.final !== levels.n - 1, levels);
  c.check('Level FUN comes after it and is the only endless level', levels.fun === 6 && levels.funName === 'Level FUN' && levels.endless.join() === 'false,false,false,false,false,false,true' && levels.funExit === Infinity, levels);

  // Probe the noclip hooks: completion must not run them.
  const probe = () => ev(() => {
    const H = HUM;
    if (!window.__probe) {
      window.__probe = { newRun: 0, done: 0 };
      H.Exp.define({ id: 'EXP-TEST-FUN', name: 'probe', defaultOn: true });
      H.Exp.hook('noclip:newRun', 'EXP-TEST-FUN', () => { window.__probe.newRun++; });
      H.Exp.hook('noclip:done', 'EXP-TEST-FUN', () => { window.__probe.done++; });
    }
    return { ...window.__probe };
  });
  await probe();

  // Locked before completion, at every finite level, however much Déjà Vu is waiting.
  const locked = await ev(() => {
    const H = HUM;
    H.replaceState(H.sanitizeState({ v: 2 }));
    H.rt.saveBlocked = true;
    const r = H.S.run;
    r.stats.salvage = 1e15; r.stats.time = 3000;
    const out = [];
    for (let l = 0; l <= 5; l++) { r.level = l; out.push([l, H.canNoclip(), H.dvPreview()]); }
    const tried = H.noclip();
    return { out, tried, iteration: H.S.iteration, noclips: H.S.life.noclips, dv: H.S.dv };
  });
  c.check('noclip stays locked on every finite level before the survey is complete', locked.out.every(([, can, dv]) => !can && dv >= 1) && locked.tried === false && locked.iteration === 1 && locked.noclips === 0 && locked.dv === 0, locked);
  await ev(() => { const H = HUM; H.S.life.maxLevel = 5; H.S.run.level = 5; H.UI.update(true); H.UI.selectTab('noclip'); H.rt.structureDirty = true; H.UI.update(true); });
  const panel = await ev(() => { const b = document.querySelector('#panel-noclip [data-action="noclip"]'); return { exists: !!b, disabled: b ? b.disabled : null, text: document.getElementById('panel-noclip').textContent }; });
  c.check('the Noclip tab says the survey must be completed first', (!panel.exists || panel.disabled) && /complete/i.test(panel.text), { ...panel, text: panel.text.slice(0, 300) });

  // Completion: the last room of Level 5 records it, opens noclip and moves into Level FUN with everything kept.
  const done = await ev(() => {
    const H = HUM;
    H.replaceState(H.sanitizeState({ v: 2 }));
    H.rt.saveBlocked = true;
    const r = H.S.run;
    Object.assign(r, { level: 5, salvage: 1e12, aw: 500 });
    r.levelRooms = H.exitRooms(5) - 10;
    r.facilities = { cart: 50, fold: 3 }; r.specialists = { scavenge: 9, chart: 4 }; r.upgrades = { gloves: true, flashlight: true };
    r.stats.salvage = 5e12; r.stats.time = 4000;
    H.S.research.pattern = true; H.S.echoes = 77;
    const before = { noclips: H.S.life.noclips, exits: H.S.life.exits, iteration: H.S.iteration, dv: H.S.dv, power: H.derive().surveyPower };
    const queue = localStorage.getItem('the-hum.noclip-reports');
    H.addRooms(30);
    return { before, level: r.level, levelRooms: r.levelRooms, exitFound: r.exitFound, can: H.canNoclip(), salvage: r.salvage, aw: r.aw,
      facilities: { ...r.facilities }, specialists: { ...r.specialists }, upgrades: { ...r.upgrades }, research: H.S.research.pattern, echoes: H.S.echoes,
      noclips: H.S.life.noclips, exits: H.S.life.exits, iteration: H.S.iteration, dv: H.S.dv, power: H.derive().surveyPower,
      queueSame: localStorage.getItem('the-hum.noclip-reports') === queue, log: H.S.log.some((l) => /The survey is complete: noclip is open\./.test(l.text)) };
  });
  const p1 = await probe();
  c.check('the last room of Level 5 completes the survey and opens noclip', done.exitFound && done.can && done.log, done);
  c.check('it moves on into Level FUN, carrying the rooms mapped past the exit', done.level === 6 && done.levelRooms === 20, done);
  c.check('salvage, water, facilities, specialists, upgrades, research and Echoes are all kept', done.salvage >= 1e12 && done.aw === 500 && done.facilities.cart === 50 && done.facilities.fold === 3 && done.specialists.scavenge === 9 && done.upgrades.flashlight && done.research && done.echoes === 77, done);
  c.check('completing the survey and entering Level FUN do not count a noclip or start a new iteration', done.noclips === done.before.noclips && done.exits === done.before.exits && done.iteration === done.before.iteration && done.dv === done.before.dv, done);
  c.check('no noclip hook runs and no leaderboard report is queued', p1.newRun === 0 && p1.done === 0 && done.queueSame, { p1, queueSame: done.queueSame });
  c.check('Level FUN pays more per survey than the Long Hallway', done.power > done.before.power * 1.5, done);

  // Level FUN looks and reads differently, and counts endlessly.
  await ev(() => { HUM.UI.update(true); HUM.View.setLevel(HUM.S.run.level); });
  await page.waitForTimeout(150);
  const look = await ev(() => ({ fun: document.getElementById('viewport').classList.contains('fun'), cam: document.getElementById('hudCam').textContent, mark: document.querySelector('.brand-mark').textContent,
    name: document.getElementById('levelName').textContent, val: document.getElementById('levelVal').textContent, label: document.getElementById('surveyLabel').textContent, view: HUM.View.level }));
  c.check('Level FUN has its own look in the viewport and the interface', look.fun && /LEVEL FUN =\)/.test(look.cam) && look.mark === '=)' && look.view === 6, look);
  c.check('the level track shows an endless count instead of an exit', /^Level FUN endless$/.test(look.name.trim().replace(/\s+/g, ' ')) && /^\d[\d,.]* rooms · floor \d+$/.test(look.val), look);
  const floors = await ev(() => {
    const H = HUM, r = H.S.run, F = H.CONFIG.fun;
    const d0 = H.derive();
    H.addRooms(F.floorRooms * 3);
    const d1 = H.derive();
    H.addRooms(1e300);   // an absurd amount: still Level FUN, never a level after it
    return { floor0: d0.floor, depth0: d0.depth, floor1: d1.floor, depth1: d1.depth, level: r.level, base: H.LEVELS[6].surveyMult, bonus: F.floorBonus, finite: Number.isFinite(r.levelRooms) };
  });
  c.check('every floor of Level FUN raises its depth multiplier', floors.floor0 === 0 && floors.floor1 === 3 && Math.abs(floors.depth1 - floors.base * (1 + 3 * floors.bonus)) < 1e-9 && floors.depth0 === floors.base, floors);
  c.check('no amount of rooms goes past Level FUN', floors.level === 6 && floors.finite, floors);

  // Rooms gained in one go cross several levels, carrying the overflow, and stop at FUN.
  const multi = await ev(() => {
    const H = HUM;
    H.replaceState(H.sanitizeState({ v: 2 }));
    H.rt.saveBlocked = true;
    const r = H.S.run;
    r.level = 2;
    const total = H.exitRooms(2) + H.exitRooms(3) + H.exitRooms(4) + H.exitRooms(5) + 1234;
    H.addRooms(total);
    return { level: r.level, levelRooms: r.levelRooms, exitFound: r.exitFound, maxLevel: H.S.life.maxLevel, noclips: H.S.life.noclips };
  });
  c.check('a huge gain crosses every remaining level, completes the survey and carries the rest into FUN', multi.level === 6 && Math.abs(multi.levelRooms - 1234) < 1e-6 && multi.exitFound && multi.maxLevel === 6 && multi.noclips === 0, multi);
  const offline = await ev(() => {
    const H = HUM;
    H.replaceState(H.sanitizeState({ v: 2 }));
    H.rt.saveBlocked = true;
    const r = H.S.run;
    r.level = 5; r.levelRooms = H.exitRooms(5) - 100;
    r.specialists = { chart: 30 };
    const rep = H.catchUp(3600);
    return { level: r.level, exitFound: r.exitFound, notes: rep.notes, noclips: H.S.life.noclips };
  });
  c.check('the survey can also be completed while away, without a noclip', offline.level === 6 && offline.exitFound && offline.noclips === 0 && offline.notes.some((n) => /Completed the finite survey/.test(n)), offline);

  // FUN and the completed survey survive a reload; old or odd saves are put right.
  await ev(() => {
    const H = HUM;
    H.replaceState(H.sanitizeState({ v: 2 }));
    const r = H.S.run;
    Object.assign(r, { level: 6, levelRooms: 123456, exitFound: true });
    r.stats.salvage = 1e12; r.stats.time = 3600;
    H.rt.saveBlocked = false; H.save(); H.rt.saveBlocked = true;
  });
  await reload();
  const kept = await ev(() => ({ level: HUM.S.run.level, levelRooms: HUM.S.run.levelRooms, exitFound: HUM.S.run.exitFound, can: HUM.canNoclip() }));
  c.check('Level FUN and the completed survey survive a reload', kept.level === 6 && kept.levelRooms >= 123456 && kept.exitFound && kept.can, kept);
  const fix = await ev(() => {
    const H = HUM;
    const s = (run) => H.sanitizeState({ v: 2, run }).run;
    const a = s({ level: 6, exitFound: false, levelRooms: 10 });
    const b = s({ level: 5, exitFound: true, levelRooms: H.exitRooms(5) + 70 });
    const d = s({ level: 9, levelRooms: 5 });
    const e = s({ level: 3, exitFound: true, levelRooms: 5 });
    return { a: [a.level, a.exitFound], b: [b.level, b.exitFound, b.levelRooms], d: [d.level], e: [e.level, e.exitFound] };
  });
  c.check('a save in Level FUN always has the survey completed', fix.a[0] === 6 && fix.a[1] === true, fix);
  c.check('a completed survey saved on Level 5 moves into FUN with its extra rooms', fix.b[0] === 6 && fix.b[1] === true && fix.b[2] === 70, fix);
  c.check('a level past FUN is clamped, and a completion flag below Level 5 is ignored', fix.d[0] === 6 && fix.e[0] === 3 && fix.e[1] === false, fix);

  // Rebirth from Level FUN: optional, counts exactly one noclip, resets the run, keeps what is permanent.
  const before = await probe();
  const rebirth = await ev(() => {
    const H = HUM;
    H.rt.saveBlocked = true;
    const r = H.S.run;
    r.facilities = { cart: 10 }; r.specialists = { scavenge: 4 }; r.upgrades = { gloves: true }; r.salvage = 1e9; r.aw = 30;
    H.S.research.pattern = true; H.S.echoes = 12; H.S.relics.keys = 1; H.S.achievements.steps = true;
    const preview = H.dvPreview();
    const s0 = { noclips: H.S.life.noclips, iteration: H.S.iteration, dv: H.S.dv, dvTotal: H.S.dvTotal };
    const ok = H.noclip();
    const n = H.S.run;
    return { ok, preview, s0, noclips: H.S.life.noclips, iteration: H.S.iteration, dv: H.S.dv, dvTotal: H.S.dvTotal,
      run: { level: n.level, levelRooms: n.levelRooms, exitFound: n.exitFound, salvage: n.salvage, aw: n.aw, facilities: n.facilities, specialists: n.specialists, upgrades: n.upgrades, missions: n.missions },
      kept: { research: H.S.research.pattern === true, echoes: H.S.echoes, relic: H.S.relics.keys, ach: H.S.achievements.steps === true },
      can: H.canNoclip(), again: H.noclip() };
  });
  const after = await probe();
  c.check('noclipping from Level FUN gives the previewed Déjà Vu', rebirth.ok && rebirth.dv === rebirth.s0.dv + rebirth.preview && rebirth.dvTotal === rebirth.s0.dvTotal + rebirth.preview && rebirth.preview > 0, rebirth);
  c.check('it counts exactly one noclip and starts the next iteration', rebirth.noclips === rebirth.s0.noclips + 1 && rebirth.iteration === rebirth.s0.iteration + 1 && after.done === before.done + 1 && after.newRun === before.newRun + 1, { rebirth, before, after });
  c.check('the new run starts at Level 0 with no salvage, water, facilities, specialists, upgrades or missions', rebirth.run.level === 0 && rebirth.run.levelRooms === 0 && !rebirth.run.exitFound && rebirth.run.salvage === 0 && rebirth.run.aw === 0
    && !Object.keys(rebirth.run.facilities).length && !Object.keys(rebirth.run.specialists).length && !Object.keys(rebirth.run.upgrades).length && !Object.keys(rebirth.run.missions).length, rebirth.run);
  c.check('research, Echoes, relics and achievements are kept', rebirth.kept.research && rebirth.kept.echoes === 12 && rebirth.kept.relic === 1 && rebirth.kept.ach, rebirth.kept);
  c.check('noclip is locked again until the next completion', rebirth.can === false && rebirth.again === false, rebirth);

  // Staying in FUN keeps raising the reward for noclipping.
  const grow = await ev(() => {
    const H = HUM;
    H.replaceState(H.sanitizeState({ v: 2 }));
    H.rt.saveBlocked = true;
    const r = H.S.run;
    Object.assign(r, { level: 6, exitFound: true });
    r.stats.salvage = 1e12;
    const a = H.dvPreview();
    r.stats.salvage = 1e14;
    return { a, b: H.dvPreview() };
  });
  c.check('continuing in Level FUN raises the Déjà Vu a noclip will give', grow.b > grow.a && grow.a >= 1, grow);

  c.finish(g.errors);
  await g.browser.close();
})();
