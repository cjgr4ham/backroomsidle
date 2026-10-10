// EXP-CORE: the experiment registry, flags, save preservation, the wallet and the hook points, on save format 2.
const { open, Checker } = require('./harness');

// The experiments this build has. EXP-CLICK-POWER, EXP-CREW-AUTOMATION, EXP-FACILITY-TIERS, EXP-FACILITY-INDEPENDENCE
// and EXP-FACILITY-SALVAGE-SCALING were folded into the game: they have no flag and no hooks any more.
const EXPERIMENTS = ['EXP-UPGRADE-CATEGORIES', 'EXP-RESOURCE-LEDGER', 'EXP-ATTENTION-BALANCE', 'EXP-DEV-MENU', 'EXP-NOCLIP-STATISTICS',
  'EXP-DEJA-VU-SHOP', 'EXP-ACCOUNT-AUTH', 'EXP-ACCOUNT-UI', 'EXP-CLOUD-SAVE', 'EXP-NOCLIP-LEADERBOARD',
  // update 2.1
  'EXP-LATE-FACILITIES', 'EXP-LATE-UPGRADES', 'EXP-LATE-RESEARCH', 'EXP-MISSION-AUTOREPEAT', 'EXP-AUTO-UPGRADE', 'EXP-CREW-VISIBLE', 'EXP-ROOM-VARIETY', 'EXP-PRODUCTION-FEEDBACK', 'EXP-AMBIENT-EVENTS', 'EXP-CREW-EQUIPMENT'];
const FOLDED = ['EXP-CLICK-POWER', 'EXP-CREW-AUTOMATION', 'EXP-FACILITY-TIERS', 'EXP-FACILITY-INDEPENDENCE', 'EXP-FACILITY-SALVAGE-SCALING'];

(async () => {
  const c = new Checker('EXP-CORE: experiment scaffolding');
  const g = await open('');
  const { ev, page } = g;

  const reg = await ev((folded) => {
    const E = HUM.Exp;
    const owners = new Set();
    for (const name in E.hooks) for (const h of E.hooks[name]) owners.add(h.id);
    return { ids: E.ids.slice(), save: HUM.S.v, folded: folded.filter((id) => E.defs[id] || E.on(id) || owners.has(id)), strays: [...owners].filter((id) => !E.defs[id]) };
  }, FOLDED);
  c.check('the registry holds exactly this build’s experiments, and the new game uses save format 2',
    JSON.stringify(reg.ids.slice().sort()) === JSON.stringify(EXPERIMENTS.slice().sort()) && reg.save === 2, reg);
  c.check('experiments folded into the game have no flag and no hooks left', reg.folded.length === 0 && reg.strays.length === 0, reg);

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
  const base = page.url().replace('#debug', '').replace(/\?.*$/, '');
  await page.goto(base + '?exp=-EXP-PROBE,EXP-PROBE2#debug');
  await page.waitForTimeout(200);
  const url = await ev(() => ({ session: HUM.Exp.session, stored: localStorage.getItem('the-hum.experiments') }));
  c.check('?exp= sets session flags without storing them', url.session['EXP-PROBE'] === false && url.session['EXP-PROBE2'] === true && url.stored === null, url);
  const bulk = {};
  for (const q of ['none', 'all']) {
    await page.goto(base + `?exp=${q}#debug`);
    await page.waitForTimeout(200);
    bulk[q] = await ev(() => HUM.Exp.ids.map((id) => HUM.Exp.on(id)));
  }
  c.check('?exp=none and ?exp=all switch every experiment off and on', bulk.none.length === EXPERIMENTS.length && bulk.none.every((x) => x === false) && bulk.all.every((x) => x === true), bulk);

  const dormant = await ev(() => {
    const raw = (v) => ({
      v,
      achievements: { steps: true, removed_ach: true, 'bad id!': true },
      ext: { someone_else: { keep: [1, 2, 3] }, huge: 'x'.repeat(30000) },
      run: { upgrades: { flashlight: true, removed_upgrade: true }, ext: { gone_module: { n: 5 } } },
    });
    const st = HUM.sanitizeState(raw(2));
    const again = HUM.sanitizeState(JSON.parse(JSON.stringify(st)));
    HUM.UPGRADES.push({ id: 'removed_upgrade', cat: 'Survey', name: 'Back again', cost: { salvage: 1 }, req: {}, effect: '', flavor: '' });
    const restored = HUM.sanitizeState(JSON.parse(JSON.stringify(again)));
    HUM.UPGRADES.pop();
    const v1 = HUM.sanitizeState(raw(1));   // the same data in a version-1 save goes through the migration first
    return {
      v: st.v, ach: Object.keys(st.achievements), dormantAch: st.dormant.achievements,
      dormantUp: st.run.dormant.upgrades, upgrades: Object.keys(st.run.upgrades),
      extKept: st.ext.someone_else, extHuge: 'huge' in st.ext, runExt: st.run.ext.gone_module,
      survivesTwice: JSON.stringify(again.dormant) === JSON.stringify(st.dormant) && JSON.stringify(again.run.ext) === JSON.stringify(st.run.ext),
      restoredUp: restored.run.upgrades.removed_upgrade === true, restoredDormant: restored.run.dormant.upgrades,
      v1: { v: v1.v, ach: v1.dormant.achievements, up: v1.run.dormant.upgrades, upgrades: Object.keys(v1.run.upgrades), ext: v1.ext.someone_else, huge: 'huge' in v1.ext, runExt: v1.run.ext.gone_module },
    };
  });
  c.check('unknown achievement ids are kept aside, malformed ones dropped', dormant.v === 2 && dormant.ach.join() === 'steps' && dormant.dormantAch.join() === 'removed_ach', dormant);
  c.check('unknown upgrade ids are kept aside', dormant.dormantUp.join() === 'removed_upgrade' && dormant.upgrades.join() === 'flashlight', dormant);
  c.check('experiment data from other builds is kept untouched', dormant.extKept && dormant.extKept.keep.join() === '1,2,3' && dormant.runExt && dormant.runExt.n === 5, dormant);
  c.check('oversized experiment data is dropped', dormant.extHuge === false);
  c.check('kept data survives repeated loading unchanged', dormant.survivesTwice);
  c.check('dormant ids come back when their content returns', dormant.restoredUp && !dormant.restoredDormant, dormant);
  const d1 = dormant.v1;
  c.check('a version-1 save keeps its dormant ids and other builds’ data through the migration to format 2',
    d1.v === 2 && d1.ach && d1.ach.join() === 'removed_ach' && d1.up && d1.up.join() === 'removed_upgrade' && d1.upgrades.join() === 'flashlight'
    && d1.ext && d1.ext.keep.join() === '1,2,3' && !d1.huge && d1.runExt && d1.runExt.n === 5, d1);

  const wallet = await ev(() => {
    HUM.replaceState(HUM.sanitizeState({ v: 2 })); HUM.rt.saveBlocked = true;
    const W = HUM.Wallet;
    HUM.S.run.salvage = 50; HUM.S.run.aw = 7; HUM.S.echoes = 3; HUM.S.dv = 2;
    const out = { bal: ['salvage', 'aw', 'echoes', 'dv'].map((k) => W.balance(k)), can: [W.can('salvage', 50), W.can('salvage', 51)] };
    W.pay('aw', 5); W.pay('echoes', 1); W.pay('dv', 2); W.pay('salvage', 10);
    out.after = [HUM.S.run.salvage, HUM.S.run.aw, HUM.S.echoes, HUM.S.dv];
    return out;
  });
  c.check('wallet reads every currency', wallet.bal.join() === '50,7,3,2', wallet);
  c.check('wallet compares and pays exactly', wallet.can.join() === 'true,false' && wallet.after.join() === '40,2,2,0', wallet);

  // Hook points. Checked with every other experiment off, so the probe below is the only one answering them.
  const h = await open('?exp=none');
  const hooks = await h.ev(() => {
    const E = HUM.Exp, out = {};
    HUM.replaceState(HUM.sanitizeState({ v: 2 })); HUM.rt.saveBlocked = true;
    const cart = HUM.FAC.cart;
    // Price of n units from `owned`: the sum of each unit's price, base × growth^k.
    const series = (b, gr, owned, n) => { let s = 0; for (let k = owned; k < owned + n; k++) s += b * Math.pow(gr, k); return s; };
    out.plain = [HUM.facilityCost(cart, 0, 1), HUM.facilityCost(cart, 10, 5)];
    out.plainWant = [series(cart.cost, cart.growth, 0, 1), series(cart.cost, cart.growth, 10, 5)];
    const max = HUM.maxAffordable(cart, 0, 1000);
    out.max = [max, Math.ceil(HUM.facilityCost(cart, 0, max)) <= 1000, Math.ceil(HUM.facilityCost(cart, 0, max + 1)) > 1000];
    out.curve = HUM.facPrice(cart);
    E.define({ id: 'EXP-HOOKS', name: 'Hook probe', defaultOn: true });
    E.hook('facility:price', 'EXP-HOOKS', (f, p) => { if (f.id === 'cart') { p.base *= 2; p.growth = 1.5; } });
    out.adjusted = [HUM.facilityCost(cart, 0, 1), HUM.facilityCost(cart, 2, 1), HUM.facPrice(cart), HUM.facilityCost(HUM.FAC.bench, 0, 1)];
    // What a purchase actually charges follows the adjusted curve too.
    HUM.setBuyMode(1);
    HUM.S.run.salvage = 1000;
    const bought = [HUM.buyFacility('cart'), HUM.buyFacility('cart'), HUM.buyFacility('cart')];
    out.paid = [bought.every(Boolean), 1000 - HUM.S.run.salvage, [0, 1, 2].reduce((s, k) => s + Math.ceil(30 * Math.pow(1.5, k)), 0)];
    E.set('EXP-HOOKS', false);
    out.offAgain = [HUM.facilityCost(cart, 10, 5), HUM.facPrice(cart)];
    E.set('EXP-HOOKS', true);

    // Noclip: refused, with no hooks, until the survey is complete; then newRun once on the fresh run, done once
    // after the save, never on load.
    const calls = [];
    E.hook('noclip:newRun', 'EXP-HOOKS', (ended) => calls.push(['newRun', ended.iteration, HUM.S.iteration, HUM.S.run.level, ended.gain]));
    E.hook('noclip:done', 'EXP-HOOKS', (ended) => calls.push(['done', ended.iteration, ended.level, ended.exitFound]));
    E.hook('save:after', 'EXP-HOOKS', (manual) => calls.push(['saved', !!manual]));
    HUM.replaceState(HUM.sanitizeState({ v: 2 })); HUM.rt.saveBlocked = false;
    const r = HUM.S.run;
    r.stats.salvage = 1e8;
    r.level = 3;
    const refused = { level3: HUM.noclip() };
    HUM.completeFiniteSurvey();                 // not the final level: completes nothing
    refused.notFinal = r.exitFound;
    r.level = HUM.FINAL_LEVEL;
    refused.final = [HUM.canNoclip(), HUM.noclip()];
    HUM.completeFiniteSurvey();                 // the last room of the Long Hallway
    out.completed = [r.exitFound, r.level, HUM.S.run === r];
    r.stats.salvage = 0;
    refused.nothingEarned = [HUM.dvPreview(), HUM.noclip()];
    r.stats.salvage = 1e8;
    refused.calls = calls.length;
    out.refused = refused;
    const P = HUM.CONFIG.prestige;
    out.want = Math.floor(Math.pow(1e8 / P.divisor, P.exponent) * P.exitMult);
    out.preview = HUM.dvPreview();
    const dv0 = HUM.S.dv;
    out.noclipped = HUM.noclip();
    out.dvGain = HUM.S.dv - dv0;
    HUM.rt.saveBlocked = true;
    out.again = HUM.noclip();
    HUM.replaceState(HUM.sanitizeState(JSON.parse(JSON.stringify(HUM.S))));
    HUM.rt.saveBlocked = true;
    out.calls = calls;
    out.fun = HUM.FUN_LEVEL;
    return out;
  });
  c.check('facility prices follow each facility’s own curve while nothing adjusts them',
    Math.abs(hooks.plain[0] - hooks.plainWant[0]) < 1e-9 && Math.abs(hooks.plain[1] - hooks.plainWant[1]) < 1e-6 * hooks.plainWant[1]
    && hooks.max[0] > 0 && hooks.max[1] && hooks.max[2] && hooks.curve.base === 15 && hooks.curve.growth === 1.2, hooks);
  c.check('facility:price adjusts the base price and the growth, for that facility only',
    Math.abs(hooks.adjusted[0] - 30) < 1e-9 && Math.abs(hooks.adjusted[1] - 30 * 1.5 * 1.5) < 1e-9 && hooks.adjusted[2].base === 30 && hooks.adjusted[2].growth === 1.5
    && Math.abs(hooks.adjusted[3] - 200) < 1e-9, hooks.adjusted);
  c.check('purchases are charged the adjusted price', hooks.paid[0] && hooks.paid[1] === hooks.paid[2], hooks.paid);
  c.check('a switched-off price adjustment no longer applies', Math.abs(hooks.offAgain[0] - hooks.plain[1]) < 1e-9 && hooks.offAgain[1].base === 15, hooks.offAgain);
  const rf = hooks.refused;
  c.check('noclip is refused, and runs no hooks, until the survey is complete and has earned Déjà Vu',
    rf.level3 === false && rf.notFinal === false && rf.final.join() === 'false,false' && rf.nothingEarned.join() === '0,false' && rf.calls === 0, rf);
  c.check('the last room of the Long Hallway completes the survey and leads into Level FUN', hooks.completed.join() === `true,${hooks.fun},true`, hooks.completed);
  c.check('a noclip runs noclip:newRun on the new run, saves, then runs noclip:done, once each',
    hooks.noclipped === true && hooks.again === false && JSON.stringify(hooks.calls.map((x) => x[0])) === '["newRun","saved","done"]', hooks.calls);
  c.check('the noclip hooks describe the iteration that ended, and pay the Déjà Vu it showed',
    hooks.want > 0 && hooks.preview === hooks.want && hooks.dvGain === hooks.want
    && JSON.stringify(hooks.calls[0]) === JSON.stringify(['newRun', 1, 2, 0, hooks.want]) && JSON.stringify(hooks.calls[2]) === JSON.stringify(['done', 1, hooks.fun, true]), hooks);

  // Every purchase goes through the wallet: with the budget lifted and payment waived, each kind of purchase succeeds
  // with nothing held and spends nothing; without that, the same purchases are refused.
  const pay = await h.ev(() => {
    const E = HUM.Exp, out = {};
    let free = false;
    E.hook('wallet:budget', 'EXP-HOOKS', () => (free ? Infinity : undefined));
    E.hook('wallet:free', 'EXP-HOOKS', () => (free ? true : undefined));
    const attempt = () => {
      HUM.replaceState(HUM.sanitizeState({ v: 2 })); HUM.rt.saveBlocked = true;
      const r = HUM.S.run;
      r.rooms = 10; r.sanity = 50;
      r.specialists.chart = 1;   // the Stairwell needs the Cartographer: only its water is left to pay
      const got = {
        facility: HUM.buyFacility('cart'),
        upgrade: HUM.buyUpgrade('gloves'),
        specialist: HUM.hireSpecialist('scavenge'),
        mission: HUM.launchMission('stairwell'),
        research: HUM.doResearch('pattern'),
        memory: HUM.buyMemory('muscle'),
        drink: HUM.drink(false),
      };
      return { got, held: [r.salvage, r.aw, HUM.S.echoes, HUM.S.dv] };
    };
    free = true;
    out.free = attempt();
    free = false;
    out.paid = attempt();
    return out;
  });
  c.check('every kind of purchase checks and pays through the wallet, specialists and missions included',
    Object.values(pay.free.got).every((x) => x === true) && pay.free.held.join() === '0,0,0,0' && Object.values(pay.paid.got).every((x) => x === false), pay);

  const panels = await h.ev(() => {
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
    // The Upgrades tab: an experiment can lay it out with core's own requisition slips, which core still updates.
    E.hook('upgrades:build', 'EXP-HOOKS', (p) => {
      const P = HUM.Panels.upgrades;
      P.btns = [];
      const box = document.createElement('div');
      box.id = 'probeSlips';
      box.append(P.slip(HUM.UPG.gloves, P.btns));
      p.append(box);
      return true;
    });
    let slipUpdates = 0;
    E.hook('upgrades:slipUpdate', 'EXP-HOOKS', (ref) => { if (ref.u.id === 'gloves') slipUpdates++; });
    HUM.S.run.salvage = 0;
    HUM.S.seen.tab_upgrades = true;
    HUM.UI.selectTab('upgrades');
    const pu = document.getElementById('panel-upgrades');
    out.layout = !!pu.querySelector('#probeSlips [data-action="buy-upg"][data-id="gloves"]') && pu.querySelectorAll('[data-action="buy-upg"]').length === 1;
    HUM.UI.update();
    const btn = pu.querySelector('#probeSlips [data-action="buy-upg"]');
    out.slip = { updates: slipUpdates, price: btn.querySelectorAll('.sub')[0].textContent, disabled: btn.disabled };
    E.hook('reset:notes', 'EXP-HOOKS', (add) => add('Probe note for erasing.'));
    document.querySelector('[data-tab="settings"]').click();
    document.querySelector('[data-action="reset"]').click();
    out.resetNote = [...document.querySelectorAll('.modal p')].some((n) => n.textContent === 'Probe note for erasing.');
    HUM.UI.closeModal();
    E.set('EXP-HOOKS', false);
    HUM.UI.selectTab('noclip');
    out.offBar = document.getElementById('panel-noclip').querySelectorAll('[data-action="noclip-subtab"]').length;
    out.offMem = !!document.getElementById('panel-noclip').querySelector('[data-action="memory"]');
    HUM.UI.selectTab('upgrades');
    out.offUpgrades = !document.querySelector('#panel-upgrades #probeSlips') && /^One-off requisitions/.test(document.querySelector('#panel-upgrades .panel-sub').textContent);
    return out;
  });
  c.check('experiments add Noclip sub-tabs next to the noclip itself', panels.bar.join() === 'noclip:true,probe:false', panels.bar);
  c.check('an experiment can replace the Memories section', panels.memReplaced);
  c.check('a Noclip sub-tab shows its own content and the noclip comes back', panels.probe && panels.back, panels);
  c.check('an experiment can lay out the Upgrades tab with core’s slips, which core still updates',
    panels.layout && panels.slip.updates >= 1 && panels.slip.price === '25 salvage' && panels.slip.disabled === true, panels);
  c.check('experiments can add notes to the erase confirmation', panels.resetNote);
  c.check('with the experiment off the Noclip and Upgrades panels are the original ones', panels.offBar === 0 && panels.offMem && panels.offUpgrades, panels);
  await h.browser.close();

  c.finish(g.errors.concat(h.errors));
  await g.browser.close();
})();
