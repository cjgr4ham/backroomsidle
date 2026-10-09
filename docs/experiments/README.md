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
| [PRODUCTION.md](PRODUCTION.md) | How salvage is produced, and where each figure is counted once |
| [server/README.md](../../server/README.md) | The game server: deployment, environment variables, backups and the security model |

## Scope

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

## The experiments

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
- **`EXP-FACILITY-INDEPENDENCE`** answers a switch that `EXP-CREW-AUTOMATION` asks (`crew:staffing`).
  - Without the crew experiment there is nothing to switch, and facilities need no crew anyway.
  - Without independence, the crew experiment's staffing rule applies again.
- **Optional cooperation.** Each of these works without the other:
  - the Records panel shows a leaderboard line;
  - Settings → Account shows cloud-save and leaderboard rows;
  - the Déjà Vu shop's discount and the per-machine price curves compose in `facility:price`;
  - the ledger and the developer menu show staffing figures when staffing is on.

## Four different operations

These are not interchangeable.

| Operation | What it does | How |
| --- | --- | --- |
| **Turn an experiment off** | The original behaviour returns at once. The experiment's saved data is kept. | **Browser:** Dev tab → Experiments, `?exp=-EXP-ID` for one page load, or `HUM.Exp.set('EXP-ID', false)` with `#debug`. **Server:** `HUM_DISABLE=EXP-ID`. Its routes disappear, and its tables and rows stay. |
| **Restore previous settings** | Every experiment returns to its default. | Dev tab → "Reset all experiments to their defaults", or `HUM.Exp.reset()` |
| **Revert its code** | Removes the experiment from the game permanently. | `git revert` its commits, newest first, from the table above. Revert dependents first, or accept that they become inactive. Revert `EXP-CORE` last. **Never use a blanket hard reset.** **Server data is never dropped by a revert:** take a backup of `DATA_DIR/the-hum.db` before deploying a rollback, and the tables of a removed feature simply stay unused. |
| **Restore a prior save** | Puts back a save from earlier. | Settings → Import. While signed in: Settings → Account → an earlier version or a kept copy. The game never does this automatically, so progress made after an update is never erased behind your back. |

**Rolling back persistent account data means restoring compatible behaviour while keeping the data.** No rollback in this registry deletes:
- database rows;
- the save in the browser;
- the account's save or its earlier versions;
- recorded noclips;
- Déjà Vu shop levels.

## Proof of reversibility

`node tools/revert-check.js --all` reverts each experiment on its own in a throwaway clone. It then checks:
- that its code slots are empty;
- that the test files, server files and registry entry its commits added are gone;
- that every remaining suite and the equivalence check pass.

`--all` also takes back every experiment and core change outside `docs/` and `tools/` together. It checks that `index.html` is byte-identical to the original game and that no server files remain.

Results of the last run: *the final run is in progress; its results will be recorded here.*

**Other proofs:**
- **Equivalence check.** `tools/equivalence-check.js` plays 8 seeded sessions in the original build and in this build with every experiment off. The sessions include noclips, offline time and save round trips. The full state and every derived rate match at all 96 checkpoints.
- **Rebirth suite.** `tools/tests/rebirth.test.js` requires the same noclip with every experiment off and every experiment on. It still passes, because nothing a player has not bought in the Déjà Vu shop changes a noclip.

## Save compatibility

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

## Tests and tools

| Command | What it does |
| --- | --- |
| `node tools/run-tests.js` | Runs every suite: the original functional test (55 checks) with every experiment off, one suite per experiment, each with experiments on and off, and an interface suite (`viewports.test.js`) that opens every tab and sub-tab at four screen sizes, from disk and served by the server while signed in. The server suites start the real server on free ports with temporary databases. |
| `node tools/equivalence-check.js` | The all-off check against the original build |
| `node tools/revert-check.js [--all]` | The reversibility proof |
| `node tools/balance-bot.js` and `node tools/pacing-compare.js` | Deterministic pacing measurements. Builds can be named as `@revision`, `?flags` or `file?flags`. |
| `npm start` | Runs the game server; see `server/README.md` |

## Combined effect on pacing

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

## Required test cases (final specification, section 10)

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
