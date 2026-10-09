// EXP-CLOUD-SAVE: one save per account, on the server, with a revision number.
// - Every write names the revision it was based on. If the account's save has moved on since (another tab or
//   device saved), the write is refused with 409 and the current revision: stale progress never overwrites newer.
// - The replaced save is kept as an earlier version when a write is deliberate (a conflict resolved, a fresh
//   start, a first upload) and at most once an hour otherwise; the newest copies are kept.
// - Each account can read and write only its own save: no route takes an account or save identifier.
// - The server checks the save's shape and size, and refuses saves marked as changed with developer tools.
//   The save is the player's own single-player progress; nothing competitive is ever read from it.
// Registry entry and rollback: docs/experiments/EXP-CLOUD-SAVE.md
'use strict';
const { HttpError, limit } = require('../lib');
const { tx } = require('../db');

const ID = 'EXP-CLOUD-SAVE';
const MAX_BYTES = 512 * 1024;
const KEEP = 20;                      // earlier versions kept per account
const SNAPSHOT_MS = 3600 * 1000;      // routine saves archive the replaced version at most this often
const REASONS = ['autosave', 'noclip', 'manual', 'logout', 'link', 'migrate', 'resolve', 'reset'];
const RATE = { save: [30, 60] };

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
/** A few figures for showing the player which save is which. Shown only; never trusted for anything. */
function summarize(d) {
  const run = d.run && typeof d.run === 'object' ? d.run : {};
  const life = d.life && typeof d.life === 'object' ? d.life : {};
  return {
    iteration: Math.floor(num(d.iteration)) || 1, level: Math.floor(num(run.level)), rooms: num(run.rooms), salvage: num(run.salvage),
    noclips: Math.floor(num(life.noclips)), dv: num(d.dv), dvTotal: num(d.dvTotal), time: num(d.time), lastSaved: num(d.lastSaved),
  };
}
/** The save's shape, as far as the server needs it. The game itself validates every field when it loads. */
function validate(d) {
  if (!d || typeof d !== 'object' || Array.isArray(d)) throw new HttpError(400, 'save_invalid', 'That is not a saved game.');
  // Version 2 is the current format. Version 1 is still accepted from pages loaded before the update: the game
  // migrates it when it is loaded again, so nothing is lost either way.
  if (d.v !== 1 && d.v !== 2) throw new HttpError(400, 'save_version', 'This save format is not supported here.');
  if (!Number.isInteger(d.iteration) || d.iteration < 1 || d.iteration > 1e6) throw new HttpError(400, 'save_invalid', 'That is not a saved game.');
  for (const k of ['run', 'life']) if (!d[k] || typeof d[k] !== 'object' || Array.isArray(d[k])) throw new HttpError(400, 'save_invalid', 'That is not a saved game.');
  for (const k of ['dv', 'dvTotal', 'time']) if (d[k] !== undefined && !(typeof d[k] === 'number' && Number.isFinite(d[k]) && d[k] >= 0)) throw new HttpError(400, 'save_invalid', 'That is not a saved game.');
  if (d.ext && d.ext.dev && num(d.ext.dev.actions) > 0) throw new HttpError(422, 'dev_marked', 'This save was changed with developer tools, so it is not stored in your account.');
}

module.exports = {
  id: ID,
  requires: ['EXP-ACCOUNT-AUTH'],
  migrations: [{
    version: 1,
    sql: `
      CREATE TABLE saves (
        account_id INTEGER PRIMARY KEY REFERENCES accounts(id),
        revision INTEGER NOT NULL,
        data TEXT NOT NULL,          -- the save, as JSON
        summary TEXT NOT NULL,       -- figures worked out by the server, for display
        saved_at INTEGER NOT NULL
      );
      CREATE TABLE save_history (
        account_id INTEGER NOT NULL REFERENCES accounts(id),
        revision INTEGER NOT NULL,
        data TEXT NOT NULL,
        summary TEXT NOT NULL,
        saved_at INTEGER NOT NULL,
        replaced_at INTEGER NOT NULL,
        replaced_by TEXT NOT NULL,   -- why it was replaced: the reason given with the new save
        PRIMARY KEY (account_id, revision)
      );`,
  }],

  setup(ctx) {
    const { db, cfg, limiter } = ctx;
    const auth = ctx.services.auth;
    const rate = { ...RATE, ...((cfg.settings && cfg.settings.rate) || {}) };
    const q = {
      get: db.prepare('SELECT revision, data, summary, saved_at FROM saves WHERE account_id = ?'),
      meta: db.prepare('SELECT revision, summary, saved_at FROM saves WHERE account_id = ?'),
      upsert: db.prepare(`INSERT INTO saves (account_id, revision, data, summary, saved_at) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT (account_id) DO UPDATE SET revision = excluded.revision, data = excluded.data, summary = excluded.summary, saved_at = excluded.saved_at`),
      archive: db.prepare('INSERT OR IGNORE INTO save_history (account_id, revision, data, summary, saved_at, replaced_at, replaced_by) VALUES (?, ?, ?, ?, ?, ?, ?)'),
      lastArchived: db.prepare('SELECT MAX(replaced_at) AS t FROM save_history WHERE account_id = ?'),
      prune: db.prepare(`DELETE FROM save_history WHERE account_id = ? AND revision NOT IN
        (SELECT revision FROM save_history WHERE account_id = ? ORDER BY revision DESC LIMIT ?)`),
      history: db.prepare('SELECT revision, summary, saved_at, replaced_at, replaced_by FROM save_history WHERE account_id = ? ORDER BY revision DESC'),
      old: db.prepare('SELECT revision, data, summary, saved_at FROM save_history WHERE account_id = ? AND revision = ?'),
    };
    const meta = (row) => ({ revision: row.revision, savedAt: row.saved_at, summary: JSON.parse(row.summary) });

    return {
      routes: [
        { method: 'GET', path: '/api/save', handler: async (r) => {
          const u = auth.require(r);
          const row = q.get.get(u.id);
          return { json: { save: row ? { ...meta(row), data: JSON.parse(row.data) } : null } };
        } },
        { method: 'GET', path: '/api/save/meta', handler: async (r) => {
          const u = auth.require(r);
          const row = q.meta.get(u.id);
          return { json: { save: row ? meta(row) : null } };
        } },
        { method: 'PUT', path: '/api/save', body: MAX_BYTES + 4096, handler: async (r) => {
          const u = auth.require(r);
          limit(limiter, `save:${u.id}`, rate.save, 'saves');
          const b = r.body;
          const base = b.baseRevision == null ? 0 : b.baseRevision;
          if (!Number.isInteger(base) || base < 0) throw new HttpError(400, 'bad_revision', 'That save names no valid revision.');
          const reason = REASONS.includes(b.reason) ? b.reason : 'autosave';
          validate(b.data);
          const json = JSON.stringify(b.data);
          if (Buffer.byteLength(json) > MAX_BYTES) throw new HttpError(413, 'too_large', 'That save is too large.');
          const summary = JSON.stringify(summarize(b.data));
          const now = Date.now();
          return tx(db, () => {
            const cur = q.get.get(u.id);
            const curRev = cur ? cur.revision : 0;
            if (base !== curRev) {
              throw new HttpError(409, 'conflict', 'Your account has newer progress than this copy of the game.', { current: cur ? meta(cur) : null });
            }
            if (cur) {
              const last = q.lastArchived.get(u.id).t || 0;
              if (reason !== 'autosave' && reason !== 'manual' || now - last >= SNAPSHOT_MS) {
                q.archive.run(u.id, cur.revision, cur.data, cur.summary, cur.saved_at, now, reason);
                q.prune.run(u.id, u.id, KEEP);
              }
            }
            q.upsert.run(u.id, curRev + 1, json, summary, now);
            return { json: { revision: curRev + 1, savedAt: now } };
          });
        } },
        { method: 'GET', path: '/api/save/history', handler: async (r) => {
          const u = auth.require(r);
          return { json: { history: q.history.all(u.id).map((h) => ({ revision: h.revision, savedAt: h.saved_at, replacedAt: h.replaced_at, replacedBy: h.replaced_by, summary: JSON.parse(h.summary) })) } };
        } },
        { method: 'GET', path: '/api/save/history/*', handler: async (r) => {
          const u = auth.require(r);
          const rev = Number(r.rest);
          const row = Number.isInteger(rev) && rev > 0 ? q.old.get(u.id, rev) : null;
          if (!row) throw new HttpError(404, 'not_found', 'There is no such earlier version.');
          return { json: { save: { ...meta(row), data: JSON.parse(row.data) } } };
        } },
      ],
    };
  },
};
