// The database: one SQLite file through Node's built-in node:sqlite module.
// Each feature owns its tables and applies its own numbered migrations, recorded in schema_migrations.
// Migrations only ever add. Rolling a feature's code back never drops its tables or deletes its rows:
// the data stays in the file, unused, and is used again if the feature returns. See server/README.md.
'use strict';
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

function openDb(dataDir) {
  fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path.join(dataDir, 'the-hum.db'));
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA busy_timeout = 5000');
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    feature TEXT NOT NULL,
    version INTEGER NOT NULL,
    applied_at INTEGER NOT NULL,
    PRIMARY KEY (feature, version)
  )`);
  return db;
}

/** Runs `fn` in one transaction. Writes are serialised (BEGIN IMMEDIATE), so a check and its write cannot interleave. */
function tx(db, fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const out = fn();
    db.exec('COMMIT');
    return out;
  } catch (e) {
    try { db.exec('ROLLBACK'); } catch (e2) { /* already rolled back */ }
    throw e;
  }
}

/** Applies a feature's migrations that have not run yet, in order, each in its own transaction. */
function migrate(db, feature, migrations) {
  const done = new Set(db.prepare('SELECT version FROM schema_migrations WHERE feature = ?').all(feature).map((r) => r.version));
  const applied = [];
  for (const m of [...migrations].sort((a, b) => a.version - b.version)) {
    if (done.has(m.version)) continue;
    tx(db, () => {
      db.exec(m.sql);
      db.prepare('INSERT INTO schema_migrations (feature, version, applied_at) VALUES (?, ?, ?)').run(feature, m.version, Date.now());
    });
    applied.push(m.version);
  }
  return applied;
}

module.exports = { openDb, tx, migrate };
