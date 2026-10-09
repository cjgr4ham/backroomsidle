// Starts the real game server (server/server.js) for a test, against a fresh database in a temporary folder,
// and gives a small HTTP client with its own cookie jar. Used by the server and account test files.
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const has = (feature) => fs.existsSync(path.join(ROOT, 'server', 'features', feature));

/** Starts a server. `env` adds environment variables (for example HUM_SETTINGS). Resolves once it is listening. */
function startServer(env = {}, keepDir) {
  const dataDir = keepDir || fs.mkdtempSync(path.join(os.tmpdir(), 'the-hum-data-'));
  const child = spawn(process.execPath, ['--no-warnings', path.join(ROOT, 'server', 'server.js')], {
    env: { ...process.env, PORT: '0', HOST: '127.0.0.1', DATA_DIR: dataDir, LOG: '0', ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let out = '';
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('server did not start: ' + out)), 15000);
    const onData = (d) => {
      out += d;
      const m = /listening on (http:\/\/[\d.]+:\d+)/.exec(out);
      if (m) {
        clearTimeout(timer);
        const stop = () => new Promise((res) => { if (child.exitCode !== null) { res(); return; } child.once('exit', () => res()); child.kill('SIGTERM'); });
        resolve({ url: m[1], dataDir, child, stop, output: () => out });
      }
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', (d) => { out += d; });
    child.on('exit', (code) => { clearTimeout(timer); if (!/listening on/.test(out)) reject(new Error(`server exited (${code}): ${out}`)); });
  });
}

/** An HTTP client that keeps the server's cookies between requests, like one browser would. */
function client(base) {
  const jar = {};
  async function call(method, p, body, headers = {}) {
    const h = { ...headers };
    const cookie = Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');
    if (cookie) h.Cookie = cookie;
    if (body !== undefined) h['Content-Type'] = h['Content-Type'] || 'application/json';
    const res = await fetch(base + p, { method, headers: h, body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)) });
    const setCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    for (const sc of setCookies) {
      const [pair, ...attrs] = sc.split(';');
      const i = pair.indexOf('=');
      const k = pair.slice(0, i).trim(), v = pair.slice(i + 1).trim();
      if (attrs.some((a) => /^\s*max-age=0\s*$/i.test(a)) || v === '') delete jar[k]; else jar[k] = v;
    }
    let data = null;
    const text = await res.text();
    try { data = JSON.parse(text); } catch (e) { data = text; }
    return { status: res.status, data, headers: res.headers, setCookies };
  }
  return { call, jar, get: (p, h) => call('GET', p, undefined, h), post: (p, b, h) => call('POST', p, b === undefined ? {} : b, h), put: (p, b, h) => call('PUT', p, b, h) };
}

/** For suites of features that need another feature: prints a skip line in the runner's format and exits. */
function skipUnless(features, name) {
  const missing = features.filter((f) => !has(f));
  if (!missing.length) return false;
  console.log(`${name}\n  skipped: ${missing.join(', ')} not in this build\n\n0 passed, 0 failed`);
  return true;
}

module.exports = { startServer, client, has, skipUnless, ROOT };
