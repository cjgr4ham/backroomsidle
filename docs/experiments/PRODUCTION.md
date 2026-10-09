# How salvage is produced

This is the production formula with the game's default experiments on. It shows which system affects which output and where each figure is counted, so nothing is counted twice. Everything is computed in one place, `derive()` in `index.html`. The simulation, offline catch-up and every number on screen use it.

## Responsibilities

| System | What it is | What it produces | Unit |
| --- | --- | --- | --- |
| **Facilities** | Equipment you buy with salvage. Needs no crew (`EXP-FACILITY-INDEPENDENCE`). | Salvage machines: salvage | salvage per second |
| | | Survey Beacon: automatic surveys | surveys per second; each automatic survey recovers 25% of a survey's base salvage |
| | | Condenser: almond water. Resonance Array: Echoes. Acoustic Dampener: absorbs noise | water/s, Echoes/s, noise absorbed |
| **Crew** | Wanderers you take in for almond water and give jobs | Scavengers: salvage by hand, plus a bonus on facility salvage. Cartographers: automatic surveys. Dowsers: water. Watchers: absorb noise. Archivists: Echoes | per second |
| **Manual survey** | The Survey button. Click power (`EXP-CLICK-POWER`) | salvage, rooms, and chances of water and Echoes | per survey you make by hand |
| **Déjà Vu** | Earned by noclipping and kept forever. Spent in the Déjà Vu shop. | permanent multipliers and starting bonuses | — |

## Salvage per second (passive)

```
salvage/s = (facility salvage + crew salvage + automatic-survey salvage) × lights   (lights out: 0)

facility salvage     = Σ over salvage machines:  output × tier multiplier × number owned × facility multiplier
facility multiplier  = (1 + 0.25 × level reached this iteration) × achievements (1 + 1% each)
                       × Déjà Vu bonus (1 + 1% per point ever earned) × Recurrence (×1.25 per rank)
                       × Inventory Ledger 1.25 × Shift Bell 1.5 × Unpaid Overtime 2
                       × doctrine (Industrial 1.6, Quiet 0.9) × keys relic 1.05 × condition
                       × (1 + 0.15 × Deep Survey Theory ranks)
                       × scavenger bonus (1 + 0.05 × scavengers × crew efficiency)
crew salvage         = scavengers × 0.4 × crew efficiency × Déjà Vu bonus × achievements × Recurrence
automatic surveys/s  = Σ beacons (0.08 × tier multiplier each) + cartographers × 0.15 × crew efficiency
automatic-survey salvage = automatic surveys/s × survey base reward × 25%
survey base reward   = 1 × level survey multiplier × Déjà Vu bonus × achievements × Recurrence
                       × survey upgrades (Flashlight 2, Rubber Boots 3, Backwards Pedometer 4)
                       × Wallpaper Pattern Analysis 2 × Muscle Memory 3 × VHS relic 1.1 × Wet Doctrine 0.5
```

- "Scavengers" includes idle wanderers at half weight once Phantom Labour is researched.
- Offline machines (after an incident) produce nothing until they are repaired.

## Salvage per survey you make by hand

```
per survey = (survey power base × survey multipliers + survey share of salvage/s) × Survey Drills × sanity × lights
survey power base = 1 + hand tools (Work Gloves 1, Pry Bar 2, Bolt Cutters 5, Hydraulic Spreader 25)
                    + Canvas Satchel (0.05 per facility owned)
survey multipliers = the survey base reward's multipliers above, without the base of 1
survey share       = Field Notebook 3% + Clipboard 5% + Carbon Copies 7% of passive salvage per second
Survey Drills      = 1 + 10% per rank
sanity             = 1 (Steady), 0.85 (Frayed), 0.65 (Unravelling);  lights out: × 0.5
```

## Where each figure is counted, once

- **Facility salvage** is counted once, as facility salvage.
  - The scavengers' bonus multiplies it inside the facility multiplier. It is not added again to crew salvage.
  - With staffing switched off, a machine's output never depends on crew. The bonus is extra on top of full output.
- **Crew salvage** is the scavengers' own hand work only.
- **Automatic surveys**, from beacons or cartographers, pay 25% of the survey *base* reward. Hand tools, the Canvas Satchel, Survey Drills and the survey share apply only to surveys you make by hand. Click power never feeds passive income.
- **The survey share** gives each survey you make by hand a percentage of passive salvage per second. Surveys you make by hand are never added back into passive salvage.
- **Déjà Vu shop.**
  - Permanent multipliers are applied in the places shown above, each once: Déjà Vu bonus, Recurrence, Muscle Memory and Thirst.
  - Starting bonuses are applied once, when a new iteration begins: starting salvage, starting crew, and Habitual Hoarding's machines. Starting salvage is added to the balance but not to "salvage recovered this iteration", so it never earns Déjà Vu.
  - The facility price discount lowers prices only. It never changes output.
- **Expeditions** pay lump sums at the end. These are counted when they arrive, and are not part of the per-second rate.

## Almond water, Echoes and noise

- Water per second = condensers (0.05 each × tier × water multiplier) + dowsers (0.05 × crew efficiency × water multiplier).
  - Water multiplier = Déjà Vu bonus × Recurrence × Condensation Dynamics 2 × Thirst 2 × Wet Doctrine 3 × bottle relic 1.1 × condition.
- Echoes per second = arrays (0.004 each × tier) + archivists (0.005 × crew efficiency), × Echo multiplier × attention factor.
- Attention heads toward `100 × noise ÷ (noise + absorption)`.
  - Every facility makes its own noise, whether or not anyone is assigned.
  - Dampeners and watchers absorb.
  - `EXP-ATTENTION-BALANCE` adds footstep noise from surveys you make by hand.
