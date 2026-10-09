// Balance bot: plays the real game logic headlessly with a simple strategy and prints a timeline.
// Usage: node tools/balance-bot.js <clicksPerSec> <docChance> <maxMinutes> [iterations] [options]
//   e.g. node tools/balance-bot.js 3 0.8 150 2   (an active player, two iterations)
// Options:
//   --query=?exp=none     experiment flags for the page (default: the build's defaults)
//   --seed=1              seeds Math.random so a run is repeatable (default 1)
//   --file=path           another build of the game, e.g. an older revision
//   --crew=staff|base     with EXP-CREW-AUTOMATION on, "staff" (default) moves scavengers onto machine
//                         lines nobody runs, as a player reading the Crew tab would; "base" never does
//   --json                print one JSON object instead of the timeline
// It buys by payback, hires and assigns crew, documents anomalies, kills the lights on warnings,
// researches the cheapest project and noclips at the end of each iteration. The live frame loop is
// paused and the random sequence seeded, so the same arguments always give the same result.
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
const CREW = opt.crew || 'staff';
const JSON_OUT = !!opt.json;
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
  await page.evaluate(([CLICKS, DOC, SEED, CREW]) => {
    let a = SEED >>> 0;
    Math.random = () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const H = window.HUM;
    H.rt.saveBlocked = true;
    // Floating "+N" labels pick a random position only while few are on screen, and wall-clock timers remove
    // them, so they would tie the random sequence to timing.
    H.UI.floatGain = () => {};
    H.replaceState(H.sanitizeState({ v: 1 }));
    H.rt.checkAcc = 0; H.rt.autobuyAcc = 0;
    const costOf = (u) => (u.cost.aw != null ? u.cost.aw : u.cost.salvage);
    const purchasable = H.upgradeAvailable || H.upgradeVisible;   // older builds have only upgradeVisible
    window.BOT = {
      clickAcc: 0, decAcc: 0, ms: {}, runStart: 0, surveys: 0, manualSal: 0,
      mark(n) { if (!(n in this.ms)) this.ms[n] = Math.round((H.S.time - this.runStart) / 6) / 10; },
      run(sec) {
        const steps = Math.round(sec / 0.1);
        for (let i = 0; i < steps; i++) {
          this.clickAcc += CLICKS * 0.1;
          while (this.clickAcc >= 1) {
            this.clickAcc -= 1; H.rt.lastSurveyReal = -1e9;
            const before = H.S.run.salvage; H.survey(); this.surveys++; this.manualSal += H.S.run.salvage - before;
          }
          H.step(0.1, false);
          this.decAcc += 0.1;
          if (this.decAcc >= 1) { this.decAcc = 0; this.decide(); }
        }
      },
      decide() {
        const S = H.S, r = S.run, D = H.derive();
        if (r.facilities.cart) this.mark('cart');
        if (r.flags.water) this.mark('water');
        if (r.upgrades.radio) this.mark('radio');
        if (r.crew.total) this.mark('crew1');
        if (r.facilities.beacon) this.mark('beacon');
        if (S.seen.echoes) this.mark('echo');
        for (let l = 1; l <= 5; l++) if (r.level >= l) this.mark('L' + l);
        if (r.exitFound) this.mark('exit');
        if (H.canNoclip()) this.mark('canNoclip');
        if (r.peakAttention >= 75) this.mark('hunted');
        if (H.rt.anomaly && !H.rt.anomaly.bot) { H.rt.anomaly.bot = true; if (Math.random() < DOC) H.documentAnomaly(); }
        if (r.pendingIncident) H.killLights();
        if (r.sanity < 40) H.drink(false);
        const res = H.RESEARCH.filter((R) => H.canResearch(R) && !(R.doctrine && R.id !== 'doc_industry'));
        res.sort((x, y) => (x.cost || 1e9) - (y.cost || 1e9));
        if (res.length) H.doResearch(res[0].id);
        if (!r.doctrine && S.research.doc_industry) H.adoptDoctrine('doc_industry');
        for (let g = 0; g < 3; g++) {
          const ups = H.UPGRADES.filter(purchasable).filter((u) => !H.upgradeHome || H.upgradeHome(u) !== 'none').sort((x, y) => costOf(x) - costOf(y));
          let bought = false;
          for (const u of ups) if (H.buyUpgrade(u.id)) { bought = true; break; }
          if (!bought) break;
        }
        if (r.upgrades.radio) {
          const reserve = 6 + r.level * 6;
          if (r.aw - H.hireCost() >= reserve) H.hire();
          const idleKeep = Math.min(2 + r.level, Math.floor(r.crew.total / 3));
          let idle = H.crewIdle() - idleKeep;
          const lv = r.level;
          while (idle > 0) {
            const j = r.crew.jobs;
            const tot = j.scavenge + j.chart + j.dowse + j.watch + j.archive + 1;
            let job = 'scavenge';
            if (j.dowse / tot < 0.2) job = 'dowse';
            else if (j.chart / tot < 0.2) job = 'chart';
            else if (lv >= 1 && D.attnTarget > 55 && j.watch / tot < 0.3) job = 'watch';
            else if (lv >= 3 && j.archive / tot < 0.15) job = 'archive';
            H.assign(job, 1); idle--;
          }
          // With crew running the machines: move scavengers onto any line with machines nobody runs.
          const Dn = H.derive();
          if (Dn.ops && CREW !== 'base') {
            const jb = r.crew.jobs;
            for (const job of ['chart', 'dowse', 'archive']) {
              if (job === 'archive' && r.level < 3) continue;
              const move = Math.min(Math.ceil(Dn.ops.lines[job].machines / Dn.ops.each) - jb[job], jb.scavenge - 1);
              if (move > 0) { H.assign('scavenge', -move); H.assign(job, move); }
            }
          }
        }
        for (const e of H.EXPEDITIONS) if (H.canLaunch(e) && r.aw > e.water * 2) H.launchExpedition(e.id);
        H.setBuyMode(1);
        for (let g = 0; g < 8; g++) {
          const D2 = H.derive();
          let best = null, bestScore = Infinity;
          for (const f of H.FACILITIES) {
            if (!H.facVisible(f)) continue;
            const cost = Math.ceil(H.facilityCost(f, r.facilities[f.id] || 0, 1));
            const each = D2.fac[f.id].each;
            let score;
            if (f.kind === 'salvage') score = cost / Math.max(1e-9, each);
            else if (f.kind === 'survey') score = cost / Math.max(1e-9, each * D2.surveyFlat * 0.25) * 0.4;
            else if (f.kind === 'water') score = (r.facilities.condenser || 0) < 4 + r.crew.total * 0.6 ? cost / Math.max(1e-9, D2.sps * 0.05 + 0.5) : Infinity;
            else if (f.kind === 'dampener') score = D2.attnTarget > 68 && cost < r.salvage * 0.3 ? 0 : Infinity;
            else if (f.kind === 'echo') score = (r.facilities.array || 0) < 10 ? cost / Math.max(1e-9, D2.sps * 0.02) : Infinity;
            if (score < bestScore) { bestScore = score; best = f; }
          }
          if (!best) break;
          if (!H.buyFacility(best.id)) break;
        }
        for (const M of H.MEMORIES) if (H.canBuyMemory(M) && !M.repeatable) H.buyMemory(M.id);
        for (const M of H.MEMORIES) if (H.canBuyMemory(M) && M.repeatable) H.buyMemory(M.id);
      },
      snapshot() {
        const S = H.S, r = S.run, D = H.derive();
        const facs = H.FACILITIES.map((f) => (r.facilities[f.id] ? f.id.slice(0, 4) + r.facilities[f.id] : '')).filter(Boolean).join(' ');
        return { min: Math.round((S.time - this.runStart) / 60), L: r.level, lvl: `${Math.floor(r.levelRooms)}/${H.exitRooms(r.level)}`, sal: r.salvage.toExponential(2), sps: D.sps.toExponential(2), aw: Math.floor(r.aw), aws: D.aws.toFixed(2), crew: r.crew.total, ech: S.echoes.toFixed(1), att: Math.round(r.attention), tgt: Math.round(D.attnTarget), san: Math.round(r.sanity), dv: H.dvPreview(), rps: D.roomsPerSec.toFixed(1), facs, ups: Object.keys(r.upgrades).length, res: Object.keys(S.research).length };
      },
    };
  }, [CLICKS, DOC, SEED, CREW]);

  const out = { file: FILE, query: QUERY, seed: SEED, clicks: CLICKS, runs: [] };
  for (let run = 0; run < RUNS; run++) {
    await page.evaluate(() => { BOT.runStart = HUM.S.time; BOT.ms = {}; BOT.surveys = 0; BOT.manualSal = 0; });
    const shots = [];
    for (let m = 0; m < MAXMIN; m += 5) {
      await page.evaluate(() => BOT.run(300));
      const snap = await page.evaluate(() => BOT.snapshot());
      shots.push(snap);
      say(JSON.stringify(snap));
      if (await page.evaluate(() => HUM.S.run.exitFound)) break;
    }
    const res = await page.evaluate(() => ({ ms: BOT.ms, dv: HUM.dvPreview(), stats: { ...HUM.S.run.stats }, peakAttention: HUM.S.run.peakAttention, minSanity: HUM.S.run.minSanity, manualShare: HUM.S.run.stats.salvage ? BOT.manualSal / HUM.S.run.stats.salvage : 0 }));
    say('MILESTONES (minutes):', JSON.stringify(res.ms));
    say('END', JSON.stringify({ dv: res.dv, stats: res.stats }));
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
