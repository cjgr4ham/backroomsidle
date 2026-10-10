// EXP-LATE-BALANCE: the Night Office's exit at 260,000 rooms instead of 350,000. Only that level, only shorter, the
// Déjà Vu route and conditions still apply on top, and switching it either way never takes anything away.
const { open, Checker } = require('./harness');

(async () => {
  const c = new Checker('EXP-LATE-BALANCE: late balance');
  const g = await open('');
  const { ev } = g;

  const exits = await ev(() => {
    const H = HUM, E = H.Exp;
    H.replaceState(H.sanitizeState({ v: 2 }));
    H.rt.saveBlocked = true;
    const all = () => H.LEVELS.map((L, i) => (L.endless ? null : H.exitRooms(i)));
    const on = all();
    E.set('EXP-LATE-BALANCE', false);
    const off = all();
    E.set('EXP-LATE-BALANCE', true);
    // The Way Down (rooms needed −30%) still applies on top.
    H.S.memories.route = 1;
    const route = H.exitRooms(4);
    H.S.memories.route = 0;
    return { on, off, own: H.LEVELS.map((L) => (L.endless ? null : L.exit)), route };
  });
  c.check('the Night Office needs 260,000 rooms with it on, 350,000 with it off', exits.on[4] === 260000 && exits.off[4] === 350000, exits);
  c.check('every other level keeps its own exit', exits.on.every((x, i) => i === 4 || x === exits.own[i]) && exits.off.every((x, i) => x === exits.own[i]), exits);
  c.check('the Déjà Vu route (−30%) still applies on top', exits.route === 182000, exits.route);

  const toggle = await ev(() => {
    const H = HUM, E = H.Exp, out = {};
    // In the Night Office at 270,000 rooms: off, nothing is lost and more rooms are needed.
    H.replaceState(H.sanitizeState({ v: 2 }));
    H.rt.saveBlocked = true;
    H.enterLevel(4);
    E.set('EXP-LATE-BALANCE', false);
    H.S.run.levelRooms = 270000; H.S.run.salvage = 5e9;
    H.addRooms(1);
    out.off = { level: H.S.run.level, rooms: H.S.run.levelRooms, salvage: H.S.run.salvage };
    // On again: the next rooms mapped find the exit, and the rooms past it are carried into the Long Hallway.
    E.set('EXP-LATE-BALANCE', true);
    H.addRooms(1);
    out.on = { level: H.S.run.level, carried: H.S.run.levelRooms, salvage: H.S.run.salvage };
    // The manual's level list shows the exit in force.
    out.manual = /Night Office: 260,000 rooms|Night Office: 260K rooms/.test(document.body.innerHTML) || null;
    return out;
  });
  c.check('switched off in the Night Office, nothing is lost: the rooms stay and more are needed', toggle.off.level === 4 && toggle.off.rooms === 270001 && toggle.off.salvage === 5e9, toggle);
  c.check('switched on, the next room mapped finds the exit and the rooms past it carry into the Long Hallway', toggle.on.level === 5 && toggle.on.carried === 10002 && toggle.on.salvage === 5e9, toggle);
  c.finish(g.errors);
  await g.browser.close();
})();
