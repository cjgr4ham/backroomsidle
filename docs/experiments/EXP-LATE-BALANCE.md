# EXP-LATE-BALANCE: late balance

Part of update 2.1 ([UPDATE-2.1.md](UPDATE-2.1.md), which holds the full balance report).

| Field | Value |
| --- | --- |
| Identifier | `EXP-LATE-BALANCE` |
| Default | on |
| Content ids | `balance:office_exit`, `balance:fun_floors` (each change can be switched off on its own) |
| Depends on | `EXP-CORE` (`level:exit` and `fun:floorRooms`, each added in its own commit for this experiment) |

## 1. What changes

Two changes measured with the balance bot. Neither makes anything cost more.

### The Night Office's exit: 220,000 rooms instead of 350,000 (`balance:office_exit`)

- The Night Office was the longest required stretch of a run. Every other level keeps its own exit.
- The Déjà Vu route ("The Way Down", −30%) and condition modifiers still apply on top. With the route it is 154,000.
- Rooms are never touched:
  - switched off in the Night Office, the rooms already mapped stay, and more are needed;
  - switched on with more rooms than the new exit, the next room mapped finds the exit, and the rooms past it carry into the Long Hallway.

| Active player (2 surveys a second), first iteration, 3 seeds | Minutes in the Night Office |
| --- | --- |
| Before the update (c903362) | 18.4–19.5 |
| Update 2.1, final content, exit 260,000 | 16.4–16.7 |
| Update 2.1, final content, exit 230,000 | 15.3–15.8 |
| Update 2.1, final content, exit 220,000 (this experiment) | 14.9–15.4 |

The bot plays a patient player here: it saves for any one-off requisition that costs at most 3 minutes of income, buying only what costs at most 5% of it meanwhile (`tools/balance-bot.js --save=180`).

### Level FUN's floors: 200,000 rooms instead of 50,000, while the late content is on (`balance:fun_floors`)

**Why.** Level FUN's depth grows by +10% for every floor, and a floor is a number of rooms. The late content (`EXP-LATE-FACILITIES`, `EXP-LATE-UPGRADES`, `EXP-LATE-RESEARCH`) maps several times more rooms there. With 50,000-room floors a stay in Level FUN ran away, even after that content had been tuned down.

| A 30-minute stay in Level FUN, active player, seed 1 | Déjà Vu at its end, iteration 1 | Iteration 2 |
| --- | --- | --- |
| Before the update (c903362) | 492 | 4,178 |
| Late content as first committed, 50,000-room floors | 5,977 | 4,194,502 |
| Late content tuned down, 50,000-room floors | 1,062 | 171,302 |
| Late content tuned down, 200,000-room floors (this experiment) | 548–568 | 14,227–14,282 |

The baseline's Level FUN already grows faster each iteration. This keeps the update close to it, rather than hundreds of times beyond it.

**When it applies.**
- Only while at least one of the three late-content experiments is on. Without them, floors are 50,000 rooms as before.
- The size is decided once per run, when the run first steps into Level FUN, and kept in the run (`run.ext.funfloor`).
- A save that loads already past its first floor of Level FUN keeps 50,000-room floors for that run, so loading the update never lowers anyone's depth. The next run's Level FUN uses 200,000.
- The level track, the floor count and the manual all show the floor size in force.

## 2. Files and functions

`index.html`, slot `EXP-LATE-BALANCE`:
- `EXITS`, `FLOOR_ROOMS`, `lateOn()`;
- the `run.ext.funfloor` sanitizer;
- hooks: `level:exit`, `fun:floorRooms`, `step` (the once-per-run floor decision) and `balance:api` (for tests).

Tests: `tools/tests/late-balance.test.js`.

## 3. Dependencies

- `EXP-CORE`: `level:exit` in `exitRooms()` and `fun:floorRooms` in `funFloorRooms()`.
- The floor change reads whether `EXP-LATE-FACILITIES`, `EXP-LATE-UPGRADES` or `EXP-LATE-RESEARCH` is on. It needs none of them to load or run.

## 4. How to disable it

- **Everything:** Dev tab → Experiments, `?exp=-EXP-LATE-BALANCE` for one page load, or `HUM.Exp.set('EXP-LATE-BALANCE', false)` with `#debug`.
- **One change:** `?content=-balance:office_exit` or `?content=-balance:fun_floors`, or `HUM.Exp.setItem('balance:fun_floors', false)`.

Either way the change stops at once and nothing is lost:
- a Night Office in progress simply needs more rooms;
- Level FUN's floors become 50,000 rooms, so its depth can only go up.

## 5. How to reverse the code

`git revert` this experiment's commits, newest first, then, if wanted, the `fun:floorRooms` and `level:exit` commits in `EXP-CORE`. Those two do nothing without an answer.

## 6. Persistent data

`run.ext.funfloor`: 200,000 or 50,000, the floor size decided for the current run. Anything else there is dropped when a save loads. It is never read while the experiment is off, and a new iteration starts without it.

## 7. Database migration

None. A save without it decides when its run next steps into Level FUN, keeping 50,000 if it is already past the first floor.

## 8. How to restore the original behaviour

Switch it off (section 4). The Night Office needs 350,000 rooms and Level FUN's floors are 50,000 rooms again.

## 9. Data created while it was on

`run.ext.funfloor` (see section 6). A level left earlier while it was on stays left.

## 10. Rollback tests actually performed

`late-balance.test.js`, 10 checks:
- 220,000 with it on, and 350,000 with it off or with its switch off;
- every other level unchanged;
- the route still applies on top;
- nothing lost when switched off in the Night Office, and the extra rooms carried over when switched on;
- 200,000-room floors in a new stay in Level FUN, decided once and kept;
- 50,000 again with its switch off, the experiment off or the late content off, and back on with it;
- a run already deep in Level FUN keeps its floors;
- the floor size survives a save round trip, and junk is dropped;
- no errors.

The equivalence check against c903362 with every update flag off is identical.
