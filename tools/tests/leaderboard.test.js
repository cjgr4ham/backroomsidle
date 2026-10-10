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
// A report as the current game sends it: noclip opens only once the survey is complete, so the run is in Level FUN (6)
// with the exit found.
const report = (lineage, iteration, run) => ({ lineage, iteration, run: { level: 6, exitFound: true, time: 600, salvage: 2e8, gain: 12, ...(run || {}) } });
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
  // Where a noclip can come from: Level FUN, which only completing the survey reaches (so always with the exit), or,
  // from pages loaded before the update, Level 5 with the exit or Levels 3 to 5 without it. Nothing else.
  const levels = [];
  for (const run of [{ level: 6, exitFound: false }, { level: 4, exitFound: true }, { level: 3, exitFound: true }, { level: 0, exitFound: true },
    { level: 2, exitFound: false }, { level: 0, exitFound: false }, { level: 7, exitFound: true }, { level: 7, exitFound: false }, { level: -1, exitFound: false }]) {
    const r = await A.post('/api/noclips', report(hex(1), 3, run));
    levels.push([run.level, run.exitFound, r.status, r.data.error]);
  }
  c.check('refused (400): Level FUN without the exit, the exit below Level 5, below Level 3 without the exit, and any level past Level FUN',
    levels.every(([, , st, err]) => st === 400 && err === 'report_invalid'), levels);
  const invalid = [];
  for (const [lin, it, run, extra] of [[hex(1), 3, { gain: 0 }], [hex(1), 3, { time: 5 }], ['not-a-lineage', 3], [hex(1), 0], [hex(1), 3, { level: 5, exitFound: 'yes' }], [hex(1), 3, { level: 5.5, exitFound: false }], [hex(1), 3, {}, { devMarked: true }]]) {
    invalid.push(await A.post('/api/noclips', { ...report(lin, it, run), ...(extra || {}) }));
  }
  c.check('other reports that cannot be a noclip are refused: no Déjà Vu, too short, no save, no iteration, bad fields; developer-tool saves (422)',
    JSON.stringify(invalid.map((r) => r.status)) === JSON.stringify([400, 400, 400, 400, 400, 400, 422]), invalid.map((r) => [r.status, r.data.error]));
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
  // Their noclips come from every place a noclip is accepted from: pages loaded before the update (Levels 3 to 5
  // without the exit, Level 5 with it) and the current game (Level FUN with the exit).
  const kept = [];
  for (const [who, lin, runs] of [[B, hex(2), [{ level: 3, exitFound: false }, { level: 4, exitFound: false }]],
    [C, hex(3), [{ level: 5, exitFound: false }, { level: 5, exitFound: true }, { level: 6, exitFound: true }]]]) {
    for (let i = 0; i < runs.length; i++) { const r = await who.post('/api/noclips', report(lin, i + 1, runs[i])); kept.push([runs[i].level, runs[i].exitFound, r.status]); await sleep(1050); }
  }
  const stored = dbq("SELECT e.level, e.exit_found AS exit FROM noclip_events e JOIN accounts a ON a.id = e.account_id WHERE a.username_key IN ('lostsignal', 'yellowroom') ORDER BY e.id").map((e) => [e.level, e.exit === 1]);
  c.check('recorded: Level FUN with the exit, and from pages loaded before the update, Level 5 with the exit and Levels 3 to 5 without it; each as reported',
    kept.every(([, , st]) => st === 201) && JSON.stringify(stored) === JSON.stringify(kept.map(([lv, ex]) => [lv, ex])), { kept, stored });
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
  const soloq = (sql) => { const d = new DatabaseSync(path.join(solo.dataDir, 'the-hum.db')); try { return d.prepare(sql).all(); } finally { d.close(); } };
  const lanternEvents = () => soloq("SELECT e.level, e.exit_found AS exit FROM noclip_events e JOIN accounts a ON a.id = e.account_id WHERE a.username_key = 'lantern' ORDER BY e.id");
  const lanternTotal = () => (soloq("SELECT t.noclips FROM noclip_totals t JOIN accounts a ON a.id = t.account_id WHERE a.username_key = 'lantern'")[0] || { noclips: 0 }).noclips;
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const page = await ctx.newPage();
  watch(page);
  const posts = [];   // every noclip report this browser sends, as sent
  page.on('request', (q) => { if (q.method() === 'POST' && /\/api\/noclips$/.test(q.url())) posts.push(q.postDataJSON()); });
  await page.goto(solo.url + '/?exp=-EXP-ACCOUNT-UI#debug');
  await page.waitForFunction(() => window.HUM && HUM.Exp.ask('account:service').state().status === 'signed-out');
  await page.evaluate(() => HUM.Exp.ask('account:service').register('Lantern', 'the corridor never ends'));
  await page.waitForFunction(() => HUM.Exp.ask('cloud:state') ? HUM.Exp.ask('cloud:state').status === 'synced' : true);
  // A noclip as the game allows it now: the run maps the last room of Level 5, which completes the survey and leads into
  // Level FUN, and it noclips from there.
  const doNoclip = () => page.evaluate(() => {
    const H = HUM, r = H.S.run;
    H.rt.saveBlocked = false;
    if (!r.exitFound) { r.level = H.FINAL_LEVEL; H.completeFiniteSurvey(); }
    r.stats.salvage = 1e12; r.stats.time = 900;
    return H.noclip();
  });
  await page.evaluate(() => { HUM.UI.selectTab('archive'); document.querySelector('#panel-archive [data-id="lb"]').click(); });
  await page.waitForFunction(() => document.querySelector('.lb-list li'));
  const before = await page.evaluate(() => [...document.querySelectorAll('.lb-list li')].map((li) => li.textContent));
  // Noclip stays locked until the survey is complete. Mapping the last room of Level 5 completes it, opens noclip and
  // leads into Level FUN, but it is not a noclip: only noclip() counts one and reports it.
  const survey = await page.evaluate(async () => {
    const H = HUM, r = H.S.run;
    H.rt.saveBlocked = false;
    Object.assign(r, { level: H.FINAL_LEVEL, levelRooms: 0 });
    r.stats.salvage = 1e12; r.stats.time = 900;
    const locked = { can: H.canNoclip(), noclip: H.noclip(), gain: H.dvPreview() };
    H.addRooms(H.exitRooms(H.FINAL_LEVEL));
    await new Promise((res) => setTimeout(res, 600));
    return { locked, level: r.level, exitFound: r.exitFound, can: H.canNoclip(), noclips: H.S.life.noclips, iteration: H.S.iteration, dvTotal: H.S.dvTotal,
      queue: JSON.parse(localStorage.getItem('the-hum.noclip-reports') || '[]').length };
  });
  c.check('noclip stays locked on Level 5 until the survey is complete; mapping its last room opens noclip in Level FUN, but counts, queues and reports no noclip',
    !survey.locked.can && survey.locked.noclip === false && survey.locked.gain >= 1 && survey.level === 6 && survey.exitFound && survey.can
    && survey.noclips === 0 && survey.iteration === 1 && survey.dvTotal === 0 && survey.queue === 0 && posts.length === 0 && lanternTotal() === 0, { survey, posts });
  await doNoclip();
  await page.waitForFunction(() => [...document.querySelectorAll('.lb-list li')].some((li) => /Lantern/.test(li.textContent)), null, { timeout: 8000 });
  const after = await page.evaluate(() => ({ rows: [...document.querySelectorAll('.lb-list li')].map((li) => li.textContent), mine: document.querySelector('.lb-mine').textContent, you: !!document.querySelector('.lb-list li.you'), source: document.querySelector('.lb-source').textContent, lineage: HUM.S.ext.lb && HUM.S.ext.lb.lineage, dvTotal: HUM.S.dvTotal }));
  c.check('a completed noclip while signed in is recorded, and the open leaderboard refreshes to show it', before.join() === '#1OnlyOne1 noclip' && after.rows.some((t) => /^#\d+Lantern1 noclip$/.test(t)) && after.you && /rank \d+, 1 noclip recorded/.test(after.mine), after);
  c.check('the noclip is reported from Level FUN with the exit found, for the iteration that ended and the Déjà Vu it awarded, and recorded so',
    posts.length === 1 && posts[0].iteration === 1 && posts[0].run.level === 6 && posts[0].run.exitFound === true && posts[0].run.gain === after.dvTotal && after.dvTotal >= 1
    && JSON.stringify(lanternEvents()) === '[{"level":6,"exit":1}]', { posts, events: lanternEvents(), dvTotal: after.dvTotal });
  c.check('the leaderboard names its source: this server’s records', /this server’s records/.test(after.source) && /32/.test(String(after.lineage && after.lineage.length)), after.source);
  await page.reload();
  await page.waitForFunction(() => HUM.Exp.ask('account:service').state().status === 'signed-in');
  await page.waitForTimeout(400);
  const counted = lanternEvents().length;
  c.check('reloading right after the noclip does not count it twice', counted === 1 && lanternTotal() === 1, counted);
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
  const two = lanternTotal();
  c.check('a noclip made while the server cannot be reached waits in this browser and is recorded later, once', queued === 1 && two === 2 && lanternEvents().length === 2, { queued, two });

  // Developer tools: never reported. Here the survey is completed with the developer menu's own action, which opens
  // noclip and marks the save.
  await sleep(1100);
  const sentBeforeDev = posts.length;
  await page.evaluate(() => HUM.UI.selectTab('settings'));
  await page.click('#set-dev');
  await page.evaluate(() => HUM.UI.selectTab('dev'));
  await page.click('#panel-dev button:text-is("Complete the survey")');
  await page.click('.modal button:has-text("Change this save")');
  const devMark = await page.evaluate(() => ({ level: HUM.S.run.level, exitFound: HUM.S.run.exitFound, kinds: (HUM.S.ext.dev || { kinds: [] }).kinds }));
  const devDone = await doNoclip();
  await page.waitForTimeout(400);
  const devCount = lanternTotal();
  const devQueue = await page.evaluate(() => JSON.parse(localStorage.getItem('the-hum.noclip-reports') || '[]').length);
  c.check('a noclip in a save changed with developer tools (here: the survey completed from the Dev tab) is not reported', devMark.level === 6 && devMark.exitFound && devMark.kinds.includes('exit') && devDone === true && devCount === 2 && devQueue === 0 && posts.length === sentBeforeDev,
    { devMark, devDone, devCount, devQueue, sent: posts.length - sentBeforeDev });

  // Switched off: no tab, no reports; the save's own count and the server's records stay.
  await page.evaluate(() => { delete HUM.S.ext.dev; HUM.Exp.set('EXP-NOCLIP-LEADERBOARD', false); });
  await sleep(1100);
  const localBefore = await page.evaluate(() => HUM.S.life.noclips);
  const sentBeforeOff = posts.length;
  await doNoclip();
  await page.waitForTimeout(400);
  const off = await page.evaluate(() => { HUM.UI.selectTab('archive'); HUM.UI.update(true); return { tab: !!document.querySelector('#panel-archive [data-id="lb"]'), local: HUM.S.life.noclips }; });
  const offCount = lanternTotal();
  c.check('switched off, there is no Leaderboard tab and nothing is reported; the save’s own count still rises and the server keeps its records', !off.tab && off.local === localBefore + 1 && offCount === 2 && posts.length === sentBeforeOff, { off, offCount, sent: posts.length - sentBeforeOff });
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
