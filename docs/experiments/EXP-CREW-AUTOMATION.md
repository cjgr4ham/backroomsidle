# EXP-CREW-AUTOMATION: crew-run operation

| Field | Value |
| --- | --- |
| Identifier | `EXP-CREW-AUTOMATION` |
| Name | Crew-run operation |
| Purpose | Makes the crew the home of idle production. Crew members run the machines, and the Crew tab is where passive work is managed and upgraded. Facilities stay as the equipment the crew operate. |
| Depends on | `EXP-CORE` for its hook points, including the crew panel hooks added in `bda08bd`, and for its save namespaces. It does not depend on any other experiment. |
| Flag | `EXP-CREW-AUTOMATION`, on by default. |

## The problem it addresses

In the original game, facilities and crew ran two parallel tracks for the same outputs:

- Beacons and cartographers both made automatic surveys.
- Condensers and dowsers both made almond water.
- Arrays and archivists both made Echoes.

The crew's largest effect, the scavenger bonus of +5% facility salvage each, was folded into the facility numbers. In a typical run, "salvage from crew" read 0–1% of income. Meanwhile, every upgrade that grew passive income sat in the Upgrades tab.

## Audit of production sources (original game)

| Source | Resource | When it runs | Kind | Side effects | Set up in | Overlap with crew |
| --- | --- | --- | --- | --- | --- | --- |
| Salvage Cart, Wire-Stripping Bench, Carpet Rendering Vat, Ceiling Tile Foundry, Duct Boiler, Night Switchboard, Fold Engine | salvage | always, except during lights out or an incident outage | produces | noise per machine | Facilities | scavengers boost them |
| Humidity Condenser | almond water | as above | produces | noise | Facilities | dowsers make water too |
| Survey Beacon | automatic surveys (rooms, salvage) | as above | produces | noise | Facilities | cartographers survey too |
| Resonance Array | Echoes | as above | produces | noise | Facilities | archivists make Echoes too |
| Acoustic Dampener | noise absorption | always | modifies Attention | none | Facilities | watchers absorb too |
| Scavenger | salvage, plus a +5% facility salvage bonus each | while assigned | produces and modifies | none | Crew | |
| Cartographer, Dowser, Archivist | surveys, water, Echoes | while assigned | produces | none | Crew | |
| Watcher | noise absorption | while assigned | modifies Attention | none | Crew | |
| Automatic surveying | rooms and 25% of a survey's base salvage | always | produces and unlocks levels | none | beacons and cartographers | |
| Inventory Ledger, Shift Bell, Unpaid Overtime | facility salvage ×1.25, ×1.5, ×2 | once bought | modifies | Overtime adds noise ×1.2 | Upgrades | |
| Bunk Room, Canteens, Shared Lanterns | crew efficiency ×1.25, ×1.25, ×1.5 | once bought | modifies | Canteens also cut hire cost | Upgrades | |
| Facility tiers (30) | ×2 to one facility type (beacons ×1.5) | once bought | modifies | none | Upgrades | |
| Research: Industrial, Quiet and Wet Doctrine, Deep Survey Theory, Condensation Dynamics, Deep Listening, Phantom Labour | cross-system multipliers | once researched | modifies | doctrines change noise | Research | Phantom Labour turns idle crew into scavengers |
| Déjà Vu, Recurrence, Thirst, relics, achievements | global multipliers | permanent | modifies | none | Noclip, Expeditions, Archive | |
| Expeditions | lump sums of salvage, water and Echoes, plus relics | timed | produces | crew away | Expeditions | uses idle crew |
| Offline progress | everything above, at the same rates | while away | | no incidents | | |
| Lights out, incidents, anomalies | production stops, a facility type goes offline, Echoes | events | modifies | | | |

> **Status after the final specification update.** Facilities must never need crew. `EXP-FACILITY-INDEPENDENCE`, which is on by default, switches this experiment's staffing rule off through the `crew:staffing` hook described below.
>
> With both experiments on, which is the default:
> - every machine runs at full output, with or without crew;
> - the staffing requisitions are not offered;
> - the crew work their own jobs, as in the original game;
> - the Crew tab keeps the crew requisitions and shows what the crew produce.
>
> The staffing rule described below applies only when `EXP-FACILITY-INDEPENDENCE` is off or reverted.

## What it changes

### Ownership

- **Manual surveys** stay with the player. Click power is a separate experiment.
- **Crew** run the machines and do their own hand work.
  - Scavengers run salvage machines.
  - Dowsers run condensers.
  - Cartographers run beacons.
  - Archivists run arrays.
  - Watchers are unchanged.
- **Facilities** are the equipment.
  - Dampeners are passive foam and need nobody.
- **Research**, **Expeditions** and **Noclip** are unchanged.

### The staffing rule

- **A machine with a crew member on it runs at full speed.** A machine nobody runs works at 25%.
- **How many machines each crew member runs.**
  - The base is 4, multiplied by crew efficiency and by the staffing requisitions.
  - Duty Roster gives ×1.5, Work Gangs ×1.5 and Night Crew ×2.
  - Crew efficiency comes from Bunk Room, Canteens, Shared Lanterns, the Wet Doctrine and the shoe relic. It already raised crew output, and now it also raises this number.
  - The count is rounded down.
- **Who runs what.**
  - Crew take the most productive machines first, so buying a cheap machine never lowers output.
  - You run 10 machines yourself, salvage machines first.
- **Phantom Labour** counts each idle wanderer as half a scavenger, as before.
- **Unchanged rules.**
  - The scavenger bonus (+5% machine salvage each, × crew efficiency) still applies.
  - The crew's own hand work still applies.
  - Noise is unchanged: every machine makes its usual noise whether anyone runs it or not. This keeps Attention separate from this experiment.
- **Machines that are offline** after an incident take no crew, so their crew go to working machines.

### Where the upgrades are

- **Moved to the Crew tab, with effects unchanged:**
  - Shortwave Radio, Bunk Room, Foreman's Whistle, Canteens, Shared Lanterns and Night Watch Rota.
  - The shift upgrades: Inventory Ledger, Shift Bell and Unpaid Overtime.
  - None of them is duplicated.
- **New staffing requisitions, in the Crew tab:**
  - Duty Roster: 3,000 salvage, at 5 wanderers.
  - Work Gangs: 400,000 salvage, at Level 2 with 12 wanderers.
  - Night Crew: 20M salvage, at Level 4.
- **Kept in the Upgrades tab:** facility tiers, which improve one facility type. Everything else not listed above stays there too.

### Interface

- **Crew tab, Operation section.** It shows:
  - how many machines your crew run;
  - how many machines each crew member can run;
  - the share of passive salvage that crew work makes;
  - one bar per production line, with idle machines highlighted;
  - the machines you run yourself and the ones the previous shift runs.
- **Job rows.** Each one shows the machines that job runs. It also says how many more crew would run them all.
- **Crew requisitions.** They are listed at the bottom of the Crew tab. A tab dot appears when one is affordable. While the radio is unbought, the locked tab offers it.
- **Facility rows.** They show "N/M running" and a warning line when machines are idle. The subtitle explains the rule.
- **Other text.** The objective now names the Crew tab for the radio, and the field manual gains a "Crew run the machines" section.

### The staffing switch (`crew:staffing`)

This was added in its own commit, after the original one, for the final specification update.

- The module asks `Exp.ask('crew:staffing')`. If an enabled experiment answers `false`, which `EXP-FACILITY-INDEPENDENCE` does, the following applies.
- **Production and the save.**
  - The staffing calculation is skipped, so every machine produces its full output, exactly as in the original game.
  - A save is not converted. Conversion happens later if staffing is switched back on.
  - The previous-shift allowance of a save that was already converted stays stored and unused.
- **Requisitions.**
  - The three staffing requisitions are not offered (`upgradeHome` is `none`). Owned ones stay owned.
  - The crew requisitions stay in the Crew tab, with their effects unchanged.
- **Crew tab.**
  - The Operation section is replaced by **Crew output**. It shows the salvage the crew add: scavengers' own work, their bonus on facility salvage, and cartographers' automatic surveys, each counted once. It also shows their share of passive salvage, and the water, absorption and Echoes they make.
  - Job rows show their usual "Now:" lines.
- **Facilities tab and field manual.**
  - Facility rows carry no staffing notes.
  - The Facilities subtitle is left to other experiments or the original text.
  - The field manual describes the crew requisitions instead of the staffing rule.
- With no experiment answering, which includes `EXP-FACILITY-INDEPENDENCE` being off or reverted, the experiment behaves exactly as before the switch was added.

### "Crew work makes X% of your salvage"

- The operation as it is is compared with the same machines and no crew at all.
- "No crew" means:
  - no scavenger bonus;
  - no hand work;
  - every machine that you and the previous shift don't run working at 25%.
- Surveys you make by hand are not counted.

## Files and functions affected

- **`index.html`:**
  - The `EXP-CREW-AUTOMATION` script slot holds the `crewOperationsExperiment` module. The matching stylesheet slot holds the `.ops*` styles. Nothing outside the two slots is edited.
  - The module adds three upgrades to `UPGRADES` and `UPG`, tagged with the experiment: `roster`, `gangs` and `nightcrew`.
  - Hooks:
    - Simulation: `derive:production`, `afterLoad`, `flagsChanged`, `upgradeHome`.
    - Navigation: `tabDot`, `objective`.
    - Facilities tab: `facilities:sub`, `facilities:line`, `facilities:row`, `facilities:rowUpdate`.
    - Crew tab: `crew:sig`, `crew:top`, `crew:lockedText`, `crew:jobRow`, `crew:jobLine`, `crew:jobUpdate`, `crew:afterRows`, `crew:update`.
    - Field manual: `manual`.
  - It owns the save namespaces `ext.crew` and `run.ext.crew`.
- **`tools/tests/crew.test.js`:** the experiment's tests.
- **The staffing switch:** the `staffing()` gate inside the same slot. It covers `convertSave()`, `derive:production`, `upgradeHome`, `facilities:sub`, `crew:lockedText`, `crew:top`, `crew:jobRow`, `crew:update`, `manual`, and `outputText()` for the Crew output summary.
- **`docs/experiments/EXP-CREW-AUTOMATION.md`:** this entry.

## Save-schema effects and conversion of existing saves

These changes are additive, and the save version stays 1.

- **`ext.crew = { since }`** marks a save as converted. It is set the first time the experiment runs with a save, whether new or old, so conversion happens once per save.
- **`run.ext.crew.legacy = { <facility id>: count }`** is the "previous shift" allowance. When an existing save is converted:
  - machines its current crew cannot run are listed, and they stay staffed until the next noclip;
  - production at the moment of conversion is exactly what it was, and a test checks this;
  - crew, jobs, machines and resources are not touched;
  - nothing is awarded;
  - a terminal message reports how many machines the previous shift runs.
- **New machines bought after conversion** need crew.
- **A noclip** ends the allowance with the rest of the run.
- **Reloading** a converted save never converts it again.
- **Turning the flag on mid-run**, for a save that has never had the experiment, converts it the same way.
- **The three new requisitions** are stored in `run.upgrades`, like any upgrade.
- **Flag turned off:** the namespaces stay in the save and do nothing. Turning the flag back on uses them again, without a second conversion.
- **Code reverted while EXP-CORE remains:** both namespaces are kept as opaque data, and the three requisition ids move to `run.dormant.upgrades`.
- **Save loaded in the original build:** it loads normally. The unknown fields and ids are dropped.

## Turning it off

Any one of the following works:

- Use the developer menu's experiment list.
- Add `?exp=-EXP-CREW-AUTOMATION` to the address for one page load.
- With `#debug` in the address, run `HUM.Exp.set('EXP-CREW-AUTOMATION', false)` in the console.

Once it is off:

- Every machine produces in full again, as originally.
- The moved upgrades return to the Upgrades tab.
- The three staffing requisitions disappear. Owned ones stay stored and inert.
- The Crew and Facilities tabs render as originally.

The experiment has no settings of its own, so there are no previous settings to restore.

## Reverting its code

1. Run `git revert` on this experiment's commits, newest first: first the staffing switch, then the original commit. The commits touch only the two slots, the test file and this entry. The registry index lists them, and `tools/revert-check.js` finds them by their `EXP-CREW-AUTOMATION:` subject.
   - With the code reverted, nothing is left to staff machines, so facilities still never need crew.
   - `EXP-FACILITY-INDEPENDENCE` then has nothing to switch off, and it does nothing harmful.
2. The crew panel hook points can stay; they do nothing without an experiment. To remove them as well, revert `bda08bd` too.
3. Other experiments do not use this one's code or data.

## Restoring the original behaviour

- Turning the flag off restores the original production model and upgrade placement exactly. The equivalence check covers this, with every experiment off.
- Reverting the code does the same, permanently.
- Neither one rewrites the save. Machines, crew and jobs are never changed by this experiment, so nothing needs restoring.
- Restoring an older save snapshot is a separate step, and the game never does it automatically.

## Tests after turning it off or reverting

- `node tools/run-tests.js` runs the full suite, and `node tools/equivalence-check.js` checks the build with every experiment off against the baseline.
- `node tools/tests/crew.test.js` runs 43 checks. The suite turns `EXP-FACILITY-INDEPENDENCE` off, so the staffing rule is tested as designed. A probe experiment then switches staffing off to test the switch.

| Area | What the tests check |
| --- | --- |
| Staffing | The exact rule: your own 10 machines, 4 per crew member, most productive first, 25% for machines nobody runs. Each line is run by its job, and dampeners need nobody. |
| Production | Assignments change production at once. Water and salvage are each counted once. Crew efficiency and the Duty Roster raise capacity. Phantom Labour applies once. |
| Unchanged systems | Noise, absorption and attention are unchanged. Offline catch-up pays exactly the staffed rates. |
| Conversion of old saves | Production is preserved exactly. Crew, jobs, machines and resources are untouched. The conversion is reported once and is never repeated on reload. New machines need crew. |
| Noclip | It gives the same Déjà Vu with the experiment on or off. It ends the previous shift. Old Friends and Habitual Hoarding work as before. |
| Upgrade placement | The Upgrades tab no longer lists the radio, and the objective names the Crew tab. The locked Crew tab sells the radio, and buying it charges 90 salvage and opens the roster. |
| Interface | The operation summary, the job hints, the requisition list, the tab dot, and the facility rows with their subtitle. |
| Flag off and on | Turning the flag off restores full output, the upgrade placement and both tabs' layout. Turning it back on does not convert the save again. |
| Staffing switch | Every machine runs at full output, and the staffing requisitions are hidden while crew requisitions stay. The Crew output summary replaces the machine lines, and the Facilities tab drops its staffing text. A save is not converted until staffing returns. |

## Balance measurements

These figures come from the deterministic pacing bot: 7 seeds, medians, two iterations, all other experiments off.

- **"Managed"** means the bot reads the Crew tab and moves scavengers onto any line with machines nobody runs.
- **"Neglected"** means the bot keeps the original crew habits: 1 cartographer, 2 dowsers, no archivists, and everyone else scavenging.
- The original build is `?exp=none`, which matched `ebfa0c6` exactly.

| Profile | Build | Level 1 | Level 3 | Level 5 | Exit |
| --- | --- | --- | --- | --- | --- |
| Active, 3 surveys/s, iteration 1 | original | 3.4 min | 22.2 min | 54.6 min | 80.2 min |
| | managed crew | 3.4 min | 22.5 min | 54.1 min | 80.4 min |
| | neglected crew | 3.4 min | 22.5 min | 60.2 min | 90.0 min |
| Active, iteration 2 | original | 0.5 min | 4.0 min | 15.1 min | 24.5 min |
| | managed crew | 0.5 min | 4.0 min | 14.6 min | 23.6 min |
| | neglected crew | 0.5 min | 4.4 min | 18.7 min | 30.2 min |
| Casual, 1 survey/s, iteration 1 | original | 8.4 min | 32.0 min | 67.0 min | 95.4 min |
| | managed crew | 8.4 min | 31.0 min | 65.5 min | 94.5 min |
| | neglected crew | 8.4 min | 33.3 min | 76.3 min | 110.4 min |
| Casual, iteration 2 | original | 1.2 min | 5.3 min | 17.1 min | 27.2 min |
| | managed crew | 1.3 min | 5.3 min | 16.8 min | 26.8 min |
| | neglected crew | 1.2 min | 6.8 min | 23.9 min | 37.7 min |

Crew contribution in a managed active run (seed 1):

| Time | Crew | Salvage machines run | Scavenger bonus | Crew share of passive salvage | Water | Automatic surveys | Echoes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 5 min | 12 | 21/21 | ×1.25 | 80% | 78% | 100% (no beacons yet) | none yet |
| 10 min | 20 | 77/77 | ×1.75 | 86% | 78% | 84% | none yet |
| 30 min | 29 | 326/326 | ×3.23 | 92% | 79% | 77% | 78% |
| 60 min | 34 | 480/480 | ×3.93 | 94% | 77% | 77% | 78% |

In the original game, "salvage from crew" was 1–3% at 10 minutes and 0% after that.

- **Pacing.** Managed crews keep the original pacing. Level 3, Level 5 and the exit are within 4% on both profiles and both iterations. The largest gap at any milestone is Level 2 for an active player: 0.8 minutes (+8%) later.
- **Neglect.** Leaving machines unrun costs 12–16% on the first exit and 23–39% on the second. That is the signal that crew matter, without making progress impossible.
- **Déjà Vu at exit.** It moved from 214 to 217 for active players and from 223 to 196 for casual players.
  - Déjà Vu per exit varies by about ±25% between seeds, depending on whether a large expedition returns before the exit, so differences under that size are not meaningful.

### Tuning chosen from measurements

| Setting | Tried | Chosen | Why |
| --- | --- | --- | --- |
| Machines per crew member | 6 | 4 | At 6 the rule never constrained anything. |
| Machines you run yourself | 5 | 10 | 5 left the casual profile 10% slow. Late in a run, 10 machines are negligible. |
| Unattended output | 35% | 25% | Both measured about the same. The lower value keeps neglect visible. |
| Work Gangs price | 200 water | 400,000 salvage | Paying water competed with hiring, which is the thing it helps. |

## Limitations

- **Facility rows overwrite the game's stat line.** The experiment supplies the whole line through `facilities:line`, so another experiment that also rewrote facility lines would need to coordinate. None does today.
- **Facility outputs are recomputed after the original calculation.** The `derive:production` hook recomputes facility totals, so any change to the original facility formula must be checked here too. The equivalence check catches drift only with the flag off.
- **The previous shift is a judgement call.** It preserves production exactly at conversion, but it is a one-run allowance. A player who converts mid-run and then buys many machines must hire or reassign crew to run them.
- **No refunds.** Turning the flag off never refunds salvage spent on the three staffing requisitions.
