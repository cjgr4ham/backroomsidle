# EXP-FACILITY-SALVAGE-SCALING: the salvage-first Facilities shop

| Field | Value |
| --- | --- |
| Identifier | `EXP-FACILITY-SALVAGE-SCALING` |
| Name | Salvage-first Facilities shop |
| Purpose | Makes the Facilities tab a clear salvage shop. Each purchase shows what it adds, in explicit units, and what the totals become. Locked facilities show what they would add and what unlocks them. Each salvage machine has its own price curve. |
| Flag | `EXP-FACILITY-SALVAGE-SCALING`, on by default |

## 1. What it changes

**Layout.** The Facilities tab is arranged in three sections:

1. **Salvage machines**, the main purchasing progression: Salvage Cart, Wire-Stripping Bench, Carpet Rendering Vat, Ceiling Tile Foundry, Duct Boiler, Night Switchboard and Fold Engine.
   - Unit: **salvage per second**.
   - A summary line gives their total salvage per second, its share of passive salvage, and the facility multiplier from levels, upgrades, research, achievements, Déjà Vu and crew.
2. **Support equipment**, with functions that are kept as they were:
   - Survey Beacon: automatic surveys per second. Each automatic survey recovers a quarter of a survey's base salvage, so the unit is salvage **per survey**.
   - Humidity Condenser: almond water per second.
   - Acoustic Dampener: noise absorbed.
   - Resonance Array: Echoes per second.
3. **Locked**: every facility not yet available. Each one shows:
   - what it would add, at your current multipliers, in its unit;
   - the price of the first unit and the growth per unit;
   - exactly what unlocks it, with progress, for example "Own 5 Ceiling Tile Foundries (you have 3)".
   
   Unlocks use the existing progression only: levels, rooms mapped, almond water found, and earlier facilities. No level was added and no facility needs crew.

**Each row** keeps everything it showed before: the count owned, output each and in total, noise, tiers, and the Buy button with the price of the chosen quantity. It adds one line, for example:

> Buy 10: +2.40 salvage/s → carts 3.60/s, all passive salvage 9.10/s · each next one costs 12% more

- The gain and the totals after buying come from the game's own `derive()`, run with the extra units.
- So they are exact for any combination of experiments, tiers, multipliers and crew. No formula is duplicated.
- When a purchase changes where attention settles, the line says so.
- The line follows the buy-quantity selector (×1, ×10, ×25, MAX) and updates on every refresh, including right after a purchase.

**Price curves** go through the `facility:price` hook. The price of the next unit is `first price × growth^owned`. Buying `n` units costs the closed-form sum `first × growth^owned × (growth^n − 1) / (growth − 1)`.

| Machine | First unit (unchanged) | Growth before | Growth now | Output each (unchanged) |
| --- | --- | --- | --- | --- |
| Salvage Cart | 15 | 1.15 | **1.12** | 0.2 salvage/s |
| Wire-Stripping Bench | 120 | 1.15 | **1.13** | 1.2 salvage/s |
| Carpet Rendering Vat | 1,400 | 1.15 | **1.14** | 7 salvage/s |
| Ceiling Tile Foundry | 16,000 | 1.15 | 1.15 | 40 salvage/s |
| Duct Boiler | 190,000 | 1.15 | **1.16** | 230 salvage/s |
| Night Switchboard | 2.4M | 1.15 | **1.165** | 1,300 salvage/s |
| Fold Engine | 36M | 1.15 | **1.17** | 7,000 salvage/s |
| Support equipment | unchanged | 1.16–1.2 | unchanged | unchanged |

- **Cheap machines grow slowly,** so they stay worth stacking while you wait for the next machine.
- **Expensive machines grow faster,** so each one is a real decision.
- Output per unit, tier upgrades and unlock rules are unchanged.
- The table is the `CURVES` object at the top of the module. Each entry can set `growth`, and `base` for the first-unit price. Anything not listed keeps its original curve.

## 2. Files and functions

- **`index.html`, `EXP-FACILITY-SALVAGE-SCALING` slot:** `facilitySalvageScalingExperiment`.
  - Hooks: `facility:price` (the curves), `facilities:layout` (sections, built with the panel's own `row()`), `facilities:row` and `facilities:rowUpdate` (the purchase line), `facilities:update` (section summaries and the locked list), `manual`.
  - Helpers: `withMore()`, which runs `derive()` with extra units and puts the count back; `gainText()`; and `needs()` for unlock text.
- **Stylesheet slot:** `.fs-*`.
- **`tools/tests/facility-scaling.test.js`:** 23 checks.
- **`tools/pacing-compare.js`:** accepts `label=file?flags`, used for the curve measurements. This was a separate `tools:` commit.
- **This entry.**

## 3. Dependencies

- `EXP-CORE`, for `facPrice`, `facility:price`, `facilities:layout`, `facilities:update` and `facilities:sig`.
- It works alongside:
  - `EXP-FACILITY-TIERS` (tier lines stay on each row);
  - `EXP-FACILITY-INDEPENDENCE` (the subtitle);
  - `EXP-CREW-AUTOMATION` (staffing notes, when staffing is on);
  - `EXP-DEJA-VU-SHOP` (its discount lowers the first price; the curve is unchanged).
- None of these is required, and nothing depends on this experiment.

## 4. How to disable it

- Use the Dev tab → Experiments.
- Or add `?exp=-EXP-FACILITY-SALVAGE-SCALING` to the address for one page load.
- Or run `HUM.Exp.set('EXP-FACILITY-SALVAGE-SCALING', false)` with `#debug`.

The prices return to the original curves at once, and the tab returns to its original layout. What you own does not change.

## 5. How to reverse the code

`git revert` its commits, newest first. They touch only its two slots, its test file and this entry.

## 6. Does it modify persistent data?

No. Prices are worked out from the count owned, which the game already saves. The experiment stores nothing.

## 7. Does it need a database migration?

No.

## 8. How to restore the original behaviour

Turn it off, or revert it.
- The original curve, with growth 1.15 for every salvage machine, and the original layout return.
- After that, the next unit's price follows the original curve from the count already owned.

## 9. What happens to data created while it was on

- **None is created.**
- Machines bought at the new prices stay owned.
- Salvage spent is not refunded, in line with the registry's no-refund rule. A refund would create salvage the player never earned.

## 10. Rollback tests actually performed

**`tools/tests/facility-scaling.test.js`, 23 checks, all passing.**

- **Purchasing:**
  - the first cart adds exactly 0.2 salvage/s × the facility multiplier;
  - the row shows ownership, the next gain with its unit, the totals after it, and the price, and all of these update right after buying;
  - a facility changes neither crew output nor the reward of a survey made by hand;
  - each cart costs `ceil(15 × 1.12^owned)`.
- **Prices and accuracy:**
  - every salvage machine has its own curve, and support equipment keeps the original one;
  - the closed-form price equals the unit-by-unit sum at 300–1,200 owned (relative error below 1e-9);
  - MAX buys the largest affordable quantity, for 15 combinations of budget and owned count;
  - a price beyond the largest number shows "beyond any budget" and cannot be bought.
- **Output, layout and unlocks:**
  - cart, bench, vat and foundry each add their documented output;
  - sections come in order, and locked facilities show output, price and requirement with progress;
  - no requirement mentions crew;
  - support rows state their own units.
- **Rules:**
  - an unaffordable purchase is refused and its button disabled;
  - ownership and next prices are the same after a reload;
  - a noclip resets facilities and prices;
  - developer infinite salvage buys at the normal rising prices without spending.
- **Switching it off** restores the original prices and layout, with nothing owned changed. Switching it back on brings the curves back.

The revert proof (`tools/revert-check.js`) results are listed in the registry index.

## Balance measurements

These figures come from the deterministic pacing bot: the first iteration, medians, in minutes and in Déjà Vu at the exit.
- **No curves:** the same build with `CURVES` empty.
- **Default flags:** every default experiment on, which is what players get.
- **Isolated:** only `EXP-CREW-AUTOMATION`, `EXP-FACILITY-INDEPENDENCE` and this experiment on, with no click power.

| Setting | Profile | Curves | L3 | L5 | Exit | Déjà Vu |
| --- | --- | --- | --- | --- | --- | --- |
| Default flags, 9 seeds | Active, 3 surveys/s | none | 18.5 | 49.1 | 74.5 | 282 |
| | | **these** | 18.6 | 50.1 | 74.7 | 263 |
| | Casual, 1 survey/s | none | 30.0 | 65.5 | 93.5 | 217 |
| | | **these** | 29.7 | 65.1 | 92.5 | 187 |
| Isolated, 9 seeds | Active | none | 22.3 | 54.6 | 80.2 | 214 |
| | | **these** | 21.7 | 53.6 | 79.3 | 197 |
| | Casual | none | 32.0 | 67.1 | 96.0 | 217 |
| | | **these** | 32.6 | 74.3 | 104.6 | 176 |

**Choice of curves.** With the default flags, these curves change the time to the exit by less than 1% on both profiles. In the isolated setting a casual player is about 9% slower.

Other curve sets were measured the same way. None was neutral in both settings, and the differences in the isolated setting do not follow the price changes:
- Set C (1.11, 1.12, 1.13, 1.14, then 1.15) was 3.5% faster for casual but 5.5% slower for active.
- Set E (1.12, 1.13, 1.14, then 1.15) made only early machines cheaper, yet was 13% slower for casual.

So the isolated differences reflect how the bot's buying decisions cascade on particular seeds, not a steady effect of the curves. The set kept is the one that is neutral where players actually play and that gives the clearest choice: cheaper growth for cheap machines, steeper for big ones.

Déjà Vu at the exit varies by about ±25% between seeds, as noted in the registry index, so the Déjà Vu column is not a reliable signal at these sample sizes.

## Limitations

- The purchase line covers the facility's own output and passive salvage. It also shows where attention settles. It does not predict achievements a purchase might complete (for example 100 facilities owned), which add 1% salvage each.
- Pacing was measured with a scripted player. Real players, who buy differently, may see different effects.
