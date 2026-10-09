// EXP-UPGRADE-CATEGORIES: the Upgrades tab grouped by what each requisition does.
const { open, Checker } = require('./harness');

const ID = 'EXP-UPGRADE-CATEGORIES';
const LABEL = { Survey: 'Survey', Facility: 'Machines', Crew: 'Crew', Sanity: 'Sanity', Risk: 'Noise & risk', Expedition: 'Expeditions' };

(async () => {
  const c = new Checker(`${ID}: upgrade categories`);
  const g = await open(`?exp=none,${ID}`);
  const { ev, page } = g;

  const setup = () => ev(() => {
    const H = HUM; H.rt.saveBlocked = true;
    H.replaceState(H.sanitizeState({ v: 1 }));
    const r = H.S.run;
    r.flags.water = true; r.flags.expedition = true; r.level = 3; r.rooms = 50000; r.salvage = 1e5; r.aw = 50;
    r.facilities = { cart: 30, bench: 30, condenser: 12, beacon: 12, vat: 12, foundry: 6, dampener: 6 };
    r.crew.total = 12;
    H.S.seen.tab_upgrades = true;
    H.UI.selectTab('upgrades');
    H.rt.structureDirty = true; H.UI.update(true);
  });
  await setup();
  await page.waitForTimeout(150);
  const all = await ev(() => {
    const H = HUM;
    const avail = H.UPGRADES.filter(H.upgradeVisible).map((u) => u.id).sort();
    const slips = [...document.querySelectorAll('#panel-upgrades .slip [data-action="buy-upg"]')].map((b) => b.dataset.id);
    const groups = [...document.querySelectorAll('#panel-upgrades .cats-group')].map((s) => ({
      title: s.querySelector('h3').textContent,
      cats: [...s.querySelectorAll('.slip [data-action="buy-upg"]')].map((b) => H.UPG[b.dataset.id].cat),
      sum: (s.querySelector('.cats-sum') || {}).textContent || '',
    }));
    const seg = [...document.querySelectorAll('#panel-upgrades .cats [data-cat]')].map((b) => ({ cat: b.dataset.cat, text: b.textContent }));
    return { avail, slips: slips.slice().sort(), dupes: slips.length - new Set(slips).size, groups, seg };
  });
  c.check('every available upgrade is listed exactly once', JSON.stringify(all.avail) === JSON.stringify(all.slips) && all.dupes === 0, { avail: all.avail.length, slips: all.slips.length, dupes: all.dupes });
  c.check('each upgrade sits under the heading of its own category', all.groups.length >= 4 && all.groups.every((gr) => gr.cats.every((cat) => LABEL[cat] === gr.title)), all.groups.map((gr) => [gr.title, [...new Set(gr.cats)]]));
  c.check('the category control counts what each category holds', all.seg.every((s) => s.cat === 'all' ? s.text === `All ${all.avail.length}` : all.groups.some((gr) => gr.title === LABEL[s.cat] && s.text === `${LABEL[s.cat]} ${gr.cats.length}`)), all.seg);
  c.check('each category shows a summary of the numbers it changes', all.groups.every((gr) => gr.sum.length > 10), all.groups.map((gr) => gr.sum));

  const before = await ev(() => JSON.stringify({ u: HUM.S.run.upgrades, f: HUM.S.run.facilities, s: HUM.S.run.salvage > 0 }));
  await page.click('#panel-upgrades .cats [data-cat="Survey"]');
  await page.waitForTimeout(150);
  const survey = await ev(() => ({
    titles: [...document.querySelectorAll('#panel-upgrades .cats-group > h3.section-title')].map((h) => h.textContent),
    cats: [...document.querySelectorAll('#panel-upgrades .slip [data-action="buy-upg"]')].map((b) => HUM.UPG[b.dataset.id].cat),
    pressed: document.querySelector('#panel-upgrades .cats [aria-pressed="true"]').dataset.cat,
    state: JSON.stringify({ u: HUM.S.run.upgrades, f: HUM.S.run.facilities, s: HUM.S.run.salvage > 0 }),
  }));
  c.check('choosing a category shows only that category', survey.titles.join() === 'Survey' && survey.cats.length > 0 && survey.cats.every((x) => x === 'Survey') && survey.pressed === 'Survey', survey);
  c.check('moving between categories does not change the game', survey.state === before, { before, after: survey.state });

  const bought = await ev(() => {
    const H = HUM;
    const p0 = H.derive().manualSalvage;
    const s0 = H.S.run.salvage;
    document.querySelector('#panel-upgrades .slip [data-action="buy-upg"][data-id="flashlight"]').click();
    H.UI.update();
    return { owned: H.S.run.upgrades.flashlight === true, spent: s0 - H.S.run.salvage, p0, p1: H.derive().manualSalvage,
      sum: document.querySelector('#panel-upgrades .cats-sum').textContent, still: document.querySelector('#panel-upgrades .cats [aria-pressed="true"]').dataset.cat };
  });
  c.check('buying from a category applies the upgrade, charged once', bought.owned && Math.abs(bought.spent - 40) < 1 && Math.abs(bought.p1 - 2 * bought.p0) < 1e-9, bought);
  // Whole numbers below 1,000 are shown rounded down.
  c.check('the category stays selected and its summary updates at once', bought.still === 'Survey' && bought.sum.startsWith(`Survey power +${Math.floor(bought.p1)} salvage`), bought);

  await page.click('#panel-upgrades .cats [data-cat="all"]');
  await page.waitForTimeout(100);
  const allAgain = await ev(() => document.querySelectorAll('#panel-upgrades .cats-group').length);
  c.check('All shows every category again', allAgain === all.groups.length, { allAgain, before: all.groups.length });

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
    const res = { seg: !!document.querySelector('#panel-upgrades .cats'), same: JSON.stringify(ids) === JSON.stringify(expected), sub: document.querySelector('#panel-upgrades .panel-sub').textContent };
    H.Exp.reset();
    return res;
  });
  c.check('switched off, the Upgrades tab returns to its original single list', !off.seg && off.same && /^One-off requisitions\. Most cost/.test(off.sub), off);

  c.finish(g.errors);
  await g.browser.close();
})();
