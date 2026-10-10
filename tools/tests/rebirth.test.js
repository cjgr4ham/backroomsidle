// Noclip (the rebirth system) must behave the same with every experiment off and every experiment on. In v2 it opens
// only once the finite survey is complete (the last room of Level 5, which leads into Level FUN); completing the
// survey never counts a noclip. A noclip pays the previewed Déjà Vu, counts once, starts the next iteration at Level 0
// with a fresh run, and keeps research (with a project under way), Echoes, relics, achievements and Memories.
const { open, Checker } = require('./harness');

function scenario() {
  const H = HUM, P = H.CONFIG.prestige;
  H.rt.saveBlocked = true;
  H.replaceState(H.sanitizeState({ v: 2 }));
  H.rt.saveBlocked = true;
  const S = () => H.S;
  // Compared with sorted keys: the sanitizer rebuilds objects, so key order may differ while every value matches.
  const canon = (v) => (v && typeof v === 'object' ? (Array.isArray(v) ? v.map(canon) : Object.keys(v).sort().reduce((o, k) => { o[k] = canon(v[k]); return o; }, {})) : v);
  const snap = () => JSON.stringify(canon(JSON.parse(JSON.stringify(S()))));
  const out = { prestige: P, final: H.FINAL_LEVEL, fun: H.FUN_LEVEL };

  // The noclip hooks, seen by a handler of a test-only experiment (switched on in both pages: ?exp= only covers ids it knows).
  H.Exp.define({ id: 'TEST-REBIRTH-HOOKS', name: 'Rebirth test hooks', summary: 'Records the noclip hooks for the rebirth test.' });
  out.hooks = [];
  H.Exp.hook('noclip:newRun', 'TEST-REBIRTH-HOOKS', (ended) => out.hooks.push({ hook: 'newRun', ended: { ...ended }, iteration: S().iteration, level: S().run.level,
    rooms: S().run.rooms, recovered: S().run.stats.salvage, noclips: S().life.noclips, dv: S().dv, specialists: JSON.stringify(S().run.specialists), facilities: JSON.stringify(canon(S().run.facilities)) }));
  H.Exp.hook('noclip:done', 'TEST-REBIRTH-HOOKS', (ended) => out.hooks.push({ hook: 'done', ended: { ...ended }, iteration: S().iteration, level: S().run.level, noclips: S().life.noclips }));

  // An iteration on the Long Hallway (Level 5) with some of everything, its survey not complete yet.
  const r = S().run;
  Object.assign(r, { level: 5, rooms: 40000, levelRooms: 5000, salvage: 5e6, aw: 300 });
  r.stats.salvage = 2.5e8; r.stats.time = 900;
  r.facilities = { cart: 50, bench: 40, vat: 30, foundry: 20, beacon: 15, condenser: 10, dampener: 5 };
  r.upgrades = { gloves: true, flashlight: true, wheel: true };
  r.drills = 3;
  r.specialists = { scavenge: 5, chart: 2 };
  r.ext = { testRunData: { from: 'the old run' } };   // run data an experiment kept: it must go with the run
  S().echoes = 54; S().research = { pattern: true, hum: true, doc_quiet: true };
  S().relics = { vhs: 1 }; S().achievements = { hunted: true };
  S().nextCondition = 'wet';
  out.setup = { doctrine: H.adoptDoctrine('doc_quiet'), mission: H.launchMission('stairwell'), research: H.doResearch('recursion') };
  const project = JSON.stringify(S().researching);
  out.project = project;

  // Locked before completion, however much salvage was recovered. A refused noclip changes nothing.
  const s0 = snap();
  out.locked = { level: S().run.level, can: H.canNoclip(), preview: H.dvPreview(), ok: H.noclip() };
  out.locked.unchanged = snap() === s0;

  // Completing the survey: Level FUN, everything kept, noclip open, no noclip counted.
  const keptOf = () => JSON.stringify(canon({ salvage: S().run.salvage, aw: S().run.aw, rooms: S().run.rooms, facilities: S().run.facilities, upgrades: S().run.upgrades,
    drills: S().run.drills, specialists: S().run.specialists, missions: S().run.missions, doctrine: S().run.doctrine, stats: S().run.stats }));
  const lifeOf = () => ({ noclips: S().life.noclips, exits: S().life.exits, iteration: S().iteration, dv: S().dv, dvTotal: S().dvTotal });
  const kept0 = keptOf(), life0 = lifeOf();
  H.completeFiniteSurvey();
  out.completed = { level: S().run.level, exitFound: S().run.exitFound, levelRooms: S().run.levelRooms, kept: keptOf() === kept0, life: lifeOf(), life0, can: H.canNoclip(), preview: H.dvPreview() };
  const s1 = snap();
  H.completeFiniteSurvey();   // a second call does nothing
  out.completed.twice = snap() === s1;

  const pick = () => {
    const s = S();
    return {
      dv: s.dv, dvTotal: s.dvTotal, iteration: s.iteration, condition: s.condition, noclips: s.life.noclips, exits: s.life.exits,
      echoes: s.echoes, research: JSON.stringify(s.research), researching: JSON.stringify(s.researching), relics: JSON.stringify(s.relics),
      achievements: JSON.stringify(s.achievements), memories: JSON.stringify(s.memories), level: s.run.level,
      run: JSON.stringify(canon(s.run)), ext: JSON.stringify(s.run.ext),
    };
  };
  const freshRun = JSON.stringify(canon(H.sanitizeState({ v: 2 }).run));

  // The first noclip.
  out.preview1 = H.dvPreview();
  out.before1 = pick();
  out.ok1 = H.noclip();
  out.after1 = pick();
  out.fresh1 = out.after1.run === freshRun;
  out.hooks1 = out.hooks.slice();
  const s2 = snap();
  out.again = H.noclip();   // straight away: the new iteration's survey is not complete
  out.againUnchanged = snap() === s2;

  // Memories: Muscle Memory (now), Old Friends (now and every iteration), Habitual Hoarding (every iteration).
  const dvBefore = S().dv;
  const D0 = H.derive();
  out.bought = ['muscle', 'friends', 'hoard'].map((id) => H.buyMemory(id));
  const D1 = H.derive();
  out.spent = dvBefore - S().dv;
  out.memCost = ['muscle', 'friends', 'hoard'].reduce((n, id) => n + H.MEMORIES.find((m) => m.id === id).cost, 0);
  out.muscle = { survey: D1.surveyUpg / D0.surveyUpg, rooms: D1.roomsBase / D0.roomsBase };
  out.friendsNow = JSON.stringify(S().run.specialists);

  // Rooms mapped from Level 4 past both exits: the overflow is carried into Level 5, then into Level FUN.
  const r2 = S().run;
  r2.level = 4; r2.levelRooms = 0; r2.stats.salvage = 4e9; r2.stats.time = 1200;
  const life2 = lifeOf();
  H.addRooms(H.exitRooms(4) + H.exitRooms(5) + 1234);
  out.carried = { level: r2.level, levelRooms: r2.levelRooms, exitFound: r2.exitFound, maxLevel: S().life.maxLevel, life: lifeOf(), life2 };

  // The second noclip, from Level FUN.
  out.preview2 = H.dvPreview();
  out.before2 = pick();
  const dv2 = { dv: S().dv, dvTotal: S().dvTotal };
  out.ok2 = H.noclip();
  out.after2 = pick();
  out.gain2 = { dv: S().dv - dv2.dv, dvTotal: S().dvTotal - dv2.dvTotal };
  out.hooks2 = out.hooks.slice(out.hooks1.length);
  out.start2 = { specialists: JSON.stringify(S().run.specialists), facilities: JSON.stringify(canon(S().run.facilities)) };
  out.dvMult = H.derive().dvMult;

  // Still locked in the new iteration: on Level 3 (where v1 opened noclip) and one room short of the end of Level 5.
  S().run.level = 3; S().run.stats.salvage = 1e9;
  const s3 = snap();
  out.blocked3 = { can: H.canNoclip(), ok: H.noclip() };
  out.blocked3.unchanged = snap() === s3;
  S().run.level = 5; S().run.levelRooms = H.exitRooms(5) - 1; S().run.stats.salvage = 1e12;
  const s5 = snap();
  out.blocked5 = { can: H.canNoclip(), preview: H.dvPreview(), ok: H.noclip() };
  out.blocked5.unchanged = snap() === s5;

  // Save round trip after rebirths.
  const again = H.sanitizeState(JSON.parse(JSON.stringify(S())));
  out.roundTrip = JSON.stringify(canon({ ...again, created: 0, lastSaved: 0 })) === JSON.stringify(canon({ ...JSON.parse(JSON.stringify(S())), created: 0, lastSaved: 0 }));

  // The project kept through both noclips runs on the game clock in the new iteration and completes there, once.
  const left = S().researching ? S().researching.end - S().time : -1;
  H.catchUp(Math.max(1, left + 1));
  out.finished = { left, done: S().research.recursion === true, researching: S().researching, echoes: S().echoes };
  return out;
}

(async () => {
  const c = new Checker('Rebirth regression: Noclip with every experiment off and on');
  const off = await open('?exp=none');
  const on = await open('?exp=all');
  const a = await off.ev(scenario);
  const b = await on.ev(scenario);
  const both = (fn) => fn(a) && fn(b);
  const P = a.prestige;
  const formula = (salvage, complete) => Math.floor(Math.pow(salvage / P.divisor, P.exponent) * (complete ? P.exitMult : 1));

  c.check('the scenario sets up: a doctrine, a mission under way and a research project under way', both((x) => x.setup.doctrine && x.setup.mission && x.setup.research && x.project !== 'null'), { off: a.setup, on: b.setup });
  c.check('before the survey is complete noclip is locked, however much salvage was recovered, and trying changes nothing',
    both((x) => x.locked.level === x.final && x.locked.preview >= 1 && !x.locked.can && x.locked.ok === false && x.locked.unchanged), { off: a.locked, on: b.locked });
  c.check('completing the survey enters Level FUN with everything kept, and counts no noclip',
    both((x) => x.completed.level === x.fun && x.completed.exitFound && x.completed.kept && JSON.stringify(x.completed.life) === JSON.stringify(x.completed.life0) && x.completed.life.noclips === 0 && x.completed.life.exits === 0 && x.completed.twice),
    { off: a.completed, on: b.completed });
  c.check('completing the survey opens noclip and adds the completion bonus (×1.5) to the preview',
    both((x) => x.completed.can && x.locked.preview === formula(2.5e8, false) && x.completed.preview === formula(2.5e8, true)), { off: [a.locked.preview, a.completed.preview], on: [b.locked.preview, b.completed.preview], expected: [formula(2.5e8, false), formula(2.5e8, true)] });
  c.check('Déjà Vu on noclip follows the formula: floor((recovered ÷ divisor)^exponent × 1.5)', both((x) => x.preview1 === formula(2.5e8, true) && x.preview2 === formula(4e9, true)),
    { off: [a.preview1, a.preview2], on: [b.preview1, b.preview2], expected: [formula(2.5e8, true), formula(4e9, true)] });
  c.check('a noclip pays the previewed Déjà Vu once, to spend and to the total earned',
    both((x) => x.ok1 && x.after1.dv - x.before1.dv === x.preview1 && x.after1.dvTotal - x.before1.dvTotal === x.preview1 && x.ok2 && x.gain2.dv === x.preview2 && x.gain2.dvTotal === x.preview2),
    { off: [a.after1.dv, a.after1.dvTotal, a.gain2], on: [b.after1.dv, b.after1.dvTotal, b.gain2] });
  c.check('the first noclip gives the same Déjà Vu with experiments on', a.ok1 && b.ok1 && a.preview1 === b.preview1 && a.after1.dv === b.after1.dv && a.after1.dvTotal === b.after1.dvTotal, { off: a.after1, on: b.after1 });
  c.check('a noclip starts the next iteration at Level 0 with a fresh run: no salvage, facilities, upgrades, specialists, missions or doctrine',
    both((x) => x.fresh1 && x.after1.level === 0) && a.after1.run === b.after1.run, { off: a.after1.run, on: b.after1.run });
  c.check('experiment data of the old run is cleared with it', both((x) => x.before1.ext !== '{}' && x.after1.ext === '{}'), { off: a.after1.ext, on: b.after1.ext });
  c.check('research and the project under way, Echoes, relics, achievements and Memories are kept, identically',
    ['echoes', 'research', 'researching', 'relics', 'achievements', 'memories'].every((k) => a.after1[k] === b.after1[k] && a.after1[k] === a.before1[k])
      && a.after1.researching === a.project && a.after1.echoes === 42 && a.after1.achievements === '{"hunted":true}', { off: a.after1, on: b.after1 });
  c.check('iteration, noclip count, exits and the chosen condition advance once, the same way',
    both((x) => x.after1.iteration === 2 && x.after1.noclips === 1 && x.after1.exits === 1 && x.after1.condition === 'wet'), { off: a.after1, on: b.after1 });
  c.check('a second noclip straight away is refused and changes nothing', both((x) => x.again === false && x.againUnchanged), { off: a.again, on: b.again });
  const hookOk = (x) => {
    const [n, d] = x.hooks1;
    return x.hooks1.length === 2 && n.hook === 'newRun' && d.hook === 'done'
      && n.iteration === 2 && n.level === 0 && n.rooms === 0 && n.recovered === 0 && n.noclips === 1 && n.dv === x.after1.dv
      && n.ended.iteration === 1 && n.ended.level === x.fun && n.ended.exitFound === true && n.ended.salvage === 2.5e8 && n.ended.gain === x.preview1
      && d.iteration === 2 && d.level === 0 && d.noclips === 1 && JSON.stringify(d.ended) === JSON.stringify(n.ended);
  };
  c.check('the noclip hooks run once each: noclip:newRun on the new run, then noclip:done, with the iteration that ended', both(hookOk), { off: a.hooks1, on: b.hooks1 });
  c.check('Memories cost the same: Muscle Memory, Old Friends and Habitual Hoarding', both((x) => x.bought.every(Boolean) && x.spent === x.memCost) && a.after2.memories === b.after2.memories, { off: [a.bought, a.spent], on: [b.bought, b.spent], cost: a.memCost });
  c.check('Muscle Memory: surveys by hand ×2 salvage and every survey ×1.5 rooms, at once',
    both((x) => Math.abs(x.muscle.survey - 2) < 1e-12 && Math.abs(x.muscle.rooms - 1.5) < 1e-12), { off: a.muscle, on: b.muscle });
  c.check('Old Friends recruits the Scavenger at once, and every iteration starts with it; Habitual Hoarding starts it with 10 carts, 5 benches and 2 beacons',
    both((x) => x.friendsNow === '{"scavenge":1}' && x.start2.specialists === '{"scavenge":1}' && x.start2.facilities === '{"beacon":2,"bench":5,"cart":10}'), { off: [a.friendsNow, a.start2], on: [b.friendsNow, b.start2] });
  c.check('the starting bonuses are already there when noclip:newRun runs, and both hooks run once on the second noclip',
    both((x) => x.hooks2.length === 2 && x.hooks2[0].hook === 'newRun' && x.hooks2[1].hook === 'done' && x.hooks2[0].specialists === x.start2.specialists && x.hooks2[0].facilities === x.start2.facilities),
    { off: a.hooks2, on: b.hooks2 });
  c.check('mapping rooms carries the overflow across levels into Level FUN, completing the survey without counting a noclip',
    both((x) => x.carried.level === x.fun && x.carried.levelRooms === 1234 && x.carried.exitFound && x.carried.maxLevel === x.fun && JSON.stringify(x.carried.life) === JSON.stringify(x.carried.life2)),
    { off: a.carried, on: b.carried });
  c.check('the second noclip matches with experiments on, and counts once more', a.ok2 && b.ok2 && a.preview2 === b.preview2 && a.after2.dv === b.after2.dv && a.after2.dvTotal === b.after2.dvTotal
    && both((x) => x.after2.noclips === 2 && x.after2.exits === 2 && x.after2.iteration === 3), { off: a.after2, on: b.after2 });
  c.check('the second noclip keeps the bought Memories, research, the project under way, Echoes and relics too',
    both((x) => ['echoes', 'research', 'researching', 'relics', 'achievements', 'memories'].every((k) => x.after2[k] === x.before2[k]) && x.after2.memories === '{"muscle":1,"friends":1,"hoard":1}' && x.after2.researching === x.project),
    { off: a.after2, on: b.after2 });
  c.check('Déjà Vu raises production by the same +1% per point', Math.abs(a.dvMult - b.dvMult) < 1e-12 && Math.abs(a.dvMult - (1 + a.after2.dvTotal * P.dvBonus)) < 1e-12, { off: a.dvMult, on: b.dvMult });
  c.check('noclip stays locked on Level 3, and one room short of the end of Level 5, and trying changes nothing',
    both((x) => !x.blocked3.can && x.blocked3.ok === false && x.blocked3.unchanged && !x.blocked5.can && x.blocked5.preview >= 1 && x.blocked5.ok === false && x.blocked5.unchanged),
    { off: [a.blocked3, a.blocked5], on: [b.blocked3, b.blocked5] });
  c.check('saves survive a round trip after rebirths', a.roundTrip && b.roundTrip, { off: a.roundTrip, on: b.roundTrip });
  c.check('the research project kept through the noclips completes on the game clock in the new iteration, without paying again',
    both((x) => x.finished.left > 0 && x.finished.done && x.finished.researching === null && x.finished.echoes === 42), { off: a.finished, on: b.finished });

  c.finish([...off.errors, ...on.errors]);
  await off.browser.close();
  await on.browser.close();
})();
