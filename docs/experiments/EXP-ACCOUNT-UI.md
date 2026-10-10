# EXP-ACCOUNT-UI: the account interface

> **In v2:** Unchanged. See [V2-REDESIGN.md](V2-REDESIGN.md).

| Field | Value |
| --- | --- |
| Identifier | `EXP-ACCOUNT-UI` |
| Name | Account interface |
| Purpose | Lets players use accounts from inside the game: a sign-in and registration screen, the signed-in name in the header, and Settings → Account. Everything matches the terminal's own look. |
| Flag | `EXP-ACCOUNT-UI`, on by default |

## 1. What it changes

**Sign-in screen, "Survey terminal: sign in".** This is a game dialog, not a separate web page.
- It has "Sign in" and "Create account" modes, a username and a password field with the right autocomplete hints, and the password rules shown when creating an account.
- The server's own reason is shown for any refusal: taken name, weak password, wrong password, rate limit or no connection.
- Enter submits the form.
- **"Play offline"** closes the screen, and this browser remembers the choice in `the-hum.account-ui`, outside the save.

**When it appears.**
- **On a visit with no valid session,** unless this browser chose to play offline.
- **After a deliberate sign-out,** with a note.
- **When a session ends during play,** with a note: "Your session has ended…".
- **Never while a session is valid,** so a refresh does not bring it back.
- **Never on top of another dialog,** such as the offline report or a save conflict. It waits until that one closes.
- **Never in a copy without a server.**

**Header.** The `.sysctl` area shows:
- the username, with a green dot, which opens Settings → Account;
- or "Sign in", which opens the screen;
- or "Server unreachable".

Copies without a server show nothing here.

**Settings → Account** shows one of four states:
- **No server:** "This copy of The Hum runs without its server, so accounts, cloud saves and the leaderboard are not available here…"
- **Server unreachable:** a "Try again" button.
- **Signed out:** "Sign in or create an account".
- **Signed in:** "Signed in as NAME", with "Sign out". Other experiments add their own rows below, such as the cloud save status (`account:sections`).

**Field manual:** an "Accounts" section.

**Usernames are always inserted as text,** never as markup. A test feeds the header and Settings a name made of HTML.

## 2. Files and functions

- **`index.html`, `EXP-ACCOUNT-UI` slots:** `accountInterfaceExperiment`.
  - Functions: `openSignIn()` and `close()`.
  - Hooks: `account:changed`, `ui:init`, `ui:update`, `settings:sections`, `manual`. It runs `account:sections`.
- **Stylesheet slot:** `.acct-*`.
- **`tools/tests/account-ui.test.js`:** 22 checks.
- **This entry.**

## 3. Dependencies

- `EXP-ACCOUNT-AUTH`, for the account service and its `account:changed` notices. Without it the interface shows nothing; its test reports itself as skipped.
- `EXP-CORE`, for `ui:init`, `ui:update` and `settings:sections`.
- `EXP-CLOUD-SAVE` and `EXP-NOCLIP-LEADERBOARD` add rows to Settings → Account through `account:sections`. They are optional.

## 4. How to disable it

- Use the Dev tab → Experiments.
- Or add `?exp=-EXP-ACCOUNT-UI` to the address.
- Or run `HUM.Exp.set('EXP-ACCOUNT-UI', false)` with `#debug`.

The screen, header chip and Settings section disappear. A session that already exists keeps working for the cloud save and leaderboard, but a signed-out player has no way to sign in until it is back on. A test checks this.

## 5. How to reverse the code

`git revert` its commits, newest first. They touch only its two slots, its test file and this entry. **Reverting it does not touch gameplay or any other experiment's code.**

## 6. Does it modify persistent data?

No save data. It stores one browser preference, `the-hum.account-ui = { offline }`, outside the save. It holds no passwords: the fields are sent to the server and never kept.

## 7. Does it need a database migration?

No.

## 8. How to restore the original behaviour

Turn it off or revert it. The game then has no account interface, as it did before.

## 9. What happens to data created while it was on

- Only the "play offline" preference is created. It is harmless if left behind.
- Accounts made through the screen belong to `EXP-ACCOUNT-AUTH` and stay on the server.

## 10. Rollback tests actually performed

**`tools/tests/account-ui.test.js`, 22 checks, all passing,** in a browser against the real server:

- **First visit and offline play:**
  - a first visit shows the screen, with the username focused and "Sign in" in the header;
  - "Play offline" closes it and keeps it closed after a refresh.
- **Creating an account:**
  - the create mode shows the rules;
  - Enter submits, and a weak password is explained;
  - a valid account closes the screen and shows the name;
  - **after a refresh the player is still signed in with no screen**;
  - Settings shows the name.
- **A second browser:**
  - a taken name is refused;
  - a wrong password gives a message that does not say which part was wrong;
  - the right password works.
- **Sign-out and session end:**
  - sign-out returns to the screen with a note, and so does a refresh after it;
  - a session that ends shows its note;
  - the screen waits for another open dialog instead of replacing it.
- **Display and connectivity:**
  - usernames made of HTML are shown as text;
  - an unreachable server shows "Server unreachable" without blocking play, and "Try again" recovers;
  - at 360 px width the screen fits;
  - opened from disk there is no screen or chip, and Settings explains why;
  - **switched off, there is no screen or chip, while accounts still work.**

The revert proof results are in the registry index.
