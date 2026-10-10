# The Hum

A Backrooms survey-and-extraction idle game in a single HTML file.

You noclipped into Level 0. A survey terminal boots up and says *welcome back*. Survey the rooms by hand, recovering salvage. Build facilities that make every survey recover more, until one press of the button is worth an absurd fortune. Recruit specialists who keep the work going while you are away. Go deeper, and something in the corridor starts to watch you.

## Play

Open `index.html` in a modern browser. There is nothing to install, it needs no network connection, and it loads no external files.

Accounts, cloud saves and the noclip leaderboard need the game's server: `npm start`, or the container image. See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) and [`server/README.md`](server/README.md).

The server is implemented, tested and packaged, but **not deployed anywhere yet**. Opened from a file or any static page, the game plays fully, saves in the browser, and says plainly that those features are not available in that copy.

| Key | Action |
| --- | --- |
| `S` | Survey the next room: the same survey as the button, with the same rules |
| `D` | Document the current anomaly |
| `W` | Drink almond water |
| `L` | Kill the lights |
| `M` | Mute |
| `1`–`8` | Switch tabs (`9` opens the Dev tab when the developer tools are on) |
| `Esc` | Close a dialog |

Everything also works with the mouse or touch, and every control is reachable by keyboard.

## How it plays

**Survey power is the heart of the game.**
- A fresh game recovers **+1 salvage per survey**, and nothing happens on its own.
- Survey power = base × facility multiplier × survey upgrades × level depth × global bonuses × Survey Drills.
- The line under the Survey button shows it, and selecting the line opens the full breakdown.

**Facilities make your surveys stronger.**
- Fifteen facilities open in waves, one wave per level. The Facilities tab shows the next wave and the level that opens it.
- Salvage facilities add to the facility multiplier. The first Salvage Cart takes a survey from +1 to +1.25. Each has three ×2 tiers, installed from its row at 10, 25 and 50 owned.
- Support equipment improves something else: rooms per survey, almond water, Echoes, or noise absorption.
- **No facility produces anything on its own.** Purchases come in ×1, ×10, ×25 and MAX, priced as an exact geometric sum.

**Specialists are the only passive production.** There are five, one of each, recruited once with salvage and upgraded level by level:

| Specialist | Work |
| --- | --- |
| Scavenger | passive salvage |
| Cartographer | automatic rooms |
| Dowser | almond water |
| Watcher | noise absorption, and earlier warning of entities |
| Archivist | Echoes |

- Each works the moment you recruit them. The Crew tab shows what they do now, what the next level adds, its price, and the kit they carry: a new piece at levels 5, 15, 30 and 45.
- Survey power and passive salvage never feed each other.

**Your crew in the corridor.**
- The specialists you have recruited can be seen at work in the camera feed, two at a time, in each level's rooms and junctions.
- Survey and you walk past them; they follow, or come out of a doorway ahead.
- Every few seconds a short line sums up what one of them has just brought in.
- Now and then something small happens ahead and passes on its own: a light fails, a door opens, footsteps cross the water, the Watcher goes to check a sound.
- All of it is only drawing. What anyone produces is the same whether you watch or not.

**45 requisitions:** hand tools, survey upgrades, room mapping, sanity, crew, risk, missions, facility boosts and automation. Survey Drills is repeatable.

**Automation**, bought with salvage from Level 2:
- **The Dispatch Protocol.** Each mission gets an Auto-repeat switch, and goes again when it returns, paid as usual.
- **The Procurement Controller.** Auto-upgrade under each specialist's button, Auto-buy and Auto-tier on facilities, and Auto-buy on requisitions. One buyer always buys the cheapest switched-on target first.

**Missions (6):** timed trips that need a specialist at a given level and almond water. They bring back salvage (a share of the Scavenger's work), water, Echoes and sometimes relics, and they keep running while you are away.

**Research (22 projects):** paid once with Echoes, and finished on the game clock: progress keeps going through reloads and time away. One project runs at a time, and everything researched is kept forever. Three doctrines can each be adopted once researched, one per iteration. Deep Survey Theory, Hallway Cartography and Signal Theory are repeatable, each with its own rank.

**Entities.**
- While you survey, something appears in the corridor ahead: a warning first, then danger.
- Survey into it and it reaches you. That costs a share of the salvage you hold, capped, and some sanity, once, with a jump scare. Stand still and it leaves.
- Attention makes them come more often and hit harder.
- They never come in a background tab, while you are away, or after a reload.
- With reduced motion or effects switched off they stay unmistakable: an alert, a label in the camera feed and the figure itself.

**Attention, incidents and sanity.**
- Facilities and footsteps make noise, and attention heads toward `100 × noise ÷ (noise + absorption)`.
- At 75 and above, incidents can happen, each announced ahead of time. Killing the lights stops one.
- Low sanity costs salvage per survey, makes Echo finds likelier, and makes the terminal unreliable. At zero you black out.

**Anomalies:** document them in the camera feed for Echoes. Some are hallucinations.

**Levels.**
- Six finite levels, from the Lobby to the Long Hallway, each with its own look and a deeper depth multiplier.
- The last room of the Long Hallway completes the survey and opens **Level FUN**: endless, keeping everything you have, with a party look and a floor every 200,000 rooms (50,000 with the update's late content switched off).

**Noclip (prestige).**
- Locked until the survey is complete, then optional for as long as you stay in Level FUN. Staying raises the reward.
- A noclip gives Déjà Vu for the Déjà Vu shop, and +1% to salvage per point ever earned. From iteration 2 you can choose conditions for the next run.
- The shop is a long-term goal: a first run buys a few Memories, and everything with a limit costs about a hundred first runs' worth.

**Also:** 12 relics, 47 achievements and 40 archive documents.

## Saving and time away

**Saving.**
- The game autosaves to `localStorage` every 15 seconds, when the tab is hidden and when the page closes.
- Saves are versioned (format 2) and validated field by field. A save that cannot be read is copied aside, never deleted, and the game falls back to a rotating backup.
- **Settings → Export / Import** moves a save between browsers.

**Saves from before v2** are migrated once, on load or import, or when downloaded from an account. You keep:
- facilities, upgrades, research, Memories, relics, achievements and Déjà Vu;
- a completed survey, which arrives in Level FUN.

Old wanderers become specialists, up to a level cap for the level you are on, with the hiring water refunded for any beyond it. The untouched old save is kept in the browser under `the-hum.save.v1`.

**Time away** is credited for up to 8 hours. Research adds 8 more, and Long Sleep adds 16. The specialists keep working, and missions and research keep running.

Nothing bad happens while you are away: no incidents, anomalies or entities, no sanity drain. A report shows what came in.

## Pacing

Measured with the deterministic balance bot playing the real game code: medians of 3 seeds, in minutes (`node tools/balance-report.js "before=@c903362" "now="`). The bot plays a patient player: it saves for a requisition worth up to 3 minutes of income.

| Player | Iteration | Reaches Level 4 | Night Office | Long Hallway | Survey complete | Déjà Vu |
| --- | --- | --- | --- | --- | --- | --- |
| Active (2 surveys/s) | 1 | 44.5 | 15.2 | 13.0 | 72.7 | 154 |
| Active | 2 | 12.7 | 4.9 | 5.2 | 22.9 | 278 |
| Idle (0.3 surveys/s) | 1 | 109.2 | 16.8 | 21.2 | 145.0 | 127 |

- Before update 2.1, the same active player spent 18.9 minutes in the Night Office and 19.2 in the Long Hallway, and completed the survey at 81.8.
- In Levels 4 and 5 an active player never waits more than about 1.5 minutes between two purchases, and nothing new costs them more than 12 minutes of income when it goes on sale.
- The full report, with both automations, modest prestige and Level FUN, is in [UPDATE-2.1.md](docs/experiments/UPDATE-2.1.md).

## Development tools

These need Node.js and Playwright with a Chromium build. The game itself needs neither.

**`node tools/run-tests.js`** runs every suite against the real page in headless Chromium. The server suites start the real game server with temporary databases.
- `functional-test.js` covers the core game with every experiment off: surveying and purchases, specialists and missions, incidents and the lights, sanity, anomalies, levels, completion and noclip, saving and time away, damaged and hostile saves, export and import, reset, keys and a 24-hour catch-up.
- One suite for each v2 system:
  - `economy`: +1 per survey, facilities as the click multiplier, no passive salvage without the Scavenger;
  - `facilities`: waves, tiers, and stable rows under rapid surveying;
  - `specialists`: the Crew tab and missions;
  - `research`: timed research, including reloads and time away;
  - `encounters`: entities;
  - `fun`: completion and Level FUN;
  - `migration`: saves written by the version-1 build.
- One suite per remaining experiment, one for the server core, a noclip suite, a whole-game suite, and an interface suite at four screen sizes.

**Other tools:**
- `node tools/balance-bot.js <surveys/s> <document chance> <max minutes> [iterations]` plays the game and prints a timeline and milestones. It takes `--query`, `--seed`, `--file`, `--every`, `--fun`, `--reckless`, `--tune`, `--save`, `--auto`, `--buys` and `--json`, and is deterministic.
- `node tools/balance-report.js "before=@<revision>" "now="` runs the bot over seeds and profiles against any builds and prints medians: level times, purchases, price ÷ income of what goes on sale, Déjà Vu, Level FUN.
- `node tools/equivalence-check.js` checks that this build with every update-2.1 experiment off plays exactly as `c903362`, at 96 checkpoints of 8 seeded sessions.
- `node tools/pacing-compare.js "now=" "other=@<revision>"` compares pacing over seeds.
- `npm start` runs the game server on <http://127.0.0.1:8080> (Node.js 22.13 or newer).
- `docker build -t the-hum .` builds the server image. [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) covers deploying it.

Adding `#debug` to the URL exposes the simulation as `window.HUM`. Adding `?exp=none` or `?exp=-EXP-ID` sets experiment flags for one page load.

## Experiments

Changes made since the original game are recorded in [`docs/experiments/`](docs/experiments/README.md). Each entry says how to switch the change off, revert it and restore what came before.

- **v2:** the redesign of the economy, specialists, research, entities and Level FUN is [V2-REDESIGN.md](docs/experiments/V2-REDESIGN.md). It folded five experiments into the core game.
- **Update 2.1:** twelve experiments, each with its own flag, commits and suite. They cover the visible crew, room variety, production feedback, ambient events, crew equipment, mission Auto-repeat, the Procurement Controller, the Level 4 and 5 facilities, requisitions and research, the late balance and the Déjà Vu prices. [UPDATE-2.1.md](docs/experiments/UPDATE-2.1.md) has the rollback matrix, how to switch each one off, the balance report and the tests.
- **Still switchable from before:** ten experiments keep their own flags:
  - upgrade categories;
  - the resource ledger;
  - the attention audit;
  - developer tools;
  - noclip statistics;
  - the Déjà Vu shop;
  - accounts and their interface;
  - cloud saves;
  - the leaderboard.

## Known limitations

- **The server is not deployed.** Accounts, cloud saves and the leaderboard work only once someone deploys it behind HTTPS. [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) has the steps and what is still needed.
- **The leaderboard cannot prove a noclip was played honestly.** The game runs in the browser. The server counts each reported noclip once, never takes a total from the browser, and limits how often an account can record one.
- Without an account, saves live in one browser's local storage.
- Sound is synthesised with the Web Audio API and starts after your first click or key press.
- Balance was checked with scripted players, not human playtesters.
- Automated testing ran in Chromium only.
