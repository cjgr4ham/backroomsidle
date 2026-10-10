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

## Limitations

- `derive()` was restructured into stages. A code revert of EXP-CORE is only clean once every experiment module has been reverted.
- `?exp=` URL overrides do not reach the published artifact, which drops query strings. Use the developer menu there.
