// EXP-LATE-BALANCE: two measured changes, each with its own content switch. The Night Office's exit at 220,000 rooms
// instead of 350,000 (balance:office_exit), and Level FUN's floors at 200,000 rooms instead of 50,000 while the late
// content is on (balance:fun_floors). Only shorter or larger, never a loss: a run already deep in Level FUN keeps its
// floors, and switching either way never takes rooms or currency away.
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
    E.setItem('balance:office_exit', false);
    const itemOff = all();
    E.setItem('balance:office_exit', true);
    // The Way Down (rooms needed −30%) still applies on top.
    H.S.memories.route = 1;
    const route = H.exitRooms(4);
    H.S.memories.route = 0;
    return { on, off, itemOff, own: H.LEVELS.map((L) => (L.endless ? null : L.exit)), route };
  });
  c.check('the Night Office needs 220,000 rooms with it on, 350,000 with it off or with its switch off', exits.on[4] === 220000 && exits.off[4] === 350000 && exits.itemOff[4] === 350000, exits);
  c.check('every other level keeps its own exit', exits.on.every((x, i) => i === 4 || x === exits.own[i]) && exits.off.every((x, i) => x === exits.own[i]), exits);
  c.check('the Déjà Vu route (−30%) still applies on top', exits.route === 154000, exits.route);

  const toggle = await ev(() => {
    const H = HUM, E = H.Exp, out = {};
    // In the Night Office at 230,000 rooms: off, nothing is lost and more rooms are needed.
    H.replaceState(H.sanitizeState({ v: 2 }));
    H.rt.saveBlocked = true;
    H.enterLevel(4);
    E.set('EXP-LATE-BALANCE', false);
    H.S.run.levelRooms = 230000; H.S.run.salvage = 5e9;
    H.addRooms(1);
    out.off = { level: H.S.run.level, rooms: H.S.run.levelRooms, salvage: H.S.run.salvage };
    // On again: the next rooms mapped find the exit, and the rooms past it are carried into the Long Hallway.
    E.set('EXP-LATE-BALANCE', true);
    H.addRooms(1);
    out.on = { level: H.S.run.level, carried: H.S.run.levelRooms, salvage: H.S.run.salvage };
    return out;
  });
  c.check('switched off in the Night Office, nothing is lost: the rooms stay and more are needed', toggle.off.level === 4 && toggle.off.rooms === 230001 && toggle.off.salvage === 5e9, toggle);
  c.check('switched on, the next room mapped finds the exit and the rooms past it carry into the Long Hallway', toggle.on.level === 5 && toggle.on.carried === 10002 && toggle.on.salvage === 5e9, toggle);

  const fun = await ev(() => {
    const H = HUM, E = H.Exp, out = {};
    const intoFun = (rooms) => {
      H.replaceState(H.sanitizeState({ v: 2 }));
      H.rt.saveBlocked = true;
      H.enterLevel(5); H.completeFiniteSurvey(0);
      H.S.run.levelRooms = rooms;
    };
    // A new stay in Level FUN: 200,000-room floors.
    intoFun(0);
    H.step(0.1, false);
    H.S.run.levelRooms = 450000;
    out.fresh = { floor: H.funFloor(), stored: H.S.run.ext.funfloor, depth: H.derive().depth };
    // Its switch off, the experiment off, or the late content off: 50,000 again, and nothing is lost.
    E.setItem('balance:fun_floors', false); out.itemOff = H.funFloor(); E.setItem('balance:fun_floors', true);
    E.set('EXP-LATE-BALANCE', false); out.expOff = H.funFloor(); E.set('EXP-LATE-BALANCE', true);
    for (const id of ['EXP-LATE-FACILITIES', 'EXP-LATE-UPGRADES', 'EXP-LATE-RESEARCH']) E.set(id, false);
    out.lateOff = H.funFloor();
    for (const id of ['EXP-LATE-FACILITIES', 'EXP-LATE-UPGRADES', 'EXP-LATE-RESEARCH']) E.set(id, true);
    out.back = H.funFloor();
    // A save already deep in Level FUN when this applies keeps its floors: loading never lowers the depth.
    intoFun(1e6);
    delete H.S.run.ext.funfloor;
    const before = H.funFloor();
    H.step(0.1, false);
    out.deep = { before, after: H.funFloor(), stored: H.S.run.ext.funfloor };
    // Kept in the save, through a save round trip; a new iteration decides again.
    const copy = H.sanitizeState(JSON.parse(JSON.stringify(H.S)));
    out.saved = copy.run.ext.funfloor;
    out.junk = H.sanitizeState({ v: 2, run: { ext: { funfloor: 123 } } }).run.ext.funfloor;
    out.manual = /Every 200,000 rooms there is a floor/.test(document.body.innerHTML) || null;
    return out;
  });
  c.check('a new stay in Level FUN has 200,000-room floors, decided once and kept in the run', fun.fresh.floor === 2 && fun.fresh.stored === 200000, fun);
  c.check('its switch off, the experiment off or the late content off: 50,000-room floors again, and back on with it', fun.itemOff === 9 && fun.expOff === 9 && fun.lateOff === 9 && fun.back === 2, fun);
  c.check('a run already deep in Level FUN keeps its 50,000-room floors: the depth never drops on loading', fun.deep.before === 20 && fun.deep.after === 20 && fun.deep.stored === 50000, fun.deep);
  c.check('the floor size is kept in the save, and anything else there is dropped', fun.saved === 50000 && fun.junk === undefined, fun);
  c.finish(g.errors);
  await g.browser.close();
})();
