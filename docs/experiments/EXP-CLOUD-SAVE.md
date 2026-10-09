# EXP-CLOUD-SAVE: the account's save

| Field | Value |
| --- | --- |
| Identifier | `EXP-CLOUD-SAVE` |
| Name | Cloud save |
| Purpose | Associates progress with the account instead of one browser, without ever letting a stale copy overwrite newer progress, and migrates existing local progress safely. |
| Flag | Browser: `EXP-CLOUD-SAVE`, on by default. Server: loaded while `server/features/cloud-save.js` is present, not in `HUM_DISABLE`, and accounts are loaded. |
| Status | **Implemented and tested locally; not deployed.** Copies without a server keep saving in the browser only, as before. |

## 1. What it changes

**What is saved.** The whole save, every field the game already saves:
- run resources, level and rooms, facilities, crew and jobs, upgrades;
- sanity and attention;
- research, relics, achievements and archive documents;
- Déjà Vu, lifetime Déjà Vu, Memories and Déjà Vu shop levels;
- the noclip count and every other lifetime statistic;
- settings.

It uses the same format and the same validation as before. **There is no second save format and no second save system.** The browser save stays the working copy, and the account holds the same save.

**On the server (`server/features/cloud-save.js`):**

| Route | What it does |
| --- | --- |
| `GET /api/save`, `GET /api/save/meta` | The account's save, or its revision and summary |
| `PUT /api/save` | Writes the save. The request must name the revision it was based on (`baseRevision`). If the account's save has moved on since, it is refused with **409** and the current revision. **A stale tab or device can never overwrite newer progress.** The check and the write happen in one database transaction. |
| `GET /api/save/history`, `GET /api/save/history/<revision>` | Earlier versions. The replaced save is kept whenever a write is deliberate (resolving a conflict, a fresh start, a first upload, a noclip, signing out) and at most once an hour for routine saves. The 20 most recent are kept. |

- **Access control:** each route uses the session's account. No route takes an account or save identifier, so one account cannot read or change another's save. A test checks this.
- **Validation:** format version 1, the save's basic shape, numbers that must not be negative, size up to 512 KB, and a 30-per-minute rate limit per account.
- **Developer-tool saves:** saves marked as changed with developer tools are refused with **422**.
- **Nothing competitive is read from the save.** The leaderboard does not use it.

**In the browser (its slot).**
- **When it uploads:** while signed in, about once a minute (checked at each autosave), at every noclip, when saving by hand, when signing out, and when the page is hidden or closed (with `keepalive`).
- **The revision travels with the save.** It is kept in the save itself as `ext.cloud = { owner, revision, syncedTime }`. Even after a reload, a stale tab still names the old revision, and the server refuses it.

**At sign-in, and after an import or erase while signed in:**

| This browser | The account | What happens |
| --- | --- | --- |
| Linked to this account, same revision | — | In step; uploads resume as usual. |
| Linked, behind; less than 30 s of unsaved play since, or the same moment | newer | The account's save is loaded, with a notice. This browser's copy is kept. Offline time since the account's save is credited as usual. |
| Linked, behind, with real unsaved progress; or after a deliberate import | different | **The player chooses**, with both summaries side by side. The other save is kept: as a copy in the browser, or as an earlier version on the server. "Decide later" pauses uploads. |
| Not linked, nothing much played | has a save | The account's save is loaded, with a notice. |
| Not linked, with progress | no save | **Migration:** "Save this progress to your account?" It shows iteration, level, noclips and Déjà Vu, and offers to upload it or start a new game, which keeps the progress as a copy. |
| Not linked, with progress | has a save | The player chooses, as above. |
| Linked to **another** account | either | It is never moved into this account. The player chooses between loading this account's save (or starting new) and signing out. A copy is kept. |

- **Copies kept in this browser** (`the-hum.save.keep-<time>`, the 3 most recent) are made whenever another save replaces the one here.
- **Settings → Account** shows:
  - the cloud save's state ("Saved to your account 12s ago", "offline", "conflict", "paused");
  - "Save to account now";
  - "Start a new game…" (the old one becomes an earlier version);
  - the earlier versions;
  - the copies.
  
  Restoring either one asks first, then makes it this game and the account's save. The progress it replaces is kept.
- **Developer-tool saves** (`ext.dev`) are never uploaded. The account keeps its last clean save, and Settings offers to load it.
- **Notes in dialogs:**
  - The erase confirmation says it erases this browser only. The account's save loads again, and "Start a new game" in Settings starts over in the account.
  - The import confirmation says the player will choose if the saves differ.

**Imports cannot duplicate anything.**
- The migration uploads the save once. After that the browser is linked, and nothing is offered again.
- Saves are replaced whole, never merged, so resources, noclips and Déjà Vu cannot be added twice.
- Progress linked to one account is never uploaded into another.
- Leaderboard counts come only from the server's own records (`EXP-NOCLIP-LEADERBOARD`), never from a save.

## 2. Files and functions

- **`server/features/cloud-save.js`:** migration 1 creates the `saves` and `save_history` tables. It also has `summarize()`, `validate()` and the routes above.
- **`index.html`, `EXP-CLOUD-SAVE` slots:** `cloudSaveExperiment`.
  - Functions: `begin`, `decide`, `upload`, `adopt`, `freshStart`, `keepCopy`, `copies`, `restore`, and the dialogs `showConflict`, `askMigrate`, `askOtherAccount` and `offerImport`.
  - Hooks: `account:changed`, `afterLoad`, `save:after`, `noclip:done`, `account:beforeLogout`, `account:sections`, `ui:update`, `reset:notes`, `import:notes`, `cloud:state`, `manual`.
  - Save namespace: `ext.cloud`.
- **`tools/tests/cloud-save.test.js`:** 28 checks.
- **This entry.**

## 3. Dependencies

- `EXP-ACCOUNT-AUTH` on both sides. Without accounts it is inactive. Its test reports itself as skipped.
- `EXP-CORE`: the hooks `afterLoad`, `save:after`, `noclip:done`, `reset:notes` and `import:notes`, and the server skeleton.
- `EXP-ACCOUNT-UI` shows its rows in Settings → Account. This is optional: without it, sync still works for a session that already exists.

## 4. How to disable it

- **Browser:** Dev tab → Experiments, or `?exp=-EXP-CLOUD-SAVE`. Nothing more is uploaded. The game keeps saving in the browser. A test checks this.
- **Server:** `HUM_DISABLE=EXP-CLOUD-SAVE`. The routes disappear. **The saves and their earlier versions stay in the database.**

## 5. How to reverse the code

`git revert` its commits, newest first. They touch `server/features/cloud-save.js`, its two slots, its test and this entry.

## 6. Does it modify persistent data?

**Yes, additively:**
- on the server, `saves` and `save_history`;
- in the save, `ext.cloud`, three small fields;
- in the browser, copies under `the-hum.save.keep-*`.

## 7. Does it need a database migration?

Yes: feature migration 1, recorded as (`EXP-CLOUD-SAVE`, 1), which creates two tables. There is no down-migration: rolling back the code leaves every save and earlier version in place.

## 8. How to restore the original behaviour

Turn it off or revert it. The game then saves in the browser only, as before. Since every upload was a copy of the browser save, **the browser always still has its own progress.** Removing cloud sync never removes the only copy of anyone's progress.

## 9. What happens to data created while it was on

- **The account's save and its earlier versions** stay on the server, untouched.
- **If the feature returns,** the next sign-in compares the browser's save with the account's, exactly as above. Nothing is overwritten unasked.
- **`ext.cloud`** stays in the save. It is kept as opaque experiment data if the code is reverted, and is harmless.
- **The copies in the browser** stay until the player restores or clears them.
- **Data is deleted by none of the rollbacks.**

## 10. Rollback tests actually performed

**`tools/tests/cloud-save.test.js`, 28 checks, all passing,** against the real server and several real browsers.

- **The API:**
  - routes refuse without a session;
  - a first upload reads back exactly;
  - a stale write is refused with 409 and changes nothing;
  - earlier versions are kept on deliberate writes and hourly otherwise, and read back;
  - validation covers format, shape, numbers, revision, developer marks (422) and size (413);
  - one account cannot see or write another's save;
  - a cross-site save is refused.
- **Browsers:**
  - a new account links and uploads;
  - manual saves upload;
  - a refresh stays in step with no question;
  - a second device loads the account's current progress.
- **Conflicts:**
  - **a stale device and a stale tab cannot overwrite newer progress**;
  - choosing the account's progress keeps a copy.
- **Migration:**
  - asks and says what the progress is;
  - uploads it unchanged;
  - is not offered again after a refresh, and adds nothing twice;
  - another account's progress is never moved into this one, and a copy is kept;
  - a fresh start keeps a copy.
- **Other flows:**
  - developer-tool saves are not uploaded;
  - erasing while signed in erases this browser only;
  - **an imported older save asks instead of overwriting**;
  - signing out uploads the latest progress first;
  - when a session ends, uploads stop and the game knows it is signed out;
  - an earlier version can be restored on purpose.
- **Switched off:** nothing is uploaded, the browser keeps saving, and the account's save is untouched.

The revert proof results are in the registry index.

## Limitations

- **Two devices playing at the same moment** produce a conflict for the player to settle. The two sets of progress are never merged.
- **A page closed in the middle of an upload.** The keepalive upload may not complete. The browser save is safe either way, and the next sign-in compares the two.
- **The browser save stays the working copy.** If a browser's storage is cleared, the progress since the last upload, about a minute at most while signed in, is lost with it. The account's save is not affected.
