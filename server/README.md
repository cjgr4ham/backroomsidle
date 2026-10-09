# The Hum server

The game itself is one file, `index.html`, and runs anywhere a browser can open it. This server is optional. It serves that same file with a small JSON API for the features that need a server:

- username and password accounts;
- cloud saves;
- a leaderboard of completed noclips.

Players need an account only for those features. Without one, the game saves in the browser as before.

**Status: implemented and tested here, not deployed.** The code was run and tested in a local environment against real HTTP and a real browser (see `tools/tests/server-*.test.js` and the account tests). No public server is running. Until someone deploys this behind HTTPS, these copies have no accounts and no leaderboard, and they say so in the game:

- the published claude.ai artifact;
- copies opened from disk;
- any other static copy.

## Requirements

- **Node.js 22.13 or newer.** It uses the built-in `node:sqlite` module, which needs no build step and no npm packages. Node marks `node:sqlite` as experimental and prints one warning about it at startup.
- **A long-running process.** It is a normal HTTP server, not a serverless function.
- **A persistent disk** for the database file.
- **HTTPS** in front of it for any deployment that other people use. Passwords and session cookies must never travel over plain HTTP.

There are no third-party dependencies and no secrets to configure. Sessions are random tokens, and the database stores only their SHA-256 hashes, so there is no signing key.

## Running it

```sh
npm start                 # or: node server/server.js
# The Hum server listening on http://127.0.0.1:8080 (features: …; data: ./data)
```

Open the printed address. `tools/run-tests.js` starts its own servers on free ports with temporary databases.

## Environment variables

| Variable | Default | Meaning |
| --- | --- | --- |
| `PORT` | `8080` | Port to listen on. `0` picks a free port. |
| `HOST` | `127.0.0.1` | Address to bind. Use `0.0.0.0` in a container, behind a proxy. |
| `DATA_DIR` | `./data` | Folder for `the-hum.db`. It must be on a persistent disk and must not be served. The repository ignores `data/`. |
| `TRUST_PROXY` | off | `1` when the server is behind a reverse proxy that sets `X-Forwarded-Proto`, `X-Forwarded-For` and `X-Forwarded-Host`. Only enable it if the proxy overwrites those headers. |
| `REQUIRE_HTTPS` | off | `1` to refuse API requests over plain HTTP and redirect pages to HTTPS. **Set it in production.** |
| `COOKIE_SECURE` | `auto` | `auto` marks the session cookie `Secure` whenever the request came over HTTPS. `1` always marks it; `0` never does. |
| `HUM_DISABLE` | empty | Comma-separated feature identifiers to switch off without removing code, for example `EXP-NOCLIP-LEADERBOARD`. Their routes disappear and their data stays in the database. |
| `HUM_SETTINGS` | `{}` | JSON with feature settings: rate limits, and the leaderboard's timing rules. Each feature's registry entry lists its settings. |
| `LOG` | on | `0` silences the one-line request log. |
| `HUM_FEATURES_DIR` | `server/features` | Tests only. |

## Deploying

Any host that runs a Node process with a persistent volume works: a small virtual machine, or a platform service with a disk. One example uses Caddy, which obtains a TLS certificate automatically:

```
# Caddyfile
hum.example.org {
    reverse_proxy 127.0.0.1:8080
}
```

```sh
HOST=127.0.0.1 PORT=8080 DATA_DIR=/var/lib/the-hum TRUST_PROXY=1 REQUIRE_HTTPS=1 node server/server.js
```

Run it under a process manager, such as systemd or the platform's own, that restarts it and sends `SIGTERM` to stop it. The server closes the database cleanly on `SIGTERM`.

## Data, backups and rollbacks

- **The database.** Everything is in one SQLite file, `DATA_DIR/the-hum.db`, with its `-wal` and `-shm` companions.
- **Backups.** Back up with `sqlite3 the-hum.db ".backup backup.db"`, or copy the files while the server is stopped. Restore by replacing them while it is stopped.
- **Tables and migrations.** Each feature in `server/features/` owns its tables and applies numbered migrations, recorded in `schema_migrations`.
  - Migrations only add.
  - **Reverting or switching off a feature never drops its tables or deletes rows.** The data stays, unused, and returns with the feature.
  - Deleting data is never part of a rollback. If it is ever truly wanted, it is a separate, deliberate step after a backup.
- **Rolling back the server code.** Take a backup first, then revert the code. Tables created by newer code are ignored by older code.

## Security model

**What the server does:**

- **The page.** It serves only `index.html`, with a Content-Security-Policy that:
  - allows only the page's own inline script, by its SHA-256 hash;
  - allows no other origins;
  - forbids framing.
  
  It also sends `nosniff`, `no-referrer` and `X-Frame-Options: DENY`, and HSTS over HTTPS.
- **Requests.**
  - It accepts JSON bodies only, each with a size limit.
  - It refuses state-changing requests from other sites: the `Origin` must match, and `Sec-Fetch-Site: cross-site` is refused. Session cookies are `SameSite=Lax` and `HttpOnly`.
  - It rate-limits every API request per address, and features add tighter limits, for example on logins.
- **Logging and errors.** It logs one line per request: method, path, status and time. It never logs bodies, cookies or tokens, and error responses never include internal details.

**What it does not do:**

- **Rate limits and multiple instances.** Rate limits are held in memory, so they reset on restart. They are not shared between several server processes, and the server is meant to run as a single instance.
- **Leaderboard counts.** The server counts each completed noclip once, under its own rules, and the browser can never set a count. But the game runs in the browser, so the server cannot prove that a reported noclip was earned by honest play. The leaderboard's registry entry states exactly what is and is not checked.

Each feature's own measures are in its registry entry:
- [EXP-ACCOUNT-AUTH](../docs/experiments/EXP-ACCOUNT-AUTH.md)
- [EXP-CLOUD-SAVE](../docs/experiments/EXP-CLOUD-SAVE.md)
- [EXP-NOCLIP-LEADERBOARD](../docs/experiments/EXP-NOCLIP-LEADERBOARD.md)
