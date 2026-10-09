# The Hum

A Backrooms survey-and-extraction idle game in a single HTML file.

You noclipped into Level 0. A survey terminal boots up and says *welcome back*. Map the rooms, strip them for salvage, take in other lost people, and build an operation inside a place that should not be possible to industrialise. The more you build, the louder it gets. The louder it gets, the more something notices.

## Play

Open `index.html` in a modern browser. There is nothing to install, it needs no network connection, and it loads no external files: HTML, CSS and JavaScript are all in the one file.

| Key | Action |
| --- | --- |
| `S` | Survey the next room |
| `D` | Document the current anomaly |
| `W` | Drink almond water |
| `L` | Kill the lights |
| `M` | Mute |
| `1`–`8` | Switch tabs (`9` opens the Dev tab when the developer tools are on) |
| `Esc` | Close a dialog |

Everything also works with the mouse or touch, and every control is reachable by keyboard.

## Experimental update

The game now carries a set of independent, switchable experiments. Each has its own flag, its own code slot, its own commits, its own tests and a registry entry that says how to turn it off, revert it and restore the original behaviour. All are on by default. With every one switched off, the game behaves exactly as it did before, which is checked against the original build.

- **Click power.** A Survey power line under the Survey button shows what one survey pays and what the next upgrade changes. Work Gloves is the first upgrade. Hand tools, the Echo Sounder and Survey Drills follow.
- **Crew run the machines.** Each crew member keeps several machines of their job at full speed, and a machine nobody runs works at 25%. The Crew tab shows who runs what and lists the crew and shift upgrades. Existing saves keep their production.
- **Organization.** The Upgrades tab is grouped by what each requisition does. Facility tiers are installed from each facility's row. Archive → Resources explains every resource and meter; select a resource in the header to open it.
- **Attention.** An audit found the formula working as designed. Surveys you make by hand now make a little footstep noise that fades, so the meter responds from the start. The meters say what Attention and Sanity each mean.
- **Developer tools.** Opt in from Settings → Developer tools, or with `#dev` in the address. You get infinite resources, resource injection, level, research and crew controls, events, time, live figures and the experiment switches. This is a testing convenience, not a security boundary.

No levels were added, and Noclip is unchanged. See [`docs/experiments/README.md`](docs/experiments/README.md) for the registry, the four ways to undo a change, and the proofs.

## What is in it

- **Surveying.** The main action. Each survey maps rooms and recovers salvage. Surveys by hand can also turn up almond water and Echoes. Upgrades turn a survey into a share of your whole operation's output, so it stays useful after automation.
- **Six levels.** The Lobby, The Annex, The Ducts, The Poolrooms, The Night Office and The Long Hallway, each with its own look in the camera feed. Map enough rooms on a level to find the way down. The exit is at the end of Level 5.
- **11 facilities** that produce salvage, almond water, Echoes or automatic surveys, or absorb noise. Each has three ×2 tier upgrades. Purchases come in ×1, ×10, ×25 and MAX, priced as an exact geometric sum.
- **29 requisitions** across survey, sanity, crew, risk, expedition and facility upgrades, some with real trade-offs (Unpaid Overtime doubles output and raises noise). The experiments add 7 survey upgrades and 3 staffing requisitions.
- **Crew.** Wanderers cost almond water and work one of five jobs: Scavenger, Cartographer, Dowser, Watcher or Archivist.
- **Attention.** Facilities make noise; dampeners, watchers and research absorb it. Attention settles at `100 × noise ÷ (noise + absorption)`, and the meter shows where it is heading. Attention multiplies Echo gains but drains sanity. At 75 and above, incidents can happen, each announced several seconds ahead. Killing the lights halts production for 15 seconds and makes the threat lose interest.
- **Sanity.** Low sanity makes surveys less productive but turns up Echoes more often. It also makes the terminal unreliable (messages marked UNVERIFIED are hallucinations) and, near the bottom, shows anomalies that are not there. At zero you black out for a short time.
- **Anomalies.** A door that was not there, a light that is on and off, someone at the end of the hall. Document them in the camera feed for Echoes.
- **Research (16 projects)** bought with Echoes and kept forever, including three mutually exclusive doctrines chosen once per iteration and a repeatable sink.
- **Expeditions (6)** that send idle crew deep for salvage, Echoes and relics. They keep running while you are away, and each card shows its exact odds.
- **12 relics, 43 achievements and 38 archive documents.** The documents carry the story, which builds toward what the exit actually is.
- **Noclip (prestige).** From Level 3 you can start over for Déjà Vu, which buys permanent Memories and adds +1% production per point ever earned. From iteration 2 you can choose conditions that change the next iteration's rules.

## Saving and time away

- The game autosaves to `localStorage` every 15 seconds, when the tab is hidden and when the page closes. The header shows when it last saved.
- Saves are versioned and validated field by field on load. A save that cannot be read is copied aside under its own key, never deleted, and the game falls back to a rotating backup.
- **Settings → Export / Import** moves a save between browsers as a text string. **Erase** asks for confirmation.
- **Offline progress** is credited at full rate for facilities, crew, automatic surveys and expeditions, up to 8 hours. Research adds 8 hours and a Memory adds 16 more. Nothing bad happens while you are away: no incidents, no anomalies, no sanity drain, and a pending threat is called off. A report shows what you earned.

## Pacing

Timings are measured with the deterministic balance bot (below) playing the real game code: medians of 7 seeds, not estimates.

| | Level 1 | Level 3 (noclip opens) | Level 5 | Exit |
| --- | --- | --- | --- | --- |
| Active player, 1st iteration (3 surveys/s) | ~3 min | ~19 min | ~50 min | ~74 min |
| Casual player, 1st iteration (1 survey/s, documents half of anomalies) | ~7 min | ~30 min | ~65 min | ~92 min |
| Active player, 2nd iteration | <1 min | ~4 min | ~15 min | ~23 min |

These are with every experiment on. The original game (`?exp=none`) took about 3.4, 22, 55 and 80 minutes for the active player. Per-experiment figures are in each registry entry.

Room counts, not salvage, set the pace of later iterations, so prestige speeds runs up without collapsing them to nothing.

## Development tools

These need Node.js and Playwright with a Chromium build. The game itself needs neither.

- `node tools/run-tests.js` runs every suite against the real page in headless Chromium: 250 checks.
  - The original 55 functional checks run with every experiment off. They cover purchases and bulk pricing, crew bookkeeping, expeditions and hazards, incidents and the light switch, blackouts, real and hallucinated anomalies, levels, the noclip flow, save round-trips, offline credit and its cap, corrupted and hostile saves, export and import, erasing, keyboard shortcuts and a 24-hour catch-up.
  - One suite per experiment.
  - A Noclip regression suite, with every experiment off and on.
  - A whole-game regression with every experiment on, starting from a save made by the original build.
- `node tools/equivalence-check.js` checks that, with every experiment off, the game matches the original build at 96 checkpoints over 8 seeded sessions.
- `node tools/revert-check.js --all` proves each experiment can be reverted alone in a throwaway clone. Reverting everything restores the original `index.html` byte for byte.
- `node tools/balance-bot.js <surveys/s> <document chance> <max minutes> [iterations]` plays the game with a simple strategy and prints a timeline and milestone times. It takes `--query=?exp=…`, `--seed`, `--file`, `--crew` and `--json`, and is deterministic.
- `node tools/pacing-compare.js "original=?exp=none" "now=?exp=all"` compares pacing over seeds.

Adding `#debug` to the URL exposes the simulation as `window.HUM` for these tools. Adding `?exp=none`, `?exp=all` or `?exp=EXP-A,-EXP-B` sets experiment flags for one page load.

## Known limitations

- Saves live in one browser's local storage. Private windows or blocked site data mean no saving; the header says so, and Export still works.
- Sound is synthesised with the Web Audio API and starts only after your first click or key press.
- Balance has been checked with scripted players, not human playtesters.
- The published artifact drops query strings, so `?exp=` does not work there. Use the Dev tab to switch experiments.
- Automated testing ran in Chromium only. Firefox and Safari have not been tested.
