# EXP-CORE: experiment scaffolding

> **In v2:** The registry, flags, wallet and save namespaces are unchanged. The hook points that only the folded experiments used are gone with them: `derive:survey`, `derive:production`, `upgrade:buy`, the `crew:*` hooks and the `facilities:*` layout hooks. The game now does that work itself, so no experiment overrides the survey formula. See [V2-REDESIGN.md](V2-REDESIGN.md).

| Field | Value |
| --- | --- |
| Identifier | `EXP-CORE` |
| Name | Experiment scaffolding |
| Purpose | Lets each experiment plug into the game through named hook points, behind its own flag, so every experiment can be switched off, or reverted in version control, without touching the others. |
| Depends on | Nothing. Every other experiment depends on it. |
| Flag | None. This is infrastructure and is always present. With every experiment off or absent, the game behaves exactly like the baseline (see Tests). |

## What it changes

All of the changes are in `index.html`.

- **`Exp` registry** (new section after the content definitions):
  - `define`, `on`, `hook`, `run`, `runAll`, `ask`, `set`, `reset`, `load` and `sig`.
  - Developer flags are stored under the `the-hum.experiments` key, never in the save.
  - `?exp=none`, `?exp=all` and `?exp=EXP-A,-EXP-B` override flags for one page load. Tests use these.
- **`contentOn(x)`**: content tagged `exp: 'EXP-…'` exists only while that experiment is on.
- **`derive()`** is split into stages with the code unchanged: `deriveMultipliers`, `deriveProduction`, `deriveTotals`, `deriveSurvey`, `deriveNoise`, `deriveSanity`. Hook points sit between them: `derive:production`, `derive:survey` and `derive:noise`.
  - It also exposes `D.surveyMult`, the product of every survey multiplier, so the base reward can be told apart from its multipliers.
- **`Wallet`**: every purchase checks and pays through `Wallet.can/pay/budget/balance`. The affected functions are `buyQuote`, `buyFacility`, `buyUpgrade`, `drink`, `hire`, `canLaunch`/`launchExpedition`, `canResearch`/`doResearch` and `canBuyMemory`/`buyMemory`, plus the crew and drink button states.
- **Upgrade listing**:
  - `upgradeAvailable(u)` means purchasable anywhere.
  - `upgradeHome(u)` gives the tab that lists the upgrade.
  - `upgradeVisible(u)` means listed in the Upgrades tab.
  - `Panels.upgrades.slip()`/`updateSlips()` build requisition slips that other tabs can reuse.
- **Interface hook points**:
  - `facilities:sub`, `facilities:line`, `facilities:row`, `facilities:rowUpdate`, `facilities:afterRows`
  - `crew:sig`, `crew:top`, `crew:lockedText`, `crew:jobRow`, `crew:jobLine`, `crew:jobUpdate`, `crew:afterRows`, `crew:update`
  - `upgrades:build` (an experiment lays out the Upgrades tab itself), `upgrades:sig`, `upgrades:slip`, `upgrades:slipUpdate`
  - `archive:subtabs`, `archive:build`, `archive:update`
  - `manual`, `settings:sections`
  - `ui:init` and `ui:update` (these run for every experiment, on or off)
  - `ui:sanityNote`, `ui:attentionNote`, `objective`, `tabUnlocked`, `tabDot`
  - Tabs can define `visible()`, and number keys go up to 9.
- **Simulation hook points**: `step` (end of every step), `survey:manual` (after a manual survey's rewards), `upgrade:buy` (lets an experiment handle the purchase of its own repeatable upgrade), and `D.manualWaterMult`/`D.manualEchoMult` (manual-survey find chances, default ×1).
- **Load hook**: `afterLoad` runs after loading, importing or erasing.
- **Module slots**: marked regions before section 9 of the script and at the end of the stylesheet, one per experiment.

### Second round, for the final specification update

Behaviour is unchanged while no experiment answers these hooks. The equivalence check and every existing suite were re-run on this commit.

- **Facility prices.**
  - `facPrice(f)` returns `{ base, growth }`, the price curve that `facilityCost()` and `maxAffordable()` use.
  - The `facility:price` hook lets experiments adjust it: a per-facility curve, or a Déjà Vu discount.
  - With no handler, the arithmetic is the original's, operation for operation.
- **Noclip.**
  - `noclip()` records the iteration that is ending: iteration, level, exit, rooms, salvage, time, condition and gain.
  - `noclip:newRun` runs once on the fresh run, after the original Memories set it up and before the save. Starting bonuses go here, so they are never applied on load.
  - `noclip:done` runs once after the save. Reporting goes here.
- **Saving.** `save:after` runs after every successful local save.
- **Noclip tab.**
  - Sub-tabs from experiments (`noclip:subtabs`, `noclip:build`, `noclip:update`, `noclip:sig`). The noclip itself stays the first sub-tab, and there is no sub-tab bar while no experiment adds one.
  - A hook after the noclip box (`noclip:afterBox`).
  - A replaceable Memories section (`noclip:memories`).
  - `rt.noclipTab` holds the open sub-tab.
- **Facilities tab.**
  - `facilities:layout` lets an experiment arrange the rows. It builds them with the panel's own `row()`, so the core update still refreshes every row.
  - `facilities:update` runs after the rows update, and `facilities:sig` adds to the rebuild signature.
- **Confirmations.** `reset:notes` and `import:notes` let experiments add paragraphs to the erase and import confirmations.
- **Debug handle.** `facPrice` and `memoryCost` are exported for the tools.
- **Slots** for the eight new experiments, after `EXP-DEV-MENU`:
  - JS slots for `EXP-FACILITY-INDEPENDENCE`, `EXP-FACILITY-SALVAGE-SCALING`, `EXP-NOCLIP-STATISTICS`, `EXP-DEJA-VU-SHOP`, `EXP-ACCOUNT-AUTH`, `EXP-ACCOUNT-UI`, `EXP-CLOUD-SAVE` and `EXP-NOCLIP-LEADERBOARD`;
  - CSS slots for those that need styles.

### Third round: the server skeleton

The game file is unchanged by this round, so the equivalence check still applies. The new files are:

- **`server/server.js`.** It serves `index.html` with a Content-Security-Policy that allows only the page's own script, by hash. It also:
  - sets security headers;
  - provides the API envelope: JSON only, body limits, the cross-site guard, a per-address rate limit and `REQUIRE_HTTPS`;
  - answers `/api/health`, which lists the features that loaded;
  - marks the page it serves with `<meta name="the-hum-server">`, outside any script, so the game knows a server is present without probing other hosts;
  - logs one line per request, never bodies, cookies or tokens.
- **Features.** The server loads every file in `server/features/` that is present and not listed in `HUM_DISABLE`, after the features it requires. A feature whose requirement is missing is skipped, with a log line. With no features, it only serves the game.
- **`server/db.js`.** It opens one SQLite file through `node:sqlite`, runs transactions, and applies numbered migrations per feature, recorded in `schema_migrations`. Migrations only add. Removing a feature never drops its tables.
- **`server/lib.js`.** JSON responses and errors, body reading, cookies, client address and in-memory rate limits.
- **Other files:**
  - `server/README.md`: deployment, environment variables, backups and the security model;
  - `package.json`: Node 22.13 or newer, `npm start`, no dependencies;
  - `.gitignore`: `data/`.
- **Tests.**
  - `tools/tests/server-harness.js` starts the real server on a free port with a temporary database, and includes a cookie-keeping client.
  - `tools/tests/server-core.test.js` makes 19 checks, using probe features.

### Fourth round: update 2.1 infrastructure

Shared machinery for the features of update 2.1 ([UPDATE-2.1.md](UPDATE-2.1.md)). **It has no gameplay effect by itself:** no content uses it in this round. `tools/equivalence-check.js` was rebuilt for format 2 and proves this against `c903362`, the game before the update (see Tests).

- **Content switches.** Each facility, requisition or research project an experiment adds has a stable content id: `facility:<id>`, `upgrade:<id>` or `research:<id>`. A facility's tiers share its id.
  - `Exp.itemOn(cid)` and `Exp.setItem(cid, on)`. Switches are stored under `the-hum.content`, never in the save.
  - `?content=-facility:copier` switches content for one page load.
  - `contentOn()` checks both the experiment flag and the content id.
  - The Dev tab lists every switchable piece of content.
  - `Exp.reset()` restores flags and content switches together.
- **Content from a slot.** `Content.facility/upgrade/research(exp, def)` add content from an experiment's own slot. The facility helper generates the tiers as well.
  - The definitions stay in the lists while switched off, so saves keep their data.
  - `facs()`, `upgs()` and `ress()` are the live lists, cached per switch change.
  - Gameplay and interface code that lists content uses them: totals, waves, incidents, the Facilities and Research tabs, tab dots, the manual and the Dev tab.
- **Data-driven effects.** `gatherFx()` collects:
  - `fx` on installed requisitions and finished research;
  - `fxRank` per rank of a repeatable project;
  - the share of `kind: 'share'` facilities toward their `target`.

  `derive()`, the mission functions and `researchTime()` apply them through one path. Switched-off content counts for nothing; its ownership is kept. Every value is neutral with no such content.
  - `owned(u)` is `has()` plus `contentOn()`.
  - The existing per-field loops (`hand`, `mult`, `rooms`) use it.
- **Independent research ranks.** `rankOf(R)` and `setRank(R, n)`.
  - Deep Survey Theory keeps `S.deepTheory`.
  - Every other repeatable project keeps its own rank in `S.ext.ranks`.
  - Cost, time, the project under way, completion, the Research tab and the Dev tab use it.
- **Research needing a level.** `reqLevel` opens a project once that level has ever been reached (`S.life.maxLevel`).
- **Research set aside.** `syncResearch()` runs every step.
  - A project under way whose content is switched off moves to `S.ext.resq`, with its cost, time left and total, so it never holds the slot.
  - It resumes by itself, already paid and oldest first, once its content is back and the slot is free.
  - A project no longer needed is refunded.
  - The Research tab lists projects set aside.
- **Dormant data.**
  - `countMapKeep()` keeps facility counts of unknown ids in `run.dormant.facilities`.
  - Auto-buy choices of unknown facilities stay in `run.dormant.autobuy`.
  - A project under way with an unknown id stays in `dormant.researching`.
  - All of them come back when the content does.
- **The save as the update found it.**
  - Every save now records `ext.build = { v: '2.1.0' }`.
  - The first time this build loads a save without that mark, it copies the save untouched to `the-hum.save.pre-2.1`.
- **`Exp.collect(name)`** joins every enabled handler's answer. The rebuild signatures several experiments add to use it: `facilities:sig`, `crew:sig` and `missions:sig`.
- **Hook points**, unanswered in this round:
  - `step:split`: the earliest event time inside a step. `step()` cuts a long step there, so time away handles each event at its moment.
  - `mission:done`: after each return, with its end time. Returns are handled in a bounded loop, so a mission sent again can return again inside one long step.
  - `autobuy:run`: an experiment runs automatic purchasing instead of the Procurement Notes loop. There is one purchaser, never two.
  - `facilities:row`, `facilities:rowUpdate`, `facilities:sig`, `facilities:autoControl`, `facilities:autoNote`.
  - `crew:row`, `crew:rowUpdate`, `crew:sig`.
  - `missions:head`, `missions:card`, `missions:cardUpdate`, `missions:update`, `missions:sig`.
  - `upgrades:head` (under the Upgrades tab's heading, in the plain layout and the categories layout alike) and `upgrades:update`.
  - `view:frame`, `view:segment` (inside the corridor loop, after each stretch, so nearer walls hide what is drawn), `view:overlay` (under the entity and the anomaly) and `view:reset`.
  - `View.features(k)` says what each wall of stretch k has, as `render()` draws it: a wall, a dark opening or a door. `view:features` lets an experiment that adds to the corridor say so, so anything moving in it can respect walls.
  - `View.lightLevel(k, t)` asks `view:light` for a factor on one stretch's light, such as a failing light. With no answer, the light is exactly as before. Everything drawn in that stretch uses the result: walls, floor, ceiling, light panel, and the crew and rooms drawn with it.
  - `page:visible`.
  - `dv:price`: a balance experiment can set Déjà Vu prices. `dvPrice(id, level, base, kind)` asks it: `memoryCost()` for every Memory (`kind` 'memory'), and the Déjà Vu shop for the levels it sells (`kind` 'level'). With no answer every price is the shop's own.
  - `fun:floorRooms`: a balance experiment can set how many rooms make a floor of Level FUN. `funFloorRooms()` asks it, and `funFloor()`, the level track and the manual use it. With no answer it is `CONFIG.fun.floorRooms` (50,000).
  - `level:exit`: a balance experiment can set the rooms needed to find a level's exit. `exitRooms()` asks it before the Déjà Vu route and condition modifiers are applied. With no answer, it is the level's own number.
  - `automation:summary`: experiments that automate something add a short phrase to a list. The Automation category joins the phrases.
- **Purchase and mission extension points.**
  - `unitQuote(f, n)` and `buyFacility(id, { n, quiet })` buy exactly `n` units at their exact price, whatever the buy mode.
  - `buyUpgrade(id, quiet)` and `hireSpecialist(id, quiet)` skip the sound and log line.
  - `launchMission(id, { at, quiet })` starts a mission at a given moment. `quiet` skips the sound and the log line.
  - All of them keep the same checks and payment, and refuse a price that is not positive and finite.
- **Requisitions in other tabs.** An upgrade can name its `home` tab. The Upgrades tab points to requisitions on sale elsewhere, with a button that opens that tab (`homePointers`). The upgrade categories experiment knows an Automation category.

## Save-schema effects

These changes are additive and the save version stays 1.

- `ext` and `dormant` are added at the top level and in `run`.
  - `ext.<namespace>` holds an experiment's own data. The owning experiment validates it. If the owner is not in the build, it is kept as opaque JSON (at most 20,000 characters per namespace, 40 namespaces).
  - `dormant.<key>` lists ids this build does not know for `achievements`, `docs`, `docsRead`, `research` and run `upgrades`. If the content comes back, the ids are restored.
- The baseline build ignores both fields, so saves move freely between the baseline and this build.

## Disable, revert, restore

- **Turn it off:** not applicable. Turn the experiments off instead (developer menu, or `?exp=none`). The scaffold then behaves exactly like the baseline.
- **Revert its code:** revert every experiment commit first (they use its hooks), then `git revert <EXP-CORE commit>`.
  - The server skeleton commit removes `server/`, `package.json` and `.gitignore`. The database file in `DATA_DIR` is not in the repository, and reverting never touches it.
- **Restore the original game:** `git checkout ebfa0c6 -- index.html`, or revert as above. Saves made in between stay loadable, because the extra fields are ignored.
- **Tests after reverting:** `node tools/functional-test.js`.

## Tests

- `node tools/equivalence-check.js` plays 8 seeded scripted sessions in the baseline build and this build with `?exp=none`. The sessions include noclips, offline catch-up and save round-trips. It compares the full state and every derived rate at 96 checkpoints, and all are identical.
  - A planted 0.05% change to one facility's output is detected on every seed, so an "identical" result is meaningful.
- `node tools/functional-test.js`: the original 55 checks, with every experiment off.
- `node tools/tests/core.test.js`: 29 checks covering flags, storage, URL overrides, dormant ids, opaque experiment data and the wallet. The second-round hooks are also covered: price curves, the order of the noclip hooks, Noclip sub-tabs, a replaced Memories section, a custom facility layout and confirmation notes.
- `node tools/run-tests.js` runs everything.

### Tests for the fourth round

- `node tools/equivalence-check.js` plays 8 seeded scripted sessions in `c903362` and in this build with every update-2.1 experiment off. Every other experiment stays at its default.
  - The sessions include surveying, every kind of purchase in every buy mode, specialists, missions, research and doctrines, drinks, the lights, anomalies, entities, level changes, noclips with Memories, Procurement Notes auto-buy, time away and save round trips.
  - It compares the full state, the log and every derived rate at 96 checkpoints.
  - Run on 10 October 2026: **all 96 identical**.
  - A planted change of 0.04% to one facility's bonus was reported on both seeds tried, so "identical" is meaningful.
- `node tools/tests/update-core.test.js`: 29 checks.
  - Content switches, registration and live lists.
  - Effects that follow ownership and switches.
  - Independent ranks.
  - A project set aside and resumed without a second charge.
  - Dormant counts and projects coming back.
  - The three pre-update fixtures loading intact with the kept copy.
  - Step splitting, several mission returns in one long step, and exact single-unit purchases.
- **Fixtures** written by `c903362` itself: `tools/tests/fixtures/pre-update-l4.json`, `-l5.json` and `-fun.json`. They are made by `make-pre-update-saves.js`.
- Every existing suite passed unchanged on this round: 23 suites, 629 checks.

## Limitations

- `derive()` was restructured into stages. A code revert of EXP-CORE is only clean once every experiment module has been reverted.
- `?exp=` URL overrides do not reach the published artifact, which drops query strings. Use the developer menu there.
