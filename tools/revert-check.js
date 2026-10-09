// Proves that each experiment can be reverted on its own: in a throwaway clone, reverts every commit whose
// subject starts with the experiment's identifier, then checks that its code slots are empty, that the test
// files, server files and registry entry its commits added are gone, and that every remaining test suite and
// the equivalence check still pass. Suites of experiments that need a reverted one report themselves as
// skipped ("0 passed, 0 failed"), which counts as passing: their code stays and is inactive.
// Usage: node tools/revert-check.js [EXP-ID ...] [--all]
//   no ids   every experiment documented in docs/experiments (EXP-CORE excepted)
//   --all    also takes back every change the experiment and EXP-CORE commits made outside docs/ and tools/
//            (index.html, server/, package.json, .gitignore), together, and checks that index.html is then
//            byte-identical to the baseline revision (ebfa0c6), that no server files remain, and that the
//            original functional test passes
// Works on committed history only; your working tree is never touched.
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync, spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const BASELINE = 'ebfa0c6';
const args = process.argv.slice(2);
const ALL = args.includes('--all');
let ids = args.filter((a) => /^EXP-/.test(a));
if (!ids.length) ids = fs.readdirSync(path.join(ROOT, 'docs', 'experiments')).filter((f) => /^EXP-.*\.md$/.test(f) && f !== 'EXP-CORE.md').map((f) => f.slice(0, -3)).sort();

const git = (dir, ...a) => execFileSync('git', ['-C', dir, ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
/** Commits (newest first) whose subject starts with "<id>:". */
const commitsOf = (id) => git(ROOT, 'log', '--format=%H %s', `${BASELINE}..HEAD`).split('\n').filter(Boolean)
  .filter((l) => l.slice(41).startsWith(id + ':')).map((l) => l.slice(0, 40));
function clone() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'the-hum-revert-'));
  execFileSync('git', ['clone', '--quiet', ROOT, dir]);
  git(dir, 'config', 'user.email', 'revert-check@localhost');
  git(dir, 'config', 'user.name', 'revert-check');
  return dir;
}
function run(dir, script, ...a) {
  const r = spawnSync(process.execPath, [path.join(dir, script), ...a], { cwd: dir, encoding: 'utf8', timeout: 1200000 });
  return { ok: r.status === 0, text: (r.stdout || '') + (r.stderr || '') };
}
function slotEmpty(html, id) {
  const js = new RegExp(`// >>> ${id}\\n// <<< ${id}`).test(html);
  const css = !html.includes(`/* >>> ${id} */`) || new RegExp(`/\\* >>> ${id} \\*/\\n/\\* <<< ${id} \\*/`).test(html);
  return js && css;
}

const results = [];
for (const id of ids) {
  const commits = commitsOf(id);
  const row = { experiment: id, commits: commits.length, reverted: false, slotsEmpty: false, testGone: false, suites: '', equivalence: false };
  if (!commits.length) { results.push({ ...row, suites: 'no commits found' }); continue; }
  const dir = clone();
  try {
    git(dir, 'revert', '--no-edit', ...commits);
    row.reverted = true;
    const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
    row.slotsEmpty = slotEmpty(html, id);
    // The experiment's own test files and registry entry, as its commits added them, must be gone.
    const added = commits.flatMap((c) => git(ROOT, 'show', '--format=', '--name-only', '--diff-filter=A', c).split('\n')).filter((f) => f.startsWith('tools/tests/') || f.startsWith('docs/experiments/') || f.startsWith('server/'));
    row.testGone = added.length > 0 && added.every((f) => !fs.existsSync(path.join(dir, f)));
    const t = run(dir, 'tools/run-tests.js');
    row.suites = (/All (\d+) suites passed \((\d+) checks\)/.exec(t.text) || [null, '?', '?']).slice(1).join(' suites, ') + ' checks' + (t.ok ? '' : ' — FAILED');
    if (!t.ok) console.log(`--- ${id}: test output ---\n${t.text.split('\n').filter((l) => /FAIL|failed|Error/.test(l)).slice(0, 20).join('\n')}`);
    row.equivalence = run(dir, 'tools/equivalence-check.js').ok;
  } catch (e) {
    row.suites = 'revert failed: ' + String(e.stderr || e.message).split('\n')[0];
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  results.push(row);
}

if (ALL) {
  const dir = clone();
  const row = { experiment: 'everything (all experiments and EXP-CORE)', commits: 0, reverted: false, slotsEmpty: null, testGone: null, suites: '', equivalence: false };
  try {
    // Every commit that touched the game or the server, newest first; each must be an experiment or EXP-CORE commit.
    const PATHS = ['index.html', 'server', 'package.json', '.gitignore'];
    const touching = git(dir, 'log', '--format=%H %s', `${BASELINE}..HEAD`, '--', ...PATHS).split('\n').filter(Boolean);
    const stray = touching.filter((l) => !/^[0-9a-f]{40} EXP-/.test(l));
    if (stray.length) throw new Error(`game or server files changed outside experiment commits: ${stray.join('; ')}`);
    row.commits = touching.length;
    for (const l of touching) {
      const c = l.slice(0, 40);
      const patch = execFileSync('git', ['-C', dir, 'diff', `${c}^`, c, '--', ...PATHS]);
      if (patch.length) execFileSync('git', ['-C', dir, 'apply', '-R'], { input: patch });
    }
    row.reverted = true;
    const now = fs.readFileSync(path.join(dir, 'index.html'));
    const base = execFileSync('git', ['-C', ROOT, 'show', `${BASELINE}:index.html`]);
    const left = ['server', 'package.json'].filter((f) => fs.existsSync(path.join(dir, f)) && (fs.statSync(path.join(dir, f)).isFile() || fs.readdirSync(path.join(dir, f)).length));
    row.equivalence = Buffer.compare(now, base) === 0 && !left.length;
    const t = run(dir, 'tools/functional-test.js', '');
    row.suites = `index.html ${Buffer.compare(now, base) === 0 ? 'identical to' : 'DIFFERS from'} ${BASELINE}; ${left.length ? `server files LEFT: ${left.join(', ')}` : 'no server files left'}; original functional test ${t.ok ? 'passes' : 'FAILS'}`;
  } catch (e) {
    row.suites = 'revert failed: ' + String(e.stderr || e.message).split('\n')[0];
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  results.push(row);
}

console.table(results);
const bad = results.filter((r) => !r.reverted || r.slotsEmpty === false || r.testGone === false || /FAIL|failed|DIFFERS|LEFT/.test(r.suites) || !r.equivalence);
console.log(bad.length ? `${bad.length} revert check(s) failed` : 'Every revert check passed');
process.exit(bad.length ? 1 : 0);
