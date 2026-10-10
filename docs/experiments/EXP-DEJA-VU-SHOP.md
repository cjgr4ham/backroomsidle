# EXP-DEJA-VU-SHOP: the Déjà Vu shop

> **In v2:** Old Friends' extra levels bring specialists in order (the Cartographer, the Dowser, the Watcher, the Archivist) instead of wanderers. Buying a level applies only that item's own bonus: buying Old Friends no longer hands out Stashed Salvage's starting salvage again, a bug the v2 tests found and fixed. See [V2-REDESIGN.md](V2-REDESIGN.md).

| Field | Value |
| --- | --- |
| Identifier | `EXP-DEJA-VU-SHOP` |
| Name | Déjà Vu shop |
| Purpose | Turns the existing Memories section into a dedicated shop for permanent upgrades. Each upgrade shows its level, current effect, next effect and next price. The shop adds three leveled upgrades with distinct purposes. |
| Flag | `EXP-DEJA-VU-SHOP`, on by default |

The game already had a Déjà Vu shop: the Memories section of the Noclip tab, with 11 Memories. This experiment improves that shop. It adds no second shop and no second currency. Déjà Vu keeps its established meaning:

- earned only by noclipping;
- `S.dv` is the balance to spend, and `S.dvTotal` is everything ever earned;
- every point ever earned adds +1% production, and spending never reduces that.

## 1. What it changes

### Where the shop is

- **Noclip → Déjà Vu shop** is a sub-tab of the existing Noclip tab, so no top-level tab is added.
- The noclip view no longer lists the Memories. It shows the Déjà Vu balance and an "Open the Déjà Vu shop" button instead.
- **The shop says these upgrades are permanent:** "Requisitions, facilities and wanderers are lost when you noclip; these never are." Every card is labelled "Permanent" and marked in the Déjà Vu colour.

### Each card shows

- its level and maximum ("Level 2 / 8"), or "no limit" for Recurrence;
- what it does now, what the next level does, and the next price;
- "Max level" when maxed;
- "need N more" when it cannot be afforded, with the button disabled.

A card ignores clicks for 0.5 s after a purchase, so a double click buys one level.

### The upgrades

Upgrades marked **new** are added by this experiment. The others are the original Memories, with unchanged effects and prices.

| Group | Upgrade | Levels | Price of the next level | Effect |
| --- | --- | --- | --- | --- |
| Production | Recurrence | no limit | 8 × 2^level | all salvage, water and Echo production ×1.25 per level |
| | Muscle Memory | 1 | 1 | surveys ×3 salvage, ×1.5 rooms |
| | Thirst | 1 | 3 | almond water ×2 |
| Starting each iteration | **Stashed Salvage (new)** | 8 | 4 × 2.5^level: 4, 10, 25, 63, 157, 391, 977, 2,442 | start with 250 × 6^(level−1) salvage: 250, 1,500, 9,000, 54,000, 324K, 1.94M, 11.7M, 70M |
| | Old Friends | 5 (**levels 2–5 new**) | level 1: 2; then 5 × 2^(level−1): 5, 10, 20, 40 | the radio and 3, 5, 7, 9, 11 wanderers |
| | Habitual Hoarding | 1 | 3 | 10 carts, 5 benches and 2 beacons |
| Prices | **Remembered Prices (new)** | 5 | 6 × 2.2^level: 6, 14, 30, 64, 141 | facilities 6% cheaper per level, up to 30% |
| Survival and travel | Lucid, It Remembers You, The Way Down, Second Shift, Long Sleep | 1 each | 4, 5, 5, 6, 6 | as before |
| Automation | Procurement Notes | 1 | 10 | as before |

All these numbers are in the `CFG` object at the top of the module.

### When effects apply, and why nothing is applied twice

- **Multipliers and the discount** apply as soon as they are bought. The discount lowers the first-unit price through `facility:price`. The price curve and outputs are unchanged.
- **Starting bonuses** (Stashed Salvage and Old Friends levels 2–5) are applied by `topUp()`:
  - **Once per new iteration,** through the `noclip:newRun` hook. It runs inside `noclip()`, after the run is reset and before the save.
  - **Never on load.** A reload loads the iteration exactly as it was saved.
  - **At purchase,** for the current iteration.
  
  `topUp()` *raises* the balance or crew to the bonus amount if they are lower, and never adds on top. So applying it again cannot stack. The tests reload twice after a noclip and check that nothing changes.
- **Starting salvage is added to the balance, not to "salvage recovered this iteration".** It cannot earn Déjà Vu by itself.
- **Old Friends level 1 is the original Memory.** It is bought through the game's own `buyMemory()`, and the game applies it as before. Levels 2–5 only add wanderers above the original 3.
- **Habitual Hoarding** keeps its original timing: it applies at the start of each new iteration.

### Interactions

| With | Interaction |
| --- | --- |
| Starting resources | Stashed Salvage, Old Friends and Habitual Hoarding set different things (salvage, crew, machines), so none can double another. |
| Click power | Starting salvage lets an iteration buy Work Gloves and other hand tools at once. Nothing in the shop multiplies click power except the original Muscle Memory. |
| Facility ownership | Remembered Prices lowers prices only, and composes with each machine's curve (`EXP-FACILITY-SALVAGE-SCALING`). Output is unchanged. |
| Crew | More starting wanderers. Facilities still need no crew. |
| Research and level unlocks | Untouched. The Way Down, which shortens each exit by 30%, is the original Memory. |
| Existing Noclip bonuses | The +1% per Déjà Vu earned, Recurrence, the exit bonus and conditions are unchanged. Spending never lowers the +1% bonus. |
| Developer tools | Infinite Déjà Vu buys without spending and marks the save, as for every currency. |

## 2. Files and functions

- **`index.html`, `EXP-DEJA-VU-SHOP` slot:** `dejaVuShopExperiment`.
  - Configuration: `CFG`. Upgrade definitions: `ITEMS` and `GROUPS`.
  - Purchases: `buy()`, `canBuy()`. Starting bonuses: `topUp()`.
  - Hooks: `facility:price`, `noclip:newRun`, `noclip:subtabs`, `noclip:memories`, `noclip:build`, `noclip:update`, `djv:api` (the API the tools use), `manual`.
  - Prices of its own levels (Stashed Salvage, Remembered Prices, Old Friends levels 2–5) go through the core's `dvPrice(id, level, base, 'level')`. A balance experiment can then set them (`EXP-DV-PRICES` does). With no answer they are the prices in `CFG`.
- **Stylesheet slot:** `.djv-*` and `.slip.djv`.
- **`tools/tests/deja-vu-shop.test.js`:** 30 checks.
- **`tools/balance-bot.js`:** with the shop on, it buys whatever is cheapest. This change is part of the experiment's commit, because the bot uses the shop's `djv:api` hook.
- **This entry.**

## 3. Dependencies

- `EXP-CORE`, for the Noclip sub-tab hooks, `noclip:memories`, `noclip:newRun` and `facility:price`.
- It uses the original Memories' own `buyMemory()`, `memoryCost()` and `memRank()`, and the core's `dvPrice()` (update 2.1).
- Nothing depends on this experiment. `EXP-NOCLIP-LEADERBOARD` adds its own sub-tab to the Noclip tab independently.

## 4. How to disable it

- Use the Dev tab → Experiments.
- Or add `?exp=-EXP-DEJA-VU-SHOP` to the address for one page load.
- Or run `HUM.Exp.set('EXP-DEJA-VU-SHOP', false)` with `#debug`.

The original Memories section returns to the Noclip tab, prices lose the discount, and the next iteration starts as in the original game.

## 5. How to reverse the code

`git revert` its commits, newest first. They touch only its two slots, its test file, the bot's Déjà Vu step and this entry.

Revert `EXP-DV-PRICES` before the update 2.1 commit that prices this shop's levels through `dvPrice()`.

## 6. Does it modify persistent data?

**Yes, additively.**
- It stores the levels of its own upgrades in `ext.djv = { levels: { stash, bargain, friends } }`. The sanitizer clamps each level to its maximum and drops anything else.
- Purchases spend `S.dv`, exactly as buying a Memory always has.
- The original Memories stay in `S.memories`, which is unchanged. That is why Old Friends level 1 is stored there and levels 2–5 in `ext.djv`: the original save code keeps Old Friends at rank 1, and nothing is lost if this experiment is removed.

## 7. Does it need a database migration?

No. It has no server part.

## 8. How to restore the original behaviour

- Turn it off or revert it. The original Memories section returns, with the Memories you own.
- With it off, the extra levels do nothing: no starting salvage, no discount, and Old Friends gives 3 wanderers.

## 9. What happens to data created while it was on

- **Turned off:** `ext.djv` stays in the save and is validated as usual. Turning the shop back on restores every level. A test checks this.
- **Code reverted:** `ext.djv` is kept as opaque experiment data. The game keeps the data of experiments that are not in the build, and restoring the code restores the levels.
- **Déjà Vu, lifetime Déjà Vu and the original Memories** are never touched by removing the shop.
- **Déjà Vu spent** on the new upgrades is not refunded while the shop is off, in line with the registry's no-refund rule.

## 10. Rollback tests actually performed

**`tools/tests/deja-vu-shop.test.js`, 30 checks, all passing.**
- **Rewards and the shop:**
  - a valid noclip awards the previewed Déjà Vu once;
  - the shop is a Noclip sub-tab, with 13 upgrades in five groups, labelled permanent;
  - each card shows level and maximum, current and next effect and price;
  - Recurrence shows "no limit";
  - an unaffordable card says how much more Déjà Vu it needs.
- **Buying:**
  - Stashed Salvage costs 4 and gives 250 salvage at once without counting it as recovered;
  - a burst of three clicks buys one level;
  - Remembered Prices costs 6, 14, 30, 64, 141, then shows "Max level" and refuses more;
  - the discount applies to prices at once.
- **Old Friends:** level 1 is the original Memory (radio and 3 wanderers); level 2 adds 2 wanderers.
- **Next iteration:**
  - the noclip starts it with 1,500 salvage and 5 wanderers;
  - starting salvage is not salvage recovered;
  - levels survive the noclip;
  - two reloads after the noclip change nothing.
- **Compatibility:**
  - an original Memory bought in the shop is the same Memory at the same price, once;
  - a save from before the shop loads with its Déjà Vu and Memories shown as levels;
  - out-of-range shop data is clamped or dropped.
- **Developer tools:** infinite Déjà Vu buys without spending and marks the save.
- **Switched off:**
  - the original Memories section and original prices return;
  - a noclip starts as in the original game;
  - the shop's levels stay in the save and come back when it is on again.

**Also unchanged:** `tools/tests/rebirth.test.js` requires the noclip to behave the same with every experiment off and every experiment on, and it still passes. With no shop purchases, the shop changes nothing about a noclip.

The revert proof (`tools/revert-check.js`) results are listed in the registry index.

## Balance

These figures come from the deterministic pacing bot: 5 seeds, three iterations in a row, medians in minutes. With the shop on, the bot spends Déjà Vu on the cheapest upgrade first. With the shop off, it buys every Memory and then Recurrence, as before.

| Profile | Shop | Iteration | L3 | L5 | Exit | Déjà Vu at the exit |
| --- | --- | --- | --- | --- | --- | --- |
| Active, 3 surveys/s | off | 1 | 18.5 | 50.1 | 74.7 | 263 |
| | on | 1 | 18.5 | 50.1 | 74.7 | 263 |
| | off | 2 | 3.9 | 15.1 | 24.1 | 556 |
| | on | 2 | 3.9 | 14.8 | 24.1 | 560 |
| | off | 3 | 3.0 | 13.1 | 21.6 | 739 |
| | on | 3 | 2.9 | 12.8 | 21.3 | 970 |
| Casual, 1 survey/s | off | 2 | 5.3 | 17.3 | 27.5 | 616 |
| | on | 2 | 5.0 | 16.9 | 27.7 | 492 |
| | off | 3 | 3.7 | 14.7 | 23.6 | 986 |
| | on | 3 | 3.6 | 14.4 | 23.4 | 731 |

**Reading the results.**
- The first iteration is identical: nothing in the shop applies before the first noclip.
- Later iterations reach each level slightly sooner, by 1–6%, and the exit at about the same time.
- The new upgrades add choices without making runs trivial.
- **Affordability:**
  - The cheapest new upgrades cost 4–6 Déjà Vu, affordable after an early noclip, which gives about 3–15.
  - A first exit earns about 210–290, enough for several levels.
  - The top levels (Stashed Salvage level 8 costs 2,442 on its own, 4,069 in total) take several more iterations.
- **Variance:** Déjà Vu at the exit varies by about ±25% between seeds, so that column is not a reliable signal at this sample size.

## Limitations

- The scripted player spends Déjà Vu in a fixed way. Real players will choose differently, and the pacing effect for them may be larger or smaller.
- Starting salvage makes the first minutes of an iteration quicker. The bot surveys at a fixed rate, so it does not measure how that feels.
