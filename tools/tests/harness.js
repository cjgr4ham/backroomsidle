// Shared helpers for the experiment test files in this folder.
const path = require('path');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node22/lib/node_modules/playwright'); }

const FILE = path.resolve(__dirname, '..', '..', 'index.html');
const url = (query) => 'file://' + FILE + (query || '') + '#debug';

class Checker {
  constructor(name) { this.name = name; this.passes = 0; this.failures = 0; console.log(name); }
  check(label, cond, detail) {
    if (cond) { this.passes++; console.log('  ok   ' + label); }
    else { this.failures++; console.log('  FAIL ' + label + (detail !== undefined ? '  -> ' + JSON.stringify(detail) : '')); }
  }
  finish(errors) {
    if (errors) this.check('no console or page errors', errors.length === 0, errors.slice(0, 5));
    console.log(`\n${this.passes} passed, ${this.failures} failed`);
    process.exitCode = this.failures ? 1 : 0;
  }
}

/**
 * Opens the game with an empty save. `query` selects experiments, e.g. '?exp=all' or '?exp=none'. With
 * `opts.manualFrames` the game's frame loop never runs: the test steps the simulation and renders frames itself.
 */
async function open(query, viewport, opts) {
  const browser = await playwright.chromium.launch();
  const page = await browser.newPage({ viewport: viewport || { width: 1366, height: 860 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  if (opts && opts.manualFrames) await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
  await page.goto(url(query));
  await page.evaluate(() => { window.HUM.rt.saveBlocked = true; localStorage.clear(); });
  await page.reload();
  await page.waitForTimeout(250);
  const ev = (fn, arg) => page.evaluate(fn, arg);
  /** Reloads the page, keeping storage (and therefore the save). */
  const reload = async () => { await page.reload(); await page.waitForTimeout(250); };
  /** Starts a new empty game in the open page without reloading. */
  const fresh = () => ev(() => { window.HUM.replaceState(window.HUM.sanitizeState({ v: 2 })); window.HUM.rt.saveBlocked = true; });
  return { browser, page, errors, ev, reload, fresh };
}

module.exports = { open, Checker, url, FILE };
