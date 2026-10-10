# EXP-DV-PRICES: Déjà Vu prices

Part of update 2.1 ([UPDATE-2.1.md](UPDATE-2.1.md)). Added on request: one run should not be able to buy out the Déjà Vu shop.

| Field | Value |
| --- | --- |
| Identifier | `EXP-DV-PRICES` |
| Default | on |
| Depends on | `EXP-CORE` (`dv:price`, added in its own commit for this experiment) |

## 1. What changes

**The problem.** A first run earns about 150 to 175 Déjà Vu. With the first prices, spending it cheapest first bought every Memory, two Recurrence ranks, four levels of Old Friends and the first levels of everything else: nearly the whole shop after one run.

**New prices.**

| Upgrade | First price | New price |
| --- | --- | --- |
| Muscle Memory | 1 | 10 |
| Old Friends (the Memory: the Scavenger) | 2 | 20 |
| Thirst | 3 | 30 |
| Habitual Hoarding | 3 | 30 |
| Lucid | 4 | 40 |
| It Remembers You | 5 | 50 |
| Second Shift | 6 | 50 |
| Long Sleep | 6 | 50 |
| The Way Down | 5 | 60 |
| Procurement Notes | 10 | 80 |
| **All ten Memories** | **45** | **420** |
| Recurrence, per rank | 8 × 2^rank | ×5: 40 × 2^rank |
| Stashed Salvage, per level (Déjà Vu shop) | 4 × 2.5^level | ×4 |
| Remembered Prices, per level (Déjà Vu shop) | 6 × 2.2^level | ×5 |
| Old Friends levels 2–5 (Déjà Vu shop) | 5, 10, 20, 40 | ×6: 30, 60, 120, 240 |

Everything with a limit now costs 18,421 Déjà Vu, about a hundred first runs' worth. Recurrence has no limit.

**What one run buys now** (balance bot, active player, spending cheapest first; 2 seeds):

| | After run 1 (152–159 Déjà Vu) | Iteration 2 | Iteration 3 |
| --- | --- | --- | --- |
| First prices | all 10 Memories, Recurrence 2, Old Friends 4, Stashed Salvage 2, Remembered Prices 2 | exit in 15.3 min | exit in 11.0–11.2 min |
| New prices | Muscle Memory, Old Friends, Thirst, Habitual Hoarding, Old Friends 2, Stashed Salvage 1 | exit in 22.4–22.9 min | exit in 16.6–16.7 min |

All ten Memories now take about three runs, and the levels and Recurrence are long-term goals. Iteration 2 is still about three times faster than iteration 1 (72–73 minutes).

**What does not change.**
- Déjà Vu earned per noclip, and its +1% production per point ever earned. Spending never reduces that bonus.
- Anything already bought. Owned Memories and levels are kept, and nothing is refunded or taken back.
- Every effect.

**Where the prices show.** The Déjà Vu shop's cards, its "need N more" notes, the original Memories section of the Noclip tab (when the shop experiment is off), and the tools' `djv:api` all use the same prices. A bug found while doing this was fixed in its own commit: the shop's Memory cards showed the Memory's raw price while buying charged `memoryCost()`.

## 2. Files and functions

`index.html`, slot `EXP-DV-PRICES`:
- `MEMORY` (a price per one-off Memory) and `SCALE` (×5 Recurrence, ×4 Stashed Salvage, ×5 Remembered Prices, ×6 Old Friends levels);
- hooks: `dv:price` and `dvprices:api` (for tests).

Tests: `tools/tests/dv-prices.test.js`.

## 3. Dependencies

- `EXP-CORE`: `dvPrice()` and `dv:price`, its own commit.
- The shop's own levels are scaled only when `EXP-DEJA-VU-SHOP` is on, through that experiment's `dvPrice()` commit. Without the shop, the Memories alone are repriced.

## 4. How to disable it

Dev tab → Experiments, `?exp=-EXP-DV-PRICES` for one page load, or `HUM.Exp.set('EXP-DV-PRICES', false)` with `#debug`. Every price is the first one again at once. Anything bought either way stays bought.

## 5. How to reverse the code

`git revert` this experiment's commit. Then, if wanted, revert the `dvPrice()` commits in `EXP-DEJA-VU-SHOP` and `EXP-CORE`, in that order. Both do nothing without an answer.

## 6. Persistent data

None. Prices are derived; purchases are stored where they always were (`S.memories`, `ext.djv`).

## 7. Database migration

None.

## 8. How to restore the original behaviour

Switch it off (section 4).

## 9. Data created while it was on

None. Purchases made at the new prices are ordinary purchases and stay when it is switched off.

## 10. Rollback tests actually performed

`dv-prices.test.js`, 10 checks:
- each Memory at its new price;
- Recurrence and the shop's levels scaled;
- every price back to the first one when switched off;
- the shop shows exactly what buying charges, for a Memory, a level and Recurrence;
- 175 Déjà Vu spent cheapest first buys 7 things (4 of the 10 Memories), leaving 10 of 13 upgrades below their limit;
- everything with a limit costs 18,421;
- switching either way keeps every purchase and the Déjà Vu balance, and Déjà Vu earned is unchanged;
- without the shop, the original Memories section shows and charges the same prices;
- no errors on either page.

`deja-vu-shop.test.js` (40 checks) runs against the shop's own prices, with this experiment off.
