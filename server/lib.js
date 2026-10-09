// Small helpers shared by the server and its features: JSON responses and errors, request bodies,
// cookies, client addresses and in-memory rate limits. No third-party code.
'use strict';

/** An error whose status, code and message are safe to show to the player. */
class HttpError extends Error {
  constructor(status, code, message, extra) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra || null;
  }
}

/** Sends a JSON response. API responses are never cached. */
function sendJson(res, status, body, headers) {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(text),
    'Cache-Control': 'no-store',
    ...(headers || {}),
  });
  res.end(text);
}

/** Reads a JSON request body of at most `limit` bytes. Throws HttpError for anything else. */
function readJson(req, limit) {
  return new Promise((resolve, reject) => {
    const type = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
    if (type !== 'application/json') { reject(new HttpError(415, 'json_required', 'Send JSON.')); req.resume(); return; }
    const declared = Number(req.headers['content-length']);
    if (Number.isFinite(declared) && declared > limit) { reject(new HttpError(413, 'too_large', 'That request is too large.')); req.resume(); return; }
    const chunks = [];
    let size = 0, done = false;
    req.on('data', (c) => {
      if (done) return;
      size += c.length;
      if (size > limit) { done = true; reject(new HttpError(413, 'too_large', 'That request is too large.')); req.resume(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (done) return;
      done = true;
      try {
        const v = JSON.parse(Buffer.concat(chunks).toString('utf8') || 'null');
        if (v === null || typeof v !== 'object' || Array.isArray(v)) throw new Error('not an object');
        resolve(v);
      } catch (e) { reject(new HttpError(400, 'bad_json', 'That request could not be read.')); }
    });
    req.on('error', () => { if (!done) { done = true; reject(new HttpError(400, 'bad_request', 'That request could not be read.')); } });
  });
}

function parseCookies(header) {
  const out = {};
  for (const part of String(header || '').split(';')) {
    const i = part.indexOf('=');
    if (i < 1) continue;
    const k = part.slice(0, i).trim();
    if (!(k in out)) out[k] = part.slice(i + 1).trim();
  }
  return out;
}

/** Whether the request reached us over HTTPS (directly, or through a trusted proxy that says so). */
function isHttps(req, cfg) {
  if (req.socket && req.socket.encrypted) return true;
  return !!cfg.trustProxy && String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';
}

/** The client's address: the socket's, or with a trusted proxy the last address it appended. */
function clientIp(req, cfg) {
  if (cfg.trustProxy) {
    const xff = String(req.headers['x-forwarded-for'] || '').split(',').map((s) => s.trim()).filter(Boolean);
    if (xff.length) return xff[xff.length - 1];
  }
  return (req.socket && req.socket.remoteAddress) || 'unknown';
}

/** Counts events per key in a sliding window. In memory: limits reset when the server restarts. */
class RateLimiter {
  constructor() { this.hits = new Map(); }
  /** Records one event for `key`; returns { ok, retryAfter } with `max` events allowed per `windowMs`. */
  hit(key, max, windowMs) {
    const now = Date.now();
    const list = (this.hits.get(key) || []).filter((t) => t > now - windowMs);
    if (list.length >= max) {
      this.hits.set(key, list);
      return { ok: false, retryAfter: Math.max(1, Math.ceil((list[0] + windowMs - now) / 1000)) };
    }
    list.push(now);
    this.hits.set(key, list);
    return { ok: true, retryAfter: 0 };
  }
  /** Forgets old entries so memory stays bounded. */
  sweep(maxWindowMs) {
    const cutoff = Date.now() - maxWindowMs;
    for (const [k, list] of this.hits) { const keep = list.filter((t) => t > cutoff); if (keep.length) this.hits.set(k, keep); else this.hits.delete(k); }
  }
}

/** Throws a 429 HttpError when a limit is exceeded. */
function limit(limiter, key, rule, what) {
  const r = limiter.hit(key, rule[0], rule[1] * 1000);
  if (!r.ok) {
    const mins = Math.ceil(r.retryAfter / 60);
    throw new HttpError(429, 'rate_limited', `Too many ${what}. Try again in ${r.retryAfter < 90 ? `${r.retryAfter} seconds` : `${mins} minutes`}.`, { retryAfter: r.retryAfter });
  }
}

module.exports = { HttpError, sendJson, readJson, parseCookies, isHttps, clientIp, RateLimiter, limit };
