// EXP-ATTENTION-BALANCE: footstep noise from surveys by hand, and meters that explain themselves.
const { open, Checker } = require('./harness');

const ID = 'EXP-ATTENTION-BALANCE';
(async () => {
  const c = new Checker(`${ID}: footsteps and readable Attention`);
  const g = await open(`?exp=none,${ID}`);
  const { ev, page } = g;

  // Controlled conditions: no machines, so all noise is footsteps.
  const feet = await ev(() => {
    const H = HUM; H.rt.saveBlocked = true;
    H.replaceState(H.sanitizeState({ v: 2 }));
    const survey = () => { H.rt.lastSurveyReal = -1e9; H.survey(); };
    const n0 = H.derive().noise;
    survey();
    const n1 = H.derive().noise;
    for (let i = 0; i < 4; i++) survey();
    const n5 = H.derive().noise;
    for (let i = 0; i < 100; i++) H.step(0.1, false);   // 10 seconds
    const n5later = H.derive().noise;
    const D = H.derive();
    return { n0, n1, n5, n5later, target: D.attnTarget, absorb: D.absorb, noise: D.noise };
  });
  c.check('a new game is silent until you survey', feet.n0 === 0, feet);
  c.check('each survey by hand adds 0.004 noise', Math.abs(feet.n1 - 0.004) < 1e-12 && Math.abs(feet.n5 - 0.02) < 1e-12, feet);
  c.check('footstep noise halves every 10 seconds', Math.abs(feet.n5later - 0.01) < 1e-9, feet);
  c.check('the settling point is still 100 × noise ÷ (noise + absorption)', Math.abs(feet.target - 100 * feet.noise / (feet.noise + feet.absorb)) < 1e-9, feet);

  const mods = await ev(() => {
    const H = HUM;
    const after = (setup) => {
      H.replaceState(H.sanitizeState({ v: 2 })); setup();
      for (let i = 0; i < 10; i++) { H.rt.lastSurveyReal = -1e9; H.survey(); }
      const D = H.derive();
      return { noise: D.noise, steps: D.noiseSteps, absorb: D.absorb, target: D.attnTarget };
    };
    const plain = after(() => {});
    const remembers = after(() => { H.S.memories.remembers = 1; });
    const quiet = after(() => { H.S.run.doctrine = 'doc_quiet'; });
    const glue = after(() => { H.S.run.upgrades.foamglue = true; H.S.run.facilities.dampener = 4; H.S.run.level = 1; });
    const dark = after(() => { H.S.run.lightsUntil = H.S.time + 15; });
    H.S.memories = {};
    return { plain, remembers, quiet, glue, dark };
  });
  c.check('It Remembers You quietens footsteps by 20%', Math.abs(mods.remembers.steps - 0.8 * mods.plain.steps) < 1e-12, mods);
  c.check('the Quiet Doctrine quietens footsteps too', Math.abs(mods.quiet.steps - 0.55 * mods.plain.steps) < 1e-12, mods);
  c.check('dampeners and Foam Glue raise absorption, not noise, and lower the settling point', Math.abs(mods.glue.noise - mods.plain.noise) < 1e-12 && mods.glue.absorb > mods.plain.absorb && mods.glue.target < mods.plain.target, mods);
  c.check('there is no noise while the lights are out', mods.dark.noise === 0 && mods.dark.target === 0, mods.dark);

  const reach = await ev(() => {
    const H = HUM;
    H.replaceState(H.sanitizeState({ v: 2 }));
    const run = (secs, rate) => { let acc = 0; for (let t = 0; t < secs; t += 0.1) { acc += rate * 0.1; while (acc >= 1) { acc -= 1; H.rt.lastSurveyReal = -1e9; H.survey(); } H.step(0.1, false); } return H.S.run.attention; };
    const normal = run(120, 3);
    const peak = H.S.run.attention;
    const faded = run(120, 0);
    H.replaceState(H.sanitizeState({ v: 2 }));
    const spam = run(150, 16);
    H.replaceState(H.sanitizeState({ v: 2 }));
    H.S.run.level = 2; Object.assign(H.S.run.facilities, { cart: 60, bench: 60, vat: 40, foundry: 40, boiler: 30 });
    const hunted = run(240, 3);
    return { normal, peak, faded, spam, hunted };
  });
  c.check('two minutes of surveying at 3/s moves the meter visibly but stays Quiet', reach.normal > 8 && reach.normal < 25, reach);
  c.check('stopping lets it fade back down', reach.faded < reach.peak / 3, reach);
  c.check('surveying at the rate limit reaches Uneasy', reach.spam >= 25 && reach.spam < 75, reach);
  c.check('a loud operation still reaches Hunted, where incidents begin', reach.hunted >= 75, reach);

  const offline = await ev(() => {
    const H = HUM;
    const runWith = (on) => {
      H.Exp.session['EXP-ATTENTION-BALANCE'] = on;
      H.replaceState(H.sanitizeState({ v: 2 }));
      Object.assign(H.S.run.facilities, { cart: 30, bench: 20, condenser: 5 });
      for (let i = 0; i < 300; i++) { if (i % 3 === 0) { H.rt.lastSurveyReal = -1e9; H.survey(); } H.step(0.1, false); }
      H.catchUp(3 * 3600);
      return { attention: H.S.run.attention, target: H.derive().attnTarget };
    };
    const on = runWith(true), off = runWith(false);
    H.Exp.session['EXP-ATTENTION-BALANCE'] = true;
    return { on, off };
  });
  c.check('offline, footsteps fade and attention settles where the original rules put it', Math.abs(offline.on.attention - offline.off.attention) < 1e-6 && Math.abs(offline.on.target - offline.off.target) < 1e-9, offline);

  // The interface.
  await ev(() => { const H = HUM; H.replaceState(H.sanitizeState({ v: 2 })); H.UI.update(true); });
  const quietNote = await ev(() => document.getElementById('attnNote').textContent);
  c.check('the attention meter says what it is, and what makes noise', /^How closely it listens\. No noise yet\. Your footsteps make a little; facilities make more\./.test(quietNote), quietNote);
  for (let i = 0; i < 20; i++) { await ev(() => { HUM.rt.lastSurveyReal = -1e9; }); await page.click('#btnSurvey'); }
  await ev(() => { HUM.S.run.facilities.cart = 20; HUM.UI.update(); });
  const busy = await ev(() => ({ note: document.getElementById('attnNote').textContent, sanity: document.getElementById('sanityNote').textContent }));
  c.check('after surveying, the note splits noise into facilities and footsteps', /Noise [\d.]+ \(facilities [\d.]+, footsteps [\d.]+\) vs absorption 1\.00: heading to \d+\./.test(busy.note), busy.note);
  c.check('the sanity meter says it is your nerve', /^Your nerve\. \+?[\d.]+\/s\./.test(busy.sanity), busy.sanity);
  const manual = await ev(() => { HUM.rt.archiveTab = 'manual'; HUM.UI.selectTab('archive'); return document.getElementById('panel-archive').textContent; });
  c.check('the field manual explains how attention and sanity differ', /Attention is outside you/.test(manual) && /Sanity is inside you/.test(manual), manual.length);

  const off = await ev(() => {
    const H = HUM;
    H.Exp.set('EXP-ATTENTION-BALANCE', false);
    H.replaceState(H.sanitizeState({ v: 2 }));
    for (let i = 0; i < 10; i++) { H.rt.lastSurveyReal = -1e9; H.survey(); }
    H.UI.selectTab('facilities'); H.UI.update(true);
    const res = { noise: H.derive().noise, note: document.getElementById('attnNote').textContent, sanity: document.getElementById('sanityNote').textContent };
    H.Exp.reset();
    return res;
  });
  c.check('switched off, surveys are silent again and the notes are the original ones', off.noise === 0 && off.note === 'No noise yet.' && !/^Your nerve/.test(off.sanity), off);

  c.finish(g.errors);
  await g.browser.close();
})();
