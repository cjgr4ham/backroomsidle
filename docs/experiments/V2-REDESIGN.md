# The Hum v2: survey power, specialists, timed research, entities and Level FUN

**Status: the core game.** This is a redesign, not a switchable experiment. It folded five experiments into the core (listed below) and changed the rules every other experiment builds on.

## 1. What changes

**Survey power is the heart of the game.**
- A fresh game recovers +1 salvage per survey by hand, and nothing happens on its own.
- `derive()` works out:

  `surveyPower = base × facility multiplier × survey upgrades × level depth × global bonuses × Survey Drills`

  A survey recovers `surveyPower × condition`, where condition is the sanity band and lights out ×0.5.
- **Salvage facilities** never produce anything. Each unit adds its `bonus` to the facility multiplier, and tiers at 10, 25 and 50 owned double it. The first Salvage Cart takes +1 to +1.25 per survey.
- **Support facilities** improve something else, never salvage:
  - beacons add rooms to every survey;
  - condensers add almond water from every source;
  - arrays add Echoes from every source;
  - dampeners absorb noise.
- **Passive salvage comes only from the Scavenger.** Survey power never depends on passive output, and passive output never depends on survey power.

**Facilities open in level waves.**
- Reaching a level opens its whole wave, with no other requirement. The tab lists the coming waves with their levels.
- Every wave has a salvage facility. The Duct Boiler moved to Level 3.

**Five unique specialists replace the workforce.**
- The Scavenger (passive salvage), the Cartographer (automatic rooms), the Dowser (water), the Watcher (noise absorption and earlier entity warning) and the Archivist (Echoes).
- Each is recruited once with salvage, works at once, and is upgraded level by level with salvage. The Crew tab shows the current effect, the next one and the price.
- An incident can take a specialist away for a few minutes. They always come back at the same level.
- Hiring, jobs, idle and missing wanderers, default jobs and staffing are gone.

**Expeditions become missions.**
- A mission needs a specialist at a level, plus almond water, and runs on the game clock. There is no crew allocation, and no specialist is taken away.
- Their salvage is a share of the Scavenger's output over the mission's length, never survey power.

**Research is timed.**
- The Echo cost is paid once, when the project starts. One project runs at a time.
- The effect starts when it finishes on the game clock. `step()` splits a step at the finishing time, also during time away, so a benefit never applies to time before completion.
- Kept across reloads and noclips. Deep Survey Theory records its rank and cost when it starts. Doctrines can be adopted only once their research has finished.

**Hostile entities.**
- During active surveying, every 55–110 s (sooner with attention), something appears ahead with a warning, then becomes dangerous.
- A survey in danger, from the button or the S key, is checked before anything is recovered or mapped. It costs 10% of held salvage (20% when hunted), capped at 120 surveys' worth, plus some sanity. This is resolved once, and a short stun refuses repeats.
- Standing still avoids it, and a cooldown follows.
- Never in a background tab, never during time away, never after a reload.
- Shown as an alert, a viewport label and a drawn figure, all of which stay visible with every effect reduced.

**Completion and Level FUN.**
- Noclip is locked until the last room of Level 5.
- Completing the survey records that noclip is open and moves the run into endless Level FUN, with its own look. Rooms mapped past the exit are carried over, and everything is kept.
- In FUN, every 50,000 rooms is a floor worth +10% depth.
- Noclip stays optional. Only a noclip counts as one, on the counter and on the leaderboard.

**Save format 2**, with a repeat-safe migration from format 1. See section 6.

**Folded into the core:** their flags, code slots and tests no longer exist. Their entries are kept as the record.

| Experiment | Where its behaviour lives now |
| --- | --- |
| [EXP-CLICK-POWER](EXP-CLICK-POWER.md) | The survey power line and breakdown (`renderPowerDetail`), the hand tools and survey upgrades in `BASE_UPGRADES`, and Survey Drills (`run.drills`) |
| [EXP-CREW-AUTOMATION](EXP-CREW-AUTOMATION.md) | Crew requisitions in the Crew tab, now multiplying specialists. The staffing rule is gone. |
| [EXP-FACILITY-TIERS](EXP-FACILITY-TIERS.md) | Tiers installed from each facility's row (`Panels.facilities.updateTier`) |
| [EXP-FACILITY-INDEPENDENCE](EXP-FACILITY-INDEPENDENCE.md) | Facilities never need anyone. There is no crew to need. |
| [EXP-FACILITY-SALVAGE-SCALING](EXP-FACILITY-SALVAGE-SCALING.md) | The salvage-first Facilities tab: gain previews in survey power, a price curve per facility, and the coming waves |

## 2. Files and functions

**`index.html`, configuration and content:**
- `CONFIG`: `survey`, `encounters`, `specialists`, `missions`, `fun`, `tierCounts`/`tierCostMult`, `prestige`
- `LEVELS` (now with Level FUN), `FINAL_LEVEL`, `FUN_LEVEL`
- `FACILITIES`, `BASE_UPGRADES`, `SPECIALISTS`, `RESEARCH`, `MISSIONS`

**`index.html`, simulation:**
- `derive()`, through `deriveMultipliers`, `deriveFacilities`, `deriveSurvey` and `deriveSpecialists`
- `survey()`, `step()`, `advance()`, `updateTimers()`, `catchUp()`
- `addRooms()`, `enterLevel()`, `completeFiniteSurvey()`
- `hireSpecialist()`, `specCost()`
- `launchMission()`, `missionSalvage()`, `completeMission()`
- `doResearch()`, `completeResearch()`
- `encounterGap()`, `updateEncounter()`, `spawnEncounter()`, `endEncounter()`, `caughtByEntity()`
- `canNoclip()`, `noclip()`
- `migrateV1()`, `migrate()`, `sanitizeState()`, `sanitizeRun()`, `loadGame()`

**`index.html`, interface:**
- `Panels.facilities`, `Panels.upgrades`, `Panels.crew`, `Panels.expeditions`, `Panels.research`, `Panels.noclip`
- `renderPowerDetail()`, `objective()`, the entity alert
- `View`: `LOOKS[6]`, `drawEntity`, `scare`

**Server:**
- `server/features/cloud-save.js`, `validate()`: accepts formats 1 and 2.
- `server/features/leaderboard.js`, `check()`: accepts Level FUN reports.

**Tools:** `tools/balance-bot.js`.

**Tests:** `economy`, `facilities`, `specialists`, `research`, `encounters`, `fun` and `migration` in `tools/tests/`, with the version-1 fixtures in `tools/tests/fixtures/`.

## 3. Dependencies

**`EXP-CORE`:** the experiment registry, hook points and wallet.

**Experiments adapted to it:**
- `EXP-UPGRADE-CATEGORIES`: summaries in survey power and specialists.
- `EXP-RESOURCE-LEDGER`: a Specialists entry instead of Wanderers.
- `EXP-ATTENTION-BALANCE`: wording.
- `EXP-DEV-MENU`: level select up to Level 5, Complete the survey, Finish it now, specialist levels, Send an entity.
- `EXP-NOCLIP-STATISTICS`: counts noclips only.
- `EXP-DEJA-VU-SHOP`: Old Friends brings specialists. A purchase applies only that item's own bonus.
- `EXP-CLOUD-SAVE`: shows the level label.
- `EXP-NOCLIP-LEADERBOARD`: reports from Level FUN.

## 4. How to disable it

It cannot be switched off at runtime. It is the game.

The remaining experiments keep their flags: `?exp=-EXP-ID`, the Dev tab, or `HUM_DISABLE` on the server.

## 5. How to reverse the code

Revert the v2 commits together, newest first, with `git revert`. Never hard-reset.

| Commit | What |
| --- | --- |
| the documentation commit after `efe9cb1` | the README, this registry and the entries |
| `efe9cb1` | deployment |
| `81729c2` | tools |
| `7f85235` | tests |
| `80dee83` | countdown rounding and the dev menu label |
| `e79e493` | the migration cap |
| `d89151a` | the Déjà Vu shop fix |
| `07846e5` | the balance bot |
| `0816e62` | the server |
| `a52658d` | the game |

To roll back the game only and keep the deployment files, revert from `80dee83` down to `a52658d`, and the tests commit `7f85235`.

Reverting brings back the five folded experiments with their old flags, and the old tests with them.

## 6. Persistent data

**Yes. Save format 2.**

| Changed | Fields |
| --- | --- |
| New | `run.specialists`, `run.away`, `run.missions`, `run.drills`, `run.stunUntil`, `run.nextEncounterAt`, entity statistics, `researching` |
| Gone | `run.crew`, `run.expeditions` |

**Migration** (`migrateV1`) works on a copy and returns format 2, so it runs once per save. It covers local saves, backups, imports and cloud downloads, all through `sanitizeState()`. It keeps facilities, upgrades and tiers, research, Deep Survey Theory, Memories, relics, achievements, Déjà Vu, iteration, the noclip counters and developer marks.

**Crew conversion:**
- Each job's wanderers become that specialist's levels.
- Idle, missing and expedition wanderers join the Scavenger.
- A level cap per Backrooms level stops a large old crew becoming an absurdly strong specialist: 3, 7, 12, 18, 22 and 26 for Levels 0–5, and 30 in FUN.
- Wanderers beyond the cap are refunded the almond water they cost.

**Other conversions:**
- Expeditions under way continue as missions.
- A completed survey (the exit found on Level 5) arrives in Level FUN with noclip still open.
- Survey Drills ranks move from the click-power experiment's namespace into the game.

**What the player sees:** a window and the log say what changed. The untouched version-1 save is kept in the browser under `the-hum.save.v1`.

## 7. Database migration

None. The server's tables are unchanged. It stores whatever save format it receives (1 or 2) and accepts noclip reports from Level FUN.

## 8. How to restore the original behaviour

1. Revert the code (section 5).
2. A version-1 build refuses a format-2 save with a clear reason ("made by a newer version"). It keeps that save aside under `the-hum.save.unreadable-*`, never deleting it, and falls back to the backup.
3. To return to the save exactly as it was before the update, copy the kept version-1 copy back, in the browser console with `#debug`:

   ```js
   localStorage.setItem('the-hum.save', localStorage.getItem('the-hum.save.v1'))
   ```

   Then reload.

Cloud saves keep their history (Settings → Account → earlier versions), including any format-1 revision from before the update.

## 9. Data created while it was on

- **Format-2 saves:** kept. A version-1 build sets them aside and does not delete them.
- **Server rows:** untouched.
- **Progress made after the update:** exists only in format 2. Rolling back loses it unless the version-2 code returns.

## 10. Rollback tests actually performed

- **Save-path rollback, run on 10 October 2026:**
  1. The version-1 fixture was loaded into this build, which migrated it and kept the copy.
  2. The **version-1 build** (`a177c49`) was opened on the same browser storage. It showed "Save restored from backup", gave the reason "This save was made by a newer version of The Hum (format 2)", kept the format-2 save under `the-hum.save.unreadable-…`, and loaded the version-1 backup.
  3. The kept `the-hum.save.v1` copy was restored, and the version-1 build loaded it with iteration, level, crew and Déjà Vu intact.
- **Not performed:** reverting the v2 commits in a clone and running the old suites. The old revert proof (`tools/revert-check.js`) and the all-off equivalence check (`tools/equivalence-check.js`) were removed with this redesign. Both compared against the pre-experiment build, which the redesigned core deliberately no longer matches.
- **Migration** is covered by `migration.test.js`: 25 checks on saves written by the version-1 build itself.
