# EXP-LATE-BALANCE: late balance

Part of update 2.1 ([UPDATE-2.1.md](UPDATE-2.1.md), which holds the full balance report).

| Field | Value |
| --- | --- |
| Identifier | `EXP-LATE-BALANCE` |
| Default | on |
| Depends on | `EXP-CORE` (`level:exit`, added for this experiment) |

## 1. What changes

**The Night Office's exit is at 260,000 rooms instead of 350,000.** That is the only change.
- The Déjà Vu route ("The Way Down", −30%) and condition modifiers still apply on top. With the route it is 182,000.
- Every other level keeps its own exit.

**Why.** Measured with the balance bot, the Night Office was the longest required stretch of a run.

| Active player (2 surveys a second), first iteration, median of 3–5 seeds | Time in the Night Office |
| --- | --- |
| Before the update (c903362) | 18.9 min |
| Update 2.1 without this experiment | 18.2 min |
| With the exit at 280,000 | 15.8 min |
| With the exit at 260,000 (this experiment), and the requisition prices from the tuning commit | 15.2 min |

The bot's model of an active player here saves for any one-off requisition that costs at most 3 minutes of income, buying only what costs at most 5% of it meanwhile (`tools/balance-bot.js --save=180`).

**Nothing becomes harder.** It is a reduction only. No price, production rate or penalty changes, and with it off the game is exactly as before.

**Rooms are never touched.**
- Switched off in the Night Office, the rooms already mapped stay, and more are needed.
- Switched on with more rooms than the new exit, the next room mapped finds the exit. The rooms past it carry into the Long Hallway, as any level crossing does.

The price changes to two new requisitions (Night Shift Coffee and the Master Key) are new content's own tuning. They live in `EXP-LATE-UPGRADES`, in their own commit, not here.

## 2. Files and functions

`index.html`, slot `EXP-LATE-BALANCE`:
- `EXITS`;
- hooks: `level:exit` and `balance:api` (for tests).

Tests: `tools/tests/late-balance.test.js`.

## 3. Dependencies

`EXP-CORE` (`level:exit` in `exitRooms()`, its own commit). No other experiment.

## 4. How to disable it

Dev tab → Experiments, `?exp=-EXP-LATE-BALANCE` for one page load, or `HUM.Exp.set('EXP-LATE-BALANCE', false)` with `#debug`.

## 5. How to reverse the code

`git revert` this experiment's commit, then, if wanted, the `level:exit` commit in `EXP-CORE`. That one does nothing without an answer.

## 6. Persistent data

None.

## 7. Database migration

None.

## 8. How to restore the original behaviour

Switch it off (section 4). The Night Office needs 350,000 rooms again.

## 9. Data created while it was on

None. A level left earlier while it was on stays left.

## 10. Rollback tests actually performed

`late-balance.test.js`, 6 checks:
- 260,000 with it on and 350,000 with it off;
- every other level unchanged;
- the route still applies on top;
- switched off in the Night Office, nothing is lost;
- switched on, the exit is found and the extra rooms carry over;
- no errors.

The equivalence check against c903362 with every update flag off is identical.
