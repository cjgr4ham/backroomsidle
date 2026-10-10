# Experiment registry

The changes made to The Hum since the original game are split into independent experiments. Each one has:

- a stable identifier and its own runtime flag;
- its own code slot in `index.html`, and its own file in `server/features/` if it has a server part;
- its own commits and its own tests;
- a registry entry.

Entries from the first update have twelve fields. Entries from the final specification update have the ten fields that update asks for:

1. what changes;
2. files and functions;
3. dependencies;
4. how to disable it;
5. how to reverse the code;
6. whether it modifies persistent data;
7. whether it needs a database migration;
8. how to restore the original behaviour;
9. what happens to data created while it was on;
10. the rollback tests actually performed.

| Document | What it records |
| --- | --- |
| [BASELINE.md](BASELINE.md) | The original game (commit `ebfa0c6`) |
| [AUDIT-META-ACCOUNTS.md](AUDIT-META-ACCOUNTS.md) | Phase A of the final update. Hosting reality, the Noclip sequence, the existing Déjà Vu shop, facility rules, the save schema and the state classification. |
| [V2-REDESIGN.md](V2-REDESIGN.md) | **The v2 redesign (current game)**: survey power, specialists, missions, timed research, entities, Level FUN, save format 2 |
| [PRODUCTION.md](PRODUCTION.md) | How salvage is produced in v2, and where each figure is counted once |
| [server/README.md](../../server/README.md) | The game server: environment variables, backups and the security model |
| [DEPLOYMENT.md](../DEPLOYMENT.md) | Deploying the game and server at a public URL: what was verified, the steps, and what is still needed |

## Version 2 (current)

The v2 redesign rebuilt the game around what one survey by hand recovers. Its full entry is [V2-REDESIGN.md](V2-REDESIGN.md).

**What changed:**
- Facilities are the click multiplier.
- The Scavenger is the only passive salvage.
- Five unique specialists replace the workforce, and missions replace expeditions.
- Research is timed.
- Hostile entities appear in the corridor.
- Completing the Long Hallway leads into endless Level FUN.
- Saves move to format 2, with a repeat-safe migration.

**Folded into the core.** Five experiments no longer have a flag, a code slot or their own suite. Their entries carry a banner saying where their behaviour lives now:
- `EXP-CLICK-POWER`;
- `EXP-CREW-AUTOMATION`;
- `EXP-FACILITY-TIERS`;
- `EXP-FACILITY-INDEPENDENCE`;
- `EXP-FACILITY-SALVAGE-SCALING`.

**Still experiments, with their flags:**
- `EXP-UPGRADE-CATEGORIES`, `EXP-RESOURCE-LEDGER`, `EXP-ATTENTION-BALANCE`, `EXP-DEV-MENU`;
- `EXP-NOCLIP-STATISTICS`, `EXP-DEJA-VU-SHOP`;
- `EXP-ACCOUNT-AUTH`, `EXP-ACCOUNT-UI`, `EXP-CLOUD-SAVE`, `EXP-NOCLIP-LEADERBOARD`.

Each entry has an "In v2" note on what changed for it. `EXP-CORE` remains the infrastructure.

**Proofs from before v2.** The revert proof (`tools/revert-check.js`) and the all-off equivalence check (`tools/equivalence-check.js`) were removed with the redesign. Both compared against the pre-experiment build, which the redesigned core deliberately no longer matches. What the redesign's rollback was actually tested with is in section 10 of [its entry](V2-REDESIGN.md).

**The sections below the v2 tests** describe the experiments as of the final specification update, before v2. They are kept as the record.

### Tests (v2)

`node tools/run-tests.js` runs 23 suites with 629 checks. The last full run passed every one; see the commit history for the date.

| Suite | What it covers | Checks |
| --- | --- | --- |
| `functional-test.js` | The core game with every experiment off: surveying, purchases, specialists and missions, incidents, sanity, anomalies, levels, completion and noclip, saving, time away, damaged and hostile saves, export and import, reset, keys | 58 |
| `economy.test.js` | Fresh game +1 per survey and nothing passive. The first cart +1 → +1.25. The facility multiplier formula. No passive or offline salvage without the Scavenger, which starts at once. Survey power and passive salvage independent. Missions follow the Scavenger. The displays | 35 |
| `facilities.test.js` | Level waves and the coming-waves list. Tiers on the rows. Under rapid surveying by button and keyboard: stable wording, no panel rebuilds, no layout jumps, scroll and focus kept | 30 |
| `specialists.test.js` | Five unique specialists: recruiting, upgrading, prices, immediate effects, level gates, the Crew tab, crew requisitions, taken and returned. Missions without allocation, completing once on the game clock and while away | 38 |
| `research.test.js` | Paid once, one project at a time, progress shown. Completes once and on time, including across a reload and while the page was closed. A step across the end applies the benefit only after it. Kept through noclip. Deep Survey Theory. Doctrines. Invalid saved projects dropped | 25 |
| `encounters.test.js` | Regular entities, more with attention, none while standing still. Warning, then danger. A survey in danger (button or key) checked before any reward, a bounded penalty, once, then a cooldown. Buying, menus and the Cartographer never trigger it. Background tabs, time away and reloads never punish. Visible with every effect reduced | 33 |
| `fun.test.js` | Noclip locked until the last room of Level 5. Completion enters Level FUN with everything kept, carries overflow, counts no noclip and sends no report. FUN's look, endless count and floors. FUN and eligibility survive a reload. Rebirth resets the run and counts one noclip | 27 |
| `migration.test.js` | Saves written by the version-1 build: everything permanent kept, crew converted with a cap and refund, expeditions carried over, a completed survey into FUN. Repeat-safe, no double compensation. Import and backup paths, developer marks kept | 25 |
| `core.test.js` | `EXP-CORE`: the registry, flags, dormant data, wallet, hooks; folded experiments leave no flags | 37 |
| `all.test.js` | Every experiment on: a save from the original build, the v2 systems in play and away, every tab | 16 |
| `rebirth.test.js` | The noclip with experiments off and on | 25 |
| `categories.test.js`, `ledger.test.js`, `attention.test.js`, `dev-menu.test.js` | Their experiments, on and off | 14, 17, 19, 30 |
| `noclip-statistics.test.js`, `deja-vu-shop.test.js` | Their experiments, on and off | 23, 40 |
| `account-auth.test.js`, `account-ui.test.js`, `cloud-save.test.js`, `leaderboard.test.js`, `server-core.test.js` | Accounts, cloud saves (formats 1 and 2) and the leaderboard (Level FUN reports) against real test servers | 27, 22, 32, 28, 19 |
| `viewports.test.js` | Every tab and sub-tab at four screen sizes, from disk and served while signed in, on Level 4 and in Level FUN | 9 |

### Pacing (v2)

Medians of 7 seeds, two iterations, from `node tools/pacing-compare.js --seeds=7 --runs=2 "v2="`. Times in minutes; "complete" is the last room of Level 5.

| Player | Iteration | L1 | L2 | L3 | L4 | L5 | Complete | Déjà Vu | By hand | Scavenger | Entities met / caught |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Active (3 surveys/s) | 1 | 3.7 | 10.3 | 19.5 | 36.4 | 56.2 | 73.6 | 192 | 52% | 37% | 57 / 0 |
| Active | 2 | 0.4 | 0.9 | 3.1 | 6.5 | 11.9 | 18.3 | 427 | 62% | 28% | 15 / 0 |
| Casual (1 survey/s) | 1 | 10.3 | 24.1 | 42.5 | 68.9 | 91.5 | 113 | 160 | 30% | 53% | 89 / 0 |
| Casual | 2 | 0.9 | 2.1 | 5.2 | 9.9 | 16.5 | 24.0 | 323 | 47% | 39% | 19 / 0 |

The bot stands still for every entity; `--reckless` makes it keep surveying.

## Scope (before v2)

**First update (PR #2):**
- click power;
- crew-centred idle production;
- clearer upgrades and statistics;
- a developer menu;
- an Attention audit.

Three new levels were cancelled. No levels were added in either update: the game has six levels, numbered 0 to 5.

**Final specification update (this branch):**
- facilities never need crew;
- a salvage-first Facilities shop;
- a Déjà Vu shop;
- a noclip counter and records;
- username and password accounts;
- cloud saves;
- a server-recorded noclip leaderboard.

**Hosting.** Accounts, cloud saves and the leaderboard need a server. One is implemented in `server/` and tested here, but **it is not deployed anywhere**. Copies without it run as before, saving in the browser, and say plainly that those features are unavailable. This covers the published artifact and files opened from disk.

## The experiments (before v2)

| Identifier | What it changes | Default | Commits | Entry | Tests |
| --- | --- | --- | --- | --- | --- |
| `EXP-CORE` | Infrastructure: flags, hook points, wallet, save namespaces, and the server skeleton. No behaviour change. | always present | `cea34a7`, `bda08bd`, `5d5724d`, `7d91cef`, `8be11e9`, `c11cb9b`, `16c3bdb`, `ada4da2` | [EXP-CORE](EXP-CORE.md) | `core.test.js` (29), `server-core.test.js` (19), equivalence check |
| `EXP-CLICK-POWER` | Survey power stat and breakdown. Work Gloves first. Hand tools, Echo Sounder and Survey Drills. | on | `4bc1f00`, `ac4f1ba`, `35af10e` | [EXP-CLICK-POWER](EXP-CLICK-POWER.md) | `click-power.test.js` (35) |
| `EXP-CREW-AUTOMATION` | Crew and shift upgrades listed in the Crew tab. Its staffing rule, under which crew run the machines, is switched off by default through `EXP-FACILITY-INDEPENDENCE`. | on | `adc4c08`, `456d171`, `13119ea` | [EXP-CREW-AUTOMATION](EXP-CREW-AUTOMATION.md) | `crew.test.js` (43) |
| `EXP-UPGRADE-CATEGORIES` | The Upgrades tab is grouped by effect | on | `9c18c5a` | [EXP-UPGRADE-CATEGORIES](EXP-UPGRADE-CATEGORIES.md) | `categories.test.js` (12) |
| `EXP-FACILITY-TIERS` | Tier upgrades are installed from each facility's row | on | `1ac4cb3` | [EXP-FACILITY-TIERS](EXP-FACILITY-TIERS.md) | `tiers.test.js` (12) |
| `EXP-RESOURCE-LEDGER` | Archive → Resources explains every resource and meter | on | `7996d30`, `81fa8a2`, `c2a17fc` | [EXP-RESOURCE-LEDGER](EXP-RESOURCE-LEDGER.md) | `ledger.test.js` (12) |
| `EXP-ATTENTION-BALANCE` | Footstep noise from surveys by hand. The meters explain Attention and Sanity. | on | `3b9fbc1` | [EXP-ATTENTION-BALANCE](EXP-ATTENTION-BALANCE.md) | `attention.test.js` (19) |
| `EXP-DEV-MENU` | Opt-in developer tools | on, hidden until you opt in | `1a8876a`, `143bb23` | [EXP-DEV-MENU](EXP-DEV-MENU.md) | `dev-menu.test.js` (27) |
| `EXP-FACILITY-INDEPENDENCE` | **Facilities never need crew.** It switches off the staffing rule, so every machine runs at full output with no crew. | on | `79baf03`, `11363ae` | [EXP-FACILITY-INDEPENDENCE](EXP-FACILITY-INDEPENDENCE.md) | `facility-independence.test.js` (14) |
| `EXP-FACILITY-SALVAGE-SCALING` | Salvage machines and support equipment. Each purchase shows its gain and the totals after it, with units. Locked facilities show their requirements. A price curve per machine. | on | `7e88a92`, `df83ca9`, `d3d6e93` | [EXP-FACILITY-SALVAGE-SCALING](EXP-FACILITY-SALVAGE-SCALING.md) | `facility-scaling.test.js` (23) |
| `EXP-NOCLIP-STATISTICS` | The noclip count in the header, and a Records panel in the Noclip tab | on | `5a2cf80`, `d00d281` | [EXP-NOCLIP-STATISTICS](EXP-NOCLIP-STATISTICS.md) | `noclip-statistics.test.js` (18) |
| `EXP-DEJA-VU-SHOP` | The Memories become the Déjà Vu shop, a Noclip sub-tab, with levels, current and next effect, and next price. Adds starting salvage, cheaper facilities and more starting crew. | on | `34a490b`, `0f09fe0`, `a79bcc3` | [EXP-DEJA-VU-SHOP](EXP-DEJA-VU-SHOP.md) | `deja-vu-shop.test.js` (30) |
| `EXP-ACCOUNT-AUTH` | Username and password accounts with server sessions. A session survives refreshes. | on (needs the server) | `7b3a048`, `a4acc33`, `232f17a` | [EXP-ACCOUNT-AUTH](EXP-ACCOUNT-AUTH.md) | `account-auth.test.js` (27) |
| `EXP-ACCOUNT-UI` | Sign-in screen, header chip and Settings → Account | on (needs accounts) | `90cce1a` | [EXP-ACCOUNT-UI](EXP-ACCOUNT-UI.md) | `account-ui.test.js` (22) |
| `EXP-CLOUD-SAVE` | The account's save, with revision checks, conflict choices and migration of existing local progress | on (needs accounts) | `e42ee5d`, `f8f05b7` | [EXP-CLOUD-SAVE](EXP-CLOUD-SAVE.md) | `cloud-save.test.js` (28) |
| `EXP-NOCLIP-LEADERBOARD` | Noclips counted once by the server, ranked in Archive → Leaderboard | on (needs accounts) | `e5b562f`, `6d3a4b1` | [EXP-NOCLIP-LEADERBOARD](EXP-NOCLIP-LEADERBOARD.md) | `leaderboard.test.js` (24) |

**Other commits, which belong to no experiment:**
- **Records:**
  - `c969846`, the baseline record;
  - `b27e03f`, the Phase A audit;
  - `397d146`, the production formula;
  - this registry.
- **Tools:**
  - `01eb7fc` and `a6daf4b`, test-tool fixes;
  - `d0a01f1`, the Rebirth and whole-game regression suites;
  - `123c0ba` and `4daa74c`, the balance and revert tools;
  - `7058190`, pacing-compare with file builds;
  - `551c2b1`, revert-check covering server files;
  - `275c900`, the interface regression suite at four screen sizes.

## Dependencies

- Every experiment depends on `EXP-CORE`.
- `EXP-ACCOUNT-UI`, `EXP-CLOUD-SAVE` and `EXP-NOCLIP-LEADERBOARD` also depend on `EXP-ACCOUNT-AUTH`.
  - Without it, their code stays in place but is inactive.
  - On the server, the features that need it are skipped, with a log line.
  - Their tests report themselves as skipped.
- **Optional cooperation.** Each of these works without the other:
  - the Records panel shows a leaderboard line;
  - Settings → Account shows cloud-save and leaderboard rows;
  - the ledger shows footstep noise when `EXP-ATTENTION-BALANCE` is on.
- **Before v2:** `EXP-FACILITY-INDEPENDENCE` answered a staffing switch asked by `EXP-CREW-AUTOMATION`, and the per-machine price curves composed with the shop's discount in `facility:price`. Both experiments are now folded into the core, so these dependencies no longer exist.

## Four different operations

These are not interchangeable.

| Operation | What it does | How |
| --- | --- | --- |
| **Turn an experiment off** | The original behaviour returns at once. The experiment's saved data is kept. | **Browser:** Dev tab → Experiments, `?exp=-EXP-ID` for one page load, or `HUM.Exp.set('EXP-ID', false)` with `#debug`. **Server:** `HUM_DISABLE=EXP-ID`. Its routes disappear, and its tables and rows stay. |
| **Restore previous settings** | Every experiment returns to its default. | Dev tab → "Reset all experiments to their defaults", or `HUM.Exp.reset()` |
| **Revert its code** | Removes the change from the game permanently. | `git revert` its commits, newest first. Revert dependents first, or accept that they become inactive. Revert `EXP-CORE` last. **Never use a blanket hard reset.** **Server data is never dropped by a revert:** take a backup of `DATA_DIR/the-hum.db` before deploying a rollback, and the tables of a removed feature simply stay unused. Since v2 rewrote the code around them, an experiment's pre-v2 commits no longer revert cleanly on their own. Switching it off is the supported way, and reverting v2 itself is described in [its entry](V2-REDESIGN.md). |
| **Restore a prior save** | Puts back a save from earlier. | Settings → Import. While signed in: Settings → Account → an earlier version or a kept copy. The game never does this automatically, so progress made after an update is never erased behind your back. |

**Rolling back persistent account data means restoring compatible behaviour while keeping the data.** No rollback in this registry deletes:
- database rows;
- the save in the browser;
- the account's save or its earlier versions;
- recorded noclips;
- Déjà Vu shop levels.

## Proof of reversibility (before v2; its tools were removed with the redesign)

`node tools/revert-check.js --all` reverts each experiment on its own in a throwaway clone. It then checks:
- that its code slots are empty;
- that the test files, server files and registry entry its commits added are gone;
- that every remaining suite and the equivalence check pass.

`--all` also takes back every experiment and core change outside `docs/` and `tools/` together. It checks that `index.html` is byte-identical to the original game and that no server files remain.

**Results of the last run** (9 October 2026, started on commit `ada4da2`; the documentation-only commit `420b6d6` landed during the run): **every revert check passed.**

| Reverted | Commits reverted | Slots empty | Its tests, server files and entry gone | Remaining suites | Equivalence |
| --- | --- | --- | --- | --- | --- |
| `EXP-ACCOUNT-AUTH` | 3 | yes | yes | 20 suites, 375 checks, all passing. The account UI, cloud-save, leaderboard and served-interface checks report themselves as skipped. | yes |
| `EXP-ACCOUNT-UI` | 1 | yes | yes | 20 suites, 458 checks, all passing | yes |
| `EXP-ATTENTION-BALANCE` | 1 | yes | yes | 20 suites, 461 checks, all passing | yes |
| `EXP-CLICK-POWER` | 3 | yes | yes | 20 suites, 445 checks, all passing | yes |
| `EXP-CLOUD-SAVE` | 2 | yes | yes | 20 suites, 452 checks, all passing | yes |
| `EXP-CREW-AUTOMATION` | 3 | yes | yes | 20 suites, 435 checks, all passing. The staffing-switch checks in the independence suite are skipped. | yes |
| `EXP-DEJA-VU-SHOP` | 3 | yes | yes | 20 suites, 450 checks, all passing | yes |
| `EXP-DEV-MENU` | 2 | yes | yes | 20 suites, 451 checks, all passing. The infinite-resource checks in other suites are skipped. | yes |
| `EXP-FACILITY-INDEPENDENCE` | 2 | yes | yes | 20 suites, 466 checks, all passing | yes |
| `EXP-FACILITY-SALVAGE-SCALING` | 3 | yes | yes | 20 suites, 457 checks, all passing | yes |
| `EXP-FACILITY-TIERS` | 1 | yes | yes | 20 suites, 468 checks, all passing | yes |
| `EXP-NOCLIP-LEADERBOARD` | 2 | yes | yes | 20 suites, 456 checks, all passing | yes |
| `EXP-NOCLIP-STATISTICS` | 2 | yes | yes | 20 suites, 462 checks, all passing | yes |
| `EXP-RESOURCE-LEDGER` | 3 | yes | yes | 20 suites, 468 checks, all passing | yes |
| `EXP-UPGRADE-CATEGORIES` | 1 | yes | yes | 20 suites, 468 checks, all passing | yes |
| **Everything** (all experiments and `EXP-CORE`) | 26 | – | – | `index.html` byte-identical to `ebfa0c6`, no server files left, and the original functional test passes | byte-identical, so not needed |

Each row's remaining checks plus the reverted experiment's own suite add up to the full 480 checks, except where checks that need the reverted experiment report themselves as skipped.

**Other proofs:**
- **Full suite.** On the final code, `node tools/run-tests.js` passed all 21 suites, 480 checks, with every experiment at its default.
- **Equivalence check.** `tools/equivalence-check.js` plays 8 seeded sessions in the original build and in this build with every experiment off. The sessions include noclips, offline time and save round trips. The full state and every derived rate match at all 96 checkpoints.
- **Rebirth suite.** `tools/tests/rebirth.test.js` requires the same noclip with every experiment off and every experiment on. It still passes, because nothing a player has not bought in the Déjà Vu shop changes a noclip.

## Save compatibility (before v2: format 1; v2 uses format 2, see its entry)

**The save format stays version 1, and every change is additive.**

**New in the final update:**

| Where | What |
| --- | --- |
| `ext.djv` | Déjà Vu shop levels |
| `ext.cloud` | The account this game belongs to, and the revision it descends from |
| `ext.lb` | The save's random lineage id for the leaderboard |
| Browser key `the-hum.account-ui` | The "play offline" choice |
| Browser key `the-hum.noclip-reports` | Reports waiting for the server |
| Browser keys `the-hum.save.keep-*` | Copies kept when another save replaced this one |

**Rules that hold for every experiment's data:**
- Data of experiments the build does not have is kept as opaque JSON and does nothing.
- Content ids the build does not know are kept in `dormant`.
- Saves from the original build load with everything intact. Saves from this build load in the original build, which ignores the extra fields.
- Developer settings never enter the save. Saves changed with the developer tools carry a mark in `ext.dev`. Such saves are never uploaded to an account, and their noclips are never ranked.

## Tests and tools (before v2)

| Command | What it does |
| --- | --- |
| `node tools/run-tests.js` | Runs every suite: the original functional test (55 checks) with every experiment off, one suite per experiment, each with experiments on and off, and an interface suite (`viewports.test.js`) that opens every tab and sub-tab at four screen sizes, from disk and served by the server while signed in. The server suites start the real server on free ports with temporary databases. |
| `node tools/equivalence-check.js` | The all-off check against the original build |
| `node tools/revert-check.js [--all]` | The reversibility proof |
| `node tools/balance-bot.js` and `node tools/pacing-compare.js` | Deterministic pacing measurements. Builds can be named as `@revision`, `?flags` or `file?flags`. |
| `npm start` | Runs the game server; see `server/README.md` |

## Combined effect on pacing (before v2)

Measured with `node tools/pacing-compare.js --seeds=7 --runs=2 "original=?exp=none" "all-on="`. The balance bot plays the real game code. Figures are medians of 7 seeds over two iterations, in minutes, and Déjà Vu is what the iteration's noclip paid.

| Player | Build | Iteration | Level 1 | Level 3 | Level 5 | Exit | Déjà Vu |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Active (3 surveys/s) | original | 1 | 3.4 | 22.2 | 54.6 | 80.2 | 214 |
| | every experiment on | 1 | 2.8 | 18.5 | 49.9 | 74.5 | 263 |
| | original | 2 | 0.5 | 4.0 | 15.1 | 24.5 | 585 |
| | every experiment on | 2 | 0.5 | 3.8 | 14.8 | 24.1 | 560 |
| Casual (1 survey/s) | original | 1 | 8.4 | 32.0 | 67.0 | 95.4 | 223 |
| | every experiment on | 1 | 7.4 | 29.7 | 65.1 | 91.9 | 190 |
| | original | 2 | 1.2 | 5.3 | 17.1 | 27.2 | 642 |
| | every experiment on | 2 | 1.0 | 5.3 | 16.9 | 26.9 | 492 |

- **First iteration:** the exit comes about 6 minutes sooner for the active player and about 3.5 minutes sooner for the casual one. Click power alone brings the early levels forward but does not move the exit (see [its entry](EXP-CLICK-POWER.md)), so the earlier exit comes from the experiments together.
- **Second iteration:** almost unchanged. Room counts set the pace of later iterations, and the bot's Déjà Vu shop purchases help only slightly, which is what that shop's balance aims for (see [its entry](EXP-DEJA-VU-SHOP.md)).
- **Déjà Vu earned** moves by up to a quarter either way. The casual player earns less with the per-machine price curves, because big machines cost more; the active player earns more from click power.
- Each experiment's own measurements are in its entry.

## Required test cases (final specification, section 10; before v2)

| Case | Where it is tested |
| --- | --- |
| A player with zero crew can buy and use every unlocked facility, and bonuses work without crew | `facility-independence.test.js` |
| The first purchase gives its documented bonus; repeated purchases raise ownership and cost correctly; facilities have their documented effects | `facility-scaling.test.js` |
| Facility bonuses do not double-count with crew or click power | `facility-independence.test.js` (scavenger bonus counted once), `facility-scaling.test.js` (a facility changes neither crew output nor survey reward) |
| Facility purchases persist across refreshes and reset on noclip; developer infinite mode works with them | `facility-scaling.test.js` |
| A valid noclip awards Déjà Vu correctly, and the count rises exactly once | `noclip-statistics.test.js`, `deja-vu-shop.test.js`, `rebirth.test.js` |
| Permanent upgrades survive the reset and apply to the next run exactly once; costs rise correctly; unaffordable purchases are refused; reloading after a noclip duplicates nothing; existing Déjà Vu data stays compatible | `deja-vu-shop.test.js` |
| Registration, duplicate usernames, valid and invalid sign-in | `account-auth.test.js`, `account-ui.test.js` |
| Refreshing after sign-in does not return to the sign-in screen; signing out does; a reopened session restores the account | `account-auth.test.js`, `account-ui.test.js` |
| Progress is associated with the right account, and one account cannot read or change another's save | `cloud-save.test.js` |
| Existing local progress migrates safely; an account save is not silently overwritten; stale tabs and devices do not erase newer progress | `cloud-save.test.js` |
| The ranking uses real counts, higher ranks above lower, ties by the documented rule, each account once, your own rank given, a refresh after a noclip, no browser-set counts, and a one-account board with nothing invented | `leaderboard.test.js` |
| The moving environment, levels, Rebirth/Noclip and crew still work; saving and loading still work | `all.test.js`, `functional-test.js`, `rebirth.test.js`, `crew.test.js`, `server-core.test.js` (the game served by the server) |
| Removing the Déjà Vu shop, the leaderboard, facilities or accounts keeps data and unrelated features | each entry's "switched off" checks and `revert-check.js` |

## Limits

- **Single-owner hook points.** Click power owns `derive:survey`'s reward. Upgrade categories lay out the Upgrades tab. Salvage scaling lays out the Facilities tab.
- **The server** is one process with one SQLite file. Rate limits are kept in memory.
- **The leaderboard cannot prove a noclip was played honestly.** It counts what its rules accept, once each. See [its entry](EXP-NOCLIP-LEADERBOARD.md).
- **No refunds.** Turning an experiment off or reverting it never refunds what was spent on its upgrades.
