# EXP-DEV-MENU: developer menu

| Field | Value |
| --- | --- |
| Identifier | `EXP-DEV-MENU` |
| Name | Developer menu |
| Purpose | Makes the game quick to test. You can get anywhere and buy anything without hours of play, and switch experiments on and off. It is a testing tool, not part of player progression. |
| Depends on | `EXP-CORE`: the wallet hooks, tabs with `visible()` and key 9, `settings:sections`, `ui:init` and `ui:update`, and its save namespaces. It reads optional figures from other experiments when present (staffing, footsteps). It works without them. |
| Flag | `EXP-DEV-MENU`, on by default. The flag only makes the opt-in available. The tools stay hidden until you turn them on. |

## Access, and what it is not

- **Turning it on.** Settings → Developer tools → "Enable developer tools", or `#dev` in the address for one visit (`#debug,dev` also works). The game is a single HTML file with no build step, so there are no separate development and production builds to tell apart. An explicit opt-in is the mechanism.
- **Where the setting lives.** In this browser, under `the-hum.dev`. It is never in the save.
- **What appears.** A Dev tab (key 9) and a **DEV** badge in the header whenever the tools are on. While infinite mode is on for a resource, an **∞** sits next to that resource in the header. Infinite mode is never invisible.
- **Not a security boundary.** Anyone with the page can turn it on. It is a testing convenience, and the panel says so.

## Controls

Every control uses the game's real systems, and none is a placeholder.

| Control | What it does |
| --- | --- |
| Infinite resources | Separate switches for Salvage, Almond water, Echoes and Déjà Vu. Purchases go through without spending (the `wallet:budget` and `wallet:free` hooks): prices still show and rise, requirements still apply, and the normal purchase code and its side effects run. Balances are never raised, so turning infinite off takes nothing away. Déjà Vu buys permanent Memories, so it has its own switch. |
| Add or remove resources | Adds the amount to, or removes it from, salvage, almond water, Echoes or Déjà Vu. Removing stops at 0. Added salvage doesn't count toward Déjà Vu. Added Déjà Vu is spendable but not "earned", so it doesn't raise the +1% bonus. |
| Levels and rooms | "Go to level" uses the game's `enterLevel`. "Find the exit" goes to Level 5 and uses `findExit`. "Map rooms" uses `addRooms`, so levels change naturally. |
| Research | Completes a chosen project, or adds a rank of Deep Survey Theory. It also offers "Complete all". No Echoes are spent. |
| Requisitions | "Install for free" runs the normal `buyUpgrade`, so requirements still apply. It works for upgrades from every tab and for Survey Drills. |
| Machines | Adds any number of a facility that is currently available. |
| Crew | Adds idle wanderers, and installs the radio if needed. |
| Meters | Sets attention or sanity, from 0 to 100. |
| Events | Spawns an anomaly, schedules an incident (with its warning), causes a blackout, clears an incident or blackout, or recharges Kill the Lights. |
| Time | "Simulate time away" runs the offline simulation (`catchUp`) and shows its report. |
| Production now | Shows live figures from `derive()`: income by source, survey power, multipliers, water, Echoes, automatic surveys, crew and staffing, noise and absorption, the sanity rate, and the Déjà Vu preview. |
| Experiments | Every experiment with its summary and state, and where the state came from (default, set here, or the address). Each has a switch, and there is a "Reset all experiments to their defaults". The panel explains how this differs from reverting code or restoring a save. Turning off the developer menu itself asks first and says how to bring it back. |
| Developer settings | "Turn off infinite resources" and "Turn off developer tools". The second also turns infinite off. |

## Protecting ordinary play and saves

- **Confirmation.** The first action that changes the save in a page load asks first. It explains that the change is real and that the save will be marked, and suggests exporting a backup.
- **The mark.** Each action, and each free purchase, is recorded in `ext.dev`: the number of actions, the first and last time, and the kinds of action. Settings and the Dev tab show "This save has been changed with developer tools: N actions since …".
- **What goes in the save.** Only the mark. Developer settings, including the infinite switches, never do.
- **Turning off.** Turning the tools off ends infinite mode and hides the tab. Nothing the player holds is removed.
- **Without the menu.** With the experiment off, its Settings entry, tab, badge and wallet hooks are inactive, and the game plays normally.

## Files and functions affected

- **`index.html`:**
  - The `EXP-DEV-MENU` script slot holds `developerMenuExperiment`. It:
    - adds the `dev` entry to `TABS` and `Panels.dev`;
    - registers handlers on `wallet:budget`, `wallet:free`, `settings:sections`, `flagsChanged`, `ui:init`, `ui:update` and `manual`;
    - owns `ext.dev`.
  - The stylesheet slot holds the `.dev-*` styles.
- **`tools/tests/dev-menu.test.js`:** the experiment's tests.
- **`docs/experiments/EXP-DEV-MENU.md`:** this entry.

## Save-schema effects

- **`ext.dev = { actions, first, last, kinds }`:** additive, and only written when the tools change something. The save version stays 1.
- **Code reverted while EXP-CORE remains:** the mark is kept as opaque data.
- **Original build:** the field is ignored.
- **Browser setting:** `the-hum.dev` holds `{ enabled, infinite }`.

## Turning it off

There are three levels:

- **Turn off infinite resources.** Use the switches or "Turn off infinite resources".
- **Turn off the developer tools.** Use the Dev tab or uncheck the Settings box. The tab, badge and infinite mode go away.
- **Turn off the experiment.** Use its switch in the list (it asks first), or `?exp=-EXP-DEV-MENU`. The Settings entry disappears too. To bring it back, open the game once with `?exp=EXP-DEV-MENU` and switch it on, or remove the `the-hum.experiments` key.

## Reverting its code

1. Run `git revert <EXP-DEV-MENU commit>`. It touches only the two slots, the test file and this entry.
2. Optionally remove the browser setting with `localStorage.removeItem('the-hum.dev')`.
3. Saves keep their mark as opaque data, which does nothing.

## Restoring the original behaviour

- Turning the experiment off, or reverting the code, leaves ordinary play untouched. The menu never changes production logic.
- Changes already made to a save with the tools stay, as the confirmation warned. To undo them, import a save exported before testing (Settings → Import). The game never restores an old save on its own.

## Tests after turning it off or reverting

- `node tools/run-tests.js` runs the full suite.
- `node tools/tests/dev-menu.test.js` runs 27 checks:

| Area | What the tests check |
| --- | --- |
| Access | Hidden by default, and key 9 does nothing. The Settings opt-in shows the tab and badge, and key 9 then opens the tab. |
| Confirmation and the save mark | The first change asks. Injection is exact and doesn't count toward Déjà Vu. The save is marked. Later changes don't ask again, and removing stops at 0. |
| Infinite mode | Purchases go through without spending. Prices show and rise. One-off upgrades can't be bought twice. The ∞ marker shows and the mark records it. Switching it off restores the normal rules and takes nothing away. |
| Levels and rooms | Go to level, Map rooms and Find the exit. |
| Research, machines and crew | Research completes without spending Echoes. Added machines change nothing else. Added wanderers arrive idle with the radio. Install for free charges nothing. |
| Meters, events and time | Attention and sanity can be set. An incident can be scheduled and cleared. Time away runs 30 minutes and shows its report. |
| Panels | Production figures are live. Experiment switches toggle, persist and reset. |
| Storage | Developer settings live in the browser, and the save carries only the mark. |
| Turning off | Turning the tools off ends infinite mode. With the experiment off, its menu, Settings entry, badge, marker and infinite purchasing are all gone. |
| Errors | None. |

## Limitations

- **MAX with infinite salvage.** With MAX selected and infinite salvage on, Facilities buys up to 10,000 machines at once. That is the purchase code's own cap, and the panel says so.
- **Going to a lower level.** "Go to level" can move to a lower level within the run, which normal play cannot. Use it for testing only.
- **Requirements still apply.** "Install for free" keeps the requirements, so the player can still test unlock conditions. Meet them with the other controls.
- **The mark cannot be cleared from the menu.** It is a record, not a setting.
