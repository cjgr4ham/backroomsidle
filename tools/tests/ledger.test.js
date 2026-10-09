// EXP-RESOURCE-LEDGER: Archive → Resources explains every resource, from the same calculations as the game.
const { open, Checker } = require('./harness');

const ID = 'EXP-RESOURCE-LEDGER';

(async () => {
  const c = new Checker(`${ID}: resource ledger`);
  const g = await open(`?exp=none,${ID}`);
  const { ev, page } = g;

  await ev(() => {
    const H = HUM; H.rt.saveBlocked = true;
    H.replaceState(H.sanitizeState({ v: 1 }));
    const r = H.S.run;
    r.flags.water = true; r.rooms = 500; r.levelRooms = 300; r.salvage = 5000; r.aw = 40;
    r.upgrades.radio = true; r.crew.total = 4; r.crew.jobs.scavenge = 2; r.crew.jobs.dowse = 1;
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
  c.check('the ledger covers every resource and meter in play', ['Salvage', 'Almond water', 'Echoes', 'Rooms and levels', 'Wanderers', 'Sanity', 'Attention'].every((t) => opened.entries.includes(t)), opened.entries);

  // Values come from the same calculations as the rest of the interface.
  const read = () => ev(() => {
    const cell = (entry, label) => {
      const sec = document.getElementById('ledger-' + entry);
      const row = [...sec.querySelectorAll('dl > div')].find((d) => d.querySelector('dt').textContent === label);
      return row ? row.querySelector('dd b').textContent : null;
    };
    HUM.UI.update();
    return {
      sps: cell('salvage', 'Per second'), headerSps: document.querySelector('.res-salvage .res-rate').textContent,
      aws: cell('aw', 'Per second'), headerAws: document.querySelector('.res-water .res-rate').textContent,
      held: cell('salvage', 'Held'), headerHeld: document.querySelector('.res-salvage .res-val').textContent,
      survey: cell('salvage', 'Per survey by hand'), yieldText: document.getElementById('surveyYield').textContent,
      level: cell('rooms', 'On this level'), crew: cell('crew', 'Idle'),
    };
  });
  const v1 = await read();
  c.check('per-second salvage and water match the header', v1.sps === v1.headerSps && v1.aws === v1.headerAws, v1);
  c.check('salvage held matches the header', v1.held === v1.headerHeld, v1);
  c.check('salvage per survey matches the Survey button', v1.yieldText.startsWith(v1.survey.replace(/\.\d+$/, '')), v1);
  c.check('level progress reads rooms mapped against the exit', v1.level === '300 / 800', v1);

  await ev(() => { HUM.S.run.salvage = 1e6; HUM.buyFacility('vat'); HUM.assign('scavenge', 1); });
  const v2 = await read();
  c.check('after a purchase and a new assignment the ledger updates at once', v2.sps !== v1.sps && v2.sps === v2.headerSps && v2.crew !== v1.crew, { v1, v2 });

  const noise = await ev(() => {
    const row = [...document.querySelectorAll('#ledger-attention dl > div')].find((d) => d.querySelector('dt').textContent === 'Noise');
    const plain = row.querySelector('dd span').textContent;
    HUM.Exp.session['EXP-ATTENTION-BALANCE'] = true;
    HUM.UI.update();
    const split = row.querySelector('dd span').textContent;
    HUM.Exp.session['EXP-ATTENTION-BALANCE'] = false;
    return { plain, split };
  });
  c.check('the noise row names its sources, with footsteps when that experiment is on', /^Made by facilities/.test(noise.plain) && /^Machines [\d.]+, your footsteps [\d.]+\./.test(noise.split), noise);

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
