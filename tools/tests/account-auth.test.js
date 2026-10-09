// EXP-ACCOUNT-AUTH: registration, sign-in, sessions and their protections, against the real server, and the
// browser side restoring a session after a refresh.
const path = require('path');
const emitWarning = process.emitWarning;
process.emitWarning = (w, ...a) => (/SQLite is an experimental/.test(String((w && w.message) || w)) ? undefined : emitWarning.call(process, w, ...a));
const { DatabaseSync } = require('node:sqlite');
const { Checker, url: fileUrl } = require('./harness');
const { startServer, client, skipUnless } = require('./server-harness');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node22/lib/node_modules/playwright'); }
const NAME = 'EXP-ACCOUNT-AUTH: accounts, sessions and their protections';

(async () => {
  if (skipUnless(['auth.js'], NAME)) return;
  const c = new Checker(NAME);
  const s = await startServer({ HUM_SETTINGS: JSON.stringify({ rate: { login: [4, 60], register: [30, 60] } }) });
  const db = () => new DatabaseSync(path.join(s.dataDir, 'the-hum.db'));
  const a = client(s.url);
  const PW = 'yellow wallpaper hums';

  // ------------------------------------------------------------- registration
  const reg = await a.post('/api/auth/register', { username: 'Wanderer_01', password: PW });
  const sc = reg.setCookies[0] || '';
  c.check('registration creates the account and signs in', reg.status === 201 && reg.data.user.username === 'Wanderer_01', reg.data);
  c.check('the session cookie is HttpOnly, SameSite=Lax, site-wide and long-lived, and not Secure over plain HTTP',
    /^hum_session=[A-Za-z0-9_-]{43};/.test(sc) && /HttpOnly/.test(sc) && /SameSite=Lax/.test(sc) && /Path=\//.test(sc) && /Max-Age=2592000/.test(sc) && !/Secure/.test(sc), sc);
  const dup = await client(s.url).post('/api/auth/register', { username: 'wanderer_01', password: 'another long passphrase' });
  c.check('the same username in another case is refused as taken', dup.status === 409 && dup.data.error === 'username_taken' && /taken/.test(dup.data.message), dup.data);
  const race = await Promise.all([1, 2, 3, 4, 5].map(() => client(s.url).post('/api/auth/register', { username: 'LostSignal', password: 'static on every channel' })));
  c.check('five simultaneous registrations of one name create exactly one account (the database enforces it)',
    race.filter((r) => r.status === 201).length === 1 && race.filter((r) => r.status === 409).length === 4, race.map((r) => r.status));
  const bad = await Promise.all(['ab', 'a b', '<b>x</b>', 'x'.repeat(21), '___', 'Admin', '', 'émile'].map((u) => client(s.url).post('/api/auth/register', { username: u, password: PW })));
  c.check('usernames outside the rules are refused with a reason (length, characters, reserved names)',
    bad.every((r) => r.status === 400 && /^username_/.test(r.data.error) && r.data.message.length > 10), bad.map((r) => [r.status, r.data.error]));
  const pw = await Promise.all([['short', 'abc12345'], ['name', 'my name is GhostPilot ok'], ['common', 'Password123'], ['repeat', 'zzzzzzzzzzzz'], ['long', 'x'.repeat(201)], ['type', 12345678901]]
    .map(([, p]) => client(s.url).post('/api/auth/register', { username: 'GhostPilot', password: p })));
  c.check('the password policy is enforced with a reason: length, username inside, common, repeated, too long, not text',
    JSON.stringify(pw.map((r) => r.data.error)) === JSON.stringify(['password_short', 'password_username', 'password_common', 'password_common', 'password_long', 'password_invalid']), pw.map((r) => r.data));

  // ------------------------------------------------------------- storage
  const d1 = db();
  const acc = d1.prepare("SELECT username, username_key, password_hash FROM accounts WHERE username_key = 'wanderer_01'").get();
  const sessions = d1.prepare('SELECT token_hash FROM sessions').all();
  d1.close();
  const token = sc.split(';')[0].split('=')[1];
  c.check('the password is stored only as a salted scrypt hash', /^scrypt\$15\$8\$3\$[A-Za-z0-9+/=]{24}\$[A-Za-z0-9+/=]{88}$/.test(acc.password_hash) && !acc.password_hash.includes(PW), acc.password_hash.slice(0, 20));
  c.check('sessions are stored as SHA-256 hashes, never the cookie’s token', sessions.length >= 2 && sessions.every((r) => /^[0-9a-f]{64}$/.test(r.token_hash) && r.token_hash !== token), sessions.length);

  // ------------------------------------------------------------- sessions, sign-in, sign-out
  const me = await a.get('/api/auth/session');
  const anon = await client(s.url).get('/api/auth/session');
  c.check('the session cookie identifies the account; without it there is no account', me.data.user && me.data.user.username === 'Wanderer_01' && anon.data.user === null, [me.data, anon.data]);
  const b = client(s.url);
  const t0 = Date.now(); const wrong = await b.post('/api/auth/login', { username: 'Wanderer_01', password: 'not the password!' }); const tWrong = Date.now() - t0;
  const t1 = Date.now(); const ghost = await b.post('/api/auth/login', { username: 'nobody_here', password: 'not the password!' }); const tGhost = Date.now() - t1;
  c.check('a wrong password and an unknown username fail the same way, without saying which', wrong.status === 401 && ghost.status === 401 && wrong.data.message === 'Wrong username or password.' && ghost.data.message === wrong.data.message, [wrong.data, ghost.data]);
  c.check('an unknown username takes as long to refuse as a wrong password (both run the hash)', tGhost > 0.5 * tWrong && tWrong > 0.5 * tGhost, { tWrong, tGhost });
  const good = await b.post('/api/auth/login', { username: 'WANDERER_01', password: PW });
  c.check('signing in works with any case of the username and returns the name as registered', good.status === 200 && good.data.user.username === 'Wanderer_01' && !!b.jar.hum_session, good.data);
  const out = await b.post('/api/auth/logout', {});
  const after = await b.get('/api/auth/session');
  const reuse = await client(s.url).get('/api/auth/session', { Cookie: `hum_session=${good.setCookies[0].split(';')[0].split('=')[1]}` });
  c.check('signing out ends the session on the server: the old cookie no longer works', out.status === 200 && after.data.user === null && reuse.data.user === null, [after.data, reuse.data]);
  const cross = await client(s.url).post('/api/auth/login', { username: 'Wanderer_01', password: PW }, { Origin: 'https://evil.example' });
  c.check('a sign-in posted from another site is refused', cross.status === 403, cross.status);

  // ------------------------------------------------------------- rate limits, disabled and expired accounts, stronger hashes
  const rl = client(s.url);
  const tries = [];
  for (let i = 0; i < 5; i++) tries.push(await rl.post('/api/auth/login', { username: 'LostSignal', password: `wrong guess ${i}xx` }));
  const last = tries[4];
  c.check('repeated sign-in attempts are rate-limited, with a time to wait', tries.slice(0, 4).every((r) => r.status === 401) && last.status === 429 && last.data.error === 'rate_limited' && Number(last.headers.get('retry-after')) > 0, tries.map((r) => r.status));
  const gone = client(s.url);
  await gone.post('/api/auth/register', { username: 'FadedOut', password: 'nobody remembers me' });
  const d2 = db();
  d2.prepare("UPDATE accounts SET disabled_at = ? WHERE username_key = 'fadedout'").run(Date.now());
  d2.close();
  const disLogin = await client(s.url).post('/api/auth/login', { username: 'FadedOut', password: 'nobody remembers me' });
  const disSession = await gone.get('/api/auth/session');
  c.check('a disabled account cannot sign in (the refusal does not say why) and its open session ends',
    disLogin.status === 401 && disLogin.data.message === 'Wrong username or password.' && disSession.data.user === null, [disLogin.status, disLogin.data, disSession.data]);
  const exp = client(s.url);
  await exp.post('/api/auth/register', { username: 'YellowRoom', password: 'humming in the walls' });
  const d3 = db();
  d3.prepare('UPDATE sessions SET expires_at = ? WHERE account_id = (SELECT id FROM accounts WHERE username_key = ?)').run(Date.now() - 1, 'yellowroom');
  d3.close();
  const expired = await exp.get('/api/auth/session');
  c.check('an expired session no longer signs anyone in, and its cookie is cleared', expired.data.user === null && expired.setCookies.some((x) => /Max-Age=0/.test(x)), expired.data);
  // A hash made with weaker settings is replaced at the next successful sign-in.
  const crypto = require('crypto');
  const salt = crypto.randomBytes(16);
  const weak = `scrypt$14$8$1$${salt.toString('base64')}$${crypto.scryptSync('humming in the walls', salt, 64, { N: 16384, r: 8, p: 1 }).toString('base64')}`;
  const d4 = db(); d4.prepare("UPDATE accounts SET password_hash = ? WHERE username_key = 'yellowroom'").run(weak); d4.close();
  const relog = await client(s.url).post('/api/auth/login', { username: 'YellowRoom', password: 'humming in the walls' });
  const d5 = db(); const rehashed = d5.prepare("SELECT password_hash FROM accounts WHERE username_key = 'yellowroom'").get().password_hash; d5.close();
  c.check('a weaker stored hash still signs in once and is replaced by a hash with the current settings', relog.status === 200 && rehashed.startsWith('scrypt$15$8$3$'), rehashed.slice(0, 16));

  // ------------------------------------------------------------- the browser: the session survives a refresh
  const browser = await playwright.chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/status of 40[19]/.test(m.text())) errors.push(m.text()); });
  const game = s.url + '/?exp=none,EXP-ACCOUNT-AUTH#debug';
  await page.goto(game);
  const state = () => page.evaluate(async () => { for (let i = 0; i < 50 && HUM.Exp.ask('account:service').state().status === 'checking'; i++) await new Promise((r) => setTimeout(r, 50)); return HUM.Exp.ask('account:service').state(); });
  const st0 = await state();
  c.check('in a browser with no session, the game finds the server and reports "signed out"', st0.status === 'signed-out' && st0.features.includes('EXP-ACCOUNT-AUTH'), st0);
  const regd = await page.evaluate(() => HUM.Exp.ask('account:service').register('SurveyorNine', 'the lights hum at sixty hertz'));
  const st1 = await state();
  const visible = await page.evaluate(() => document.cookie);
  c.check('registering in the browser signs in, and the page cannot read the session cookie', regd.ok && st1.status === 'signed-in' && st1.user.username === 'SurveyorNine' && !/hum_session/.test(visible), { st1, visible });
  await page.reload();
  const st2 = await state();
  c.check('after a refresh the session is restored without signing in again', st2.status === 'signed-in' && st2.reason === 'restored' && st2.user.username === 'SurveyorNine', st2);
  const ctx2 = await browser.newContext();
  const p2 = await ctx2.newPage();
  await p2.goto(game);
  const other = await p2.evaluate(async () => { for (let i = 0; i < 50 && HUM.Exp.ask('account:service').state().status === 'checking'; i++) await new Promise((r) => setTimeout(r, 50)); return HUM.Exp.ask('account:service').state().status; });
  c.check('another browser profile is not signed in by this one’s session', other === 'signed-out', other);
  await ctx2.close();
  await page.evaluate(() => HUM.Exp.ask('account:service').logout());
  await page.reload();
  const st3 = await state();
  c.check('signing out in the browser is final: after a refresh it is still signed out', st3.status === 'signed-out', st3);
  const bad2 = await page.evaluate(() => HUM.Exp.ask('account:service').login('SurveyorNine', 'wrong password here'));
  c.check('a failed sign-in in the browser reports the server’s reason and stays signed out', !bad2.ok && bad2.data.message === 'Wrong username or password.' && (await state()).status === 'signed-out', bad2.data);
  // Opened from disk there is no server: nothing is requested and accounts are unavailable.
  const local = await browser.newPage();
  const requests = [];
  local.on('request', (r) => requests.push(r.url()));
  await local.goto(fileUrl('?exp=none,EXP-ACCOUNT-AUTH'));
  await local.waitForTimeout(300);
  const st4 = await local.evaluate(() => HUM.Exp.ask('account:service').state().status);
  c.check('opened from disk, accounts are unavailable and nothing is requested', st4 === 'none' && requests.every((u) => u.startsWith('file:')), { st4, requests: requests.filter((u) => !u.startsWith('file:')) });
  // The server stops: the game says it cannot reach it, and keeps saving locally.
  await s.stop();
  await page.reload().catch(() => {});
  await browser.close();

  const s2 = await startServer({}, s.dataDir);
  const log = s.output() + s2.output();
  await s2.stop();
  c.check('the server log never contains passwords or session tokens', !log.includes(PW) && !log.includes('the lights hum') && !log.includes(token), '');
  c.finish(errors);
})();
