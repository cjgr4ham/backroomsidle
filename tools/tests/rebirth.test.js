// Noclip (the rebirth system) must behave the same with every experiment off and every experiment on:
// Déjà Vu earned, what is reset, what is kept, Memories, conditions and the exit bonus.
const { open, Checker } = require('./harness');

function scenario() {
  const H = HUM;
  H.rt.saveBlocked = true;
  H.replaceState(H.sanitizeState({ v: 1 }));
  const S = () => H.S;
  const out = {};
  const r = S().run;
  // An iteration that reached Level 3 with some of everything.
  Object.assign(r, { level: 3, rooms: 40000, levelRooms: 5000, salvage: 5e6, aw: 300 });
  r.stats.salvage = 2.5e8;
  r.facilities = { cart: 50, bench: 40, vat: 30, foundry: 20, beacon: 15, condenser: 10, dampener: 5 };
  r.upgrades = { flashlight: true, radio: true, wheel: true };
  r.crew.total = 8; r.crew.jobs.scavenge = 5;
  S().echoes = 42; S().research = { pattern: true, hum: true };
  S().relics = { vhs: 1 }; S().achievements = { hunted: true };
  S().nextCondition = 'wet';
  out.preview1 = H.dvPreview();
  out.ok1 = H.noclip();
  const pick = () => {
    const s = S();
    return {
      dv: s.dv, dvTotal: s.dvTotal, iteration: s.iteration, condition: s.condition, noclips: s.life.noclips, exits: s.life.exits,
      echoes: s.echoes, research: JSON.stringify(s.research), relics: JSON.stringify(s.relics), achievements: Object.keys(s.achievements).length > 0,
      memories: JSON.stringify(s.memories),
      run: { level: s.run.level, rooms: s.run.rooms, salvage: s.run.salvage, aw: s.run.aw, facilities: JSON.stringify(s.run.facilities),
        upgrades: JSON.stringify(s.run.upgrades), crew: s.run.crew.total, ext: JSON.stringify(s.run.ext), exitFound: s.run.exitFound },
    };
  };
  out.after1 = pick();
  // Spend Déjà Vu on Memories, then noclip again from the exit.
  out.bought = ['muscle', 'friends', 'hoard'].map((id) => H.buyMemory(id));
  const r2 = S().run;
  r2.level = 5; r2.exitFound = true; r2.stats.salvage = 4e9;
  out.preview2 = H.dvPreview();
  out.ok2 = H.noclip();
  out.after2 = pick();
  const D = H.derive();
  out.memoryEffects = { radio: S().run.upgrades.radio === true, crew: S().run.crew.total, facilities: JSON.stringify(S().run.facilities),
    surveyMultMuscle: D.surveyMult, roomsPerSurvey: D.roomsPerSurvey, dvMult: D.dvMult };
  // A noclip is not possible below Level 3 without the exit.
  S().run.level = 2; S().run.stats.salvage = 1e9;
  out.blocked = H.noclip() === false && H.canNoclip() === false;
  // Save round trip after rebirths.
  // Compared with sorted keys: the sanitizer rebuilds the object, so key order may differ while every value matches.
  const canon = (v) => (v && typeof v === 'object' ? (Array.isArray(v) ? v.map(canon) : Object.keys(v).sort().reduce((o, k) => { o[k] = canon(v[k]); return o; }, {})) : v);
  const again = H.sanitizeState(JSON.parse(JSON.stringify(S())));
  out.roundTrip = JSON.stringify(canon({ ...again, created: 0, lastSaved: 0 })) === JSON.stringify(canon({ ...JSON.parse(JSON.stringify(S())), created: 0, lastSaved: 0 }));
  return out;
}

(async () => {
  const c = new Checker('Rebirth regression: Noclip with every experiment off and on');
  const off = await open('?exp=none');
  const on = await open('?exp=all');
  const a = await off.ev(scenario);
  const b = await on.ev(scenario);

  const formula = (salvage, exit) => Math.floor(Math.pow(salvage / 1e5, 0.3) * (exit ? 1.5 : 1));
  c.check('Déjà Vu on noclip follows the original formula', a.preview1 === formula(2.5e8, false) && a.preview2 >= formula(4e9, true), { a: [a.preview1, a.preview2] });
  c.check('the first noclip gives the same Déjà Vu with experiments on', a.ok1 && b.ok1 && a.preview1 === b.preview1 && a.after1.dv === b.after1.dv && a.after1.dvTotal === b.after1.dvTotal, { off: a.after1, on: b.after1 });
  c.check('a noclip resets the run the same way', JSON.stringify({ ...a.after1.run, ext: 0 }) === JSON.stringify({ ...b.after1.run, ext: 0 }) && a.after1.run.level === 0 && a.after1.run.salvage === 0, { off: a.after1.run, on: b.after1.run });
  c.check('experiment data of the old run is cleared with it', b.after1.run.ext === '{}', b.after1.run.ext);
  c.check('Echoes, research, relics and achievements are kept, identically', ['echoes', 'research', 'relics', 'achievements'].every((k) => a.after1[k] === b.after1[k]) && a.after1.echoes === 42, { off: a.after1, on: b.after1 });
  c.check('iteration, noclip count and the chosen condition advance the same way', a.after1.iteration === 2 && b.after1.iteration === 2 && a.after1.condition === 'wet' && b.after1.condition === 'wet' && a.after1.noclips === b.after1.noclips, { off: a.after1, on: b.after1 });
  c.check('Memories cost and apply the same: Muscle Memory, Old Friends and Habitual Hoarding', a.bought.every(Boolean) && b.bought.every(Boolean) && a.after2.memories === b.after2.memories
    && a.memoryEffects.radio && b.memoryEffects.radio && a.memoryEffects.crew === 3 && b.memoryEffects.crew === 3 && a.memoryEffects.facilities === b.memoryEffects.facilities
    && a.memoryEffects.roomsPerSurvey === b.memoryEffects.roomsPerSurvey, { off: a.memoryEffects, on: b.memoryEffects });
  c.check('the exit bonus (×1.5) and the second noclip match', a.ok2 && b.ok2 && a.preview2 === b.preview2 && a.after2.dv === b.after2.dv && a.after2.dvTotal === b.after2.dvTotal && a.after2.exits === 1 && b.after2.exits === 1, { off: a.after2, on: b.after2 });
  c.check('Déjà Vu raises production by the same +1% per point', Math.abs(a.memoryEffects.dvMult - b.memoryEffects.dvMult) < 1e-12 && Math.abs(a.memoryEffects.dvMult - (1 + a.after2.dvTotal * 0.01)) < 1e-12, { off: a.memoryEffects.dvMult, on: b.memoryEffects.dvMult });
  c.check('noclip stays locked below Level 3 without the exit', a.blocked && b.blocked, { off: a.blocked, on: b.blocked });
  c.check('saves survive a round trip after rebirths', a.roundTrip && b.roundTrip, { off: a.roundTrip, on: b.roundTrip });

  c.finish([...off.errors, ...on.errors]);
  await off.browser.close();
  await on.browser.close();
})();
