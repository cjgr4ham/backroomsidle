# Experiment registry

The experimental update to The Hum is split into independent experiments. Each one has:

- a stable identifier and its own runtime flag;
- its own code slot in `index.html`, its own commits, its own tests;
- a registry entry with the twelve required fields: identifier, name, purpose, files and functions, dependencies, flags, save effects, how to turn it off, how to revert it, how to restore the original behaviour, tests to run, and limitations.

`BASELINE.md` records the game as it was before the update (commit `ebfa0c6`), including how Noclip works.

## Scope

- **Done:** the five requested areas.
  - Genuine click power.
  - Crew-centred idle production.
  - Clearer organization of upgrades and statistics.
  - A developer menu with infinite resources.
  - An audit of Attention, with a measured change.
- **Cancelled: three new levels.** No levels were added. The game still has six levels, numbered 0 to 5, with the same names, order, room counts and looks. No level code, configuration or placeholder was added.
- **Noclip (Rebirth) is unchanged.** Its formula, reset, rewards, Memories, conditions and saves are untouched. `tools/tests/rebirth.test.js` checks this by running the same rebirth scenario with every experiment off and on and requiring identical results. Possible Rebirth changes are listed at the end as optional ideas only. None is implemented.

## The experiments

| Identifier | What it changes | Default | Commits | Entry | Tests |
| --- | --- | --- | --- | --- | --- |
| `EXP-CORE` | Infrastructure: flags, hook points, wallet, save namespaces. No behaviour change. | always present | `cea34a7`, `bda08bd`, `5d5724d` | [EXP-CORE](EXP-CORE.md) | `core.test.js` (18), equivalence check |
| `EXP-CLICK-POWER` | Survey power stat and breakdown. Work Gloves as the first upgrade. Hand tools, Echo Sounder and Survey Drills. | on | `4bc1f00`, `ac4f1ba`, `35af10e` | [EXP-CLICK-POWER](EXP-CLICK-POWER.md) | `click-power.test.js` (35) |
| `EXP-CREW-AUTOMATION` | Crew run the machines (staffing). Crew and shift upgrades move to the Crew tab, plus three staffing requisitions. Existing saves are converted. | on | `adc4c08` | [EXP-CREW-AUTOMATION](EXP-CREW-AUTOMATION.md) | `crew.test.js` (38) |
| `EXP-UPGRADE-CATEGORIES` | The Upgrades tab is grouped by effect, with live summaries per category. | on | `9c18c5a` | [EXP-UPGRADE-CATEGORIES](EXP-UPGRADE-CATEGORIES.md) | `categories.test.js` (12) |
| `EXP-FACILITY-TIERS` | Tier upgrades are installed from each facility's row. | on | `1ac4cb3` | [EXP-FACILITY-TIERS](EXP-FACILITY-TIERS.md) | `tiers.test.js` (12) |
| `EXP-RESOURCE-LEDGER` | Archive → Resources explains every resource and meter. The header resources open it. | on | `7996d30`, `81fa8a2`, `c2a17fc` | [EXP-RESOURCE-LEDGER](EXP-RESOURCE-LEDGER.md) | `ledger.test.js` (12) |
| `EXP-ATTENTION-BALANCE` | Footstep noise from surveys by hand. The meters explain Attention and Sanity. The audit is in the entry. | on | `3b9fbc1` | [EXP-ATTENTION-BALANCE](EXP-ATTENTION-BALANCE.md) | `attention.test.js` (19) |
| `EXP-DEV-MENU` | Opt-in developer tools: infinite resources, injection, levels, research, crew, meters, events, time, live figures and experiment switches. | on, but hidden until you opt in | `1a8876a`, `143bb23` | [EXP-DEV-MENU](EXP-DEV-MENU.md) | `dev-menu.test.js` (27) |

**Other commits, which belong to no experiment:**

- `c969846`: the baseline record.
- `01eb7fc`, `a6daf4b`: test-tool fixes.
- `d0a01f1`: the Rebirth and whole-game regression suites.
- `123c0ba`, `4daa74c`: the balance and revert tools.
- This registry.

**Dependencies:**

- Every experiment depends on `EXP-CORE` and on nothing else.
- Some read optional figures from others and work without them. The ledger and the developer menu show staffing and footstep figures when those experiments are on. The Upgrades tab points to requisitions that other experiments list elsewhere.

## Four different operations

These are not interchangeable.

| Operation | What it does | How |
| --- | --- | --- |
| **Turn an experiment off** | The original behaviour returns at once. The experiment's saved data is kept for when it comes back. | Dev tab → Experiments, or `?exp=-EXP-ID` in the address for one page load, or `HUM.Exp.set('EXP-ID', false)` with `#debug`. Choices are stored in this browser under `the-hum.experiments`, never in the save. |
| **Restore previous settings** | Every experiment goes back to its default, and your switch choices are forgotten. | Dev tab → "Reset all experiments to their defaults", or `HUM.Exp.reset()`. No experiment has other settings. The developer menu's own settings are reset by turning it off. |
| **Revert its code** | Removes the experiment from the game permanently. | `git revert` its commits, newest first, from the table above. Any experiment can be reverted alone and in any order. Revert `EXP-CORE` only after all the others. Never use a blanket hard reset. |
| **Restore a prior save** | Puts back a save you exported earlier. | Settings → Import. The game never does this automatically, so progress made after an update is never erased behind your back. |

The address options (`?exp=none`, `?exp=all`, `?exp=EXP-A,-EXP-B`) last for one page load. The published artifact drops query strings, so use the Dev tab there.

## Proof of reversibility

`node tools/revert-check.js --all` reverts each experiment on its own in a throwaway clone. It then checks:

- that its code slots are empty;
- that the test files and registry entry its commits added are gone;
- that every remaining suite and the equivalence check pass.

Last run:

| Experiment reverted alone | Commits | Slots empty | Tests and entry removed | Remaining suites | Equivalence |
| --- | --- | --- | --- | --- | --- |
| EXP-ATTENTION-BALANCE | 1 | yes | yes | all pass | identical |
| EXP-CLICK-POWER | 3 | yes | yes | all pass | identical |
| EXP-CREW-AUTOMATION | 1 | yes | yes | all pass | identical |
| EXP-DEV-MENU | 2 | yes | yes | all pass | identical |
| EXP-FACILITY-TIERS | 1 | yes | yes | all pass | identical |
| EXP-RESOURCE-LEDGER | 3 | yes | yes | all pass | identical |
| EXP-UPGRADE-CATEGORIES | 1 | yes | yes | all pass | identical |
| Everything, with `EXP-CORE` | 11 | — | — | `index.html` is byte-identical to `ebfa0c6`, and the original functional test passes | — |

**Other proofs:**

- **Equivalence check.** `tools/equivalence-check.js` plays 8 seeded sessions in the original build and in this build with every experiment off. The sessions include noclips, offline time and save round trips. The full state and every derived rate match at all 96 checkpoints.
  - It also matches with all three presentation experiments on (categories, tiers, ledger), which shows they don't touch the simulation.
- **Pacing bot.** `tools/pacing-compare.js "baseline=@ebfa0c6" "original=?exp=none"` gives identical results on every seed.

## Save compatibility

- **Version.** The save version stays 1, and every change is additive.
  - Experiment data lives in `ext.<namespace>` and `run.ext.<namespace>`.
  - Ids the build doesn't know are kept in `dormant` and restored if their content returns.
- **Old saves in this build.** Saves from the original build load with every resource, level, room count, machine, upgrade and crew assignment intact. With every experiment on, their production carries over exactly (`all.test.js`).
- **The crew experiment's one-time conversion.** Machines the current crew cannot run are kept running by "the previous shift" until the next noclip. Nothing is awarded or removed.
- **New saves in the original build.** They load there too, because the original build ignores the extra fields.
- **What a code revert leaves behind.**
  - Experiment data is kept as opaque JSON and does nothing.
  - Upgrades bought from a removed experiment move to `dormant`.
  - Salvage already spent on them is not refunded, by design: a refund would create currency the player never earned.
- **Developer settings** never enter the save. Saves changed with the developer tools carry a mark in `ext.dev`.

## Tests and tools

- **`node tools/run-tests.js`** runs every suite, 250 checks:
  - `functional-test.js` (55), with every experiment off;
  - the experiment suites listed above;
  - `rebirth.test.js` (12);
  - `all.test.js` (10), with everything on.
- **`node tools/equivalence-check.js`** runs the all-off check against the baseline, as described above.
- **`node tools/revert-check.js [--all]`** runs the reversibility proof.
- **`node tools/balance-bot.js`** is the deterministic pacing bot. It takes `--query`, `--seed`, `--file`, `--crew` and `--json`.
- **`node tools/pacing-compare.js`** reports medians over seeds for any builds or experiment settings.

## Combined effect on pacing

These figures come from the deterministic bot (7 seeds, medians), comparing the original game (`?exp=none`) with every experiment on (the default). The per-experiment effects are in each entry.

| Profile | Build | Level 1 | Level 3 | Level 5 | Exit | Déjà Vu | Share from surveys by hand |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Active, 3 surveys/s, iteration 1 | original | 3.4 min | 22.2 min | 54.6 min | 80.2 min | 214 | 26% |
| | all on | 2.7 min | 18.6 min | 50.1 min | 74.4 min | 237 | 40% |
| Active, iteration 2 | original | 0.5 min | 4.0 min | 15.1 min | 24.5 min | 585 | 6% |
| | all on | 0.5 min | 3.8 min | 14.5 min | 23.3 min | 638 | 13% |
| Casual, 1 survey/s, iteration 1 | original | 8.4 min | 32.0 min | 67.0 min | 95.4 min | 223 | 9% |
| | all on | 7.2 min | 30.0 min | 64.6 min | 91.7 min | 292 | 7% |
| Casual, iteration 2 | original | 1.2 min | 5.3 min | 17.1 min | 27.2 min | 642 | 2% |
| | all on | 1.0 min | 4.8 min | 16.2 min | 26.3 min | 657 | 5% |

- **Why it is faster.** The opening is quicker, mostly through click power, and the first exit comes 4–7% sooner.
- **Unchanged.** Peak attention, drinks and averted incidents.
- **Déjà Vu per exit** varies by about ±25% between seeds, depending on whether a large expedition returns before the exit.

## Limits on isolation

- **Single-owner hook points.** These are the actual boundaries, so an experiment that later shares one of them would need to coordinate.
  - Click power replaces the survey reward in `derive:survey`.
  - Crew recomputes facility totals in `derive:production` and supplies facility lines through `facilities:line`.
  - The category experiment lays out the Upgrades tab itself through `upgrades:build`.
- **Optional reads.** The ledger and the developer menu read optional figures from other experiments. Without those experiments they fall back to their plain text.
- **No refunds.** Turning an experiment off or reverting it never refunds what was spent on its upgrades.

## Optional Rebirth ideas (not implemented)

Noclip was inspected and left exactly as it was. If it is ever adjusted, each idea below should be its own experiment with its own flag, commits and revert path.

1. **Show the Déjà Vu formula with the player's own numbers** in the Noclip tab, for example "(salvage this iteration ÷ 100,000)^0.3 × 1.5 for the exit". This is presentation only.
   - Justification: Déjà Vu is the main long-term reward, and the field manual gives the formula but the Noclip tab does not.
2. **Watch Muscle Memory under click power.** Its ×3 survey multiplier now multiplies a larger base, because hand tools raise it. It is not retuned. The measured effect is part of the click-power figures above. Retune only if testing with people finds it dominant.
3. **No change recommended to the reward formula.** Click power raises run salvage, so active players earn somewhat more Déjà Vu per exit (+11% median with every experiment on). That follows from playing actively rather than from a change to Noclip.
