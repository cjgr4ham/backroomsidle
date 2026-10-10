# EXP-ROOM-VARIETY: room variety and work traces

Part of update 2.1 ([UPDATE-2.1.md](UPDATE-2.1.md)).

| Field | Value |
| --- | --- |
| Identifier | `EXP-ROOM-VARIETY` |
| Default | on |
| Depends on | `EXP-CORE` (update 2.1 infrastructure: `view:segment`, `view:frame`, `view:reset`, `view:features`) |

## 1. What changes

**Rooms off the corridor.**
- Some stretches of the corridor get one of the following.

  | Room | Share of stretches | What it is |
  | --- | --- | --- |
  | Junction | about 4% | a cross corridor on both sides, with its far light |
  | Work bay | about 7% | a deep room on one side, holding a prop |
  | Recess | about 8% | a shallow, low alcove |
  | Storage | about 10% | shelves against a wall |

- **Level identity.** Each level uses its own materials and props:

  | Level | Storage | Work bay |
  | --- | --- | --- |
  | Lobby | cardboard boxes | a desk |
  | Annex | crates | a crate |
  | Ducts | valve racks | a boiler housing |
  | Poolrooms | towel shelves | pool steps |
  | Night Office | filing cabinets | a desk with a monitor's glow |
  | Long Hallway | (none) | a lamp, behind its doors |
  | Level FUN | gift boxes | a cake |

  The Long Hallway keeps its doors: only junctions and rooms there. The Night Office puts rooms only on stretches without cubicle partitions.
- **Stable.** The choice is seeded by the stretch and the level (`roomAt(k, level)`), so the same stretch always looks the same, whenever you return to it.
- **Coherent.** Each room is closed within its stretch: back wall, floor, ceiling and far face. It is drawn inside the corridor loop after its stretch, so nearer walls hide it correctly, as in a real corridor.
- **For the corridor's other users.** It reports its doorways through `view:features`, with their span and height. The visible crew can enter and leave through junctions and bays, and work there.

**Work traces.**
- Where the crew finish a piece of work (`crew:result`), a trace stays behind:
  - an opened panel with wiring (Scavenger);
  - chalk arrows (Cartographer);
  - bottles (Dowser);
  - tape beside a doorway (Watcher);
  - markings or a recorder (Archivist).
- **Bounded to nearby scenes:** at most 12, dropped once 30 stretches behind the camera, and cleared with the scene (new level, import, noclip).
- Older traces of the crew you have are seeded along the corridor, about one stretch in nine. They show only for specialists you have recruited, so they also appear with the visible crew off.

**Drawing only.**
- It reads the game and never changes it. The same seeded session, rendered every frame with it on and off, ends in the same state.
- No page structure changes.

## 2. Files and functions

`index.html`, slot `EXP-ROOM-VARIETY`:
- `roomAt()`, `drawRoom()`, `bayProp()`, `drawStorage()`, `zRect()`;
- traces: `seeded()`, `drawTrace()`;
- hooks: `view:features`, `view:segment`, `view:frame`, `view:reset`, `crew:result`, `manual` and `rooms:api` (for tests).

Tests: `tools/tests/room-variety.test.js`.

## 3. Dependencies

`EXP-CORE` only.
- Without `EXP-CREW-VISIBLE`, the rooms and the older traces still appear. The test suite checks this.
- With it, crew results add fresh traces, and the crew use its doorways.

## 4. How to disable it

Dev tab → Experiments, `?exp=-EXP-ROOM-VARIETY` for one page load, or `HUM.Exp.set('EXP-ROOM-VARIETY', false)` with `#debug`. The corridor is drawn exactly as before, and `View.features()` reports it as before.

## 5. How to reverse the code

`git revert` this experiment's commit. It fills only its own slot and adds its test and this entry.

## 6. Persistent data

None. Traces are runtime state, and rooms are derived from the stretch.

## 7. Database migration

None.

## 8. How to restore the original behaviour

Switch it off (section 4).

## 9. Data created while it was on

None.

## 10. Rollback tests actually performed

`room-variety.test.js`, 15 checks:
- the same room for the same stretch;
- the shares per level;
- the Long Hallway's doors kept;
- no room behind a Night Office partition;
- doorways reported with span and height, and reported as before when off;
- traces bounded, of each kind, gone far behind and on a new level;
- older traces only for recruited crew, and sparse;
- a junction actually drawn: the camera feed differs on and off;
- **zero effect on the game: the same session in the same state on and off**;
- rooms and older traces with the visible crew off;
- no errors.
