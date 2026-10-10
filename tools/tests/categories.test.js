// EXP-UPGRADE-CATEGORIES: the Upgrades tab grouped by what each requisition does. Crew requisitions are listed in the
// Crew tab and facility tiers on their facility's row, so the Upgrades tab points there instead of listing them.
const { open, Checker } = require('./harness');

const ID = 'EXP-UPGRADE-CATEGORIES';
// Headings, in the order the tab shows them.
const LABEL = { Survey: 'Survey', Facility: 'Facilities', Crew: 'Crew', Sanity: 'Sanity', Risk: 'Noise & risk', Expedition: 'Missions' };

(async () => {
  const c = new Checker(`${ID}: upgrade categories`);
  const g = await open(`?exp=none,${ID}`);
  const { ev, page } = g;

  await ev(() => {
    const H = HUM; H.rt.saveBlocked = true;
    H.replaceState(H.sanitizeState({ v: 2 }));
    const r = H.S.run;
    r.flags.water = true; r.flags.expedition = true; r.level = 3; r.rooms = 50000; r.salvage = 1e5; r.aw = 50;
    r.facilities = { cart: 30, bench: 30, condenser: 12, beacon: 12, vat: 12, foundry: 6, dampener: 6 };
    r.specialists = { scavenge: 2, chart: 1, dowse: 1 };   // three specialists: crew requisitions open
    H.S.seen.tab_upgrades = true; H.S.seen.tab_crew = true;
    H.UI.selectTab('upgrades');
    H.rt.structureDirty = true; H.UI.update(true);
  });
  await page.waitForTimeout(150);
  const all = await ev(() => {
    const H = HUM;
    H.UI.update();
    const avail = H.UPGRADES.filter(H.upgradeVisible).map((u) => u.id).sort();
    const slips = [...document.querySelectorAll('#panel-upgrades .slip [data-action="buy-upg"]')].map((b) => b.dataset.id);
    const groups = [...document.querySelectorAll('#panel-upgrades .cats-group')].map((s) => ({
      title: s.querySelector('h3').textContent,
      cats: [...s.querySelectorAll('.slip [data-action="buy-upg"]')].map((b) => H.UPG[b.dataset.id].cat),
      sum: (s.querySelector('.cats-sum') || {}).textContent || '',
    }));
    const seg = [...document.querySelectorAll('#panel-upgrades .cats [data-cat]')].map((b) => ({ cat: b.dataset.cat, text: b.textContent }));
    const elsewhere = H.UPGRADES.filter((u) => H.upgradeAvailable(u) && H.upgradeHome(u) !== 'upgrades');
    return {
      avail, slips: slips.slice().sort(), dupes: slips.length - new Set(slips).size, groups, seg,
      elsewhere: elsewhere.map((u) => `${u.id}:${H.upgradeHome(u)}`), listedHere: slips.filter((id) => H.upgradeHome(H.UPG[id]) !== 'upgrades'),
      pointer: (document.querySelector('#panel-upgrades .cats-elsewhere') || {}).textContent || '',
    };
  });
  c.check('every requisition the Upgrades tab lists is shown exactly once', all.avail.length > 0 && JSON.stringify(all.avail) === JSON.stringify(all.slips) && all.dupes === 0,
    { avail: all.avail.length, slips: all.slips.length, dupes: all.dupes });
  c.check('crew requisitions and facility tiers are not listed in the Upgrades tab, which says where they are',
    all.elsewhere.some((x) => x.endsWith(':crew')) && all.elsewhere.some((x) => x.endsWith(':facilities')) && all.listedHere.length === 0
    && /Crew tab/.test(all.pointer) && /row in Facilities/.test(all.pointer), { elsewhere: all.elsewhere, listedHere: all.listedHere, pointer: all.pointer });
  const order = Object.values(LABEL);
  c.check('each upgrade sits under the heading of its own category, in the category order',
    all.groups.length >= 4 && all.groups.every((gr) => gr.cats.length > 0 && gr.cats.every((cat) => LABEL[cat] === gr.title))
    && all.groups.every((gr, i) => i === 0 || order.indexOf(all.groups[i - 1].title) < order.indexOf(gr.title)), all.groups.map((gr) => [gr.title, [...new Set(gr.cats)]]));
  c.check('the category control counts what each category holds', all.seg.length === all.groups.length + 1
    && all.seg.every((s) => s.cat === 'all' ? s.text === `All ${all.avail.length}` : all.groups.some((gr) => gr.title === LABEL[s.cat] && s.text === `${LABEL[s.cat]} ${gr.cats.length}`)), all.seg);

  // Where the others are: crew requisitions in the Crew tab, and each facility's next tier on its row.
  const homes = await ev(() => {
    const H = HUM;
    H.UI.selectTab('crew'); H.UI.update(true);
    const crew = [...document.querySelectorAll('#panel-crew .slip [data-action="buy-upg"]')].map((b) => b.dataset.id).sort();
    const crewWant = H.UPGRADES.filter((u) => H.upgradeAvailable(u) && H.upgradeHome(u) === 'crew').map((u) => u.id).sort();
    H.UI.selectTab('facilities'); H.UI.update(true);
    const rows = H.FACILITIES.filter(H.facVisible).map((f) => {
      const ready = H.UPGRADES.filter((u) => u.fac === f.id && H.upgradeAvailable(u)).sort((a, b) => a.cost.salvage - b.cost.salvage);
      const btn = document.querySelector(`#panel-facilities [data-fac="${f.id}"] .tier-btn`);
      return [f.id, ready.length ? ready[0].id : null, btn && !btn.hidden ? btn.dataset.id : null];
    });
    const facTotal = document.querySelector('#panel-facilities .fs-total').textContent;
    H.UI.selectTab('upgrades'); H.UI.update(true);
    return { crew, crewWant, rows, facTotal };
  });
  c.check('crew requisitions are in the Crew tab, and each facility row offers its next tier',
    homes.crewWant.length > 0 && JSON.stringify(homes.crew) === JSON.stringify(homes.crewWant)
    && homes.rows.some(([, want]) => want) && homes.rows.every(([, want, shown]) => want === shown), homes);

  // Each summary shows the numbers its category changes, as the game works them out now.
  const sums = await ev(() => {
    const H = HUM, r = H.S.run, D = H.derive();
    const byTitle = Object.fromEntries([...document.querySelectorAll('#panel-upgrades .cats-group')].map((s) => [s.querySelector('h3').textContent, (s.querySelector('.cats-sum') || {}).textContent || '']));
    const n = (s, re) => { const m = re.exec(s || ''); return m ? Number(m[1].replace('−', '-')) : NaN; };
    const C = H.CONFIG.sanity;
    const yieldText = document.getElementById('surveyYield').textContent;   // "+411 salvage" and "1.36 rooms"
    const roomsText = /salvage(.+)$/.exec(yieldText)[1];
    const sv = byTitle.Survey, fa = byTitle.Facilities, sa = byTitle.Sanity, ri = byTitle['Noise & risk'], mi = byTitle.Missions;
    return {
      byTitle,
      survey: sv.startsWith(`Survey power ${document.getElementById('spowerVal').textContent.replace(/ per survey$/, '')} · `) && sv.endsWith(` ${roomsText} per survey`),
      facilities: Math.abs(n(fa, /^Facility multiplier ×([\d.]+)/) - D.facMult) < 0.01 && Math.abs(n(fa, /facility bonuses ×([\d.]+)$/) - D.facBoost) < 0.01 && D.facMult > 1,
      sanity: sa.startsWith(`Sanity ${Math.round(r.sanity)} (${D.sanityBand.name}) · `) && Math.abs(n(sa, /· ([+−][\d.]+)\/s/) - D.sanityNet) < 0.0006
        && n(sa, /a drink costs (\d+) water/) === Math.ceil(C.drinkBase + C.drinkPerLevel * r.level) && n(sa, /restores (\d+)$/) === C.drinkRestore,
      risk: Math.abs(n(ri, /^Noise ([\d.]+)/) - D.noise) < 0.0006 && Math.abs(n(ri, /absorption ([\d.]+)/) - D.absorb) < 0.006
        && n(ri, /attention (\d+),/) === Math.round(r.attention) && n(ri, /heading to (\d+)$/) === Math.round(D.attnTarget) && D.noise > 0,
      missions: Object.keys(r.missions).length === 0 && mi === 'No missions out',
    };
  });
  c.check('each category shows a summary of the numbers it changes, matching the game',
    ['survey', 'facilities', 'sanity', 'risk', 'missions'].every((k) => sums[k] === true), sums);

  const state = () => ev(() => JSON.stringify({ u: HUM.S.run.upgrades, f: HUM.S.run.facilities, sp: HUM.S.run.specialists, s: HUM.S.run.salvage > 0 }));
  const before = await state();
  await page.click('#panel-upgrades .cats [data-cat="Survey"]');
  await page.waitForTimeout(150);
  const survey = await ev(() => ({
    titles: [...document.querySelectorAll('#panel-upgrades .cats-group > h3.section-title')].map((h) => h.textContent),
    cats: [...document.querySelectorAll('#panel-upgrades .slip [data-action="buy-upg"]')].map((b) => HUM.UPG[b.dataset.id].cat),
    pressed: document.querySelector('#panel-upgrades .cats [aria-pressed="true"]').dataset.cat,
  }));
  const after = await state();
  c.check('choosing a category shows only that category', survey.titles.join() === 'Survey' && survey.cats.length > 0 && survey.cats.every((x) => x === 'Survey') && survey.pressed === 'Survey', survey);
  c.check('moving between categories does not change the game', after === before, { before, after });

  const bought = await ev(() => {
    const H = HUM, u = H.UPG.flashlight;
    const btn = document.querySelector('#panel-upgrades .slip [data-action="buy-upg"][data-id="flashlight"]');
    const price = btn.querySelectorAll('.sub')[0].textContent;
    const mult = Number(/×([\d.]+)/.exec(u.effect)[1]);   // what the slip says it does
    const p0 = H.derive().surveyPower;
    const s0 = H.S.run.salvage;
    btn.click();
    H.UI.update();
    return { owned: H.S.run.upgrades.flashlight === true, spent: s0 - H.S.run.salvage, price, mult, p0, p1: H.derive().surveyPower,
      sum: document.querySelector('#panel-upgrades .cats-sum').textContent, power: document.getElementById('spowerVal').textContent.replace(/ per survey$/, ''),
      still: document.querySelector('#panel-upgrades .cats [aria-pressed="true"]').dataset.cat,
      listed: !!document.querySelector('#panel-upgrades .slip [data-id="flashlight"]') };
  });
  c.check('buying from a category applies the upgrade, charged once at the price shown',
    bought.owned && bought.spent > 0 && bought.price === `${bought.spent} salvage` && bought.mult > 1 && Math.abs(bought.p1 - bought.mult * bought.p0) < 1e-9 * bought.p1, bought);
  c.check('the category stays selected and its summary updates at once',
    bought.still === 'Survey' && !bought.listed && bought.sum.startsWith(`Survey power ${bought.power} · `) && bought.p1 > bought.p0, bought);

  await page.click('#panel-upgrades .cats [data-cat="all"]');
  await page.waitForTimeout(100);
  const allAgain = await ev(() => [...document.querySelectorAll('#panel-upgrades .cats-group > h3')].map((h) => h.textContent));
  c.check('All shows every category again', allAgain.join() === all.groups.map((gr) => gr.title).join(), { allAgain, before: all.groups.map((gr) => gr.title) });

  // Narrow screens.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(200);
  const narrow = await ev(() => ({ overflow: document.documentElement.scrollWidth > window.innerWidth + 1, seg: document.querySelector('#panel-upgrades .cats').getBoundingClientRect().right <= window.innerWidth + 1 }));
  c.check('readable at phone width: no sideways scrolling', !narrow.overflow && narrow.seg, narrow);
  await page.setViewportSize({ width: 1366, height: 860 });

  // Switched off: the original layout.
  const off = await ev(() => {
    const H = HUM;
    H.Exp.set('EXP-UPGRADE-CATEGORIES', false);
    H.rt.structureDirty = true; H.UI.update(true);
    const ids = [...document.querySelectorAll('#panel-upgrades .slip [data-action="buy-upg"]')].map((b) => b.dataset.id);
    const expected = H.UPGRADES.filter(H.upgradeVisible).sort((a, b) => {
      const ca = a.cost.aw != null ? 'aw' : 'salvage', cb = b.cost.aw != null ? 'aw' : 'salvage';
      if (ca !== cb) return ca === 'salvage' ? -1 : 1;
      return (a.cost.aw != null ? a.cost.aw : a.cost.salvage) - (b.cost.aw != null ? b.cost.aw : b.cost.salvage);
    }).map((u) => u.id);
    const res = { seg: !!document.querySelector('#panel-upgrades .cats'), same: ids.length > 0 && JSON.stringify(ids) === JSON.stringify(expected), sub: document.querySelector('#panel-upgrades .panel-sub').textContent };
    H.Exp.reset();
    return res;
  });
  c.check('switched off, the Upgrades tab returns to its original single list, which still says where crew requisitions and tiers are',
    !off.seg && off.same && /^One-off requisitions\. Most cost/.test(off.sub) && /Crew requisitions are in the Crew tab/.test(off.sub) && /facility tiers on each facility’s row/.test(off.sub), off);

  c.finish(g.errors);
  await g.browser.close();
})();
