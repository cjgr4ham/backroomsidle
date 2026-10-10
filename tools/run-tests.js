// Runs every test suite and summarises. Usage: node tools/run-tests.js
//   tools/functional-test.js   the core game with every experiment switched off (?exp=none)
//   tools/tests/*.test.js      the v2 systems (economy, facilities, specialists, research, entities, Level FUN,
//                              save migration), one suite per experiment, the server and the interface at four sizes
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const suites = [path.join(__dirname, 'functional-test.js')];
const dir = path.join(__dirname, 'tests');
if (fs.existsSync(dir)) for (const f of fs.readdirSync(dir).sort()) if (f.endsWith('.test.js')) suites.push(path.join(dir, f));

const results = [];
for (const file of suites) {
  const out = spawnSync(process.execPath, [file], { encoding: 'utf8', timeout: 600000 });
  const text = (out.stdout || '') + (out.stderr || '');
  const m = /(\d+) passed, (\d+) failed/.exec(text);
  const ok = out.status === 0 && m && m[2] === '0';
  results.push({ suite: path.relative(path.join(__dirname, '..'), file), passed: m ? +m[1] : 0, failed: m ? +m[2] : 1, ok });
  if (!ok) process.stdout.write(`\n--- ${path.basename(file)} ---\n${text.split('\n').filter((l) => /FAIL|Error|error/.test(l)).slice(0, 30).join('\n')}\n`);
}
console.table(results);
const failed = results.filter((r) => !r.ok).length;
console.log(failed ? `${failed} suite(s) failed` : `All ${results.length} suites passed (${results.reduce((n, r) => n + r.passed, 0)} checks)`);
process.exit(failed ? 1 : 0);
