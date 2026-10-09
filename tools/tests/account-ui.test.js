// EXP-ACCOUNT-UI: the sign-in screen, the header chip and Settings → Account, in a browser against the real server.
const { Checker, url: fileUrl } = require('./harness');
const { startServer, skipUnless } = require('./server-harness');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node22/lib/node_modules/playwright'); }
const NAME = 'EXP-ACCOUNT-UI: sign-in screen, header and Settings → Account';

(async () => {
  if (skipUnless(['auth.js'], NAME)) return;
  const c = new Checker(NAME);
  const s = await startServer({});
  const browser = await playwright.chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 860 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // The browser logs every 4xx reply (a refused password, a taken name) and the connection this test cuts on purpose.
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource: (the server responded with a status of 4\d\d|net::ERR_FAILED)/.test(m.text())) errors.push(m.text()); });
  const game = s.url + '/#debug';
  const settle = () => page.waitForFunction(() => window.HUM && HUM.Exp.ask('account:service') && HUM.Exp.ask('account:service').state().status !== 'checking').then(() => page.waitForTimeout(80));
  const view = () => page.evaluate(() => {
    const m = document.querySelector('.modal');
    const chip = document.querySelector('.acct-chip');
    return { dialog: m ? m.querySelector('h2').textContent : null, note: m ? (m.querySelector('.acct-note') || {}).textContent || null : null, err: m ? (m.querySelector('.acct-err') || {}).textContent : null,
      chip: chip && !chip.hidden ? chip.textContent : null, status: HUM.Exp.ask('account:service').state().status };
  });

  await page.goto(game);
  await settle();
  const first = await view();
  c.check('a first visit with no session opens the sign-in screen, and the header offers "Sign in"', first.dialog === 'Survey terminal: sign in' && first.chip === 'Sign in' && first.status === 'signed-out', first);
  const focus = await page.evaluate(() => document.activeElement && document.activeElement.id);
  c.check('the username field has the focus', focus === 'acctUser', focus);

  await page.click('.modal button:has-text("Play offline")');
  await page.reload();
  await settle();
  const offline = await view();
  c.check('"Play offline" closes it, and it does not return on refresh (the choice is kept in this browser)', offline.dialog === null && offline.chip === 'Sign in', offline);

  // Registration through the screen, with the policy and its errors.
  await page.click('.acct-chip');
  await page.click('.acct-mode [data-mode="register"]');
  const policy = await page.evaluate(() => !document.querySelector('.acct-policy').hidden && document.getElementById('acctPass').autocomplete);
  c.check('"Create account" shows the username and password rules and asks for a new password', policy === 'new-password', policy);
  await page.fill('#acctUser', 'Lantern');
  await page.fill('#acctPass', 'short');
  await page.press('#acctPass', 'Enter');
  await page.waitForFunction(() => document.querySelector('.acct-err').textContent !== '');
  const shortPw = await view();
  c.check('Enter submits; a password that breaks the policy is explained and the screen stays open', /at least 10 characters/.test(shortPw.err) && shortPw.dialog !== null, shortPw);
  await page.fill('#acctPass', 'the corridor never ends');
  await page.click('.modal button[type="submit"]');
  await page.waitForFunction(() => !document.querySelector('.modal'));
  await page.waitForTimeout(80);
  const signedIn = await view();
  c.check('a valid account closes the screen and the header shows the username', signedIn.dialog === null && signedIn.chip === 'Lantern' && signedIn.status === 'signed-in', signedIn);
  await page.reload();
  await settle();
  const restored = await view();
  c.check('after a refresh the player is still signed in and no sign-in screen appears', restored.dialog === null && restored.chip === 'Lantern' && restored.status === 'signed-in', restored);
  const settings = await page.evaluate(() => { HUM.UI.selectTab('settings'); HUM.UI.update(true); const n = document.getElementById('acctSection'); return n ? n.textContent : ''; });
  c.check('Settings → Account shows who is signed in', /Signed in as Lantern/.test(settings), settings);

  // A second account with the same name is refused on screen.
  const ctx2 = await browser.newContext();
  const p2 = await ctx2.newPage();
  await p2.goto(game);
  await p2.waitForSelector('.modal');
  await p2.click('.acct-mode [data-mode="register"]');
  await p2.fill('#acctUser', 'lantern');
  await p2.fill('#acctPass', 'another corridor entirely');
  await p2.click('.modal button[type="submit"]');
  await p2.waitForFunction(() => document.querySelector('.acct-err').textContent !== '');
  const taken = await p2.evaluate(() => document.querySelector('.acct-err').textContent);
  c.check('registering a taken username (any case) says so', /taken/.test(taken), taken);
  await p2.click('.acct-mode [data-mode="login"]');
  await p2.fill('#acctUser', 'LANTERN');
  await p2.fill('#acctPass', 'wrong password entirely');
  await p2.click('.modal button[type="submit"]');
  await p2.waitForFunction(() => document.querySelector('.acct-err').textContent !== '');
  const wrong = await p2.evaluate(() => document.querySelector('.acct-err').textContent);
  c.check('a wrong password is refused on screen without saying which part was wrong', wrong === 'Wrong username or password.', wrong);
  await p2.fill('#acctPass', 'the corridor never ends');
  await p2.click('.modal button[type="submit"]');
  await p2.waitForFunction(() => !document.querySelector('.modal'));
  const chip2 = await p2.evaluate(() => document.querySelector('.acct-chip').textContent);
  c.check('signing in with the right password from another browser works', chip2 === 'Lantern', chip2);
  await ctx2.close();

  // Signing out returns to the sign-in screen, deliberately.
  await page.click('#acctSection button:has-text("Sign out")');
  await page.waitForSelector('.modal');
  const out = await view();
  c.check('signing out opens the sign-in screen with a note, and the header offers "Sign in" again', out.dialog === 'Survey terminal: sign in' && /You signed out/.test(out.note || '') && out.chip === 'Sign in', out);
  await page.reload();
  await settle();
  const outAgain = await view();
  c.check('after signing out, a refresh shows the sign-in screen again', outAgain.dialog !== null && outAgain.status === 'signed-out', outAgain);

  // A session that ends while playing.
  const expired = await page.evaluate(() => {
    HUM.UI.closeModal();
    HUM.Exp.run('account:changed', { status: 'signed-out', user: null, reason: 'expired', features: [], message: '' });
    const m = document.querySelector('.modal');
    return m ? m.querySelector('.acct-note').textContent : null;
  });
  c.check('when a session ends, the screen says so and asks to sign in again', /session has ended/.test(expired || ''), expired);
  // Another dialog is never replaced: the screen waits for it.
  const waits = await page.evaluate(async () => {
    HUM.UI.closeModal();
    HUM.UI.modal({ title: 'Another dialog', body: [], actions: [{ label: 'OK' }] });
    HUM.Exp.run('account:changed', { status: 'signed-out', user: null, reason: 'logout', features: [], message: '' });
    const during = document.querySelector('.modal h2').textContent;
    HUM.UI.closeModal();
    HUM.UI.update();
    await new Promise((r) => setTimeout(r, 30));
    const after = document.querySelector('.modal h2') ? document.querySelector('.modal h2').textContent : null;
    HUM.UI.closeModal();
    return { during, after };
  });
  c.check('the sign-in screen never replaces another open dialog; it opens once that one closes', waits.during === 'Another dialog' && waits.after === 'Survey terminal: sign in', waits);

  // Usernames are inserted as text.
  const escaped = await page.evaluate(() => {
    const E = HUM.Exp;
    E.define({ id: 'EXP-PROBE-NAME', name: 'probe', defaultOn: true });
    E.hook('account:service', 'EXP-PROBE-NAME', () => ({ state: () => ({ status: 'signed-in', user: { username: '<img src=x onerror="window.pwned=1">' }, reason: '', features: [] }), api: async () => ({ ok: false, status: 0, data: {} }), has: () => false }), -100);
    HUM.UI.update(true);
    const chip = document.querySelector('.acct-chip');
    HUM.UI.selectTab('settings'); HUM.UI.update(true);
    const sec = document.getElementById('acctSection');
    const res = { chipText: chip.textContent, chipImg: !!chip.querySelector('img'), secImg: !!sec.querySelector('img'), pwned: !!window.pwned };
    E.set('EXP-PROBE-NAME', false);
    return res;
  });
  c.check('a username is always shown as text, never as markup', escaped.chipText === '<img src=x onerror="window.pwned=1">' && !escaped.chipImg && !escaped.secImg && !escaped.pwned, escaped);

  // The server cannot be reached.
  await page.route('**/api/health', (r) => r.abort());
  await page.reload();
  await settle();
  const down = await page.evaluate(() => { HUM.UI.selectTab('settings'); HUM.UI.update(true); return { chip: document.querySelector('.acct-chip').textContent, text: document.getElementById('acctSection').textContent, dialog: !!document.querySelector('.modal') }; });
  c.check('when the server cannot be reached the header and Settings say so, and no sign-in screen blocks play', down.chip === 'Server unreachable' && /cannot be reached/.test(down.text) && !down.dialog, down);
  await page.unroute('**/api/health');
  await page.click('#acctSection button:has-text("Try again")');
  await page.waitForSelector('.modal');
  c.check('"Try again" reaches the server and offers to sign in', (await view()).status === 'signed-out');
  await page.click('.modal button:has-text("Play offline")');

  // Phone width.
  const phone = await browser.newContext({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true });
  const pp = await phone.newPage();
  await pp.goto(game);
  await pp.waitForSelector('.modal');
  const fits = await pp.evaluate(() => {
    const m = document.querySelector('.modal').getBoundingClientRect();
    const inputs = [...document.querySelectorAll('.acct-input')].map((n) => n.getBoundingClientRect().width);
    return { inside: m.left >= 0 && m.right <= window.innerWidth, noScroll: document.documentElement.scrollWidth <= window.innerWidth + 1, inputs };
  });
  c.check('at phone width the sign-in screen fits, with full-width fields', fits.inside && fits.noScroll && fits.inputs.every((w) => w > 250), fits);
  await phone.close();

  // A copy opened from disk: no chip, no screen, and Settings says why.
  const local = await browser.newPage();
  await local.goto(fileUrl(''));
  await local.waitForTimeout(300);
  const disk = await local.evaluate(() => { HUM.UI.selectTab('settings'); HUM.UI.update(true); return { chip: !document.querySelector('.acct-chip').hidden, dialog: !!document.querySelector('.modal'), text: document.getElementById('acctSection').textContent }; });
  c.check('opened from disk there is no sign-in screen or header chip, and Settings explains that accounts need the server', !disk.chip && !disk.dialog && /runs without its server/.test(disk.text), disk);

  // Switched off: no screen and no chip, even signed out.
  const offCtx = await browser.newContext();
  const op = await offCtx.newPage();
  await op.goto(s.url + '/?exp=-EXP-ACCOUNT-UI#debug');
  await op.waitForTimeout(500);
  const offUi = await op.evaluate(() => ({ dialog: !!document.querySelector('.modal'), chip: !document.querySelector('.acct-chip').hidden, status: HUM.Exp.ask('account:service').state().status }));
  c.check('switched off, there is no sign-in screen or chip, while accounts themselves still work', !offUi.dialog && !offUi.chip && offUi.status === 'signed-out', offUi);
  await offCtx.close();

  await browser.close();
  await s.stop();
  c.finish(errors);
})();
