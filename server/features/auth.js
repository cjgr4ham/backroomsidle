// EXP-ACCOUNT-AUTH: username and password accounts with server-side sessions.
// - Passwords are hashed with scrypt from Node's standard crypto library (OWASP's recommended settings),
//   with a random salt per account. Only the hash is stored. Hashes record their settings, so they can be
//   strengthened later: an old hash is replaced at the next successful sign-in.
// - Sessions are random 256-bit tokens in an HttpOnly, SameSite=Lax cookie (Secure over HTTPS). The
//   database stores only their SHA-256 hash, so a copy of the database cannot be used to sign in.
// - Usernames are unique by their lower-case form, and the database enforces it.
// - Registration and sign-in are rate-limited; unknown usernames take as long to refuse as wrong passwords.
// Registry entry and rollback: docs/experiments/EXP-ACCOUNT-AUTH.md
'use strict';
const crypto = require('crypto');
const { promisify } = require('util');
const { HttpError, limit } = require('../lib');

const scrypt = promisify(crypto.scrypt);
const ID = 'EXP-ACCOUNT-AUTH';
const COOKIE = 'hum_session';
const SESSION_MS = 30 * 24 * 3600 * 1000;
const RENEW_MS = 24 * 3600 * 1000;                 // a session in use is extended at most once a day
const SCRYPT = { log2N: 15, r: 8, p: 3, keylen: 64 }; // N = 32768: about 32 MiB and a fraction of a second per hash
const USERNAME_RE = /^[A-Za-z0-9_-]{3,20}$/;
const RESERVED = new Set(['admin', 'administrator', 'root', 'system', 'moderator', 'mod', 'support', 'staff', 'owner',
  'null', 'undefined', 'anonymous', 'guest', 'server', 'api', 'the-hum', 'thehum', 'the_hum']);
// The most common passwords of ten or more characters, refused outright.
const COMMON = new Set(['1234567890', '0123456789', '0987654321', '9876543210', '12345678910', '123456789a', '1234567890a',
  'qwertyuiop', 'qwertyuiop1', 'qwerty1234', '1q2w3e4r5t', 'q1w2e3r4t5', 'password12', 'password123', 'password1234',
  'password1!', 'passw0rd123', 'iloveyou12', 'iloveyou123', 'letmein123', 'welcome123', 'football123', 'baseball123',
  'abcdefghij', 'abc1234567', 'administrator', 'princess123', 'sunshine123', 'qazwsxedcr', 'zaq12wsxcde', 'aaaaaaaaaa',
  'changeme123', 'trustno1234', 'starwars123', 'dragon12345', 'monkey12345', 'master12345', 'backrooms123', 'thehum12345']);
const RATE = { register: [5, 3600], login: [10, 900], loginIp: [50, 900] };   // [events, seconds]; HUM_SETTINGS.rate overrides

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const opts = (log2N, r, p) => ({ N: 2 ** log2N, r, p, maxmem: 128 * (2 ** log2N) * r * (p + 1) + 1024 * 1024 });

async function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(pw.normalize('NFC'), salt, SCRYPT.keylen, opts(SCRYPT.log2N, SCRYPT.r, SCRYPT.p));
  return `scrypt$${SCRYPT.log2N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${key.toString('base64')}`;
}
/** Constant-time check of a password against a stored hash. Returns { ok, stale } (stale: weaker settings). */
async function verifyPassword(pw, stored) {
  const parts = String(stored).split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return { ok: false, stale: false };
  const [, n, r, p, salt, hash] = parts;
  const want = Buffer.from(hash, 'base64');
  const got = await scrypt(String(pw).normalize('NFC'), Buffer.from(salt, 'base64'), want.length, opts(Number(n), Number(r), Number(p)));
  const ok = got.length === want.length && crypto.timingSafeEqual(got, want);
  return { ok, stale: ok && (Number(n) < SCRYPT.log2N || Number(r) !== SCRYPT.r || Number(p) < SCRYPT.p) };
}

/** Normalises a username. Throws a 400 with a player-facing reason if it is not allowed. */
function checkUsername(raw) {
  const username = String(raw == null ? '' : raw).normalize('NFKC').trim();
  if (!USERNAME_RE.test(username)) throw new HttpError(400, 'username_invalid', 'Usernames are 3 to 20 characters: letters, digits, _ and -.');
  if (!/[A-Za-z0-9]/.test(username)) throw new HttpError(400, 'username_invalid', 'Usernames need at least one letter or digit.');
  const key = username.toLowerCase();
  if (RESERVED.has(key)) throw new HttpError(400, 'username_reserved', 'That username is reserved. Choose another.');
  return { username, key };
}
/** The password policy. Throws a 400 with a player-facing reason. */
function checkPassword(raw, key) {
  if (typeof raw !== 'string') throw new HttpError(400, 'password_invalid', 'Enter a password.');
  const len = [...raw].length;
  if (len < 10) throw new HttpError(400, 'password_short', 'Use at least 10 characters. A few unrelated words work well.');
  if (len > 200) throw new HttpError(400, 'password_long', 'Use at most 200 characters.');
  const low = raw.toLowerCase();
  if (low.includes(key)) throw new HttpError(400, 'password_username', 'Your password cannot contain your username.');
  if (COMMON.has(low) || /^(.)\1+$/.test(raw)) throw new HttpError(400, 'password_common', 'That password is too common. Choose another.');
}

module.exports = {
  id: ID,
  requires: [],
  migrations: [{
    version: 1,
    sql: `
      CREATE TABLE accounts (
        id INTEGER PRIMARY KEY,
        username TEXT NOT NULL,             -- as the player typed it, shown on the leaderboard
        username_key TEXT NOT NULL UNIQUE,  -- lower case: uniqueness and sign-in
        password_hash TEXT NOT NULL,        -- scrypt$log2N$r$p$salt$hash; never the password
        created_at INTEGER NOT NULL,
        disabled_at INTEGER                 -- set by an operator: cannot sign in, hidden from rankings
      );
      CREATE TABLE sessions (
        token_hash TEXT PRIMARY KEY,        -- SHA-256 of the cookie's token; the token itself is never stored
        account_id INTEGER NOT NULL REFERENCES accounts(id),
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        renewed_at INTEGER NOT NULL
      );
      CREATE INDEX sessions_account ON sessions(account_id);
      CREATE INDEX sessions_expiry ON sessions(expires_at);`,
  }],

  setup(ctx) {
    const { db, cfg, limiter } = ctx;
    const rate = { ...RATE, ...((cfg.settings && cfg.settings.rate) || {}) };
    // A hash to check unknown usernames against, so they take as long to refuse as a wrong password.
    const dummy = (() => {
      const salt = crypto.randomBytes(16);
      const key = crypto.scryptSync('not a password', salt, SCRYPT.keylen, opts(SCRYPT.log2N, SCRYPT.r, SCRYPT.p));
      return `scrypt$${SCRYPT.log2N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${key.toString('base64')}`;
    })();
    const q = {
      byKey: db.prepare('SELECT id, username, password_hash, disabled_at FROM accounts WHERE username_key = ?'),
      insert: db.prepare('INSERT INTO accounts (username, username_key, password_hash, created_at) VALUES (?, ?, ?, ?)'),
      rehash: db.prepare('UPDATE accounts SET password_hash = ? WHERE id = ?'),
      newSession: db.prepare('INSERT INTO sessions (token_hash, account_id, created_at, expires_at, renewed_at) VALUES (?, ?, ?, ?, ?)'),
      session: db.prepare(`SELECT s.token_hash, s.expires_at, s.renewed_at, a.id, a.username FROM sessions s
        JOIN accounts a ON a.id = s.account_id WHERE s.token_hash = ? AND s.expires_at > ? AND a.disabled_at IS NULL`),
      renew: db.prepare('UPDATE sessions SET expires_at = ?, renewed_at = ? WHERE token_hash = ?'),
      endSession: db.prepare('DELETE FROM sessions WHERE token_hash = ?'),
      expired: db.prepare('DELETE FROM sessions WHERE expires_at <= ?'),
    };
    const secure = (https) => cfg.cookieSecure === '1' || (cfg.cookieSecure !== '0' && https);
    const cookie = (token, https) => `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MS / 1000}${secure(https) ? '; Secure' : ''}`;
    const clear = (https) => `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure(https) ? '; Secure' : ''}`;
    function startSession(accountId) {
      const token = crypto.randomBytes(32).toString('base64url');
      const now = Date.now();
      q.newSession.run(sha256(token), accountId, now, now + SESSION_MS, now);
      return token;
    }
    const tokenOf = (r) => { const t = r.cookies[COOKIE]; return t && /^[A-Za-z0-9_-]{43}$/.test(t) ? t : null; };
    /** The signed-in account for a request, or null. */
    function user(r) {
      const token = tokenOf(r);
      if (!token) return null;
      const row = q.session.get(sha256(token), Date.now());
      return row ? { id: row.id, username: row.username, tokenHash: row.token_hash, expiresAt: row.expires_at, renewedAt: row.renewed_at } : null;
    }
    ctx.services.auth = {
      user,
      require(r) {
        const u = user(r);
        if (!u) throw new HttpError(401, 'signed_out', 'You are signed out. Sign in again.');
        return u;
      },
    };

    return {
      maintenance: () => { q.expired.run(Date.now()); },
      routes: [
        { method: 'POST', path: '/api/auth/register', body: 4096, handler: async (r) => {
          limit(limiter, `register:${r.ip}`, rate.register, 'new accounts from here');
          const { username, key } = checkUsername(r.body.username);
          checkPassword(r.body.password, key);
          if (q.byKey.get(key)) throw new HttpError(409, 'username_taken', 'That username is taken. Choose another.');
          const hash = await hashPassword(r.body.password);
          let id;
          try {
            id = Number(q.insert.run(username, key, hash, Date.now()).lastInsertRowid);
          } catch (e) {
            if (/UNIQUE/i.test(e.message)) throw new HttpError(409, 'username_taken', 'That username is taken. Choose another.');
            throw e;
          }
          return { status: 201, json: { user: { username } }, headers: { 'Set-Cookie': cookie(startSession(id), r.https) } };
        } },
        { method: 'POST', path: '/api/auth/login', body: 4096, handler: async (r) => {
          const key = String(r.body.username == null ? '' : r.body.username).normalize('NFKC').trim().toLowerCase().slice(0, 64);
          limit(limiter, `loginIp:${r.ip}`, rate.loginIp, 'sign-in attempts from here');
          limit(limiter, `login:${r.ip}:${key}`, rate.login, 'sign-in attempts for this username');
          const acc = USERNAME_RE.test(key) ? q.byKey.get(key) : null;
          const pw = typeof r.body.password === 'string' ? r.body.password.slice(0, 1000) : '';
          const check = await verifyPassword(pw, acc ? acc.password_hash : dummy);
          if (!acc || !check.ok || acc.disabled_at) throw new HttpError(401, 'login_failed', 'Wrong username or password.');
          if (check.stale) q.rehash.run(await hashPassword(pw), acc.id);
          q.expired.run(Date.now());
          return { json: { user: { username: acc.username } }, headers: { 'Set-Cookie': cookie(startSession(acc.id), r.https) } };
        } },
        { method: 'POST', path: '/api/auth/logout', body: 1024, handler: async (r) => {
          const token = tokenOf(r);
          if (token) q.endSession.run(sha256(token));
          return { json: { ok: true }, headers: { 'Set-Cookie': clear(r.https) } };
        } },
        { method: 'GET', path: '/api/auth/session', handler: async (r) => {
          const u = user(r);
          if (!u) return { json: { user: null }, headers: tokenOf(r) ? { 'Set-Cookie': clear(r.https) } : undefined };
          const now = Date.now();
          if (now - u.renewedAt > RENEW_MS) {   // keep a session in use alive, at most once a day
            q.renew.run(now + SESSION_MS, now, u.tokenHash);
            return { json: { user: { username: u.username } }, headers: { 'Set-Cookie': cookie(r.cookies[COOKIE], r.https) } };
          }
          return { json: { user: { username: u.username } } };
        } },
      ],
    };
  },
};
