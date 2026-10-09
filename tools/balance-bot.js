// Balance bot: plays the real game logic headlessly with a simple strategy and prints a timeline.
// Usage: node tools/balance-bot.js <clicksPerSec> <docChance> <maxMinutes> [iterations]
//   e.g. node tools/balance-bot.js 3 0.8 150 2   (an active player, two iterations)
// It buys by payback, hires and assigns crew, documents anomalies, kills the lights on warnings,
// researches the cheapest project and noclips at the end of each iteration.
const path = require('path');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node22/lib/node_modules/playwright'); }
const { chromium } = playwright;
const URL = 'file://' + path.resolve(__dirname, '..', 'index.html') + '#debug';
const CLICKS = Number(process.argv[2] ?? 3), DOC = Number(process.argv[3] ?? 0.8), MAXMIN = Number(process.argv[4] ?? 180), RUNS = Number(process.argv[5] ?? 1);
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(URL);
  await page.waitForTimeout(400);
  await page.evaluate(([CLICKS, DOC]) => {
    const H = window.HUM;
    const costOf = (u) => (u.cost.aw != null ? u.cost.aw : u.cost.salvage);
    window.BOT = {
      clickAcc: 0, decAcc: 0, ms: {}, rows: [], runStart: 0,
      mark(n) { if (!(n in this.ms)) this.ms[n] = Math.round((H.S.time - this.runStart) / 6) / 10; },
      run(sec) {
        const steps = Math.round(sec / 0.1);
        for (let i = 0; i < steps; i++) {
          this.clickAcc += CLICKS * 0.1;
          while (this.clickAcc >= 1) { this.clickAcc -= 1; H.rt.lastSurveyReal = -1e9; H.survey(); }
          H.step(0.1, false);
          this.decAcc += 0.1;
          if (this.decAcc >= 1) { this.decAcc = 0; this.decide(); }
        }
        H.rt.lastWall = Date.now();
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
        res.sort((a, b) => (a.cost || 1e9) - (b.cost || 1e9));
        if (res.length) H.doResearch(res[0].id);
        if (!r.doctrine && S.research.doc_industry) H.adoptDoctrine('doc_industry');
        for (let g = 0; g < 3; g++) {
          const ups = H.UPGRADES.filter(H.upgradeVisible).sort((a, b) => costOf(a) - costOf(b));
          let bought = false;
          for (const u of ups) if (H.buyUpgrade(u.id)) { bought = true; break; }
          if (!bought) break;
        }
        // crew
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
        }
        for (const e of H.EXPEDITIONS) if (H.canLaunch(e) && r.aw > e.water * 2) H.launchExpedition(e.id);
        // facilities: best payback
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
        // memories after noclip
        for (const M of H.MEMORIES) if (H.canBuyMemory(M) && !M.repeatable) H.buyMemory(M.id);
        for (const M of H.MEMORIES) if (H.canBuyMemory(M) && M.repeatable) H.buyMemory(M.id);
      },
      snapshot() {
        const S = H.S, r = S.run, D = H.derive();
        const facs = H.FACILITIES.map((f) => (r.facilities[f.id] ? f.id.slice(0, 4) + r.facilities[f.id] : '')).filter(Boolean).join(' ');
        return { min: Math.round((S.time - this.runStart) / 60), L: r.level, lvl: `${Math.floor(r.levelRooms)}/${H.exitRooms(r.level)}`, sal: r.salvage.toExponential(2), sps: D.sps.toExponential(2), aw: Math.floor(r.aw), aws: D.aws.toFixed(2), crew: r.crew.total, ech: S.echoes.toFixed(1), att: Math.round(r.attention), tgt: Math.round(D.attnTarget), san: Math.round(r.sanity), dv: H.dvPreview(), rps: D.roomsPerSec.toFixed(1), facs, ups: Object.keys(r.upgrades).length, res: Object.keys(S.research).length };
      },
    };
  }, [CLICKS, DOC]);
  for (let run = 0; run < RUNS; run++) {
    await page.evaluate(() => { BOT.runStart = HUM.S.time; BOT.ms = {}; });
    for (let m = 0; m < MAXMIN; m += 5) {
      await page.evaluate(() => BOT.run(300));
      const snap = await page.evaluate(() => BOT.snapshot());
      console.log(JSON.stringify(snap));
      const done = await page.evaluate(() => HUM.S.run.exitFound);
      if (done) break;
    }
    const ms = await page.evaluate(() => BOT.ms);
    console.log('MILESTONES (minutes):', JSON.stringify(ms));
    const info = await page.evaluate(() => ({ dv: HUM.dvPreview(), stats: HUM.S.run.stats, life: HUM.S.life }));
    console.log('END', JSON.stringify(info));
    if (run < RUNS - 1) {
      const ok = await page.evaluate(() => HUM.noclip());
      console.log('NOCLIP', ok, await page.evaluate(() => ({ dv: HUM.S.dv, dvTotal: HUM.S.dvTotal, iter: HUM.S.iteration })));
    }
  }
  console.log('ERRORS:', errors.length ? errors.slice(0, 10).join('\n') : 'none');
  await browser.close();
})();
