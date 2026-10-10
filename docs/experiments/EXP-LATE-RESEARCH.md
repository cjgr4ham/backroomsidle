# EXP-LATE-RESEARCH: late research

Part of update 2.1 ([UPDATE-2.1.md](UPDATE-2.1.md)).

| Field | Value |
| --- | --- |
| Identifier | `EXP-LATE-RESEARCH` |
| Default | on |
| Content ids | `research:late_filing`, `research:late_acoustics`, `research:late_logistics`, `research:late_crewcraft`, `research:late_cartography`, `research:late_signal` |
| Depends on | `EXP-CORE` (update 2.1 infrastructure: `Content.research`, `reqLevel`, independent ranks, research set aside) |

## 1. What changes

Six research projects, shown as Tier 6. They open once the level has been reached in any iteration (`S.life.maxLevel`), so they stay open after a noclip.

| Project | Opens | Needs | Echoes | Time | Effect | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| Filing Theory | Level 4 | Automated Documentation | 1,500 | 8m | research started afterwards takes 25% less time | research efficiency |
| Corridor Acoustics | Level 4 | Deep Listening | 2,500 | 10m | noise ×0.7, +2 noise absorption | noise |
| Night Logistics | Level 4 | Expedition Cartography | 4,000 | 12m | missions 25% shorter, ×1.5 salvage | missions |
| Crew Craft | Level 5 | Phantom Labour | 12,000 | 15m | specialists work ×1.25 (×1.5 in its first commit; see below) | specialist output |
| Hallway Cartography (repeatable) | Level 5 | Cartographic Recursion, Night Logistics | 8,000 × 1.7^rank | 10m × 1.15^rank | +10% rooms per survey per rank | mapping, Level FUN |
| Signal Theory (repeatable) | Level 5 | Crew Craft | 15,000 × 1.75^rank | 15m × 1.15^rank | +12% specialist work per rank | specialist output, Level FUN |

- Research stays as it was: paid once in Echoes, timed on the game clock, one project at a time, and kept through noclips.
- **Independent ranks.** Each repeatable keeps its own rank in `S.ext.ranks`, with its own cost and time. Deep Survey Theory keeps `S.deepTheory` and is unaffected.
- The two repeatables keep scaling in Level FUN, where Echo income keeps growing. They are the two scalable paths this experiment adds to Level FUN. Each rank takes longer to research than the last (×1.15), so they grow steadily, not explosively.
- **Crew Craft tuned after the balance runs** (its own commit), from ×1.5 to ×1.25. The late requisitions and facilities were tuned at the same time. Together they had made Level FUN run away; the measurements are in [UPDATE-2.1.md](UPDATE-2.1.md).
- **Echo prices** sit between the last older projects (up to 120 Echoes) and what players hold by then. Before the update, the balance bot reached Level 4 with about 3,000 unspent Echoes and finished with about 70,000 unspent, because research had run out. The measured figures are in [UPDATE-2.1.md](UPDATE-2.1.md).

## 2. Files and functions

- `index.html`, slot `EXP-LATE-RESEARCH`: six `Content.research(...)` definitions and a manual entry.
- The infrastructure does the rest:
  - `researchAvailable()` (`reqLevel`);
  - `rankOf()` and `setRank()`;
  - `researchCost()` and `researchTime()`;
  - `gatherFx()` (`fx`, `fxRank`);
  - `syncResearch()` (set aside and resume);
  - the Research tab (sixth tier, ranks, projects set aside).
- Tests: `tools/tests/late-research.test.js`.

## 3. Dependencies

`EXP-CORE` only. It does not need any other update-2.1 experiment, and none needs it.
- With `EXP-LATE-FACILITIES`, the Hallway Signal Relay also speeds research up. Each works without the other.

## 4. How to disable it

- **The whole experiment:** Dev tab → Experiments, `?exp=-EXP-LATE-RESEARCH` for one page load, or `HUM.Exp.set('EXP-LATE-RESEARCH', false)` with `#debug`.
- **One project:** Dev tab → Content switches, or `?content=-research:late_signal`.

**Switched off:**
- Finished projects and ranks give nothing at once, and stay recorded.
- A project of switched-off content that is under way is set aside, already paid, in `S.ext.resq`. That frees the research slot for another project.
- Switched back on, a set-aside project resumes by itself once the slot is free, with the time it had left and no second charge.
- A set-aside project that was finished some other way meanwhile is refunded.

## 5. How to reverse the code

`git revert` this experiment's commit. It only fills its own slot and adds its test and this entry. After the revert, nothing is lost:
- finished project ids are kept in `dormant.research`;
- ranks stay in `S.ext.ranks`;
- a project under way is kept in `dormant.researching`.

Re-applying the commit restores them.

## 6. Persistent data

Yes:
- `research.<id>` (the normal field);
- `ext.ranks.<id>` for the repeatables;
- `researching` for a project under way;
- `ext.resq` while one is set aside.

There is no save-format change.

## 7. Database migration

None.

## 8. How to restore the original behaviour

Switch the experiment off (section 4). `tools/equivalence-check.js` checks the build with every update-2.1 experiment off against `c903362`.

## 9. Data created while it was on

Research, ranks and a project under way stay in the save while switched off, and stay dormant after a code revert.

A build from before the update (`c903362`):
- keeps finished ids in `dormant.research`;
- keeps `ext.ranks` and `ext.resq` untouched, as data of experiments it does not have;
- **drops a project under way that it does not know**, and with it the Echoes paid for it.

Restore the copy of the save kept from before the update ([UPDATE-2.1.md](UPDATE-2.1.md), section 8), or finish the project first.

## 10. Rollback tests actually performed

`late-research.test.js`, 22 checks:
- the level gates and their persistence after a noclip;
- one project at a time;
- each effect;
- independent ranks, their costs and Deep Survey Theory untouched;
- the Research tab;
- ranks through a noclip and a save;
- switched off: the numbers of the game without them, kept research and ranks, a project set aside that frees the slot, not listed, and a note in the Research tab;
- switched back on: resumed without a second charge, the same numbers;
- one project switched off on its own.
