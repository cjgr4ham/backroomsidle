// Writes a consistent copy of the database while the server keeps running (SQLite VACUUM INTO).
// Usage: node server/backup.js [out-file]      default: DATA_DIR/backup-YYYY-MM-DD.db
// Restore: stop the server, replace DATA_DIR/the-hum.db with the copy (and delete the -wal and -shm files), start it.
'use strict';
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const dataDir = path.resolve(process.env.DATA_DIR || path.join(__dirname, '..', 'data'));
const src = path.join(dataDir, 'the-hum.db');
const out = path.resolve(process.argv[2] || path.join(dataDir, `backup-${new Date().toISOString().slice(0, 10)}.db`));
if (!fs.existsSync(src)) { console.error(`No database at ${src}. Set DATA_DIR to the server's data folder.`); process.exit(1); }
if (fs.existsSync(out)) { console.error(`${out} already exists; choose another file name.`); process.exit(1); }
const db = new DatabaseSync(src);
try {
  db.exec(`VACUUM INTO '${out.replace(/'/g, "''")}'`);
} finally {
  db.close();
}
const check = new DatabaseSync(out, { readOnly: true });
const accounts = check.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table' AND name = 'accounts'").get().n
  ? check.prepare('SELECT COUNT(*) AS n FROM accounts').get().n : 0;
check.close();
console.log(`Backup written to ${out} (${fs.statSync(out).size} bytes, ${accounts} accounts).`);
