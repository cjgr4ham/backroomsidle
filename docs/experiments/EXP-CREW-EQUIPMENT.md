# EXP-CREW-EQUIPMENT: crew equipment

Part of update 2.1 ([UPDATE-2.1.md](UPDATE-2.1.md)).

| Field | Value |
| --- | --- |
| Identifier | `EXP-CREW-EQUIPMENT` |
| Default | on |
| Depends on | `EXP-CORE` (`crew:row`, `crew:rowUpdate`, `crew:sig`, `view:frame`) |

## 1. What changes

Each specialist's kit grows at four level milestones, one new piece each time.

| Specialist | Level 5 | Level 15 | Level 30 | Level 45 |
| --- | --- | --- | --- | --- |
| Scavenger | crowbar | headlamp | salvage trolley (replaces the sack) | cutting torch (replaces the crowbar) |
| Cartographer | survey rod | mapping tablet (replaces the notebook) | tripod level | laser theodolite (replaces the tripod level) |
| Dowser | divining rod | water tank | wheeled barrel (replaces the mop bucket) | brass pendulum (replaces the divining rod) |
| Watcher | radio | storm lantern (replaces the flashlight beam) | folding stool | night-vision goggles |
| Archivist | satchel of tapes | boom microphone | reel-to-reel recorder (replaces the recorder) | antenna pack |

**No duplicates.** Kit has slots: hand, head, back, carry and so on. A better piece replaces the one in its slot. Kit that replaces one of the visible crew's base props hides that prop through `crew:kitHide`, so nothing is carried or drawn twice.

**Recognisable at a glance.** Each piece changes the figure's outline: a striped pole, a tank on the back, a trolley or barrel beside them, a tripod, a boom over the head, an antenna. A few pieces also glow: the headlamp, the tablet, the lantern, the goggles and the torch's flame.

**Where it shows.**
- **On the visible crew,** through `crew:kit`. Each piece is drawn with the figure's own light, fog and doorway clipping. Some pieces show only at work: the tripod is set up, the stool unfolded, the torch lit.
- **In the Crew tab,** one line under each recruited specialist. For example: "Kit: crowbar, headlamp · level 30: salvage trolley", or "· complete" once all four pieces are in. So it means something with the visible crew off.

**Reduced motion:** no flame flicker, turning reels or swinging pendulum.

**It never changes what anyone produces.** It only shows the level they already have.

## 2. Files and functions

`index.html`, slot `EXP-CREW-EQUIPMENT`:
- `MILESTONES`, `KIT`, `kitFor()`, `nextFor()`, `line()`;
- `DRAW`, one drawing per piece;
- hooks: `view:frame` (its own animation clock), `crew:kitHide`, `crew:kit`, `crew:sig`, `crew:row`, `crew:rowUpdate`, `manual` and `kit:api` (for tests).

CSS slot `EXP-CREW-EQUIPMENT` (`.spec-kit`).

Tests: `tools/tests/crew-equipment.test.js`.

## 3. Dependencies

`EXP-CORE` only.
- With `EXP-CREW-VISIBLE` on, the kit is drawn on the figures through its `crew:kit` and `crew:kitHide` hooks. `crew:kitHide` was added in its own commit.
- Without it, the Crew tab line still shows. The test suite checks this.
- Revert this experiment before the `crew:kitHide` commit.

## 4. How to disable it

Dev tab → Experiments, `?exp=-EXP-CREW-EQUIPMENT` for one page load, or `HUM.Exp.set('EXP-CREW-EQUIPMENT', false)` with `#debug`. The kit and the Crew tab line go at once, and the base props come back.

## 5. How to reverse the code

`git revert` this experiment's commit. It fills only its own JavaScript and CSS slots and adds its test and this entry.

## 6. Persistent data

None. The kit is derived from each specialist's level.

## 7. Database migration

None.

## 8. How to restore the original behaviour

Switch it off (section 4).

## 9. Data created while it was on

None.

## 10. Rollback tests actually performed

`crew-equipment.test.js`, 11 checks:
- four milestones per role, one new piece at each;
- never two pieces in one slot, and the replacements are right;
- base props hidden only from the milestone that replaces them;
- the Crew tab line, its update at a milestone, and no DOM changes while the level stays the same;
- the line goes when switched off and returns when switched on;
- the kit actually drawn: a still scene differs at level 45;
- **the same seeded session, with levels crossing milestones and rendered every frame, ends in the same state on and off**;
- the Crew tab line with the visible crew off;
- no errors.
