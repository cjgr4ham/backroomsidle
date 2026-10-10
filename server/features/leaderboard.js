// EXP-NOCLIP-LEADERBOARD: accounts ranked by completed noclips, as recorded by the server.
// - The browser never sends a count. It reports one completed noclip at a time: which save (a random lineage
//   id kept in the save), which iteration ended, and a summary of that run. The server counts each
//   (account, lineage, iteration) once: a UNIQUE constraint and a transaction make a retried or replayed
//   report a duplicate, never a second noclip.
// - Reports are checked: the run must have reached Level 3 or the exit and earned Déjà Vu, and lasted a
//   minimum time; saves changed with developer tools are refused; one account records at most one noclip per
//   interval of real time, on the server's clock.
// - What this cannot do: the game runs in the browser, so a determined player could script plausible reports.
//   The checks bound how fast that could count; they cannot prove a noclip was played honestly.
// Ranking: most noclips first; on a tie, whoever reached that count first; then the older account.
// Registry entry and rollback: docs/experiments/EXP-NOCLIP-LEADERBOARD.md
'use strict';
const { HttpError, limit } = require('../lib');
const { tx } = require('../db');

const ID = 'EXP-NOCLIP-LEADERBOARD';
const RULES = { minIntervalSec: 30, minRunSec: 10, perPage: 25 };   // HUM_SETTINGS.leaderboard overrides
const RATE = { noclip: [120, 3600] };

module.exports = {
  id: ID,
  requires: ['EXP-ACCOUNT-AUTH'],
  migrations: [{
    version: 1,
    sql: `
      CREATE TABLE noclip_events (
        id INTEGER PRIMARY KEY,
        account_id INTEGER NOT NULL REFERENCES accounts(id),
        lineage TEXT NOT NULL,          -- random id of the save the noclip happened in
        iteration INTEGER NOT NULL,     -- the iteration that ended
        level INTEGER NOT NULL,
        exit_found INTEGER NOT NULL,
        run_seconds REAL NOT NULL,
        run_salvage REAL NOT NULL,
        gain INTEGER NOT NULL,          -- Déjà Vu the noclip awarded, as reported
        recorded_at INTEGER NOT NULL,   -- the server's clock
        UNIQUE (account_id, lineage, iteration)
      );
      CREATE TABLE noclip_totals (
        account_id INTEGER PRIMARY KEY REFERENCES accounts(id),
        noclips INTEGER NOT NULL,
        reached_at INTEGER NOT NULL,    -- when this total was reached: on a tie, earlier ranks higher
        last_at INTEGER NOT NULL
      );
      CREATE INDEX noclip_rank ON noclip_totals (noclips DESC, reached_at ASC, account_id ASC);`,
  }],

  setup(ctx) {
    const { db, cfg, limiter } = ctx;
    const auth = ctx.services.auth;
    const rules = { ...RULES, ...((cfg.settings && cfg.settings.leaderboard) || {}) };
    const rate = { ...RATE, ...((cfg.settings && cfg.settings.rate) || {}) };
    const ACTIVE = 'JOIN accounts a ON a.id = t.account_id AND a.disabled_at IS NULL';
    const q = {
      event: db.prepare('SELECT id FROM noclip_events WHERE account_id = ? AND lineage = ? AND iteration = ?'),
      insert: db.prepare(`INSERT INTO noclip_events (account_id, lineage, iteration, level, exit_found, run_seconds, run_salvage, gain, recorded_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`),
      total: db.prepare('SELECT noclips, reached_at, last_at FROM noclip_totals WHERE account_id = ?'),
      bump: db.prepare(`INSERT INTO noclip_totals (account_id, noclips, reached_at, last_at) VALUES (?, 1, ?, ?)
        ON CONFLICT (account_id) DO UPDATE SET noclips = noclips + 1, reached_at = excluded.reached_at, last_at = excluded.last_at`),
      count: db.prepare(`SELECT COUNT(*) AS n FROM noclip_totals t ${ACTIVE} WHERE t.noclips > 0`),
      page: db.prepare(`SELECT a.username, t.noclips, t.account_id FROM noclip_totals t ${ACTIVE} WHERE t.noclips > 0
        ORDER BY t.noclips DESC, t.reached_at ASC, t.account_id ASC LIMIT ? OFFSET ?`),
      ahead: db.prepare(`SELECT COUNT(*) AS n FROM noclip_totals t ${ACTIVE} WHERE t.noclips > 0 AND (t.noclips > ?
        OR (t.noclips = ? AND (t.reached_at < ? OR (t.reached_at = ? AND t.account_id < ?))))`),
    };
    /** The account's recorded noclips and rank (null while it has none). */
    function standing(accountId) {
      const t = q.total.get(accountId);
      if (!t || t.noclips < 1) return { noclips: 0, rank: null };
      return { noclips: t.noclips, rank: q.ahead.get(t.noclips, t.noclips, t.reached_at, t.reached_at, accountId).n + 1 };
    }
    const bad = (msg) => new HttpError(400, 'report_invalid', msg);
    function check(b) {
      const run = b.run && typeof b.run === 'object' ? b.run : null;
      if (b.devMarked === true) throw new HttpError(422, 'dev_marked', 'Noclips in a save changed with developer tools are not ranked.');
      if (typeof b.lineage !== 'string' || !/^[0-9a-f]{32}$/.test(b.lineage)) throw bad('That report does not name a save.');
      if (!Number.isInteger(b.iteration) || b.iteration < 1 || b.iteration > 1e6) throw bad('That report does not name an iteration.');
      if (!run) throw bad('That report has no run.');
      // Levels 0–5 are the finite survey; completing the Long Hallway (Level 5) records the exit and leads into Level
      // FUN (6), which is where a current game noclips from. Pages loaded before that update could noclip from Level 3
      // onwards without the exit, so those reports are still accepted. These are shape checks, not proof: the count is
      // limited by the rate rules below, never by anything the report claims.
      if (!Number.isInteger(run.level) || run.level < 0 || run.level > 6 || typeof run.exitFound !== 'boolean') throw bad('That report has no valid level.');
      if (run.exitFound && run.level < 5) throw bad('The exit is on Level 5.');
      if (run.level === 6 && !run.exitFound) throw bad('Level FUN is only reached by completing the survey.');
      if (run.level < 3 && !run.exitFound) throw bad('A noclip needs Level 3 or the exit.');
      if (!Number.isInteger(run.gain) || run.gain < 1 || run.gain > 1e15) throw bad('A noclip earns at least one Déjà Vu.');
      if (typeof run.time !== 'number' || !Number.isFinite(run.time) || run.time < rules.minRunSec || run.time > 1e10) throw bad('That run is too short to be a noclip.');
      if (typeof run.salvage !== 'number' || !Number.isFinite(run.salvage) || run.salvage < 0) throw bad('That run has no valid salvage.');
      return run;
    }

    return {
      routes: [
        { method: 'POST', path: '/api/noclips', body: 4096, handler: async (r) => {
          const u = auth.require(r);
          limit(limiter, `noclip:${u.id}`, rate.noclip, 'noclip reports');
          const run = check(r.body);   // any count, total or rank in the report is never read
          const now = Date.now();
          return tx(db, () => {
            if (q.event.get(u.id, r.body.lineage, r.body.iteration)) return { json: { recorded: false, duplicate: true, ...standing(u.id) } };
            const t = q.total.get(u.id);
            const wait = t ? Math.ceil((t.last_at + rules.minIntervalSec * 1000 - now) / 1000) : 0;
            if (wait > 0) throw new HttpError(429, 'too_soon', `One noclip can be recorded every ${rules.minIntervalSec} seconds. This one will be sent again shortly.`, { retryAfter: wait });
            q.insert.run(u.id, r.body.lineage, r.body.iteration, run.level, run.exitFound ? 1 : 0, run.time, run.salvage, run.gain, now);
            q.bump.run(u.id, now, now);
            return { status: 201, json: { recorded: true, ...standing(u.id) } };
          });
        } },
        { method: 'GET', path: '/api/leaderboard', handler: async (r) => {
          const per = rules.perPage;
          const total = q.count.get().n;
          const pages = Math.max(1, Math.ceil(total / per));
          const page = Math.min(pages, Math.max(1, Math.floor(Number(r.url.searchParams.get('page')) || 1)));
          const rows = q.page.all(per, (page - 1) * per);
          const u = auth.user(r);
          return { json: {
            source: 'server', page, pages, total, perPage: per,
            entries: rows.map((row, i) => ({ rank: (page - 1) * per + i + 1, username: row.username, noclips: row.noclips, you: !!u && u.id === row.account_id })),
            me: u ? standing(u.id) : null,
          } };
        } },
        { method: 'GET', path: '/api/leaderboard/me', handler: async (r) => {
          const u = auth.require(r);
          return { json: { ...standing(u.id), total: q.count.get().n } };
        } },
      ],
    };
  },
};
