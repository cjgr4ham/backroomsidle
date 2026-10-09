// The Hum game server. It serves index.html and a small JSON API. Accounts, cloud saves and the leaderboard
// are features in server/features/: each one is loaded if its file is present and it is not switched off,
// owns its own tables and migrations, and can be reverted on its own. With no features, this only serves
// the game. Node.js 22.13 or newer; no third-party dependencies. Deployment: server/README.md.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { openDb, migrate } = require('./db');
const lib = require('./lib');

const ROOT = path.resolve(__dirname, '..');
const env = process.env;
const cfg = {
  port: Number(env.PORT || 8080),
  host: env.HOST || '127.0.0.1',
  dataDir: path.resolve(env.DATA_DIR || path.join(ROOT, 'data')),
  trustProxy: env.TRUST_PROXY === '1',
  cookieSecure: env.COOKIE_SECURE || 'auto',          // auto: Secure cookies whenever the request came over HTTPS
  requireHttps: env.REQUIRE_HTTPS === '1',             // refuse the API and redirect pages over plain HTTP
  disabled: new Set(String(env.HUM_DISABLE || '').split(',').map((s) => s.trim()).filter(Boolean)),
  log: env.LOG !== '0',
  featuresDir: path.resolve(env.HUM_FEATURES_DIR || path.join(__dirname, 'features')),   // another folder is for tests only
  settings: (() => { try { return JSON.parse(env.HUM_SETTINGS || '{}'); } catch (e) { return {}; } })(),   // feature settings, e.g. rate limits
};

// ------------------------------------------------------------- the game page and its security headers
const PAGE = path.join(ROOT, 'index.html');
let page = { mtime: 0, body: null, csp: '' };
function loadPage() {
  const st = fs.statSync(PAGE);
  if (st.mtimeMs === page.mtime && page.body) return page;
  const body = fs.readFileSync(PAGE);
  // Only the page's own inline scripts may run: each is allowed by its SHA-256 hash.
  const hashes = [];
  const re = /<script>([\s\S]*?)<\/script>/g;
  let m;
  const text = body.toString('utf8');
  while ((m = re.exec(text))) hashes.push(`'sha256-${crypto.createHash('sha256').update(m[1], 'utf8').digest('base64')}'`);
  const csp = [
    "default-src 'none'", `script-src ${hashes.join(' ')}`, "style-src 'unsafe-inline'", "img-src 'self' data: blob:",
    "connect-src 'self'", "base-uri 'none'", "form-action 'none'", "frame-ancestors 'none'",
  ].join('; ');
  page = { mtime: st.mtimeMs, body, csp };
  return page;
}
function commonHeaders(https) {
  return {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'X-Frame-Options': 'DENY',
    'Cross-Origin-Opener-Policy': 'same-origin',
    ...(https ? { 'Strict-Transport-Security': 'max-age=15552000' } : {}),
  };
}

// ------------------------------------------------------------- features
const db = openDb(cfg.dataDir);
const limiter = new lib.RateLimiter();
const ctx = { db, cfg, lib, limiter, services: {}, features: [] };
const routes = [];   // { method, path, prefix, handler, body }
const maintenance = [];
function loadFeatures() {
  const dir = cfg.featuresDir;
  const mods = (fs.existsSync(dir) ? fs.readdirSync(dir) : []).filter((f) => f.endsWith('.js')).sort().map((f) => require(path.join(dir, f)));
  const pending = mods.filter((m) => !cfg.disabled.has(m.id));
  for (const m of mods) if (cfg.disabled.has(m.id)) console.log(`${m.id}: switched off (HUM_DISABLE)`);
  // A feature loads after the features it requires; one whose requirement is missing is skipped, data untouched.
  let progress = true;
  while (pending.length && progress) {
    progress = false;
    for (let i = 0; i < pending.length; i++) {
      const m = pending[i];
      if (!(m.requires || []).every((r) => ctx.features.includes(r))) continue;
      migrate(db, m.id, m.migrations || []);
      const out = m.setup(ctx) || {};
      for (const r of out.routes || []) routes.push({ ...r, prefix: r.path.endsWith('/*') ? r.path.slice(0, -1) : null });
      if (out.maintenance) maintenance.push(out.maintenance);
      ctx.features.push(m.id);
      pending.splice(i, 1);
      i--;
      progress = true;
    }
  }
  for (const m of pending) console.log(`${m.id}: not loaded, it needs ${(m.requires || []).filter((r) => !ctx.features.includes(r)).join(', ')}`);
}
loadFeatures();

function findRoute(method, pathname) {
  const forPath = routes.filter((r) => (r.prefix ? pathname.startsWith(r.prefix) && pathname.length > r.prefix.length : r.path === pathname));
  if (!forPath.length) return null;
  return forPath.find((r) => r.method === method || (method === 'HEAD' && r.method === 'GET')) || { notAllowed: true };
}

// ------------------------------------------------------------- requests
function sameOrigin(req, https) {
  if (String(req.headers['sec-fetch-site'] || '') === 'cross-site') return false;
  const origin = req.headers.origin;
  if (!origin) return true;   // not sent by a browser making a cross-site request
  const host = (cfg.trustProxy && req.headers['x-forwarded-host'] ? String(req.headers['x-forwarded-host']).split(',')[0].trim() : req.headers.host) || '';
  return origin === `${https ? 'https' : 'http'}://${host}`;
}

async function handle(req, res) {
  const started = Date.now();
  const https = lib.isHttps(req, cfg);
  const url = new URL(req.url, 'http://localhost');
  const method = req.method;
  let status = 500;
  const headers = commonHeaders(https);
  try {
    if (url.pathname.startsWith('/api/')) {
      if (cfg.requireHttps && !https) throw new lib.HttpError(403, 'https_required', 'This server only accepts secure (HTTPS) connections.');
      if (method !== 'GET' && method !== 'HEAD' && !sameOrigin(req, https)) throw new lib.HttpError(403, 'cross_origin', 'Requests from other sites are not accepted.');
      lib.limit(limiter, `api:${lib.clientIp(req, cfg)}`, (cfg.settings.rate && cfg.settings.rate.api) || [600, 60], 'requests');
      if (url.pathname === '/api/health' && (method === 'GET' || method === 'HEAD')) {
        status = 200;
        lib.sendJson(res, 200, { ok: true, service: 'the-hum', features: ctx.features }, headers);
        return;
      }
      const route = findRoute(method, url.pathname);
      if (!route) throw new lib.HttpError(404, 'not_found', 'There is nothing here.');
      if (route.notAllowed) throw new lib.HttpError(405, 'method_not_allowed', 'That is not allowed here.');
      const body = method === 'POST' || method === 'PUT' ? await lib.readJson(req, route.body || 16 * 1024) : null;
      const rest = route.prefix ? decodeURIComponent(url.pathname.slice(route.prefix.length)) : null;
      const out = (await route.handler({ req, url, body, rest, https, ip: lib.clientIp(req, cfg), cookies: lib.parseCookies(req.headers.cookie) })) || {};
      status = out.status || 200;
      lib.sendJson(res, status, out.json === undefined ? {} : out.json, { ...headers, ...(out.headers || {}) });
      return;
    }
    if ((url.pathname === '/' || url.pathname === '/index.html') && (method === 'GET' || method === 'HEAD')) {
      if (cfg.requireHttps && !https) {
        status = 308;
        res.writeHead(308, { ...headers, Location: `https://${req.headers.host}${url.pathname}` });
        res.end();
        return;
      }
      const p = loadPage();
      status = 200;
      res.writeHead(200, { ...headers, 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': p.body.length, 'Cache-Control': 'no-cache', 'Content-Security-Policy': p.csp });
      res.end(method === 'HEAD' ? undefined : p.body);
      return;
    }
    status = 404;
    res.writeHead(404, { ...headers, 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  } catch (err) {
    if (err instanceof lib.HttpError) {
      status = err.status;
      const extra = err.extra || {};
      lib.sendJson(res, status, { error: err.code, message: err.message, ...extra }, { ...headers, ...(extra.retryAfter ? { 'Retry-After': String(extra.retryAfter) } : {}) });
    } else {
      status = 500;
      console.error(`${method} ${url.pathname}: ${err && err.stack ? err.stack : err}`);   // never the body, cookies or tokens
      if (!res.headersSent) lib.sendJson(res, 500, { error: 'server_error', message: 'Something went wrong on the server.' }, headers);
      else res.end();
    }
  } finally {
    if (cfg.log) console.log(`${new Date(started).toISOString()} ${method} ${url.pathname} ${status} ${Date.now() - started}ms`);
  }
}

const server = http.createServer((req, res) => { handle(req, res); });
server.headersTimeout = 15000;
server.requestTimeout = 30000;
const sweep = setInterval(() => {
  limiter.sweep(24 * 3600 * 1000);
  for (const fn of maintenance) { try { fn(); } catch (e) { console.error(`maintenance: ${e.message}`); } }
}, 3600 * 1000);
sweep.unref();
server.listen(cfg.port, cfg.host, () => {
  const a = server.address();
  console.log(`The Hum server listening on http://${a.address}:${a.port} (features: ${ctx.features.join(', ') || 'none'}; data: ${cfg.dataDir})`);
});
function stop() { server.close(() => { try { db.close(); } catch (e) { /* closed */ } process.exit(0); }); setTimeout(() => process.exit(0), 3000).unref(); }
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
