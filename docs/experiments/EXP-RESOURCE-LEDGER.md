# EXP-RESOURCE-LEDGER: resource ledger

> **In v2:** The entries follow the v2 economy. Salvage shows survey power, one survey now, the facility multiplier and passive salvage from the Scavenger. A Specialists entry replaces Wanderers. Rooms show the Cartographer and Level FUN's floors, and Déjà Vu says when noclip opens. See [V2-REDESIGN.md](V2-REDESIGN.md).

| Field | Value |
| --- | --- |
| Identifier | `EXP-RESOURCE-LEDGER` |
| Name | Resource ledger |
| Purpose | Explains what the numbers mean. For every resource and meter it shows: what you hold, what comes in per second and from where, what one survey by hand brings, what it is spent on, and the next threshold. Selecting a resource in the header opens its entry. |
| Depends on | `EXP-CORE`, for the `archive:subtabs`, `archive:build`, `archive:update`, `ui:init` and `ui:update` hooks. Two notes use optional fields that other experiments provide: machines running (EXP-CREW-AUTOMATION) and footstep noise (EXP-ATTENTION-BALANCE). Without them the ledger still works. |
| Flag | `EXP-RESOURCE-LEDGER`, on by default. |

## What it changes (presentation only)

- **Archive → Resources** is a new section between Achievements and Statistics. It doesn't add a tab.
- **The header resources** (Salvage, Almond water, Echoes, Wanderers, Déjà Vu) become buttons that open their entry. They can be reached with Tab and opened with Enter. Each entry scrolls into view and takes focus.
- **Each figure is read from the same calculations the game uses** (`derive()` and the game's own functions). No production figure is written into a label. The tests check that the ledger and the header show the same figures.
- **Each figure is labelled by kind:** held, per second, from machines, from crew, from automatic surveys, per survey by hand, found by surveys, spent on, and thresholds.

## Inventory of resources and statistics

| Statistic | Calculated from | What it is for | Changed by | Shown in |
| --- | --- | --- | --- | --- |
| Salvage held | `run.salvage` | buying facilities and requisitions | everything below | header, ledger |
| Salvage per second | `D.sps` = machines + crew hand work + automatic surveys | passive income | facility tiers, shift upgrades, scavengers, doctrines, Deep Survey Theory, Déjà Vu, achievements, Recurrence, conditions | header, Facilities rows, Statistics, ledger |
| Survey power | `D.manualSalvage` | active income | Survey upgrades (and hand tools, under EXP-CLICK-POWER), Wallpaper Pattern Analysis, Muscle Memory, Wet Doctrine, VHS relic | Survey button, ledger, Statistics; the breakdown under EXP-CLICK-POWER |
| Rooms per survey | `D.roomsPerSurvey` | map progress by hand | Measuring Wheel, Chalk Marks, Compass, Cartographic Recursion, Muscle Memory, needle relic, Long Halls | Survey button, ledger |
| Automatic surveys and rooms per second | `D.autoSurveys`, `D.roomsPerSec` | idle map progress | beacons, cartographers, beacon tiers | Facilities (beacon row), Crew (cartographers), objective, ledger |
| Level progress | `run.levelRooms` ÷ `exitRooms(level)` | unlocks the next level | The Way Down, Long Halls | level track, ledger |
| Almond water held and per second | `run.aw`, `D.aws` | drinks, hiring, expeditions, some requisitions | Condensation Dynamics, Thirst, Wet Doctrine, bottle relic, condenser tiers, dowsers | header, Facilities, Crew, ledger |
| Water finds | 7% of surveys by hand, 1–3 × (level + 1) water each | early water | Echo Sounder (EXP-CLICK-POWER), Wet Season | ledger, field manual |
| Echoes held and per second | `S.echoes`, `D.eps` | research | arrays, archivists, Deep Listening, Controlled Exposure, photo relic, Loud Season | header, ledger |
| Echo finds | 0.6% of surveys by hand after 25 rooms, × the sanity band | early Echoes | sanity, Echo Sounder | ledger, field manual |
| Attention bonus to Echoes | `D.attnEcho` | rewards some risk | Controlled Exposure | attention meter, ledger, Statistics |
| Wanderers | `run.crew` | jobs and expeditions | radio, water | header, Crew, ledger |
| Crew efficiency | `D.crewEff` | job output (and machines each, under EXP-CREW-AUTOMATION) | Bunk Room, Canteens, Shared Lanterns, Wet Doctrine, shoe relic | Crew, ledger |
| Hire cost | `hireCost()` | the next wanderer | Shared Water Protocol, Canteens | Crew, ledger |
| Sanity and its rate | `run.sanity`, `D.sanityNet`, `D.sanityRegen`, `D.sanityDrain` | survey penalties, blackouts | Break Room, Foam Earplugs, Folding Cot, Auto-Drink Valve, Lucid, tube relic, the Poolrooms | sanity meter, ledger |
| Attention, noise and absorption | `run.attention`, `D.attnTarget`, `D.noise`, `D.absorb` | incidents, anomalies, Echo bonus | dampeners, watchers, Foam Glue, Night Watch Rota, Hum Frequency Study, Quiet and Industrial Doctrines, Unpaid Overtime, It Remembers You, badge and tile relics, Loud Season | attention meter, ledger |
| Déjà Vu | `S.dv`, `S.dvTotal`, `dvPreview()` | Memories, and +1% production per point | how much salvage the run recovers, exit, conditions | header, Noclip tab, ledger |
| Facility multiplier, Déjà Vu bonus, achievement bonus, offline cap | `D.facMult`, `D.dvMult`, `D.achMult`, `offlineCapSeconds()` | context | as above | Statistics, ledger (facility multiplier) |
| Expedition crew, water and rewards | `EXPEDITIONS`, `run.expeditions` | lump-sum rewards and relics | Hand-Drawn Maps, Frame Packs, Guide Rope, Second Shift, Expedition Cartography | Expeditions tab |
| Research | `S.research`, Echo costs | permanent upgrades | Echoes | Research tab |
| Facility outages | `run.disabled` | incident damage | Fire Doors | facility rows ("Offline" chip) |

The game has no separate stability or instability value. Incident outages and blackouts serve that role and are listed above.

## Files and functions affected

- **`index.html`:**
  - The `EXP-RESOURCE-LEDGER` script slot holds `resourceLedgerExperiment`. Its hooks are `archive:subtabs`, `archive:build`, `archive:update`, `ui:init`, `ui:update` and `manual`.
  - The stylesheet slot holds the `.rl-book`, `.rl-entry` and `.res-link` styles.
  - The `ui:init` hook adds click and key listeners to the header readouts. They act only while the flag is on. The `ui:update` hook adds `role="button"` and `tabindex` while the flag is on and removes them when it is off.
- **`tools/tests/ledger.test.js`:** the experiment's tests.
- **`docs/experiments/EXP-RESOURCE-LEDGER.md`:** this entry.

## Save-schema effects

None.

## Turning it off

Any one of the following works:

- Use the developer menu's experiment list.
- Add `?exp=-EXP-RESOURCE-LEDGER` to the address.
- Run `HUM.Exp.set('EXP-RESOURCE-LEDGER', false)` in the console.

The Resources section then disappears, and the header readouts become plain again.

## Reverting its code

`git revert <EXP-RESOURCE-LEDGER commit>`. It touches only the two slots, the test file and this entry.

## Restoring the original behaviour

Turning the flag off or reverting the code is enough. No data is involved.

## Tests after turning it off or reverting

- Run `node tools/run-tests.js` for the full suite.
- Run the three-experiment equivalence check described in EXP-UPGRADE-CATEGORIES.
- `node tools/tests/ledger.test.js` runs 12 checks:
  - The header readouts are buttons.
  - Selecting almond water opens its entry.
  - Every resource and meter in play is covered.
  - Per-second salvage and water, and salvage held, match the header. Per-survey salvage matches the Survey button. Level progress reads 300 / 800.
  - After a purchase and an assignment, the ledger updates at once.
  - The noise row names its sources, including footsteps when EXP-ATTENTION-BALANCE is on.
  - Enter on a focused readout opens its entry.
  - Switched off, the readouts are plain and the section is gone.
  - No errors.

## Limitations

- **Some explanations are written text.** They describe the game's rules, for example "Each one costs 25% more than the last" (read from `CONFIG`). If a rule changes, the text must be updated with it. The numbers themselves are always computed.
- **No spending rate.** Spending is not tracked over time, so the ledger lists what each resource is spent on but cannot give a spending rate.
