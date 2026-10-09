// EXP-CORE (server): the game server without account features: the page and its security headers, the API
// envelope, request limits, the cross-site guard, HTTPS enforcement, feature loading and migrations.
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
// node:sqlite warns that it is experimental on first use; that is expected here.
const emitWarning = process.emitWarning;
process.emitWarning = (w, ...a) => (/SQLite is an experimental/.test(String((w && w.message) || w)) ? undefined : emitWarning.call(process, w, ...a));
const { DatabaseSync } = require('node:sqlite');
const { Checker } = require('./harness');
const { startServer, client, ROOT } = require('./server-harness');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node22/lib/node_modules/playwright'); }

(async () => {
  const c = new Checker('Server core: page, API envelope, limits, feature loading and migrations');

  // Probe features in a folder of their own: one with a table and two routes, one whose requirement is missing.
  const fdir = fs.mkdtempSync(path.join(os.tmpdir(), 'the-hum-features-'));
  fs.writeFileSync(path.join(fdir, 'a-probe.js'), `module.exports = {
    id: 'EXP-PROBE',
    migrations: [{ version: 1, sql: 'CREATE TABLE probe (x INTEGER)' }],
    setup(ctx) {
      return { routes: [
        { method: 'POST', path: '/api/probe', body: 200, handler: async ({ body }) => { ctx.db.prepare('INSERT INTO probe (x) VALUES (1)').run(); return { json: { got: body } }; } },
        { method: 'GET', path: '/api/probe/*', handler: async ({ rest }) => ({ json: { rest } }) },
      ] };
    },
  };`);
  fs.writeFileSync(path.join(fdir, 'b-needs.js'), "module.exports = { id: 'EXP-NEEDS', requires: ['EXP-MISSING'], setup() { throw new Error('must not load'); } };");

  const s = await startServer({ HUM_FEATURES_DIR: fdir });
  const api = client(s.url);
  const health = await api.get('/api/health');
  c.check('the health endpoint names the service and the features that loaded', health.status === 200 && health.data.service === 'the-hum' && JSON.stringify(health.data.features) === '["EXP-PROBE"]', health.data);
  c.check('a feature whose requirement is missing is not loaded and says why', /EXP-NEEDS: not loaded, it needs EXP-MISSING/.test(s.output()), s.output());

  // The page.
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const script = /<script>([\s\S]*?)<\/script>/.exec(html)[1];
  const hash = crypto.createHash('sha256').update(script, 'utf8').digest('base64');
  const pg = await fetch(s.url + '/');
  const csp = pg.headers.get('content-security-policy') || '';
  c.check('the game page is served as HTML, exactly as in the repository plus the server’s mark', pg.status === 200 && /text\/html/.test(pg.headers.get('content-type')) && (await pg.text()) === html.replace('<head>', '<head>\n<meta name="the-hum-server" content="1">'), pg.status);
  c.check('its Content-Security-Policy allows only the page’s own script, by hash, and no other origin',
    csp.includes(`script-src 'sha256-${hash}'`) && csp.includes("default-src 'none'") && csp.includes("connect-src 'self'") && csp.includes("frame-ancestors 'none'") && !/unsafe-eval|\*/.test(csp), csp);
  c.check('security headers are set', pg.headers.get('x-content-type-options') === 'nosniff' && pg.headers.get('referrer-policy') === 'no-referrer' && pg.headers.get('x-frame-options') === 'DENY', [...pg.headers]);
  const head = await fetch(s.url + '/', { method: 'HEAD' });
  c.check('HEAD answers without a body', head.status === 200 && (await head.text()) === '', head.status);
  const stray = await Promise.all(['/server/server.js', '/%2e%2e/server/db.js', '/data/the-hum.db', '/package.json', '/INDEX.HTML', '/index.htm', '/.git/config'].map(async (p) => (await fetch(s.url + p)).status));
  c.check('nothing but the page is served: server files, the database and other paths are 404', stray.every((x) => x === 404), stray);

  // The API envelope.
  const nf = await api.get('/api/nope');
  const na = await api.call('DELETE', '/api/probe');
  c.check('unknown API paths are 404 and wrong methods 405, as JSON', nf.status === 404 && nf.data.error === 'not_found' && na.status === 405 && na.data.error === 'method_not_allowed', [nf.data, na.data]);
  c.check('API responses are never cached', nf.headers.get('cache-control') === 'no-store');
  const ok = await api.post('/api/probe', { a: 1 });
  c.check('a feature route receives the parsed JSON body', ok.status === 200 && ok.data.got.a === 1, ok.data);
  const pref = await api.get('/api/probe/some%20thing');
  c.check('prefix routes receive the rest of the path', pref.status === 200 && pref.data.rest === 'some thing', pref.data);
  const t415 = await api.call('POST', '/api/probe', 'a=1', { 'Content-Type': 'application/x-www-form-urlencoded' });
  const t413 = await api.post('/api/probe', { pad: 'x'.repeat(500) });
  const t400 = await api.call('POST', '/api/probe', '{not json', { 'Content-Type': 'application/json' });
  c.check('bodies must be JSON objects within the route’s size limit (415, 413, 400)', t415.status === 415 && t413.status === 413 && t400.status === 400, [t415.status, t413.status, t400.status]);
  const cross = await api.post('/api/probe', { a: 2 }, { Origin: 'http://evil.example' });
  const fetchSite = await api.post('/api/probe', { a: 3 }, { 'Sec-Fetch-Site': 'cross-site' });
  const same = await api.post('/api/probe', { a: 4 }, { Origin: s.url });
  c.check('state-changing requests from other sites are refused; same-origin ones pass', cross.status === 403 && cross.data.error === 'cross_origin' && fetchSite.status === 403 && same.status === 200, [cross.status, fetchSite.status, same.status]);

  // The page runs under that policy in a real browser.
  const browser = await playwright.chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(s.url + '/#debug');
  await page.waitForTimeout(400);
  const game = await page.evaluate(async () => {
    const H = window.HUM;
    if (!H) return { ok: false };
    H.rt.lastSurveyReal = -1e9;
    document.getElementById('btnSurvey').click();
    const cv = document.getElementById('view'), a = cv.toDataURL();
    await new Promise((r) => setTimeout(r, 500));
    return { ok: true, rooms: H.S.run.rooms, frames: cv.toDataURL() !== a };
  });
  c.check('served by the server, the game boots and runs under the policy with no errors', game.ok && game.rooms >= 1 && game.frames && errors.length === 0, { game, errors });
  await browser.close();

  // Migrations: recorded once, never repeated, data kept when a feature is switched off.
  await s.stop();
  const s2 = await startServer({ HUM_FEATURES_DIR: fdir }, s.dataDir);
  await s2.stop();
  const s3 = await startServer({ HUM_FEATURES_DIR: fdir, HUM_DISABLE: 'EXP-PROBE' }, s.dataDir);
  const off = await client(s3.url).post('/api/probe', { a: 5 });
  const offHealth = await client(s3.url).get('/api/health');
  await s3.stop();
  const db = new DatabaseSync(path.join(s.dataDir, 'the-hum.db'));
  const rows = db.prepare("SELECT feature, version FROM schema_migrations WHERE feature = 'EXP-PROBE'").all();
  const probeRows = db.prepare('SELECT COUNT(*) AS n FROM probe').get().n;
  db.close();
  c.check('a feature’s migration is recorded once and not repeated on restart', rows.length === 1 && rows[0].version === 1, rows);
  c.check('a switched-off feature has no routes and is not listed, and its data stays in the database', off.status === 404 && JSON.stringify(offHealth.data.features) === '[]' && probeRows === 2, { off: off.status, offHealth: offHealth.data, probeRows });

  // HTTPS.
  const s4 = await startServer({ HUM_FEATURES_DIR: fdir, REQUIRE_HTTPS: '1', TRUST_PROXY: '1' });
  const plain = await client(s4.url).get('/api/health');
  const viaProxy = await client(s4.url).get('/api/health', { 'X-Forwarded-Proto': 'https' });
  const redirect = await fetch(s4.url + '/', { redirect: 'manual' });
  await s4.stop();
  c.check('with REQUIRE_HTTPS the API refuses plain HTTP and pages redirect to HTTPS', plain.status === 403 && plain.data.error === 'https_required' && redirect.status === 308 && /^https:\/\//.test(redirect.headers.get('location') || ''), [plain.status, redirect.status]);
  c.check('behind a trusted HTTPS proxy it answers, with Strict-Transport-Security', viaProxy.status === 200 && /max-age=/.test(viaProxy.headers.get('strict-transport-security') || ''), viaProxy.status);

  c.check('the server log never contains request bodies', !/"a":\s*[1-5]/.test(s.output() + s2.output()), '');
  c.finish();
})();
