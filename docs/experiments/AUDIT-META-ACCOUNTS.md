# Audit before the facilities, Déjà Vu, Noclip, account and leaderboard update

This is Phase A of the final specification update. It records how the game worked **before** the update, where each system lives, and what the update changes. Every experiment in the update has its own entry in this folder. The plan is at the end.

## Rollback point

| | |
| --- | --- |
| Baseline commit | `15e64b5` on `main`, the merge of PR #2. Its tree is identical to `71dc368`. |
| Branch | `claude/idle-game-design-system-7z9fuj`, restarted from `main` at `15e64b5` because PR #2 was already merged |
| Working tree at start | Clean. There were no uncommitted user changes. |
| Restore the game file | `git checkout 15e64b5 -- index.html` |
| Older baseline | `ebfa0c6`, the game before any experiment. See [BASELINE.md](BASELINE.md). |

## Hosting and infrastructure

| Question | Finding |
| --- | --- |
| Backend | **None.** The repository has `index.html`, `docs/` and `tools/`. There is no server code, no `package.json`, no database, no CI workflow and no hosting configuration. |
| Hosting | GitHub reports `has_pages: false`, so the repository is not served by GitHub Pages. The game has been published as a claude.ai artifact, which is a static page. Players can also open the file directly (`file://`). |
| Persistence | Browser `localStorage` only (details below). Nothing leaves the browser except a save the player exports by hand. |
| Accounts | None. There is no username, password, session or account identifier anywhere in the code. |
| Runtime available in this environment | Node.js 22.22 with the built-in `node:sqlite` module (SQLite, with `UNIQUE` constraints and transactions) and `crypto.scrypt`. Chromium through Playwright for browser tests. No cloud credentials, no domain and no hosting account. |

**Consequence.** A username and password form in the static page alone cannot authenticate anyone or share data between devices, because anything in the browser can be edited by its user. Real accounts, cloud saves and a shared leaderboard need a server that holds the account data and decides what is accepted.

**What this update builds.** A small server in `server/`, written for Node.js with no third-party dependencies. It serves `index.html` and a JSON API for accounts, saves and the leaderboard, backed by one SQLite file. It is implemented and tested in this environment against real HTTP and a real browser. **It is not deployed anywhere**, because this environment has no host to deploy to. Until someone deploys it behind HTTPS:

- The published artifact and copies opened from disk run as they do today, saving in the browser. They say plainly that accounts and the leaderboard are not available in that copy.
- Nothing pretends to be a global leaderboard.

Deployment needs, documented in `server/README.md`:

- a host that runs Node.js 22.13 or newer as a long-running process, with a persistent disk for the SQLite file;
- HTTPS in front of it;
- a few environment variables (port, data folder, proxy and cookie settings).

No secret key is needed: sessions are random tokens stored as hashes in the database. Nothing secret is committed.

## Existing systems

### Noclip (the rebirth)

- **Conditions.** `canNoclip()`: Level 3 or deeper (or the exit found on Level 5) and at least 1 Déjà Vu to gain.
- **Reward.** `dvPreview() = floor((salvage recovered this iteration ÷ 100,000)^0.3 × multiplier)`, where the multiplier is ×1.5 for the exit, the condition's Déjà Vu factor and ×1.1 for the ticket relic.
- **The completion function.** `noclip()` is the only place a noclip happens. The Noclip tab's button only opens a confirmation dialog (`confirmNoclip()`). Its "Noclip" button calls `noclip()`. Opening the tab or the dialog changes nothing.
- **The sequence in `noclip()`, in order:**
  1. returns `false` unless `canNoclip()`;
  2. computes the gain once;
  3. adds it to `S.dv` and `S.dvTotal`;
  4. `S.life.noclips += 1`, and `S.life.exits += 1` if the exit was found;
  5. `S.iteration += 1` and applies the chosen condition;
  6. replaces `S.run` with a fresh run;
  7. applies two Memories that set up the new run: Old Friends gives the radio and 3 wanderers, and Habitual Hoarding gives 10 carts, 5 benches and 2 beacons;
  8. clears the log, writes two log lines, resets the camera and sound, shows a banner;
  9. saves synchronously (`save()`), then returns `true`.
- **Why it cannot double up.** `noclip()` is synchronous, so nothing can interleave with it.
  - A second call right after the first fails, because the new run is on Level 0 with nothing to gain.
  - A reload right after a noclip loads the saved post-noclip state.
  - If the browser blocked the save, the reload loads the last save from before the noclip. The noclip simply has not happened yet, so nothing is awarded twice.
- **The noclip count.**
  - `S.life.noclips` is persistent: it lives in the save outside `run`, survives the run reset, and is restored by `sanitizeState()`.
  - It changes only in `noclip()`. Loading a save never touches it.
  - Before this update it was shown only in Archive → Statistics ("Noclips / exits").
  - The game has no separate "attempted" event. The counted event is a completed `noclip()` that returned `true`, including going through the exit.

### Déjà Vu and the existing shop

- **Earning.** Déjà Vu is earned only by `noclip()`. `S.dv` is the spendable balance and `S.dvTotal` is everything ever earned.
- **Production bonus.** Every point ever earned adds +1% to salvage and water production and to survey salvage. Spending does not reduce it.
- **The shop already exists.** It is the "Memories" section of the Noclip tab: 11 permanent upgrades bought with Déjà Vu.
  - 10 are one-time purchases, from Muscle Memory at 1 Déjà Vu to Procurement Notes at 10.
  - One is repeatable: Recurrence, ×1.25 production per rank, costing `8 × 2^rank`.
  - Bought ranks are stored in `S.memories` (id → rank). The save sanitizer clamps one-time Memories to rank 1.
- **Cost of the full set.** Typical first exits earn about 210–290 Déjà Vu. The ten one-time Memories cost 45 in total, so after one exit the shop has little left to offer except Recurrence.
- **This update improves the existing shop. It adds no second shop and no second currency.**

### Facilities

- **What exists.** 11 facilities in `FACILITIES`:
  - seven salvage machines, from the Salvage Cart (0.2/s) to the Fold Engine (7,000/s);
  - the Humidity Condenser (almond water), the Survey Beacon (automatic surveys), the Acoustic Dampener (absorbs noise) and the Resonance Array (Echoes).
- **Prices.** `facilityCost(f, owned, n) = cost × growth^owned × (growth^n − 1) ÷ (growth − 1)`. Growth is 1.15 for every salvage machine, and 1.16–1.2 for the others. `maxAffordable()` finds the largest affordable quantity for the MAX buy mode.
- **Unlock rules.**
  - Level: the Annex for the vat and dampener, the Ducts for the foundry and boiler, the Poolrooms for the array, the Night Office for the switchboard, the Long Hallway for the Fold Engine.
  - Previous facilities: 3 carts for the bench, 5 foundries for the boiler.
  - Others: rooms mapped (40 for the beacon), and finding almond water (condenser).
  - **No facility has a crew requirement.** `reqMet()` supports a `crew` field, but only the crew experiment's staffing requisitions use it, and those are listed in the Crew tab, not the Facilities shop.
- **Production in the original game does not need crew.** Each machine produces its full output on its own. Scavengers add +5% facility salvage each, as a bonus.
- **Where crew became a requirement.** `EXP-CREW-AUTOMATION` (on by default since PR #2) added a staffing rule:
  - A salvage machine, condenser, beacon or array with no crew member on it works at **25%** of its output.
  - You run 10 machines yourself, and each crew member on the matching job runs 4 more.
  - **This violates the new firm requirement**, so `EXP-FACILITY-INDEPENDENCE` removes it.
- **What the Facilities tab shows today.**
  - For each machine: its output each and in total, its noise, the price for the chosen quantity, and the time until you can afford it.
  - Only the *next* locked facility is shown, by name and requirement, without saying what it produces.
  - It does not show the gain from buying one more, or the total after buying.

### Crew

- **The jobs.** Scavenger: +0.4 salvage/s and +5% facility salvage each. Cartographer: automatic surveys. Dowser: water. Watcher: absorbs noise. Archivist: Echoes.
- **Hiring.** Wanderers are hired for almond water once the Shortwave Radio is installed. Crew efficiency upgrades multiply every job.
- **Expeditions** take idle crew away for a while.
- **What the crew experiment adds.** Crew and shift upgrades are listed in the Crew tab, plus three staffing requisitions. Its staffing rule is the part this update removes.

### Click power

`EXP-CLICK-POWER` defines how much a survey by hand recovers: hand tools, the Survey Power breakdown and Work Gloves. This update does not change it.

### Persistence

| Storage key | Contents |
| --- | --- |
| `the-hum.save` | The save: JSON, format version 1. Written every 15 seconds, on noclip, on leaving the page, and on demand. |
| `the-hum.save.backup` | A rotating copy, refreshed every 5 minutes and on manual saves |
| `the-hum.save.unreadable-<time>` | A save that could not be read. It is set aside, never deleted. |
| `the-hum.experiments` | Developer switches for experiments. Not part of the save. |
| `the-hum.dev` | Developer menu settings. Not part of the save. |

- **Validation.** `sanitizeState()` validates every field of an untrusted save.
- **Experiment data** lives in `ext.<namespace>` (whole save) and `run.ext.<namespace>` (this iteration). The namespaces of experiments that are absent are kept untouched.
- **Removed content.** Upgrade, research, achievement and document ids the build does not know are kept in `dormant`.
- **Export and import.** A save exports as `HUM1.` plus base64 text, and imports after a confirmation.
- **Size.** A developed save is typically 10–40 KB. The log is capped at 80 entries.

## State classification

| Class | Where it lives | Examples | Noclip |
| --- | --- | --- | --- |
| **Run state** (this iteration) | `S.run` | Salvage, almond water, sanity, attention, level and rooms, facilities owned, upgrades, crew and jobs, expeditions under way, doctrine, autobuy choices, run statistics, `run.ext` | Replaced by a fresh run |
| **Persistent game state** | `S` outside `run` | Iteration, conditions, Déjà Vu balance and lifetime total, Memories, Echoes, research, relics, achievements, archive documents, lifetime statistics (including `life.noclips`, `life.exits` and `life.salvage`), settings, `ext` | Kept |
| **Starting bonuses** | Set up by `noclip()` after the reset | Old Friends, Habitual Hoarding, and this update's new starting-salvage and starting-crew levels | Applied once, inside `noclip()`, to the new run only. Never applied on load. |
| **Browser settings** | Own storage keys | Experiment switches, developer menu, and the new "play offline" choice | Not in the save |
| **Account state** (new, on the server) | SQLite | Account and username, password hash, sessions, the cloud copy of the save and its earlier revisions, recorded noclips | Not touched by a noclip |

For the leaderboard, the server, not the save, is the authority: it counts the noclips it has recorded. The save's `life.noclips` stays the player's own lifetime count, which includes noclips made before signing in or without a server.

## The Noclip sequence after this update

Each step maps to the specification.

1. **Validate.** `canNoclip()`. Unchanged.
2. **Calculate the reward.** `dvPreview()`, once. Unchanged.
3. **Award Déjà Vu once.** `S.dv` and `S.dvTotal`. Unchanged.
4. **Count the noclip once.** `S.life.noclips`. Unchanged.
5. **Reset run state only.** `S.run = defaultRun()`. Unchanged.
6. **Keep permanent data.** Unchanged: nothing outside `S.run` is reset.
7. **Apply starting bonuses once.** The existing Memories, then a new hook `noclip:newRun` for the Déjà Vu shop's starting bonuses. Both run only here.
8. **Persist.** `save()`. Unchanged. A new hook `noclip:done` runs after the save.
9. **Refresh the interface and leaderboard.** The interface rebuilds as before. If signed in to a server, the noclip is queued to be reported. The server records each completion once, using its own clock and a unique key of account, save lineage and iteration. The leaderboard view refreshes when the server confirms it.

**Retries and reloads.**
- A retried report is recognised by its key and counted once.
- A reload after a noclip finds the saved post-noclip state, with nothing left to award.
- If the browser blocked the save, the noclip is not persisted and can be completed again. The server sees the same iteration of the same save again and does not count it twice.

**Developer tools.** Saves changed with them carry the existing `ext.dev` mark.
- Their noclips are not reported.
- They are not uploaded over the account's cloud save.
- The server also rejects reports that are marked this way.

## Plan

| Phase | Experiment | What it does |
| --- | --- | --- |
| A | — | This audit. Hook points and code slots for the new experiments (`EXP-CORE`, no behaviour change). |
| B | `EXP-FACILITY-INDEPENDENCE` | Switches off the crew staffing rule: every machine runs at full output with no crew. Needs a small switch added to `EXP-CREW-AUTOMATION`, in a commit of its own. |
| B | `EXP-FACILITY-SALVAGE-SCALING` | Facilities tab organised around salvage. Each row shows: owned, the gain from buying, the total after buying and the next price, with units. Every locked facility shows what it would add and its requirement. Price curves are set per machine. |
| C | `EXP-NOCLIP-STATISTICS` | The noclip count in the header, and a records panel in the Noclip tab |
| C | `EXP-DEJA-VU-SHOP` | The Memories section becomes the Déjà Vu shop, a sub-tab of the Noclip tab. Each upgrade shows its level, current and next effect, and next cost. New leveled upgrades: starting salvage, a facility price discount, and more starting crew. |
| D | `EXP-ACCOUNT-AUTH` | Server: accounts, scrypt password hashes, sessions, rate limits. Client: finds the server and restores the session. |
| D | `EXP-ACCOUNT-UI` | Sign-in screen, header account chip, Settings → Account |
| D | `EXP-CLOUD-SAVE` | Server: one save per account, with revisions and earlier copies. Client: sync with conflict checks, and safe migration of existing local progress. |
| E | `EXP-NOCLIP-LEADERBOARD` | Server: records each noclip once and ranks accounts. Client: reports noclips and shows the ranking in Archive → Leaderboard. |
| F–G | — | Interface checks at several viewport sizes, regression, rollback proofs, registry |

Two adjustments to the specification's order:
- **No top-level tab is added for the leaderboard.** It is a sub-tab of the Archive, which is always visible and already holds records and statistics. A top-level tab would add an unnecessary tab, which the specification asks to avoid.
- **Phase F work is spread across the phases.** Each experiment brings its own interface, and Phase F checks them together.
