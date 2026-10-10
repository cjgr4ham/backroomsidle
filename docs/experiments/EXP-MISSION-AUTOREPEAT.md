# EXP-MISSION-AUTOREPEAT: the Dispatch Protocol

Part of update 2.1 ([UPDATE-2.1.md](UPDATE-2.1.md)).

| Field | Value |
| --- | --- |
| Identifier | `EXP-MISSION-AUTOREPEAT` |
| Default | on |
| Content id | `upgrade:dispatch` |
| Depends on | `EXP-CORE` (update 2.1 infrastructure: `mission:done`, `step:split`, `launchMission(id, { at, quiet })`, the Missions tab hooks, `home` tabs) |

## 1. What changes

**The requisition.**
- Dispatch Protocol is a salvage requisition costing 4M. It opens on Level 2 once a mission has been sent.
- It is listed in the **Missions tab**. The Upgrades tab points to it with a button that opens Missions.
- It resets when you noclip, like every requisition.

**The switches.** Once it is installed, every mission card gets an **Auto-repeat: OFF / ON** switch. Every mission starts off.

**A mission with Auto-repeat on.**
- **Returns:** its rewards are granted once, and it is sent again at that exact moment through `launchMission()`. Its specialist and level are checked again, its almond water is paid, and its length, hazard and haul are worked out again, exactly as for a manual dispatch.
- **One team per mission.** Specialists are never taken away and keep working.
- **Cannot go:** it waits and its card says why: "Waiting for 260 almond water.", "Waiting for the Archivist at level 3." or "Waiting: reach Level 4: The Night Office.".
  - It is tried again every 2 seconds of game time, quietly, with no log lines.
  - A line is logged only when a mission goes out after waiting more than 30 seconds while you are present.
- **Competition rule (deterministic).** Waiting missions form a queue, oldest first, by the time each started waiting. Missions that started waiting at the same moment go in the order of the missions list.
  - A mission waiting only for almond water keeps its place, and the missions behind it wait too ("Waiting behind Flooded Annex, which was waiting first."), so the oldest gets the water first.
  - A mission held up by its level or its specialist does not block the others, because waiting cannot fix that.

**Pause all** in the Missions tab holds every Auto-repeat. Turning a switch off, or pausing, **never recalls a team already out**: the trip finishes and pays out once.

**Choices** are kept in `S.ext.dispatch` through reloads and noclips. They do nothing until Dispatch Protocol is installed again in the new iteration.

**Time away.** The step is cut a microsecond after each return of a mission with Auto-repeat on (`step:split`), so:
- each return and the next departure happen at their own moment;
- several returns inside one coarse step are never collapsed;
- nothing happens beyond the offline limit;
- there is no recursion, because the hook only calls `launchMission()`;
- a reload never completes a trip twice.

Waiting missions are tried at every step of time away, and start at the current time, never retroactively.

## 2. Files and functions

`index.html`, slot `EXP-MISSION-AUTOREPEAT`:
- `Content.upgrade` (Dispatch Protocol) and the save namespace `dispatch`.
- `blocker()`, `queue()`, `service()` and `send()`.
- Hooks:
  - `mission:done`, `step`, `step:split` and `noclip:newRun`;
  - `missions:head`, `missions:card`, `missions:cardUpdate`, `missions:update` and `missions:sig`;
  - `automation:summary`, `manual` and `dispatch:api` (for tests).
- CSS slot `EXP-MISSION-AUTOREPEAT`.

Tests: `tools/tests/dispatch.test.js`.

## 3. Dependencies

`EXP-CORE` only.
- **Independent** of the visuals and of `EXP-AUTO-UPGRADE`. The test suite repeats a mission with every other update-2.1 experiment off.
- Late requisitions and research that shorten missions apply through `missionDuration()`.

## 4. How to disable it

- **The whole experiment:** Dev tab → Experiments, `?exp=-EXP-MISSION-AUTOREPEAT` for one page load, or `HUM.Exp.set('EXP-MISSION-AUTOREPEAT', false)` with `#debug`.
- **Just the requisition:** Dev tab → Content switches, or `?content=-upgrade:dispatch`.

Switched off:
- nothing goes out by itself any more;
- a team already out finishes its paid trip and pays out once;
- the switches and the requisition leave the interface;
- ownership and choices are kept.

Switched back on, missions with Auto-repeat on and no team out are sent as soon as they can be paid for. A trip already under way is not charged again.

## 5. How to reverse the code

`git revert` this experiment's commit. It fills only its own JavaScript and CSS slots and adds its test and this entry.
- The `dispatch` namespace stays in saves as data of an experiment the build does not have.
- The requisition id is kept in `run.dormant.upgrades`.

## 6. Persistent data

Yes:
- `run.upgrades.dispatch` (the normal requisition field);
- `S.ext.dispatch = { auto: { <mission>: true }, paused?: true, wait?: { <mission>: <game time> } }`.

Missions under way use the normal `run.missions`. There is no save-format change.

## 7. Database migration

None.

## 8. How to restore the original behaviour

Switch the experiment off (section 4): missions are sent only by hand, exactly as before. `tools/equivalence-check.js` checks the build with every update-2.1 experiment off against `c903362`.

## 9. Data created while it was on

The choices and the requisition stay in the save. A build from before the update:
- keeps `ext.dispatch` untouched;
- keeps the requisition id in `run.dormant.upgrades`;
- completes missions under way normally.

## 10. Rollback tests actually performed

`dispatch.test.js`, 35 checks:
- the unlock, its home, the pointer and the offer;
- choices dormant before installation;
- switches off by default;
- sending again at the exact return time, with each dispatch worked out again (Hand-Drawn Maps shorten the next trip) and supplies paid each time;
- one team per mission, specialists still working, no log lines;
- waiting with its reason, quietly retried, sent when paid for;
- requirements named;
- the queue order, holding water for the oldest, and the tie order;
- Pause all and resume;
- switching off never recalling a team;
- time away: 12 returns in one catch-up, each trip starting exactly at the last return, never beyond the limit;
- a reload completing a due trip once;
- switched off (flag and content id): the paid trip finishes once, ownership and choices kept, nothing listed, resumes when back on;
- choices kept through a noclip and inert until it is installed again;
- working with every other update-2.1 experiment off.
