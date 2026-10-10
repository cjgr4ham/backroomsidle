// EXP-CREW-VISIBLE: recruited specialists drawn in the corridor in world space. The test drives the simulation and
// the frames itself (no frame loop), so every frame is accounted for: positions are world positions the camera moves
// past, nobody jumps while visible, nobody is drawn twice, nobody crosses a wall outside a doorway, at most two are on
// stage, and the game (state, economy, random sequence) is exactly the same with the crew drawn or not.
const { open, Checker } = require('./harness');

// In-page helpers, installed once per page.
const helpers = () => {
  const H = HUM;
  window.T = window.T || 1000;
  window.frames = (n, opts = {}) => {
    const api = H.Exp.ask('crew:api');
    const out = [];
    for (let i = 0; i < n; i++) {
      if (opts.survey && i % opts.survey === 0) { H.rt.lastSurveyReal = -1e9; H.survey(); }
      H.step(0.04, false);
      window.T += 40;
      H.View.render(window.T);
      if (api) out.push({ cam: H.View.camZ, actors: api.actors(), where: api.where() });
    }
    return out;
  };
  window.fresh = (specs) => {
    H.replaceState(H.sanitizeState({ v: 2 }));
    H.rt.saveBlocked = true;
    H.S.run.specialists = specs || { scavenge: 5, chart: 4, dowse: 4, watch: 3, archive: 3 };
    H.S.settings.flicker = false;
    window.frames(2);
  };
};

(async () => {
  const c = new Checker('EXP-CREW-VISIBLE: visible crew');
  const g = await open('', null, { manualFrames: true });
  const { ev } = g;
  await ev(helpers);

  const roster = await ev(() => {
    const H = HUM, api = H.Exp.ask('crew:api');
    window.fresh({});
    const none = { actors: api.actors().length, drawn: Object.keys(window.frames(20).pop().where).length };
    H.S.run.specialists = { scavenge: 3 };
    const after = window.frames(60).pop();
    const one = { ids: after.actors.map((a) => a.id), drawn: Object.keys(after.where) };
    // Taken by an incident: off stage, and never drawn while away.
    H.S.run.away.scavenge = H.S.time + 300;
    const away = window.frames(150);
    const drawnWhileAway = away.slice(60).some((f) => f.where.scavenge);
    const gone = away[away.length - 1].actors.length === 0;
    delete H.S.run.away.scavenge;
    const back = window.frames(200).some((f) => f.where.scavenge);
    return { none, one, drawnWhileAway, gone, back };
  });
  c.check('with no specialist recruited, nobody is in the corridor', roster.none.actors === 0 && roster.none.drawn === 0, roster);
  c.check('a recruited specialist appears, and only them', roster.one.ids.join() === 'scavenge' && roster.one.drawn.join() === 'scavenge', roster);
  c.check('a specialist taken by an incident leaves and is never drawn while away; back, they return', !roster.drawnWhileAway && roster.gone && roster.back, roster);

  const world = await ev(() => {
    const H = HUM, api = H.Exp.ask('crew:api');
    window.fresh();
    window.frames(10);
    const before = api.actors().filter((a) => a.visible && a.state === 'working');
    const cam0 = H.View.camZ;
    H.rt.lastSurveyReal = -1e9; H.survey();
    const f = window.frames(25);
    const after = api.actors();
    const moved = H.View.camZ - cam0;
    return { before: before.map((a) => ({ id: a.id, z: a.z, rel: a.rel })), after: after.map((a) => ({ id: a.id, z: a.z, rel: a.rel, state: a.state })), moved, onStage: before.length };
  });
  const same = world.before.every((b) => { const a = world.after.find((x) => x.id === b.id); return a && Math.abs(a.z - b.z) < 0.15 && Math.abs((b.rel - a.rel) - world.moved) < 0.2; });
  c.check('two specialists on stage at once, working ahead', world.onStage === 2, world);
  c.check('a survey moves the camera on; the crew keep their place in the corridor and come closer on screen', world.moved > 0.8 && same, world);

  const pass = await ev(() => {
    const H = HUM, api = H.Exp.ask('crew:api');
    window.fresh();
    window.frames(10);
    const ids = api.actors().filter((a) => a.visible).map((a) => a.id);
    const fr = window.frames(12, { survey: 1 });   // surveying as fast as the game allows
    const visible = fr[fr.length - 1].actors.filter((a) => ids.includes(a.id) && a.visible).length;
    const states = fr[fr.length - 1].actors.filter((a) => ids.includes(a.id)).map((a) => a.state);
    // Standing still: they catch up from behind, or come out of a doorway ahead.
    const wait = window.frames(260);
    const firsts = {};
    for (const f of wait) for (const a of f.actors) if (a.visible && !firsts[a.id]) firsts[a.id] = a;
    const backOn = Object.values(firsts);
    return { ids, visible, states, backOn: backOn.map((a) => ({ id: a.id, rel: a.rel, x: a.x, state: a.state, alpha: a.alpha })) };
  });
  c.check('surveying fast walks past them: behind the camera they are no longer drawn', pass.visible === 0 && pass.states.every((s) => s === 'catchup' || s === 'out'), pass);
  c.check('standing still, they come back: from behind the camera or out of a doorway, never appearing mid-corridor',
    pass.backOn.length >= 1 && pass.backOn.every((a) => (a.state === 'catchup' && a.rel < 1.2) || (Math.abs(a.x) > 1.2 && a.alpha < 1)), pass.backOn);

  const motion = await ev(() => {
    const H = HUM;
    window.fresh();
    const hw = H.View.hw;
    const all = [];
    // A long session: bursts of surveying and pauses, about 70 seconds of frames.
    for (let burst = 0; burst < 14; burst++) all.push(...window.frames(burst % 3 === 0 ? 30 : 110, burst % 3 === 0 ? { survey: 3 } : {}));
    let jump = 0, jumpAt = null, dup = 0, maxOn = 0, wall = 0, wallAt = null;
    for (let i = 1; i < all.length; i++) {
      const prev = all[i - 1], cur = all[i];
      const ids = cur.actors.map((a) => a.id);
      if (new Set(ids).size !== ids.length) dup++;
      maxOn = Math.max(maxOn, cur.actors.filter((a) => a.visible).length);
      for (const a of cur.actors) {
        const p = prev.actors.find((x) => x.id === a.id);
        if (a.visible && p && p.visible) {
          const d = Math.max(Math.abs(a.z - p.z) / 0.08, Math.abs(a.x - p.x) / 0.09);   // fastest pace × frame time, with margin
          if (d > 1 && d > jump) { jump = d; jumpAt = { a, p }; }
        }
        if (Math.abs(a.x) > hw - 0.2 && a.state !== 'out') {
          const k = Math.floor(a.z), f = H.View.features(k), side = Math.sign(a.x);
          const kind = side < 0 ? f.left : f.right;
          const sp = (side < 0 ? f.leftSpan : f.rightSpan) || [0.22, 0.78];
          const inDoor = (kind === 'opening' || kind === 'bay' || kind === 'junction') && a.z - k >= sp[0] - 0.02 && a.z - k <= sp[1] + 0.02;
          if (Math.abs(a.x) > hw && !inDoor) { wall++; wallAt = { a, kind, sp }; }
        }
      }
    }
    return { frames: all.length, jump, jumpAt, dup, maxOn, wall, wallAt };
  });
  c.check(`nobody jumps while visible (${motion.frames} frames of surveying and waiting)`, motion.jump === 0, motion);
  c.check('nobody is drawn twice', motion.dup === 0, motion);
  c.check('never more than two on stage', motion.maxOn <= 2 && motion.maxOn >= 1, motion);
  c.check('nobody crosses a wall: past the wall line only inside an open doorway', motion.wall === 0, motion);

  const attend = await ev(() => {
    // Another experiment draws the Watcher's attention to a spot beside them (crew:attend): they walk over within the
    // corridor, look, and go back to work. Never while an entity is in the corridor; a null spot sends them back.
    const H = HUM, api = H.Exp.ask('crew:api'), hw = H.View.hw;
    window.fresh({ watch: 3 });
    let w = null;
    for (let i = 0; i < 400 && !w; i++) { window.frames(1); w = api.actors().find((a) => a.id === 'watch' && a.state === 'working' && a.visible && a.rel > 3); }
    if (!w) return { setup: false };
    const side = w.x < 0 ? 1 : -1;
    const spot = { k: Math.floor(w.z) + 1, side, z: Math.floor(w.z) + 1.5 };
    const yes = H.Exp.ask('crew:attend', 'watch', spot);
    const path = window.frames(300).map((f) => f.actors.find((a) => a.id === 'watch')).filter(Boolean);
    const arrived = path.find((a) => a.check && a.check.arrived);
    const firstBack = path.findIndex((a, i) => i > 0 && path[i - 1].state === 'checking' && a.state !== 'checking');
    const outOfCorridor = path.filter((a) => a.state === 'checking' && Math.abs(a.x) > hw - 0.25 + 0.01).length;
    const working = path.slice(firstBack).some((a) => a.state === 'working');
    // A null spot: back at once. During an entity: refused.
    let w2 = null;
    for (let i = 0; i < 400 && !w2; i++) { window.frames(1); w2 = api.actors().find((a) => a.id === 'watch' && a.state === 'working' && a.visible && a.rel > 3); }
    const again = w2 && H.Exp.ask('crew:attend', 'watch', { k: Math.floor(w2.z) + 1, side: w2.x < 0 ? 1 : -1, z: Math.floor(w2.z) + 1.5 });
    window.frames(5);
    H.Exp.ask('crew:attend', 'watch', null);
    window.frames(1);
    const cancelled = api.actors().find((a) => a.id === 'watch').state !== 'checking';
    H.rt.lastSurveyTime = H.S.time; H.spawnEncounter();
    window.frames(2);
    const during = H.rt.encounter ? H.Exp.ask('crew:attend', 'watch', { k: Math.floor(H.View.camZ) + 4, side: 1, z: Math.floor(H.View.camZ) + 4.5 }) : 'no entity';
    H.endEncounter('test');
    return { setup: true, yes, arrived: arrived && { x: arrived.x, z: arrived.z, want: [side * (hw - 0.55), spot.z] }, firstBack, outOfCorridor, working, again, cancelled, during };
  });
  c.check('drawn to a sound (crew:attend), the Watcher walks over within the corridor, looks, and goes back to work',
    attend.setup && attend.yes === true && attend.arrived && Math.abs(attend.arrived.x - attend.arrived.want[0]) < 0.03 && Math.abs(attend.arrived.z - attend.arrived.want[1]) < 0.03
      && attend.firstBack > 0 && attend.outOfCorridor === 0 && attend.working, attend);
  c.check('a null spot sends them back at once, and nobody is sent while an entity is in the corridor', attend.again === true && attend.cancelled && attend.during === false, attend);

  const rest = await ev(() => {
    const H = HUM, api = H.Exp.ask('crew:api');
    const out = {};
    // Surveys are never held up.
    window.fresh();
    let ok = 0;
    for (let i = 0; i < 20; i++) { H.rt.lastSurveyReal = -1e9; if (H.survey()) ok++; H.View.render(window.T += 40); }
    out.surveys = ok;
    // Reduced motion: still poses, with name labels.
    window.fresh();
    H.S.settings.motion = 'reduce'; H.rt.reducedMotion = true;
    const f = window.frames(10);
    const vis = f[f.length - 1];
    out.reduced = { labels: Object.values(vis.where).map((w) => w.label), still: vis.actors.filter((a) => a.visible).every((a) => f[f.length - 2].actors.some((b) => b.id === a.id && b.z === a.z && b.x === a.x)) };
    H.S.settings.motion = 'auto'; H.rt.reducedMotion = false;
    // A new level, an import or a noclip clears the scene.
    window.fresh();
    window.frames(5);
    const r0 = api.resets();
    H.enterLevel(1);
    window.frames(1);
    out.level = api.resets() === r0 + 1;
    H.replaceState(H.sanitizeState(JSON.parse(JSON.stringify(H.S))));
    out.importCleared = api.actors().length === 0 && api.resets() === r0 + 2;
    // Back from a hidden tab: a representative scene, the crew already at work ahead.
    window.frames(3);
    H.View.camZ += 40; H.View.target += 40;
    H.Exp.runAll('page:visible');
    window.frames(1);
    out.visible = api.actors().filter((a) => a.visible && a.state === 'working' && a.rel > 2 && a.rel < 9).length;
    // An entity in the corridor: the crew keep still against the walls.
    window.fresh();
    window.frames(30);
    H.rt.lastSurveyTime = H.S.time; H.spawnEncounter();
    window.frames(40);
    const e1 = api.actors().filter((a) => a.visible).map((a) => ({ id: a.id, z: a.z, x: a.x }));
    window.frames(40);
    const e2 = api.actors().filter((a) => a.visible).map((a) => ({ id: a.id, z: a.z, x: a.x }));
    out.still = e1.length > 0 && e1.every((a) => { const b = e2.find((x) => x.id === a.id); return b && b.z === a.z && Math.abs(b.x - a.x) < 0.02; });
    H.endEncounter('test');
    // Once it has gone, whoever works is back at their own work site.
    window.frames(150);
    const workers = api.actors().filter((a) => a.state === 'working' && a.site);
    out.backAtSite = workers.length > 0 && workers.every((a) => Math.abs(a.x - a.site.x) < 0.06 && Math.abs(a.z - a.site.z) < 0.06);
    // No page structure changes while frames are drawn.
    let mutations = 0;
    const mo = new MutationObserver((list) => { mutations += list.length; });
    mo.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
    window.frames(60);
    mo.disconnect();
    out.mutations = mutations;
    // Frame cost
    const t0 = performance.now();
    window.frames(120);
    out.ms = (performance.now() - t0) / 120;
    return out;
  });
  c.check('surveys are never held up by the crew', rest.surveys === 20, rest);
  c.check('reduced motion: still poses with name labels', rest.reduced.labels.length > 0 && rest.reduced.labels.every(Boolean) && rest.reduced.still, rest.reduced);
  c.check('a level change and an import clear the scene', rest.level && rest.importCleared, rest);
  c.check('back from a hidden tab, a representative scene: the crew at work ahead', rest.visible >= 1, rest);
  c.check('while an entity is in the corridor the crew keep still; once it has gone they work at their own sites again', rest.still && rest.backAtSite, rest);
  c.check('drawing the crew changes nothing in the page structure', rest.mutations === 0, rest);
  c.check(`a frame with the crew stays cheap (${rest.ms.toFixed(2)} ms including the simulation step)`, rest.ms < 8, rest.ms);

  c.check('no console or page errors so far', g.errors.length === 0, g.errors.slice(0, 5));
  await g.browser.close();

  // The same seeded session, rendered every frame, with the crew on and off: the game must not differ at all.
  const session = (seed) => {
    let a = seed >>> 0;
    Math.random = () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const H = HUM;
    H.UI.floatGain = () => {};
    H.replaceState(H.sanitizeState({ v: 2 }));
    H.rt.saveBlocked = true;
    H.rt.checkAcc = 0; H.rt.autobuyAcc = 0;
    H.S.run.specialists = { scavenge: 6, chart: 4, dowse: 3, watch: 2, archive: 2 };
    H.S.run.salvage = 1e6;
    let T = 5000;
    for (let i = 0; i < 1500; i++) {
      if (i % 4 === 0) { H.rt.lastSurveyReal = -1e9; H.survey(); }
      if (i % 50 === 0) { H.setBuyMode(1); H.buyFacility('cart'); H.hireSpecialist('scavenge'); }
      H.step(0.1, false);
      T += 40; H.View.render(T);
    }
    return JSON.stringify(H.S, (k, v) => (k === 'created' || k === 'lastSaved' ? undefined : v));
  };
  const on = await open('', null, { manualFrames: true });
  const off = await open('?exp=-EXP-CREW-VISIBLE', null, { manualFrames: true });
  const [sOn, sOff] = await Promise.all([on.ev(session, 7), off.ev(session, 7)]);
  c.check('zero effect on the game: the same seeded session rendered with and without the crew ends in the same state', sOn === sOff && sOn.length > 1000, { on: sOn.length, off: sOff.length });
  c.check('no console or page errors with the crew on or off', on.errors.length === 0 && off.errors.length === 0, [...on.errors, ...off.errors].slice(0, 4));
  await on.browser.close();
  await off.browser.close();
  c.finish();
})();
