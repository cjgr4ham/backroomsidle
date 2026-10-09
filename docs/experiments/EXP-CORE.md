# EXP-CORE: experiment scaffolding

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
  - `upgrades:slip`, `upgrades:slipUpdate`
  - `archive:subtabs`, `archive:build`, `archive:update`
  - `manual`, `settings:sections`
  - `ui:init` and `ui:update` (these run for every experiment, on or off)
  - `ui:sanityNote`, `ui:attentionNote`, `objective`, `tabUnlocked`, `tabDot`
  - Tabs can define `visible()`, and number keys go up to 9.
- **Simulation hook points**: `step` (end of every step), `survey:manual` (after a manual survey's rewards), `upgrade:buy` (lets an experiment handle the purchase of its own repeatable upgrade), and `D.manualWaterMult`/`D.manualEchoMult` (manual-survey find chances, default ×1).
- **Load hook**: `afterLoad` runs after loading, importing or erasing.
- **Module slots**: marked regions before section 9 of the script and at the end of the stylesheet, one per experiment.

## Save-schema effects

These changes are additive and the save version stays 1.

- `ext` and `dormant` are added at the top level and in `run`.
  - `ext.<namespace>` holds an experiment's own data. The owning experiment validates it. If the owner is not in the build, it is kept as opaque JSON (at most 20,000 characters per namespace, 40 namespaces).
  - `dormant.<key>` lists ids this build does not know for `achievements`, `docs`, `docsRead`, `research` and run `upgrades`. If the content comes back, the ids are restored.
- The baseline build ignores both fields, so saves move freely between the baseline and this build.

## Disable, revert, restore

- **Turn it off:** not applicable. Turn the experiments off instead (developer menu, or `?exp=none`). The scaffold then behaves exactly like the baseline.
- **Revert its code:** revert every experiment commit first (they use its hooks), then `git revert <EXP-CORE commit>`.
- **Restore the original game:** `git checkout ebfa0c6 -- index.html`, or revert as above. Saves made in between stay loadable, because the extra fields are ignored.
- **Tests after reverting:** `node tools/functional-test.js`.

## Tests

- `node tools/equivalence-check.js` plays 8 seeded scripted sessions in the baseline build and this build with `?exp=none`. The sessions include noclips, offline catch-up and save round-trips. It compares the full state and every derived rate at 96 checkpoints, and all are identical.
  - A planted 0.05% change to one facility's output is detected on every seed, so an "identical" result is meaningful.
- `node tools/functional-test.js`: the original 55 checks, with every experiment off.
- `node tools/tests/core.test.js`: 18 checks covering flags, storage, URL overrides, dormant ids, opaque experiment data and the wallet.
- `node tools/run-tests.js` runs everything.

## Limitations

- `derive()` was restructured into stages. A code revert of EXP-CORE is only clean once every experiment module has been reverted.
- `?exp=` URL overrides do not reach the published artifact, which drops query strings. Use the developer menu there.
