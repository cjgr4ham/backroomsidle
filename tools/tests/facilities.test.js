// Facilities: level waves, tiers on facility rows, and stable rows while you survey.
const { open, Checker } = require('./harness');

(async () => {
  const c = new Checker('Facilities: waves, tiers and stable rows');
  const g = await open('');
  const { ev, page } = g;

  // Content: every finite level opens a wave, each with a salvage facility; nothing else gates a facility.
  const content = await ev(() => {
    const H = HUM;
    const waves = {};
    for (const f of H.FACILITIES) (waves[f.level] = waves[f.level] || []).push(f.id);
    return { waves, salvageEach: [0, 1, 2, 3, 4, 5].map((l) => H.FACILITIES.some((f) => f.level === l && f.kind === 'salvage')),
      reqs: H.FACILITIES.filter((f) => f.req).map((f) => f.id), final: H.FINAL_LEVEL };
  });
  c.check('facilities are grouped in waves by level, Levels 0 to 5', Object.keys(content.waves).map(Number).every((l) => l >= 0 && l <= content.final) && Object.keys(content.waves).length === 6, content.waves);
  c.check('every wave includes a new salvage facility', content.salvageEach.every(Boolean), content.salvageEach);
  c.check('no facility has a requirement within its level (counts, rooms or flags)', content.reqs.length === 0, content.reqs);

  // Visibility follows the level only, and a facility can be bought with no other facility owned.
  const vis = await ev(() => {
    const H = HUM;
    H.replaceState(H.sanitizeState({ v: 2 }));
    H.rt.saveBlocked = true;
    const out = {};
    for (let l = 0; l <= 6; l++) {
      H.S.run.level = l;
      out[l] = H.FACILITIES.filter(H.facVisible).map((f) => f.id);
    }
    H.S.run.level = 0;
    H.S.run.salvage = 200; H.setBuyMode(1);
    const bench = H.buyFacility('bench');
    H.S.run.level = 3; H.S.run.salvage = 3e6;
    const boiler = H.buyFacility('boiler');
    return { out, bench, boiler, owned: { ...H.S.run.facilities } };
  });
  const expectAt = (l) => Object.entries(content.waves).filter(([lv]) => Number(lv) <= l).flatMap(([, ids]) => ids).sort().join();
  c.check('at each level exactly the waves up to that level are open', [0, 1, 2, 3, 4, 5].every((l) => vis.out[l].slice().sort().join() === expectAt(l)), vis.out);
  c.check('Level FUN keeps every wave open', vis.out[6].length === 11, vis.out[6]);
  c.check('a wave facility can be bought at once, with nothing else owned', vis.bench && vis.boiler && vis.owned.bench === 1 && vis.owned.boiler === 1 && !vis.owned.cart, vis);

  // The panel: open waves as rows, the coming waves with their level and what each facility will do.
  await ev(() => {
    const H = HUM;
    H.replaceState(H.sanitizeState({ v: 2 }));
    H.rt.saveBlocked = true;
    H.S.run.nextEncounterAt = 1e12;
    H.UI.selectTab('facilities'); H.rt.structureDirty = true; H.UI.update(true);
  });
  const p0 = await ev(() => ({
    rows: [...document.querySelectorAll('#panel-facilities .row[data-fac]')].map((r) => r.dataset.fac),
    waves: [...document.querySelectorAll('#panel-facilities .fs-wave')].map((w) => ({ head: w.querySelector('h4').textContent, items: [...w.querySelectorAll('li')].map((li) => li.dataset.id), what: w.querySelector('.fs-what').textContent, next: w.classList.contains('next') })),
  }));
  c.check('a fresh game lists the Level 0 wave as rows', p0.rows.slice().sort().join() === content.waves[0].slice().sort().join(), p0.rows);
  c.check('the next wave is shown with its level and its facilities', p0.waves.length === 5 && p0.waves[0].next && /^Next wave: Level 1: The Annex$/.test(p0.waves[0].head) && p0.waves[0].items.slice().sort().join() === content.waves[1].slice().sort().join(), p0.waves[0]);
  c.check('later waves are listed by level, in order', p0.waves.slice(1).every((w, i) => w.head === `Later wave: Level ${i + 2}: ${['The Ducts', 'The Poolrooms', 'The Night Office', 'The Long Hallway'][i]}`), p0.waves.map((w) => w.head));
  c.check('a coming facility says what it will do and what the first one costs', /to the facility multiplier each · first one [\d,.]+[A-Za-z]* salvage$|· first one [\d,.]+[A-Za-z]* salvage$/.test(p0.waves[0].what), p0.waves[0].what);
  await ev(() => { HUM.addRooms(HUM.exitRooms(0)); HUM.UI.update(true); });
  await page.waitForTimeout(100);
  const p1 = await ev(() => ({ level: HUM.S.run.level, rows: [...document.querySelectorAll('#panel-facilities .row[data-fac]')].map((r) => r.dataset.fac),
    next: document.querySelector('#panel-facilities .fs-wave.next h4').textContent }));
  c.check('reaching Level 1 opens its whole wave in the panel at once', p1.level === 1 && content.waves[1].every((id) => p1.rows.includes(id)), p1);
  c.check('the next wave then moves on to Level 2', p1.next === 'Next wave: Level 2: The Ducts', p1.next);
  await ev(() => { const H = HUM; H.S.run.level = H.FUN_LEVEL; H.S.run.exitFound = true; H.rt.structureDirty = true; H.UI.update(true); });
  const pf = await ev(() => ({ rows: document.querySelectorAll('#panel-facilities .row[data-fac]').length, waves: document.querySelectorAll('#panel-facilities .fs-wave').length }));
  c.check('in Level FUN every facility is listed and no wave is still to come', pf.rows === 11 && pf.waves === 0, pf);

  // Tiers live on the facility row: locked, ready, installed.
  await ev(() => {
    const H = HUM;
    H.replaceState(H.sanitizeState({ v: 2 }));
    H.rt.saveBlocked = true;
    const r = H.S.run;
    r.rooms = 100; r.salvage = 0; r.facilities = { cart: 8 }; r.nextEncounterAt = 1e12;
    for (const a of H.ACHIEVEMENTS) H.S.achievements[a.id] = true;
    H.UI.selectTab('facilities'); H.rt.structureDirty = true; H.UI.update(true);
  });
  const tier = await ev(() => {
    const H = HUM, f = H.FAC.cart, u = H.UPG.tier_cart_0;
    const line = () => document.querySelector('#panel-facilities .row[data-fac="cart"] .tier-line');
    const locked = { text: line().textContent, hidden: line().querySelector('.tier-btn').hidden, home: H.upgradeHome(u) };
    H.S.run.facilities.cart = 10; H.UI.update();
    const price = Math.ceil(f.cost * Math.pow(f.growth, 10) * H.CONFIG.tierCostMult[0]);
    const ready = { text: line().textContent, hidden: line().querySelector('.tier-btn').hidden, disabled: line().querySelector('.tier-btn').disabled, id: line().querySelector('.tier-btn').dataset.id, price, cost: u.cost.salvage };
    return { locked, ready, name: u.name };
  });
  c.check('tiers belong to their facility row, not the Upgrades tab', tier.locked.home === 'facilities', tier.locked);
  c.check('a locked tier says what it needs', /Tiers 0\/3\. Next: Oiled Wheel, bonus ×2, at 10 owned \(you have 8\)\./.test(tier.locked.text) && tier.locked.hidden, tier.locked);
  c.check('a tier costs its stated multiple of the unit price at its count', tier.ready.cost === tier.ready.price && tier.ready.text.includes(`${tier.ready.price} salvage`), tier.ready);
  c.check('at 10 owned the row offers the tier, disabled until it is affordable', !tier.ready.hidden && tier.ready.disabled && tier.ready.id === 'tier_cart_0', tier.ready);
  const each0 = await ev((price) => { HUM.S.run.salvage = price; HUM.UI.update(); return { each: HUM.derive().fac.cart.each, power: HUM.derive().surveyPower }; }, tier.ready.price);
  await page.click('#panel-facilities .row[data-fac="cart"] .tier-btn');
  await page.waitForTimeout(100);
  const installed = await ev(() => ({ owned: HUM.S.run.upgrades.tier_cart_0 === true, salvage: HUM.S.run.salvage, each: HUM.derive().fac.cart.each, power: HUM.derive().surveyPower, sps: HUM.derive().sps,
    text: document.querySelector('#panel-facilities .row[data-fac="cart"] .tier-line').textContent }));
  c.check('installing a tier charges its price and doubles the facility’s bonus', installed.owned && installed.salvage === 0 && Math.abs(installed.each - 2 * each0.each) < 1e-12, { installed, each0 });
  c.check('the tier raises survey power and still adds nothing passive', installed.power > each0.power && installed.sps === 0, { installed, each0 });
  c.check('the row then shows the installed tier and the next one', /Tiers 1\/3 · bonus ×2\. Next: Second Basket, bonus ×2, at 25 owned/.test(installed.text), installed.text);
  const done = await ev(() => { const r = HUM.S.run; r.upgrades.tier_cart_1 = true; r.upgrades.tier_cart_2 = true; HUM.UI.update(); const l = document.querySelector('#panel-facilities .row[data-fac="cart"] .tier-line'); return { text: l.textContent, hidden: l.querySelector('.tier-btn').hidden }; });
  c.check('with every tier installed the row says so', /Tiers 3\/3 · bonus ×8\. Every tier is installed\./.test(done.text) && done.hidden, done);

  // Rapid surveying in a mid-game operation: rows keep their wording, layout, scroll position and focus.
  await ev(() => {
    const H = HUM;
    H.replaceState(H.sanitizeState({ v: 2 }));
    H.rt.saveBlocked = true;
    const r = H.S.run;
    Object.assign(r, { level: 2, rooms: 9000, salvage: 4e5, aw: 50, attention: 30, nextEncounterAt: 1e12 });
    r.flags.water = true;
    r.facilities = { cart: 22, bench: 14, condenser: 4, beacon: 6, dampener: 2, vat: 6, foundry: 2 };
    r.specialists = { scavenge: 3 };
    H.S.seen.firstSurvey = true;
    H.setBuyMode(1);
    H.UI.selectTab('facilities'); H.rt.structureDirty = true; H.UI.update(true);
    const panel = document.getElementById('panel-facilities');
    window.__log = { rebuilds: 0, texts: {}, heights: [], flavors: [...panel.querySelectorAll('.row .flavor')].map((n) => n.textContent),
      titles: [...panel.querySelectorAll('.row h3')].map((n) => n.textContent) };
    new MutationObserver((ms) => { for (const m of ms) if (m.target === panel && m.type === 'childList') window.__log.rebuilds++; }).observe(panel, { childList: true });
    const key = (n) => { const row = n.closest && n.closest('.row'); const line = n.closest('p, h3, span, button'); return `${row ? row.dataset.fac : 'panel'}:${line ? (line.className || line.tagName) : n.tagName}`; };
    new MutationObserver((ms) => {
      for (const m of ms) {
        const n = m.type === 'characterData' ? m.target.parentElement : m.target;
        if (!n || !n.closest) continue;
        (window.__log.texts[key(n)] = window.__log.texts[key(n)] || []).push((n.closest('p, h3') || n).textContent);
      }
    }).observe(panel, { subtree: true, childList: true, characterData: true });
    const sample = () => { window.__log.heights.push([...panel.querySelectorAll('.row')].map((x) => Math.round(x.getBoundingClientRect().height)).join(',')); window.__raf = requestAnimationFrame(sample); };
    sample();
  });
  // Scroll the page part-way and focus a buy button, as a player about to buy would.
  await ev(() => { document.querySelector('#panel-facilities .row[data-fac="vat"] [data-action="buy-fac"]').focus(); window.scrollTo(0, 200); });
  const before = await ev(() => ({ scroll: window.scrollY, active: document.activeElement && document.activeElement.dataset.id }));
  for (let i = 0; i < 60; i++) { await page.click('#btnSurvey'); await page.waitForTimeout(70); }
  await ev(() => document.querySelector('#panel-facilities .row[data-fac="vat"] [data-action="buy-fac"]').focus());
  for (let i = 0; i < 40; i++) { await page.keyboard.press('s'); await page.waitForTimeout(70); }
  await page.waitForTimeout(250);
  const res = await ev(() => {
    cancelAnimationFrame(window.__raf);
    const L = window.__log, panel = document.getElementById('panel-facilities');
    const shape = (t) => t.replace(/[0-9.,]+[KMBTa-z]{0,2}/g, '#');
    const lines = {};
    for (const [k, list] of Object.entries(L.texts)) {
      const seq = list.filter((t, i) => i === 0 || t !== list[i - 1]);
      let flips = 0;
      for (let i = 2; i < seq.length; i++) if (shape(seq[i]) === shape(seq[i - 2]) && shape(seq[i]) !== shape(seq[i - 1])) flips++;
      lines[k] = { wordings: [...new Set(seq.map(shape))].length, flips };
    }
    const hs = L.heights.filter((h, i) => i === 0 || h !== L.heights[i - 1]);
    return { rebuilds: L.rebuilds, lines, heightChanges: hs.length - 1, heights: hs.slice(0, 3),
      flavorsSame: JSON.stringify([...panel.querySelectorAll('.row .flavor')].map((n) => n.textContent)) === JSON.stringify(L.flavors),
      titlesSame: JSON.stringify([...panel.querySelectorAll('.row h3')].map((n) => n.textContent)) === JSON.stringify(L.titles),
      surveys: HUM.S.run.stats.surveys, scroll: window.scrollY, active: document.activeElement && document.activeElement.dataset.id };
  });
  const flips = Object.entries(res.lines).filter(([, v]) => v.flips > 0);
  const many = Object.entries(res.lines).filter(([, v]) => v.wordings > 1);
  c.check('the run really surveyed many times', res.surveys >= 90, res.surveys);
  c.check('no facility line alternates between wordings while surveying', flips.length === 0, flips);
  c.check('every facility line keeps one wording (only its numbers change)', many.length === 0, many);
  c.check('names and flavor text never change', res.flavorsSame && res.titlesSame, res);
  c.check('the facility panel is never rebuilt while surveying', res.rebuilds === 0, res.rebuilds);
  c.check('row heights never change (no layout jumps)', res.heightChanges === 0, res.heights);
  c.check('the scroll position is kept', before.scroll > 0 && res.scroll === before.scroll, { before, after: res.scroll });
  c.check('keyboard focus stays on the button the player chose', res.active === 'vat' && before.active === 'vat', { before, after: res.active });

  c.finish(g.errors);
  await g.browser.close();
})();
