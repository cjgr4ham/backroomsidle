// EXP-NOCLIP-LEADERBOARD: noclips recorded once by the server, ranking, pagination and the browser's reporting.
const path = require('path');
const emitWarning = process.emitWarning;
process.emitWarning = (w, ...a) => (/SQLite is an experimental/.test(String((w && w.message) || w)) ? undefined : emitWarning.call(process, w, ...a));
const { DatabaseSync } = require('node:sqlite');
const { Checker, url: fileUrl } = require('./harness');
const { startServer, client, skipUnless } = require('./server-harness');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node22/lib/node_modules/playwright'); }
const NAME = 'EXP-NOCLIP-LEADERBOARD: server-recorded noclips and the ranking';
const hex = (n) => n.toString(16).padStart(32, '0');
const report = (lineage, iteration, run) => ({ lineage, iteration, run: { level: 3, exitFound: false, time: 600, salvage: 2e8, gain: 12, ...(run || {}) } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  if (skipUnless(['auth.js', 'leaderboard.js'], NAME)) return;
  const c = new Checker(NAME);
  const SETTINGS = JSON.stringify({ leaderboard: { minIntervalSec: 1, minRunSec: 10, perPage: 2 }, rate: { noclip: [500, 3600] } });
  const s = await startServer({ HUM_SETTINGS: SETTINGS });
  const dbq = (sql, ...a) => { const d = new DatabaseSync(path.join(s.dataDir, 'the-hum.db')); try { return d.prepare(sql).all(...a); } finally { d.close(); } };
  const PASS = 'pale light in every room';   // the policy forbids a password containing the username
  const account = async (name) => { const k = client(s.url); const r = await k.post('/api/auth/register', { username: name, password: PASS }); if (r.status !== 201) throw new Error(JSON.stringify(r.data)); return k; };

  // ------------------------------------------------------------- recording, exactly once
  const anon = await client(s.url).post('/api/noclips', report(hex(1), 1));
  c.check('reporting a noclip needs a signed-in account', anon.status === 401, anon.status);
  const A = await account('Wanderer_01');
  const r1 = await A.post('/api/noclips', report(hex(1), 1));
  const again = await A.post('/api/noclips', report(hex(1), 1));
  c.check('a reported noclip is recorded once; the same report again is a duplicate, not a second noclip', r1.status === 201 && r1.data.recorded && r1.data.noclips === 1 && r1.data.rank === 1 && again.status === 200 && again.data.duplicate && again.data.noclips === 1, [r1.data, again.data]);
  const soon = await A.post('/api/noclips', report(hex(1), 2));
  c.check('a second noclip too soon after the last one waits (429, with how long)', soon.status === 429 && soon.data.error === 'too_soon' && Number(soon.data.retryAfter) >= 1, soon.data);
  await sleep(1100);
  const forged = await A.post('/api/noclips', { ...report(hex(1), 2), noclips: 9999, total: 9999, count: 9999, rank: 1 });
  c.check('counts, totals and ranks in a report are ignored: the server adds exactly one', forged.status === 201 && forged.data.noclips === 2, forged.data);
  const invalid = [];
  for (const [lin, it, run, extra] of [[hex(1), 3, { level: 2 }], [hex(1), 3, { level: 4, exitFound: true }], [hex(1), 3, { gain: 0 }], [hex(1), 3, { time: 5 }], ['not-a-lineage', 3], [hex(1), 0], [hex(1), 3, { level: 5, exitFound: 'yes' }], [hex(1), 3, {}, { devMarked: true }]]) {
    invalid.push(await A.post('/api/noclips', { ...report(lin, it, run), ...(extra || {}) }));
  }
  c.check('reports that cannot be a noclip are refused: below Level 3, an exit off Level 5, no Déjà Vu, too short, no save, no iteration, bad fields; developer-tool saves (422)',
    JSON.stringify(invalid.map((r) => r.status)) === JSON.stringify([400, 400, 400, 400, 400, 400, 400, 422]), invalid.map((r) => [r.status, r.data.error]));
  const ev = dbq("SELECT COUNT(*) AS n FROM noclip_events e JOIN accounts a ON a.id = e.account_id WHERE a.username_key = 'wanderer_01'")[0].n;
  const tot = dbq("SELECT t.noclips FROM noclip_totals t JOIN accounts a ON a.id = t.account_id WHERE a.username_key = 'wanderer_01'")[0].noclips;
  c.check('the total always equals the recorded noclips', ev === 2 && tot === 2, { ev, tot });
  // The same save on another device, same iteration: still one noclip.
  const A2 = client(s.url);
  await A2.post('/api/auth/login', { username: 'Wanderer_01', password: PASS });
  await sleep(1100);
  const otherDevice = await A2.post('/api/noclips', report(hex(1), 2));
  c.check('the same noclip reported from another device of the same account counts once', otherDevice.status === 200 && otherDevice.data.duplicate && otherDevice.data.noclips === 2, otherDevice.data);

  // ------------------------------------------------------------- ranking
  const B = await account('LostSignal');
  const C = await account('YellowRoom');
  await account('NeverNoclipped');
  for (let i = 1; i <= 2; i++) { await B.post('/api/noclips', report(hex(2), i)); await sleep(1050); }
  for (let i = 1; i <= 3; i++) { await C.post('/api/noclips', report(hex(3), i)); await sleep(1050); }
  const p1 = await client(s.url).get('/api/leaderboard?page=1');
  const p2 = await B.get('/api/leaderboard?page=2');
  c.check('accounts are ranked by recorded noclips, most first', p1.data.entries.map((e) => `${e.rank}:${e.username}:${e.noclips}`).join() === '1:YellowRoom:3,2:Wanderer_01:2', p1.data.entries);
  c.check('on a tie, whoever reached the count first ranks higher', p2.data.entries.map((e) => `${e.rank}:${e.username}:${e.noclips}`).join() === '3:LostSignal:2', p2.data.entries);
  c.check('accounts without a recorded noclip are not listed, and every account appears once', p1.data.total === 3 && !JSON.stringify([p1.data, p2.data]).includes('NeverNoclipped'), p1.data.total);
  c.check('pages are numbered, and the signed-in player’s own rank is given even on another page', p1.data.pages === 2 && p2.data.page === 2 && p2.data.me.rank === 3 && p2.data.me.noclips === 2 && p2.data.entries[0].you === true && p1.data.me === null, [p2.data.me, p1.data.me]);
  const keys = new Set(p1.data.entries.flatMap((e) => Object.keys(e)));
  c.check('entries carry only rank, username, count and a "you" flag: no ids, hashes or save data', [...keys].sort().join() === 'noclips,rank,username,you', [...keys]);
  const meB = await B.get('/api/leaderboard/me');
  c.check('a player can ask for their own standing', meB.data.rank === 3 && meB.data.noclips === 2 && meB.data.total === 3, meB.data);
  dbq("UPDATE accounts SET disabled_at = 1 WHERE username_key = 'yellowroom' RETURNING id");
  const afterDisable = await A.get('/api/leaderboard?page=1');
  c.check('a disabled account leaves the ranking and everyone below moves up', afterDisable.data.entries[0].username === 'Wanderer_01' && afterDisable.data.entries[0].rank === 1 && afterDisable.data.total === 2, afterDisable.data.entries);
  await s.stop();

  // A server with one real account shows exactly that account.
  const solo = await startServer({ HUM_SETTINGS: SETTINGS });
  const empty = await client(solo.url).get('/api/leaderboard');
  const one = client(solo.url);
  await one.post('/api/auth/register', { username: 'OnlyOne', password: 'alone in the lobby' });
  await one.post('/api/noclips', report(hex(9), 1));
  const single = await client(solo.url).get('/api/leaderboard');
  c.check('with no noclips recorded the board is empty; with one account it shows that account alone, nothing invented', empty.data.total === 0 && empty.data.entries.length === 0 && single.data.total === 1 && single.data.entries.length === 1 && single.data.entries[0].username === 'OnlyOne', [empty.data, single.data.entries]);

  // ------------------------------------------------------------- the browser
  const browser = await playwright.chromium.launch();
  const errors = [];
  const watch = (page) => {
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource: (the server responded with a status of 4\d\d|net::ERR_FAILED)/.test(m.text())) errors.push(m.text()); });
  };
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const page = await ctx.newPage();
  watch(page);
  await page.goto(solo.url + '/?exp=-EXP-ACCOUNT-UI#debug');
  await page.waitForFunction(() => window.HUM && HUM.Exp.ask('account:service').state().status === 'signed-out');
  await page.evaluate(() => HUM.Exp.ask('account:service').register('Lantern', 'the corridor never ends'));
  await page.waitForFunction(() => HUM.Exp.ask('cloud:state') ? HUM.Exp.ask('cloud:state').status === 'synced' : true);
  const doNoclip = () => page.evaluate(() => { const H = HUM, r = H.S.run; H.rt.saveBlocked = false; Object.assign(r, { level: 3, rooms: 30000 }); r.stats.salvage = 1e9; r.stats.time = 900; return H.noclip(); });
  await page.evaluate(() => { HUM.UI.selectTab('archive'); document.querySelector('#panel-archive [data-id="lb"]').click(); });
  await page.waitForFunction(() => document.querySelector('.lb-list li'));
  const before = await page.evaluate(() => [...document.querySelectorAll('.lb-list li')].map((li) => li.textContent));
  await doNoclip();
  await page.waitForFunction(() => [...document.querySelectorAll('.lb-list li')].some((li) => /Lantern/.test(li.textContent)), null, { timeout: 8000 });
  const after = await page.evaluate(() => ({ rows: [...document.querySelectorAll('.lb-list li')].map((li) => li.textContent), mine: document.querySelector('.lb-mine').textContent, you: !!document.querySelector('.lb-list li.you'), source: document.querySelector('.lb-source').textContent, lineage: HUM.S.ext.lb && HUM.S.ext.lb.lineage }));
  c.check('a completed noclip while signed in is recorded, and the open leaderboard refreshes to show it', before.join() === '#1OnlyOne1 noclip' && after.rows.some((t) => /^#\d+Lantern1 noclip$/.test(t)) && after.you && /rank \d+, 1 noclip recorded/.test(after.mine), after);
  c.check('the leaderboard names its source: this server’s records', /this server’s records/.test(after.source) && /32/.test(String(after.lineage && after.lineage.length)), after.source);
  await page.reload();
  await page.waitForFunction(() => HUM.Exp.ask('account:service').state().status === 'signed-in');
  await page.waitForTimeout(400);
  const counted = dbq.call ? new DatabaseSync(path.join(solo.dataDir, 'the-hum.db')).prepare("SELECT COUNT(*) AS n FROM noclip_events e JOIN accounts a ON a.id = e.account_id WHERE a.username_key = 'lantern'").get().n : -1;
  c.check('reloading right after the noclip does not count it twice', counted === 1, counted);
  // The line this experiment offers the Records panel (EXP-NOCLIP-STATISTICS shows it there when present).
  const records = await page.evaluate(() => HUM.Exp.ask('noclip:records') || '');
  c.check('the line offered to the Noclip tab’s Records panel says what the server has recorded', /Leaderboard: 1 noclip recorded by the server, rank \d+/.test(records), records);

  // Offline: the report waits, then is sent.
  await page.route('**/api/noclips', (r) => r.abort());
  await sleep(1100);
  await doNoclip();
  await page.waitForTimeout(300);
  const queued = await page.evaluate(() => JSON.parse(localStorage.getItem('the-hum.noclip-reports') || '[]').length);
  await page.unroute('**/api/noclips');
  await page.reload();
  await page.waitForFunction(() => HUM.Exp.ask('account:service').state().status === 'signed-in');
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('the-hum.noclip-reports') || '[]').length === 0, null, { timeout: 8000 });
  const two = new DatabaseSync(path.join(solo.dataDir, 'the-hum.db')).prepare("SELECT t.noclips FROM noclip_totals t JOIN accounts a ON a.id = t.account_id WHERE a.username_key = 'lantern'").get().noclips;
  c.check('a noclip made while the server cannot be reached waits in this browser and is recorded later, once', queued === 1 && two === 2, { queued, two });

  // Developer tools: never reported.
  await sleep(1100);
  await page.evaluate(() => { HUM.S.ext.dev = { actions: 1, first: 1, last: 1, kinds: ['add salvage'] }; });
  await doNoclip();
  await page.waitForTimeout(400);
  const devCount = new DatabaseSync(path.join(solo.dataDir, 'the-hum.db')).prepare("SELECT t.noclips FROM noclip_totals t JOIN accounts a ON a.id = t.account_id WHERE a.username_key = 'lantern'").get().noclips;
  const devQueue = await page.evaluate(() => JSON.parse(localStorage.getItem('the-hum.noclip-reports') || '[]').length);
  c.check('a noclip in a save changed with developer tools is not reported', devCount === 2 && devQueue === 0, { devCount, devQueue });

  // Switched off: no tab, no reports; the save's own count and the server's records stay.
  await page.evaluate(() => { delete HUM.S.ext.dev; HUM.Exp.set('EXP-NOCLIP-LEADERBOARD', false); });
  await sleep(1100);
  const localBefore = await page.evaluate(() => HUM.S.life.noclips);
  await doNoclip();
  await page.waitForTimeout(400);
  const off = await page.evaluate(() => { HUM.UI.selectTab('archive'); HUM.UI.update(true); return { tab: !!document.querySelector('#panel-archive [data-id="lb"]'), local: HUM.S.life.noclips }; });
  const offCount = new DatabaseSync(path.join(solo.dataDir, 'the-hum.db')).prepare("SELECT t.noclips FROM noclip_totals t JOIN accounts a ON a.id = t.account_id WHERE a.username_key = 'lantern'").get().noclips;
  c.check('switched off, there is no Leaderboard tab and nothing is reported; the save’s own count still rises and the server keeps its records', !off.tab && off.local === localBefore + 1 && offCount === 2, { off, offCount });
  await page.evaluate(() => HUM.Exp.reset());

  // A copy without a server says so and shows no list.
  const local = await browser.newPage();
  watch(local);
  await local.goto(fileUrl(''));
  await local.waitForTimeout(300);
  const disk = await local.evaluate(() => { HUM.UI.selectTab('archive'); document.querySelector('#panel-archive [data-id="lb"]').click(); HUM.UI.update(true); return { status: document.querySelector('.lb-status').textContent, list: document.querySelector('.lb-list').hidden, items: document.querySelectorAll('.lb-list li').length }; });
  c.check('a copy without a server says there is no leaderboard here and lists nobody', /no leaderboard in this copy/.test(disk.status) && disk.list && disk.items === 0, disk);

  await browser.close();
  await solo.stop();
  c.finish(errors);
})();
