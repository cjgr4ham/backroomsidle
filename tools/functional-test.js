// Functional tests for The Hum. Drives the real page in headless Chromium.
// Run: node tools/functional-test.js   (needs Playwright with a Chromium build)
const path = require('path');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node22/lib/node_modules/playwright'); }
const URL = 'file://' + path.resolve(__dirname, '..', 'index.html') + '#debug';

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

  console.log('Surveying and purchases');
  for (let i = 0; i < 20; i++) { await page.click('#btnSurvey'); await page.waitForTimeout(65); }
  const afterClicks = await ev(() => ({ rooms: HUM.S.run.rooms, salvage: HUM.S.run.salvage, surveys: HUM.S.run.stats.surveys }));
  check('20 clicks map 20 rooms', afterClicks.rooms === 20, afterClicks);
  check('salvage recovered from surveys', afterClicks.salvage >= 20, afterClicks);
  await ev(() => { HUM.S.run.salvage = 1000; });
  const quote = await ev(() => { HUM.setBuyMode(10); const f = HUM.FACILITIES[0]; return HUM.buyQuote(f); });
  const expected10 = await ev(() => Math.ceil(HUM.facilityCost(HUM.FACILITIES[0], 0, 10)));
  check('x10 quote equals the summed cost of 10', quote.cost === expected10 && quote.n === 10, { quote, expected10 });
  const before = await ev(() => HUM.S.run.salvage);
  await ev(() => HUM.buyFacility('cart'));
  const after = await ev(() => ({ salvage: HUM.S.run.salvage, carts: HUM.S.run.facilities.cart }));
  check('buying x10 charges exactly the quoted price', Math.abs(before - after.salvage - quote.cost) < 1e-6 && after.carts === 10, { before, after, quote });
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

  console.log('Upgrades');
  const upg = await ev(() => { HUM.S.run.salvage = 100; const before = HUM.derive().surveyFlat; const ok = HUM.buyUpgrade('flashlight'); return { ok, before, after: HUM.derive().surveyFlat, salvage: HUM.S.run.salvage, again: HUM.buyUpgrade('flashlight') }; });
  check('flashlight doubles survey salvage, charged once', upg.ok && Math.abs(upg.after / upg.before - 2) < 1e-9 && upg.salvage === 60 && upg.again === false, upg);
  const locked = await ev(() => { HUM.S.run.salvage = 1e9; return HUM.buyUpgrade('boots'); });
  check('cannot buy an upgrade whose requirement is not met', locked === false);

  console.log('Crew and expeditions');
  const crew = await ev(() => {
    HUM.S.run.flags.water = true; HUM.S.run.aw = 1000; HUM.S.run.salvage = 1000;
    HUM.buyUpgrade('radio');
    for (let i = 0; i < 5; i++) HUM.hire();
    HUM.assign('scavenge', 3);
    return { total: HUM.S.run.crew.total, scav: HUM.S.run.crew.jobs.scavenge, idle: HUM.crewIdle(), cantOverAssign: HUM.assign('chart', 10) && HUM.crewIdle() === 0 };
  });
  check('hire and assign keep crew consistent', crew.total === 5 && crew.scav === 3 && crew.idle === 2, crew);
  const exp = await ev(() => {
    const r = HUM.S.run; r.crew.jobs.chart = 0;
    const idleBefore = HUM.crewIdle();
    const ok = HUM.launchExpedition('stairwell');
    const busy = HUM.crewIdle();
    const salvageBefore = r.salvage;
    HUM.S.run.expeditions.stairwell.hazard = 1;   // force the hazard roll for the test
    for (let i = 0; i < 1300; i++) HUM.step(0.1, false);
    return { ok, idleBefore, busy, done: !r.expeditions.stairwell, gained: r.salvage > salvageBefore, missing: r.crew.missing.length, total: r.crew.total };
  });
  check('expedition takes idle crew and completes', exp.ok && exp.busy === exp.idleBefore - 1 && exp.done && exp.gained, exp);
  check('hazard sends one wanderer missing without deleting them', exp.missing === 1 && exp.total === 5, exp);
  const back = await ev(() => { HUM.step(1900, true); return { missing: HUM.S.run.crew.missing.length, total: HUM.S.run.crew.total }; });
  check('missing wanderers come back', back.missing === 0 && back.total === 5, back);

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
    const r = HUM.S.run; r.attention = 95; r.incidentGraceUntil = 0; r.pendingIncident = null;
    const results = {};
    for (const type of ['breach', 'taken', 'raid', 'shock']) {
      r.pendingIncident = null; r.incidentGraceUntil = 0;
      HUM.scheduleIncident();
      r.pendingIncident.type = type;
      if (type === 'breach') r.pendingIncident.target = 'boiler';
      if (type === 'raid') { HUM.S.saved = r.facilities; r.facilities = {}; r.disabled = {}; for (const j in r.crew.jobs) r.crew.jobs[j] = 0; }
      const snap = { salvage: r.salvage = 10000, sanity: r.sanity = 90, missing: r.crew.missing.length, total: r.crew.total };
      const at = r.pendingIncident.at;
      while (HUM.S.time < at + 0.05) HUM.step(0.1, false);
      if (type === 'raid') { r.facilities = HUM.S.saved; delete HUM.S.saved; }
      results[type] = { disabled: !!r.disabled.boiler, salvage: r.salvage, sanity: r.sanity, missing: r.crew.missing.length - snap.missing, total: r.crew.total, pending: !!r.pendingIncident };
    }
    return results;
  });
  check('breach takes a facility offline', inc.breach.disabled, inc.breach);
  check('taken moves a wanderer to missing, total unchanged', inc.taken.missing === 1 && inc.taken.total === 5, inc.taken);
  check('raid takes 8% of stockpiled salvage', Math.abs(inc.raid.salvage - 9200) < 5, inc.raid);
  check('shock costs sanity', inc.shock.sanity < 90, inc.shock);
  const avert = await ev(() => {
    const r = HUM.S.run; r.lightsReadyAt = 0; r.lightsUntil = 0; r.incidentGraceUntil = 0; r.attention = 95;
    HUM.scheduleIncident();
    const ok = HUM.killLights();
    const D = HUM.derive();
    return { ok, pending: r.pendingIncident, averted: r.stats.averted, sps: D.sps, attention: r.attention };
  });
  check('kill the lights averts the incident and halts production', avert.ok && avert.pending === null && avert.averted >= 1 && avert.sps === 0 && avert.attention <= 50, avert);
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

  console.log('Levels and noclip');
  const lv = await ev(() => {
    const r = HUM.S.run; r.level = 0; r.levelRooms = 0;
    const need = HUM.exitRooms(0);
    for (let i = 0; i < 20; i++) HUM.step(0.1, false);
    r.levelRooms = need - 0.5;
    HUM.rt.lastSurveyReal = -1e9; HUM.survey();
    return { level: r.level, levelRooms: r.levelRooms };
  });
  check('mapping the exit rooms moves to the next level', lv.level === 1 && lv.levelRooms === 0, lv);
  await ev(() => { const r = HUM.S.run; r.level = 3; r.stats.salvage = 5e8; HUM.S.life.maxLevel = 3; HUM.rt.structureDirty = true; });
  await page.waitForTimeout(300);
  await page.click('#tab-noclip');
  await page.waitForTimeout(200);
  const preview = await ev(() => HUM.dvPreview());
  check('Déjà Vu preview is positive at level 3', preview > 0, preview);
  await page.click('[data-action="noclip"]');
  await page.waitForTimeout(150);
  check('noclip asks for confirmation', await page.isVisible('.modal'));
  await page.click('.modal .btn.primary');
  await page.waitForTimeout(300);
  const post = await ev(() => ({ iter: HUM.S.iteration, dv: HUM.S.dv, level: HUM.S.run.level, salvage: HUM.S.run.salvage, research: Object.keys(HUM.S.research).length, crew: HUM.S.run.crew.total }));
  check('noclip resets the run and grants Déjà Vu', post.iter === 2 && post.dv === preview && post.level === 0 && post.salvage === 0 && post.crew === 0, post);
  check('research survives noclip', post.research > 0, post);
  const mem = await ev(() => { const ok = HUM.buyMemory('muscle'); return { ok, dv: HUM.S.dv, rank: HUM.S.memories.muscle, again: HUM.buyMemory('muscle') }; });
  check('memories cost Déjà Vu once', mem.ok && mem.rank === 1 && mem.again === false && mem.dv === preview - 1, mem);

  console.log('Saving, loading and offline progress');
  await ev(() => { HUM.S.run.facilities.cart = 30; HUM.S.run.salvage = 123; HUM.save(); });
  const saved = await ev(() => JSON.parse(localStorage.getItem('the-hum.save')));
  check('save is versioned JSON', saved.v === 1 && saved.run.facilities.cart === 30);
  await ev(() => { HUM.rt.saveBlocked = true; const s = JSON.parse(localStorage.getItem('the-hum.save')); s.lastSaved = Date.now() - 2 * 3600 * 1000; localStorage.setItem('the-hum.save', JSON.stringify(s)); });
  await page.reload();
  await page.waitForTimeout(500);
  const off = await ev(() => ({ salvage: HUM.S.run.salvage, offline: HUM.S.life.offlineTime, modal: !!document.querySelector('.modal'), title: document.querySelector('.modal h2') && document.querySelector('.modal h2').textContent }));
  check('two hours away credits offline production', off.salvage > 1000 && off.offline >= 7100, off);
  check('a report is shown after time away', off.modal && /away/i.test(off.title || ''), off);
  await page.click('.modal .btn.primary');
  await ev(() => { HUM.rt.saveBlocked = true; const s = JSON.parse(localStorage.getItem('the-hum.save')); s.lastSaved = Date.now() - 30 * 24 * 3600 * 1000; localStorage.setItem('the-hum.save', JSON.stringify(s)); });
  await page.reload();
  await page.waitForTimeout(500);
  const capped = await ev(() => ({ text: document.querySelector('.modal') && document.querySelector('.modal').textContent }));
  check('offline credit is capped and the cap is stated', /Only the first 8h/.test(capped.text || ''), capped.text && capped.text.slice(0, 200));
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
    const st = HUM.sanitizeState({ v: 1, run: { salvage: -5, aw: 'lots', sanity: 900, level: 99, facilities: { cart: 1e99, nope: 4 }, crew: { total: 2, jobs: { scavenge: 50 } }, upgrades: { flashlight: true, hacked: true } }, echoes: Infinity, log: [{ text: '<img src=x onerror=alert(1)>', type: 'evil' }] });
    return { salvage: st.run.salvage, aw: st.run.aw, sanity: st.run.sanity, level: st.run.level, cart: st.run.facilities.cart, nope: st.run.facilities.nope, scav: st.run.crew.jobs.scavenge, hacked: st.run.upgrades.hacked, echoes: st.echoes, logType: st.log[0].type };
  });
  check('hostile save values are clamped and unknown ids dropped', hostile.salvage === 0 && hostile.aw === 0 && hostile.sanity === 100 && hostile.level === 5 && hostile.cart === 1e6 && hostile.nope === undefined && hostile.scav === 0 && hostile.hacked === undefined && hostile.echoes === 0 && hostile.logType === 'info', hostile);
  let newer;
  try { newer = await ev(() => { try { HUM.sanitizeState({ v: 99 }); return 'accepted'; } catch (e) { return e.message; } }); } catch (e) { newer = String(e); }
  check('a save from a newer version is refused with a reason', /newer version/.test(newer), newer);
  const logHtml = await ev(() => { HUM.S.log.unshift({ t: 0, text: '<b id="inj">x</b>', type: 'info', tag: '' }); HUM.rt.logDirty = true; HUM.UI.update(); return !!document.getElementById('inj'); });
  check('log text is never parsed as HTML', logHtml === false);

  console.log('Export and import');
  const code = await ev(() => HUM.encodeSave());
  check('export produces a prefixed string', code.startsWith('HUM1.'));
  const round = await ev((c) => { const st = HUM.decodeSave(c); return { carts: st.run.facilities.cart, iter: st.iteration }; }, code);
  check('export decodes back to the same state', round.carts === 30 && round.iter === 2, round);
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
    const t0 = performance.now();
    const rep = HUM.catchUp(24 * 3600);
    return { ms: performance.now() - t0, applied: rep.applied, finite: Number.isFinite(HUM.S.run.salvage) && Number.isFinite(HUM.S.echoes) };
  });
  check('a day of catch-up is bounded and fast', long.ms < 2000 && long.finite, long);

  check('no console or page errors', errors.length === 0, errors.slice(0, 5));
  console.log(`\n${passes} passed, ${failures} failed`);
  await browser.close();
  process.exit(failures ? 1 : 0);
})();
