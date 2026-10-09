# Baseline before the experimental update

This file records how The Hum worked **before** the experimental update, so every experiment can be judged against it and rolled back to it.

## Rollback point

| | |
| --- | --- |
| Baseline commit | `ebfa0c6` on `main` (merge of PR #1). Its tree is identical to `d014bdf`, "Add The Hum, a single-file Backrooms idle game". |
| Branch for this work | `claude/idle-game-design-system-7z9fuj`, restarted from `main` at `ebfa0c6` because PR #1 was already merged |
| Working tree at start | Clean. There were no uncommitted user changes. |
| Restore the whole game | `git checkout ebfa0c6 -- index.html` |
| Look at the original | `git show ebfa0c6:index.html > original.html`, then open it in a browser |

## Architecture

- The whole game is one file, `index.html`, with inline CSS and one inline script. There is no build step, no package manifest and no bundler.
- Run it by opening `index.html` in a browser.
- Tests: `tools/functional-test.js` drives the real page in headless Chromium through Playwright and makes 55 checks. `tools/balance-bot.js` plays the game with a scripted strategy.
- `#debug` in the URL exposes the simulation as `window.HUM` for those tools.
- Script sections: configuration and content, utilities, state, `derive()`, simulation, player actions, persistence, audio, viewport renderer, interface, then boot.

## Where each system lives (baseline line numbers)

| System | Code |
| --- | --- |
| Survey action | `survey()`, about line 1988. It is called by the button (`#btnSurvey` click), the `S` key (`onKey`, ignores key repeat) and nothing else. |
| Survey reward | `derive()` "Surveys" and "Manual survey yield" blocks, about lines 1461–1534 |
| Automatic surveys | `derive()`: `autoSurveys = beacons + cartographers`. They are credited in `step()` through `D.sps` and `D.roomsPerSec`. They never call `survey()`. |
| Salvage | `gainSalvage()`. All income goes through it. |
| Upgrades | `BASE_UPGRADES` (29 entries) plus generated `TIER_UPGRADES` (30), `buyUpgrade()`, `Panels.upgrades` |
| Facilities | `FACILITIES` (11), `buyFacility()`, `buyQuote()`, `Panels.facilities` |
| Crew | `JOBS` (5), `hire()`, `assign()`, `crewIdle()`, `Panels.crew`; crew output in `derive()` |
| Attention and noise | `derive()` "Noise and attention", `step()` (exponential approach), `updateIncidents()`, `killLights()` |
| Levels | `LEVELS` (6 entries), `addRooms()`, `enterLevel()`, `findExit()`, `exitRooms()`; renderer looks in `LOOKS` (6) |
| Saving | `save()`, `loadGame()`, `sanitizeState()`, `sanitizeRun()`, `encodeSave()`/`decodeSave()`, `catchUp()` |
| Navigation | `TABS` (8), `UI.selectTab()`, `onKey()` |

## Original behaviour of each system that the update touches

### Survey (manual action)

- One survey maps `roomsPerSurvey` rooms and recovers `manualSalvage` salvage. It also has a 7% chance to find almond water and, after 25 rooms, a 0.6% chance (× sanity factor) to find Echoes. It plays a footstep, moves the camera one room and shows a floating "+N".
- `manualSalvage = (flat + surveyPct × salvagePerSecond) × sanityFactor × (0.5 if the lights are out)`.
- `flat = 1 × levelSurveyMult × DéjàVuMult × achievementMult × recurrence × upgrades`. Level survey multipliers are 1, 3, 8, 20, 50 and 120. Flashlight ×2, Rubber Boots ×3, Backwards Pedometer ×4, Wallpaper Pattern Analysis ×2, Muscle Memory ×3, Wet Doctrine ×0.5, VHS relic ×1.1.
- `surveyPct`: Field Notebook +3%, Clipboard +5%, Carbon Copies +7% of salvage per second.
- Rooms per survey start at 1. Measuring Wheel, Chalk Marks, Compass and Cartographic Recursion are ×2 each, Muscle Memory ×1.5, the needle relic ×1.1, and Long Halls ×1.5.
- Manual surveys are rate-limited to one per 60 ms.
- **A new game earns 1 salvage per survey.** The first purchasable item is the Salvage Cart (15 salvage, Facilities tab, available at once). The Upgrades tab opens at 5 rooms, and its first item is the Flashlight (40 salvage, ×2 survey salvage, needs 5 rooms).
- Automatic surveys recover `flat × 25%` salvage each, so equipment multipliers also feed automation (a documented original design). They never trigger survey sounds, finds, achievements or the hand-survey counter.

### Passive production sources

| Source | Produces | Purchased in | Noise |
| --- | --- | --- | --- |
| Salvage Cart, Wire-Stripping Bench, Carpet Rendering Vat, Ceiling Tile Foundry, Duct Boiler, Night Switchboard, Fold Engine | salvage (0.2, 1.2, 7, 40, 230, 1,300, 7,000 /s each, before multipliers) | Facilities | 0.002, 0.005, 0.02, 0.05, 0.11, 0.25, 0.6 each |
| Humidity Condenser | almond water 0.05/s each | Facilities | 0.003 |
| Survey Beacon | 0.08 automatic surveys/s each | Facilities | 0.004 |
| Resonance Array | Echoes 0.004/s each | Facilities | 0.06 |
| Acoustic Dampener | absorbs 0.12 noise each | Facilities | none |
| Scavenger | 0.4 salvage/s and +5% facility salvage each | Crew | none |
| Cartographer | 0.15 automatic surveys/s each | Crew | none |
| Dowser | 0.05 water/s each | Crew | none |
| Watcher | absorbs 0.1 noise each | Crew | none |
| Archivist | 0.005 Echoes/s each | Crew | none |
| Tier upgrades (30) | ×2 to one facility type (beacons ×1.5) at 10, 25 and 50 owned | Upgrades tab | |
| Inventory Ledger, Shift Bell, Unpaid Overtime | facility salvage ×1.25, ×1.5, ×2 (Overtime also noise ×1.2) | Upgrades tab | |
| Bunk Room, Canteens, Shared Lanterns | crew efficiency ×1.25, ×1.25, ×1.5 | Upgrades tab | |
| Levels | +25% facility salvage per level reached | | |
| Research, Memories, relics, achievements, Déjà Vu | multipliers | Research / Noclip | |
| Expeditions | lump sums of salvage, water, Echoes and relics | Expeditions | |

Facilities and crew therefore ran **two parallel production tracks for the same outputs**. Beacons and cartographers both survey automatically, condensers and dowsers both make water, and arrays and archivists both make Echoes. In a typical run, facilities produced over 95% of salvage.

### Crew

- Hiring costs `4 × 1.25^wanderers` almond water (×0.7 with Shared Water Protocol, ×0.85 with Canteens) and needs the Shortwave Radio (90 salvage).
- Each wanderer is idle, on a job, away on an expedition, or missing. `total = assigned + idle + away + missing`.
- Crew efficiency multiplies every job. The Foreman's Whistle sends new arrivals to a default job.
- Saved as `run.crew = { total, jobs, missing[], defaultJob }`.

### Attention

- `noise = Σ(facilities × noise each) × noise multipliers` (0 while the lights are out).
- `absorption = 1 + Hum study (1) + dampeners + watchers + tile relic (0.5)`, ×1.5 on Level 3.
- Attention moves toward `target = 100 × noise / (noise + absorption)` at 2.5% of the gap per second. Offline it moves the same way.
- Bands: Quiet below 25 (sanity recovers 0.15/s), Uneasy 25–49 and Watched 50–74 (sanity drains 0.004/s per point above 25), Hunted 75+ (incidents, up to one per 90 s, each with an 8 s warning). Attention also multiplies Echo gains (×(1 + A/50)) and shortens the wait between anomalies.
- **Manual surveys produce no noise.**

Scenarios measured on the baseline build (`attention-audit`):

| Scenario | Noise | Absorption | Settles at |
| --- | --- | --- | --- |
| New game, 60 s of surveying at 3/s | 0 | 1 | **0** |
| 10 carts, 5 benches, 4 condensers | 0.057 | 1 | 5.4 |
| Same, while surveying 3/s | 0.057 | 1 | **5.4 (identical)** |
| Low noise, 6 dampeners, Hum study | 0.045 | 2.72 | 1.6 |
| 40 carts, 30 benches, 20 vats, 10 beacons, 12 crew (2 watchers) | 0.715 | 1.2 | 37.3 (Uneasy) |
| Level 2 with 20 foundries and 10 boilers added | 2.815 | 1.2 | 70.1 (Watched) |
| Then 15 dampeners, Foam Glue, 4 watchers | 2.815 | 4.1 | 40.7 (Uneasy) |
| Two hours offline from 0 | | | 40.7 (converges as expected) |

In balance-bot runs on the baseline, attention was 6 at 5 minutes, 24 at 10, 52 at 15 and 67 at 20.

### Levels

There are 6 levels, numbered 0–5. Exit room counts are 800, 4,000, 30,000, 100,000, 350,000 and 500,000. The exit is at the end of Level 5 (×1.5 Déjà Vu). Level identity comes from `LEVELS[i]` data and `LOOKS[i]`, the renderer palette and features. Levels are saved as `run.level` (an index) plus `run.levelRooms`. On load, `sanitizeRun` clamps the level to `LEVELS.length − 1`.

### Noclip: the rebirth system

The game's rebirth (prestige) loop is called **Noclip** in the interface (tab 6). Its currency is **Déjà Vu**, its permanent upgrades are **Memories**, its runs are **Iterations**, and **Conditions** are optional rules for the next run. This update keeps it unchanged.

- **Availability.** `canNoclip()` requires a run level of at least 3 (`CONFIG.prestige.minLevel`) or a found exit, plus a preview gain of at least 1. The tab appears once Level 2 has been reached in any iteration, or from iteration 2.
- **Reward.** `dvPreview() = floor((salvage recovered this iteration ÷ 100,000)^0.3 × multiplier)`. The multiplier is ×1.5 if the exit was found, × the current condition's `dv` (Loud Season 1.25, Long Halls 1.6), and ×1.1 with the Torn Exit Ticket relic. `dvNextAt()` inverts the formula for the "next point" hint.
- **Reset logic (`noclip()`).**
  1. Adds the gain to `dv` and `dvTotal`.
  2. Increments `life.noclips`, and `life.exits` if the exit was found.
  3. Increments `iteration` and applies the chosen next condition if it is available yet.
  4. Replaces `run` with `defaultRun()` and clears the active anomaly.
  5. Applies Old Friends (radio and 3 wanderers) and Habitual Hoarding (10 carts, 5 benches, 2 beacons).
  6. Clears the log, shows the iteration banner and saves.
- **Kept:** `dv`, `dvTotal`, Memories, Echoes, research and Deep Survey Theory ranks, relics, achievements, archive documents, `seen` flags, lifetime statistics and settings.
- **Lost:** everything in `run`, which is salvage, water, facilities, upgrades, crew, expeditions, level progress, attention, sanity, the doctrine, flags and run statistics.
- **Permanent effects.** Each point of `dvTotal` adds +1% (`CONFIG.prestige.dvBonus`) to facility, crew and survey salvage and to water. Spending Déjà Vu does not reduce this.
- **Memories (11).**
  - Muscle Memory: survey salvage ×3, rooms ×1.5.
  - Old Friends: start with the radio and 3 wanderers.
  - Habitual Hoarding: start with machines.
  - Thirst: water ×2.
  - Lucid: sanity drains slower, blackouts are shorter.
  - The Way Down: exits need −30% rooms.
  - It Remembers You: noise ×0.8.
  - Long Sleep: offline cap +16 h.
  - Second Shift: expeditions take −30% time.
  - Procurement Notes: unlocks facility auto-buy.
  - Recurrence: repeatable, ×1.25 production per rank, costs 8 × 2^rank.
- **Conditions (4):** Standard Drift, Wet Season and Loud Season (from iteration 2), Long Halls (from iteration 3).
- **Saved as:** `iteration`, `condition`, `nextCondition`, `dv`, `dvTotal`, `memories`, `life.noclips`, `life.exits`.
- **Measured:** the first exit gave 224–259 Déjà Vu. A second iteration took about 24 minutes for an active player. Déjà Vu grew sublinearly across iterations (224 → 575 → 1,087).

Points where the experiments touch Noclip, all of which must keep working:

- Muscle Memory multiplies survey salvage, so it must appear in any survey-power breakdown.
- Old Friends gives 3 wanderers, who must remain valid crew under any crew rework.
- Habitual Hoarding and Procurement Notes depend on facilities.
- `dvTotal` and Recurrence multiply production.
- `buyMemory()` is a purchase path that spends Déjà Vu.

### Save format

- Save version 1, stored under `the-hum.save`, with a rotating copy under `the-hum.save.backup`.
- `sanitizeState()` rebuilds a fresh state and copies validated, known fields. Unknown ids and unknown fields are dropped.
- Offline progress is capped at 8 hours, plus 8 with Night Shift Rota and 16 with Long Sleep.

### Measured pacing (balance bot, baseline build)

| Profile | Level 1 | Level 3 | Level 5 | Exit |
| --- | --- | --- | --- | --- |
| Active, 3 surveys/s | 3.7 min | 22.7 min | 54 min | 79 min |
| Casual, 1 survey/s | 8.6 min | 33.7 min | 68 min | 95 min |
