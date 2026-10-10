// Functional tests for The Hum. Drives the real page in headless Chromium.
// Run: node tools/functional-test.js   (needs Playwright with a Chromium build)
// The core game with every experiment switched off (?exp=none): surveying and survey power, purchases,
// specialists and missions, attention and incidents, sanity, anomalies, levels, completion and noclip, saving,
// time away, damaged and hostile saves, export and import, reset and the keyboard. Set HUM_QUERY to test
// another combination of experiments.
const path = require('path');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node22/lib/node_modules/playwright'); }
const QUERY = process.env.HUM_QUERY !== undefined ? process.env.HUM_QUERY : '?exp=none';
const URL = 'file://' + path.resolve(__dirname, '..', 'index.html') + QUERY + '#debug';

let failures = 0, passes = 0;
function check(name, cond, detail) {
  if (cond) { passes++; console.log('  ok   ' + name); }
  else { failures++; console.log('  FAIL ' + name + (detail !== undefined ? '  -> ' + JSON.stringify(detail) : '')); }
}

(async () => {
  const browser = await playwright.chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1366, height: 860 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const fresh = async () => {
    await page.goto(URL);
    await ev(() => { if (window.HUM) HUM.rt.saveBlocked = true; localStorage.clear(); });
    await page.reload();
    await page.waitForTimeout(300);
  };

  console.log('New game');
  await fresh();
  check('starts at level 0 with nothing', await ev(() => HUM.S.run.level === 0 && HUM.S.run.salvage === 0 && HUM.S.run.rooms === 0));
  check('survey button is visible and enabled', await page.isEnabled('#btnSurvey'));
  check('a fresh game recovers +1 per survey and produces nothing on its own', await ev(() => { const D = HUM.derive(); return D.surveyPower === 1 && D.sps === 0 && D.roomsPerSec === 0; }));

  console.log('Surveying and purchases');
  // Surveys closer than 60 ms apart are refused (key-repeat guard). Under load two clicks can reach the page closer
  // together than they were sent, so each click first clears that timer; the clicks themselves are real.
  for (let i = 0; i < 20; i++) { await ev(() => { HUM.rt.lastSurveyReal = -1e9; }); await page.click('#btnSurvey'); await page.waitForTimeout(20); }
  const afterClicks = await ev(() => ({ rooms: HUM.S.run.rooms, salvage: HUM.S.run.salvage, surveys: HUM.S.run.stats.surveys }));
  check('20 clicks map 20 rooms', afterClicks.rooms === 20, afterClicks);
  check('salvage recovered from surveys', afterClicks.salvage >= 20, afterClicks);
  await ev(() => { HUM.S.run.salvage = 1000; HUM.S.run.nextEncounterAt = 1e12; });
  const quote = await ev(() => { HUM.setBuyMode(10); const f = HUM.FACILITIES[0]; return HUM.buyQuote(f); });
  const expected10 = await ev(() => Math.ceil(HUM.facilityCost(HUM.FACILITIES[0], 0, 10)));
  check('x10 quote equals the summed cost of 10', quote.cost === expected10 && quote.n === 10, { quote, expected10 });
  const before = await ev(() => ({ salvage: HUM.S.run.salvage, power: HUM.derive().surveyPower }));
  await ev(() => HUM.buyFacility('cart'));
  const after = await ev(() => ({ salvage: HUM.S.run.salvage, carts: HUM.S.run.facilities.cart, power: HUM.derive().surveyPower, sps: HUM.derive().sps }));
  check('buying x10 charges exactly the quoted price', Math.abs(before.salvage - after.salvage - quote.cost) < 1e-6 && after.carts === 10, { before, after, quote });
  check('carts raise survey power and add no passive salvage', after.power > before.power && after.sps === 0, { before, after });
  const maxCheck = await ev(() => {
    HUM.setBuyMode('max'); HUM.S.run.salvage = 5000;
    const f = HUM.FACILITIES[0]; const q = HUM.buyQuote(f);
    const owned = HUM.S.run.facilities.cart;
    const next = Math.ceil(HUM.facilityCost(f, owned, q.n + 1));
    return { q, affordableNext: next <= 5000 };
  });
  check('MAX buys the largest affordable quantity', maxCheck.q.ok && !maxCheck.affordableNext, maxCheck);
  const spam = await ev(() => {
    HUM.setBuyMode(1); HUM.S.run.salvage = Math.ceil(HUM.facilityCost(HUM.FACILITIES[0], HUM.S.run.facilities.cart, 1));
    const a = HUM.buyFacility('cart'), b = HUM.buyFacility('cart');
    return { a, b, salvage: HUM.S.run.salvage };
  });
  check('rapid double purchase only buys what is affordable', spam.a === true && spam.b === false && spam.salvage >= 0, spam);
  const rates = await ev(() => { const D = HUM.derive(); const f = D.fac.cart; return { each: f.each, total: f.total, n: HUM.S.run.facilities.cart }; });
  check('displayed facility total equals count x each', Math.abs(rates.total - rates.each * rates.n) < 1e-9, rates);
  const wave = await ev(() => { HUM.S.run.salvage = 1e9; return { vat: HUM.buyFacility('vat'), visible: HUM.facVisible(HUM.FAC.vat) }; });
  check('a facility of a deeper level cannot be bought before its level', wave.vat === false && wave.visible === false, wave);

  console.log('Upgrades');
  const upg = await ev(() => {
    const u = HUM.UPGRADES.find((x) => x.id === 'flashlight');
    HUM.S.run.salvage = u.cost.salvage + 100;
    const before = HUM.derive().surveyPower;
    const ok = HUM.buyUpgrade('flashlight');
    return { ok, before, after: HUM.derive().surveyPower, mult: u.mult, salvage: HUM.S.run.salvage, again: HUM.buyUpgrade('flashlight') };
  });
  check('the Flashlight multiplies survey power by its stated amount, charged once', upg.ok && Math.abs(upg.after / upg.before - upg.mult) < 1e-9 && upg.salvage === 100 && upg.again === false, upg);
  const locked = await ev(() => { HUM.S.run.salvage = 1e9; return HUM.buyUpgrade('boots'); });
  check('cannot buy an upgrade whose requirement is not met', locked === false);

  console.log('Specialists and missions');
  const spec = await ev(() => {
    const r = HUM.S.run;
    r.flags.water = true; r.aw = 1000; r.salvage = 1e6;
    const a = HUM.hireSpecialist('scavenge'), b = HUM.hireSpecialist('chart'), c = HUM.hireSpecialist('scavenge');
    return { a, b, c, specs: { ...r.specialists }, sps: HUM.derive().sps, auto: HUM.derive().autoSurveys };
  });
  check('specialists are recruited and upgraded with salvage and work at once', spec.a && spec.b && spec.c && spec.specs.scavenge === 2 && spec.specs.chart === 1 && spec.sps > 0 && spec.auto > 0, spec);
  const mis = await ev(() => {
    const r = HUM.S.run;
    const aw0 = r.aw;
    const ok = HUM.launchMission('stairwell');
    const paid = aw0 - r.aw;   // measured now: the team may bring water back
    const x = { ...r.missions.stairwell };
    r.missions.stairwell.hazard = 1;   // force the hazard roll for the test
    // The haul was fixed when the team left; with the Scavenger off duty nothing else adds salvage meanwhile.
    const keep = r.specialists.scavenge;
    delete r.specialists.scavenge;
    const att0 = r.attention;
    const s0 = r.salvage;
    const dur = x.end - x.start;
    for (let i = 0; i < Math.ceil(dur / 0.1) + 5; i++) HUM.step(0.1, false);
    const out = { ok, paid, done: !r.missions.stairwell, haul: x.salvage, gained: r.salvage - s0, attention: r.attention - att0,
      specs: { ...r.specialists }, working: HUM.derive().spec.chart.working, n: r.stats.expeditions };
    r.specialists.scavenge = keep;
    return out;
  });
  check('a mission pays its water, needs its specialist, and completes on the game clock', mis.ok && mis.paid === 3 && mis.done && mis.n === 1, mis);
  check('a hazard halves the haul and raises attention, and never takes a specialist', Math.abs(mis.gained - mis.haul / 2) < 1e-6 && mis.attention > 0 && mis.specs.chart === 1 && mis.working, mis);

  console.log('Attention and incidents');
  const att = await ev(() => {
    const r = HUM.S.run; r.level = 2; r.facilities.boiler = 60; r.facilities.foundry = 50;
    const D = HUM.derive();
    const expected = 100 * D.noise / (D.noise + D.absorb);
    for (let i = 0; i < 4000; i++) HUM.step(0.1, true);
    return { target: D.attnTarget, expected, attention: r.attention };
  });
  check('attention settles at 100*N/(N+A)', Math.abs(att.target - att.expected) < 1e-9 && Math.abs(att.attention - att.target) < 1, att);
  const inc = await ev(() => {
    const r = HUM.S.run; r.attention = 95; r.incidentGraceUntil = 0; r.pendingIncident = null; r.nextEncounterAt = 1e12;
    const results = {};
    for (const type of ['breach', 'taken', 'raid', 'shock']) {
      r.pendingIncident = null; r.incidentGraceUntil = 0;
      HUM.scheduleIncident();
      r.pendingIncident.type = type;
      if (type === 'breach') r.pendingIncident.target = 'boiler';
      // During the raid nobody earns, so the 8% can be measured exactly.
      const keep = r.specialists;
      if (type === 'raid') r.specialists = {};
      const snap = { salvage: r.salvage = 10000, sanity: r.sanity = 90 };
      const at = r.pendingIncident.at;
      while (HUM.S.time < at + 0.05) HUM.step(0.1, false);
      if (type === 'raid') r.specialists = keep;
      results[type] = { disabled: !!r.disabled.boiler, salvage: r.salvage, sanity: r.sanity, away: Object.keys(r.away), levels: { ...r.specialists }, pending: !!r.pendingIncident, snap };
    }
    return results;
  });
  check('breach takes a facility offline', inc.breach.disabled, inc.breach);
  check('taken sends a specialist away for a while, keeping their level', inc.taken.away.length === 1 && inc.taken.levels.scavenge === 2 && inc.taken.levels.chart === 1, inc.taken);
  check('raid takes 8% of stockpiled salvage', Math.abs(inc.raid.salvage - 9200) < 5, inc.raid);
  check('shock costs sanity', inc.shock.sanity < 90, inc.shock);
  const avert = await ev(() => {
    const r = HUM.S.run; r.away = {}; r.lightsReadyAt = 0; r.lightsUntil = 0; r.incidentGraceUntil = 0; r.attention = 95;
    const on = HUM.derive().sps;
    HUM.scheduleIncident();
    const ok = HUM.killLights();
    const D = HUM.derive();
    return { ok, pending: r.pendingIncident, averted: r.stats.averted, on, sps: D.sps, attention: r.attention };
  });
  check('kill the lights averts the incident and halts the specialists', avert.ok && avert.pending === null && avert.averted >= 1 && avert.on > 0 && avert.sps === 0 && avert.attention <= 50, avert);
  const relight = await ev(() => { for (let i = 0; i < 160; i++) HUM.step(0.1, false); return { out: HUM.derive().lightsOut, cooling: !HUM.killLights() }; });
  check('lights return and the switch recharges', relight.out === false && relight.cooling, relight);

  console.log('Sanity');
  const bo = await ev(() => {
    const r = HUM.S.run; r.sanity = 0.01; r.attention = 100;
    HUM.step(0.1, false);
    const blocked = !HUM.survey();
    return { blocked, until: r.blackoutUntil > HUM.S.time, sanity: r.sanity };
  });
  check('blackout at 0 sanity blocks surveying', bo.blocked && bo.until && bo.sanity >= 30, bo);
  const drink = await ev(() => { const r = HUM.S.run; r.blackoutUntil = 0; r.sanity = 20; r.aw = 100; const ok = HUM.drink(false); return { ok, sanity: r.sanity }; });
  check('drinking restores sanity', drink.ok && drink.sanity === 50, drink);

  console.log('Anomalies');
  const an = await ev(() => {
    const r = HUM.S.run; r.rooms = Math.max(r.rooms, 50); r.sanity = 90; r.attention = 0;
    HUM.spawnAnomaly();
    const e0 = HUM.S.echoes;
    HUM.rt.anomaly.type = 'door'; HUM.rt.anomaly.phantom = false;
    HUM.documentAnomaly();
    const real = HUM.S.echoes - e0;
    HUM.spawnAnomaly(); HUM.rt.anomaly.phantom = true; HUM.rt.anomaly.type = 'door';
    const e1 = HUM.S.echoes; HUM.documentAnomaly();
    const phantom = HUM.S.echoes - e1;
    HUM.S.research.autodoc = true;
    HUM.spawnAnomaly(); HUM.rt.anomaly.type = 'door'; HUM.rt.anomaly.phantom = false; HUM.rt.anomaly.expiresAt = HUM.S.time;
    const e2 = HUM.S.echoes; HUM.step(0.1, false);
    return { real, phantom, auto: HUM.S.echoes - e2, cleared: HUM.rt.anomaly === null };
  });
  check('documenting an anomaly yields Echoes', an.real > 0, an);
  check('hallucinated anomalies give nothing', an.phantom === 0, an);
  check('automated documentation pays half on expiry', an.auto > 0 && an.cleared, an);

  console.log('Levels, completion and noclip');
  const lv = await ev(() => {
    const r = HUM.S.run; r.level = 0; r.levelRooms = 0;
    const need = HUM.exitRooms(0);
    for (let i = 0; i < 20; i++) HUM.step(0.1, false);
    r.levelRooms = need - 0.5;
    HUM.rt.lastSurveyReal = -1e9; HUM.survey();
    return { level: r.level, levelRooms: r.levelRooms };
  });
  check('mapping the exit rooms moves to the next level, carrying the extra rooms', lv.level === 1 && lv.levelRooms > 0 && lv.levelRooms < 10, lv);
  await ev(() => { const r = HUM.S.run; r.level = 3; r.stats.salvage = 5e10; r.stats.time = 1800; HUM.S.life.maxLevel = 3; HUM.rt.structureDirty = true; });
  await page.waitForTimeout(300);
  await page.click('#tab-noclip');
  await page.waitForTimeout(200);
  const lockedNoclip = await ev(() => { const b = document.querySelector('#panel-noclip [data-action="noclip"]'); return { can: HUM.canNoclip(), preview: HUM.dvPreview(), button: b ? b.disabled : 'none' }; });
  check('noclip is locked before the survey is complete, even with Déjà Vu waiting', !lockedNoclip.can && lockedNoclip.preview > 0 && lockedNoclip.button !== false, lockedNoclip);
  await ev(() => { const r = HUM.S.run; r.level = 5; HUM.completeFiniteSurvey(); HUM.rt.structureDirty = true; });
  await page.waitForTimeout(300);
  const done = await ev(() => ({ level: HUM.S.run.level, exitFound: HUM.S.run.exitFound, noclips: HUM.S.life.noclips }));
  check('completing the survey opens noclip and enters Level FUN without counting a noclip', done.level === 6 && done.exitFound && done.noclips === 0, done);
  const preview = await ev(() => HUM.dvPreview());
  await page.click('[data-action="noclip"]');
  await page.waitForTimeout(150);
  check('noclip asks for confirmation', await page.isVisible('.modal'));
  await page.click('.modal .btn.primary');
  await page.waitForTimeout(300);
  const post = await ev(() => ({ iter: HUM.S.iteration, dv: HUM.S.dv, level: HUM.S.run.level, salvage: HUM.S.run.salvage, research: Object.keys(HUM.S.research).length, specs: Object.keys(HUM.S.run.specialists).length, noclips: HUM.S.life.noclips }));
  check('noclip resets the run, counts one noclip and grants Déjà Vu', post.iter === 2 && post.dv === preview && post.level === 0 && post.salvage === 0 && post.specs === 0 && post.noclips === 1, post);
  check('research survives noclip', post.research > 0, post);
  const mem = await ev(() => { const ok = HUM.buyMemory('muscle'); return { ok, dv: HUM.S.dv, rank: HUM.S.memories.muscle, again: HUM.buyMemory('muscle') }; });
  check('memories cost Déjà Vu once', mem.ok && mem.rank === 1 && mem.again === false && mem.dv === preview - 1, mem);

  console.log('Saving, loading and time away');
  await ev(() => { const r = HUM.S.run; r.facilities.cart = 30; r.salvage = 123; r.specialists = { scavenge: 2 }; HUM.rt.saveBlocked = false; HUM.save(); HUM.rt.saveBlocked = true; });
  const saved = await ev(() => JSON.parse(localStorage.getItem('the-hum.save')));
  check('save is versioned JSON (format 2)', saved.v === 2 && saved.run.facilities.cart === 30 && saved.run.specialists.scavenge === 2, { v: saved.v });
  await ev(() => { HUM.rt.saveBlocked = true; const s = JSON.parse(localStorage.getItem('the-hum.save')); s.lastSaved = Date.now() - 2 * 3600 * 1000; localStorage.setItem('the-hum.save', JSON.stringify(s)); });
  await page.reload();
  await page.waitForTimeout(500);
  const off = await ev(() => ({ salvage: HUM.S.run.salvage, offline: HUM.S.life.offlineTime, modal: !!document.querySelector('.modal'), title: document.querySelector('.modal h2') && document.querySelector('.modal h2').textContent }));
  check('two hours away credits the Scavenger’s salvage', off.salvage > 1000 && off.offline >= 7100, off);
  check('a report is shown after time away', off.modal && /away/i.test(off.title || ''), off);
  await page.click('.modal .btn.primary');
  await ev(() => { HUM.rt.saveBlocked = true; const s = JSON.parse(localStorage.getItem('the-hum.save')); s.lastSaved = Date.now() - 30 * 24 * 3600 * 1000; localStorage.setItem('the-hum.save', JSON.stringify(s)); });
  await page.reload();
  await page.waitForTimeout(500);
  const capped = await ev(() => ({ text: document.querySelector('.modal') && document.querySelector('.modal').textContent }));
  check('time away is capped and the cap is stated', /Only the first 8h/.test(capped.text || ''), capped.text && capped.text.slice(0, 200));
  await page.click('.modal .btn.primary');
  const neg = await ev(() => { HUM.rt.saveBlocked = true; const s = JSON.parse(localStorage.getItem('the-hum.save')); s.lastSaved = Date.now() + 3600 * 1000; localStorage.setItem('the-hum.save', JSON.stringify(s)); return true; });
  await page.reload();
  await page.waitForTimeout(400);
  check('a save from the future does not break loading', neg && await ev(() => HUM.S.run.facilities.cart === 30 && !document.querySelector('.modal')));

  console.log('Corrupted and hostile saves');
  await ev(() => { HUM.rt.saveBlocked = true; localStorage.setItem('the-hum.save.backup', localStorage.getItem('the-hum.save')); localStorage.setItem('the-hum.save', '{not json'); });
  await page.reload();
  await page.waitForTimeout(400);
  const cor = await ev(() => ({ carts: HUM.S.run.facilities.cart, title: document.querySelector('.modal h2') && document.querySelector('.modal h2').textContent, kept: Object.keys(localStorage).some((k) => k.startsWith('the-hum.save.unreadable-')) }));
  check('a corrupted save falls back to the backup', cor.carts === 30 && /backup/i.test(cor.title || ''), cor);
  check('the corrupted save is kept, not deleted', cor.kept, cor);
  await page.click('.modal .btn.primary');
  const hostile = await ev(() => {
    const st = HUM.sanitizeState({ v: 2, run: { salvage: -5, aw: 'lots', sanity: 900, level: 99, facilities: { cart: 1e99, nope: 4 }, specialists: { scavenge: 1e9, chart: -3, nobody: 5 }, crew: { total: 2 }, upgrades: { flashlight: true, hacked: true } }, echoes: Infinity, log: [{ text: '<img src=x onerror=alert(1)>', type: 'evil' }] });
    return { salvage: st.run.salvage, aw: st.run.aw, sanity: st.run.sanity, level: st.run.level, exitFound: st.run.exitFound, cart: st.run.facilities.cart, nope: st.run.facilities.nope,
      specs: st.run.specialists, crew: 'crew' in st.run, hacked: st.run.upgrades.hacked, echoes: st.echoes, logType: st.log[0].type };
  });
  check('hostile save values are clamped and unknown ids dropped', hostile.salvage === 0 && hostile.aw === 0 && hostile.sanity === 100 && hostile.level === 6 && hostile.exitFound === true && hostile.cart === 1e6 && hostile.nope === undefined
    && JSON.stringify(hostile.specs) === '{"scavenge":60}' && !hostile.crew && hostile.hacked === undefined && hostile.echoes === 0 && hostile.logType === 'info', hostile);
  let newer;
  try { newer = await ev(() => { try { HUM.sanitizeState({ v: 99 }); return 'accepted'; } catch (e) { return e.message; } }); } catch (e) { newer = String(e); }
  check('a save from a newer version is refused with a reason', /newer version/.test(newer), newer);
  const logHtml = await ev(() => { HUM.S.log.unshift({ t: 0, text: '<b id="inj">x</b>', type: 'info', tag: '' }); HUM.rt.logDirty = true; HUM.UI.update(); return !!document.getElementById('inj'); });
  check('log text is never parsed as HTML', logHtml === false);

  console.log('Export and import');
  const code = await ev(() => HUM.encodeSave());
  check('export produces a prefixed string', code.startsWith('HUM1.'));
  const round = await ev((c) => { const st = HUM.decodeSave(c); return { carts: st.run.facilities.cart, iter: st.iteration, v: st.v }; }, code);
  check('export decodes back to the same state', round.carts === 30 && round.iter === 2 && round.v === 2, round);
  let bad;
  bad = await ev(() => { try { HUM.decodeSave('HUM1.@@@'); return 'accepted'; } catch (e) { return e.message; } });
  check('damaged import text is rejected with a message', /damaged/.test(bad), bad);
  await page.click('#tab-settings');
  await page.fill('#saveBox', code);
  await ev(() => { HUM.S.run.facilities.cart = 1; });
  await page.click('[data-action="import"]');
  await page.waitForTimeout(150);
  await page.click('.modal .btn.primary');
  await page.waitForTimeout(150);
  check('importing through the settings tab restores the save', await ev(() => HUM.S.run.facilities.cart === 30));

  console.log('Reset');
  await page.click('[data-action="reset"]');
  await page.waitForTimeout(100);
  await page.click('.modal .btn.primary');
  check('the safe default button keeps the save', await ev(() => HUM.S.run.facilities.cart === 30));
  await page.click('[data-action="reset"]');
  await page.waitForTimeout(100);
  await page.click('.modal .btn.danger');
  await page.waitForTimeout(200);
  check('erasing starts a new game', await ev(() => HUM.S.iteration === 1 && !HUM.S.run.facilities.cart && HUM.S.dv === 0));
  await page.reload();
  await page.waitForTimeout(300);
  check('erasure survives a reload', await ev(() => HUM.S.iteration === 1 && !HUM.S.run.facilities.cart));

  console.log('Keyboard');
  await page.click('body', { position: { x: 5, y: 5 } }).catch(() => {});
  await page.keyboard.press('s');
  await page.waitForTimeout(80);
  check('S surveys', await ev(() => HUM.S.run.rooms >= 1));
  await page.keyboard.press('8');
  check('number keys switch tabs', await ev(() => HUM.rt.tab === 'settings'));
  await page.keyboard.press('m');
  check('M toggles mute', await ev(() => HUM.S.settings.muted === true));

  console.log('Long session');
  const long = await ev(() => {
    HUM.S.run.specialists = { scavenge: 5, chart: 3, dowse: 2 };
    const t0 = performance.now();
    const rep = HUM.catchUp(24 * 3600);
    return { ms: performance.now() - t0, applied: rep.applied, finite: Number.isFinite(HUM.S.run.salvage) && Number.isFinite(HUM.S.echoes) && Number.isFinite(HUM.S.run.rooms) };
  });
  check('a day of catch-up is bounded and fast', long.ms < 2000 && long.finite && long.applied === 8 * 3600, long);

  check('no console or page errors', errors.length === 0, errors.slice(0, 5));
  console.log(`\n${passes} passed, ${failures} failed`);
  await browser.close();
  process.exit(failures ? 1 : 0);
})();
