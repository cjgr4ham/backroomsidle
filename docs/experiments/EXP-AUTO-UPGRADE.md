# EXP-AUTO-UPGRADE: the Procurement Controller

Part of update 2.1 ([UPDATE-2.1.md](UPDATE-2.1.md)).

| Field | Value |
| --- | --- |
| Identifier | `EXP-AUTO-UPGRADE` |
| Default | on |
| Content id | `upgrade:procurement` |
| Depends on | `EXP-CORE` (update 2.1 infrastructure: `autobuy:run`, `unitQuote`, quiet purchases, the row and slip hooks, `upgrades:head`, `Exp.collect`) |

## 1. What changes

**The requisition.** Procurement Controller is a salvage requisition costing 25M. It opens on Level 2, is listed in the Upgrades tab (Automation), and resets when you noclip.

**Switches.** Once it is installed, these switches appear. **Every one starts off and stands alone.**
- **Crew tab:** **Auto-upgrade: OFF / ON** on every specialist's row, directly under the yellow recruit/upgrade button. It buys that specialist's next level.
  - It shows **Max level** at the highest level.
  - Switched on before the specialist is recruited, it waits ("Starts once recruited."). Recruiting itself is never automated.
- **Facilities tab:** **Auto-buy** (the next unit) and **Auto-tier** (the next tier) on every facility row, under the buy button.
  - Auto-buy does not switch on Auto-tier.
  - Auto-tier waits for its count ("Auto-tier waits for 25 owned.") and shows **Tiers complete** at the end.
- **Every salvage requisition** gets **Auto-buy**, on its slip (Upgrades, Crew and Missions tabs).
  - The repeatable Survey Drills shows **Max rank** at its cap.
  - Requisitions paid in almond water have no switch.
- **The Upgrades tab** gains a Procurement box. It has:
  - the next purchase;
  - **Pause all / Resume all**;
  - a collapsed list of every salvage requisition with its switch, including those not on sale yet (with what they wait for) and those already bought (**Complete**).

**The purchaser: one, shared, cheapest first.** It runs every second of game time, in the simulation, whatever tab is open. Each run:
1. Collects the switched-on targets that can be bought at all: recruited specialists below the highest level, open facilities, ready tiers, and requisitions on sale.
2. Prices **one** purchase of each with the game's own price now, including discounts: the Foreman's Whistle, the Déjà Vu shop's facility discount.
3. Takes the cheapest. Ties go to the target bought least recently, then to a fixed order.
4. **Stops** if it cannot be paid for. Nothing else can be either, because all prices are in salvage.
5. Buys exactly one through the normal function: `hireSpecialist`, `buyFacility(id, { n: 1 })` or `buyUpgrade`, with their checks. A refusal leaves that target for the next run.
6. Prices everything again.
7. Repeats, up to 50 purchases a run (200 a step while away).

There is:
- no buying every level of one target first;
- no fixed shares, category priority or return-on-investment weighting;
- no reserve;
- no ×10/×25/MAX;
- no "twice the price" rule.

Prices of zero or below, or not finite, are never bought, so the loop cannot spin. With A at 100→200, B at 150→300 and C at 220, it buys A 100, B 150, A 200, C 220, and stops when B at 300 cannot be paid for. This is tested.

**Never:** almond water, Echoes, Déjà Vu, research, doctrines, noclip or rebirth.

**Reporting.** Purchases are reported together:
- one sound per run while you are present;
- one log line every 20 seconds ("Procurement bought 12 × Salvage Cart, Scavenger level, …");
- one line in the report of time away.

**Time away.** The purchaser runs at every step of the catch-up. Production changes only after a purchase, never before. The purchase order matches the order with one-second steps: in the test, 150 purchases in both, in the same order. The catch-up's salvage stays within 0.3% of the small-step reference, never above it.

**Procurement Notes.** This is the Memory that, before this update, offered a per-facility auto-buy checkbox that kept twice the price in hand.
- With this experiment on, Procurement Notes still unlock **Auto-buy on facility rows by themselves**, as switches.
- The same purchaser buys those facilities cheapest first, without the reserve. The old loop stands down (`autobuy:run`), so there is never a second purchaser.
- The Controller adds specialists, tiers and requisitions.
- **Opt-ins are kept.** The first time this build runs a save, the facilities checked under Procurement Notes (`run.autobuy`) become switched-on Auto-buy switches.
- A switch changed here is written to `run.autobuy` too. So turning the experiment off leaves the old checkboxes with the same choices.
- Choices changed in the old checkboxes while the experiment was off count when it comes back.

**Choices** are kept in `S.ext.procure` through reloads and noclips, the same rule as the Dispatch Protocol. They do nothing until what unlocks them is owned again:
- the Controller;
- or, for facility Auto-buy, Procurement Notes.

## 2. Files and functions

`index.html`, slot `EXP-AUTO-UPGRADE`:
- `Content.upgrade` (Procurement Controller) and the save namespace `procure`.
- `targets()`, `procure()`, `mergeLegacy()` and `setOn()`.
- Reporting: `record()`, `summary()` and `flush()`.
- Hooks:
  - `autobuy:run`, `step`, `afterLoad`, `flagsChanged` and `noclip:newRun`;
  - `crew:row`, `crew:rowUpdate` and `crew:sig`;
  - `facilities:row`, `facilities:rowUpdate`, `facilities:sig`, `facilities:autoControl` and `facilities:autoNote`;
  - `upgrades:slip`, `upgrades:slipUpdate`, `upgrades:head` and `upgrades:update`;
  - `automation:summary`, `manual` and `procure:api` (for tests).
- CSS slot `EXP-AUTO-UPGRADE`.

Tests: `tools/tests/procurement.test.js`.

## 3. Dependencies

`EXP-CORE` only.
- **Independent** of the visuals and of `EXP-MISSION-AUTOREPEAT`. The test suite runs it with every other update-2.1 experiment off.
- It buys late content (`EXP-LATE-*`) like any other, whenever that content is on.

## 4. How to disable it

- **The whole experiment:** Dev tab → Experiments, `?exp=-EXP-AUTO-UPGRADE` for one page load, or `HUM.Exp.set('EXP-AUTO-UPGRADE', false)` with `#debug`.
  - Automatic purchasing stops at once.
  - Procurement Notes' old checkbox auto-buy returns, with its own rule (it buys only while twice the price is in hand) and its checkboxes.
  - The switches and the requisition leave the interface. The requisition stays owned and every choice is kept.
- **Just the requisition:** Dev tab → Content switches, or `?content=-upgrade:procurement`. The Controller's switches stop, and Procurement Notes' facility Auto-buy keeps working through the same purchaser.

Switched back on, buying resumes with the same choices. Nothing is bought twice: each purchase is a normal purchase of what is next.

## 5. How to reverse the code

`git revert` this experiment's commits, newest first: the suite fix that stops it needing `EXP-LATE-UPGRADES`, then the experiment's own commit. It fills only its own JavaScript and CSS slots and adds its test and this entry.
- `ext.procure` stays in saves as data of an experiment the build does not have.
- The requisition id is kept in `run.dormant.upgrades`.
- Procurement Notes keeps working the old way with `run.autobuy`.

## 6. Persistent data

Yes:
- `run.upgrades.procurement` (the normal requisition field);
- `S.ext.procure = { on: { 'spec:<id>' | 'fac:<id>' | 'tier:<id>' | 'upg:<id>': true }, paused?: true, merged?: true }`;
- facility choices mirrored in the existing `run.autobuy`.

There is no save-format change.

## 7. Database migration

None.

## 8. How to restore the original behaviour

Switch the experiment off (section 4). `tools/equivalence-check.js` plays sessions that include Procurement Notes' auto-buy, and finds them identical to `c903362` with every update-2.1 experiment off.

## 9. Data created while it was on

The choices and the requisition stay in the save. A build from before the update:
- keeps `ext.procure` untouched;
- keeps the requisition id dormant;
- uses `run.autobuy` (the facility choices, kept in step) with its old rule.

## 10. Rollback tests actually performed

`procurement.test.js`, 34 checks:
- the unlock and its home;
- choices dormant before installation;
- the switch directly under the yellow button on every crew row;
- Auto-buy and Auto-tier on facility rows;
- Auto-buy on salvage slips only;
- the Upgrades box and its full list;
- the A/B/C example in exact order and its stop;
- single units under MAX;
- ties taking turns;
- independent switches;
- the discounted price paid;
- nothing bought when the cheapest is unaffordable;
- Max level, Complete, and a tier waiting for its count;
- buying with the Settings tab open;
- coalesced reporting;
- Pause all;
- a bounded run;
- a pre-update save's Procurement Notes opt-ins taken over and bought without the reserve, as switches instead of checkboxes;
- switched off: the old loop back with its rule, choices and requisition kept, not offered;
- switched back on: old-checkbox changes honoured and buying resumed cheapest first;
- the content switch alone keeping Procurement Notes working;
- choices through a noclip, inert until reinstalled;
- time away: the same order as one-second steps, never more income than the reference, ending within a few purchases of it, one report line;
- working with every other update-2.1 experiment off.
