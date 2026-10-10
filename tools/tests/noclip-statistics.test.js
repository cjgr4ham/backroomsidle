// EXP-NOCLIP-STATISTICS: the completed-noclip count in the header and the Records panel, and that the count goes up
// exactly once per completed noclip. Completing the survey (the last room of Level 5) and entering Level FUN never count.
const { open, Checker } = require('./harness');
const ID = 'EXP-NOCLIP-STATISTICS';

(async () => {
  const c = new Checker('EXP-NOCLIP-STATISTICS: noclip counter and records');
  const g = await open('');
  const { ev, page } = g;
  c.check('the experiment is on by default', await ev((id) => HUM.Exp.on(id), ID));

  const fresh = await ev(() => ({ hidden: document.querySelector('.brand-noclips').hidden, n: HUM.S.life.noclips }));
  c.check('a new game shows no noclip count in the header yet', fresh.hidden && fresh.n === 0, fresh);

  // An iteration on the Long Hallway with plenty recovered, its survey not complete yet. Then the real interface flow.
  const locked = await ev(() => {
    const H = HUM, r = H.S.run;
    H.rt.saveBlocked = false;
    r.nextEncounterAt = 1e12;
    Object.assign(r, { level: 5, levelRooms: 0, rooms: 30000 });
    r.stats.salvage = 2e8; r.stats.time = 900;
    H.S.seen.tab_noclip = true;
    H.UI.selectTab('noclip'); H.UI.update(true);
    const b = document.querySelector('#panel-noclip [data-action="noclip"]');
    return { can: H.canNoclip(), preview: H.dvPreview(), disabled: b.disabled, label: b.textContent, attempt: H.noclip(), n: H.S.life.noclips, chip: document.querySelector('.brand-noclips').textContent };
  });
  c.check('with the Noclip tab open the header shows "0 noclips"', locked.chip === '0 noclips' && locked.n === 0, locked);
  c.check('before the survey is complete noclip is locked and trying counts nothing', !locked.can && locked.preview >= 1 && locked.disabled && locked.label === 'Noclip (locked)' && locked.attempt === false && locked.n === 0, locked);

  // Map the last room of the Long Hallway and on into Level FUN.
  const complete = await ev(() => {
    const H = HUM, r = H.S.run;
    H.addRooms(H.exitRooms(H.FINAL_LEVEL) - r.levelRooms + 25);
    H.UI.update(true);
    const b = document.querySelector('#panel-noclip [data-action="noclip"]');
    return { level: r.level, fun: H.FUN_LEVEL, exitFound: r.exitFound, levelRooms: r.levelRooms, n: H.S.life.noclips, exits: H.S.life.exits, iteration: H.S.iteration, dv: H.S.dv,
      chip: document.querySelector('.brand-noclips').textContent, can: H.canNoclip(), disabled: b.disabled, label: b.textContent };
  });
  c.check('completing the survey and entering Level FUN count nothing: still "0 noclips"', complete.level === complete.fun && complete.exitFound && complete.levelRooms === 25
    && complete.n === 0 && complete.exits === 0 && complete.iteration === 1 && complete.dv === 0 && complete.chip === '0 noclips', complete);
  c.check('then the noclip opens', complete.can && !complete.disabled && complete.label === 'Noclip', complete);

  const ready = await ev(() => ({ gain: HUM.dvPreview() }));
  await page.click('#panel-noclip [data-action="noclip"]');
  await page.waitForTimeout(50);
  const asked = await ev(() => ({ modal: !!document.querySelector('.modal'), n: HUM.S.life.noclips, dv: HUM.S.dv }));
  c.check('opening the tab and the confirmation counts nothing and awards nothing', asked.modal && asked.n === 0 && asked.dv === 0, asked);
  await page.click('.modal button:has-text("Stay")');
  const stayed = await ev(() => ({ n: HUM.S.life.noclips, dv: HUM.S.dv, iteration: HUM.S.iteration, level: HUM.S.run.level }));
  c.check('choosing Stay counts nothing and leaves you in Level FUN', stayed.n === 0 && stayed.dv === 0 && stayed.iteration === 1 && stayed.level === complete.fun, stayed);
  await page.click('#panel-noclip [data-action="noclip"]');
  await page.waitForTimeout(50);
  await page.dblclick('.modal button.primary');   // an impatient double click on the confirmation
  await page.waitForTimeout(100);
  const done = await ev(() => ({ n: HUM.S.life.noclips, exits: HUM.S.life.exits, dv: HUM.S.dv, dvTotal: HUM.S.dvTotal, iteration: HUM.S.iteration, chip: document.querySelector('.brand-noclips').textContent,
    again: HUM.noclip(), after: HUM.S.life.noclips }));
  c.check('a completed noclip counts exactly once, even with a double click, and awards its Déjà Vu once', ready.gain >= 1 && done.n === 1 && done.exits === 1 && done.dv === ready.gain && done.dvTotal === ready.gain && done.iteration === 2, { done, gain: ready.gain });
  c.check('the header shows "1 noclip" at once', done.chip === '1 noclip', done.chip);
  c.check('a retried noclip right after does nothing', done.again === false && done.after === 1, done);

  // Reload straight away: the saved count, Déjà Vu and the new run, nothing twice.
  await g.reload();
  const reloaded = await ev(() => ({ n: HUM.S.life.noclips, dv: HUM.S.dv, dvTotal: HUM.S.dvTotal, iteration: HUM.S.iteration, level: HUM.S.run.level, exitFound: HUM.S.run.exitFound, chip: document.querySelector('.brand-noclips').textContent }));
  c.check('reloading right after a noclip keeps the count, Déjà Vu and the new iteration, with nothing counted twice',
    reloaded.n === 1 && reloaded.dv === ready.gain && reloaded.dvTotal === ready.gain && reloaded.iteration === 2 && reloaded.level === 0 && !reloaded.exitFound && reloaded.chip === '1 noclip', reloaded);
  await g.reload();
  const twice = await ev(() => HUM.S.life.noclips);
  c.check('loading the save again does not change the count', twice === 1, twice);

  // The count is persistent state, not run state.
  const persist = await ev(() => {
    const H = HUM, out = {};
    H.rt.saveBlocked = true;
    out.inRun = 'noclips' in H.S.run.stats || JSON.stringify(H.S.run).includes('noclips');
    const r = H.S.run;
    r.nextEncounterAt = 1e12;
    r.level = H.FINAL_LEVEL; r.stats.salvage = 5e9; r.stats.time = 600;
    H.completeFiniteSurvey();
    out.completed = { n: H.S.life.noclips, exits: H.S.life.exits, level: r.level };
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
  c.check('the count lives outside the run and survives the run reset; the completion counts nothing, the noclip once (and as an exit)',
    !persist.inRun && persist.completed.n === 1 && persist.completed.exits === 1 && persist.ok && persist.n === 2 && persist.exits === 2, persist);
  c.check('importing a save restores its count; importing it again adds nothing', persist.imported === 2 && persist.importedTwice === 2, persist);

  // The Records panel, on a finite level and in Level FUN.
  const records = await ev(() => {
    const H = HUM, r = H.S.run;
    Object.assign(r, { level: 1, levelRooms: 0, rooms: 1234 }); r.stats.salvage = 98765; r.stats.time = 754;
    H.S.dv = 7; H.S.dvTotal = 40; H.S.life.salvage = 5.5e6;
    H.rt.noclipTab = 'noclip';
    H.UI.selectTab('noclip'); H.rt.structureDirty = true; H.UI.update(true);
    const dds = [...document.querySelectorAll('#panel-noclip .ns-records dd')].map((n) => n.textContent);
    const dts = [...document.querySelectorAll('#panel-noclip .ns-records dt')].map((n) => n.textContent);
    return { dts, dds };
  });
  c.check('the Records panel lists noclips, Déjà Vu, this iteration and lifetime salvage', records.dts.join('|') === 'Noclips|Déjà Vu|This iteration|Lifetime salvage', records.dts);
  c.check('its figures are the save’s own: noclips only, Déjà Vu, this iteration and lifetime salvage', records.dds[0] === '2 completed' && records.dds[1] === '7 to spend · 40 earned in all'
    && records.dds[2] === 'Iteration 3 · Level 1: The Annex · 1.23K rooms · 98.8K salvage recovered · 12m 34s' && records.dds[3] === '5.50M salvage across every iteration', records.dds);
  const fun = await ev(() => {
    const H = HUM, r = H.S.run;
    r.level = H.FINAL_LEVEL; r.levelRooms = 0;
    H.completeFiniteSurvey();
    r.levelRooms = 61234; r.stats.time = 754;
    H.rt.structureDirty = true; H.UI.update(true);
    return { level: r.level, dds: [...document.querySelectorAll('#panel-noclip .ns-records dd')].map((n) => n.textContent), chip: document.querySelector('.brand-noclips').textContent, n: H.S.life.noclips };
  });
  c.check('in Level FUN the records give its floor and say the survey is complete; the completion still counts no noclip',
    fun.dds[2] === 'Iteration 3 · Level FUN, floor 1 · 1.23K rooms · 98.8K salvage recovered · 12m 34s · survey complete' && fun.dds[0] === '2 completed' && fun.n === 2 && fun.chip === '2 noclips', fun);

  const manual = await ev(() => {
    HUM.S.seen.tab_archive = true;
    HUM.rt.archiveTab = 'manual';
    HUM.UI.selectTab('archive'); HUM.rt.structureDirty = true; HUM.UI.update(true);
    const sec = [...document.querySelectorAll('#panel-archive .manual section')].find((s) => /Noclip records/.test(s.textContent));
    return sec ? sec.textContent : null;
  });
  c.check('the field manual says what counts: a completed noclip, once; not completing the survey or entering Level FUN',
    !!manual && /counts once, when it completes/.test(manual) && /Completing the survey and entering Level FUN do not count/.test(manual), manual);

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
