# EXP-NOCLIP-LEADERBOARD: the noclip leaderboard

> **In v2:** A current game noclips from Level FUN, so reports carry level 6 with the exit found. The server accepts those, and still accepts reports from pages loaded before the update (Level 3–5 without the exit). Completing the survey never sends a report. See [V2-REDESIGN.md](V2-REDESIGN.md).

| Field | Value |
| --- | --- |
| Identifier | `EXP-NOCLIP-LEADERBOARD` |
| Name | Noclip leaderboard |
| Purpose | Ranks accounts by completed noclips, counted by the server, never by the browser |
| Flag | Browser: `EXP-NOCLIP-LEADERBOARD`, on by default. Server: loaded while `server/features/leaderboard.js` is present, not in `HUM_DISABLE`, and accounts are loaded. |
| Status | **Implemented and tested locally; not deployed.** A copy without a server says that it has no leaderboard, and lists nobody. |

## 1. What it changes

### Recording a noclip: what the server trusts and what it does not

1. **The event.** The game's own `noclip()` completes. The noclip count is that function's, as in `EXP-NOCLIP-STATISTICS`. While signed in, the `noclip:done` hook puts **one report** in a queue in this browser, `the-hum.noclip-reports`. The report contains:
   - this save's **lineage**, a random 128-bit id kept in `ext.lb`;
   - the **iteration** that ended;
   - a short summary of that run: level, exit, time, salvage and Déjà Vu gained.
   
   **The report never contains a count.**
2. **Sending.** The queue is sent oldest first.
   - If the server cannot be reached, the reports wait and are sent later, for example at the next sign-in.
   - Reports from saves changed with developer tools are never queued.
3. **The server's checks**, `POST /api/noclips`:
   - a signed-in account;
   - the run reached Level 3 or the exit, and the exit only on Level 5;
   - at least 1 Déjà Vu;
   - a minimum run time (10 s by default);
   - well-formed fields;
   - no developer-tool mark (422);
   - at most one noclip recorded per account every 30 s, on the server's clock (429 with Retry-After; the browser waits and retries);
   - a rate limit of 120 reports an hour.
4. **Exactly once.** In one transaction, the server records the noclip for (account, lineage, iteration) under a `UNIQUE` constraint, then adds **one** to the account's total. Each of these is answered as a duplicate and never counted again:
   - a retried request;
   - a reload right after the noclip;
   - the same save reporting from a second device;
   - a replayed request.
5. **Ignored fields.** Any `noclips`, `total`, `count` or `rank` field in a report is ignored. A test sends `noclips: 9999`, and the count goes up by exactly one.

**What this cannot prove.** The game runs in the browser. A determined player could write a script that sends plausible reports. The checks above block:
- arbitrary counts;
- replays;
- duplicate imports;
- developer-tool saves;
- bursts, limited to one noclip per 30 s per account.

They cannot prove that a reported noclip was played honestly. That would need the server to run the game itself, which is beyond this project. The leaderboard states its source and rule on screen.

### The ranking, `GET /api/leaderboard?page=N`

- **Order:** most recorded noclips first. **On a tie, whoever reached that count first**, by the server's time of the noclip that reached it. Then the older account.
- **Who is listed:**
  - accounts with at least one recorded noclip;
  - each account once, since there is one row per account;
  - disabled accounts are left out, and the rest move up.
  
  Usernames cannot be changed in this version, and there is no account deletion: disabling is the operator's tool.
- **Pages:** 25 per page.
- **Your own rank:** the signed-in player's rank and count come with every page (`me`), even when they are on another page. `/api/leaderboard/me` gives just that.
- **Public data:** only rank, username, count, and a "you" flag for the viewer. No ids, emails, hashes or save data are exposed. A test checks the keys.

### In the game

- **Archive → Leaderboard**, a sub-tab of the always-visible Archive, so no top-level tab is added. It shows:
  - "#1 Wanderer_01 · 4 noclips" rows, with your own row highlighted;
  - your rank;
  - "Previous", "Next", "My rank" and "Refresh" buttons;
  - a line naming the data source and the tie rule.
  
  It refreshes when opened, every 30 s while open, and after each recorded noclip.
- **States it explains:**
  - **No server:** "There is no leaderboard in this copy of The Hum…", and your own count from the save. No list is shown.
  - **Unreachable server:** says so.
  - **Signed out:** the board, plus "Sign in to appear on the leaderboard".
  - **Your save counts more than the server recorded:** says why. Noclips made before signing in, or without a server, are not ranked.
- **Records panel** (Noclip tab): "Leaderboard: N noclips recorded by the server, rank R".
- **Settings → Account:** your rank.

## 2. Files and functions

- **`server/features/leaderboard.js`:** migration 1 creates the `noclip_events` and `noclip_totals` tables and the `noclip_rank` index. Also `check()`, `standing()` and the three routes.
- **`index.html`, `EXP-NOCLIP-LEADERBOARD` slots:** `noclipLeaderboardExperiment`.
  - Functions: `lineage()`, the queue, `flush()`, `fetchMe()`, `load()`, `draw()`.
  - Hooks: `noclip:newRun`, `noclip:done`, `account:changed`, `archive:subtabs`, `archive:build`, `archive:update`, `noclip:records`, `account:sections`, `manual`.
  - Save namespace: `ext.lb`.
- **`tools/tests/leaderboard.test.js`:** 24 checks.
- **This entry.**

## 3. Dependencies

- `EXP-ACCOUNT-AUTH` on both sides. Without accounts, the board shows its "no leaderboard here" state. On the server it is skipped, and its test reports itself as skipped.
- `EXP-CORE`: the `noclip:newRun` and `noclip:done` hooks, and the Archive sub-tab hooks.
- Optional:
  - `EXP-NOCLIP-STATISTICS` shows its records line;
  - `EXP-ACCOUNT-UI` shows its Settings line;
  - `EXP-CLOUD-SAVE` carries `ext.lb` to other devices, so the same save counts once everywhere.

## 4. How to disable it

- **Browser:** Dev tab → Experiments, or `?exp=-EXP-NOCLIP-LEADERBOARD`. The sub-tab disappears, and nothing is reported. Noclips made while it is off are not recorded later: they were not reported when they happened.
- **Server:** `HUM_DISABLE=EXP-NOCLIP-LEADERBOARD`. The routes disappear, and **every recorded noclip stays in the database.**

## 5. How to reverse the code

`git revert` its commits, newest first. They touch `server/features/leaderboard.js`, its two slots, its test and this entry.

## 6. Does it modify persistent data?

**Yes, additively:**
- on the server, `noclip_events` and `noclip_totals`;
- in the save, `ext.lb`, the lineage id only;
- in the browser, the report queue, outside the save.

## 7. Does it need a database migration?

Yes: feature migration 1, recorded as (`EXP-NOCLIP-LEADERBOARD`, 1). It creates two tables and an index. There is no down-migration.

## 8. How to restore the original behaviour

Turn it off or revert it. The game has no leaderboard, as before.

**Removing the leaderboard does not touch noclip statistics:**
- the save's own count, `S.life.noclips`, is never written by this experiment;
- the server's records stay in the database.

## 9. What happens to data created while it was on

- **Recorded noclips and totals** stay on the server. If the feature returns, the board shows them again.
- **`ext.lb`** stays in the save. It is kept as opaque data if the code is reverted.
- **Queued reports** stay in the browser and are sent if the feature returns. They cannot double-count, because the server answers a duplicate.
- Nothing is deleted by any rollback.

## 10. Rollback tests actually performed

**`tools/tests/leaderboard.test.js`, 24 checks, all passing,** against the real server and a browser.

- **Recording:**
  - a report needs an account;
  - a report counts once, and the same report is a duplicate;
  - one noclip per interval, with a retry time;
  - **forged counts in a report are ignored**;
  - eight kinds of impossible report are refused, and developer saves get 422;
  - the total equals the recorded events;
  - the same noclip from a second device counts once.
- **Ranking:**
  - most first;
  - ties to whoever reached the count first;
  - accounts without noclips are not listed, and each account appears once;
  - pages, with the player's own rank given from another page;
  - entries carry only rank, username, count and the "you" flag;
  - a player can ask for their own standing;
  - a disabled account leaves the board;
  - an empty server shows an empty board, and a one-account server shows that account alone.
- **Browser:**
  - a noclip while signed in is recorded and the open board refreshes;
  - the board names its source;
  - **reloading right after does not count it twice**;
  - the Records panel line;
  - a noclip made offline waits and is recorded once later;
  - a developer-tool save is not reported;
  - **switched off, nothing is reported, the save's own count still rises and the server keeps its records**;
  - a copy without a server says so and lists nobody.

The revert proof results are in the registry index.
