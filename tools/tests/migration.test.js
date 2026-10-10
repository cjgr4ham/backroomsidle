// Save format 1 → 2: run once, keep what was earned, convert the crew fairly, never compensate twice.
// The fixtures were written by the version-1 build itself (see fixtures/make-v1-saves.js).
const fs = require('fs');
const path = require('path');
const { open, Checker } = require('./harness');

const fixture = (name) => fs.readFileSync(path.join(__dirname, 'fixtures', `v1-${name}.json`), 'utf8');
const KEY = 'the-hum.save', BACKUP = 'the-hum.save.backup', V1COPY = 'the-hum.save.v1';

(async () => {
  const c = new Checker('Save migration from format 1');
  const g = await open('');
  const { ev, page, reload } = g;
  // The frame loop is paused for these pages, so what was loaded can be compared exactly (nothing runs afterwards).
  await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });

  /** Marks a fixture as saved just now, so loading it credits no time away. */
  const now = (raw) => { const d = JSON.parse(raw); d.lastSaved = Date.now(); return JSON.stringify(d); };
  /** Puts a raw save in storage and loads the page on it. */
  const loadRaw = async (raw, backup) => {
    // Saving is blocked first, or the page would save its own state over the fixture as it unloads.
    await ev(([k, b, raw, backup]) => { HUM.rt.saveBlocked = true; localStorage.clear(); localStorage.setItem(k, raw); if (backup) localStorage.setItem(b, backup); }, [KEY, BACKUP, raw, backup || null]);
    await reload();
    return ev(() => {
      const H = HUM, S = H.S, r = S.run;
      const modal = document.querySelector('.modal');
      return { v: S.v, iteration: S.iteration, dv: S.dv, dvTotal: S.dvTotal, echoes: S.echoes, deepTheory: S.deepTheory, research: Object.keys(S.research).sort(), memories: S.memories, relics: S.relics,
        noclips: S.life.noclips, exits: S.life.exits, maxLevel: S.life.maxLevel, researching: S.researching, ext: S.ext,
        run: { level: r.level, levelRooms: r.levelRooms, rooms: r.rooms, exitFound: r.exitFound, salvage: r.salvage, aw: r.aw, facilities: r.facilities, upgrades: Object.keys(r.upgrades).sort(),
          specialists: r.specialists, missions: r.missions, drills: r.drills, ext: r.ext, crew: 'crew' in r, expeditions: 'expeditions' in r },
        notes: S.log.filter((l) => l.tag === 'UPDATE').map((l) => l.text),
        modal: modal ? modal.textContent : null, can: H.canNoclip(), copy: localStorage.getItem('the-hum.save.v1') };
    });
  };
  const closeModal = () => ev(() => { if (HUM.UI.modalOpen) HUM.UI.closeModal(); });
  const v1hire = (from, to) => { let s = 0; for (let i = from; i < to; i++) s += Math.ceil(4 * Math.pow(1.25, i)); return s; };

  // Mid-game save: crew in every state, an expedition under way, permanent progress.
  const midRaw = now(fixture('midgame'));
  const mid = await loadRaw(midRaw);
  const src = JSON.parse(midRaw);
  c.check('a version-1 save loads as version 2', mid.v === 2, mid.v);
  c.check('the version-1 save is kept untouched under its own key', mid.copy === midRaw, (mid.copy || '').length);
  c.check('the player is told once what changed, in a window and in the log', /The Hum has changed/.test(mid.modal || '') && mid.notes.length >= 2 && mid.notes.some((n) => /became specialists/.test(n)), { modal: (mid.modal || '').slice(0, 200), notes: mid.notes });
  c.check('iteration, Déjà Vu, Echoes, research, Deep Survey Theory, Memories, relics and noclips are kept',
    mid.iteration === 2 && mid.dv === 15 && mid.dvTotal === 40 && mid.echoes === 9 && mid.deepTheory === 2 && mid.research.join() === 'condense,hum,listening,pattern,recursion'
    && JSON.stringify(mid.memories) === '{"muscle":1,"friends":1}' && mid.relics.keys === 1 && mid.relics.vhs === 2 && mid.noclips === 1, mid);
  c.check('the run keeps its level, rooms, salvage, facilities and upgrades (tiers included)',
    mid.run.level === 2 && mid.run.levelRooms === 12000 && mid.run.rooms === 20000 && mid.run.salvage === 5e6
    && JSON.stringify(mid.run.facilities) === JSON.stringify(src.run.facilities) && mid.run.upgrades.join() === Object.keys(src.run.upgrades).sort().join(), mid.run);
  c.check('Survey Drills ranks move into the game itself', mid.run.drills === 4 && !(mid.run.ext && mid.run.ext.click), mid.run);
  // 24 wanderers: 8 scavenging, 4 charting, 3 dowsing, 2 watching; 2 idle, 2 missing, 3 away. The 7 without a job join
  // the Scavenger (8 + 7 = 15), and on Level 2 a specialist starts at level 12 at most: 3 go home, refunded.
  const refund = v1hire(21, 24);
  c.check('assigned wanderers become their specialist’s levels; idle, missing and away ones join the Scavenger',
    JSON.stringify(mid.run.specialists) === JSON.stringify({ scavenge: 12, chart: 4, dowse: 3, watch: 2 }), mid.run.specialists);
  c.check('wanderers beyond the level’s cap are refunded the almond water they cost', mid.run.aw === 800 + refund && mid.notes.some((n) => /went home/.test(n)), { aw: mid.run.aw, expected: 800 + refund });
  const x = mid.run.missions.flooded;
  c.check('an expedition under way carries on as a mission with its timing and haul', x && x.start === 0 && x.end === 380 && x.salvage === Math.max(2000, 4000 * 600) && x.hazard === 0.1, x);
  c.check('no crew, jobs or expeditions remain in the save', !mid.run.crew && !mid.run.expeditions, mid.run);
  c.check('nothing is under research after migrating (version 1 research was instant)', mid.researching === null, mid.researching);

  // Saved again and reloaded: no second migration, no second refund, no new notes.
  await closeModal();
  await ev(() => { HUM.rt.saveBlocked = false; HUM.save(); HUM.rt.saveBlocked = true; });
  await reload();
  await ev(() => { HUM.rt.saveBlocked = true; });
  const again = await ev(() => ({ v: HUM.S.v, specialists: HUM.S.run.specialists, aw: HUM.S.run.aw, notes: HUM.S.log.filter((l) => l.tag === 'UPDATE').length,
    modal: !!document.querySelector('.modal'), missions: Object.keys(HUM.S.run.missions), raw: JSON.parse(localStorage.getItem('the-hum.save')).v }));
  c.check('the migrated save loads again without migrating again', again.v === 2 && again.raw === 2 && !again.modal, again);
  c.check('no compensation is paid twice', JSON.stringify(again.specialists) === JSON.stringify(mid.run.specialists) && Math.abs(again.aw - mid.run.aw) < 50 && again.notes === mid.notes.length, { again, before: { aw: mid.run.aw, notes: mid.notes.length } });
  const pure = await ev((raw) => {
    const H = HUM;
    const a = H.sanitizeState(JSON.parse(raw));
    const b = H.sanitizeState(JSON.parse(JSON.stringify(a)));
    const pick = (s) => JSON.stringify({ sp: s.run.specialists, aw: s.run.aw, fac: s.run.facilities, lvl: s.run.level, rooms: s.run.levelRooms, dv: s.dv, m: s.run.missions, d: s.run.drills });
    return { same: pick(a) === pick(b), a: pick(a) };
  }, midRaw);
  c.check('migrating is repeat-safe: sanitising the result again changes nothing', pure.same, pure.a);

  // A completed survey becomes Level FUN, with noclip still open and the noclip count unchanged.
  const done = await loadRaw(now(fixture('completed')));
  c.check('a version-1 save with the exit found arrives in Level FUN with the survey complete', done.run.level === 6 && done.run.exitFound && done.run.levelRooms === 3000, done.run);
  c.check('its noclip eligibility is kept, and no noclip is counted for the conversion', done.can && done.noclips === 2 && done.exits === 1 && done.iteration === 3, done);
  c.check('Level FUN counts as the deepest level reached', done.maxLevel === 6, done.maxLevel);
  c.check('its crew becomes specialists within the Level FUN cap', JSON.stringify(done.run.specialists) === JSON.stringify({ scavenge: 10, chart: 6, dowse: 5, watch: 5, archive: 4 }), done.run.specialists);
  await closeModal();

  // A very large crew early on is capped, with the excess refunded.
  const big = await loadRaw(now(fixture('bigcrew')));
  c.check('on Level 1 a converted specialist starts at level 7 at most', JSON.stringify(big.run.specialists) === JSON.stringify({ scavenge: 7, chart: 7, dowse: 5, watch: 5 }), big.run.specialists);
  c.check('the 56 wanderers who went home are refunded as almond water', big.run.aw === 50 + v1hire(80 - 56, 80), { aw: big.run.aw, expected: 50 + v1hire(24, 80) });
  await closeModal();

  // Developer marks survive, so a converted test save stays out of the cloud and the leaderboard.
  const dev = await loadRaw(now(fixture('devmarked')));
  c.check('a developer-marked save stays marked after migration', dev.ext && dev.ext.dev && dev.ext.dev.actions === 3, dev.ext);
  await closeModal();

  // Every way in: an exported save, the backup, data from the cloud (all go through sanitizeState).
  const imp = await ev((raw) => {
    const H = HUM;
    const bytes = new TextEncoder().encode(raw);
    let bin = '';
    for (const b of bytes) bin += String.fromCharCode(b);
    const st = H.decodeSave('HUM1.' + btoa(bin));
    return { v: st.v, specialists: st.run.specialists, aw: st.run.aw, level: st.run.level, missions: Object.keys(st.run.missions), notes: st.log.filter((l) => l.tag === 'UPDATE').length };
  }, midRaw);
  c.check('an exported version-1 save is migrated when imported', imp.v === 2 && JSON.stringify(imp.specialists) === JSON.stringify(mid.run.specialists) && imp.aw === mid.run.aw && imp.missions.join() === 'flooded' && imp.notes >= 2, imp);
  const back = await loadRaw('{not json', midRaw);
  c.check('a version-1 backup is migrated when the main save cannot be read', back.v === 2 && back.run.level === 2 && JSON.stringify(back.run.specialists) === JSON.stringify(mid.run.specialists), back.run);
  await closeModal();
  const newer = await ev(() => { try { HUM.sanitizeState({ v: 3 }); return 'loaded'; } catch (e) { return e.message; } });
  c.check('a save from a newer format is refused, not guessed at', /newer version/.test(newer), newer);

  c.finish(g.errors);
  await g.browser.close();
})();
