# EXP-PRODUCTION-FEEDBACK: grouped production feedback

Part of update 2.1 ([UPDATE-2.1.md](UPDATE-2.1.md)).

| Field | Value |
| --- | --- |
| Identifier | `EXP-PRODUCTION-FEEDBACK` |
| Default | on |
| Depends on | `EXP-CORE` (`step`, `view:overlay`, `view:reset`, `ui:init`, `ui:update`) |

## 1. What changes

- Every 8 to 14 seconds of play, one specialist's production since their last caption is summed up in a short line. The specialists take turns:
  - "Scavenger recovered +12.4K salvage";
  - "Cartographer mapped +930 rooms";
  - "Dowser found +18 almond water";
  - "Archivist recorded +2.4 Echoes".
- **It only reports.** The sums are read from what each step has already credited: each specialist's own rate in `rt.D` × the step. It never adds anything.
- **Sparse.** One caption at a time. None while an entity is in the corridor or during a blackout. None for time away, which has its own report.
- **Where.**
  - With the visible crew showing that specialist, the caption is drawn over their head in the camera feed, under the entity and the anomaly.
  - Otherwise it shows at the foot of the camera feed, in a HUD element hidden from screen readers. Your totals and rates already say the same.
- **Reduced motion:** no rise and no fade.

## 2. Files and functions

`index.html`, slot `EXP-PRODUCTION-FEEDBACK`:
- `LINES`, `show()`;
- hooks: `step`, `view:overlay`, `ui:init`, `ui:update`, `view:reset`, `afterLoad`, `flagsChanged`, `manual` and `feedback:api` (for tests).

CSS slot `EXP-PRODUCTION-FEEDBACK` (`.vp-feed`).

Tests: `tools/tests/production-feedback.test.js`.

## 3. Dependencies

`EXP-CORE` only. It uses `crew:where` from `EXP-CREW-VISIBLE` when that is on, and falls back to the foot of the camera feed when it is not. Both cases are tested.

## 4. How to disable it

Dev tab → Experiments, `?exp=-EXP-PRODUCTION-FEEDBACK` for one page load, or `HUM.Exp.set('EXP-PRODUCTION-FEEDBACK', false)` with `#debug`.

## 5. How to reverse the code

`git revert` this experiment's commit. It fills only its own JavaScript and CSS slots and adds its test and this entry.

## 6. Persistent data

None. The running sums are runtime state.

## 7. Database migration

None.

## 8. How to restore the original behaviour

Switch it off (section 4).

## 9. Data created while it was on

None.

## 10. Rollback tests actually performed

`production-feedback.test.js`, 10 checks:
- the caption wording;
- **the sums match what the game credited** (within 3%, the rest still waiting to be summed up);
- 8 to 14 seconds between captions;
- **it never grants anything**: the same minute gives the same totals on and off;
- every producing specialist gets a turn;
- no new caption during an entity;
- over the crew member's head when visible, at the foot of the feed (hidden from screen readers) with the visible crew off;
- no errors.
