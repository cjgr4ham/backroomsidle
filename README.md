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
| `1`–`8` | Switch tabs |
| `Esc` | Close a dialog |

Everything also works with the mouse or touch, and every control is reachable by keyboard.

## What is in it

- **Surveying.** The main action. Each survey maps rooms and recovers salvage. Surveys by hand can also turn up almond water and Echoes. Upgrades turn a survey into a share of your whole operation's output, so it stays useful after automation.
- **Six levels.** The Lobby, The Annex, The Ducts, The Poolrooms, The Night Office and The Long Hallway, each with its own look in the camera feed. Map enough rooms on a level to find the way down. The exit is at the end of Level 5.
- **11 facilities** that produce salvage, almond water, Echoes or automatic surveys, or absorb noise. Each has three ×2 tier upgrades. Purchases come in ×1, ×10, ×25 and MAX, priced as an exact geometric sum.
- **29 requisitions** across survey, sanity, crew, risk, expedition and facility upgrades, some with real trade-offs (Unpaid Overtime doubles output and raises noise).
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

Timings are measured with the balance bot (below) playing the real game code, not estimated:

| | Level 1 | Level 3 (noclip opens) | Level 5 | Exit |
| --- | --- | --- | --- | --- |
| Active player, 1st iteration (3 surveys/s) | ~4 min | ~23 min | ~54 min | ~79 min |
| Casual player, 1st iteration (1 survey/s, documents 40% of anomalies) | ~9 min | ~34 min | ~68 min | ~95 min |
| Active player, 2nd iteration | <1 min | ~4 min | ~15 min | ~24 min |

Room counts, not salvage, set the pace of later iterations, so prestige speeds runs up without collapsing them to nothing.

## Development tools

These need Node.js and Playwright with a Chromium build. The game itself needs neither.

- `node tools/functional-test.js` runs 55 checks against the real page in headless Chromium. They cover purchases and bulk pricing, crew bookkeeping, expeditions and hazards, incidents and the light switch, blackouts, real and hallucinated anomalies, levels, the noclip flow, save round-trips, offline credit and its cap, corrupted and hostile saves, export and import, erasing, keyboard shortcuts and a 24-hour catch-up.
- `node tools/balance-bot.js <surveys/s> <document chance> <max minutes> [iterations]` plays the game with a simple strategy and prints a timeline and milestone times.

Adding `#debug` to the URL exposes the simulation as `window.HUM` for these tools.

## Known limitations

- Saves live in one browser's local storage. Private windows or blocked site data mean no saving; the header says so, and Export still works.
- Sound is synthesised with the Web Audio API and starts only after your first click or key press.
- Balance has been checked with scripted players, not human playtesters.
- Automated testing ran in Chromium only. Firefox and Safari have not been tested.
