// Hostile entities: seen ahead, a warning, then danger. Surveying in danger costs a bounded penalty, once.
const { open, Checker } = require('./harness');

(async () => {
  const c = new Checker('Hostile entities in the corridor');
  const g = await open('');
  const { ev, page, reload } = g;

  // A mid-game run with an entity on demand.
  const setup = () => ev(() => {
    const H = HUM;
    H.replaceState(H.sanitizeState({ v: 2 }));
    H.rt.saveBlocked = true;
    const r = H.S.run;
    Object.assign(r, { level: 1, rooms: 500, salvage: 1e6, sanity: 100, attention: 0 });
    r.facilities = { cart: 20, bench: 10 };
    r.specialists = { scavenge: 3, chart: 2 };
    r.upgrades = { gloves: true, bunks: true };
    r.nextEncounterAt = 1e12;
    H.S.seen.firstSurvey = true;
    H.UI.update(true);
  });

  const cfg = await ev(() => ({ ...HUM.CONFIG.encounters }));
  c.check('encounter timings and penalties live in CONFIG', ['firstRooms', 'minGap', 'maxGap', 'attnGap', 'activeWindow', 'warn', 'danger', 'lossShare', 'lossShareAttn', 'lossCapSurveys', 'sanity', 'stun', 'hitGap'].every((k) => typeof cfg[k] === 'number'), cfg);

  // They come regularly while you survey, sooner with attention, never while you stand still.
  const freq = await ev(() => {
    const H = HUM;
    // A seeded random sequence for this measurement, so the comparison does not depend on luck.
    const real = Math.random;
    let a = 12345;
    Math.random = () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const run = (attention, surveying, seconds) => {
      H.replaceState(H.sanitizeState({ v: 2 }));
      H.rt.saveBlocked = true;
      const r = H.S.run;
      Object.assign(r, { rooms: 1000, attention });
      let acc = 0;
      for (let t = 0; t < seconds; t += 0.1) {
        r.attention = attention;
        if (surveying) {
          acc += 0.1;
          if (acc >= 0.5) {
            acc = 0;
            if (!(H.rt.encounter && H.rt.encounter.phase === 'danger')) { H.rt.lastSurveyReal = -1e9; H.survey(); }
          }
        }
        H.step(0.1, false);
      }
      return { n: r.stats.encounters, caught: r.stats.caught, held: r.stats.held };
    };
    const out = { quiet: run(0, true, 900), hunted: run(100, true, 900), still: run(100, false, 900) };
    Math.random = real;
    return out;
  });
  c.check('while surveying, entities come regularly even at zero attention', freq.quiet.n >= 6 && freq.quiet.n <= 20, freq.quiet);
  c.check('attention makes them more frequent', freq.hunted.n > freq.quiet.n * 1.3, freq);
  c.check('standing still, none come', freq.still.n === 0, freq.still);
  // The last one may still be in the corridor when the simulation stops.
  c.check('waiting each one out avoids every penalty', freq.quiet.caught === 0 && freq.quiet.held >= freq.quiet.n - 1, freq.quiet);

  // Phases: a warning in which surveying is still safe, then danger, then it leaves on its own.
  await setup();
  const phases = await ev(() => {
    const H = HUM, r = H.S.run, C = H.CONFIG.encounters;
    H.spawnEncounter();
    const e = { ...H.rt.encounter };
    const s0 = r.salvage, rooms0 = r.rooms;
    H.rt.lastSurveyReal = -1e9;
    const safe = H.survey();
    const warnSurvey = { ok: safe, salvage: r.salvage - s0, rooms: r.rooms - rooms0, phase: H.rt.encounter && H.rt.encounter.phase };
    while (H.rt.encounter && H.rt.encounter.phase === 'warn') H.step(0.05, false);
    const dangerAt = H.S.time - e.at;
    const phase = H.rt.encounter && H.rt.encounter.phase;
    while (H.rt.encounter) H.step(0.05, false);
    return { e, warnSurvey, dangerAt, phase, total: H.S.time - e.at, held: r.stats.held, caught: r.stats.caught, warn: C.warn, danger: C.danger, next: r.nextEncounterAt - H.S.time, minGap: C.minGap };
  });
  c.check('an entity first appears with a warning period', phases.e.phase === 'warn' && Math.abs(phases.e.warn - (phases.warn + 0.25 * 0)) < 1 && phases.e.warn >= phases.warn, phases.e);
  c.check('surveying during the warning is safe and pays as usual', phases.warnSurvey.ok && phases.warnSurvey.salvage > 0 && phases.warnSurvey.rooms > 0 && phases.warnSurvey.phase === 'warn', phases.warnSurvey);
  c.check('then it becomes dangerous after the warning', phases.phase === 'danger' && Math.abs(phases.dangerAt - phases.e.warn) < 0.11, phases);
  c.check('standing still, it leaves on its own and counts as held', Math.abs(phases.total - (phases.e.warn + phases.danger)) < 0.11 && phases.held === 1 && phases.caught === 0, phases);
  c.check('a cooldown follows before the next one', phases.next >= phases.minGap * 0.99, phases);

  // Surveying in danger: checked before any reward, a bounded penalty, once, then a short stun.
  await setup();
  const caught = await ev(() => {
    const H = HUM, r = H.S.run, C = H.CONFIG.encounters;
    H.spawnEncounter();
    while (H.rt.encounter.phase !== 'danger') H.step(0.05, false);
    const before = { salvage: r.salvage, rooms: r.rooms, sanity: r.sanity, surveys: r.stats.surveys, specialists: JSON.stringify(r.specialists), upgrades: JSON.stringify(r.upgrades), facilities: JSON.stringify(r.facilities) };
    const D = H.derive();
    const expectLoss = Math.min(before.salvage * C.lossShare, D.surveyPower * C.lossCapSurveys);
    H.rt.lastSurveyReal = -1e9;
    const ok = H.survey();
    const after1 = { salvage: r.salvage, rooms: r.rooms, sanity: r.sanity, surveys: r.stats.surveys, caught: r.stats.caught, encounter: H.rt.encounter, stun: r.stunUntil - H.S.time };
    // Rapid clicks right after: refused, no second penalty.
    const rapid = [];
    for (let i = 0; i < 10; i++) { H.rt.lastSurveyReal = -1e9; rapid.push(H.survey()); }
    const after2 = { salvage: r.salvage, caught: r.stats.caught };
    H.step(C.stun + 0.1, false);
    H.rt.lastSurveyReal = -1e9;
    const resumed = H.survey();
    const log = H.S.log.find((l) => /^It reached you\./.test(l.text));
    return { ok, before, after1, rapid, after2, resumed, expectLoss, lost: r.stats.salvageLost, log: log && log.text,
      kept: JSON.stringify(r.specialists) === before.specialists && JSON.stringify(r.upgrades) === before.upgrades && JSON.stringify(r.facilities) === before.facilities,
      next: r.nextEncounterAt - H.S.time, minGap: C.minGap, hitGap: C.hitGap, sanityHit: C.sanity };
  });
  c.check('a survey in danger is refused: no salvage, no rooms, no survey counted', caught.ok === false && caught.after1.rooms === caught.before.rooms && caught.after1.surveys === caught.before.surveys, caught);
  c.check('it costs a share of held salvage, capped, and some sanity', Math.abs((caught.before.salvage - caught.after1.salvage) - caught.expectLoss) < 1e-6 && caught.after1.sanity === caught.before.sanity - caught.sanityHit, caught);
  c.check('it is resolved once: the entity is gone and the stun refuses rapid repeats without another penalty', caught.after1.encounter === null && caught.after1.caught === 1 && caught.rapid.every((x) => x === false) && caught.after2.salvage === caught.after1.salvage && caught.after2.caught === 1 && caught.after1.stun > 0, caught);
  c.check('after the stun, surveying works again', caught.resumed === true, caught);
  c.check('the loss is reported clearly', /^It reached you\. You lost [\d.,]+[A-Za-z]* salvage and \d+ sanity\./.test(caught.log || ''), caught.log);
  c.check('no specialist, upgrade or facility is ever taken', caught.kept, caught);
  c.check('the next entity waits longer after one reached you', caught.next >= caught.minGap * caught.hitGap * 0.99, caught);

  const bounds = await ev(() => {
    const H = HUM, r = H.S.run, C = H.CONFIG.encounters;
    const hit = (salvage, attention) => {
      r.attention = attention; r.sanity = 100; r.stunUntil = 0;
      H.spawnEncounter();
      while (H.rt.encounter.phase !== 'danger') H.step(0.05, false);
      r.attention = attention; r.salvage = salvage; r.sanity = 100;
      const power = H.derive().surveyPower;
      H.rt.lastSurveyReal = -1e9;
      H.survey();
      return { loss: salvage - r.salvage, power, sanity: 100 - r.sanity };
    };
    const small = hit(1000, 0), hunted = hit(1000, 100), rich = hit(1e15, 0);
    return { small, hunted, rich, C };
  });
  c.check('the loss is a share of what you hold (10%, 20% when hunted)', Math.abs(bounds.small.loss - 100) < 1e-6 && Math.abs(bounds.hunted.loss - 200) < 1e-6 && bounds.hunted.sanity > bounds.small.sanity, bounds);
  c.check('the loss never exceeds a fixed number of your surveys', Math.abs(bounds.rich.loss - bounds.rich.power * bounds.C.lossCapSurveys) < 1e-3 * bounds.rich.loss, bounds.rich);

  // The keyboard is the same survey.
  await setup();
  await ev(() => { const H = HUM; H.spawnEncounter(); while (H.rt.encounter.phase !== 'danger') H.step(0.05, false); H.UI.update(true); });
  const s0 = await ev(() => HUM.S.run.salvage);
  await page.keyboard.press('s');
  await page.waitForTimeout(60);
  const key = await ev(() => ({ caught: HUM.S.run.stats.caught, salvage: HUM.S.run.salvage, encounter: HUM.rt.encounter }));
  c.check('pressing S in danger is caught exactly like the button', key.caught === 1 && key.salvage < s0 && key.encounter === null, { key, s0 });
  await setup();
  await ev(() => { const H = HUM; H.spawnEncounter(); while (H.rt.encounter.phase !== 'danger') H.step(0.05, false); H.UI.update(true); });
  await page.click('#btnSurvey');
  await page.waitForTimeout(60);
  const btn = await ev(() => ({ caught: HUM.S.run.stats.caught }));
  c.check('clicking Survey in danger is caught', btn.caught === 1, btn);

  // Buying, menus and passive work are not moving.
  await setup();
  const other = await ev(() => {
    const H = HUM, r = H.S.run;
    H.spawnEncounter();
    while (H.rt.encounter.phase !== 'danger') H.step(0.05, false);
    H.setBuyMode(1);
    const bought = H.buyFacility('cart');
    const hired = H.hireSpecialist('scavenge');
    for (const t of ['upgrades', 'crew', 'archive', 'settings', 'facilities']) H.UI.selectTab(t);
    const rooms0 = r.rooms;
    for (let i = 0; i < 10; i++) H.step(0.1, false);   // the Cartographer keeps mapping
    return { bought, hired, caught: r.stats.caught, mapped: r.rooms - rooms0, still: !!H.rt.encounter };
  });
  c.check('buying, recruiting and switching tabs during danger are not surveys', other.bought && other.hired && other.caught === 0, other);
  c.check('the Cartographer’s automatic surveys never trigger it', other.mapped > 0 && other.caught === 0, other);

  // Kill the Lights: it loses interest.
  const dark = await ev(() => {
    const H = HUM, r = H.S.run;
    r.lightsReadyAt = 0; r.lightsUntil = 0;
    if (!H.rt.encounter) H.spawnEncounter();
    const ok = H.killLights();
    return { ok, encounter: H.rt.encounter, caught: r.stats.caught };
  });
  c.check('killing the lights makes it leave without a penalty', dark.ok && dark.encounter === null && dark.caught === 0, dark);

  // Never punished for what you could not see: background tabs, reloads and time away.
  await setup();
  const hidden = await ev(() => {
    const H = HUM, r = H.S.run;
    H.spawnEncounter();
    while (H.rt.encounter.phase !== 'danger') H.step(0.05, false);
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
    const gone = H.rt.encounter;
    // While hidden none appear, however long you surveyed just before.
    r.nextEncounterAt = H.S.time; H.rt.lastSurveyTime = H.S.time;
    for (let i = 0; i < 50; i++) H.step(0.1, false);
    const spawned = !!H.rt.encounter;
    delete document.hidden;
    return { gone, spawned, caught: r.stats.caught };
  });
  c.check('switching to another tab ends the encounter without a penalty, and none appear while hidden', hidden.gone === null && !hidden.spawned && hidden.caught === 0, hidden);
  const away = await ev(() => {
    const H = HUM, r = H.S.run;
    const n0 = r.stats.encounters;
    H.spawnEncounter();
    H.catchUp(3600);
    const after = { encounter: H.rt.encounter, caught: r.stats.caught, n: r.stats.encounters - n0 };
    return { after, next: r.nextEncounterAt - H.S.time };
  });
  c.check('time away clears an entity and never spawns or punishes one', away.after.encounter === null && away.after.caught === 0 && away.after.n === 1 && away.next > 0, away);
  await ev(() => { const H = HUM; H.spawnEncounter(); H.rt.saveBlocked = false; H.save(); H.rt.saveBlocked = true; });
  await reload();
  const reloaded = await ev(() => ({ encounter: HUM.rt.encounter, caught: HUM.S.run.stats.caught, saved: 'encounter' in HUM.S.run }));
  c.check('an entity is never saved: a reload never brings one back', reloaded.encounter === null && reloaded.caught === 0 && !reloaded.saved, reloaded);

  // Seen with every effect reduced: still unmistakable. The system asks for reduced motion too.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await setup();
  await ev(() => {
    const H = HUM, st = H.S.settings;
    Object.assign(st, { distortion: false, flicker: false, shake: false, crt: false, motion: 'auto', muted: true });
    H.replaceState(H.S);   // applies the visual settings, as changing them in Settings does
    H.rt.saveBlocked = true;
    H.spawnEncounter();
    H.UI.update(true);
  });
  await page.waitForTimeout(120);
  const warnUi = await ev(() => ({ alert: !document.getElementById('entityAlert').hidden, text: document.getElementById('entityText').textContent, state: document.getElementById('entityState').textContent,
    label: !document.getElementById('vpEntity').hidden && document.getElementById('vpEntity').textContent, role: document.getElementById('entityAlert').getAttribute('role'),
    drawn: !!HUM.rt.entityRect, reduced: HUM.rt.reducedMotion, anomaly: !document.getElementById('anomalyAlert').hidden }));
  c.check('with reduced motion and effects off, the warning is a visible alert and a viewport label', warnUi.reduced && warnUi.alert && /Stop surveying/.test(warnUi.text) && /^Danger in \d+s$/.test(warnUi.state) && warnUi.label === 'HOSTILE · STOP SURVEYING' && warnUi.role === 'alert', warnUi);
  c.check('the entity is still drawn in the corridor', warnUi.drawn, warnUi);
  c.check('it is not presented as an anomaly', !warnUi.anomaly, warnUi);
  await ev(() => { const H = HUM; while (H.rt.encounter.phase !== 'danger') H.step(0.05, false); H.UI.update(true); });
  const dangerUi = await ev(() => ({ text: document.getElementById('entityText').textContent, state: document.getElementById('entityState').textContent, label: document.getElementById('vpEntity').textContent,
    live: document.getElementById('entityAlert').classList.contains('live') }));
  c.check('in danger the alert and label change to say do not move', /stand still until it leaves/.test(dangerUi.text) && /^Leaves in \d+s$/.test(dangerUi.state) && dangerUi.label === 'HOSTILE · DO NOT MOVE' && dangerUi.live, dangerUi);
  await page.click('#btnSurvey');
  await page.waitForTimeout(80);
  const scare = await ev(() => ({ overlay: !document.getElementById('vpScare').hidden, text: document.getElementById('vpScare').textContent, shake: document.getElementById('viewport').classList.contains('shake'), caught: HUM.S.run.stats.caught }));
  c.check('being caught with reduced effects shows a still overlay, without shaking', scare.caught === 1 && scare.overlay && /It reached you/.test(scare.text) && !scare.shake, scare);

  c.finish(g.errors);
  await g.browser.close();
})();
