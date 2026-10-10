// EXP-AMBIENT-EVENTS: small cosmetic events in the corridor ahead (a failing light, a door opening, footsteps in the
// water, the Watcher checking a sound). They must keep their cadence, one at a time; resolve on their own; happen only
// where they fit; never happen while anything that matters is going on, and end before the frame in which it begins;
// respect reduced motion and the flicker setting; keep any sound quiet and capped; and change nothing in the game.
const { open, Checker } = require('./harness');

const helpers = () => {
  const H = HUM;
  window.T = window.T || 1000;
  /** n frames of `ms` each, the simulation stepped by the same time. */
  window.frames = (n, ms = 40, each) => {
    for (let i = 0; i < n; i++) { H.step(ms / 1000, false); window.T += ms; H.View.render(window.T); if (each) each(i); }
  };
  window.fresh = (lv, specs) => {
    H.replaceState(H.sanitizeState({ v: 2 }));
    H.rt.saveBlocked = true;
    H.S.settings.crt = false;
    if (lv) H.enterLevel(lv);
    H.S.run.specialists = specs || {};
    H.S.run.nextAnomalyAt = H.S.time + 1e9;     // no anomaly or entity unless a check asks for one
    H.rt.lastSurveyTime = -1e9;
    window.frames(3);
  };
  window.api = () => H.Exp.ask('ambient:api');
  /** Forces an event of a kind, rendering a few frames between tries until it fits here. */
  window.force = (kind) => { for (let i = 0; i < 300; i++) { if (window.api().force(kind)) return true; window.frames(1); } return false; };
};

(async () => {
  const c = new Checker('EXP-AMBIENT-EVENTS: ambient events');
  const g = await open('', null, { manualFrames: true });
  const { ev } = g;
  await ev(helpers);

  const cadence = await ev(() => {
    const H = HUM;
    window.fresh(0);
    H.S.run.attention = 0;
    // Five minutes of an idle corridor, frames of 100 ms.
    window.frames(3000, 100, () => { H.S.run.nextAnomalyAt = H.S.time + 1e9; H.S.run.attention = 0; H.S.run.pendingIncident = null; });
    const h = window.api().history();
    const gaps = h.slice(1).map((x, i) => x.at - h[i].ended);
    const overlap = h.slice(1).some((x, i) => !(h[i].ended <= x.at));
    const lasted = h.map((x) => ({ kind: x.kind, d: x.ended - x.at }));
    return { n: h.length, kinds: [...new Set(h.map((x) => x.kind))].sort(), gaps, overlap, lasted, first: h[0] && h[0].at };
  });
  c.check(`events keep their cadence: the next one 20 to 48 seconds after the last ended (${cadence.n} in five minutes)`,
    cadence.n >= 5 && cadence.n <= 12 && cadence.gaps.every((d) => d >= 19.9 && d <= 48.5), cadence);
  c.check('one at a time, and each resolves on its own within its few seconds',
    !cadence.overlap && cadence.lasted.every((x) => x.d > 0 && x.d <= ({ light: 5.05, door: 7.55, water: 5.5, check: 15.05 })[x.kind]), cadence.lasted);

  const kinds = await ev(() => {
    const H = HUM, out = {};
    // A failing light: it stutters, goes out for a moment, and is steady again before the event ends.
    window.fresh(0);
    H.S.settings.flicker = true;
    out.light = window.force('light');
    const e = window.api().event(), seen = [];
    window.frames(150, 40, () => { const x = window.api().event(); seen.push(x ? window.api().light(e.k) : null); });
    const during = seen.filter((v) => v !== null);
    out.lightDims = during.some((v) => v <= 0.45) && during.some((v) => v === 1);
    out.lightBack = during.slice(-5).every((v) => v === 1) && seen[seen.length - 1] === null;
    out.lightBothStretches = e.k2 === e.k + 1;
    // The stretch's own light is what the corridor draws with: View.lightLevel follows.
    window.fresh(0);
    window.force('light');
    const e2 = window.api().event();
    let dimmed = false;
    window.frames(100, 40, () => { if (window.api().event() && window.api().light(e2.k) < 1) dimmed = dimmed || H.View.lightLevel(e2.k, window.T / 1000) < 0.5; });
    out.drawnDim = dimmed;
    // A door: the Long Hallway's doors swing open; elsewhere light from inside a dark doorway.
    window.fresh(5);
    out.leaf = window.force('door') && window.api().event().mode;
    const open = [];
    window.frames(200, 40, () => open.push(window.api().open()));
    out.doorOpens = Math.max(...open) === 1 && open[open.length - 1] === 0;
    window.fresh(0);
    out.slit = window.force('door') && window.api().event().mode;
    // Night Office: never in a doorway behind a cubicle partition.
    window.fresh(4);
    let behind = 0, placed = 0;
    for (let i = 0; i < 60; i++) { H.View.camZ += 1.7; H.View.target = H.View.camZ; const p = window.api().place('door'); if (p) { placed++; if (H.View.features(p.k).hk % 4 !== 0) behind++; } }
    out.office = { placed, behind };
    // Footsteps in the water only where there is water.
    window.fresh(3);
    out.water = window.force('water');
    const w = window.api().event();
    out.steps = w.steps.length;
    window.fresh(0);
    out.dryWater = window.api().force('water');
    out.dryPlace = window.api().place('water');
    // Never closer than a few stretches: never in the foreground.
    let nearest = 1e9;
    for (const lv of [0, 3, 5]) {
      window.fresh(lv);
      for (let i = 0; i < 40; i++) { H.View.camZ += 1.3; H.View.target = H.View.camZ; for (const kind of ['light', 'door', 'water']) { const p = window.api().place(kind); if (p) nearest = Math.min(nearest, p.z - H.View.camZ); } }
    }
    out.nearest = nearest;
    return out;
  });
  c.check('a failing light stutters, goes out a moment and is steady again before the event ends', kinds.light && kinds.lightDims && kinds.lightBack && kinds.lightBothStretches, kinds);
  c.check('the corridor is drawn with that light: View.lightLevel follows it (view:light)', kinds.drawnDim, kinds);
  c.check('a Long Hallway door swings open and shut; elsewhere light from a door inside a dark doorway', kinds.leaf === 'leaf' && kinds.doorOpens && kinds.slit === 'slit', kinds);
  c.check('in the Night Office never in a doorway behind a cubicle partition', kinds.office.placed >= 8 && kinds.office.behind === 0, kinds.office);
  c.check('footsteps cross the Poolrooms water, and never happen where there is no water', kinds.water && kinds.steps >= 7 && kinds.dryWater === false && kinds.dryPlace === null, kinds);
  c.check('events happen a few stretches ahead, never in the foreground', kinds.nearest >= 2.5, kinds.nearest);

  const check = await ev(() => {
    const H = HUM, out = {};
    window.fresh(0, {});
    out.noWatcher = window.api().place('check');
    window.fresh(0, { watch: 3 });
    window.frames(60);
    out.go = window.force('check');
    const crew = H.Exp.ask('crew:api');
    const states = [];
    let endedAt = null;
    window.frames(500, 40, (i) => { const w = crew.actors().find((a) => a.id === 'watch'); states.push(w.state); if (endedAt === null && !window.api().event()) endedAt = i; });
    out.checked = states.includes('checking');
    const back = states.lastIndexOf('checking');
    out.backToWork = states.slice(back + 1).includes('working') || states.slice(back + 1).includes('moving');
    out.endsWhenBack = endedAt !== null && Math.abs(endedAt - (back + 1)) <= 2;
    return out;
  });
  c.check('the Watcher checks a sound only when on stage: walks to the doorway, looks, goes back to work, and the event ends with it',
    check.noWatcher === null && check.go && check.checked && check.backToWork && check.endsWhenBack, check);

  const quiet = await ev(() => {
    const H = HUM, out = {};
    const tryNow = () => { window.api().setNext(0); window.frames(2); return !!window.api().event(); };
    // An event under way ends the moment something that matters begins, before that frame is drawn.
    const cases = {
      entity: () => { H.rt.lastSurveyTime = H.S.time; H.spawnEncounter(); return !!H.rt.encounter; },
      anomaly: () => { H.spawnAnomaly(); return !!H.rt.anomaly; },
      warning: () => { H.S.run.pendingIncident = { type: 'breach', at: H.S.time + 60, warn: 60, target: null }; return true; },
      lightsOut: () => { H.S.run.lightsUntil = H.S.time + 30; return true; },
      blackout: () => { H.S.run.blackoutUntil = H.S.time + 30; return true; },
      shakes: () => { H.S.run.stunUntil = H.S.time + 30; return true; },
    };
    const clear = () => { if (H.rt.encounter) H.endEncounter('test'); H.rt.anomaly = null; H.S.run.pendingIncident = null; H.S.run.lightsUntil = 0; H.S.run.blackoutUntil = 0; H.S.run.stunUntil = 0; };
    for (const [name, start] of Object.entries(cases)) {
      window.fresh(0, { watch: 3 });
      window.frames(30);
      window.force(name === 'entity' ? 'check' : 'light');
      const had = !!window.api().event();
      const began = start();
      window.frames(1);                     // one frame, as the game runs it: a step, then the drawing
      const after = window.api().event();
      // While it lasts, nothing new begins.
      const during = tryNow() || tryNow();
      clear();
      // And none for a few quiet seconds after.
      const soon = tryNow();
      out[name] = { had, began, endedFirstFrame: after === null, during, soon };
    }
    return out;
  });
  c.check('an event ends the moment an entity, anomaly, incident warning, lights out, blackout or the shakes begin, before that frame is drawn',
    Object.values(quiet).every((x) => x.had && x.began && x.endedFirstFrame), quiet);
  c.check('none begins while any of those lasts, nor in the quiet seconds after', Object.values(quiet).every((x) => !x.during && !x.soon), quiet);

  const later = await ev(() => {
    const H = HUM;
    window.fresh(0);
    H.S.run.lightsUntil = H.S.time + 2;
    window.frames(60);                    // lights back on
    const t0 = window.api().clock();
    window.api().setNext(0);
    let at = null;
    window.frames(400, 40, () => { if (at === null && window.api().event()) at = window.api().clock(); });
    return { wait: at === null ? null : at - t0 };
  });
  c.check('once calm again, the next one can begin after about 8 quiet seconds', later.wait !== null && later.wait >= 5 && later.wait <= 15, later);

  const motion = await ev(() => {
    const H = HUM, out = {};
    // Flicker off: a failing light only dims.
    window.fresh(0);
    H.S.settings.flicker = false;
    window.force('light');
    const k = window.api().event().k, f = [];
    window.frames(60, 40, () => { if (window.api().event()) f.push(window.api().light(k)); });
    out.flickerOff = f.length > 10 && f.every((v) => v === 0.55);
    H.S.settings.flicker = true;
    // Reduced motion: still versions and a small label.
    window.fresh(5);
    H.S.settings.motion = 'reduce'; H.rt.reducedMotion = true;
    window.force('door');
    const o = [];
    let label = null;
    window.frames(60, 40, () => { if (window.api().event()) { o.push(window.api().open()); label = label || window.api().labelled(); } });
    out.doorStill = o.length > 10 && o.every((v) => v === 0.6);
    out.label = label;
    window.fresh(0);
    H.S.settings.motion = 'reduce'; H.rt.reducedMotion = true;
    window.force('light');
    const k2 = window.api().event().k, f2 = [];
    window.frames(60, 40, () => { if (window.api().event()) f2.push(window.api().light(k2)); });
    out.lightStill = f2.length > 10 && f2.every((v) => v === 0.55);
    // No ripples from the crew's steps under reduced motion either.
    window.fresh(3, { dowse: 3, chart: 3 });
    H.S.settings.motion = 'reduce'; H.rt.reducedMotion = true;
    window.frames(200);
    out.ripplesStill = window.api().ripples().length === 0;
    H.S.settings.motion = 'auto'; H.rt.reducedMotion = false;
    return out;
  });
  c.check('with flicker off a failing light only dims; reduced motion shows still versions with a label', motion.flickerOff && motion.doorStill && motion.lightStill && motion.label === 'a door opening' && motion.ripplesStill, motion);

  const misc = await ev(() => {
    const H = HUM, out = {};
    // Passed by the camera: surveying past an event ends it.
    window.fresh(5);
    window.force('door');
    for (let i = 0; i < 10; i++) { H.rt.lastSurveyReal = -1e9; H.survey(); window.frames(3); }
    out.passed = window.api().event() === null;
    // Crew walking in the Poolrooms leave ripples, a bounded few.
    window.fresh(3, { dowse: 3, chart: 3, scavenge: 3 });
    let most = 0, any = 0;
    window.frames(600, 40, () => { const n = window.api().ripples().length; most = Math.max(most, n); any += n; });
    out.ripples = { most, any };
    // A hidden tab, a level change: the scene is cleared.
    window.fresh(0);
    window.force('light');
    H.Exp.runAll('page:visible');
    const next = window.api().next() - window.api().clock();
    out.visible = { cleared: window.api().event() === null, next };
    window.force('light');
    H.enterLevel(1); window.frames(1);
    out.level = window.api().event() === null;
    // Sound: one short sound slot per event at most, 12 s apart, none with sound effects or ambience off.
    window.fresh(0);
    window.frames(330);                    // past the last sound slot
    const s0 = window.api().sounds();
    for (let i = 0; i < 6; i++) { window.force('light'); window.frames(50); }
    const s1 = window.api().sounds();
    window.frames(400);
    H.S.settings.sfx = false;
    for (let i = 0; i < 3; i++) { window.force('light'); window.frames(400); }
    const s2 = window.api().sounds();
    H.S.settings.sfx = true; H.S.settings.ambience = false;
    for (let i = 0; i < 3; i++) { window.force('light'); window.frames(400); }
    const s3 = window.api().sounds();
    H.S.settings.ambience = true;
    out.sounds = { burst: s1 - s0, sfxOff: s2 - s1, ambienceOff: s3 - s2 };
    // Switched off: it stops at once, the Watcher goes back to work, and nothing is left behind.
    window.fresh(0, { watch: 3 });
    window.frames(60);
    const sent = window.force('check');
    H.Exp.set('EXP-AMBIENT-EVENTS', false);
    window.frames(2);
    const w = H.Exp.ask('crew:api').actors().find((a) => a.id === 'watch');
    out.off = { sent, watcher: w.state, api: H.Exp.ask('ambient:api') === undefined };
    H.Exp.set('EXP-AMBIENT-EVENTS', true);
    out.on = { stale: window.api().event() === null };
    // No page structure changes while events are drawn; and a frame stays cheap.
    window.fresh(5);
    window.force('door');
    let mutations = 0;
    const mo = new MutationObserver((l) => { mutations += l.length; });
    mo.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
    window.frames(60);
    mo.disconnect();
    out.mutations = mutations;
    window.force('door');
    const t0 = performance.now();
    window.frames(150);
    out.ms = (performance.now() - t0) / 150;
    // Never the game's random sequence: frames with events of every kind draw nothing from Math.random.
    window.fresh(3, { watch: 3, dowse: 3 });
    window.frames(40);
    const real = Math.random;
    let calls = 0;
    Math.random = () => { calls++; return real(); };
    for (const kind of ['light', 'door', 'water', 'check']) { window.api().force(kind); for (let i = 0; i < 80; i++) H.View.render(window.T += 40); }
    Math.random = real;
    out.random = calls;
    return out;
  });
  c.check('surveying past an event leaves it behind: it ends', misc.passed, misc);
  c.check('crew walking in the Poolrooms leave ripples, a bounded few', misc.ripples.any > 0 && misc.ripples.most <= 10, misc.ripples);
  c.check('a hidden tab or a level change clears the scene; the next event comes 8 to 16 seconds after the page is shown',
    misc.visible.cleared && misc.visible.next >= 8 && misc.visible.next <= 16 && misc.level, misc);
  c.check('sound stays capped: at most one quiet sound slot per 12 seconds, none with sound effects or ambience off',
    misc.sounds.burst >= 1 && misc.sounds.burst <= 2 && misc.sounds.sfxOff === 0 && misc.sounds.ambienceOff === 0, misc.sounds);
  c.check('switched off it stops at once: the Watcher goes back to work, and nothing stale returns when switched on', misc.off.sent && misc.off.watcher !== 'checking' && misc.off.api && misc.on.stale, misc);
  c.check('drawing events changes nothing in the page structure', misc.mutations === 0, misc.mutations);
  c.check(`a frame with an event stays cheap (${misc.ms.toFixed(2)} ms including the simulation step)`, misc.ms < 8, misc.ms);
  c.check('frames with events of every kind never draw from the game’s random sequence', misc.random === 0, misc.random);
  c.check('no console or page errors so far', g.errors.length === 0, g.errors.slice(0, 5));
  await g.browser.close();

  // The same seeded session, rendered every frame, with ambient events on and off: the game must not differ at all.
  const session = (seed) => {
    let a = seed >>> 0;
    Math.random = () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const H = HUM;
    H.UI.floatGain = () => {};
    H.replaceState(H.sanitizeState({ v: 2 }));
    H.rt.saveBlocked = true;
    H.rt.checkAcc = 0; H.rt.autobuyAcc = 0;
    H.S.run.specialists = { scavenge: 6, chart: 4, dowse: 3, watch: 3, archive: 2 };
    let T = 5000, events = 0;
    for (let i = 0; i < 2400; i++) {
      if (i === 800) H.enterLevel(3);
      if (i === 1600) H.enterLevel(5);
      if (i % 5 === 0 && (i % 400) < 200) { H.rt.lastSurveyReal = -1e9; H.survey(); }
      const api = H.Exp.ask('ambient:api');
      if (api && i % 60 === 0) { api.setNext(0); }
      H.step(0.1, false);
      T += 40; H.View.render(T);
      if (api && api.event()) events++;
    }
    return { state: JSON.stringify(H.S, (k, v) => (k === 'created' || k === 'lastSaved' ? undefined : v)), events };
  };
  const on = await open('', null, { manualFrames: true });
  const off = await open('?exp=-EXP-AMBIENT-EVENTS', null, { manualFrames: true });
  const [sOn, sOff] = await Promise.all([on.ev(session, 21), off.ev(session, 21)]);
  c.check(`zero effect on the game: the same seeded session ends in the same state with ambient events on and off (${sOn.events} frames with an event)`,
    sOn.state === sOff.state && sOn.state.length > 1000 && sOn.events > 100 && sOff.events === 0, { on: sOn.state.length, off: sOff.state.length, events: [sOn.events, sOff.events] });
  const crewOff = await open('?exp=-EXP-CREW-VISIBLE', null, { manualFrames: true });
  await crewOff.ev(helpers);
  const alone = await crewOff.ev(() => {
    window.fresh(0, { watch: 3 });
    return { check: window.api().force('check'), light: window.force('light'), door: window.force('door') };
  });
  c.check('with the visible crew off there is no Watcher to send; the other events still happen', alone.check === false && alone.light && alone.door, alone);
  c.check('no console or page errors on or off', [on, off, crewOff].every((x) => x.errors.length === 0), [...on.errors, ...off.errors, ...crewOff.errors].slice(0, 4));
  for (const x of [on, off, crewOff]) await x.browser.close();
  c.finish();
})();
