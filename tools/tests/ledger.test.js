// EXP-RESOURCE-LEDGER: Archive → Resources explains every resource, from the same calculations as the game.
const { open, Checker } = require('./harness');

const ID = 'EXP-RESOURCE-LEDGER';

(async () => {
  const c = new Checker(`${ID}: resource ledger`);
  const g = await open(`?exp=none,${ID}`);
  const { ev, page } = g;

  await ev(() => {
    const H = HUM; H.rt.saveBlocked = true;
    H.replaceState(H.sanitizeState({ v: 2 }));
    const r = H.S.run;
    r.flags.water = true; r.rooms = 500; r.levelRooms = 300; r.salvage = 5000; r.aw = 40; r.nextEncounterAt = 1e12;
    r.specialists = { scavenge: 2, dowse: 1 };
    r.facilities = { cart: 12, bench: 4, condenser: 3, beacon: 2 };
    H.S.seen.echoes = true; H.S.echoes = 7;
    H.UI.update(true);
  });
  await page.waitForTimeout(150);
  const chips = await ev(() => [...document.querySelectorAll('#resources .res')].filter((n) => !n.hidden).map((n) => ({ role: n.getAttribute('role'), tab: n.getAttribute('tabindex') })));
  c.check('resource readouts in the header can be opened', chips.length >= 4 && chips.every((x) => x.role === 'button' && x.tab === '0'), chips);

  await page.click('.res-water');
  await page.waitForTimeout(200);
  const opened = await ev(() => ({ tab: HUM.rt.tab, sub: HUM.rt.archiveTab, focus: document.activeElement && document.activeElement.id,
    entries: [...document.querySelectorAll('#panel-archive .rl-entry h4')].map((h) => h.textContent) }));
  c.check('selecting almond water opens Archive → Resources at its entry', opened.tab === 'archive' && opened.sub === 'ledger' && opened.focus === 'ledger-aw', opened);
  c.check('the ledger covers every resource and meter in play', ['Salvage', 'Almond water', 'Echoes', 'Rooms and levels', 'Specialists', 'Sanity', 'Attention'].every((t) => opened.entries.includes(t)), opened.entries);
  c.check('no workforce entry remains', !opened.entries.includes('Wanderers'), opened.entries);

  // Values come from the same calculations as the rest of the interface.
  const read = () => ev(() => {
    const cell = (entry, label) => {
      const sec = document.getElementById('ledger-' + entry);
      const row = [...sec.querySelectorAll('dl > div')].find((d) => d.querySelector('dt').textContent === label);
      return row ? row.querySelector('dd b').textContent : null;
    };
    HUM.UI.update();
    return {
      sps: cell('salvage', 'Passive per second'), headerSps: document.querySelector('.res-salvage .res-rate').textContent,
      aws: cell('aw', 'Per second'), headerAws: document.querySelector('.res-water .res-rate').textContent,
      held: cell('salvage', 'Held'), headerHeld: document.querySelector('.res-salvage .res-val').textContent,
      power: cell('salvage', 'Survey power'), powerLine: document.getElementById('spowerVal').textContent,
      oneSurvey: cell('salvage', 'One survey now'), yieldText: document.getElementById('surveyYield').textContent,
      facMult: cell('salvage', 'Facility multiplier'), level: cell('rooms', 'On this level'), levels: cell('crew', 'Levels'), recruited: cell('crew', 'Recruited'),
    };
  });
  const v1 = await read();
  c.check('passive salvage per second matches the header', v1.headerSps === `${v1.sps}/s passive`.replace('/s/s', '/s'), v1);
  c.check('almond water per second matches the header', v1.aws === v1.headerAws, v1);
  c.check('salvage held matches the header', v1.held === v1.headerHeld, v1);
  c.check('survey power matches the line under the Survey button', v1.powerLine === `${v1.power} salvage per survey`, v1);
  c.check('one survey now matches the Survey button', v1.yieldText.startsWith(`${v1.oneSurvey} salvage`), v1);
  c.check('level progress reads rooms mapped against the exit', v1.level === '300 / 800', v1);
  c.check('the specialists entry lists who is recruited and at what level', v1.recruited === '2 / 5' && /Scavenger 2/.test(v1.levels) && /Dowser 1/.test(v1.levels) && /Cartographer —/.test(v1.levels), v1);

  // A facility changes survey power only; a Scavenger level changes passive salvage only. The ledger follows at once.
  await ev(() => { const H = HUM; H.S.run.salvage = 1e6; H.setBuyMode(1); H.buyFacility('cart'); });
  const v2 = await read();
  c.check('after buying a cart the facility multiplier and survey power update, passive salvage does not', v2.facMult !== v1.facMult && v2.power !== v1.power && v2.sps === v1.sps && v2.powerLine === `${v2.power} salvage per survey`, { v1, v2 });
  await ev(() => { HUM.hireSpecialist('scavenge'); });
  const v3 = await read();
  c.check('after upgrading the Scavenger passive salvage updates and survey power does not', v3.sps !== v2.sps && v3.power === v2.power && v3.headerSps === `${v3.sps}/s passive`.replace('/s/s', '/s') && /Scavenger 3/.test(v3.levels), { v2, v3 });

  // Footstep noise comes from EXP-ATTENTION-BALANCE; when that experiment is not in the build, only the plain wording is checked.
  // The row is looked up again after the update: a changed flag can rebuild the panel, which replaces the row.
  const noise = await ev(() => {
    const note = () => [...document.querySelectorAll('#ledger-attention dl > div')].find((d) => d.querySelector('dt').textContent === 'Noise').querySelector('dd span').textContent;
    const plain = note();
    const present = !!HUM.Exp.defs['EXP-ATTENTION-BALANCE'];
    let split = null;
    if (present) {
      HUM.Exp.session['EXP-ATTENTION-BALANCE'] = true;
      HUM.UI.update();
      split = note();
      HUM.Exp.session['EXP-ATTENTION-BALANCE'] = false;
    }
    return { plain, present, split };
  });
  c.check('the noise row names its sources, with footsteps when that experiment is on', /^Made by facilities/.test(noise.plain) && (!noise.present || /^Facilities [\d.]+, your footsteps [\d.]+\./.test(noise.split)), noise);

  await ev(() => document.querySelector('.res-salvage').focus());
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);
  const key = await ev(() => document.activeElement && document.activeElement.id);
  c.check('Enter on a focused resource opens its entry', key === 'ledger-salvage', key);

  const off = await ev(() => {
    const H = HUM;
    H.Exp.set('EXP-RESOURCE-LEDGER', false);
    H.UI.selectTab('facilities');
    H.rt.structureDirty = true; H.UI.update(true);
    document.querySelector('.res-salvage').click();
    const res = { tab: H.rt.tab, role: document.querySelector('.res-salvage').getAttribute('role') };
    H.UI.selectTab('archive'); H.rt.structureDirty = true; H.UI.update(true);
    res.subs = [...document.querySelectorAll('#panel-archive .subtabs button')].map((b) => b.textContent);
    H.Exp.reset();
    return res;
  });
  c.check('switched off, the header readouts are plain again and the Resources section is gone', off.tab === 'facilities' && off.role === null && !off.subs.includes('Resources'), off);

  c.finish(g.errors);
  await g.browser.close();
})();
