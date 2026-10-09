# EXP-FACILITY-TIERS: facility tiers on facility rows

| Field | Value |
| --- | --- |
| Identifier | `EXP-FACILITY-TIERS` |
| Name | Facility tiers on facility rows |
| Purpose | Moves the 30 tier upgrades to the facility they improve. Each facility row in Facilities shows its installed tiers, the next tier and what it needs, with an Install button. Before this, the tiers made up half of the Upgrades tab. |
| Depends on | `EXP-CORE`, for the `upgradeHome`, `facilities:row`, `facilities:rowUpdate` and `tabDot` hooks. The slot was added in `5d5724d`. If EXP-CREW-AUTOMATION is on, the tier line sits under its staffing note. |
| Flag | `EXP-FACILITY-TIERS`, on by default. |

## What it changes (placement only)

- **Where tiers are listed.** `upgradeHome` returns `facilities` for every tier upgrade, so they leave the Upgrades tab.
- **The facility row.** Each facility with tiers gets one line:
  - With tiers to come: "Tiers 1/3 · output ×2. Next: Second Basket, ×2 output", with an Install button showing the price.
  - While the next tier is locked: "…at 25 owned (you have 12)".
  - When all are installed: "Every tier is installed".
- **The Install button** buys through the same `buy-upg` action and purchase code as the Upgrades tab. It is disabled when the tier can't be afforded.
- **The Facilities tab gets a dot** when a tier can be installed and afforded. The Upgrades tab used to show that signal.
- **Unchanged:** prices (12×, 90× and 900× the facility's base cost), requirements (10, 25 and 50 owned) and effects (×2, or ×1.5 for beacons).

## Files and functions affected

- **`index.html`:**
  - The `EXP-FACILITY-TIERS` script slot holds `facilityTiersExperiment`. Its hooks are `upgradeHome`, `facilities:row`, `facilities:rowUpdate`, `tabDot` and `manual`.
  - The matching stylesheet slot holds the `.tier-line`, `.tier-text` and `.tier-btn` styles.
- **`tools/tests/tiers.test.js`:** the experiment's tests.
- **`docs/experiments/EXP-FACILITY-TIERS.md`:** this entry.

## Save-schema effects

None. Tiers are stored as before, as `run.upgrades.tier_<facility>_<n>`.

## Turning it off

Any one of the following works:

- Use the developer menu's experiment list.
- Add `?exp=-EXP-FACILITY-TIERS` to the address.
- Run `HUM.Exp.set('EXP-FACILITY-TIERS', false)` in the console.

Tiers then return to the Upgrades tab, and the rows lose their tier line.

## Reverting its code

1. Run `git revert <EXP-FACILITY-TIERS commit>`. It touches only the two slots, the test file and this entry.
2. The empty slot can stay, or go with `5d5724d`.

## Restoring the original behaviour

Turning the flag off or reverting the code restores the original placement exactly. Owned tiers keep working either way.

## Tests after turning it off or reverting

- Run `node tools/run-tests.js` for the full suite.
- Run the three-experiment equivalence check described in EXP-UPGRADE-CATEGORIES.
- `node tools/tests/tiers.test.js` runs 12 checks:
  - Tiers belong to their facility.
  - A locked tier says what it needs.
  - At 10 owned, the row offers the tier at 180 salvage, and the button is disabled without the salvage.
  - The Upgrades tab no longer lists tiers.
  - The Facilities tab is marked when a tier is affordable.
  - Installing from the row charges the price and doubles the output, and the row then shows the next tier.
  - A facility with every tier says so. Dampeners show no tier line.
  - Switched off, tiers return to the Upgrades tab.
  - No errors.

## Limitations

- **A tier bought out of order is shown correctly, but the line has room for one next tier.** A player can buy tier 2 before tier 1 when they own 25 or more. The line offers the cheapest tier available now.
