# EXP-CLICK-POWER: click-power progression

| Field | Value |
| --- | --- |
| Identifier | `EXP-CLICK-POWER` |
| Name | Click-power progression |
| Purpose | Makes surveying by hand a progression of its own. The first upgrade in the game raises the salvage of the next survey. A visible Survey power stat shows what one survey pays and what the next upgrade would change. |
| Depends on | `EXP-CORE` (hook points, wallet, save namespaces). No other experiment. |
| Flag | `EXP-CLICK-POWER`, on by default. |

## What it changes

- **Survey power stat.** A line under the Survey button reads "+N salvage per survey". It also names the next survey upgrade, its price and its effect, for example "+8 → +10 (+25%)".
  - Selecting the line opens a breakdown: base salvage by source, every multiplier by source, the share of output from notes, Survey Drills, the sanity or lights-out condition, the per-survey total, and what automatic surveys earn.
- **New upgrades**, listed in the Upgrades tab:

  | Upgrade | Cost | Appears at | Effect on a survey you make by hand |
  | --- | --- | --- | --- |
  | Work Gloves | 10 salvage | 2 rooms | +1 base salvage |
  | Pry Bar | 75 salvage | 15 rooms | +2 base salvage |
  | Canvas Satchel | 500 salvage | 10 facilities | +0.05 base salvage per facility owned |
  | Bolt Cutters | 5,000 salvage | Level 1 | +5 base salvage |
  | Echo Sounder | 30,000 salvage | Level 1 | Echo finds ×2, almond water finds ×1.5 |
  | Hydraulic Spreader | 2M salvage | Level 3 | +25 base salvage |
  | Survey Drills | 1,000 × 5^rank salvage | 100 rooms | +10% per rank, repeatable to rank 25 |

- **The reward formula.** One survey you make by hand now pays:
  - (base × survey multipliers + share of output) × drills × condition
  - Base is 1 plus the hand tools. Survey multipliers are unchanged: level, Déjà Vu, achievements, Flashlight, Rubber Boots, Backwards Pedometer, research, memories and the rest.
  - The original formula is the same expression with base fixed at 1 and drills at ×1.
- **Automatic surveys are separate.** Beacons and cartographers still recover 25% of 1 base × the survey multipliers. Hand tools, notes and drills never reach them. They never count as manual surveys, and they never roll the Echo Sounder's find chances.
- **Upgrade slips.** Slips for every upgrade that changes survey salvage show the Survey power before and after, plus the percentage gain. That covers the new ones and the existing Flashlight, notes, Rubber Boots and Backwards Pedometer.
- **Upgrades tab.** The tab now opens at 2 rooms (originally 5), so the first upgrade can be found straight away. While the gloves are unowned, the objective line points at them.
- **Field manual.** It gains a "Survey power" section.

## Files and functions affected

- `index.html`:
  - The `EXP-CLICK-POWER` script slot holds the `clickPowerExperiment` module.
  - The `EXP-CLICK-POWER` stylesheet slot holds the `.spower*` styles.
  - Nothing outside the two slots is edited.
  - The module adds its seven upgrades to `UPGRADES` and `UPG`, tagged `exp: 'EXP-CLICK-POWER'`.
  - It registers handlers on these hooks: `derive:survey`, `upgrade:buy`, `upgradeHome`, `tabUnlocked`, `objective`, `ui:init`, `ui:update`, `upgrades:slip`, `upgrades:slipUpdate` and `manual`.
  - It owns the save namespace `run.ext.click`.
- `tools/tests/click-power.test.js`: the experiment's tests.
- `docs/experiments/EXP-CLICK-POWER.md`: this entry.

## Save-schema effects

These are additive, and the save version stays 1.

- The six one-time upgrades are stored like every other upgrade, as `run.upgrades.<id> = true`. Their ids are `gloves`, `prybar`, `satchel`, `cutters`, `sounder` and `spreader`.
- The Survey Drills rank is stored in `run.ext.click.drills`, an integer from 0 to 25.
- Both live in `run`, so a noclip clears them with the rest of the run. Nothing is added to permanent data.
- **Flag turned off:** the stored ids and rank stay in the save. They do nothing and are not listed. Turning the flag back on brings their effect back.
  - Salvage already spent on them is not refunded.
- **Code reverted while EXP-CORE remains:**
  - The upgrade ids become unknown to the build. They move to `run.dormant.upgrades`.
  - `run.ext.click` is kept as opaque data.
  - Restoring the code restores both.
- **Save loaded in the original build (`ebfa0c6`):** it loads normally, and the unknown upgrade ids are dropped. Resource amounts are not affected.

## Turning it off

Any one of the following works:

- Use the developer menu's experiment list.
- Add `?exp=-EXP-CLICK-POWER` to the address for one page load.
- With `#debug` in the address, run `HUM.Exp.set('EXP-CLICK-POWER', false)` in the console.

Once it is off:

- Surveys pay exactly the original formula, which the tests check.
- The Upgrades tab opens at 5 rooms again.
- The Survey power line is hidden.
- The new upgrades are no longer listed or purchasable.

The experiment has no settings of its own, so there are no previous settings to restore.

## Reverting its code

1. Run `git revert <EXP-CLICK-POWER commit>`. That commit touches only the two slots, the test file and this entry. The registry index (`docs/experiments/README.md`) lists the commit for each identifier.
2. Other experiments do not use this one's code or data, so they keep working.

## Restoring the original behaviour

- Turning the flag off restores the original manual survey and Upgrades tab exactly.
- Reverting the code does the same, permanently.
- Neither one rewrites the save. Restoring an older save snapshot is a separate step, and the game never does it automatically: Settings, then Import.

## Tests after turning it off or reverting

- `node tools/run-tests.js` runs the full suite. After a revert, `click-power.test.js` is gone with the code.
- `node tools/equivalence-check.js` checks that the build with every experiment off still matches the baseline.
- `node tools/tests/click-power.test.js` covers 35 checks, including:
  - The first survey pays 1.
  - Gloves are the only upgrade at the start. They can't be bought below 10 salvage, they charge exactly 10 once, and they can't be bought twice.
  - The next survey pays 2, whether you click the button or press the S key.
  - The ladder arithmetic.
  - Drill pricing, and the cap at rank 25.
  - Hand tools never change automatic surveys.
  - The Echo Sounder.
  - The breakdown.
  - Click upgrades survive a reload.
  - Noclip:
    - It gives the same Déjà Vu with the flag on or off.
    - It clears the click upgrades.
    - It keeps memories.
  - Turning the flag off gives the original formula exactly. The new upgrades can't be bought and nothing is charged, and the Upgrades tab opens at 5 rooms again.
  - Turning it back on restores the bonuses.

## Limitations

- **The survey reward is replaced as a whole.** The experiment sets `D.manualSalvage` in the `derive:survey` hook. Another experiment that also changes the manual reward would have to run after it there. None does today.
- **"Other" in the breakdown.** Multiplier sources are named one by one. A survey multiplier added later shows as "Other" until it is named. The total is always the real value.
- **No refunds.** Turning the flag off or reverting the code never refunds salvage spent on these upgrades. Refunding would create currency the player did not earn.
- **Déjà Vu rises indirectly.** Noclip's formula is untouched. But an active player earns more salvage in a run, and Déjà Vu is computed from run salvage, so the first exit pays about 17% more Déjà Vu. See the measurements below.

## Balance measurements

These figures come from the deterministic pacing bot: 7 seeds, medians, two iterations.

- It compares `?exp=none` with `?exp=none,EXP-CLICK-POWER`.
- The all-off build matched the original build `ebfa0c6` exactly on every seed.
- "Hand share" is the share of the run's salvage that came from surveys made by hand.

| Profile | Build | Level 1 | Level 3 | Level 5 | Exit | Déjà Vu | Hand share |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Active, 3 surveys/s, iteration 1 | original | 3.4 min | 22.2 min | 54.6 min | 80.2 min | 214 | 26% |
| | click power | 2.8 min | 19.3 min | 53.6 min | 80.4 min | 250 | 44% |
| Active, iteration 2 | original | 0.5 min | 4.0 min | 15.1 min | 24.5 min | 585 | 6% |
| | click power | 0.5 min | 4.0 min | 15.2 min | 24.5 min | 615 | 13% |
| Casual, 1 survey/s, iteration 1 | original | 8.4 min | 32.0 min | 67.0 min | 95.4 min | 223 | 9% |
| | click power | 7.4 min | 30.2 min | 65.8 min | 93.7 min | 244 | 15% |
| Casual, iteration 2 | original | 1.2 min | 5.3 min | 17.1 min | 27.2 min | 642 | 2% |
| | click power | 1.1 min | 5.4 min | 17.4 min | 27.3 min | 654 | 5% |

What the numbers show:

- An active player reaches Level 1 to Level 3 about 13–18% sooner, and surveying by hand earns close to half of their salvage.
- From Level 5 the run is still paced by facilities and room counts, so the exit time does not change.
- A player who surveys less benefits less. A player who doesn't survey by hand at all is not affected.
- No costs were retuned after measuring.
