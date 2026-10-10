// EXP-MISSION-AUTOREPEAT: the Dispatch Protocol. Per-mission Auto-repeat switches, off by default, unlocked by a
// salvage requisition in the Missions tab. A mission with Auto-repeat on is sent again at its return, paid and worked
// out like any dispatch; when it cannot go it waits, says why, and queues oldest first. Pause all. Time away handles
// every return at its own moment. Switched off, nothing goes out by itself and nothing is lost.
const { open, Checker } = require('./harness');

const setup = () => {
  const H = HUM;
  H.replaceState(H.sanitizeState({ v: 2 }));
  H.rt.saveBlocked = true;
  H.enterLevel(2);
  H.S.run.flags.expedition = true;
  H.S.run.salvage = 1e9;
  H.S.run.aw = 50;
  H.S.run.specialists = { chart: 1, scavenge: 5 };
  return H;
};

(async () => {
  const c = new Checker('EXP-MISSION-AUTOREPEAT: Dispatch Protocol');
  const g = await open('');
  const { ev } = g;

  const unlock = await ev((setupSrc) => {
    const H = HUM;
    H.replaceState(H.sanitizeState({ v: 2 }));
    H.rt.saveBlocked = true;
    const u = H.UPG.dispatch;
    const out = { before: H.upgradeAvailable(u) };
    H.enterLevel(2);
    out.noMission = H.upgradeAvailable(u);
    H.S.run.flags.expedition = true;
    out.after = H.upgradeAvailable(u);
    out.home = H.upgradeHome(u); out.cur = H.upgradeCurrency(u); out.cid = u.cid; out.cat = u.cat;
    // Choices made earlier do nothing until it is installed.
    H.S.ext.dispatch = { auto: { stairwell: true } };
    H.S.run.specialists = { chart: 1 }; H.S.run.aw = 50;
    for (let i = 0; i < 40; i++) H.step(0.1, false);
    out.dormant = !H.S.run.missions.stairwell;
    // The Upgrades tab points to it; the Missions tab offers it.
    H.S.run.rooms = 500; H.S.seen.tab_upgrades = true; H.S.seen.tab_expeditions = true;
    H.S.run.salvage = 1e7;
    H.UI.update(true); H.UI.selectTab('upgrades'); H.UI.update(true);
    const ptr = document.querySelector('#panel-upgrades .home-pointer');
    out.pointer = ptr ? ptr.textContent : null;
    if (ptr) ptr.querySelector('button').click();
    out.tabAfterClick = H.rt.tab;
    H.UI.update(true);
    out.offer = !!document.querySelector('#panel-expeditions .dispatch-offer [data-id="dispatch"]');
    out.togglesBefore = document.querySelectorAll('#panel-expeditions .auto-toggle').length;
    document.querySelector('#panel-expeditions .dispatch-offer [data-id="dispatch"]').click();
    H.UI.update(true);
    out.installed = H.S.run.upgrades.dispatch === true;
    out.toggles = [...document.querySelectorAll('#panel-expeditions .exp .auto-toggle')].map((b) => [b.textContent, b.getAttribute('aria-pressed')]);
    out.bar = (document.querySelector('#panel-expeditions .dispatch-bar') || {}).textContent;
    return out;
  });
  c.check('it opens on Level 2 once a mission has been sent', unlock.before === false && unlock.noMission === false && unlock.after === true, unlock);
  c.check('a salvage requisition listed in the Missions tab, with its own content id', unlock.home === 'expeditions' && unlock.cur === 'salvage' && unlock.cid === 'upgrade:dispatch' && unlock.cat === 'Automation', unlock);
  c.check('choices saved before it is installed do nothing', unlock.dormant, unlock);
  c.check('the Upgrades tab points to it, and its button opens the Missions tab', /Dispatch Protocol, in the Missions tab/.test(unlock.pointer || '') && unlock.tabAfterClick === 'expeditions', unlock);
  c.check('the Missions tab offers it; no switches before it is installed', unlock.offer && unlock.togglesBefore === 0, unlock);
  c.check('installed: every mission card gets a switch, showing the choice already made (others off)',
    unlock.installed && unlock.toggles.length >= 2 && unlock.toggles[0][0] === 'Auto-repeat: ON' && unlock.toggles.slice(1).every(([t, p]) => t === 'Auto-repeat: OFF' && p === 'false') && /Pause all/.test(unlock.bar || ''), unlock);

  const repeat = await ev(`(${setup})() && (() => {
    const H = HUM, api = H.Exp.ask('dispatch:api');
    H.buyUpgrade('dispatch');
    const pays = [];
    const pay = H.Wallet.pay;
    H.Wallet.pay = function (cur, amount) { pays.push([cur, amount]); return pay.call(this, cur, amount); };
    api.toggle('stairwell');
    for (let i = 0; i < 21; i++) H.step(0.1, false);
    const first = { ...H.S.run.missions.stairwell };
    const sps = H.derive().sps;
    // A faster mission next time: Hand-Drawn Maps take effect on the next dispatch, not this one.
    H.S.run.aw += 60; H.buyUpgrade('maps');
    const spsDuring = H.derive().sps;
    while (H.S.run.stats.expeditions < 1) H.step(0.1, false);
    const second = { ...H.S.run.missions.stairwell };
    H.Wallet.pay = pay;
    return { first, second, dur1: first.end - first.start, dur2: second.end - second.start, gap: second.start - first.end, paid: pays.filter(([cur]) => cur === 'aw').map(([, n]) => n),
      sps, spsDuring, one: Object.keys(H.S.run.missions).length, exp: H.S.run.stats.expeditions,
      logs: H.S.log.filter((e) => /sets out/.test(e.text)).length };
  })()`);
  c.check('switched on, the mission goes out by itself', repeat.first && repeat.first.end > repeat.first.start, repeat);
  c.check('it is sent again exactly at its return time', Math.abs(repeat.gap) < 1e-6, repeat);
  c.check('each dispatch is worked out again: Hand-Drawn Maps shorten the next trip by 20%', Math.abs(repeat.dur2 / repeat.dur1 - 0.8) < 1e-9, repeat);
  c.check('supplies are paid for each trip (3 water, twice, and 60 for the maps)', repeat.paid.join() === '3,60,3', repeat);
  c.check('one team per mission, and the specialists keep working', repeat.one === 1 && repeat.spsDuring === repeat.sps && repeat.sps > 0, repeat);
  c.check('trips sent by Auto-repeat do not add "sets out" lines to the log', repeat.logs === 0, repeat);

  const wait = await ev(`(${setup})() && (() => {
    const H = HUM, api = H.Exp.ask('dispatch:api');
    H.buyUpgrade('dispatch');
    H.S.run.aw = 0;
    api.toggle('stairwell');
    for (let i = 0; i < 50; i++) H.step(0.1, false);
    const lines = () => H.S.log.filter((e) => e.tag === 'DISPATCH' || e.tag === 'MISSION').length;
    const out = { status: api.statusText('stairwell'), out: !!H.S.run.missions.stairwell, logLen: lines() };
    for (let i = 0; i < 300; i++) H.step(0.1, false);
    out.logGrowth = lines() - out.logLen;
    out.stillWaiting = !H.S.run.missions.stairwell;
    H.S.run.aw = 3;
    for (let i = 0; i < 21; i++) H.step(0.1, false);
    out.went = !!H.S.run.missions.stairwell;
    out.awAfter = H.S.run.aw;
    // A requirement it does not meet: no Cartographer
    delete H.S.run.specialists.chart;
    while (H.S.run.missions.stairwell) H.step(0.5, false);
    for (let i = 0; i < 30; i++) H.step(0.1, false);
    out.req = api.statusText('stairwell');
    return out;
  })()`);
  c.check('without its almond water it waits and says so', !wait.out && wait.status === 'Waiting for 3 almond water.', wait);
  c.check('waiting retries quietly: no log lines while it waits', wait.logGrowth === 0 && wait.stillWaiting, wait);
  c.check('it goes as soon as the water is there, and pays for it', wait.went && wait.awAfter === 0, wait);
  c.check('a missing requirement is named', wait.req === 'Waiting for the Cartographer at level 1.', wait);

  const queue = await ev(`(${setup})() && (() => {
    const H = HUM, api = H.Exp.ask('dispatch:api');
    H.buyUpgrade('dispatch');
    H.S.run.specialists = { chart: 1, dowse: 2, scavenge: 5 };
    H.S.run.aw = 0;
    api.toggle('flooded');        // 12 water, waiting first
    for (let i = 0; i < 30; i++) H.step(0.1, false);
    api.toggle('stairwell');      // 3 water, waiting second
    for (let i = 0; i < 30; i++) H.step(0.1, false);
    const order = api.queue();
    H.S.run.aw = 5;               // enough for the Stairwell, not for the Flooded Annex
    for (let i = 0; i < 25; i++) H.step(0.1, false);
    const held = { stairwell: !!H.S.run.missions.stairwell, flooded: !!H.S.run.missions.flooded, status: api.statusText('stairwell') };
    H.S.run.aw = 15;              // the oldest goes first, then the next when it can
    for (let i = 0; i < 25; i++) H.step(0.1, false);
    const after = { flooded: !!H.S.run.missions.flooded, stairwell: !!H.S.run.missions.stairwell, aw: H.S.run.aw };
    return { order, held, after };
  })()`);
  c.check('waiting missions queue oldest first', queue.order.join() === 'flooded,stairwell', queue);
  c.check('a younger mission waits behind an older one waiting for water, and says so', !queue.held.stairwell && !queue.held.flooded && /^Waiting behind Flooded Annex/.test(queue.held.status), queue);
  c.check('the oldest gets the water first, then the next goes', queue.after.flooded && queue.after.stairwell && queue.after.aw < 2, queue);

  const tie = await ev(`(${setup})() && (() => {
    const H = HUM, api = H.Exp.ask('dispatch:api');
    H.buyUpgrade('dispatch');
    H.S.run.specialists = { chart: 1, dowse: 2, scavenge: 5 };
    H.S.run.aw = 0;
    H.S.ext.dispatch = { auto: { flooded: true, stairwell: true } };   // switched on at the same moment
    for (let i = 0; i < 30; i++) H.step(0.1, false);
    return api.queue();
  })()`);
  c.check('missions waiting since the same moment go in the missions list order', tie.join() === 'stairwell,flooded', tie);

  const pause = await ev(`(${setup})() && (() => {
    const H = HUM, api = H.Exp.ask('dispatch:api');
    H.buyUpgrade('dispatch');
    api.toggle('stairwell');
    for (let i = 0; i < 21; i++) H.step(0.1, false);
    api.setPaused(true);
    const exp0 = H.S.run.stats.expeditions;
    while (H.S.run.missions.stairwell) H.step(0.5, false);
    for (let i = 0; i < 50; i++) H.step(0.1, false);
    const out = { finished: H.S.run.stats.expeditions === exp0 + 1, notSent: !H.S.run.missions.stairwell, status: api.statusText('stairwell'), kept: H.S.ext.dispatch.auto.stairwell === true };
    api.setPaused(false);
    for (let i = 0; i < 21; i++) H.step(0.1, false);
    out.resumed = !!H.S.run.missions.stairwell;
    // Switching one off never recalls a team already out; it finishes once and is not sent again.
    api.toggle('stairwell');
    const exp1 = H.S.run.stats.expeditions;
    while (H.S.run.missions.stairwell) H.step(0.5, false);
    for (let i = 0; i < 50; i++) H.step(0.1, false);
    out.offFinished = H.S.run.stats.expeditions === exp1 + 1 && !H.S.run.missions.stairwell;
    return out;
  })()`);
  c.check('Pause all: a trip out finishes, nothing new goes out, choices are kept', pause.finished && pause.notSent && pause.status === 'Auto-repeat is paused.' && pause.kept, pause);
  c.check('resuming sends it again', pause.resumed, pause);
  c.check('switching a mission off lets the team out finish once, and it is not sent again', pause.offFinished, pause);

  const away = await ev(`(${setup})() && (() => {
    const H = HUM, api = H.Exp.ask('dispatch:api');
    H.buyUpgrade('dispatch');
    H.S.run.aw = 10000;
    api.toggle('stairwell');
    for (let i = 0; i < 21; i++) H.step(0.1, false);
    const m = H.S.run.missions.stairwell, dur = m.end - m.start, start0 = m.start;
    const exp0 = H.S.run.stats.expeditions;
    const starts = [];
    H.Exp.hook('mission:done', 'EXP-MISSION-AUTOREPEAT', () => { if (H.S.run.missions.stairwell) starts.push(H.S.run.missions.stairwell.start); }, 10);
    H.catchUp(dur * 12.5);
    H.Exp.hooks['mission:done'] = H.Exp.hooks['mission:done'].filter((h) => h.priority !== 10);
    const n = H.S.run.stats.expeditions - exp0;
    const exact = starts.every((s, i) => Math.abs(s - (start0 + dur * (i + 1))) < 1e-6);
    const counted = starts.length;
    // Beyond the offline limit nothing more happens.
    const cap = H.catchUp(1e9);
    return { n, exact, starts: counted, dur, cap: cap.applied, capLimit: cap.cap };
  })()`);
  c.check('time away: every return in a long stretch is handled, none collapsed (12 returns in 12.5 trips)', away.n === 12, away);
  c.check('time away: each trip starts exactly when the last one returned', away.exact && away.starts === 12, away);
  c.check('time away: never beyond the offline limit', away.cap === away.capLimit, away);

  const reload = await ev(`(${setup})() && (() => {
    const H = HUM, api = H.Exp.ask('dispatch:api');
    H.buyUpgrade('dispatch');
    api.toggle('stairwell');
    for (let i = 0; i < 21; i++) H.step(0.1, false);
    const st = JSON.parse(JSON.stringify(H.S));
    const m = st.run.missions.stairwell;
    st.time = m.end + 0.5; st.lastSaved = Date.now();
    H.replaceState(H.sanitizeState(st));
    const exp0 = H.S.run.stats.expeditions;
    H.step(0.1, false); H.step(0.1, false);
    return { once: H.S.run.stats.expeditions === exp0 + 1, again: !!H.S.run.missions.stairwell, prefs: H.S.ext.dispatch };
  })()`);
  c.check('after a reload a due mission returns once and goes out again; choices are saved', reload.once && reload.again && reload.prefs.auto.stairwell === true, reload);

  const off = await ev(`(${setup})() && (() => {
    const H = HUM, E = H.Exp, api = E.ask('dispatch:api');
    H.buyUpgrade('dispatch');
    api.toggle('stairwell');
    for (let i = 0; i < 21; i++) H.step(0.1, false);
    const aw0 = H.S.run.aw;
    E.set('EXP-MISSION-AUTOREPEAT', false);
    const exp0 = H.S.run.stats.expeditions;
    const tripKept = !!H.S.run.missions.stairwell;
    while (H.S.run.missions.stairwell) H.step(0.5, false);
    for (let i = 0; i < 50; i++) H.step(0.1, false);
    H.S.seen.tab_expeditions = true; H.UI.update(true); H.UI.selectTab('expeditions'); H.UI.update(true);
    const out = { tripKept, finishedOnce: H.S.run.stats.expeditions === exp0 + 1, notSent: !H.S.run.missions.stairwell, aw: H.S.run.aw - aw0,
      kept: H.S.ext.dispatch.auto.stairwell === true && H.S.run.upgrades.dispatch === true,
      toggles: document.querySelectorAll('#panel-expeditions .auto-toggle').length, available: H.upgradeAvailable(H.UPG.dispatch) };
    E.set('EXP-MISSION-AUTOREPEAT', true);
    for (let i = 0; i < 21; i++) H.step(0.1, false);
    out.backSent = !!H.S.run.missions.stairwell;
    E.setItem('upgrade:dispatch', false);
    const exp1 = H.S.run.stats.expeditions;
    while (H.S.run.missions.stairwell) H.step(0.5, false);
    for (let i = 0; i < 50; i++) H.step(0.1, false);
    out.itemOff = H.S.run.stats.expeditions === exp1 + 1 && !H.S.run.missions.stairwell;
    E.reset();
    // Kept through a noclip; nothing goes out until it is installed again.
    H.completeFiniteSurvey && (H.enterLevel(5), H.completeFiniteSurvey(0));
    H.S.run.stats.salvage = 1e13; H.noclip();
    H.S.run.specialists = { chart: 1 }; H.S.run.aw = 50;
    for (let i = 0; i < 40; i++) H.step(0.1, false);
    out.afterNoclip = { prefs: H.S.ext.dispatch.auto.stairwell === true, owned: !!H.S.run.upgrades.dispatch, out: !!H.S.run.missions.stairwell };
    return out;
  })()`);
  c.check('switched off: the paid trip is not cancelled; it finishes once and is not sent again', off.tripKept && off.finishedOnce && off.notSent, off);
  c.check('switched off: the requisition and the choices are kept, nothing is listed', off.kept && off.toggles === 0 && off.available === false, off);
  c.check('switched back on: Auto-repeat resumes', off.backSent, off);
  c.check('the content switch upgrade:dispatch does the same on its own', off.itemOff, off);
  c.check('choices are kept through a noclip and do nothing until it is installed again', off.afterNoclip.prefs && !off.afterNoclip.owned && !off.afterNoclip.out, off.afterNoclip);

  c.check('no console or page errors so far', g.errors.length === 0, g.errors.slice(0, 5));
  await g.browser.close();

  // Independent of the other update-2.1 experiments: the same repeat with all of them off.
  const g2 = await open('?exp=-EXP-AUTO-UPGRADE,-EXP-CREW-VISIBLE,-EXP-ROOM-VARIETY,-EXP-PRODUCTION-FEEDBACK,-EXP-AMBIENT-EVENTS,-EXP-CREW-EQUIPMENT,-EXP-LATE-FACILITIES,-EXP-LATE-UPGRADES,-EXP-LATE-RESEARCH,-EXP-LATE-BALANCE');
  const alone = await g2.ev(`(${setup})() && (() => {
    const H = HUM, api = H.Exp.ask('dispatch:api');
    H.buyUpgrade('dispatch');
    api.toggle('stairwell');
    for (let i = 0; i < 21; i++) H.step(0.1, false);
    const first = { ...H.S.run.missions.stairwell };
    while (H.S.run.stats.expeditions < 1) H.step(0.1, false);
    return { gap: H.S.run.missions.stairwell.start - first.end };
  })()`);
  c.check('with every other update-2.1 experiment off, Auto-repeat works on its own', Math.abs(alone.gap) < 1e-6, alone);
  c.finish(g2.errors);
  await g2.browser.close();
})();
