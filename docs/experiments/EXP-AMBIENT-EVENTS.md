# EXP-AMBIENT-EVENTS: ambient events

Part of update 2.1 ([UPDATE-2.1.md](UPDATE-2.1.md)).

| Field | Value |
| --- | --- |
| Identifier | `EXP-AMBIENT-EVENTS` |
| Default | on |
| Depends on | `EXP-CORE` (update 2.1 infrastructure: `view:frame`, `view:segment`, `view:overlay`, `view:reset`, `view:light`, `View.features`, `page:visible`) |

## 1. What changes

Now and then something small happens in the corridor ahead and passes on its own.

| Event | Where | What you see |
| --- | --- | --- |
| A failing light | every level | A light a few stretches ahead stutters, goes out for a moment, blinks and is steady again (4–5 s). Its stretches dim properly: walls, floor, ceiling, and the crew and rooms in them. |
| A door opening | the Long Hallway | One of its doors swings open on its near hinge. The doorway clears onto a room lit by its lamp, the light falls on the corridor floor, and the door closes again (5.5–7.5 s). |
| A door, somewhere inside | levels with dark doorways | A slit of light deep inside a doorway widens and narrows again, with its glow on the floor in front. Never in a Night Office doorway behind a cubicle partition. |
| Footsteps in the water | the Poolrooms | Ripples cross the water, out of a doorway or away down the corridor, one step at a time (about 5 s). Crew walking in the Poolrooms also leave ripples, a bounded few. |
| The Watcher checks a sound | any level, with the visible crew showing the Watcher at work | The Watcher leaves their work, walks to a nearby doorway within the corridor, turns their light on it for 2–3 seconds and goes back to work. The event ends when they are back. |

**Cadence.**
- One event at a time. The next comes 20 to 40 seconds after the last one ended (the first 12 to 24 seconds after loading).
- If nothing fits at that moment, it tries again a few seconds later.

**Never in the way.**
- None begins while an entity is in the corridor, an anomaly is out, an incident warning is on, the lights are out, you are blacked out or shaking. None begins for 8 quiet seconds after any of those.
- An event under way ends the moment any of them begins, before that frame is drawn. Rendering stops during a blackout, so the simulation step watches for danger as well.
- Events happen a few stretches ahead, never in the foreground. They are drawn with the corridor, on its walls and floor before anyone standing there, so they are always under the entity and the anomaly.
- Nothing to click, nothing gained or lost. They are never red and never use the entity's sound or a warning.

**World space.** Each event belongs to a stretch of the corridor. Surveys walk past it like anything else there, and once it is behind the camera it ends.

**Settings.**
- With **flicker** off, a failing light only dims while the event lasts.
- Under **reduced motion**, every event is still: the light dimmed, the door ajar, the ripples as still rings. Each gets a small label, such as "a door opening", like the crew's labels. The crew leave no ripples.
- **Sound** is optional and quiet. There is one short sound when an event begins, at most every 12 seconds, softer with distance. It plays only with sound effects and ambience both on, and never while muted.

**Reset.** A new level, an import, a noclip or switching it off clears the event. Back from a hidden tab, the next one comes 8 to 16 seconds later.

**Drawing only.**
- It reads the game and never changes it.
- It has its own random sequence (never `Math.random`, including the noise offsets of its sounds) and its own clock (frame time, capped at 0.1 s).
- The simulation, economy and save are exactly the same with it on or off.

## 2. Files and functions

`index.html`, slot `EXP-AMBIENT-EVENTS`:
- placing: `placeLight()`, `placeDoor()`, `placeWater()`, `placeCheck()`;
- the events: `begin()`, `end()`, `clear()`, `lightFactor()`, `openness()`;
- drawing: `drawDoor()`, `drawSlit()`, `drawRipple()`, `label()`;
- sound: `sound()`;
- crew footsteps: `crewSteps()`;
- hooks: `view:frame`, `step`, `view:light`, `view:segment` (priority −1, before the crew), `view:overlay`, `view:reset`, `page:visible`, `afterLoad`, `flagsChanged`, `manual` and `ambient:api` (for tests).

Tests: `tools/tests/ambient-events.test.js`.

## 3. Dependencies

- **`EXP-CORE`**: `view:light` (a factor on one stretch's light, added for this experiment) and the other view hooks.
- **Optional:** `EXP-CREW-VISIBLE` for the Watcher (`crew:attend`, `crew:api`) and the crew's footsteps in the water.
  - Without it there is no Watcher to send, and the other events still happen. The test suite checks this.
  - Revert this experiment before the `crew:attend` commit.
- **Works with** `EXP-ROOM-VARIETY`: its rooms are reported through `View.features`, so doors and doorways that have become rooms are left alone.

## 4. How to disable it

Dev tab → Experiments, `?exp=-EXP-AMBIENT-EVENTS` for one page load, or `HUM.Exp.set('EXP-AMBIENT-EVENTS', false)` with `#debug`.

It stops at once. The event under way is cleared, a Watcher checking a sound goes back to work, and nothing stale returns when it is switched on again.

## 5. How to reverse the code

`git revert` this experiment's commit. It fills only its own slot and adds its test and this entry. The `view:light` hook in `EXP-CORE` and `crew:attend` in `EXP-CREW-VISIBLE` were added in their own commits. Both do nothing on their own, and can stay or be reverted after this one.

## 6. Persistent data

None. Events, ripples, the clock and the random sequence are runtime state, never saved.

## 7. Database migration

None.

## 8. How to restore the original behaviour

Switch it off (section 4).

## 9. Data created while it was on

None.

## 10. Rollback tests actually performed

`ambient-events.test.js`, 25 checks:
- cadence over five minutes: each next event 20 to 48 seconds after the last ended, one at a time, each resolved within its few seconds;
- a failing light stutters, goes out and is steady again, and the corridor is drawn with that light (`View.lightLevel` follows);
- a Long Hallway door opens and shuts, and elsewhere there is light from inside a doorway;
- none behind a Night Office partition;
- footsteps only where there is water;
- never in the foreground;
- the Watcher checks only when on stage, goes back to work, and the event ends with it;
- an event ends in the first frame of an entity, anomaly, incident warning, lights out, blackout or the shakes, none begins while they last, and none in the quiet seconds after;
- the next one about 8 quiet seconds after calm returns;
- flicker off and reduced motion: still versions and a label, and no crew ripples;
- passed by surveys;
- crew ripples bounded;
- a hidden tab and a level change clear it;
- sound capped, and none with sound effects or ambience off;
- switching it off stops it at once and sends the Watcher back;
- no page structure changes;
- a frame stays under 1 ms with the simulation step;
- frames with every kind of event draw nothing from `Math.random`;
- **the same seeded session, rendered every frame on and off (871 frames with an event), ends in exactly the same state**;
- without the visible crew, no Watcher and the other events still happen;
- no errors.
