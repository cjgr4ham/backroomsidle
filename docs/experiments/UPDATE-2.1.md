# Update 2.1: visible crew, automation, and Levels 4 and 5

Version `2.1.0`, compared with the game before it: commit `c903362`. Every part of the update is an experiment with its own flag and its own commits, and can be switched off on its own. With all of them off, the game plays exactly as `c903362` does; that is checked, not assumed (section 6).

**Contents**

1. [What the update does](#1-what-the-update-does)
2. [Feature and rollback matrix](#2-feature-and-rollback-matrix)
3. [How to switch things off](#3-how-to-switch-things-off)
4. [Switching off, restoring old code, or restoring a save](#4-switching-off-restoring-old-code-or-restoring-a-save)
5. [Balance report](#5-balance-report)
6. [Tests and verification](#6-tests-and-verification)
7. [Limitations and known issues](#7-limitations-and-known-issues)

## 1. What the update does

### Automated play you can watch

| Experiment | What you see |
| --- | --- |
| [`EXP-CREW-VISIBLE`](EXP-CREW-VISIBLE.md) | The specialists you have recruited work in the corridor, in world space: lit, fogged and hidden by nearer walls like anything else there. A survey moves the camera past them. They abandon the scene and catch up from behind, or come out of a doorway ahead. They never jump, never appear twice and never walk through a wall. Two are on stage at a time, each role with its own work and props. Reduced motion shows still poses with labels. |
| [`EXP-ROOM-VARIETY`](EXP-ROOM-VARIETY.md) | Junctions, work bays, recesses and storage along the corridor, in each level's style and stable per stretch. Traces of the crew's work stay behind, a bounded few. |
| [`EXP-PRODUCTION-FEEDBACK`](EXP-PRODUCTION-FEEDBACK.md) | Every 8–14 seconds one specialist's production since their last line is summed up, such as "Scavenger recovered +12.4K salvage". It is shown over their head, or at the foot of the feed. It only reports what has already been credited. |
| [`EXP-AMBIENT-EVENTS`](EXP-AMBIENT-EVENTS.md) | Small events that resolve on their own: a failing light, a door opening, footsteps in the water, the Watcher checking a sound. They never happen during danger and are never in the way. |
| [`EXP-CREW-EQUIPMENT`](EXP-CREW-EQUIPMENT.md) | Kit at levels 5, 15, 30 and 45 for each specialist. A better piece replaces the one in its slot, so nothing is carried twice. The kit is drawn on the figures and listed in the Crew tab. |

All five are drawing only. They have their own random sequence and clock, and the same seeded session ends in exactly the same state with each of them on or off (tested for each). The frame rate never touches the economy.

### Automation

| Experiment | What it adds |
| --- | --- |
| [`EXP-MISSION-AUTOREPEAT`](EXP-MISSION-AUTOREPEAT.md) | The **Dispatch Protocol** requisition (4M salvage, Level 2, after the first mission). Each mission gets an Auto-repeat switch, off by default. A repeated mission checks its requirements again and pays as usual; one that cannot go says what it waits for. The queue order is fixed, and there is a pause for all of them. Time away is handled at the exact moment each mission returns. |
| [`EXP-AUTO-UPGRADE`](EXP-AUTO-UPGRADE.md) | The **Procurement Controller** requisition (25M salvage, Level 2). It adds Auto-upgrade under each specialist's yellow button, Auto-buy and Auto-tier on facilities, and Auto-buy on requisitions. One shared buyer always buys the cheapest switched-on target first, with no reserve and no buy modes, and "Complete" / "Max level" where nothing is left. It takes over Procurement Notes' choices, and time away is bought in the same small steps. |

### Levels 4 and 5

| Experiment | What it adds |
| --- | --- |
| [`EXP-LATE-FACILITIES`](EXP-LATE-FACILITIES.md) | The Carbon Copier and the Pneumatic Tube Network join the Level 4 wave, and the Door-Number Lathe and the Hallway Signal Relay the Level 5 wave. Each has three tiers. |
| [`EXP-LATE-UPGRADES`](EXP-LATE-UPGRADES.md) | Eight requisitions: the Industrial Stapler, Green Desk Lamp, Night Shift Coffee, Hold Music, Speed Dial, Door Wedges, Master Key and Hallway Runner. |
| [`EXP-LATE-RESEARCH`](EXP-LATE-RESEARCH.md) | Six projects with prerequisites. Two of them, Hallway Cartography and Signal Theory, are repeatable, with their own ranks: scalable paths for Level FUN. |
| [`EXP-LATE-BALANCE`](EXP-LATE-BALANCE.md) | The Night Office's exit at 220,000 rooms instead of 350,000. Level FUN's floors at 200,000 rooms instead of 50,000 while the late content is on. |
| [`EXP-DV-PRICES`](EXP-DV-PRICES.md) | Added on request after the first eleven. The Déjà Vu shop is repriced so one run cannot buy it out: Memories cost about ten times as much, Recurrence ×5, and the shop's levels ×4 to ×6. |

### What did not change

- Surveys by hand and survey power.
- Facilities as the click multiplier, and specialists as the only passive production. No visual feature produces anything.
- The five unique, upgradeable specialists.
- Facility waves.
- Timed research that is kept through noclips.
- Entity penalties.
- Rebirth after the Long Hallway, and endless Level FUN.
- Déjà Vu earned per noclip, and its +1% production per point.

## 2. Feature and rollback matrix

Commits are listed oldest first. Revert newest first.

| Experiment | Flag default | Content ids | Code | Commits | Needs | Revert before |
| --- | --- | --- | --- | --- | --- | --- |
| `EXP-CORE` (infrastructure, no flag) | — | — | `index.html` core | `ef3064f` infrastructure, `3a2bf68` slots, `53483ec` automation summary and quiet launch, `4cd988d` `upgrades:head`, `48b06ec` `Exp.collect`, `82ece24` `View.features`, `d08d73b` `view:light`, `fb198b2` `level:exit`, `92ffe5c` `fun:floorRooms`, `34c8ace` `dv:price` | — | every experiment that uses that hook |
| `EXP-CREW-VISIBLE` | on | — | slot | `c568f5c`, `ff57115`, `ad5f214` (`crew:attend`), `25a1028` (`crew:kitHide`) | `82ece24` | `EXP-AMBIENT-EVENTS` before `ad5f214`; `EXP-CREW-EQUIPMENT` before `25a1028` |
| `EXP-ROOM-VARIETY` | on | — | slot | `d1cd462` | `82ece24` | — |
| `EXP-PRODUCTION-FEEDBACK` | on | — | slot + CSS slot | `723df07` | core | — |
| `EXP-AMBIENT-EVENTS` | on | — | slot | `ad1f0f2` | `d08d73b`; uses `crew:attend` if present | — |
| `EXP-CREW-EQUIPMENT` | on | — | slot + CSS slot | `6d92629` | core; uses `crew:kit` and `crew:kitHide` if present | — |
| `EXP-MISSION-AUTOREPEAT` | on | `upgrade:dispatch` | slot + CSS slot | `ce92fad` | `53483ec` | — |
| `EXP-AUTO-UPGRADE` | on | `upgrade:procurement` | slot + CSS slot | `60c2705` | `4cd988d`, `48b06ec`, `53483ec` | — |
| `EXP-LATE-FACILITIES` | on | `facility:copier`, `facility:tubes`, `facility:lathe`, `facility:relay` (tiers share them) | slot | `5f994c7`, `a529c70` (tuning) | `ef3064f` | — |
| `EXP-LATE-UPGRADES` | on | `upgrade:stapler`, `upgrade:lamp`, `upgrade:coffee`, `upgrade:holdmusic`, `upgrade:speeddial`, `upgrade:wedges`, `upgrade:masterkey`, `upgrade:runner` | slot | `51919ec`, `a1b140a` (prices), `6964ea7` (effects) | `ef3064f` | — |
| `EXP-LATE-RESEARCH` | on | `research:late_filing`, `research:late_acoustics`, `research:late_logistics`, `research:late_crewcraft`, `research:late_cartography`, `research:late_signal` | slot | `2017741`, `4bd5b02` (tuning) | `ef3064f` | — |
| `EXP-LATE-BALANCE` | on | `balance:office_exit`, `balance:fun_floors` | slot | `09407dc`, `fccf82c` | `fb198b2`, `92ffe5c`; reads the three late-content flags | — |
| `EXP-DV-PRICES` | on | — | slot | `2c1b860` | `34c8ace`; the shop's levels through `6a67e36` | — |

Other commits in the update:
- `EXP-DEJA-VU-SHOP`:
  - `6a67e36` prices its own levels through `dvPrice()`;
  - `1659a13` fixes the shop's Memory cards, which showed the raw price while buying charged `memoryCost()`.
- Tools and tests:
  - `d28827d` the balance bot and `balance-report.js`;
  - `d9faf1d` the Level FUN and rebirth suites follow the balance experiments;
  - `602f4d0` the equivalence check switches `EXP-DV-PRICES` off with the other update flags.
  - `24dae1e` the facilities suite's scroll check measures the tab panels' own scroll (section 6).

**Persistent data, by experiment.**

| Data | Owner | Kept when it is switched off |
| --- | --- | --- |
| `ext.dispatch` (Auto-repeat choices, pause, waiting) | `EXP-MISSION-AUTOREPEAT` | yes |
| `ext.procure` (switches, pause) | `EXP-AUTO-UPGRADE` | yes; the facility choices are mirrored in `run.autobuy` for Procurement Notes |
| `ext.ranks` (repeatable research ranks) | core, `EXP-LATE-RESEARCH` | yes |
| `ext.resq` (a project set aside while its content is off) | core | yes; it resumes, already paid, when the content returns |
| `run.dormant.facilities`, `run.dormant.autobuy`, `dormant.researching` | core | yes; restored when the content returns |
| `run.ext.funfloor` (this run's Level FUN floor size) | `EXP-LATE-BALANCE` | yes; ignored while off |
| `ext.build` (`{ v: '2.1.0' }`) | core | — |

The five visual experiments, `EXP-LATE-BALANCE`'s exit and `EXP-DV-PRICES` store nothing.

**Reverting code with `git revert`.**
- Each experiment fills only its own slots and adds its own test and entry, so its commits revert cleanly in `index.html`.
- The one expected conflict is `tools/tests/core.test.js`: every experiment commit added its name to the same line of the `EXPERIMENTS` list.
  - To resolve it, keep the current list and delete the reverted experiment's name.
  - Then run `git add tools/tests/core.test.js` and `git revert --continue`.
- That is what the revert proofs in section 6 do.

## 3. How to switch things off

**A whole experiment:**
- **Dev tab → Experiments** (the developer menu must be enabled). Saved in this browser, separately from the save.
- **`?exp=-EXP-AMBIENT-EVENTS`** in the address, for one page load. Several are joined with commas; `?exp=none` switches every experiment off.
- **`HUM.Exp.set('EXP-AMBIENT-EVENTS', false)`** in the console, with `#debug` in the address.

**One piece of content:**
- **Dev tab → Content switches**.
- **`?content=-facility:lathe`** in the address (several joined with commas).
- **`HUM.Exp.setItem('facility:lathe', false)`** in the console.

**Back to the game before the update, in play:**

```
?exp=-EXP-CREW-VISIBLE,-EXP-ROOM-VARIETY,-EXP-PRODUCTION-FEEDBACK,-EXP-AMBIENT-EVENTS,-EXP-CREW-EQUIPMENT,-EXP-MISSION-AUTOREPEAT,-EXP-AUTO-UPGRADE,-EXP-LATE-FACILITIES,-EXP-LATE-UPGRADES,-EXP-LATE-RESEARCH,-EXP-LATE-BALANCE,-EXP-DV-PRICES
```

`tools/equivalence-check.js` plays 8 seeded sessions with exactly this query against `c903362` and compares the whole state at 96 checkpoints.

**What switching off guarantees**, each tested in the experiment's suite:
- Automation stops at once. A mission already sent still returns, and nothing is bought by itself after the switch.
- Ownership, ranks, switches and choices are kept, in the data listed above.
- No hidden bonus remains. Effects come from one data-driven path that skips switched-off content.
- Switching back on restores everything with no duplicates. Nothing is bought, sent or refunded twice.
- Currency is never removed. Paid missions are never cancelled.
- A research project of switched-off content is set aside without holding the slot, and resumes, already paid, when the content returns.

## 4. Switching off, restoring old code, or restoring a save

| You want | Do | What happens to the save |
| --- | --- | --- |
| The old behaviour, keeping everything | Switch the experiments off (section 3) | Nothing is lost. Content data stays dormant and comes back when switched on. |
| The old code | Revert the experiment's commits (section 2), or run the build `c903362` itself | See below: tested with `c903362`. |
| The save as it was before 2.1 | Restore `the-hum.save.pre-2.1` | The first time 2.1 loads a save without its mark, it copies that save, untouched, to this key. |

**What `c903362` does with a save written by 2.1.** This was tested by writing a rich 2.1 save, loading it in `c903362`, letting `c903362` play and save, and loading the result back in 2.1.

| Part of the save | In `c903362` | Back in 2.1 |
| --- | --- | --- |
| Level, salvage, water, Echoes, Déjà Vu, specialists, base facilities, Memories | kept | kept |
| Late requisitions (incl. Dispatch Protocol and Procurement Controller) | kept in `run.dormant.upgrades` | restored |
| Finished late research | kept in `dormant.research` | restored |
| Research ranks, Auto-repeat and Procurement choices, Déjà Vu shop levels, the 2.1 mark | kept as opaque experiment data | restored |
| **Units of the four late facilities** | **dropped** | **lost** |
| **A late research project under way** | **dropped, its Echoes not refunded** | **lost** |

`c903362` loads it without errors. So that build can read a 2.1 save, but it loses late facility units and a late project under way. Before going back to old code with a save you care about, export it, or switch the experiments off instead.

**Restoring the copy.**
1. In the browser console on the game's page, this copies the kept save to the clipboard as import text:

   ```
   const b = new TextEncoder().encode(localStorage.getItem('the-hum.save.pre-2.1')); let t = ''; for (let i = 0; i < b.length; i += 0x8000) t += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); copy('HUM1.' + btoa(t));
   ```

2. Paste it into **Settings → Import**, in this build or in `c903362`.

Export the current save first if you might want it back. Writing the key directly is not enough: the game saves its current state when the page reloads or closes, which would overwrite it.

**Fixtures.** `tools/tests/fixtures/pre-update-l4.json`, `pre-update-l5.json` and `pre-update-fun.json` are saves written by `c903362` itself (`make-pre-update-saves.js`). The update's suites load them.

## 5. Balance report

**How it was measured.** `node tools/balance-report.js "before=@c903362" "now="` runs the balance bot (`tools/balance-bot.js`) against both builds, three seeds each.
- Medians are shown; times are minutes from the start of an iteration.
- The bot plays a patient player (`--save=180`): it saves for a one-off requisition worth up to 3 minutes of income, while still buying what costs at most 5% of it.
- With `--auto` it buys both automation requisitions and switches every target on.

### Pacing in Levels 4 and 5

| Player | Build | Iteration | Reaches Level 4 | Night Office | Long Hallway | Survey complete | Déjà Vu earned |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Active (2 surveys/s) | before | 1 | 43.5 | 18.9 | 19.2 | 81.8 | 173 |
| Active | 2.1 | 1 | 44.5 | **15.2** | **13.0** | **72.7** | 154 |
| Active, modest prestige | before | 2 | 7.7 | 6.0 | 6.7 | 19.6 | 335 |
| Active, modest prestige | 2.1 | 2 | 12.7 | 4.9 | 5.2 | 22.9 | 278 |
| Idle (0.3 surveys/s) | before | 1 | 106.3 | 24.6 | 21.8 | 152.0 | 140 |
| Idle | 2.1 | 1 | 109.2 | 16.8 | 21.2 | 145.0 | 127 |
| Active, both automations | 2.1 | 1 | 48.0 | 16.2 | 18.4 | 82.6 | 150 |
| Active, both automations | 2.1 | 2 | 12.8 | 5.8 | 7.0 | 25.6 | 312 |
| Idle, both automations | 2.1 | 1 | 115.6 | 23.8 | 22.7 | 161.8 | 128 |

`c903362` has no automation requisitions, so its automation rows are its manual rows.

- **Required stretches.** The Night Office was the longest required stretch, at about 19 minutes; it is now about 15. The Long Hallway is now about 13 minutes.
- **Déjà Vu per minute is unchanged** (2.12 vs 2.11 in iteration 1). The run is shorter, so slightly less is earned per run.
- **Iteration 2 is slower** (22.9 vs 19.6 minutes) because `EXP-DV-PRICES` lets run 1's Déjà Vu buy less. That was asked for: run 1 now buys 4 Memories and 3 levels, against 10 Memories and 11 levels before.
- **Automation with every switch on** is slower than a patient player: about 10 minutes for an active player and 17 for an idle one.
  - The cheapest-first rule spreads salvage over many cheap targets and never saves for a big one. The rule was specified with no reserve.
  - Switching on only the targets you want avoids this.
  - The automations' value is in time away and in not needing to click, both measured in their own suites.

### Purchases in Levels 4 and 5

| Player | Build | Purchases in L4 / L5 | Longest wait between two purchases, L4 / L5 |
| --- | --- | --- | --- |
| Active | before | 124 / 96 | 54 s / 72 s |
| Active | 2.1 | 92 / 85 | 90 s / 90 s |
| Idle | before | 117 / 93 | 126 s / 120 s |
| Idle | 2.1 | 67 / 119 | 126 s / 114 s |
| Active, both automations | 2.1 | 133 / 143 | 18 s / 18 s |

The patient player buys fewer, larger things. It never waits more than about 1.5 minutes for the next purchase when active.

### Price ÷ income when an item first goes on sale (Levels 4 and 5, all seeds)

Targets: small purchases 30–90 s, meaningful 2–5 min, major 5–12 min.

| Player | Build | Items | < 30 s | 30–90 s | 90–120 s | 2–5 min | 5–12 min | > 12 min |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Active | before | 27 | 9 | 9 | 0 | 6 | 3 | 0 |
| Active | 2.1 | 57 | 10 | 14 | 0 | 21 | 12 | **0** |
| Idle | 2.1 | 60 | 3 | 5 | 6 | 10 | 14 | 22 |
| Active, both automations | 2.1 | 62 | 5 | 16 | 2 | 18 | 12 | 9 |

For the active player (seed 1), the new items sell for:

| Item | Wait at income then |
| --- | --- |
| Carbon Copier | 54 s |
| Stapler, Coffee, Tube Network | 2.7 min |
| Door Wedges, Signal Relay | 3 min |
| Hold Music | 3.6 min |
| Hallway Runner | 4.5 min |
| Desk Lamp, Speed Dial | 5.4 min |
| Master Key, Door-Number Lathe | 7.5 min |

Nothing an active player sees is over 12 minutes; before the tuning, the Master Key was 22 minutes. An idle player's income is a fifth of an active player's, so the Level 5 items are long-term goals for them (the Lathe and Master Key about 37 minutes when they first go on sale), and income grows from there.

### Level FUN

Two iterations, each with 30 minutes in Level FUN before noclipping:

| Build | Déjà Vu after iteration 1 | After iteration 2 | Purchases in Level FUN, iteration 1 / 2 | Repeatable research ranks bought there |
| --- | --- | --- | --- | --- |
| before | 435 | 3,558 | 160 / 297 | 2 / 2 |
| 2.1 | 508 | 5,091 | 253 / 469 | 2 / 2 |

There is more to buy in Level FUN, and its Déjà Vu stays close to the baseline. It did not start that way.
- With the late content as first committed, a 30-minute stay gave 5,977 Déjà Vu (seed 1), and the next iteration's 4.2 million.
- Level FUN's depth grows with every room mapped, and the late content's mapping and salvage effects compound there.
- Tuning the content down alone was not enough (171,302 in iteration 2). Larger Level FUN floors alone were not enough either.
- The combination brings it back near the baseline:
  - the late content tuned to modest effects and steep price growth, in their own commits;
  - 200,000-room floors while that content is on.

The baseline's own Level FUN still grows faster every iteration with long stays. That is unchanged (section 7).

### Changes to existing values

Nothing existing became more expensive or slower without a stated reason.

| Change | Direction | Why |
| --- | --- | --- |
| Night Office exit 350,000 → 220,000 | easier | It was the longest required stretch (19 min); now about 15. |
| Level FUN floors 50,000 → 200,000 rooms, only with the late content on, only for new runs | slower depth per room; Déjà Vu per stay still above the baseline | Compensates the late content's extra mapping. A run already deep in Level FUN keeps its floors. |
| Déjà Vu shop prices ×4 to ×12 | slower prestige shopping | Requested: one run must not buy out the shop. |

Every other number changed belongs to the update's own new content.

## 6. Tests and verification

**The suites.** `node tools/run-tests.js` runs every suite. The last full run on the final head: *in progress, recorded here when it completes*.

| Suite | Checks | Covers |
| --- | --- | --- |
| `update-core.test.js` | 29 | content switches, dormant data, independent ranks, research set aside and resumed, pre-update fixtures |
| `late-facilities.test.js` | 20 | the four facilities, their tiers, switching off and back |
| `late-upgrades.test.js` | 20 | the eight requisitions, their effects, homes and slips, switching off one or all |
| `late-research.test.js` | 22 | prerequisites, level gates, ranks, set-aside projects |
| `late-balance.test.js` | 10 | the exit and the floor rule, switches, saves deep in Level FUN |
| `dispatch.test.js` | 35 | Auto-repeat, payment, waiting, order, pause, time away at exact returns |
| `procurement.test.js` | 34 | the cheapest-first order (the A100 → B150 → A200 → C220 example), switches, Complete / Max level, legacy notes, time away |
| `crew-visible.test.js` | 23 | world space, surveys, no jumps or walls, two on stage, reduced motion, hidden tab, entities, `crew:attend`, zero effect |
| `room-variety.test.js` | 15 | seeded rooms per level, traces bounded, zero effect |
| `production-feedback.test.js` | 10 | sums match what was credited, sparse, never grants |
| `ambient-events.test.js` | 25 | cadence, self-resolving, suppression, settings, sound cap, no `Math.random`, zero effect |
| `crew-equipment.test.js` | 11 | milestones, slots, replaced props, Crew tab line, zero effect |
| `dv-prices.test.js` | 10 | prices, what one run buys, the shop shows what it charges, nothing lost |

The older suites (economy, facilities, specialists, research, encounters, Level FUN, migration, rebirth, accounts, cloud save, leaderboard, viewports and the rest) all run in the same command.

**The baseline equivalence.** `node tools/equivalence-check.js` compares `c903362` with this build, every update flag off, over 8 seeded sessions. The sessions include noclips, time away and save round trips. All **96 of 96 checkpoints are identical**, including the full state and every derived rate.

**Revert proofs.** Run in throwaway clones, never in the working copy. Each experiment's commits were reverted from the final head, newest first, then the full suite and the equivalence check were run.

| Experiment | Reverted, newest first | Conflicts | Full suite afterwards | Equivalence with `c903362` |
| --- | --- | --- | --- | --- |
| `EXP-DV-PRICES` | `2c1b860` | none | all 35 suites pass (883 checks) | 96 of 96 identical |
| `EXP-AMBIENT-EVENTS` | `ad1f0f2` | the `core.test.js` list | 34 of 35 suites; one facilities check failed (below) | 96 of 96 identical |
| `EXP-CREW-EQUIPMENT` | `6d92629` | the `core.test.js` list | all 35 suites pass (882 checks) | 96 of 96 identical |
| `EXP-MISSION-AUTOREPEAT` | `ce92fad` | the `core.test.js` list | all 35 suites pass (858 checks) | 96 of 96 identical |

*In progress:* the proofs for the other eight experiments are running, and this table is completed when they finish.

The facilities check that failed measured the page's own scroll. At 1366×860 the tab panels scroll in their own column, and the page can move by one pixel only. It now measures the panel column (`24dae1e`, test only), and that proof is being run again.

**Save compatibility.** The test of `c903362` reading a 2.1 save is in section 4.

**In the browser.** *In progress, recorded here when complete.*

## 7. Limitations and known issues

- **Balance is measured with a bot, not people.** It plays fixed strategies: active at 2 surveys/s, idle at 0.3/s, patient saving and everything automated. Real players will differ, especially in what they switch on for the Procurement Controller.
- **Level FUN still grows faster every iteration with long stays**, as it did before the update: 435 → 3,558 Déjà Vu in the baseline, 508 → 5,091 now. Bounding it would mean changing Level FUN or the Déjà Vu formula themselves. That is outside this update, and was left alone.
- **Automation with every target switched on is less efficient than a patient player** (section 5). This is the specified cheapest-first rule, with no reserve.
- **Idle players wait long for Level 5's largest items** (over 12 minutes at first sale).
- **`c903362` loses late facility units and a late project under way** when it loads a 2.1 save (section 4).
- **Reverting an older experiment commit conflicts on one line** of `tools/tests/core.test.js` (section 2).
- **Ambient sounds were not heard.** The browser checks run headless. What is tested is that at most one sound is scheduled per 12 seconds, none with sound effects or ambience off, and that sounds never use the game's random sequence.
- **Visual quality was judged from frame captures**, at the game's 384×216 resolution enlarged, at every level and with reduced motion.
