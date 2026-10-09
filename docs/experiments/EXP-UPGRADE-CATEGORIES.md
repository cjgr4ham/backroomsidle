# EXP-UPGRADE-CATEGORIES: upgrade categories

| Field | Value |
| --- | --- |
| Identifier | `EXP-UPGRADE-CATEGORIES` |
| Name | Upgrade categories |
| Purpose | Makes the Upgrades tab easier to read. Requisitions are grouped by what they actually do, with a compact category control and a live summary of the numbers each group changes. |
| Depends on | `EXP-CORE`, for the `upgrades:build` and `upgrades:sig` hooks added in `5d5724d`. It works with or without the other experiments: requisitions those experiments move to other tabs are pointed to rather than duplicated. |
| Flag | `EXP-UPGRADE-CATEGORIES`, on by default. |

## What it changes (layout only)

- **The category control** sits at the top of the Upgrades tab. It lists All and each category that has requisitions available, with a count.
  - It uses the existing segmented-control style.
  - The selected category is interface state for this page only. It is never saved.
- **Categories follow each upgrade's existing `cat` field.** That field already matched each upgrade's actual effect, which was checked one by one:

  | Category | `cat` | What it holds | Live summary |
  | --- | --- | --- | --- |
  | Survey | Survey | Salvage per survey, rooms per survey, survey finds. Includes the hand tools when EXP-CLICK-POWER is on. | survey power and rooms per survey |
  | Machines | Facility | Facility tiers, plus the shift upgrades when EXP-CREW-AUTOMATION is off | machine salvage per second, its share of income, the facility multiplier |
  | Crew | Crew | Radio, crew efficiency and jobs, when EXP-CREW-AUTOMATION is off | wanderers, idle, crew efficiency |
  | Sanity | Sanity | Sanity recovery and drain, and drinking | sanity, its band, its rate of change, drink cost and effect |
  | Noise & risk | Risk | Noise absorption, incident warnings and damage, Kill the Lights | noise, absorption, attention and where it is heading |
  | Expeditions | Expedition | Expedition time, rewards and safety | expeditions out |

- **All** shows every category under its own heading. The headings follow the order in the table above.
- **Pointers to other tabs.** A line names requisitions listed elsewhere, such as the Crew tab under EXP-CREW-AUTOMATION or facility rows under EXP-FACILITY-TIERS, so players don't hunt for them here.
- **The locked count** is broken down by category.
- **The installed list** is grouped by category.
- **Unchanged:** every price, requirement and effect. The same purchase code runs, through the same slip buttons. Summaries read the same derived values as the rest of the interface.

## Files and functions affected

- **`index.html`:**
  - The `EXP-UPGRADE-CATEGORIES` script slot holds `upgradeCategoriesExperiment`. Its hooks are `upgrades:build`, `upgrades:sig`, `ui:update` and `manual`.
  - The matching stylesheet slot holds the `.cats*` styles.
- **`tools/tests/categories.test.js`:** the experiment's tests.
- **`docs/experiments/EXP-UPGRADE-CATEGORIES.md`:** this entry.

## Save-schema effects

None. Nothing is stored. The selected category lasts for the page session only.

## Turning it off

Any one of the following works:

- Use the developer menu's experiment list.
- Add `?exp=-EXP-UPGRADE-CATEGORIES` to the address.
- Run `HUM.Exp.set('EXP-UPGRADE-CATEGORIES', false)` in the console, with `#debug` in the address.

The Upgrades tab then returns to its original single list, sorted salvage-first by price.

## Reverting its code

1. Run `git revert <EXP-UPGRADE-CATEGORIES commit>`. The commit touches only the two slots, the test file and this entry.
2. The two Upgrades-tab hooks in EXP-CORE do nothing without it. They can stay, or be reverted with `5d5724d`, which also adds the EXP-FACILITY-TIERS slot.

## Restoring the original behaviour

Turning the flag off or reverting the code restores the original layout exactly. No gameplay data is involved.

## Tests after turning it off or reverting

- Run `node tools/run-tests.js` for the full suite.
- `node tools/equivalence-check.js ebfa0c6 '?exp=none,EXP-UPGRADE-CATEGORIES,EXP-FACILITY-TIERS,EXP-RESOURCE-LEDGER'` checks that the simulation is unchanged with all three organization experiments on. It matches the baseline on all 96 checkpoints.
- `node tools/tests/categories.test.js` runs 12 checks:
  - Every available upgrade is listed exactly once.
  - Each upgrade sits under its own category, and the counts are right.
  - Every category has a summary.
  - Choosing a category shows only that category and doesn't change the game.
  - Buying from a category applies the upgrade and charges once. The category stays selected and its summary updates.
  - All restores every group.
  - The tab doesn't scroll sideways at 390 px wide.
  - Switched off, the original single list returns in its original order.
  - No errors.

## Limitations

- **The experiment rebuilds the Upgrades tab itself.** It uses the `upgrades:build` hook rather than editing the original builder, so a later change to the original builder's text must be made here too.
- **Classification comes from the existing `cat` field.** An upgrade added later with a new `cat` is shown under "Other" until it is given a category here.
