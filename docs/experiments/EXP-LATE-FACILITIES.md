# EXP-LATE-FACILITIES: late facilities

Part of update 2.1 ([UPDATE-2.1.md](UPDATE-2.1.md)).

| Field | Value |
| --- | --- |
| Identifier | `EXP-LATE-FACILITIES` |
| Default | on |
| Content ids | `facility:copier`, `facility:tubes`, `facility:lathe`, `facility:relay` (each facility's three tiers share its id) |
| Depends on | `EXP-CORE` (update 2.1 infrastructure: `Content.facility`, share facilities, live lists) |

## 1. What changes

Four facilities join the last two waves:

| Code | Facility | Wave | Kind | First unit | Growth | Each unit |
| --- | --- | --- | --- | --- | --- | --- |
| F-12 | Carbon Copier | Level 4 | support, share | 2B | ×1.7 | specialists work +3% |
| F-13 | Pneumatic Tube Network | Level 4 | support, rooms | 6B | ×1.7 | +5% rooms per survey, yours and the Cartographer's |
| F-14 | Door-Number Lathe | Level 5 | salvage | 200B | ×1.3 | +300 to the facility multiplier (× facility bonuses) |
| F-15 | Hallway Signal Relay | Level 5 | support, share | 80B | ×1.8 | research +5% faster, for projects started after it is built |

- Like every facility, **none produces anything on its own**. Two improve a specialist you have, one improves your surveys, and one makes research faster.
- Each has three tiers at 10, 25 and 50 owned: ×2 for the Lathe and ×1.5 for the others. They are priced like every tier.
- Each makes noise, and each resets when you noclip.
- The Lathe is the largest salvage facility.
- **Tuned after the balance runs** (its own commit), from the first numbers: Copier +4% at ×1.3 a unit, Tubes +10% at ×1.45, Lathe +600 at ×1.22, Relay ×1.5.
  - With those numbers, Levels 4 and 5 were fine, but the facilities could be stacked without limit in Level FUN. Its depth grows with every room mapped, so a 30-minute stay there gave 12 times the Déjà Vu of the game before the update, and the next iteration's stay about 1,000 times.
  - Prices now grow ×1.7–1.8 a unit (the Lathe ×1.3), and the shares are smaller. The full measurements are in [UPDATE-2.1.md](UPDATE-2.1.md).

## 2. Files and functions

- `index.html`, slot `EXP-LATE-FACILITIES`: four `Content.facility(...)` definitions and a manual entry.
- They rely on the shared infrastructure:
  - `gatherFx()` (share facilities);
  - `deriveFacilities()`;
  - `facEffectText`, `facGainText` and `facPreviewText` (wording for share facilities);
  - `researchTime()` (`researchSpeed`).
- Tests: `tools/tests/late-facilities.test.js`.

## 3. Dependencies

`EXP-CORE` only. It does not need any other update-2.1 experiment, and none needs it.

- The Procurement Controller (`EXP-AUTO-UPGRADE`) can auto-buy these facilities and their tiers like any other.
- Visible crew (`EXP-CREW-VISIBLE`) is unaffected by them.

## 4. How to disable it

- **The whole experiment:** Dev tab → Experiments, `?exp=-EXP-LATE-FACILITIES` for one page load, or `HUM.Exp.set('EXP-LATE-FACILITIES', false)` with `#debug`.
- **One facility:** Dev tab → Content switches, or `?content=-facility:lathe`.

Switched off, the facility:
- leaves every list;
- adds nothing to any number;
- cannot be bought;
- is not counted in totals such as the Canvas Satchel's.

Owned units and tiers stay in the save. Switched back on, the same numbers return, and nothing is granted or charged twice.

## 5. How to reverse the code

`git revert` this experiment's commit. It only fills its own slot and adds its test and this entry.
- After the revert, counts of these facilities in a save are kept dormant (`run.dormant.facilities`) by the update-2.1 infrastructure.
- Their auto-buy choices are kept in `run.dormant.autobuy`.
- Re-applying the commit restores both.

## 6. Persistent data

Yes, through the normal facility fields:
- `run.facilities.<id>`;
- tier ownership in `run.upgrades.tier_<id>_<n>`;
- `run.autobuy.<id>`.

There is no new field and no save-format change.

## 7. Database migration

None.

## 8. How to restore the original behaviour

Switch the experiment off (section 4). The game is then exactly the game before the update for everything this experiment touches. `tools/equivalence-check.js` checks the build with every update-2.1 experiment off against `c903362`.

## 9. Data created while it was on

- Facility counts and tiers stay in the save while the experiment is switched off.
- After a code revert they stay dormant.
- A build from before the update (`c903362`) drops counts of facilities it does not know, keeps their tier ids dormant, and keeps everything else. See [UPDATE-2.1.md](UPDATE-2.1.md), section 8, for restoring the copy of the save kept from before the update.

## 10. Rollback tests actually performed

`late-facilities.test.js`, 20 checks:
- the waves and coming-waves list;
- nothing produced on its own;
- each effect, the tiers and the prices;
- switched off: exactly the numbers of the game without them, not listed, not counted, not purchasable;
- counts and tiers kept through a save round trip, and no salvage changed;
- switched back on: the same numbers, nothing granted twice;
- one facility switched off on its own;
- reset by a noclip.
