// EXP-LATE-UPGRADES: eight one-off salvage requisitions for Levels 4 and 5. Their effects are data (`fx`), so they
// apply through derive() and the mission functions, and vanish at once when switched off, keeping ownership.
const { open, Checker } = require('./harness');

(async () => {
  const c = new Checker('EXP-LATE-UPGRADES: late requisitions');
  const g = await open('');
  const { ev } = g;

  const avail = await ev(() => {
    const H = HUM;
    H.replaceState(H.sanitizeState({ v: 2 }));
    H.rt.saveBlocked = true;
    const ids = ['stapler', 'lamp', 'coffee', 'holdmusic', 'speeddial', 'wedges', 'masterkey', 'runner'];
    const at = (lv) => { H.enterLevel(lv); return ids.filter((id) => H.upgradeAvailable(H.UPG[id])); };
    const out = { l3: at(3) };
    out.l4 = at(4);
    H.S.run.specialists = { scavenge: 1, chart: 1, dowse: 1 };
    H.S.run.flags.expedition = true;
    out.l4b = ids.filter((id) => H.upgradeAvailable(H.UPG[id]));
    out.l5 = at(5);
    out.homes = Object.fromEntries(ids.map((id) => [id, H.upgradeHome(H.UPG[id])]));
    out.salvage = ids.every((id) => H.upgradeCurrency(H.UPG[id]) === 'salvage');
    out.cids = ids.map((id) => H.UPG[id].cid).join();
    return out;
  });
  c.check('none is available before Level 4', avail.l3.length === 0, avail);
  c.check('Level 4 opens the Stapler, the Lamp and Hold Music; Coffee needs three specialists and Speed Dial a mission sent',
    avail.l4.join() === 'stapler,lamp,holdmusic' && avail.l4b.join() === 'stapler,lamp,coffee,holdmusic,speeddial', avail);
  c.check('Level 5 opens Door Wedges, the Master Key and the Hallway Runner (with the Cartographer)', ['wedges', 'masterkey', 'runner'].every((id) => avail.l5.includes(id)), avail);
  c.check('crew requisitions are listed in the Crew tab, the rest in Upgrades; all cost salvage',
    avail.homes.coffee === 'crew' && avail.homes.runner === 'crew' && avail.homes.lamp === 'upgrades' && avail.homes.speeddial === 'upgrades' && avail.salvage, avail);
  c.check('each has a stable content id', avail.cids === 'upgrade:stapler,upgrade:lamp,upgrade:coffee,upgrade:holdmusic,upgrade:speeddial,upgrade:wedges,upgrade:masterkey,upgrade:runner', avail.cids);

  const fx = await ev(() => {
    const H = HUM;
    H.replaceState(H.sanitizeState({ v: 2 }));
    H.rt.saveBlocked = true;
    H.enterLevel(5);
    H.S.run.salvage = 1e15;
    H.S.run.flags.expedition = true;
    H.S.run.specialists = { scavenge: 8, chart: 6, dowse: 4, watch: 3 };
    H.S.run.facilities = { switchboard: 5 };   // some noise
    const D0 = H.derive();
    const m = H.MIS.stairwell, dur0 = H.missionDuration(m), water0 = H.missionWater(m), longWater0 = H.missionWater(H.MIS.longwalk);
    const out = {};
    const buy = (id) => { const ok = H.buyUpgrade(id); return ok; };
    out.bought = ['stapler', 'lamp', 'coffee', 'holdmusic', 'speeddial', 'wedges', 'masterkey', 'runner'].map(buy);
    const D1 = H.derive();
    out.base = [D0.base, D1.base];
    out.surveyUpg = D1.surveyUpg / D0.surveyUpg;
    out.specEff = D1.specEff / D0.specEff;
    out.auto = D1.autoSurveys / D0.autoSurveys;
    out.rooms = D1.roomsPerSurvey / D0.roomsPerSurvey;
    out.noise = D1.noise / D0.noise;
    out.dur = H.missionDuration(m) / dur0;
    out.water = [water0, H.missionWater(m), longWater0, H.missionWater(H.MIS.longwalk)];
    // The survey breakdown names them.
    H.UI.update(true);
    document.getElementById('spowerHead').click();
    out.detail = document.getElementById('spowerDetail').textContent;
    return out;
  });
  c.check('all eight can be bought with salvage', fx.bought.every(Boolean), fx.bought);
  c.check('the Industrial Stapler adds 6 to the base of every survey you make by hand', fx.base[1] - fx.base[0] === 6, fx.base);
  c.check('the Green Desk Lamp and the Master Key multiply your surveys by 1.25 and 1.5', Math.abs(fx.surveyUpg - 1.875) < 1e-9, fx);
  c.check('Night Shift Coffee: specialists ×1.25; the Hallway Runner: the Cartographer ×1.25 on top', Math.abs(fx.specEff - 1.25) < 1e-9 && Math.abs(fx.auto - 1.5625) < 1e-9, fx);
  c.check('Door Wedges: every survey maps ×1.2 rooms', Math.abs(fx.rooms - 1.2) < 1e-9, fx);
  c.check('Hold Music: noise ×0.75', Math.abs(fx.noise - 0.75) < 1e-9, fx);
  c.check('Speed Dial: missions 25% shorter and 25% cheaper in water (rounded up)', Math.abs(fx.dur - 0.75) < 1e-9 && fx.water[1] === Math.ceil(3 * 0.75) && fx.water[3] === Math.ceil(600 * 0.75), fx);
  c.check('the survey power breakdown names the late survey requisitions', /Industrial Stapler \+6/.test(fx.detail) && /Green Desk Lamp ×1\.25/.test(fx.detail) && /Master Key ×1\.5/.test(fx.detail), fx.detail.slice(0, 400));

  const slip = await ev(() => {
    const H = HUM;
    H.replaceState(H.sanitizeState({ v: 2 }));
    H.rt.saveBlocked = true;
    H.enterLevel(4);
    H.S.run.salvage = 1e9;
    H.S.run.rooms = 1000;
    H.S.seen.tab_upgrades = true;
    H.UI.update(true);
    H.UI.selectTab('upgrades'); H.UI.update(true); H.UI.update(true);
    const card = [...document.querySelectorAll('#panel-upgrades .slip')].find((s) => s.querySelector('[data-id="lamp"]'));
    return card ? { proj: card.querySelector('.spower-proj') && card.querySelector('.spower-proj').textContent, effect: card.querySelector('.effect').textContent } : null;
  });
  c.check('a late survey requisition’s slip shows what it does to a survey', slip && /^Survey power \+[\d.,]+[A-Za-z]* → \+[\d.,]+[A-Za-z]* \(\+25%\)$/.test(slip.proj) && slip.effect === 'Surveys you make by hand recover ×1.25 salvage.', slip);

  const off = await ev(() => {
    const H = HUM, E = H.Exp;
    H.replaceState(H.sanitizeState({ v: 2 }));
    H.rt.saveBlocked = true;
    H.enterLevel(5);
    H.S.run.salvage = 1e15;
    H.S.run.flags.expedition = true;
    H.S.run.specialists = { scavenge: 8, chart: 6, dowse: 4 };
    const base = H.derive();
    const baseDur = H.missionDuration(H.MIS.stairwell);
    for (const id of ['stapler', 'lamp', 'coffee', 'holdmusic', 'speeddial', 'wedges', 'masterkey', 'runner']) H.buyUpgrade(id);
    const on = H.derive();
    const sal = H.S.run.salvage;
    E.set('EXP-LATE-UPGRADES', false);
    const D = H.derive();
    H.S.run.rooms = 1000;
    H.S.seen.tab_upgrades = true;
    H.UI.update(true);
    H.UI.selectTab('upgrades'); H.UI.update(true);
    const out = {
      same: D.surveyPower === base.surveyPower && D.sps === base.sps && D.roomsPerSurvey === base.roomsPerSurvey && D.autoSurveys === base.autoSurveys && H.missionDuration(H.MIS.stairwell) === baseDur,
      owned: ['stapler', 'masterkey', 'runner'].every((id) => H.S.run.upgrades[id] === true),
      listed: document.querySelectorAll('#panel-upgrades [data-id="stapler"], #panel-upgrades [data-id="wedges"]').length,
      nextLine: document.getElementById('spowerNext').textContent,
      salvageSame: H.S.run.salvage === sal,
    };
    E.set('EXP-LATE-UPGRADES', true);
    const back = H.derive();
    out.back = back.surveyPower === on.surveyPower && back.sps === on.sps && back.roomsPerSurvey === on.roomsPerSurvey;
    out.noRebuy = H.buyUpgrade('lamp') === false && H.S.run.salvage === sal;
    E.setItem('upgrade:masterkey', false);
    const one = H.derive();
    out.single = Math.abs(back.surveyPower / one.surveyPower - 1.5) < 1e-9 && one.sps === back.sps;
    E.reset();
    // A noclip resets them, like every requisition.
    H.completeFiniteSurvey(0); H.S.run.stats.salvage = 1e13;
    H.noclip();
    out.reset = !H.S.run.upgrades.lamp && !H.S.run.upgrades.runner;
    return out;
  });
  c.check('switched off: every number is the game without them, though they stay owned', off.same && off.owned, off);
  c.check('switched off: not listed, and the survey line never points to them', off.listed === 0 && !/Stapler|Lamp|Master Key/.test(off.nextLine), off);
  c.check('switched back on: the same numbers, and nothing can be bought or charged twice', off.back && off.noRebuy && off.salvageSame, off);
  c.check('one requisition can be switched off on its own (upgrade:masterkey)', off.single, off);
  c.check('a noclip resets them like every requisition', off.reset, off);

  c.finish(g.errors);
  await g.browser.close();
})();
