# EXP-ATTENTION-BALANCE: footsteps and readable Attention

> **In v2:** The wording says facilities rather than machines. Entities come more often with attention (see the v2 entry), separately from this experiment's footstep noise. See [V2-REDESIGN.md](V2-REDESIGN.md).

| Field | Value |
| --- | --- |
| Identifier | `EXP-ATTENTION-BALANCE` |
| Name | Footsteps and readable Attention |
| Purpose | Acts on the Attention audit below. The formula works as designed. But the player's main early action, surveying by hand, made no noise, so for the first minutes the meter could not respond to anything the player did. Surveys now make a little footstep noise that fades within seconds. The meters also say what Attention and Sanity each are and where the noise comes from. |
| Depends on | `EXP-CORE`, for the `survey:manual`, `step`, `derive:noise`, `ui:attentionNote`, `ui:sanityNote`, `afterLoad`, `flagsChanged` and `manual` hooks. It does not depend on any other experiment. |
| Flag | `EXP-ATTENTION-BALANCE`, on by default. |

## Audit of the original Attention mechanic

All of this was traced from the code (baseline `ebfa0c6`), not inferred from labels.

| Question | Finding |
| --- | --- |
| What it is | A meter from 0 to 100, stored in `run.attention`. It is neither cumulative nor a rate. Each step it moves toward a settling point. |
| The settling point | `100 × noise ÷ (noise + absorption)`, recomputed every step. The white marker on the meter shows it. |
| How fast it moves | `attention = target + (attention − target) × e^(−0.025·dt)`: about 2.5% of the gap per second. The update is exact for any step length, so long offline steps cannot overshoot. |
| What raises it | Noise from machines: each facility's noise × the count owned. Noise multipliers: Industrial Doctrine ×1.3, Unpaid Overtime ×1.2, Loud Season ×1.75. Documenting the figure at the end of the hall (+6), or ignoring it (+4). Nothing else: not time, rooms, crew activity or, originally, surveying. |
| What lowers it | Absorption: base 1, Hum Frequency Study +1, dampeners 0.12 each (×1.5 with Foam Glue), watchers 0.1 each (×crew efficiency, ×2 with Night Watch Rota), tile relic +0.5, and ×1.5 on Level 3. Quieter noise: Quiet Doctrine ×0.55, It Remembers You ×0.8, badge relic ×0.95. No noise while the lights are out. Kill the Lights −45 at once. Absorption acts through the settling point, not directly. |
| Thresholds and consequences | **Below 25:** sanity recovers 0.15/s. **25 and up:** sanity drains 0.004/s per point above 25. **50:** "Watched" label. **75 and up:** incidents, from 0.4/90 s to 1/90 s at 100, each announced 8 s ahead. **45 and up:** the figure can appear in the camera. Throughout: Echo gains ×(1 + A/50), anomalies come sooner ×(1 − A/250), expedition hazard ×(1 + A/100), and the hum's pitch rises. |
| Effect on Sanity | Only through the 25 threshold above. Sanity has its own other inputs (drinks, Break Room, earplugs, Lucid, anomalies, incidents). They are separate meters. |
| Effect on wanderers | Expedition hazard rises with attention, and incidents can take a wanderer for 4–8 minutes. |
| Changed by upgrades and crew | Dampeners, watchers, Foam Glue, Night Watch Rota, Hum study, the doctrines, Unpaid Overtime, It Remembers You, relics, conditions, and Kill the Lights. Labelled Breakers recharge it faster. |
| Does the interface match the simulation? | Yes. The value, marker and note come from the same `derive()` the simulation steps with. |
| Offline | The same update runs on offline steps, so it converges to the same value. Incidents never happen offline, and a pending one is called off. |
| Level changes and noclip | Level changes don't reset it, but the Poolrooms ×1.5 absorption lowers the settling point. A noclip resets it to 0 with the run. |
| Stuck, clamped or dominated? | It is clamped to 0–100 and the target is always below 100. Hunted needs noise of at least 3× absorption, which is reachable (see below). Early on, base absorption (1) dwarfs a few carts' noise (0.002 each). That is why the meter sits near 0–6 for the first minutes, whatever the player does. |

### Scenarios on the original rules (`?exp=none`)

| Scenario | Noise | Absorption | Settles at | Band |
| --- | --- | --- | --- | --- |
| 1. New game, surveying 3/s for 60 s | 0 | 1 | 0 | Quiet |
| 2. 10 carts, 5 benches, 4 condensers (idle, or surveying 3/s) | 0.057 | 1 | 5.4 | Quiet |
| 3. Low noise, 6 dampeners, Hum study | 0.045 | 2.72 | 1.6 | Quiet |
| 4. 40 carts, 30 benches, 20 vats, 10 beacons, 12 crew (2 watchers) | 0.715 | 1.2 | 37.3 | Uneasy |
| 5. Then Level 2 with 20 foundries and 10 boilers | 2.815 | 1.2 | 70.1 | Watched |
| 6. Then 15 dampeners, Foam Glue, 4 watchers | 2.815 | 4.1 | 40.7 | Uneasy |
| 7. Two hours offline from 0 | | | converges to 40.7 | Uneasy |

Balance-bot runs (7 seeds) reach Uneasy by about 10 minutes, Watched by 15 and peak around 90. So every threshold is reachable in normal play.

### Conclusion

- **Not a defect.** No formula is broken, no update loop is missing, and no threshold is unreachable. Low attention early on is mostly intended: a small, quiet operation goes unnoticed. That is preserved. With machines only, every scenario above settles exactly where it did.
- **The real gap is feedback.** Attention could not respond to anything the player did until machines filled the floor. The game's own lore ties attention to footsteps ("It Remembers You: it recognises your footsteps now"), yet footsteps made no noise.
- **Missing explanations.** The meters didn't say what each stands for. The attention note gave one noise figure with no sources.

## What it changes

- **Footsteps.**
  - Each survey you make by hand adds 0.004 noise, which halves every 10 seconds.
  - It goes through the same noise multipliers as machine noise: It Remembers You quietens it by 20%, and the Quiet Doctrine by 45%.
  - It is silenced while the lights are out.
  - It is runtime state that fades within a minute, so it is never saved.
  - Steady footstep noise is surveys per second × 0.004 × 14.4 seconds: 0.06 at 1/s, 0.17 at 3/s, 0.35 at 6/s, and 0.92 at the 16/s rate limit.
- **Unchanged:** machine noise, absorption, the formula, the rate, every threshold and every consequence.
- **The meters say what they are.**
  - Attention: "How closely it listens. Noise 0.230 (machines 0.057, footsteps 0.173) vs absorption 1.00: heading to 19. Echoes ×1.07."
  - With no noise: "No noise yet. Your footsteps make a little; machines make more."
  - Sanity: "Your nerve. +0.15/s. Recovering while attention stays below 25."
- **The field manual** gains "Attention and sanity". It covers:
  - Attention is outside you and sanity is inside you.
  - What makes noise and what absorbs it.
  - The thresholds.
  - How to lower each.

## Results

Scenario audit (`attention-audit`, the same scenarios, plus surveying variants):

| Scenario | Original | With footsteps |
| --- | --- | --- |
| New game, 60 s at 1/s | 0 | 3.6 (heading to 5.2) |
| New game, 60 s at 3/s | 0 | 9.9 (heading to 14.7), Quiet |
| New game, 60 s at 6/s | 0 | 17.5 (heading to 25.4) |
| New game, 120 s at the 16/s rate limit | 0 | 46.4, Uneasy |
| Surveyed 60 s at 3/s, then stopped for 60 s | 0 | 4.1 and falling (target 0.3) |
| Early facilities: idle / surveying 3/s | 5.4 / 5.4 | 5.4 / 18.7 |
| Mid operation: idle / surveying 3/s | 37.3 / 37.3 | 37.3 / 42.5 |
| Heavy operation, and with mitigation | 70.1, 40.7 | 70.1, 40.7 |
| Two hours offline | 40.7 | 40.7 (footsteps have faded) |
| It Remembers You, 60 s at 3/s | 0 | 8.2 (heading to 12.1) |
| Lights out while surveying | 0 | target 0 |

Full runs (pacing bot, 7 seeds, medians):

| Profile | Build | Attention at 5 / 10 / 15 / 20 min | Peak | Lowest sanity | Drinks | Incidents averted | Exit |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Active, 3/s | original | 6 / 23 / 53 / 67 | 90 | 40 | 4 | 7 | 80.2 min |
| | footsteps | 13 / 29 / 55 / 68 | 89 | 40 | 4 | 6 | 77.7 min |
| Casual, 1/s | original | 4 / 8 / 25 / 43 | 90 | 40 | 4 | 8 | 95.4 min |
| | footsteps | 9 / 11 / 27 / 43 | 88 | 40 | 4 | 7 | 98.8 min |

- The meter now responds from the first minute, and more for players who survey harder.
- Normal surveying keeps a new game Quiet. Only sustained clicking at the rate limit reaches Uneasy. Stopping lets it fade.
- From about 15 minutes, machine noise dominates as before: peak attention, sanity, drinks and incidents are unchanged.
- Exit times move by −3% and +4%, inside the seeds' spread.
- Noise equipment is no more necessary than before.

## Files and functions affected

- **`index.html`:** the `EXP-ATTENTION-BALANCE` script slot holds `attentionBalanceExperiment`. Its hooks are `survey:manual`, `step`, `afterLoad`, `flagsChanged`, `derive:noise`, `ui:attentionNote`, `ui:sanityNote` and `manual`. There are no styles.
- **`tools/tests/attention.test.js`:** the experiment's tests.
- **`docs/experiments/EXP-ATTENTION-BALANCE.md`:** this entry.

## Save-schema effects

None. Footstep noise is runtime state and is not saved. Loading, importing or toggling the flag resets it to 0, and it fades within a minute anyway.

## Turning it off

Any one of the following works:

- Use the developer menu's experiment list.
- Add `?exp=-EXP-ATTENTION-BALANCE` to the address.
- Run `HUM.Exp.set('EXP-ATTENTION-BALANCE', false)` in the console.

Surveys are silent again and the meter notes are the original ones.

## Reverting its code

`git revert <EXP-ATTENTION-BALANCE commit>`. It touches only its script slot, the test file and this entry.

## Restoring the original behaviour

Turning the flag off or reverting the code restores the original Attention rules and notes exactly. The equivalence check covers the all-off build. No save data is involved.

## Tests after turning it off or reverting

- Run `node tools/run-tests.js` and `node tools/equivalence-check.js`.
- `node tools/tests/attention.test.js` runs 19 checks:

| Area | What the tests check |
| --- | --- |
| Footsteps | A new game is silent. Each survey adds 0.004. Footsteps halve in 10 s. The settling-point formula is unchanged. |
| Modifiers | It Remembers You and the Quiet Doctrine scale footsteps. Dampeners and Foam Glue change absorption, not noise. There is no noise with the lights out. |
| Thresholds | Two minutes at 3/s moves the meter but stays Quiet, and stopping lets it fade. The rate limit reaches Uneasy. A loud operation still reaches Hunted. |
| Offline | Offline settling is identical to the original rules. |
| Interface | The attention note says what the meter is and splits noise by source. The sanity note says "Your nerve". The field manual explains the difference. |
| Flag off | Surveys are silent and the notes are original. |
| Errors | None. |

## Limitations

- **Footsteps join the existing noise multipliers.** These include machine-flavoured ones such as Unpaid Overtime ×1.2, so the whole operation, footsteps included, is louder or quieter together. This was chosen so that a single number on the meter behaves consistently.
- **The resource ledger's noise row** shows the machine and footstep split when this experiment is on. That is done in EXP-RESOURCE-LEDGER, which reads the optional `D.noiseSteps` field; it works with or without this experiment.
