# EXP-LATE-UPGRADES: late requisitions

Part of update 2.1 ([UPDATE-2.1.md](UPDATE-2.1.md)).

| Field | Value |
| --- | --- |
| Identifier | `EXP-LATE-UPGRADES` |
| Default | on |
| Content ids | `upgrade:stapler`, `upgrade:lamp`, `upgrade:coffee`, `upgrade:holdmusic`, `upgrade:speeddial`, `upgrade:wedges`, `upgrade:masterkey`, `upgrade:runner` |
| Depends on | `EXP-CORE` (update 2.1 infrastructure: `Content.upgrade`, data-driven effects) |

## 1. What changes

Eight one-off requisitions, all paid in salvage:

| Requisition | Opens | Price | Effect | Covers |
| --- | --- | --- | --- | --- |
| Industrial Stapler | Level 4 | 6B | +6 base salvage on every survey you make by hand | manual salvage |
| Green Desk Lamp | Level 4 | 25B | surveys you make by hand ×1.5 | manual salvage |
| Night Shift Coffee | Level 4, 3 specialists | 15B | specialists work ×1.5 (Crew tab) | specialist output |
| Hold Music | Level 4 | 8B | noise ×0.75 | noise |
| Speed Dial | Level 4, a mission sent | 12B | missions 25% shorter and 25% cheaper in almond water | missions |
| Door Wedges | Level 5 | 150B | every survey maps ×1.5 rooms | mapping |
| Master Key | Level 5 | 600B | surveys you make by hand ×2 | manual salvage |
| Hallway Runner | Level 5, the Cartographer | 250B | the Cartographer works ×2 (Crew tab) | mapping, specialist output |

- Before the update, Levels 4 and 5 had three salvage requisitions between them: the Compass (1B), Unpaid Overtime (2B) and Carbon Copies (30B).
- The new ones are priced for the income there. They range from about a minute of income to the largest late purchase, the Master Key. The measured times are in [UPDATE-2.1.md](UPDATE-2.1.md).
- Each effect is declared as data (`fx`). `derive()` and the mission functions apply it through the same path as everything else.
- The survey slips and the survey line project what the Stapler, the Lamp, the Master Key and Door Wedges do to a survey.

## 2. Files and functions

- `index.html`, slot `EXP-LATE-UPGRADES`: eight `Content.upgrade(...)` definitions, the entries in `SURVEY_LADDER` and `ROOM_LADDER`, and a manual entry.
- The effects come from `gatherFx()`:
  - `hand`, `survey`, `spec`, `chart`, `rooms` and `noise` in `derive()`;
  - `missionTime` in `missionDuration()`;
  - `missionWater` in `missionWater()`.
- Tests: `tools/tests/late-upgrades.test.js`.

## 3. Dependencies

`EXP-CORE` only. It does not need any other update-2.1 experiment, and none needs it.

- With `EXP-AUTO-UPGRADE`, these can be auto-bought like any salvage requisition.
- With `EXP-UPGRADE-CATEGORIES`, they appear in their categories.

## 4. How to disable it

- **The whole experiment:** Dev tab → Experiments, `?exp=-EXP-LATE-UPGRADES` for one page load, or `HUM.Exp.set('EXP-LATE-UPGRADES', false)` with `#debug`.
- **One requisition:** Dev tab → Content switches, or `?content=-upgrade:masterkey`.

Switched off, the requisition:
- gives nothing, at once;
- is not listed anywhere, including the survey line;
- cannot be bought.

Requisitions you own stay owned. Switched back on, the same numbers return, and nothing can be bought or charged twice.

## 5. How to reverse the code

`git revert` this experiment's commit. It only fills its own slot and adds its test and this entry. After the revert, owned ids are kept in `run.dormant.upgrades`, as for any removed requisition, and come back if the commit is re-applied.

## 6. Persistent data

Yes, through the normal requisition field `run.upgrades.<id>`. There is no new field and no save-format change.

## 7. Database migration

None.

## 8. How to restore the original behaviour

Switch the experiment off (section 4). `tools/equivalence-check.js` checks the build with every update-2.1 experiment off against `c903362`.

## 9. Data created while it was on

- Owned requisitions stay in the save, dormant while switched off.
- A build from before the update keeps them in `run.dormant.upgrades` too, because it does not know them.

## 10. Rollback tests actually performed

`late-upgrades.test.js`, 20 checks:
- when each opens and where it is listed;
- each effect, exactly;
- the survey breakdown and the slip projection;
- switched off: the numbers of the game without them, ownership kept, not listed, and the survey line never points to them;
- switched back on: the same numbers, nothing bought or charged twice;
- one requisition switched off on its own;
- reset by a noclip.
