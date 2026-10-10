# How salvage is produced (v2)

Every rate is computed in one place: `derive()` in `index.html`, through `deriveMultipliers`, `deriveFacilities`, `deriveSurvey` and `deriveSpecialists`. The simulation, offline catch-up and every number on screen use it.

Two outputs are kept apart:
- **survey power**, what one survey by hand recovers;
- **passive salvage**, the Scavenger's work.

Neither depends on the other, so there is no loop between click power and idle income. For the version-1 formula, see this file's history; the v2 change is recorded in [V2-REDESIGN.md](V2-REDESIGN.md).

## Responsibilities

| System | What it does | Unit |
| --- | --- | --- |
| **Survey by hand** (button or `S`) | Recovers survey power × your condition. Maps rooms. Sometimes finds almond water or an Echo. | per survey |
| **Salvage facilities** | Each unit adds its bonus to the facility multiplier on survey power. They produce nothing. | multiplier points |
| **Support facilities** | Beacons add rooms per survey. Condensers add almond water and arrays add Echoes, from every source. Dampeners absorb noise. | shares, noise |
| **Specialists** | The Scavenger recovers passive salvage. The Cartographer makes automatic surveys (rooms only). The Dowser finds water, the Watcher absorbs noise and warns of entities, and the Archivist records Echoes. | per second |
| **Missions** | Lump sums when a team returns | per mission |
| **Déjà Vu** | Permanent multipliers and starting bonuses | — |

## Survey power

```
survey power     = base × facility multiplier × survey upgrades × level depth × global bonuses × Survey Drills
one survey       = survey power × condition
condition        = sanity band (Steady 1, Frayed 0.85, Unravelling 0.65) × lights out 0.5

base             = 1 + hand tools (Work Gloves 1, Pry Bar 1, Bolt Cutters 2, Hydraulic Spreader 4)
                   + Canvas Satchel 0.01 per facility owned
facility mult.   = 1 + Σ over salvage facilities: owned × bonus × tier multiplier × facility boosts
                   (offline facilities count 0 until repaired)
tier multiplier  = 2 per installed tier (×1.5 for support facilities)
facility boosts  = Inventory Ledger 1.25 × Unpaid Overtime 2 × doctrine (Industrial 1.6, Quiet 0.9)
                   × keys relic 1.05 × condition × (1 + 0.15 × Deep Survey Theory ranks)
survey upgrades  = Flashlight 1.5 × Field Notebook 1.25 × Rubber Boots 1.25 × Clipboard 1.25
                   × Backwards Pedometer 1.5 × Carbon Copies 1.5 × Wallpaper Pattern Analysis 1.5
                   × Muscle Memory 2 × VHS relic 1.1 × Wet Doctrine 0.5
level depth      = 1, 2, 3.5, 6, 10, 16 on Levels 0–5; Level FUN 25 × (1 + 0.1 per floor)
global bonuses   = Déjà Vu (1 + 1% per point ever earned) × achievements (1 + 1% each) × Recurrence (1.25 per rank)
Survey Drills    = 1 + 10% per rank
```

Facility bonuses per unit:
- **Level 0:** Salvage Cart 0.25, Wire-Stripping Bench 0.6.
- **Level 1:** Carpet Rendering Vat 1.
- **Level 2:** Ceiling Tile Foundry 5.
- **Level 3:** Duct Boiler 20.
- **Level 4:** Night Switchboard 60.
- **Level 5:** Fold Engine 200.

Every facility's price grows ×1.2 per unit, except Survey Beacons (×1.6) and Resonance Arrays (×1.25). A tier costs 6, 10 or 15 times the price of the unit at its count (10, 25, 50).

## Passive salvage: the Scavenger only

```
specialist rate  = rate × level × step^(level − 1)        Scavenger: 25 × L × 1.5^(L − 1)
work rate        = Bunk Room 1.25 × Canteens 1.25 × Shift Bell 1.5 × Shared Lanterns 1.5
                   × Phantom Labour 1.5 × Wet Doctrine 1.5 × shoe relic 1.05
passive salvage/s = Scavenger rate × work rate × level depth × global bonuses × lights (0 while out)
```

None of the following feed passive salvage:
- survey power;
- facilities, hand tools or survey upgrades;
- Survey Drills.

A taken specialist produces nothing until they come back.

## Rooms

```
rooms per survey = (Measuring Wheel 2 × Chalk Marks 2 × Compass 1.5 × Cartographic Recursion 2
                    × Muscle Memory 1.5 × needle relic 1.1 × condition) × (1 + Σ beacons × 0.03 × tier)
automatic surveys/s = Cartographer 0.12 × L × work rate × lights
rooms/s          = automatic surveys/s × rooms per survey
```

Automatic surveys map rooms and recover no salvage.

## Almond water and Echoes

```
water/s   = Dowser 0.15 × L × 1.05^(L − 1) × work rate × water multiplier × lights
water mult. = Déjà Vu × Recurrence × Condensation Dynamics 2 × Thirst 2 × Wet Doctrine 3
              × bottle relic 1.1 × condition × (1 + Σ condensers 0.1 × tier)
Echoes/s  = Archivist 0.015 × L × 1.05^(L − 1) × work rate × Echo multiplier × attention factor
            × Deep Listening 2 × lights
Echo mult. = Recurrence × condition × photo relic 1.1 × (1 + Σ arrays 0.05 × tier × Deep Listening 2)
```

## Lump sums

- **Missions:**

  ```
  max(floor × level depth × global, Scavenger's salvage/s × base length × 4%) × Frame Packs 2 × Expedition Cartography 1.5
  ```

  The haul is fixed when the team leaves and halved if something follows them back.
- **Anomalies** you document pay Echoes. Some pay a number of your surveys' worth of salvage: door 20, phone 45. Documenting is an action you take, not passive income.
- **Entities:** being caught costs `min(held × (10% + 10% × attention ÷ 100), survey power × 120)`.

## Where each figure is counted, once

- **A facility** adds to the facility multiplier once. Nothing else reads its count, except the Canvas Satchel, which counts every facility as +0.01 base.
- **The Scavenger's salvage** is counted once, as passive salvage. Missions take a share of it as their haul when they return; they do not add to the per-second rate.
- **Survey power** never appears in a per-second figure. The per-second figures never appear in survey power.
- **Global bonuses and level depth** multiply survey power and the Scavenger, each once.
- **Déjà Vu shop:**
  - Permanent multipliers apply once, where shown above.
  - Starting bonuses apply once, when an iteration begins. Starting salvage goes to the balance, not to "salvage recovered", so it earns no Déjà Vu.
  - The facility discount changes prices only.
- **Time away** (`catchUp`) runs the same `step()` in coarse steps, up to the offline cap. Only the specialists, missions and research advance; there are no incidents, anomalies or entities. A research project finishing during it splits the step at its end, so its benefit starts exactly then.
