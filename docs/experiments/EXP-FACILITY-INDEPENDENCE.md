# EXP-FACILITY-INDEPENDENCE: facilities never need crew

> **Folded into the core in v2** (commit `a52658d`). This entry is kept as the record of the experiment as it was. There is no crew to need: facilities only raise the facility multiplier (salvage) or support something else, and never depend on anyone. The flag, the code slot and `facility-independence.test.js` no longer exist; `economy.test.js` covers facilities. See [V2-REDESIGN.md](V2-REDESIGN.md).

| Field | Value |
| --- | --- |
| Identifier | `EXP-FACILITY-INDEPENDENCE` |
| Name | Facilities never need crew |
| Purpose | Meets the firm requirement that nothing in the Facilities shop may need crew to be bought, built, run, or to receive its ordinary production. |
| Flag | `EXP-FACILITY-INDEPENDENCE`, on by default |
| Commits | The `EXP-CREW-AUTOMATION:` commit that adds the staffing switch, and this experiment's own `EXP-FACILITY-INDEPENDENCE:` commit. Both are listed in the registry index. |

## 1. What it changes

**What the audit found.** See [AUDIT-META-ACCOUNTS.md](AUDIT-META-ACCOUNTS.md).
- No facility has ever had a crew requirement in order to be **bought**. Purchase conditions are a level, rooms mapped, almond water found, or earlier facilities owned.
- In the original game, every machine **runs** at full output on its own.
- The only crew dependency was the staffing rule of `EXP-CREW-AUTOMATION`, on by default since PR #2. Under it, a salvage machine, condenser, beacon or array with nobody on it worked at 25%.

**What this experiment does.**
- It answers the `crew:staffing` hook with `false`. The crew experiment then skips its staffing calculation, so every machine produces its full output with no crew, while you watch and while you are away.
- The three staffing requisitions are not offered, because they would do nothing. Owned ones stay owned.
- A save is not converted to the staffing model.
- The Facilities subtitle says that facilities run at full output with or without crew.
- The field manual gains a "Facilities and crew" section.

**What stays the same.**
- Crew remain their own system:
  - scavengers recover salvage by hand;
  - cartographers survey;
  - dowsers find water;
  - watchers absorb noise;
  - archivists record Echoes.
- Scavengers keep their original bonus of +5% facility salvage each. This is a bonus on top of full output, never a condition for it.
- The Crew tab keeps the crew requisitions, and shows a **Crew output** summary of what the crew add.

**Production with this experiment on** is the original game's production model, exactly. A test compares every resource rate against the game with every experiment off. The full formula is in [PRODUCTION.md](PRODUCTION.md).

## 2. Files and functions

- **`index.html`, `EXP-FACILITY-INDEPENDENCE` script slot.** The `facilityIndependenceExperiment` module, with hooks `crew:staffing`, `facilities:sub` (priority −10) and `manual`. There is no stylesheet slot.
- **`index.html`, `EXP-CREW-AUTOMATION` script slot.** The `staffing()` gate. It belongs to the crew experiment and is committed under its identifier. See [EXP-CREW-AUTOMATION.md](EXP-CREW-AUTOMATION.md).
- **`tools/tests/facility-independence.test.js`:** 14 checks.
- **This entry.**

## 3. Dependencies

- `EXP-CORE`, for the experiment registry and hooks.
- **The staffing switch in `EXP-CREW-AUTOMATION`.** This experiment only answers a question that the crew experiment asks.
  - If the crew experiment is off or reverted, there is no staffing rule, facilities already need no crew, and this experiment changes nothing. A test checks this.
- Nothing depends on this experiment.

## 4. How to disable it

- Use the Dev tab → Experiments.
- Or add `?exp=-EXP-FACILITY-INDEPENDENCE` to the address for one page load.
- Or run `HUM.Exp.set('EXP-FACILITY-INDEPENDENCE', false)` with `#debug`.

Turning it off restores the crew experiment's staffing rule at once, the 25% rule included. That is the behaviour of PR #2, which this update's requirement forbids, so turn it off only for comparison.

## 5. How to reverse the code

- `git revert` this experiment's `EXP-FACILITY-INDEPENDENCE:` commit. It touches only its slot, its test file and this entry.
- **To remove the staffing switch as well,** revert the `EXP-CREW-AUTOMATION:` switch commit too. Do not leave the switch without this experiment if you want the requirement to hold: the crew experiment would then need crew again.
- **To meet the requirement permanently without this experiment,** revert `EXP-CREW-AUTOMATION` instead, or turn it off.
- Never use a blanket reset.

## 6. Does it modify persistent data?

- **No.** It writes nothing to the save, to browser storage or to a server.
- **One indirect effect:** while it is on, the crew experiment does not convert a save that it has never converted.

## 7. Does it need a database migration?

No. It has no server part.

## 8. How to restore the original behaviour

Two "originals" are involved:

- **The original game, `ebfa0c6`.** Facilities never needed crew there, and with this experiment on, production is identical to it.
- **PR #2, with crew staffing.** Turn this experiment off, or revert its commit.

## 9. What happens to data created while it was on

- Nothing is created.
- Staffing requisitions bought before it was turned on stay in `run.upgrades`. They are inert while it is on, and work again if it is turned off.
- A save the crew experiment had already converted keeps its `ext.crew` mark and its previous-shift allowance. They are unused while this experiment is on, and used again if it is turned off.

## 10. Rollback tests actually performed

- **`tools/tests/facility-independence.test.js`, 14 checks, all passing.** The game's defaults are used, so every default experiment is on. The suite checks:
  - a player with no crew buys five of every facility;
  - every facility produces its full output;
  - no facility has a crew requirement;
  - output equals the original game for salvage, water, Echoes, surveys, absorption and noise;
  - assigning crew changes no machine;
  - scavengers add their +5% each, once;
  - ten minutes offline with no crew pays the full rate;
  - the Facilities tab text.
- **Switching it off and on again:**
  - off: staffing returns, the save is converted as the crew experiment always converts it, and new machines need crew;
  - on again: full output.
- **Isolation:**
  - with only the crew experiment and this one on, nothing needs crew;
  - without the crew experiment, this experiment changes nothing.
- **`tools/tests/crew.test.js`** tests the switch itself with a probe experiment, in 5 checks.
- **The revert proof** (`tools/revert-check.js`) results are listed in the registry index.

## Balance

The pacing bot was run with `node tools/pacing-compare.js --seeds=5 --runs=1`. The figures are medians over 5 seeds for the first iteration, in minutes to each level and to the exit.

| Profile | Build | L1 | L3 | L5 | Exit | Déjà Vu |
| --- | --- | --- | --- | --- | --- | --- |
| Active, 3 surveys/s | original (`?exp=none`) | 3.4 | 22.4 | 54.6 | 80.2 | 222 |
| | crew staffing (`?exp=none,EXP-CREW-AUTOMATION`) | 3.4 | 22.5 | 53.9 | 77.8 | 315 |
| | crew staffing switched off by this experiment | 3.4 | 22.4 | 54.6 | 80.2 | 222 |
| Casual, 1 survey/s | original | 8.3 | 31.9 | 67.0 | 96.0 | 217 |
| | crew staffing | 8.4 | 30.5 | 65.3 | 92.8 | 202 |
| | crew staffing switched off by this experiment | 8.3 | 31.9 | 67.0 | 96.0 | 217 |

With this experiment on, every column is identical to the original game. The production model is the original's, and the crew requisitions are the same upgrades with the same prices, only listed in the Crew tab.
