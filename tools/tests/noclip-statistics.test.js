// EXP-NOCLIP-STATISTICS: the completed-noclip count in the header and the Records panel, and that the count
// goes up exactly once per completed noclip.
const { open, Checker } = require('./harness');
const ID = 'EXP-NOCLIP-STATISTICS';

(async () => {
  const c = new Checker('EXP-NOCLIP-STATISTICS: noclip counter and records');
  const g = await open('');
  const { ev, page } = g;
  c.check('the experiment is on by default', await ev((id) => HUM.Exp.on(id), ID));

  const fresh = await ev(() => ({ hidden: document.querySelector('.brand-noclips').hidden, n: HUM.S.life.noclips }));
  c.check('a new game shows no noclip count in the header yet', fresh.hidden && fresh.n === 0, fresh);

  // An iteration ready to noclip, then the real interface flow: tab, button, dialog.
  const ready = await ev(() => {
    const H = HUM, r = H.S.run;
    H.rt.saveBlocked = false;
    Object.assign(r, { level: 3, rooms: 30000, levelRooms: 100 });
    r.stats.salvage = 2e8;
    H.S.seen.tab_noclip = true;
    H.UI.selectTab('noclip'); H.UI.update(true);
    return { gain: H.dvPreview(), n: H.S.life.noclips, chip: document.querySelector('.brand-noclips').textContent };
  });
  c.check('with the Noclip tab open the header shows "0 noclips"', ready.chip === '0 noclips' && ready.n === 0, ready);
  await page.click('#panel-noclip [data-action="noclip"]');
  await page.waitForTimeout(50);
  const asked = await ev(() => ({ modal: !!document.querySelector('.modal'), n: HUM.S.life.noclips, dv: HUM.S.dv }));
  c.check('opening the tab and the confirmation counts nothing and awards nothing', asked.modal && asked.n === 0 && asked.dv === 0, asked);
  await page.click('.modal button:has-text("Stay")');
  const stayed = await ev(() => ({ n: HUM.S.life.noclips, dv: HUM.S.dv, iteration: HUM.S.iteration }));
  c.check('choosing Stay counts nothing', stayed.n === 0 && stayed.dv === 0 && stayed.iteration === 1, stayed);
  await page.click('#panel-noclip [data-action="noclip"]');
  await page.waitForTimeout(50);
  await page.dblclick('.modal button.primary');   // an impatient double click on the confirmation
  await page.waitForTimeout(100);
  const done = await ev(() => ({ n: HUM.S.life.noclips, dv: HUM.S.dv, dvTotal: HUM.S.dvTotal, iteration: HUM.S.iteration, chip: document.querySelector('.brand-noclips').textContent,
    again: HUM.noclip(), after: HUM.S.life.noclips }));
  c.check('a completed noclip counts exactly once, even with a double click, and awards its Déjà Vu once', done.n === 1 && done.dv === ready.gain && done.dvTotal === ready.gain && done.iteration === 2, { done, gain: ready.gain });
  c.check('the header shows "1 noclip" at once', done.chip === '1 noclip', done.chip);
  c.check('a retried noclip right after does nothing', done.again === false && done.after === 1, done);

  // Reload straight away: the saved count, Déjà Vu and the new run, nothing twice.
  await g.reload();
  const reloaded = await ev(() => ({ n: HUM.S.life.noclips, dv: HUM.S.dv, dvTotal: HUM.S.dvTotal, iteration: HUM.S.iteration, level: HUM.S.run.level, chip: document.querySelector('.brand-noclips').textContent }));
  c.check('reloading right after a noclip keeps the count, Déjà Vu and the new iteration, with nothing counted twice', reloaded.n === 1 && reloaded.dv === ready.gain && reloaded.dvTotal === ready.gain && reloaded.iteration === 2 && reloaded.level === 0 && reloaded.chip === '1 noclip', reloaded);
  await g.reload();
  const twice = await ev(() => HUM.S.life.noclips);
  c.check('loading the save again does not change the count', twice === 1, twice);

  // The count is persistent state, not run state.
  const persist = await ev(() => {
    const H = HUM, out = {};
    H.rt.saveBlocked = true;
    out.inRun = 'noclips' in H.S.run.stats || JSON.stringify(H.S.run).includes('noclips');
    const r = H.S.run; r.level = 5; r.exitFound = true; r.stats.salvage = 5e9;
    out.ok = H.noclip();
    out.n = H.S.life.noclips; out.exits = H.S.life.exits;
    // An imported save brings its own count; importing does not add to it.
    const text = H.encodeSave();
    H.replaceState(H.decodeSave(text)); H.rt.saveBlocked = true;
    out.imported = H.S.life.noclips;
    H.replaceState(H.decodeSave(text)); H.rt.saveBlocked = true;
    out.importedTwice = H.S.life.noclips;
    return out;
  });
  c.check('the count lives outside the run and survives the run reset', !persist.inRun && persist.ok && persist.n === 2 && persist.exits === 1, persist);
  c.check('importing a save restores its count; importing it again adds nothing', persist.imported === 2 && persist.importedTwice === 2, persist);

  // The Records panel.
  const records = await ev(() => {
    const H = HUM, r = H.S.run;
    Object.assign(r, { level: 1, rooms: 1234 }); r.stats.salvage = 98765; r.stats.time = 754;
    H.S.dv = 7; H.S.dvTotal = 40; H.S.life.salvage = 5.5e6;
    H.rt.noclipTab = 'noclip';
    H.UI.selectTab('noclip'); H.rt.structureDirty = true; H.UI.update(true);
    const dds = [...document.querySelectorAll('#panel-noclip .ns-records dd')].map((n) => n.textContent);
    const dts = [...document.querySelectorAll('#panel-noclip .ns-records dt')].map((n) => n.textContent);
    return { dts, dds };
  });
  c.check('the Records panel lists noclips, Déjà Vu, this iteration and lifetime salvage', records.dts.join('|') === 'Noclips|Déjà Vu|This iteration|Lifetime salvage', records.dts);
  c.check('its figures are the save’s own', records.dds[0] === '2 completed · 1 through the exit' && records.dds[1] === '7 to spend · 40 earned in all'
    && /^Iteration 3 · Level 1: The Annex · 1\.23K rooms · 98\.8K salvage recovered · 12m 34s$/.test(records.dds[2]) && records.dds[3] === '5.50M salvage across every iteration', records.dds);

  const chipClick = await ev(() => { HUM.UI.selectTab('facilities'); document.querySelector('.brand-noclips').click(); return HUM.rt.tab; });
  c.check('the header count opens the Noclip tab', chipClick === 'noclip', chipClick);

  // Phone width: the header still fits.
  await page.setViewportSize({ width: 360, height: 780 });
  await page.waitForTimeout(150);
  const narrow = await ev(() => {
    const chip = document.querySelector('.brand-noclips').getBoundingClientRect();
    return { fits: document.documentElement.scrollWidth <= window.innerWidth + 1, right: chip.right, width: window.innerWidth };
  });
  c.check('at phone width the count fits in the header without sideways scrolling', narrow.fits && narrow.right <= narrow.width, narrow);
  await page.setViewportSize({ width: 1366, height: 860 });

  // Switched off: the display goes, the count stays in the save.
  const off = await ev((id) => {
    const H = HUM;
    H.Exp.set(id, false);
    H.UI.selectTab('noclip'); H.rt.structureDirty = true; H.UI.update(true);
    const res = { chip: document.querySelector('.brand-noclips').hidden, records: !!document.querySelector('#panel-noclip .ns-records'), n: H.S.life.noclips };
    H.Exp.set(id, true); H.rt.structureDirty = true; H.UI.update(true);
    res.back = !document.querySelector('.brand-noclips').hidden && !!document.querySelector('#panel-noclip .ns-records');
    H.Exp.reset();
    return res;
  }, ID);
  c.check('switched off, the header count and Records panel disappear and the count stays in the save', off.chip && !off.records && off.n === 2 && off.back, off);

  c.finish(g.errors);
  await g.browser.close();
})();
