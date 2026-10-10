# EXP-CREW-VISIBLE: visible crew

Part of update 2.1 ([UPDATE-2.1.md](UPDATE-2.1.md)).

| Field | Value |
| --- | --- |
| Identifier | `EXP-CREW-VISIBLE` |
| Default | on |
| Depends on | `EXP-CORE` (update 2.1 infrastructure: `view:frame`, `view:segment`, `view:reset`, `page:visible`, `View.features`) |

## 1. What changes

The specialists you have recruited can be seen at work in the camera feed.

**World space.**
- Each crew member has a place in the corridor: a world position along it (`z`) and across it (`x`).
- They are drawn inside the corridor loop, after their own stretch and before anything nearer. So they get that stretch's light, the fog and the perspective, and nearer walls hide them like anything else.
- Beyond the wall line, only what shows through the doorway is drawn.

**Surveys.**
- A survey moves the camera on at once. The crew stay where they are, slide to the edge of the view and pass behind the camera.
- They are not drawn while behind it. Positions are never tied to the screen.
- A crew member left behind abandons the scene and walks after you, faster than walking pace. Stop surveying and they catch up from behind the camera.
- After 12 seconds or 8 stretches behind, they go "another way" and later come out of an open doorway ahead, fading in from the dark of the doorway.

**What never happens.**
- Nobody jumps while visible.
- Nobody is drawn twice.
- Nobody walks through a wall: they leave or join the corridor only through an open doorway or room. The Long Hallway's doors stay shut.
- Surveys are never held up. A scene is simply abandoned. Production is untouched.

**On stage.**
- At most two are on stage at once. The others are working out of sight.
- Every 15–30 seconds one leaves through a doorway and another comes on, which is the larger change.
- A newly recruited specialist walks on within about a second.

**Scenes.**
- A crew member walks to a work site ahead, works for 6–14 seconds, then packs up and checks (1.5–2.5 s).
- They gesture every 2–4 seconds. A work result comes every 5–12 seconds, through the `crew:result` hook, which room variety and production feedback use.
- **Scavenger:** opens a wall panel and works the wiring, with a sack at their feet.
- **Cartographer:** goes ahead and scans the corridor with a notebook.
- **Dowser:** works the pipes on Level 2, the puddles and water elsewhere, filling bottles from a mop bucket.
- **Watcher:** checks doorways (and the Long Hallway's shut doors) with a flashlight beam, listening.
- **Archivist:** works by the wall with a recorder at their feet, its light on.
- Each role has its own colours and headgear: hard hat, surveyor's cap, long coat, headphones.

**Respects the game.**
- Only recruited specialists appear.
- One taken by an incident walks off stage and is never drawn while away.
- Missions never remove anyone.
- With the lights out the work stops, as production does.
- With an entity in the corridor, everyone keeps still against a wall, and the entity is always drawn over them. Once it has gone, they walk back to their own work sites.

**Drawn to a sound.**
- Another experiment can draw a crew member's attention to a spot in the corridor through `crew:attend(id, spot)`. Ambient events use it for the Watcher.
- Only someone at work and in view goes, and never while an entity is in the corridor.
- They walk over within the corridor, stop short of the doorway, turn their light on it for 2–3 seconds, then go back to their work site, or to a new one if it has fallen behind.
- `crew:attend(id, null)` sends them back at once.
- Under reduced motion their label reads "WATCHER · CHECKING".

**Reset and return.**
- A new level, an import, an erase or a noclip clears the scene.
- Back from a hidden tab, or after loading, a representative scene is composed: the crew already at work ahead.

**Reduced motion.** Still poses: nobody walks, everyone is simply at their place. A name label is drawn over each figure.

**Drawing only.**
- It reads the game and never changes it.
- It has its own random sequence (never `Math.random`) and its own clock (frame time, capped at 0.1 s).
- The simulation, economy and save are exactly the same with it on or off. This is tested by running the same seeded session, rendered every frame, both ways.
- No page structure changes per frame.

## 2. Files and functions

`index.html`, slot `EXP-CREW-VISIBLE`:
- the director: `direct()`, `step1()`, `enter()`, `leave()`, `toSite()`, `startWork()`, `compose()`;
- movement: `walk()`, which crosses the wall line only inside a doorway's span;
- sites: `pickSite()`, `doorAhead()`;
- drawing: `drawActor()`, `roleProps()`, `label()`;
- drawn to a sound: `attend()`, `back()`;
- hooks: `view:frame`, `view:segment`, `view:reset`, `page:visible`, `flagsChanged` and `manual`;
- it offers `crew:where`, `crew:attend`, `crew:api` and the `crew:kit` and `crew:result` hook points to other experiments.

Tests: `tools/tests/crew-visible.test.js`, which drives the simulation and every frame itself.

## 3. Dependencies

`EXP-CORE` only.
- **Optional cooperation**, each working without the others:
  - `EXP-CREW-EQUIPMENT` draws kit on the figures through `crew:kit`;
  - `EXP-ROOM-VARIETY` leaves traces where work results land, through `crew:result`, and adds doorways and rooms the crew can use, through `view:features`;
  - `EXP-PRODUCTION-FEEDBACK` places captions over a visible crew member, through `crew:where`;
  - `EXP-AMBIENT-EVENTS` has the Watcher check a sound, through `crew:attend`, only if the Watcher is on stage.
- None of them is needed.

## 4. How to disable it

Dev tab → Experiments, `?exp=-EXP-CREW-VISIBLE` for one page load, or `HUM.Exp.set('EXP-CREW-VISIBLE', false)` with `#debug`. The crew disappear from the camera feed at once. Nothing else changes.

## 5. How to reverse the code

`git revert` this experiment's commits, newest first:
1. the `crew:attend` commit;
2. the commit for a specialist taken by an incident;
3. the experiment's own commit.

Revert `EXP-AMBIENT-EVENTS` before the `crew:attend` commit, since it calls that hook. Without the hook it simply never sends the Watcher.

The experiment fills only its own slot and adds its test, this entry and a manual-frames option in the test harness.

## 6. Persistent data

None. Everything it has is runtime state: positions, scenes, its clock and its random sequence. It is never saved.

## 7. Database migration

None.

## 8. How to restore the original behaviour

Switch it off (section 4). The camera feed is then the one from before the update.

## 9. Data created while it was on

None.

## 10. Rollback tests actually performed

`crew-visible.test.js`, 23 checks:
- only recruited specialists, and none while taken;
- two on stage;
- world-space positions that the camera moves past;
- passed when surveying fast and not drawn behind the camera;
- coming back from behind or out of a doorway, never appearing mid-corridor;
- over about 1,100 frames of bursts and pauses: no jump while visible, nobody drawn twice, never more than two on stage, never crossing a wall outside an open doorway;
- surveys never held up;
- reduced motion still with labels;
- the scene cleared on a level change and an import;
- a representative scene after a hidden tab;
- still during an entity, and back at their own sites once it has gone;
- drawn to a sound: the Watcher walks over within the corridor, looks and goes back to work; a null spot sends them back at once; nobody is sent during an entity;
- no page structure changes;
- frame cost about 1.4 ms with the simulation step;
- **the same seeded session, rendered every frame with the crew on and off, ends in exactly the same state**;
- no errors either way.
