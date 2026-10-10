// Balance bot: plays the real game logic headlessly with a simple strategy and prints a timeline.
// Usage: node tools/balance-bot.js <surveysPerSec> <docChance> <maxMinutes> [iterations] [options]
//   e.g. node tools/balance-bot.js 3 0.8 150 2   (an active player, two iterations)
// Options:
//   --query=?exp=none     experiment flags for the page (default: the build's defaults)
//   --seed=1              seeds Math.random so a run is repeatable (default 1)
//   --file=path           another build of the game
//   --reckless            keeps surveying while an entity is in the corridor (default: stands still, as a careful player)
//   --fun=minutes         stays this long in Level FUN after completing the survey before noclipping (default 0)
//   --json                print one JSON object instead of the timeline
//   --every=5             minutes between timeline snapshots
//   --tune=path.js        runs this script in the page before play (it sees the debug API as H) to try other numbers
// It surveys at the given rate, buys facilities and specialists by payback, buys the cheapest requisition, documents
// anomalies, kills the lights on warnings, keeps one research project going (cheapest first), sends missions, spends
// Déjà Vu (cheapest first) and noclips once the survey is complete. The live frame loop is paused and the random
// sequence seeded, so the same arguments always give the same result.
const path = require('path');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node22/lib/node_modules/playwright'); }
const { chromium } = playwright;

const args = process.argv.slice(2);
const opt = Object.fromEntries(args.filter((a) => a.startsWith('--')).map((a) => { const [k, ...v] = a.slice(2).split('='); return [k, v.length ? v.join('=') : true]; }));
const pos = args.filter((a) => !a.startsWith('--'));
const CLICKS = Number(pos[0] ?? 3), DOC = Number(pos[1] ?? 0.8), MAXMIN = Number(pos[2] ?? 180), RUNS = Number(pos[3] ?? 1);
const FILE = path.resolve(opt.file || path.join(__dirname, '..', 'index.html'));
const QUERY = typeof opt.query === 'string' ? opt.query : '';
const SEED = Number(opt.seed ?? 1);
const RECKLESS = !!opt.reckless;
const FUNMIN = Number(opt.fun || 0);
const EVERY = Number(opt.every || 5);
const JSON_OUT = !!opt.json;
const TUNE = typeof opt.tune === 'string' ? require('fs').readFileSync(path.resolve(opt.tune), 'utf8') : '';
const say = (...x) => { if (!JSON_OUT) console.log(...x); };

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(() => { window.requestAnimationFrame = () => 0; try { localStorage.clear(); } catch (e) { /* storage blocked */ } });
  await page.goto('file://' + FILE + QUERY + '#debug');
  await page.waitForTimeout(300);
  if (TUNE) await page.evaluate((src) => { new Function('H', src)(window.HUM); }, TUNE);
  await page.evaluate(([CLICKS, DOC, SEED, RECKLESS]) => {
    let a = SEED >>> 0;
    Math.random = () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const H = window.HUM;
    H.rt.saveBlocked = true;
    // Floating "+N" labels and toasts use wall-clock timers, so they would tie the random sequence to timing.
    H.UI.floatGain = () => {};
    H.replaceState(H.sanitizeState({ v: 2 }));
    H.rt.checkAcc = 0; H.rt.autobuyAcc = 0;
    const costOf = (u) => (u.cost.aw != null ? u.cost.aw : u.cost.salvage);
    window.BOT = {
      clickAcc: 0, decAcc: 0, ms: {}, runStart: 0, surveys: 0, manualSal: 0, idleSal: 0, held: 0,
      mark(n) { if (!(n in this.ms)) this.ms[n] = Math.round((H.S.time - this.runStart) / 6) / 10; },
      run(sec) {
        const steps = Math.round(sec / 0.1);
        for (let i = 0; i < steps; i++) {
          this.clickAcc += CLICKS * 0.1;
          while (this.clickAcc >= 1) {
            this.clickAcc -= 1;
            if (H.rt.encounter && !RECKLESS) { this.held++; continue; }   // a careful player stands still
            H.rt.lastSurveyReal = -1e9;
            const before = H.S.run.salvage;
            if (H.survey()) { this.surveys++; this.manualSal += Math.max(0, H.S.run.salvage - before); }
          }
          H.step(0.1, false);
          this.idleSal += H.rt.D.sps * 0.1;
          this.decAcc += 0.1;
          if (this.decAcc >= 1) { this.decAcc = 0; this.decide(); }
        }
      },
      income(D) { return CLICKS * D.manualSalvage + D.sps; },
      decide() {
        const S = H.S, r = S.run;
        let D = H.derive();
        if (r.facilities.cart) this.mark('cart');
        if (r.specialists.scavenge) this.mark('scavenger');
        if (r.specialists.chart) this.mark('cartographer');
        if (r.flags.water) this.mark('water');
        if (S.seen.echoes) this.mark('echo');
        for (let l = 1; l <= 5; l++) if (r.level >= l) this.mark('L' + l);
        if (r.exitFound) this.mark('exit');
        if (r.peakAttention >= 75) this.mark('hunted');
        if (H.rt.anomaly && !H.rt.anomaly.bot) { H.rt.anomaly.bot = true; if (Math.random() < DOC) H.documentAnomaly(); }
        if (r.pendingIncident) H.killLights();
        if (r.sanity < 40) H.drink(false);
        // Research: keep one project going, the cheapest available first (only the Industrial Doctrine of the doctrines).
        if (!S.researching) {
          const res = H.RESEARCH.filter((R) => H.canResearch(R) && !(R.doctrine && R.id !== 'doc_industry')).sort((x, y) => H.researchCost(x) - H.researchCost(y));
          if (res.length) H.doResearch(res[0].id);
        }
        if (!r.doctrine && S.research.doc_industry) H.adoptDoctrine('doc_industry');
        // Requisitions: the cheapest first, a few per second.
        for (let g = 0; g < 3; g++) {
          const ups = H.UPGRADES.filter(H.upgradeAvailable).filter((u) => H.upgradeHome(u) !== 'facilities').sort((x, y) => costOf(x) - costOf(y));
          let bought = false;
          for (const u of ups) if (H.buyUpgrade(u.id)) { bought = true; break; }
          if (!bought) break;
        }
        // Facility tiers when affordable.
        for (const u of H.UPGRADES) if (u.fac && H.upgradeAvailable(u) && costOf(u) <= r.salvage * 0.5) H.buyUpgrade(u.id);
        for (const m of H.MISSIONS) if (H.canLaunch(m) && r.aw > m.water * 2) H.launchMission(m.id);
        // Purchases by payback: salvage facilities against the Scavenger; the rest when they cost a few seconds of income.
        H.setBuyMode(1);
        for (let g = 0; g < 10; g++) {
          D = H.derive();
          const inc = this.income(D);
          let best = null, bestScore = Infinity;
          for (const f of H.FACILITIES) {
            if (!H.facVisible(f)) continue;
            const cost = Math.ceil(H.facilityCost(f, r.facilities[f.id] || 0, 1));
            if (cost > r.salvage) continue;
            let score = Infinity;
            if (f.kind === 'salvage') {
              const gain = CLICKS * D.surveyPower * D.condition * (D.fac[f.id].each / D.facMult);
              score = cost / Math.max(1e-12, gain);
            } else if (f.kind === 'survey') score = cost <= inc * 25 ? cost / Math.max(1e-9, inc) : Infinity;
            else if (f.kind === 'water') score = (r.facilities.condenser || 0) < 12 && cost <= inc * 10 ? cost / Math.max(1e-9, inc) : Infinity;
            else if (f.kind === 'dampener') score = D.attnTarget > 55 && cost <= inc * 30 ? 0 : Infinity;
            else if (f.kind === 'echo') score = (r.facilities.array || 0) < 15 && cost <= inc * 20 ? cost / Math.max(1e-9, inc) : Infinity;
            if (score < bestScore) { bestScore = score; best = { kind: 'fac', id: f.id }; }
          }
          for (const s of H.SPECIALISTS) {
            if (!H.canHire(s)) continue;
            const lvl = r.specialists[s.id] || 0, cost = H.specCost(s, lvl);
            let score = Infinity;
            if (s.id === 'scavenge') {
              const now = D.spec.scavenge.base * D.specEff * D.depth * D.global;
              const next = s.rate * Math.pow(s.step, lvl) * D.specEff * D.depth * D.global;
              score = cost / Math.max(1e-12, next - now);
            } else if (s.id === 'chart') score = cost <= inc * 40 ? cost / Math.max(1e-9, inc) * 0.5 : Infinity;
            else if (s.id === 'dowse') score = cost <= inc * 8 ? cost / Math.max(1e-9, inc) : Infinity;
            else if (s.id === 'watch') score = (D.attnTarget > 40 || lvl < 3) && cost <= inc * 30 ? cost / Math.max(1e-9, inc) : Infinity;
            else if (s.id === 'archive') score = cost <= inc * 20 ? cost / Math.max(1e-9, inc) : Infinity;
            if (score < bestScore) { bestScore = score; best = { kind: 'spec', id: s.id }; }
          }
          if (!best) break;
          if (!(best.kind === 'fac' ? H.buyFacility(best.id) : H.hireSpecialist(best.id))) break;
        }
        // Déjà Vu: whatever is cheapest, one level at a time.
        const djv = H.Exp.ask && H.Exp.ask('djv:api');
        if (djv) {
          for (let k = 0; k < 40; k++) {
            const ids = djv.ids().filter((id) => djv.can(id)).sort((x, y) => djv.cost(x) - djv.cost(y));
            if (!ids.length || !djv.buy(ids[0])) break;
          }
        } else {
          for (const M of H.MEMORIES) if (H.canBuyMemory(M) && !M.repeatable) H.buyMemory(M.id);
          for (const M of H.MEMORIES) if (H.canBuyMemory(M) && M.repeatable) H.buyMemory(M.id);
        }
      },
      snapshot() {
        const S = H.S, r = S.run, D = H.derive();
        const facs = H.FACILITIES.map((f) => (r.facilities[f.id] ? f.id.slice(0, 4) + r.facilities[f.id] : '')).filter(Boolean).join(' ');
        const specs = H.SPECIALISTS.map((s) => (r.specialists[s.id] ? s.id.slice(0, 4) + r.specialists[s.id] : '')).filter(Boolean).join(' ');
        return { min: Math.round((S.time - this.runStart) / 6) / 10, L: r.level, lvl: `${Math.floor(r.levelRooms)}/${H.exitRooms(r.level)}`, sal: r.salvage.toExponential(2),
          power: D.surveyPower.toExponential(2), inc: this.income(D).toExponential(2), facM: D.facMult.toExponential(2), mx: [D.base, D.surveyUpg, D.depth, D.drill, D.global].map((x) => +x.toPrecision(3)).join('·'), sps: D.sps.toExponential(2), aw: Math.floor(r.aw), ech: S.echoes.toFixed(1),
          att: Math.round(r.attention), san: Math.round(r.sanity), dv: H.dvPreview(), rps: D.roomsPerSurvey.toFixed(1), auto: D.roomsPerSec.toFixed(1), facs, specs,
          ups: Object.keys(r.upgrades).length, res: Object.keys(S.research).length, enc: `${r.stats.held}/${r.stats.caught}` };
      },
    };
  }, [CLICKS, DOC, SEED, RECKLESS]);

  const out = { file: FILE, query: QUERY, seed: SEED, clicks: CLICKS, runs: [] };
  for (let run = 0; run < RUNS; run++) {
    await page.evaluate(() => { BOT.runStart = HUM.S.time; BOT.ms = {}; BOT.surveys = 0; BOT.manualSal = 0; BOT.idleSal = 0; BOT.held = 0; });
    const shots = [];
    let doneAt = null;
    for (let m = 0; m < MAXMIN; m += EVERY) {
      await page.evaluate((sec) => BOT.run(sec), EVERY * 60);
      const snap = await page.evaluate(() => BOT.snapshot());
      shots.push(snap);
      say(JSON.stringify(snap));
      if (doneAt == null && await page.evaluate(() => HUM.S.run.exitFound)) doneAt = m;
      if (doneAt != null && m - doneAt >= FUNMIN) break;
    }
    const res = await page.evaluate(() => ({ ms: BOT.ms, dv: HUM.dvPreview(), stats: { ...HUM.S.run.stats }, peakAttention: HUM.S.run.peakAttention, minSanity: HUM.S.run.minSanity,
      manualShare: HUM.S.run.stats.salvage ? BOT.manualSal / HUM.S.run.stats.salvage : 0,
      idleShare: HUM.S.run.stats.salvage ? BOT.idleSal / HUM.S.run.stats.salvage : 0, held: BOT.held }));
    say('MILESTONES (minutes):', JSON.stringify(res.ms));
    say('END', JSON.stringify({ dv: res.dv, manualShare: Math.round(res.manualShare * 100) + '%', idleShare: Math.round(res.idleShare * 100) + '%', stats: res.stats }));
    out.runs.push({ ...res, shots });
    if (run < RUNS - 1) {
      const ok = await page.evaluate(() => HUM.noclip());
      say('NOCLIP', ok, await page.evaluate(() => ({ dv: HUM.S.dv, dvTotal: HUM.S.dvTotal, iter: HUM.S.iteration })));
    }
  }
  out.errors = errors;
  if (JSON_OUT) console.log(JSON.stringify(out));
  else console.log('ERRORS:', errors.length ? errors.slice(0, 10).join('\n') : 'none');
  await browser.close();
})();
