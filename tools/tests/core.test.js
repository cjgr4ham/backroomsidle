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

  c.finish(g.errors);
  await g.browser.close();
})();
