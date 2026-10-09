// EXP-CLICK-POWER: survey power, the first upgrade, the hand-tool ladder, and separation from automation.
const { open, Checker } = require('./harness');

(async () => {
  const c = new Checker('EXP-CLICK-POWER: click-power progression');
  const g = await open('?exp=none,EXP-CLICK-POWER');
  const { ev, page } = g;
  const click = async (n) => { for (let i = 0; i < n; i++) { await page.click('#btnSurvey'); await page.waitForTimeout(70); } };

  c.check('a new game recovers exactly 1 salvage per survey', await ev(() => HUM.derive().manualSalvage === 1));
  await click(1);
  c.check('one survey adds 1 salvage', await ev(() => Math.abs(HUM.S.run.salvage - 1) < 1e-9 && HUM.S.run.stats.surveys === 1));
  await click(1);
  await page.waitForTimeout(200);
  const first = await ev(() => {
    const listed = [...document.querySelectorAll('#panel-upgrades .slip h3')].map((h) => h.textContent);
    const available = HUM.UPGRADES.filter((u) => HUM.upgradeAvailable(u)).map((u) => u.id);
    return { tabVisible: !document.getElementById('tab-upgrades').hidden, available, listed, objective: document.getElementById('objective').textContent };
  });
  c.check('the Upgrades tab opens after 2 rooms', first.tabVisible, first);
  c.check('Work Gloves is the only upgrade available at the start', first.available.join() === 'gloves', first.available);
  c.check('the objective points to the first upgrade', /Work Gloves/.test(first.objective), first.objective);

  const poor = await ev(() => HUM.buyUpgrade('gloves'));
  c.check('Work Gloves cannot be bought without 10 salvage', poor === false);
  await click(8);
  await page.click('#tab-upgrades');
  await page.waitForTimeout(150);
  const shown = await ev(() => document.querySelector('#panel-upgrades .slip').textContent);
  c.check('the slip shows the cost and the effect on survey power', /10 salvage/.test(shown) && /Survey power \+1 → \+2 \(\+100%\)/.test(shown), shown);
  const held = await ev(() => HUM.S.run.salvage);
  await page.click('#panel-upgrades .slip [data-action="buy-upg"]');
  const bought = await ev(() => { const D = HUM.derive(); return { owned: HUM.S.run.upgrades.gloves === true, salvage: HUM.S.run.salvage, again: HUM.buyUpgrade('gloves'), base: D.manualBase, power: D.manualSalvage, mult: D.surveyMult }; });
  c.check('buying deducts exactly 10 salvage once', bought.owned && Math.abs(held - bought.salvage - 10) < 1e-9 && bought.again === false, { held, bought });
  c.check('the base reward rises from 1 to 2 and survey power doubles', bought.base === 2 && Math.abs(bought.power - 2 * bought.mult) < 1e-12, bought);
  const before = await ev(() => HUM.S.run.salvage);
  await click(1);
  const afterClick = await ev(() => HUM.S.run.salvage);
  c.check('the next survey by button recovers 2 salvage', Math.abs(afterClick - before - 2) < 0.05, { before, afterClick });
  await page.keyboard.press('s');
  await page.waitForTimeout(80);
  const afterKey = await ev(() => HUM.S.run.salvage);
  c.check('a survey by the S key recovers the same 2 salvage', Math.abs(afterKey - afterClick - 2) < 0.05, { afterClick, afterKey });
  await page.waitForTimeout(200);
  const stat = await ev(() => ({ text: document.getElementById('surveyPower').textContent, hidden: document.getElementById('surveyPower').hidden }));
  c.check('the survey power line shows +2 and points at the next upgrade', !stat.hidden && /\+2 salvage per survey/.test(stat.text) && /Next:/.test(stat.text), stat);

  const ladder = await ev(() => {
    const H = HUM, r = H.S.run;
    r.salvage = 1e9; r.rooms = 200;
    const steps = [];
    // Remove the achievement bonus so the arithmetic below is exact.
    H.S.achievements = {};
    const snap = (id) => { const D = H.derive(); steps.push({ id, base: D.manualBase, mult: D.surveyMult, power: D.manualSalvage }); };
    snap('gloves');
    for (const id of ['flashlight', 'prybar']) { H.buyUpgrade(id); snap(id); }
    r.facilities.cart = 20;
    H.buyUpgrade('satchel'); snap('satchel');
    for (let i = 0; i < 3; i++) H.buyUpgrade('drills');
    return { steps, ranks: r.ext.click.drills, power: H.derive().manualSalvage };
  });
  const st = Object.fromEntries(ladder.steps.map((x) => [x.id, x]));
  c.check('with gloves alone, survey power is 2', st.gloves.power === 2, st.gloves);
  c.check('Flashlight doubles it to 4', st.flashlight.power === 4 && st.flashlight.mult === 2, st.flashlight);
  c.check('Pry Bar adds 2 base: (1+1+2)×2 = 8', st.prybar.base === 4 && st.prybar.power === 8, st.prybar);
  c.check('Canvas Satchel scales with facilities: (4+1)×2 = 10 at 20 facilities', Math.abs(st.satchel.base - 5) < 1e-9 && Math.abs(st.satchel.power - 10) < 1e-9, st.satchel);
  c.check('Survey Drills is repeatable and stores its rank', ladder.ranks === 3, ladder);
  c.check('three ranks of drills give ×1.3: 10 → 13', Math.abs(ladder.power - 13) < 1e-9, ladder.power);

  const costs = await ev(() => {
    const H = HUM, r = H.S.run;
    const price = () => Math.ceil(1000 * Math.pow(5, r.ext.click.drills));
    const p0 = price(); const s0 = r.salvage; H.buyUpgrade('drills');
    return { p0, paid: s0 - r.salvage, next: price() };
  });
  c.check('each drill rank costs 5× the last and charges exactly that', costs.paid === costs.p0 && costs.next === costs.p0 * 5, costs);
  const maxed = await ev(() => {
    const H = HUM, r = H.S.run;
    r.ext.click.drills = 25; r.salvage = 1e300;
    return { bought: H.buyUpgrade('drills'), listed: H.upgradeVisible(H.UPG.drills), rank: r.ext.click.drills };
  });
  c.check('drills stop at rank 25 and leave the list', maxed.bought === false && maxed.listed === false && maxed.rank === 25, maxed);

  const auto = await ev(() => {
    const H = HUM, r = H.S.run;
    r.ext.click.drills = 0;
    r.facilities.beacon = 10;
    const D1 = H.derive();
    const ownedHand = ['gloves', 'prybar', 'satchel'].filter((id) => r.upgrades[id]);
    for (const id of ownedHand) delete r.upgrades[id];
    const D0 = H.derive();
    for (const id of ownedHand) r.upgrades[id] = true;
    const surveysBefore = r.stats.surveys;
    for (let i = 0; i < 50; i++) H.step(0.1, false);
    return { autoWith: D1.autoSalvage, autoWithout: D0.autoSalvage, manualWith: D1.manualSalvage, manualWithout: D0.manualSalvage, surveysAfterSteps: r.stats.surveys - surveysBefore };
  });
  c.check('hand tools do not change automatic survey salvage', auto.autoWith === auto.autoWithout && auto.manualWith > auto.manualWithout, auto);
  c.check('automatic surveys never count as manual surveys', auto.surveysAfterSteps === 0, auto);

  const sounder = await ev(() => {
    const H = HUM, r = H.S.run;
    r.level = 1;
    const off = H.derive().manualEchoMult;
    H.buyUpgrade('sounder');
    const D = H.derive();
    return { off, echo: D.manualEchoMult, water: D.manualWaterMult };
  });
  c.check('Echo Sounder doubles manual Echo finds and adds 50% to water finds', sounder.off === undefined && sounder.echo === 2 && sounder.water === 1.5, sounder);

  const parts = await ev(() => {
    document.getElementById('spowerHead').click();
    const D = HUM.derive();
    const txt = document.getElementById('spowerDetail').textContent;
    return { txt, power: D.manualSalvage, mult: D.surveyMult };
  });
  c.check('the breakdown lists base, multipliers and the per-survey total', /Base salvage/.test(parts.txt) && /Multipliers/.test(parts.txt) && /Per survey/.test(parts.txt) && /Automatic surveys/.test(parts.txt), parts.txt.slice(0, 200));

  // Persistence
  await ev(() => { HUM.rt.saveBlocked = false; HUM.save(); });
  await page.reload();
  await page.waitForTimeout(300);
  const loaded = await ev(() => ({ gloves: HUM.S.run.upgrades.gloves, drills: HUM.S.run.ext.click && HUM.S.run.ext.click.drills, power: HUM.derive().manualSalvage }));
  c.check('click upgrades and drill rank survive a reload', loaded.gloves === true && loaded.drills === 0 && loaded.power > 1, loaded);

  // Noclip (the rebirth system) is unchanged: same Déjà Vu, and every click upgrade belongs to the run it resets.
  const reborn = await ev(() => {
    const H = HUM, r = H.S.run;
    H.rt.saveBlocked = true;
    const keep = JSON.stringify(H.S);
    r.level = 3; r.stats.salvage = 5e8; r.ext.click = { drills: 2 };
    H.S.memories.muscle = 1;
    const preview = H.dvPreview();
    H.Exp.session['EXP-CLICK-POWER'] = false;
    const previewOff = H.dvPreview();
    H.Exp.session['EXP-CLICK-POWER'] = true;
    const dvBefore = H.S.dv, memories = JSON.stringify(H.S.memories);
    const ok = H.noclip();
    const n = H.S.run, D = H.derive();
    const res = { ok, preview, previewOff, gained: H.S.dv - dvBefore, memoriesKept: JSON.stringify(H.S.memories) === memories,
      upgrades: Object.keys(n.upgrades), drills: n.ext.click ? n.ext.click.drills : 0, base: D.manualBase, drill: D.manualDrill };
    H.replaceState(H.sanitizeState(JSON.parse(keep)));
    return res;
  });
  c.check('Déjà Vu from a noclip is the same with the experiment on or off', reborn.ok && reborn.preview === reborn.previewOff && reborn.gained === reborn.preview, reborn);
  c.check('a noclip clears hand tools and drill ranks with the rest of the run', reborn.upgrades.length === 0 && reborn.drills === 0 && reborn.base === 1 && reborn.drill === 1, reborn);
  c.check('a noclip keeps memories', reborn.memoriesKept, reborn);

  // Switching the experiment off restores the original survey without touching the save.
  const off = await ev(() => {
    HUM.rt.saveBlocked = true;
    const H = HUM;
    const withOn = H.derive().manualSalvage;
    H.Exp.set('EXP-CLICK-POWER', false);
    const D = H.derive();
    const original = D.surveyFlat + D.surveyPct * D.spsNominal;
    const res = { withOn, offPower: D.manualSalvage, expected: original * D.sanityBand.salvage * (D.lightsOut ? 0.5 : 1), glovesStillOwned: H.S.run.upgrades.gloves === true, glovesListed: H.UPGRADES.some((u) => u.id === 'gloves' && H.upgradeAvailable(u)), echo: D.manualEchoMult };
    H.UI.update(true);
    res.lineHidden = document.getElementById('surveyPower').hidden;
    const r = H.S.run, rooms = r.rooms, salvage = r.salvage;
    r.salvage = 1e9;
    res.buyOff = [H.buyUpgrade('prybar'), H.buyUpgrade('cutters'), H.buyUpgrade('drills')];
    res.spentOff = 1e9 - r.salvage;
    r.rooms = 3;
    const tab = H.TABS.find((t) => t.id === 'upgrades');
    res.tabAt3 = H.Exp.ask('tabUnlocked', tab) !== undefined ? H.Exp.ask('tabUnlocked', tab) : tab.unlocked();
    r.rooms = rooms; r.salvage = salvage;
    H.Exp.set('EXP-CLICK-POWER', true);
    res.backOn = H.derive().manualSalvage;
    H.Exp.reset();
    return res;
  });
  c.check('switched off, a survey pays exactly the original formula', Math.abs(off.offPower - off.expected) < 1e-9 && off.offPower < off.withOn, off);
  c.check('switched off, owned click upgrades stay in the save but do nothing', off.glovesStillOwned && off.echo === undefined, off);
  c.check('switched off, the survey power line is hidden', off.lineHidden === true, off);
  c.check('switched off, click upgrades cannot be bought and nothing is charged', off.buyOff.every((b) => b === false) && off.spentOff === 0, off);
  c.check('switched off, the Upgrades tab opens at 5 rooms again', off.tabAt3 === false, off);
  c.check('switched back on, the bonuses return', Math.abs(off.backOn - off.withOn) < 1e-9, off);

  c.finish(g.errors);
  await g.browser.close();
})();
