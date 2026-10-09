# EXP-ACCOUNT-AUTH: accounts and sessions

| Field | Value |
| --- | --- |
| Identifier | `EXP-ACCOUNT-AUTH` |
| Name | Accounts |
| Purpose | Username and password accounts, held by the game server, with sessions that survive refreshes. Other features use the account: cloud saves and the leaderboard. |
| Flag | Browser: `EXP-ACCOUNT-AUTH`, on by default. Server: loaded while `server/features/auth.js` is present and not listed in `HUM_DISABLE`. |
| Status | **Implemented and tested locally; not deployed.** Without a running server, which includes the published artifact and copies opened from disk, accounts are unavailable and the game says so (`EXP-ACCOUNT-UI`). |

## 1. What it changes

**On the server (`server/features/auth.js`):**

| Route | What it does |
| --- | --- |
| `POST /api/auth/register` | Creates an account and signs in. |
| `POST /api/auth/login` | Signs in. |
| `POST /api/auth/logout` | Ends the session on the server and clears the cookie. |
| `GET /api/auth/session` | Returns the signed-in username, or none, and keeps a session in use alive. |

**Usernames.**
- 3 to 20 characters: letters, digits, `_` and `-`, with at least one letter or digit. They are normalised with NFKC and trimmed.
- They are unique by their lower-case form, enforced by a `UNIQUE` constraint in the database. A test fires five simultaneous registrations of one name, and exactly one account is created.
- A few names are reserved, such as `admin` and `system`.
- **The password policy, shown to the player:** 10 to 200 characters, not containing the username, not one of the most common passwords, not one repeated character.

**Passwords.**
- They are hashed with **scrypt** from Node's standard `crypto` library, with N = 2^15, r = 8, p = 3. These are among OWASP's recommended scrypt settings. Each account has a random 16-byte salt.
- Only `scrypt$15$8$3$salt$hash` is stored, never the password.
- Hashes carry their settings, so a hash made with weaker settings is replaced at the next successful sign-in.
- No custom cryptography is involved.

**Sessions.**
- A random 256-bit token in the `hum_session` cookie, with `HttpOnly`, `SameSite=Lax`, `Path=/` and a 30-day `Max-Age`. It is `Secure` whenever the request came over HTTPS.
- The database stores only the token's SHA-256 hash.
- A session in use is extended at most once a day.
- Signing out deletes the session on the server.
- Expired sessions are removed hourly and at each sign-in.

**Protections.**
- Rate limits, in memory and configurable through `HUM_SETTINGS.rate`:
  - 5 registrations per address per hour;
  - 10 sign-ins per address and username per 15 minutes;
  - 50 sign-ins per address per 15 minutes.
- A wrong password and an unknown username give the same message, "Wrong username or password.", and take the same time, because both run the hash.
- A disabled account (`accounts.disabled_at`, set by an operator) cannot sign in, and its sessions stop working.
- **Inherited from the server core:**
  - same-origin checks;
  - JSON body limits;
  - HTTPS enforcement with `REQUIRE_HTTPS`;
  - logs without bodies, cookies or tokens.

**In the browser (`EXP-ACCOUNT-AUTH` script slot).**
- **Startup.** Only when the page was served over `http(s)`, it:
  - asks `/api/health` whether this server has accounts;
  - then asks `/api/auth/session`.
  
  A valid session is restored at once, with **no sign-in screen after a refresh**. Opened from disk, nothing is requested and accounts are unavailable.
- **The `account:service` hook** offers the rest of the game: `state()`, `register()`, `login()`, `logout()`, `api()`, `retry()` and `has(feature)`.
- **Notices to other experiments:**
  - every change of state is announced through `account:changed`;
  - any request refused with `signed_out` while the game thought it was signed in becomes the state `signed-out`, with reason `expired`;
  - before signing out, `account:beforeLogout` lets other features finish, for at most 4 seconds.
- **The cookie is HttpOnly.** The page never sees or stores the session token. The state is not kept in a JavaScript variable across refreshes: it is restored from the server each time.

## 2. Files and functions

- `server/features/auth.js`:
  - migration 1 creates the `accounts` and `sessions` tables;
  - functions: `hashPassword`, `verifyPassword`, `checkUsername`, `checkPassword`;
  - `ctx.services.auth.user()` and `require()` are used by other features.
- `index.html`, `EXP-ACCOUNT-AUTH` script slot: `accountAuthExperiment`. Hooks: `account:service`, `ui:init`, `flagsChanged`. It runs `account:changed` and `account:beforeLogout`.
- `tools/tests/account-auth.test.js`: 27 checks.
- This entry.

## 3. Dependencies

- `EXP-CORE`: the server skeleton, and the browser hooks `ui:init` and `flagsChanged`.
- `EXP-ACCOUNT-UI`, `EXP-CLOUD-SAVE` and `EXP-NOCLIP-LEADERBOARD` depend on this experiment.
  - On the server they are skipped while it is absent.
  - In the browser they see no account service and stay inactive. Their own data is untouched.

## 4. How to disable it

- **Browser:** Dev tab → Experiments, or `?exp=-EXP-ACCOUNT-AUTH`. The game behaves as an offline copy, and existing sessions are simply not used.
- **Server:** `HUM_DISABLE=EXP-ACCOUNT-AUTH`. Account routes disappear, and the features that need accounts are skipped. **The accounts and sessions tables stay in the database.**

## 5. How to reverse the code

`git revert` its commits, newest first. They touch `server/features/auth.js`, its slot, its test and this entry. Revert or disable the experiments that depend on it first, or accept that they become inactive.

## 6. Does it modify persistent data?

- **On the server:** yes. It creates the `accounts` and `sessions` tables and rows.
- **In the save:** no.
- **In the browser:** nothing is stored. The session is a cookie set by the server.

## 7. Does it need a database migration?

Yes: feature migration 1, recorded in `schema_migrations` as (`EXP-ACCOUNT-AUTH`, 1). It only creates tables. There is no down-migration, by design: rolling back the code leaves the tables and rows in place.

## 8. How to restore the original behaviour

- Disable it in the browser, or run the game without the server. The game is then exactly as before: saves in the browser only.
- Nothing about play changes with accounts. They only enable the features that need them.

## 9. What happens to data created while it was on

- **Accounts and sessions** stay in the database: hashes only, never passwords or tokens.
- **Sign-in again.** If the feature returns, the same usernames and passwords work again. Sessions that expired meanwhile need a new sign-in.
- **Deleting accounts.** No rollback deletes them. Deletion would be a deliberate, separate operator action after a backup.

## 10. Rollback tests actually performed

**`tools/tests/account-auth.test.js`, 27 checks, all passing,** against the real server and a real browser:

- **Registration:**
  - it signs in;
  - the cookie flags are as listed above;
  - case-insensitive uniqueness holds under five simultaneous registrations;
  - the username rules hold, with reasons;
  - each password rule holds, with its reason.
- **Storage:** salted scrypt hash only; sessions stored as hashes.
- **Sessions and sign-in:**
  - the session identifies the account;
  - wrong password and unknown username give the same message and similar time;
  - sign-in works with any case of the username;
  - signing out ends the session on the server, so the old cookie stops working;
  - a cross-site sign-in is refused.
- **Protections:**
  - the rate limit applies, with Retry-After;
  - a disabled account cannot sign in and its session ends;
  - an expired session is refused and its cookie cleared;
  - a weaker hash is replaced on sign-in.
- **Browser:**
  - the game finds the server and starts signed out;
  - registering signs in, and the page cannot read the cookie;
  - **after a refresh the session is restored without signing in again**;
  - another browser profile is not signed in by this one's session;
  - signing out stays final after a refresh;
  - a failed sign-in reports the server's message;
  - opened from disk, nothing is requested.
- **Logs:** the server log never contains passwords or tokens.

**Disable and data checks.** The server core test (`server-core.test.js`) checks two things with probe features: a feature switched off through `HUM_DISABLE` keeps its tables and rows, and migrations are recorded once across restarts. The revert proof results are in the registry index.

## Limitations, stated plainly

- **Not deployed.** Real use needs the server deployed behind HTTPS, with `REQUIRE_HTTPS=1`. Over plain HTTP, passwords would travel unencrypted. The server refuses that once `REQUIRE_HTTPS` is set.
- **Rate limits are per server process and reset on restart.** A distributed attacker using many addresses is limited only by the per-username limit and the cost of each hash.
- **No account recovery.** There is no email, so a forgotten password cannot be reset by the player. An operator could set a new hash by hand.
- **Username changes and account deletion** are not offered. Disabled accounts are hidden from the leaderboard.
