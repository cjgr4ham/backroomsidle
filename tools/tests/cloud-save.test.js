// EXP-CLOUD-SAVE: the account's save on the server, revision checks, conflicts, migration of existing local
// progress and restoring earlier versions, against the real server and real browsers.
const path = require('path');
const emitWarning = process.emitWarning;
process.emitWarning = (w, ...a) => (/SQLite is an experimental/.test(String((w && w.message) || w)) ? undefined : emitWarning.call(process, w, ...a));
const { DatabaseSync } = require('node:sqlite');
const { Checker } = require('./harness');
const { startServer, client, skipUnless } = require('./server-harness');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node22/lib/node_modules/playwright'); }
const NAME = 'EXP-CLOUD-SAVE: account saves, revisions, conflicts and migration';
// A save in the current format (2), with only the fields the server looks at.
const save = (over) => ({ v: 2, iteration: 1, time: 10, dv: 0, dvTotal: 0, run: { level: 0, rooms: 5, salvage: 50 }, life: { noclips: 0 }, ...(over || {}) });
// A whole save as a page loaded before the redesign (format 1) uploaded it, for the account `owner` at `revision`:
// iteration 3, 40 Déjà Vu to spend of 300 earned, 2 noclips, and a crew of 12 (10 in jobs, 1 on an expedition under
// way, 1 idle), which format 2 replaced with specialists and missions.
const v1Save = (owner, revision, now) => ({
  v: 1, created: now - 86400e3, lastSaved: now, time: 5000, iteration: 3, condition: 'standard', nextCondition: 'standard',
  echoes: 14, dv: 40, dvTotal: 300, research: { pattern: true }, deepTheory: 0, memories: { muscle: 1 }, relics: {},
  achievements: {}, docs: {}, docsRead: {}, seen: { tab_upgrades: true, tab_crew: true, tab_expeditions: true },
  life: { rooms: 90000, salvage: 4e7, surveys: 9000, anomalies: 12, incidents: 3, averted: 1, noclips: 2, playTime: 4800, offlineTime: 200,
    expeditions: 4, maxLevel: 3, exits: 2, blackouts: 0, figuresIgnored: 0 },
  settings: { volume: 0.6, muted: false, ambience: true, sfx: true, crt: true, flicker: true, shake: true, distortion: true, motion: 'auto', numbers: 'suffix' },
  log: [], ext: { cloud: { owner, revision, syncedTime: 5000 } }, dormant: {},
  run: {
    salvage: 2.5e6, aw: 140, sanity: 90, attention: 10, peakAttention: 30, minSanity: 70, level: 2, levelRooms: 900, rooms: 5700, exitFound: false,
    facilities: { cart: 30, bench: 12, condenser: 4 }, upgrades: { gloves: true, flashlight: true }, autobuy: {},
    crew: { total: 12, jobs: { scavenge: 5, chart: 3, dowse: 2, watch: 0, archive: 0 }, missing: [], defaultJob: 'scavenge' },
    expeditions: { stairwell: { start: 4990, end: 5110, crew: 1, sps: 40, hazard: 0.05 } },
    doctrine: null, disabled: {}, lightsUntil: 0, lightsReadyAt: 0, blackoutUntil: 0, pendingIncident: null, incidentGraceUntil: 0, nextAnomalyAt: 0,
    flags: { water: true, expedition: true },
    stats: { salvage: 9e6, surveys: 4000, anomalies: 3, incidents: 1, averted: 0, expeditions: 2, drinks: 4, waterFinds: 9, time: 1800 },
    ext: {}, dormant: {},
  },
});

(async () => {
  if (skipUnless(['auth.js', 'cloud-save.js'], NAME)) return;
  const c = new Checker(NAME);
  const s = await startServer({ HUM_SETTINGS: JSON.stringify({ rate: { save: [40, 60] } }) });
  const dbq = (sql, ...a) => { const d = new DatabaseSync(path.join(s.dataDir, 'the-hum.db')); try { return d.prepare(sql).all(...a); } finally { d.close(); } };

  // ------------------------------------------------------------- the API
  const anon = await client(s.url).get('/api/save');
  c.check('without a session the save routes refuse (401)', anon.status === 401 && anon.data.error === 'signed_out', anon.data);
  const A = client(s.url);
  await A.post('/api/auth/register', { username: 'Atlas', password: 'carpet smells of rain' });
  const empty = await A.get('/api/save');
  const p1 = await A.put('/api/save', { baseRevision: null, reason: 'link', data: save() });
  const got = await A.get('/api/save');
  c.check('a new account has no save; the first upload (current format, 2) becomes revision 1 and reads back exactly', empty.data.save === null && p1.status === 200 && p1.data.revision === 1 && JSON.stringify(got.data.save.data) === JSON.stringify(save()) && got.data.save.data.v === 2 && got.data.save.summary.iteration === 1, [empty.data, p1.data]);
  const stale = await A.put('/api/save', { baseRevision: 0, data: save({ iteration: 9 }) });
  c.check('a write based on an older revision is refused with the current one (409); nothing is overwritten', stale.status === 409 && stale.data.error === 'conflict' && stale.data.current.revision === 1 && (await A.get('/api/save')).data.save.data.iteration === 1, stale.data);
  const p2 = await A.put('/api/save', { baseRevision: 1, reason: 'autosave', data: save({ iteration: 2 }) });
  const p3 = await A.put('/api/save', { baseRevision: 2, reason: 'autosave', data: save({ iteration: 3 }) });
  const p4 = await A.put('/api/save', { baseRevision: 3, reason: 'resolve', data: save({ iteration: 4 }) });
  const hist = await A.get('/api/save/history');
  const old = await A.get('/api/save/history/1');
  c.check('earlier versions are kept on deliberate replacements and at most hourly otherwise', p2.data.revision === 2 && p3.data.revision === 3 && p4.data.revision === 4 && JSON.stringify(hist.data.history.map((h) => [h.revision, h.replacedBy])) === JSON.stringify([[3, 'resolve'], [1, 'autosave']]), hist.data);
  c.check('an earlier version can be read back', old.status === 200 && old.data.save.data.iteration === 1 && (await A.get('/api/save/history/2')).status === 404, old.data);
  const bad = await Promise.all([
    A.put('/api/save', { baseRevision: 4, data: save({ v: 3 }) }), A.put('/api/save', { baseRevision: 4, data: { v: 2, iteration: 1 } }),
    A.put('/api/save', { baseRevision: 4, data: save({ dv: -5 }) }), A.put('/api/save', { baseRevision: 'x', data: save() }),
    A.put('/api/save', { baseRevision: 4, data: save({ ext: { dev: { actions: 3 } } }) }), A.put('/api/save', { baseRevision: 4, data: save({ pad: 'x'.repeat(600 * 1024) }) }),
  ]);
  c.check('the server checks the save: format, shape, numbers, revision, developer-tool marks (422) and size (413)', JSON.stringify(bad.map((r) => r.status)) === JSON.stringify([400, 400, 400, 400, 422, 413]), bad.map((r) => [r.status, r.data.error]));
  // Only formats 1 and 2 exist: anything else (a newer format, none, a string) is refused as a format the server does not take.
  const formats = await Promise.all([3, 0, '2', undefined].map((v) => A.put('/api/save', { baseRevision: 4, data: save({ v }) })));
  c.check('a save in any format other than 1 or 2 (3, 0, "2", none) is refused as such (400 save_version), and nothing is written', formats.every((r) => r.status === 400 && r.data.error === 'save_version') && (await A.get('/api/save')).data.save.revision === 4, formats.map((r) => [r.status, r.data.error]));
  const B = client(s.url);
  await B.post('/api/auth/register', { username: 'Basil', password: 'fluorescent tubes flicker' });
  const bGet = await B.get('/api/save');
  const bOld = await B.get('/api/save/history/1');
  const bPut = await B.put('/api/save', { baseRevision: null, data: save({ iteration: 77 }) });
  const aAfter = await A.get('/api/save');
  c.check('each account sees and writes only its own save; there is no way to name another account’s', bGet.data.save === null && bOld.status === 404 && bPut.data.revision === 1 && aAfter.data.save.data.iteration === 4 && aAfter.data.save.revision === 4, [bGet.data, bOld.status, aAfter.data.save.revision]);
  const cross = await A.put('/api/save', { baseRevision: 4, data: save() }, { Origin: 'https://evil.example' });
  c.check('a save sent from another site is refused', cross.status === 403, cross.status);
  // A page loaded before the update still sends format 1. It is kept as sent; the game migrates it when it loads it.
  const legacySave = v1Save('atlas', 5, Date.now());
  const legacy = await A.put('/api/save', { baseRevision: 4, reason: 'autosave', data: legacySave });
  const legacyBack = (await A.get('/api/save')).data.save;
  c.check('a format-1 save from a page loaded before the update is still accepted, and reads back exactly as sent', legacy.status === 200 && legacy.data.revision === 5 && JSON.stringify(legacyBack.data) === JSON.stringify(legacySave) && legacyBack.summary.iteration === 3 && legacyBack.summary.noclips === 2, [legacy.status, legacy.data]);

  // ------------------------------------------------------------- browsers
  const browser = await playwright.chromium.launch();
  const errors = [];
  const GAME = s.url + '/?exp=-EXP-ACCOUNT-UI#debug';   // the account interface is tested on its own; here the service is used directly
  async function device() {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 820 } });
    return { ctx, page: await open(ctx) };
  }
  async function open(ctx) {
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource: the server responded with a status of 4\d\d/.test(m.text())) errors.push(m.text()); });
    await page.goto(GAME);
    await page.waitForFunction(() => window.HUM && HUM.Exp.ask('account:service').state().status !== 'checking');
    return page;
  }
  const cloud = (page) => page.evaluate(() => HUM.Exp.ask('cloud:state'));
  const until = (page, fn, arg) => page.waitForFunction(fn, arg, { timeout: 8000 });
  const settled = (page) => until(page, () => ['synced', 'conflict', 'waiting', 'paused-dev', 'error', 'offline'].includes(HUM.Exp.ask('cloud:state').status));
  const modal = (page) => page.evaluate(() => (document.querySelector('.modal h2') || {}).textContent || null);
  const click = (page, label) => page.click(`.modal button:has-text("${label}")`);
  const serverSave = (name) => dbq('SELECT s.revision, s.data FROM saves s JOIN accounts a ON a.id = s.account_id WHERE a.username_key = ?', name)[0];

  // A new account on a fresh browser links and uploads.
  const d1 = await device();
  await d1.page.evaluate(() => HUM.Exp.ask('account:service').register('Mira', 'the wallpaper is moist'));
  await settled(d1.page);
  const linked = { cloud: await cloud(d1.page), server: serverSave('mira'), owner: await d1.page.evaluate(() => HUM.S.ext.cloud) };
  c.check('a new account on a fresh browser becomes linked, and its save is uploaded as revision 1', linked.cloud.status === 'synced' && linked.server.revision === 1 && linked.owner.owner === 'mira' && linked.owner.revision === 1, linked);
  // Progress, then a manual save uploads it.
  await d1.page.evaluate(() => { const H = HUM; H.rt.saveBlocked = false; H.S.iteration = 2; H.S.dvTotal = 12; H.S.run.salvage = 777; H.save(true); });
  await until(d1.page, () => HUM.S.ext.cloud.revision === 2);
  c.check('progress saved by hand is uploaded with the next revision', JSON.parse(serverSave('mira').data).iteration === 2 && serverSave('mira').revision === 2);
  await d1.page.reload();
  await d1.page.waitForFunction(() => HUM.Exp.ask('account:service').state().status === 'signed-in');
  await settled(d1.page);
  c.check('after a refresh the game is still linked and in step, with no question asked', (await cloud(d1.page)).status === 'synced' && (await modal(d1.page)) === null);

  // A second device loads the account's progress.
  const d2 = await device();
  await d2.page.evaluate(() => HUM.Exp.ask('account:service').login('Mira', 'the wallpaper is moist'));
  await settled(d2.page);
  const second = await d2.page.evaluate(() => ({ iteration: HUM.S.iteration, salvage: Math.floor(HUM.S.run.salvage), rev: HUM.S.ext.cloud.revision }));
  // (Leaving a page uploads its latest progress, so the first device's reload above may have made a newer revision.)
  c.check('signing in on a second device with nothing on it loads the account’s current progress', second.iteration === 2 && second.salvage >= 777 && second.rev === serverSave('mira').revision, second);
  // The second device moves on; the first, stale, is refused and asked.
  await d2.page.evaluate(() => { HUM.rt.saveBlocked = false; HUM.S.iteration = 3; HUM.save(true); });
  await until(d2.page, (r) => HUM.S.ext.cloud.revision > r, second.rev);
  await d1.page.evaluate(() => { HUM.S.run.salvage = 5; HUM.save(true); });
  await until(d1.page, () => document.querySelector('.modal h2') && document.querySelector('.modal h2').textContent === 'Two different saves');
  const conflict = { server: JSON.parse(serverSave('mira').data).iteration, table: await d1.page.evaluate(() => [...document.querySelectorAll('.cs-compare td')].map((n) => n.textContent)) };
  c.check('a stale device cannot overwrite newer progress: the server keeps it and the player is asked', conflict.server === 3 && conflict.table[0] === '2' && conflict.table[1] === '3', conflict);
  await click(d1.page, 'Load my account’s progress');
  const loaded = await d1.page.evaluate(() => ({ iteration: HUM.S.iteration, rev: HUM.S.ext.cloud.revision, copies: Object.keys(localStorage).filter((k) => k.startsWith('the-hum.save.keep-')).length }));
  c.check('choosing the account’s progress loads it, and keeps this browser’s as a copy', loaded.iteration === 3 && loaded.rev === serverSave('mira').revision && loaded.copies >= 1, loaded);

  // Two tabs in one browser: the stale tab is refused.
  const tabB = await open(d1.ctx);
  await tabB.waitForFunction(() => HUM.Exp.ask('account:service').state().status === 'signed-in');
  await settled(tabB);
  await d1.page.evaluate(() => { HUM.S.iteration = 4; HUM.save(true); });
  await until(d1.page, (r) => HUM.S.ext.cloud.revision > r, loaded.rev);
  await tabB.evaluate(() => { HUM.S.run.salvage = 1; HUM.save(true); });
  await until(tabB, () => document.querySelector('.modal h2') && document.querySelector('.modal h2').textContent === 'Two different saves');
  await click(tabB, 'Decide later');
  const tabs = { server: JSON.parse(serverSave('mira').data).iteration, status: (await cloud(tabB)).status };
  c.check('a second tab left behind cannot overwrite the first tab’s newer progress', tabs.server === 4 && tabs.status === 'conflict', tabs);
  await tabB.close();

  // A save from before the update: a page loaded earlier uploaded it in format 1. Signing in with the current game on
  // a fresh browser loads it migrated into a format-2 game, and nothing it had is lost.
  const oldPut = await B.put('/api/save', { baseRevision: 1, reason: 'autosave', data: v1Save('basil', 2, Date.now()) });
  const d5 = await device();
  await d5.page.evaluate(() => HUM.Exp.ask('account:service').login('Basil', 'fluorescent tubes flicker'));
  await settled(d5.page).catch(() => {});   // the check below says what went wrong
  const mig = await d5.page.evaluate(() => {
    const S = HUM.S, r = S.run;
    return { status: HUM.Exp.ask('cloud:state').status, v: S.v, iteration: S.iteration, dv: S.dv, dvTotal: S.dvTotal, noclips: S.life.noclips, exits: S.life.exits,
      memories: S.memories, research: Object.keys(S.research), level: r.level, cart: r.facilities.cart, crew: 'crew' in r, expeditions: 'expeditions' in r,
      specialists: r.specialists, cloud: S.ext.cloud, told: S.log.filter((e) => e.tag === 'UPDATE').length };
  });
  c.check('a format-1 save downloaded from the account is migrated into a format-2 game: the same iteration, Déjà Vu and noclips, its crew now specialists',
    oldPut.status === 200 && mig.status === 'synced' && mig.v === 2 && mig.iteration === 3 && mig.dv === 40 && mig.dvTotal === 300 && mig.noclips === 2 && mig.exits === 2
    && mig.memories.muscle === 1 && mig.research.includes('pattern') && mig.level === 2 && mig.cart === 30 && !mig.crew && !mig.expeditions
    && mig.specialists.scavenge === 7 && mig.specialists.chart === 3 && mig.specialists.dowse === 2 && !!mig.cloud && mig.cloud.owner === 'basil' && mig.cloud.revision === 2 && mig.told > 0, { oldPut: oldPut.status, mig });
  await d5.page.evaluate(() => HUM.save(true));
  await until(d5.page, () => HUM.S.ext.cloud && HUM.S.ext.cloud.revision === 3).catch(() => {});
  const migUp = JSON.parse(serverSave('basil').data);
  c.check('its next upload stores the game in format 2, with the same iteration, Déjà Vu and noclips', serverSave('basil').revision === 3 && migUp.v === 2 && migUp.iteration === 3 && migUp.dv === 40 && migUp.dvTotal === 300 && migUp.life.noclips === 2 && !('crew' in migUp.run) && !!migUp.run.specialists && migUp.run.specialists.scavenge === 7,
    { revision: serverSave('basil').revision, v: migUp.v, iteration: migUp.iteration, dvTotal: migUp.dvTotal, noclips: migUp.life.noclips, specialists: migUp.run.specialists });

  // Existing local progress joins a new account, once, with an explanation.
  const d3 = await device();
  await d3.page.evaluate(() => { const H = HUM; H.rt.saveBlocked = false; Object.assign(H.S, { iteration: 3, dv: 10, dvTotal: 50 }); H.S.life.noclips = 2; H.save(); });
  await d3.page.evaluate(() => HUM.Exp.ask('account:service').register('Orin', 'stairs that go nowhere'));
  await until(d3.page, () => document.querySelector('.modal h2') && /Save this progress/.test(document.querySelector('.modal h2').textContent));
  const ask = await d3.page.evaluate(() => document.querySelector('.modal').textContent);
  c.check('signing up with progress in this browser asks whether to upload it, and says what it is', /has no save yet/.test(ask) && /Iteration/.test(ask) && /Déjà Vu earned/.test(ask) && /50/.test(ask), ask.slice(0, 160));
  await click(d3.page, 'Upload this progress');
  await until(d3.page, () => HUM.Exp.ask('cloud:state').status === 'synced');
  const up = JSON.parse(serverSave('orin').data);
  c.check('uploading makes it the account’s save, unchanged (iteration, Déjà Vu, noclips)', up.iteration === 3 && up.dvTotal === 50 && up.life.noclips === 2);
  await d3.page.reload();
  await d3.page.waitForFunction(() => HUM.Exp.ask('account:service').state().status === 'signed-in');
  await settled(d3.page);
  const again = JSON.parse(serverSave('orin').data);
  c.check('it is not offered again after a refresh, and nothing is added twice (same iteration, Déjà Vu and noclips)', (await modal(d3.page)) === null && again.iteration === 3 && again.dvTotal === 50 && again.life.noclips === 2, again.iteration);
  // Another account on the same browser: never imported into it; asked, with a copy kept.
  await d3.page.evaluate(() => HUM.Exp.ask('account:service').logout());
  await d3.page.evaluate(() => HUM.Exp.ask('account:service').login('Mira', 'the wallpaper is moist'));
  await until(d3.page, () => document.querySelector('.modal h2') && /Load Mira’s save/.test(document.querySelector('.modal h2').textContent));
  await click(d3.page, 'Load it');
  const other = await d3.page.evaluate(() => ({ iteration: HUM.S.iteration, owner: HUM.S.ext.cloud.owner, copy: Object.keys(localStorage).some((k) => k.startsWith('the-hum.save.keep-') && /orin/i.test(localStorage.getItem(k))) }));
  c.check('signing in as another account never moves this browser’s progress into it; it loads that account’s save and keeps a copy', other.iteration === 4 && other.owner === 'mira' && other.copy && JSON.parse(serverSave('orin').data).iteration === 3, other);

  // A fresh start for a new account, with the old progress kept.
  const d4 = await device();
  await d4.page.evaluate(() => { const H = HUM; H.rt.saveBlocked = false; H.S.iteration = 5; H.S.dvTotal = 90; H.save(); });
  await d4.page.evaluate(() => HUM.Exp.ask('account:service').register('Pell', 'buzzing behind the drywall'));
  await until(d4.page, () => document.querySelector('.modal h2'));
  await click(d4.page, 'Start a new game for this account');
  await until(d4.page, () => HUM.Exp.ask('cloud:state').status === 'synced');
  const fresh = await d4.page.evaluate(() => ({ iteration: HUM.S.iteration, copy: Object.keys(localStorage).some((k) => k.startsWith('the-hum.save.keep-')) }));
  c.check('starting a new game for the account keeps the earlier progress as a copy', fresh.iteration === 1 && fresh.copy && JSON.parse(serverSave('pell').data).iteration === 1, fresh);

  // Developer tools: never uploaded.
  const before = serverSave('pell').revision;
  await d4.page.evaluate(() => { HUM.S.ext.dev = { actions: 2, first: 1, last: 2, kinds: ['add salvage'] }; HUM.S.run.salvage = 1e12; HUM.save(true); });
  await d4.page.waitForTimeout(300);
  c.check('a save changed with developer tools is not uploaded; the account keeps its last clean save', (await cloud(d4.page)).status === 'paused-dev' && serverSave('pell').revision === before && JSON.parse(serverSave('pell').data).run.salvage < 1e6);

  // Erasing while signed in erases this browser only; importing an older save asks.
  const resetNote = await d1.page.evaluate(() => { HUM.UI.closeModal(); document.querySelector('[data-tab="settings"]').click(); document.querySelector('[data-action="reset"]').click(); return document.querySelector('.modal').textContent; });
  await click(d1.page, 'Erase everything');
  await until(d1.page, () => HUM.S.iteration === 4 && HUM.Exp.ask('cloud:state').status === 'synced');
  c.check('erasing while signed in says it erases this browser only, and the account’s save comes back', /this browser only/.test(resetNote) && serverSave('mira').revision >= 4, resetNote.slice(0, 120));
  // An exported save from earlier on: iteration 2, descending from revision 2.
  const oldText = await d1.page.evaluate(() => {
    const st = JSON.parse(JSON.stringify(HUM.S)); st.iteration = 2; st.ext.cloud.revision = 2;
    const bytes = new TextEncoder().encode(JSON.stringify(st));
    let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return 'HUM1.' + btoa(bin);
  });
  await d1.page.evaluate((t) => { HUM.UI.selectTab('settings'); document.getElementById('saveBox').value = t; HUM.UI.importSave(); }, oldText);
  await click(d1.page, 'Load save');
  await until(d1.page, () => document.querySelector('.modal h2') && document.querySelector('.modal h2').textContent === 'Two different saves');
  c.check('importing an older save while signed in never overwrites the account: the player is asked', JSON.parse(serverSave('mira').data).iteration === 4);
  await click(d1.page, 'Load my account’s progress');

  // Signing out uploads the latest progress first.
  await d1.page.evaluate(() => { HUM.S.run.salvage = 4242; });
  const revBefore = serverSave('mira').revision;
  await d1.page.evaluate(() => HUM.Exp.ask('account:service').logout());
  const last = serverSave('mira');
  c.check('signing out uploads the latest progress first', last.revision === revBefore + 1 && Math.floor(JSON.parse(last.data).run.salvage) >= 4242, [revBefore, last.revision]);

  // A session that ends: uploads stop and the game knows it is signed out.
  await d2.page.reload();
  await d2.page.waitForFunction(() => HUM.Exp.ask('account:service').state().status === 'signed-in');
  await settled(d2.page);
  if (await modal(d2.page)) await click(d2.page, 'Load my account’s progress');
  dbq("DELETE FROM sessions WHERE account_id = (SELECT id FROM accounts WHERE username_key = 'mira') RETURNING token_hash");
  await d2.page.evaluate(() => { HUM.S.run.salvage = 31; HUM.save(true); });
  await until(d2.page, () => HUM.Exp.ask('account:service').state().status === 'signed-out');
  const ended = { auth: await d2.page.evaluate(() => HUM.Exp.ask('account:service').state()), cloud: await cloud(d2.page) };
  c.check('when a session ends, the next upload is refused and the game knows it is signed out', ended.auth.reason === 'expired' && ended.cloud.status === 'off', ended);

  // Restoring an earlier version from the account.
  await d2.page.evaluate(() => HUM.Exp.ask('account:service').login('Mira', 'the wallpaper is moist'));
  await settled(d2.page);
  if (await modal(d2.page)) await click(d2.page, 'Load my account’s progress');
  await settled(d2.page);
  await d2.page.evaluate(() => { HUM.UI.selectTab('settings'); HUM.UI.update(true); });
  await d2.page.click('#acctSection button:has-text("Show earlier versions")').catch(() => {});
  const hasSection = await d2.page.evaluate(() => !!document.getElementById('acctSection'));
  if (!hasSection) {
    // The account interface is off in this suite, so the section is opened through its hook directly.
    await d2.page.evaluate(() => { const box = document.createElement('div'); box.id = 'csProbe'; document.getElementById('panel-settings').append(box); HUM.Exp.run('account:sections', (n) => box.append(n)); HUM.UI.update(); });
    await d2.page.click('#csProbe button:has-text("Show earlier versions")');
  }
  // The account's versions arrive from the server, while copies kept in this browser are listed at once (also as
  // .cs-item): wait for the account's list, and restore its newest version.
  await until(d2.page, () => [...document.querySelectorAll('.cs-item span')].some((s) => /^Revision \d+/.test(s.textContent)));
  const accountVersion = d2.page.locator('.cs-item', { hasText: /^Revision \d+/ }).first();
  const firstVersion = await accountVersion.locator('span').textContent();
  await accountVersion.locator('button').click();
  await until(d2.page, () => document.querySelector('.modal h2') && document.querySelector('.modal h2').textContent === 'Restore this progress?');
  const revR = serverSave('mira').revision;
  await click(d2.page, 'Restore');
  await until(d2.page, (r) => HUM.Exp.ask('cloud:state').status === 'synced' && HUM.S.ext.cloud.revision > r, revR);
  const restored = { iteration: await d2.page.evaluate(() => HUM.S.iteration), server: JSON.parse(serverSave('mira').data).iteration, rev: serverSave('mira').revision };
  c.check('an earlier version can be restored on purpose: it becomes this game and the account’s save', restored.rev === revR + 1 && restored.server === restored.iteration && /^Revision \d+/.test(firstVersion), { restored, firstVersion });

  // Switched off: nothing is uploaded, local saving goes on, the account's save is untouched.
  const keepRev = serverSave('mira').revision;
  await d2.page.evaluate(() => { HUM.Exp.set('EXP-CLOUD-SAVE', false); HUM.S.iteration = 99; HUM.save(true); });
  await d2.page.waitForTimeout(400);
  const offState = { server: serverSave('mira'), local: await d2.page.evaluate(() => JSON.parse(localStorage.getItem('the-hum.save')).iteration) };
  c.check('switched off, nothing is uploaded, this browser still saves, and the account’s save is untouched', offState.server.revision === keepRev && JSON.parse(offState.server.data).iteration !== 99 && offState.local === 99, { rev: offState.server.revision, keepRev, local: offState.local });
  await d2.page.evaluate(() => HUM.Exp.reset());

  await browser.close();
  await s.stop();
  c.finish(errors);
})();
