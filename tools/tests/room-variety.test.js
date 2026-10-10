// EXP-ROOM-VARIETY: rooms off the corridor and traces of the crew's work. Seeded per stretch (stable), closed within
// a stretch, in each level's style; traces bounded and near the scenes; doorways reported to the corridor's other users.
// Drawing only: the game is exactly the same with it on or off.
const { open, Checker } = require('./harness');

(async () => {
  const c = new Checker('EXP-ROOM-VARIETY: room variety and work traces');
  const g = await open('', null, { manualFrames: true });
  const { ev } = g;

  const seeds = await ev(() => {
    const H = HUM, api = H.Exp.ask('rooms:api');
    const out = {};
    for (const lv of [0, 1, 2, 3, 4, 5, 6]) {
      H.View.level = lv;
      const n = { junction: 0, bay: 0, recess: 0, storage: 0 };
      let stable = true, cubicleClash = 0;
      for (let k = 0; k < 3000; k++) {
        const a = api.roomAt(k), b = api.roomAt(k);
        if (JSON.stringify(a) !== JSON.stringify(b)) stable = false;
        if (a) n[a.type]++;
        if (a && lv === 4 && HUM.View.features(k).hk % 4 !== 0) cubicleClash++;
      }
      out[lv] = { n, stable, cubicleClash };
    }
    H.View.level = 0;
    return out;
  });
  c.check('the same stretch always gets the same room', Object.values(seeds).every((x) => x.stable), seeds);
  c.check('on Levels 0–3 and FUN roughly 4% junctions, 7% bays, 8% recesses and 10% storage',
    [0, 1, 2, 3, 6].every((lv) => { const n = seeds[lv].n; return Math.abs(n.junction / 3000 - 0.04) < 0.015 && Math.abs(n.bay / 3000 - 0.07) < 0.02 && Math.abs(n.recess / 3000 - 0.08) < 0.02 && Math.abs(n.storage / 3000 - 0.1) < 0.025; }), seeds);
  c.check('the Long Hallway keeps its doors: only junctions and rooms, no recesses or storage', seeds[5].n.recess === 0 && seeds[5].n.storage === 0 && seeds[5].n.junction > 0 && seeds[5].n.bay > 0, seeds[5]);
  c.check('the Night Office never puts a room behind a cubicle partition', seeds[4].cubicleClash === 0 && seeds[4].n.bay > 0, seeds[4]);

  const feat = await ev(() => {
    const H = HUM, api = H.Exp.ask('rooms:api');
    H.View.level = 0;
    let kj = 0, kb = 0;
    for (let k = 1; k < 3000 && (!kj || !kb); k++) { const r = api.roomAt(k); if (r && r.type === 'junction' && !kj) kj = k; if (r && r.type === 'bay' && !kb) kb = k; }
    const fj = H.View.features(kj), fb = H.View.features(kb), rb = api.roomAt(kb);
    H.Exp.set('EXP-ROOM-VARIETY', false);
    const off = H.View.features(kj);
    H.Exp.set('EXP-ROOM-VARIETY', true);
    return { fj: [fj.left, fj.right, fj.leftSpan, fj.rightTop], fb: [rb.side < 0 ? fb.left : fb.right, rb.side < 0 ? fb.leftSpan : fb.rightSpan], off: [off.left, off.right] };
  });
  c.check('its doorways are reported to the corridor’s other users, with their span and height',
    feat.fj[0] === 'junction' && feat.fj[1] === 'junction' && JSON.stringify(feat.fj[2]) === '[0.12,0.88]' && feat.fj[3] === 1.25 && feat.fb[0] === 'bay', feat);
  c.check('switched off, the corridor is reported as before', feat.off.every((x) => x !== 'junction'), feat);

  const traces = await ev(() => {
    const H = HUM, api = H.Exp.ask('rooms:api');
    H.replaceState(H.sanitizeState({ v: 2 }));
    H.rt.saveBlocked = true;
    for (let i = 0; i < 20; i++) H.Exp.run('crew:result', { id: 'scavenge', k: 5 + i, side: 1, kind: 'panel', z: 5.5 + i, x: 1.18 });
    const out = { bounded: api.traces().length };
    H.Exp.run('crew:result', { id: 'chart', k: 40, side: -1, kind: 'scan', z: 40.5, x: -0.2 });
    out.kinds = [...new Set(api.traces().map((t) => t.kind))].sort().join();
    // Far behind the camera they are gone; a new level clears them.
    H.View.camZ = H.View.target = 80;   // every trace is now more than 30 stretches behind
    let T = (window.__T || 1000) + 40; H.View.render(T); window.__T = T;
    out.behind = api.traces().length;
    H.Exp.run('crew:result', { id: 'dowse', k: 84, side: 1, kind: 'floor', z: 84.5, x: 0.5 });
    H.enterLevel(1);
    T += 40; H.View.render(T); window.__T = T;
    out.level = api.traces().length;
    // Older traces only of crew you have.
    H.S.run.specialists = {};
    let none = 0; for (let k = 0; k < 2000; k++) if (api.seeded(k)) none++;
    H.S.run.specialists = { scavenge: 1, chart: 1, dowse: 1, watch: 1, archive: 1 };
    let some = 0; for (let k = 0; k < 2000; k++) if (api.seeded(k)) some++;
    out.seeded = [none, some];
    return out;
  });
  c.check('traces of the crew’s work are bounded to a few (12)', traces.bounded === 12, traces);
  c.check('each kind of work leaves its own trace', traces.kinds === 'chalk,panel', traces);
  c.check('traces far behind the camera are gone, and a new level clears them', traces.behind === 0 && traces.level === 0, traces);
  c.check('older traces appear only for crew you have, and sparsely', traces.seeded[0] === 0 && traces.seeded[1] > 100 && traces.seeded[1] < 300, traces.seeded);

  const pixels = await ev(() => {
    const H = HUM, api = H.Exp.ask('rooms:api');
    H.replaceState(H.sanitizeState({ v: 2 }));
    H.rt.saveBlocked = true;
    H.S.settings.crt = false; H.S.settings.flicker = false;
    let k = 1; while (!(api.roomAt(k) && api.roomAt(k).type === 'junction')) k++;
    const shot = () => { H.View.camZ = H.View.target = k - 2.5; let T = (window.__T || 1000); for (let i = 0; i < 3; i++) { T += 40; H.View.render(T); } window.__T = T; return H.View.canvas.toDataURL(); };
    const on = shot();
    H.Exp.set('EXP-ROOM-VARIETY', false);
    const off = shot();
    H.Exp.set('EXP-ROOM-VARIETY', true);
    return { differs: on !== off };
  });
  c.check('a junction is actually drawn: the camera feed differs with it on and off', pixels.differs, pixels);
  c.check('no console or page errors so far', g.errors.length === 0, g.errors.slice(0, 5));
  await g.browser.close();

  // Drawing only: the same seeded session, rendered every frame, with room variety on and off.
  const session = (seed) => {
    let a = seed >>> 0;
    Math.random = () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const H = HUM;
    H.UI.floatGain = () => {};
    H.replaceState(H.sanitizeState({ v: 2 }));
    H.rt.saveBlocked = true;
    H.rt.checkAcc = 0; H.rt.autobuyAcc = 0;
    H.S.run.specialists = { scavenge: 6, chart: 4, dowse: 3, watch: 2, archive: 2 };
    let T = 5000;
    for (let i = 0; i < 1200; i++) {
      if (i % 3 === 0) { H.rt.lastSurveyReal = -1e9; H.survey(); }
      H.step(0.1, false);
      T += 40; H.View.render(T);
    }
    return JSON.stringify(H.S, (k, v) => (k === 'created' || k === 'lastSaved' ? undefined : v));
  };
  const on = await open('', null, { manualFrames: true });
  const off = await open('?exp=-EXP-ROOM-VARIETY', null, { manualFrames: true });
  const crewOff = await open('?exp=-EXP-CREW-VISIBLE', null, { manualFrames: true });
  const [sOn, sOff] = await Promise.all([on.ev(session, 11), off.ev(session, 11)]);
  c.check('zero effect on the game: the same session ends in the same state with room variety on and off', sOn === sOff && sOn.length > 1000, { on: sOn.length, off: sOff.length });
  const alone = await crewOff.ev(() => {
    const H = HUM, api = H.Exp.ask('rooms:api');
    H.S.run.specialists = { chart: 3 };
    let k = 1; while (!(api.roomAt(k) && api.roomAt(k).type === 'bay')) k++;
    H.View.camZ = H.View.target = k - 2.5;
    for (let i = 0; i < 3; i++) H.View.render(10000 + i * 40);
    return { room: api.roomAt(k).type, seeded: Array.from({ length: 400 }, (_, i) => api.seeded(i)).filter(Boolean).length > 0 };
  });
  c.check('with the visible crew off, rooms and older traces still appear', alone.room === 'bay' && alone.seeded, alone);
  c.check('no console or page errors on or off', [on, off, crewOff].every((x) => x.errors.length === 0), [...on.errors, ...off.errors, ...crewOff.errors].slice(0, 4));
  for (const x of [on, off, crewOff]) await x.browser.close();
  c.finish();
})();
