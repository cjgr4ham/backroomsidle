// The v2 economy: survey power from facilities and upgrades, passive salvage only from the Scavenger.
const { open, Checker } = require('./harness');

(async () => {
  const c = new Checker('Economy: survey power and passive salvage');
  const g = await open('');
  const { ev, page } = g;

  // A fresh game: +1 per survey, nothing automatic.
  const fresh = await ev(() => {
    const H = HUM;
    H.replaceState(H.sanitizeState({ v: 2 }));
    H.rt.saveBlocked = true;
    const D = H.derive();
    const before = { salvage: H.S.run.salvage, rooms: H.S.run.rooms };
    H.rt.lastSurveyReal = -1e9;
    const ok = H.survey();
    const one = { salvage: H.S.run.salvage, rooms: H.S.run.rooms, aw: H.S.run.aw, echoes: H.S.echoes };   // a survey can find water
    for (let i = 0; i < 6000; i++) H.step(0.1, false);   // ten minutes without surveying
    const idle = { salvage: H.S.run.salvage, rooms: H.S.run.rooms, aw: H.S.run.aw, echoes: H.S.echoes, level: H.S.run.level };
    return { power: D.surveyPower, manual: D.manualSalvage, sps: D.sps, rps: D.roomsPerSec, aws: D.aws, eps: D.eps, auto: D.autoSurveys,
      facMult: D.facMult, before, ok, one, idle };
  });
  c.check('a fresh game has survey power +1 and recovers exactly 1 salvage per survey', fresh.power === 1 && fresh.manual === 1 && fresh.ok && fresh.one.salvage === 1, fresh);
  c.check('a fresh game produces nothing on its own: no salvage, rooms, water or Echoes per second', fresh.sps === 0 && fresh.rps === 0 && fresh.aws === 0 && fresh.eps === 0 && fresh.auto === 0, fresh);
  c.check('ten minutes without surveying change nothing', fresh.idle.salvage === 1 && fresh.idle.rooms === 1 && fresh.idle.aw === fresh.one.aw && fresh.idle.echoes === fresh.one.echoes && fresh.idle.level === 0, { one: fresh.one, idle: fresh.idle });

  // The first Salvage Cart: survey power 1 → 1.25 at once, still nothing passive.
  const cart = await ev(() => {
    const H = HUM;
    H.replaceState(H.sanitizeState({ v: 2 }));
    H.rt.saveBlocked = true;
    H.setBuyMode(1);
    const r = H.S.run;
    r.salvage = 15;
    const before = H.derive();
    const ok = H.buyFacility('cart');
    const after = H.derive();
    H.rt.lastSurveyReal = -1e9;
    const s0 = r.salvage;
    H.survey();
    const gained = r.salvage - s0;
    const s1 = r.salvage;
    for (let i = 0; i < 600; i++) H.step(0.1, false);
    return { ok, price: 15 - s0, before: before.surveyPower, after: after.surveyPower, gained, sps: after.sps, idleGain: r.salvage - s1, facMult: after.facMult };
  });
  c.check('the first Salvage Cart costs 15 salvage', cart.ok && cart.price === 15, cart);
  c.check('the first cart raises survey power from +1 to +1.25 immediately', cart.before === 1 && cart.after === 1.25 && cart.facMult === 1.25, cart);
  c.check('the next survey recovers the new amount', cart.gained === 1.25, cart);
  c.check('owning a cart adds no passive salvage', cart.sps === 0 && cart.idleGain === 0, cart);

  // Every facility, tier and requisition: survey power grows, passive output stays at zero.
  const all = await ev(() => {
    const H = HUM;
    H.replaceState(H.sanitizeState({ v: 2 }));
    H.rt.saveBlocked = true;
    for (const a of H.ACHIEVEMENTS) H.S.achievements[a.id] = true;   // fixed global bonus while comparing
    const r = H.S.run;
    r.level = 5;
    const p0 = H.derive().surveyPower;
    for (const f of H.FACILITIES) r.facilities[f.id] = 60;
    const p1 = H.derive().surveyPower;
    for (const u of H.UPGRADES) if (u.fac) r.upgrades[u.id] = true;
    const p2 = H.derive().surveyPower;
    for (const u of H.UPGRADES) if (!u.fac && !u.repeatable && u.id !== 'overtime') r.upgrades[u.id] = true;
    r.drills = 10;
    const D = H.derive();
    // The facility multiplier is 1 + Σ count × bonus × tier multiplier × facility boosts over the salvage facilities.
    let points = 0;
    for (const f of H.FACILITIES) if (f.kind === 'salvage') points += 60 * f.bonus * Math.pow(f.kind === 'salvage' ? 2 : 1.5, 3) * D.facBoost;
    const product = D.base * D.facMult * D.surveyUpg * D.depth * D.global * D.drill;
    const s0 = r.salvage, rooms0 = r.rooms, aw0 = r.aw, e0 = H.S.echoes;
    for (let i = 0; i < 3000; i++) H.step(0.1, false);
    return { p0, p1, p2, p3: D.surveyPower, facMult: D.facMult, expectedFacMult: 1 + points, product, sps: D.sps, rps: D.roomsPerSec, aws: D.aws, eps: D.eps,
      roomsPerSurvey: D.roomsPerSurvey, waterFac: D.waterFac, echoFac: D.echoFac,
      gained: { salvage: r.salvage - s0, rooms: r.rooms - rooms0, aw: r.aw - aw0, echoes: H.S.echoes - e0 } };
  });
  c.check('salvage facilities multiply survey power; their tiers multiply it again', all.p1 > all.p0 * 100 && all.p2 > all.p1 * 4, all);
  c.check('the facility multiplier is 1 + Σ count × bonus × tiers × facility boosts', Math.abs(all.facMult - all.expectedFacMult) / all.expectedFacMult < 1e-9, all);
  c.check('survey power is base × facilities × survey upgrades × depth × global × drills', Math.abs(all.product - all.p3) / all.p3 < 1e-12, all);
  c.check('with every facility, tier and requisition and no specialist, nothing is produced per second', all.sps === 0 && all.rps === 0 && all.aws === 0 && all.eps === 0, all);
  c.check('five minutes later nothing has been gained without surveying', all.gained.salvage === 0 && all.gained.rooms === 0 && all.gained.aw === 0 && all.gained.echoes === 0, all.gained);
  c.check('support facilities still improve what they support (rooms per survey, water, Echoes)', all.roomsPerSurvey > 8 && all.waterFac > 1 && all.echoFac > 1, all);

  // Offline catch-up with facilities but no specialists recovers nothing.
  const offline = await ev(() => {
    const H = HUM, r = H.S.run;
    const s0 = r.salvage, rooms0 = r.rooms, aw0 = r.aw;
    H.catchUp(4 * 3600);
    return { salvage: r.salvage - s0, rooms: r.rooms - rooms0, aw: r.aw - aw0 };
  });
  c.check('four hours away with facilities only recover nothing', offline.salvage === 0 && offline.rooms === 0 && offline.aw === 0, offline);

  // The Scavenger starts passive salvage at once, and the two outputs never feed each other.
  const scav = await ev(() => {
    const H = HUM;
    H.replaceState(H.sanitizeState({ v: 2 }));
    H.rt.saveBlocked = true;
    for (const a of H.ACHIEVEMENTS) H.S.achievements[a.id] = true;
    const r = H.S.run;
    r.salvage = 1e9;
    const p0 = H.derive().surveyPower;
    const ok = H.hireSpecialist('scavenge');
    const D1 = H.derive();
    const s0 = r.salvage;
    for (let i = 0; i < 100; i++) H.step(0.1, false);
    const tenSec = r.salvage - s0;
    // More facilities: survey power rises, passive salvage does not move.
    r.facilities.cart = 40; r.facilities.bench = 30;
    const D2 = H.derive();
    // More Scavenger levels: passive salvage rises, survey power does not move.
    r.specialists.scavenge = 12;
    const D3 = H.derive();
    // Global bonuses and level depth apply to both.
    r.level = 2;
    const D4 = H.derive();
    // Away offline: only the Scavenger's salvage is credited.
    const s1 = r.salvage;
    H.catchUp(600);
    return { ok, p0, p1: D1.surveyPower, sps1: D1.sps, tenSec, p2: D2.surveyPower, sps2: D2.sps, p3: D3.surveyPower, sps3: D3.sps,
      p4: D4.surveyPower, sps4: D4.sps, depth: D4.depth, offline: r.salvage - s1 };
  });
  c.check('recruiting the Scavenger starts passive salvage immediately', scav.ok && scav.sps1 > 0 && Math.abs(scav.tenSec - scav.sps1 * 10) / (scav.sps1 * 10) < 1e-6, scav);
  c.check('recruiting the Scavenger does not change survey power', scav.p1 === scav.p0, scav);
  c.check('buying facilities raises survey power and leaves passive salvage unchanged', scav.p2 > scav.p1 && scav.sps2 === scav.sps1, scav);
  c.check('upgrading the Scavenger raises passive salvage and leaves survey power unchanged', scav.sps3 > scav.sps2 && scav.p3 === scav.p2, scav);
  c.check('level depth multiplies both survey power and the Scavenger', Math.abs(scav.p4 / scav.p3 - scav.depth) < 1e-9 && Math.abs(scav.sps4 / scav.sps3 - scav.depth) < 1e-9, scav);
  c.check('time away credits the Scavenger’s salvage', scav.offline > 0 && Math.abs(scav.offline - scav.sps4 * 600) / (scav.sps4 * 600) < 0.01, scav);

  // Missions follow the Scavenger, not survey power.
  const mission = await ev(() => {
    const H = HUM;
    H.replaceState(H.sanitizeState({ v: 2 }));
    H.rt.saveBlocked = true;
    const r = H.S.run;
    r.salvage = 1e12; r.aw = 1000;
    r.specialists = { chart: 1, scavenge: 3 };
    const m = H.MIS.stairwell;
    const D0 = H.derive();
    r.facilities.cart = 80; r.facilities.bench = 60;
    const D1 = H.derive();
    H.launchMission('stairwell');
    const x = r.missions.stairwell;
    return { powerUp: D1.surveyPower / D0.surveyPower, haul: x && x.salvage, fromScav: D1.idleSalvage * m.duration * H.CONFIG.missions.haulShare, floor: m.salvageMin };
  });
  c.check('a mission’s salvage is a share of the Scavenger’s output, not of survey power', mission.powerUp > 10 && Math.abs(mission.haul - Math.max(mission.floor, mission.fromScav)) < 1e-6, mission);

  // Hand tools add to the base, survey upgrades multiply, lights out halves a survey and stops the specialists.
  const parts = await ev(() => {
    const H = HUM;
    H.replaceState(H.sanitizeState({ v: 2 }));
    H.rt.saveBlocked = true;
    const r = H.S.run;
    r.upgrades.gloves = true;
    const a = H.derive();
    r.upgrades.flashlight = true;
    const b = H.derive();
    r.upgrades.satchel = true; r.facilities.cart = 50;
    const c2 = H.derive();
    r.specialists.scavenge = 1;
    const on = H.derive();
    r.lightsUntil = H.S.time + 10;
    const off = H.derive();
    return { base: a.base, power: a.surveyPower, flash: b.surveyPower / a.surveyPower, satchelBase: c2.base, onManual: on.manualSalvage, offManual: off.manualSalvage, onSps: on.sps, offSps: off.sps,
      gloves: H.UPG.gloves.hand, flashMult: H.UPG.flashlight.mult };
  });
  c.check('Work Gloves add +1 to the base of every survey', parts.base === 1 + parts.gloves && parts.power === 2, parts);
  c.check('the Flashlight multiplies survey power by its stated amount', Math.abs(parts.flash - parts.flashMult) < 1e-12, parts);
  c.check('the Canvas Satchel adds 0.01 to the base per facility owned', Math.abs(parts.satchelBase - (2 + 0.5)) < 1e-12, parts);
  c.check('lights out halve what a survey recovers and stop passive salvage', parts.offManual === parts.onManual / 2 && parts.onSps > 0 && parts.offSps === 0, parts);

  // What the player sees: survey power, its breakdown, the passive line, the floating gain and the facility preview.
  // Achievements earned along the way (+1% each) are held at zero here so the shown numbers can be compared exactly.
  await ev(() => {
    const H = HUM;
    H.CONFIG.achievementBonus = 0;
    H.replaceState(H.sanitizeState({ v: 2 }));
    H.rt.saveBlocked = true;
    H.S.seen.firstSurvey = true;
    H.UI.selectTab('facilities'); H.rt.structureDirty = true; H.UI.update(true);
  });
  const ui0 = await ev(() => ({ val: document.getElementById('spowerVal').textContent, idle: document.getElementById('spowerIdle').textContent,
    gain: document.querySelector('#panel-facilities .row[data-fac="cart"] .fs-gain').textContent }));
  c.check('the survey power line shows +1 for a fresh game', ui0.val === '+1 salvage per survey', ui0);
  c.check('the passive line says there is none until the Scavenger is recruited', /^Passive salvage: none/.test(ui0.idle), ui0);
  c.check('the cart row previews the new survey power before buying', /survey power \+1 → \+1\.25 \(\+25%\)/.test(ui0.gain), ui0);
  await ev(() => { HUM.S.run.salvage = 15; HUM.UI.update(); });
  await page.click('#panel-facilities .row[data-fac="cart"] [data-action="buy-fac"]');
  await page.waitForTimeout(150);
  await page.click('#btnSurvey');
  await page.waitForTimeout(60);
  const ui1 = await ev(() => ({ val: document.getElementById('spowerVal').textContent, float: [...document.querySelectorAll('#btnSurvey .float-gain')].map((n) => n.textContent),
    salvage: HUM.S.run.salvage, reduced: HUM.rt.reducedMotion }));
  c.check('after buying a cart the survey power line shows +1.25', ui1.val === '+1.25 salvage per survey', ui1);
  c.check('the Survey button pays the shown amount (and floats it unless motion is reduced)', ui1.salvage === 1.25 && (ui1.reduced || ui1.float.includes('+1.25')), ui1);
  await page.click('#spowerHead');
  await page.waitForTimeout(80);
  const detail = await ev(() => ({ expanded: document.getElementById('spowerHead').getAttribute('aria-expanded'),
    rows: [...document.querySelectorAll('#spowerDetail dt')].map((n) => n.textContent), text: document.getElementById('spowerDetail').textContent }));
  c.check('the breakdown lists every factor and keeps passive salvage separate',
    detail.expanded === 'true' && ['Base', 'Facilities', 'Survey upgrades', 'Level depth', 'Global bonuses', 'Survey power', 'One survey now', 'Passive (separate)'].every((k) => detail.rows.includes(k)) && /Salvage Cart \+0\.25/.test(detail.text), detail);
  await page.keyboard.press('s');
  await page.waitForTimeout(60);
  const key = await ev(() => HUM.S.run.salvage);
  c.check('pressing S surveys exactly like the button', Math.abs(key - 2.5) < 1e-9, key);
  await ev(() => { HUM.CONFIG.achievementBonus = 0.01; });

  // Large numbers stay readable, small ones keep their decimals.
  const nums = await ev(() => {
    const H = HUM;
    H.replaceState(H.sanitizeState({ v: 2 }));
    H.rt.saveBlocked = true;
    const r = H.S.run;
    r.level = 5; r.drills = 12;
    for (const f of H.FACILITIES) r.facilities[f.id] = 120;
    for (const u of H.UPGRADES) if (!u.repeatable) r.upgrades[u.id] = true;
    H.UI.update(true);
    return { power: H.derive().surveyPower, text: document.getElementById('spowerVal').textContent };
  });
  c.check('late-game survey power reaches enormous numbers and is shown with a suffix', nums.power > 1e9 && /^\+\d+(\.\d+)? ?[A-Za-z]+ salvage per survey$/.test(nums.text), nums);

  await g.browser.close();

  // The same core numbers with every experiment switched off.
  const h = await open('?exp=none');
  const core = await h.ev(() => {
    const H = HUM;
    H.replaceState(H.sanitizeState({ v: 2 }));
    H.rt.saveBlocked = true;
    const r = H.S.run;
    const D0 = H.derive();
    r.salvage = 15; H.setBuyMode(1); H.buyFacility('cart');
    const D1 = H.derive();
    r.salvage = 1000; H.hireSpecialist('scavenge');
    const D2 = H.derive();
    return { p0: D0.surveyPower, sps0: D0.sps, p1: D1.surveyPower, sps1: D1.sps, p2: D2.surveyPower, sps2: D2.sps };
  });
  c.check('with every experiment off: +1 per survey, +1.25 after the first cart, nothing passive until the Scavenger', core.p0 === 1 && core.sps0 === 0 && core.p1 === 1.25 && core.sps1 === 0 && core.p2 === 1.25 && core.sps2 > 0, core);
  c.finish([...g.errors, ...h.errors]);
  await h.browser.close();
})();
