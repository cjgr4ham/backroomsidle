# EXP-NOCLIP-STATISTICS: noclip counter and records

| Field | Value |
| --- | --- |
| Identifier | `EXP-NOCLIP-STATISTICS` |
| Name | Noclip statistics |
| Purpose | A visible, persistent count of completed noclips, and a compact panel of related records |
| Flag | `EXP-NOCLIP-STATISTICS`, on by default |

## 1. What it changes

- **Header.** Next to the iteration, the header shows the number of completed noclips, for example "Iteration 7 · 6 noclips". It appears once you have noclipped, or once the Noclip tab is open to you. It is a button that opens the Noclip tab. It keeps the top bar to one extra word and number, with no extra counters.
- **The Noclip tab** gains a **Records** panel under the noclip box:
  - noclips completed, and how many went through the exit;
  - Déjà Vu to spend and earned in all;
  - this iteration: number, level, rooms, salvage recovered and time;
  - lifetime salvage.
  
  Another experiment can add one line to it. The leaderboard uses that line to show how many noclips the server has recorded.
- **Field manual.** A "Noclip records" section says exactly what is counted.

**What is counted.** The game has one event, a completed noclip. The count is `S.life.noclips`, which existed before this update.
- It goes up once, inside `noclip()`, when that function completes and returns `true`. Going through the exit counts too.
- Opening the Noclip tab, opening its confirmation, or choosing "Stay" counts nothing.
- Loading, reloading or importing a save never changes it. An imported save brings its own count.
- This experiment changes none of that. It only displays the count, and its tests check these rules.

**Why it cannot double-count.**
- `noclip()` is synchronous and saves before it returns.
- A second call fails because the new run has nothing to gain.
- A reload finds the post-noclip save.
- The count lives outside the run, so the run reset cannot touch it.

## 2. Files and functions

- **`index.html`, `EXP-NOCLIP-STATISTICS` slot:** `noclipStatisticsExperiment`.
  - Hooks: `ui:init` and `ui:update` for the header button; `noclip:afterBox` and `noclip:update` for the Records panel; `manual`.
  - It asks `noclip:records` for an optional extra line.
- **Stylesheet slot:** `.brand-noclips` and `.ns-records`.
- **`tools/tests/noclip-statistics.test.js`:** 18 checks.
- **This entry.**

## 3. Dependencies

- `EXP-CORE` for the `noclip:afterBox` and `noclip:update` hooks.
- Optionally, a `noclip:records` answer from `EXP-NOCLIP-LEADERBOARD`. Without it, that line is hidden.
- Nothing depends on this experiment.

## 4. How to disable it

- Use the Dev tab → Experiments.
- Or add `?exp=-EXP-NOCLIP-STATISTICS` to the address for one page load.
- Or run `HUM.Exp.set('EXP-NOCLIP-STATISTICS', false)` with `#debug`.

The header count and the Records panel disappear. The count is still shown in Archive → Statistics, as in the original game.

## 5. How to reverse the code

`git revert` its commits, newest first. They touch only its two slots, its test file and this entry.

## 6. Does it modify persistent data?

No. It only reads `S.life.noclips`, `S.life.exits`, `S.dv`, `S.dvTotal`, `S.life.salvage` and the run's statistics, all of which the game already saves.

## 7. Does it need a database migration?

No.

## 8. How to restore the original behaviour

Turn it off or revert it. The original game showed the count only in Archive → Statistics, and that is what remains.

## 9. What happens to data created while it was on

It creates none. Removing it cannot lose a noclip count, because the count was never this experiment's data.

## 10. Rollback tests actually performed

**`tools/tests/noclip-statistics.test.js`, 18 checks, all passing:**
- The real interface flow:
  - opening the tab and the confirmation counts nothing;
  - "Stay" counts nothing;
  - a double click on the confirmation counts one noclip and awards its Déjà Vu once;
  - a retried `noclip()` does nothing.
- Persistence:
  - a page reload right after a noclip keeps the count, the Déjà Vu and the new iteration;
  - a second load changes nothing;
  - the count is stored outside the run and survives the reset, and exits are counted too;
  - importing a save restores its count, and importing it again adds nothing.
- Display:
  - the Records panel shows the save's own figures;
  - the header button opens the Noclip tab;
  - at 360 px width the header fits without sideways scrolling.
- Switched off, the header count and the panel go and the count stays in the save. Switched back on, they return.

The revert proof (`tools/revert-check.js`) results are listed in the registry index.
