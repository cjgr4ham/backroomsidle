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
- Eleven facilities open in waves, one wave per level. The Facilities tab shows the next wave and the level that opens it.
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

- Each works the moment you recruit them. The Crew tab shows what they do now, what the next level adds, and its price.
- Survey power and passive salvage never feed each other.

**35 requisitions:** hand tools, survey upgrades, room mapping, sanity, crew, risk, missions and facility boosts. Survey Drills is repeatable.

**Missions (6):** timed trips that need a specialist at a given level and almond water. They bring back salvage (a share of the Scavenger's work), water, Echoes and sometimes relics, and they keep running while you are away.

**Research (16 projects):** paid once with Echoes, and finished on the game clock: progress keeps going through reloads and time away. One project runs at a time, and everything researched is kept forever. Three doctrines can each be adopted once researched, one per iteration, and Deep Survey Theory is repeatable.

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
- The last room of the Long Hallway completes the survey and opens **Level FUN**: endless, keeping everything you have, with a party look and a floor every 50,000 rooms.

**Noclip (prestige).**
- Locked until the survey is complete, then optional for as long as you stay in Level FUN. Staying raises the reward.
- A noclip gives Déjà Vu for the Déjà Vu shop, and +1% to salvage per point ever earned. From iteration 2 you can choose conditions for the next run.

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

Measured with the deterministic balance bot playing the real game code: medians of 7 seeds (`node tools/pacing-compare.js --seeds=7 --runs=2 "v2="`), in minutes.

| Player | Iteration | Level 1 | Level 2 | Level 3 | Level 4 | Level 5 | Survey complete | Déjà Vu | Salvage by hand | Passive (Scavenger) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Active (3 surveys/s) | 1 | 3.7 | 10.3 | 19.5 | 36.4 | 56.2 | 73.6 | 192 | 52% | 37% |
| Active | 2 | 0.4 | 0.9 | 3.1 | 6.5 | 11.9 | 18.3 | 427 | 62% | 28% |
| Casual (1 survey/s, documents half of anomalies) | 1 | 10.3 | 24.1 | 42.5 | 68.9 | 91.5 | 113 | 160 | 30% | 53% |
| Casual | 2 | 0.9 | 2.1 | 5.2 | 9.9 | 16.5 | 24.0 | 323 | 47% | 39% |

- The rest of the salvage comes from missions and documented anomalies.
- The bot stands still for every entity: it met 57 in the active first iteration and was caught by none.
- In the active first iteration, survey power grows from +1 to about +4×10⁸ shortly before the survey is complete, and to about +9×10⁸ once in Level FUN.

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
- `node tools/balance-bot.js <surveys/s> <document chance> <max minutes> [iterations]` plays the game and prints a timeline and milestones. It takes `--query`, `--seed`, `--file`, `--every`, `--fun`, `--reckless`, `--tune` and `--json`, and is deterministic.
- `node tools/pacing-compare.js "now=" "other=@<revision>"` compares pacing over seeds.
- `npm start` runs the game server on <http://127.0.0.1:8080> (Node.js 22.13 or newer).
- `docker build -t the-hum .` builds the server image. [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) covers deploying it.

Adding `#debug` to the URL exposes the simulation as `window.HUM`. Adding `?exp=none` or `?exp=-EXP-ID` sets experiment flags for one page load.

## Experiments

Changes made since the original game are recorded in [`docs/experiments/`](docs/experiments/README.md). Each entry says how to switch the change off, revert it and restore what came before.

- **v2:** the redesign of the economy, specialists, research, entities and Level FUN is [V2-REDESIGN.md](docs/experiments/V2-REDESIGN.md). It folded five experiments into the core game.
- **Still switchable:** ten experiments keep their own flags:
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
