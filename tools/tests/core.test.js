// EXP-CORE: the experiment registry, flags, save preservation and the wallet.
const { open, Checker } = require('./harness');

(async () => {
  const c = new Checker('EXP-CORE: experiment scaffolding');
  const g = await open('');
  const { ev, page } = g;

  const flags = await ev(() => {
    const E = HUM.Exp;
    E.define({ id: 'EXP-TEST', name: 'Test', defaultOn: true });
    E.define({ id: 'EXP-TEST-OFF', name: 'Test off', defaultOn: false });
    const out = { defaults: [E.on('EXP-TEST'), E.on('EXP-TEST-OFF'), E.on('EXP-UNKNOWN')] };
    E.set('EXP-TEST', false);
    out.afterSet = E.on('EXP-TEST');
    out.stored = JSON.parse(localStorage.getItem('the-hum.experiments'));
    out.notInSave = !JSON.stringify(HUM.S).includes('EXP-TEST');
    let calls = 0;
    E.hook('t:hook', 'EXP-TEST', () => { calls++; });
    E.run('t:hook'); out.callsWhileOff = calls;
    E.runAll('t:hook'); out.callsRunAll = calls;
    E.set('EXP-TEST', true); E.run('t:hook'); out.callsWhileOn = calls;
    E.hook('t:ask', 'EXP-TEST', () => 42);
    out.ask = E.ask('t:ask');
    E.reset();
    out.afterReset = [E.on('EXP-TEST'), localStorage.getItem('the-hum.experiments')];
    return out;
  });
  c.check('defaults apply and unknown experiments are off', flags.defaults.join() === 'true,false,false', flags.defaults);
  c.check('a developer override switches an experiment off', flags.afterSet === false);
  c.check('overrides are stored in their own key, not in the save', flags.stored['EXP-TEST'] === false && flags.notInSave, flags.stored);
  c.check('hooks of a disabled experiment are skipped by run()', flags.callsWhileOff === 0);
  c.check('runAll() reaches disabled experiments', flags.callsRunAll === 1);
  c.check('hooks run once the experiment is on again', flags.callsWhileOn === 2);
  c.check('ask() returns an enabled answer', flags.ask === 42);
  c.check('reset() restores defaults and clears stored overrides', flags.afterReset[0] === true && flags.afterReset[1] === null, flags.afterReset);

  // URL overrides apply to this page load only.
  await page.goto(page.url().replace('#debug', '').replace(/\?.*$/, '') + '?exp=-EXP-PROBE,EXP-PROBE2#debug');
  await page.waitForTimeout(200);
  const url = await ev(() => ({ session: HUM.Exp.session, stored: localStorage.getItem('the-hum.experiments') }));
  c.check('?exp= sets session flags without storing them', url.session['EXP-PROBE'] === false && url.session['EXP-PROBE2'] === true && url.stored === null, url);

  const dormant = await ev(() => {
    const st = HUM.sanitizeState({
      v: 1,
      achievements: { steps: true, removed_ach: true, 'bad id!': true },
      ext: { someone_else: { keep: [1, 2, 3] }, huge: 'x'.repeat(30000) },
      run: { upgrades: { flashlight: true, removed_upgrade: true }, ext: { gone_module: { n: 5 } } },
    });
    const again = HUM.sanitizeState(JSON.parse(JSON.stringify(st)));
    HUM.UPGRADES.push({ id: 'removed_upgrade', cat: 'Survey', name: 'Back again', cost: { salvage: 1 }, req: {}, effect: '', flavor: '' });
    const restored = HUM.sanitizeState(JSON.parse(JSON.stringify(again)));
    HUM.UPGRADES.pop();
    return {
      ach: Object.keys(st.achievements), dormantAch: st.dormant.achievements,
      dormantUp: st.run.dormant.upgrades, upgrades: Object.keys(st.run.upgrades),
      extKept: st.ext.someone_else, extHuge: 'huge' in st.ext, runExt: st.run.ext.gone_module,
      survivesTwice: JSON.stringify(again.dormant) === JSON.stringify(st.dormant) && JSON.stringify(again.run.ext) === JSON.stringify(st.run.ext),
      restoredUp: restored.run.upgrades.removed_upgrade === true, restoredDormant: restored.run.dormant.upgrades,
    };
  });
  c.check('unknown achievement ids are kept aside, malformed ones dropped', dormant.ach.join() === 'steps' && dormant.dormantAch.join() === 'removed_ach', dormant);
  c.check('unknown upgrade ids are kept aside', dormant.dormantUp.join() === 'removed_upgrade' && dormant.upgrades.join() === 'flashlight', dormant);
  c.check('experiment data from other builds is kept untouched', dormant.extKept && dormant.extKept.keep.join() === '1,2,3' && dormant.runExt && dormant.runExt.n === 5, dormant);
  c.check('oversized experiment data is dropped', dormant.extHuge === false);
  c.check('kept data survives repeated loading unchanged', dormant.survivesTwice);
  c.check('dormant ids come back when their content returns', dormant.restoredUp && !dormant.restoredDormant, dormant);

  const wallet = await ev(() => {
    HUM.replaceState(HUM.sanitizeState({ v: 1 })); HUM.rt.saveBlocked = true;
    const W = HUM.Wallet;
    HUM.S.run.salvage = 50; HUM.S.run.aw = 7; HUM.S.echoes = 3; HUM.S.dv = 2;
    const out = { bal: ['salvage', 'aw', 'echoes', 'dv'].map((k) => W.balance(k)), can: [W.can('salvage', 50), W.can('salvage', 51)] };
    W.pay('aw', 5); W.pay('echoes', 1); W.pay('dv', 2); W.pay('salvage', 10);
    out.after = [HUM.S.run.salvage, HUM.S.run.aw, HUM.S.echoes, HUM.S.dv];
    return out;
  });
  c.check('wallet reads every currency', wallet.bal.join() === '50,7,3,2', wallet);
  c.check('wallet compares and pays exactly', wallet.can.join() === 'true,false' && wallet.after.join() === '40,2,2,0', wallet);

  // Hook points added for the facilities, Déjà Vu, Noclip and account experiments.
  const hooks = await ev(() => {
    const E = HUM.Exp, out = {};
    HUM.replaceState(HUM.sanitizeState({ v: 1 })); HUM.rt.saveBlocked = true;
    const cart = HUM.FAC.cart;
    out.plain = [HUM.facilityCost(cart, 0, 1), HUM.facilityCost(cart, 10, 5), HUM.maxAffordable(cart, 0, 1000)];
    E.define({ id: 'EXP-HOOKS', name: 'Hook probe', defaultOn: true });
    E.hook('facility:price', 'EXP-HOOKS', (f, p) => { if (f.id === 'cart') { p.base *= 2; p.growth = 1.2; } });
    out.adjusted = [HUM.facilityCost(cart, 0, 1), HUM.facilityCost(cart, 2, 1)];
    E.set('EXP-HOOKS', false);
    out.offAgain = HUM.facilityCost(cart, 10, 5);
    E.set('EXP-HOOKS', true);
    // Noclip: newRun once on the fresh run, done once after the save, never on load.
    const calls = [];
    E.hook('noclip:newRun', 'EXP-HOOKS', (ended) => calls.push(['newRun', ended.iteration, HUM.S.iteration, HUM.S.run.level, ended.gain]));
    E.hook('noclip:done', 'EXP-HOOKS', (ended) => calls.push(['done', ended.iteration, ended.level, ended.exitFound]));
    E.hook('save:after', 'EXP-HOOKS', (manual) => calls.push(['saved', !!manual]));
    const r = HUM.S.run;
    r.level = 3; r.stats.salvage = 1e8;
    HUM.rt.saveBlocked = false;
    out.noclipped = HUM.noclip();
    HUM.rt.saveBlocked = true;
    out.again = HUM.noclip();
    HUM.replaceState(HUM.sanitizeState(JSON.parse(JSON.stringify(HUM.S))));
    HUM.rt.saveBlocked = true;
    out.calls = calls;
    return out;
  });
  c.check('facility prices are unchanged while nothing adjusts them', Math.abs(hooks.plain[0] - 15) < 1e-9 && Math.abs(hooks.plain[1] - 15 * Math.pow(1.15, 10) * (Math.pow(1.15, 5) - 1) / 0.15) < 1e-6 && hooks.plain[2] > 0, hooks.plain);
  c.check('facility:price adjusts the base price and the growth', Math.abs(hooks.adjusted[0] - 30) < 1e-9 && Math.abs(hooks.adjusted[1] - 30 * 1.44) < 1e-9, hooks.adjusted);
  c.check('a switched-off price adjustment no longer applies', Math.abs(hooks.offAgain - hooks.plain[1]) < 1e-9, hooks.offAgain);
  c.check('a noclip runs noclip:newRun on the new run, saves, then runs noclip:done, once each',
    hooks.noclipped === true && hooks.again === false && JSON.stringify(hooks.calls.map((x) => x[0])) === '["newRun","saved","done"]', hooks.calls);
  c.check('the noclip hooks describe the iteration that ended', JSON.stringify(hooks.calls[0]) === JSON.stringify(['newRun', 1, 2, 0, 7]) && JSON.stringify(hooks.calls[2]) === JSON.stringify(['done', 1, 3, false]), hooks.calls);

  const panels = await ev(() => {
    const E = HUM.Exp, out = {};
    E.hook('noclip:subtabs', 'EXP-HOOKS', (subs) => subs.push(['probe', 'Probe']));
    E.hook('noclip:build', 'EXP-HOOKS', (tab, p) => { if (tab !== 'probe') return undefined; p.append(Object.assign(document.createElement('p'), { id: 'probeBody', textContent: 'probe' })); return true; });
    E.hook('noclip:memories', 'EXP-HOOKS', (p) => { p.append(Object.assign(document.createElement('p'), { id: 'probeMem', textContent: 'memories elsewhere' })); return true; });
    HUM.S.seen.tab_noclip = true;
    HUM.UI.selectTab('noclip');
    const pn = document.getElementById('panel-noclip');
    out.bar = [...pn.querySelectorAll('[data-action="noclip-subtab"]')].map((b) => b.dataset.id + ':' + b.getAttribute('aria-pressed'));
    out.memReplaced = !!pn.querySelector('#probeMem') && !pn.querySelector('[data-action="memory"]');
    pn.querySelector('[data-id="probe"]').click();
    out.probe = !!pn.querySelector('#probeBody') && !pn.querySelector('.noclip-box');
    pn.querySelector('[data-id="noclip"]').click();
    out.back = !!pn.querySelector('.noclip-box');
    E.hook('facilities:layout', 'EXP-HOOKS', (p, P) => { const box = document.createElement('div'); box.id = 'probeRows'; box.append(P.row(HUM.FAC.cart)); p.append(box); return true; });
    let updates = 0;
    E.hook('facilities:update', 'EXP-HOOKS', () => { updates++; });
    HUM.UI.selectTab('facilities');
    const pf = document.getElementById('panel-facilities');
    out.layout = !!pf.querySelector('#probeRows [data-action="buy-fac"][data-id="cart"]') && pf.querySelectorAll('[data-action="buy-fac"]').length === 1;
    HUM.UI.update();
    out.updates = updates;
    out.countText = pf.querySelector('#probeRows .count').textContent;
    E.hook('reset:notes', 'EXP-HOOKS', (add) => add('Probe note for erasing.'));
    document.querySelector('[data-tab="settings"]').click();
    document.querySelector('[data-action="reset"]').click();
    out.resetNote = [...document.querySelectorAll('.modal p')].some((n) => n.textContent === 'Probe note for erasing.');
    HUM.UI.closeModal();
    E.set('EXP-HOOKS', false);
    HUM.UI.selectTab('noclip');
    out.offBar = document.getElementById('panel-noclip').querySelectorAll('[data-action="noclip-subtab"]').length;
    out.offMem = !!document.getElementById('panel-noclip').querySelector('[data-action="memory"]');
    return out;
  });
  c.check('experiments add Noclip sub-tabs next to the noclip itself', panels.bar.join() === 'noclip:true,probe:false', panels.bar);
  c.check('an experiment can replace the Memories section', panels.memReplaced);
  c.check('a Noclip sub-tab shows its own content and the noclip comes back', panels.probe && panels.back, panels);
  c.check('an experiment can lay out the facility rows, which core still updates', panels.layout && panels.updates >= 1 && panels.countText === '×0', panels);
  c.check('experiments can add notes to the erase confirmation', panels.resetNote);
  c.check('with the experiment off the Noclip panel is the original one', panels.offBar === 0 && panels.offMem, panels);

  c.finish(g.errors);
  await g.browser.close();
})();
