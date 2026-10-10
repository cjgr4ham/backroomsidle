// EXP-PRODUCTION-FEEDBACK: sparse captions summing up what each specialist has already produced. The sums must match
// what the simulation credited, the captions must never grant anything, stay sparse, take turns, keep out of the way
// of entities, and work with the visible crew on (over their heads) or off (at the foot of the camera feed).
const { open, Checker } = require('./harness');

const drive = () => {
  window.T = window.T || 1000;
  window.run = (seconds) => {
    const H = HUM;
    for (let i = 0; i < seconds * 10; i++) { H.step(0.1, false); if (i % 3 === 0) { window.T += 40; H.View.render(window.T); } }
  };
};

(async () => {
  const c = new Checker('EXP-PRODUCTION-FEEDBACK: production feedback');
  const g = await open('', null, { manualFrames: true });
  const { ev } = g;
  await ev(drive);

  const sums = await ev(() => {
    const H = HUM, api = H.Exp.ask('feedback:api');
    H.replaceState(H.sanitizeState({ v: 2 }));
    H.rt.saveBlocked = true;
    H.S.run.specialists = { scavenge: 6 };
    const credited0 = H.S.run.stats.salvage;
    const sal0 = H.S.run.salvage;
    // Watch what the captions say over a minute, and what the game credited meanwhile.
    const captions = [];
    let last = null;
    for (let i = 0; i < 600; i++) {
      H.step(0.1, false);
      const s = api.shown();
      if (s && (!last || s.text !== last.text || s.age < last.age)) captions.push({ t: i / 10, text: s.text });
      last = s;
    }
    const credited = H.S.run.stats.salvage - credited0;
    const pending = api.sums().scavenge || 0;
    const parse = (t) => { const m = /\+([\d.]+)([KMB]?) salvage/.exec(t); const mult = { '': 1, K: 1e3, M: 1e6, B: 1e9 }[m[2]]; return Number(m[1]) * mult; };
    const total = captions.reduce((n, x) => n + parse(x.text), 0);
    return { captions, credited, pending, total, salvage: H.S.run.salvage - sal0, gaps: captions.slice(1).map((x, i) => x.t - captions[i].t) };
  });
  c.check('a caption sums up the Scavenger’s salvage: "Scavenger recovered +N salvage"', sums.captions.length >= 3 && sums.captions.every((x) => /^Scavenger recovered \+[\d.]+[KMB]? salvage$/.test(x.text)), sums.captions);
  c.check('the sums match what the game credited (captions + what is still to be summed up)', Math.abs((sums.total + sums.pending) - sums.credited) / sums.credited < 0.03, sums);
  c.check('captions stay sparse: 8 to 14 seconds apart', sums.gaps.every((d) => d >= 7.9 && d <= 14.2), sums.gaps);

  const grants = await ev(() => {
    // The same minute with the feedback switched off: the very same salvage.
    const H = HUM, E = H.Exp;
    const once = () => {
      H.replaceState(H.sanitizeState({ v: 2 }));
      H.rt.saveBlocked = true;
      H.S.run.specialists = { scavenge: 6, chart: 3, dowse: 3, archive: 2 };
      for (let i = 0; i < 600; i++) H.step(0.1, false);
      return JSON.stringify([H.S.run.salvage, H.S.run.aw, H.S.echoes, H.S.run.rooms, H.S.run.stats]);
    };
    const on = once();
    E.set('EXP-PRODUCTION-FEEDBACK', false);
    const off = once();
    E.set('EXP-PRODUCTION-FEEDBACK', true);
    return on === off;
  });
  c.check('it never grants anything: the same minute gives the same totals with it on and off', grants, grants);

  const turns = await ev(() => {
    const H = HUM, api = H.Exp.ask('feedback:api');
    H.replaceState(H.sanitizeState({ v: 2 }));
    H.rt.saveBlocked = true;
    H.S.run.specialists = { scavenge: 6, chart: 3, dowse: 3, archive: 2 };
    const seen = [];
    let lastText = '';
    for (let i = 0; i < 900; i++) { H.step(0.1, false); const s = api.shown(); if (s && s.text !== lastText) { seen.push(s.text.split(' ')[0]); lastText = s.text; } }
    // During an entity, no caption.
    H.rt.lastSurveyTime = H.S.time; H.spawnEncounter();
    const before = api.shown() && api.shown().text;
    for (let i = 0; i < 150; i++) H.step(0.1, false);
    const during = api.shown() && api.shown().text;
    const encounterLive = !!H.rt.encounter;
    return { seen, quiet: before === during || !encounterLive };
  });
  c.check('specialists take turns: each producing specialist gets a caption', ['Scavenger', 'Cartographer', 'Dowser', 'Archivist'].every((n) => turns.seen.includes(n)), turns.seen);
  c.check('no new caption while an entity is in the corridor', turns.quiet, turns);

  const where = await ev(() => {
    const H = HUM, api = H.Exp.ask('feedback:api');
    H.replaceState(H.sanitizeState({ v: 2 }));
    H.rt.saveBlocked = true;
    H.S.run.specialists = { scavenge: 6 };
    window.run(20);
    const crewShown = H.Exp.ask('crew:where', 'scavenge');
    return { dom: api.dom(), crew: !!crewShown, shown: api.shown() };
  });
  c.check('with the crew visible and the Scavenger on stage, the caption is drawn over them, not in the page', where.crew && where.shown && where.dom && where.dom.on === false, where);
  c.check('no console or page errors so far', g.errors.length === 0, g.errors.slice(0, 5));
  await g.browser.close();

  const g2 = await open('?exp=-EXP-CREW-VISIBLE', null, { manualFrames: true });
  await g2.ev(drive);
  const foot = await g2.ev(() => {
    const H = HUM, api = H.Exp.ask('feedback:api');
    H.replaceState(H.sanitizeState({ v: 2 }));
    H.rt.saveBlocked = true;
    H.S.run.specialists = { scavenge: 6 };
    let seen = null;
    for (let i = 0; i < 160 && !seen; i++) { H.step(0.1, false); const d = api.dom(); if (d && d.on) seen = d.text; }
    const el = document.querySelector('#viewport .vp-feed');
    return { seen, aria: el && el.getAttribute('aria-hidden') };
  });
  c.check('with the visible crew off, the caption shows at the foot of the camera feed, hidden from screen readers', /^Scavenger recovered \+/.test(foot.seen || '') && foot.aria === 'true', foot);
  c.finish([...g2.errors]);
  await g2.browser.close();
})();
