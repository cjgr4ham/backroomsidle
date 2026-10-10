# Deploying The Hum at a public URL

The game is one file, `index.html`. Served by its server (`server/`), the same page also gets accounts, cloud saves and the noclip leaderboard. A public deployment is therefore one long-running Node process with:

- a persistent disk for its SQLite database;
- HTTPS in front of it.

There are no secrets to configure and no npm dependencies.

**Status: ready to deploy, not deployed.** No public server is running. The parts below marked *verified* were run in a development container. The rest needs a hosting account, see [What is still needed](#what-is-still-needed).

## How the game finds its server

The server injects `<meta name="the-hum-server">` into the page it serves. The game looks for a server only when two things are true: the page is served over `http(s)` and carries that mark. It then checks `GET /api/health`.

Any other copy has no accounts and says so, and never sends a request. That covers a file opened from disk, the published artifact, or a static host. This check is what keeps a static copy from pretending to have accounts, so leave it in place. A public deployment does not need to change it: serve the page from the server and the mark is there.

## What was verified here

The container image was built and run, and requests were sent with the headers an HTTPS proxy adds (`X-Forwarded-Proto: https`, `X-Forwarded-Host`, `Origin`):

| Check | Result |
| --- | --- |
| `docker build` | builds `node:22-alpine` with only `package.json`, `index.html` and `server/` |
| process | runs as the unprivileged `node` user |
| Docker health check | reports *healthy* |
| `GET /api/health` through the proxy | `200 {"ok":true,"service":"the-hum","features":[…]}` |
| same request over plain HTTP | refused with `403 https_required` (`REQUIRE_HTTPS=1`) |
| the page over plain HTTP | `308` redirect to HTTPS |
| the page through the proxy | `200`, with the server mark, the Content-Security-Policy and HSTS |
| account | register, session, sign-in |
| cloud save | upload and download of a format-2 save |
| leaderboard | a Level FUN noclip report is recorded and ranked |
| `docker stop` / `docker start` | accounts, sessions, the save and the leaderboard are all still there (volume at `/data`) |
| `node server/backup.js` | copies the database while the server runs; restoring that copy brings back exactly the backed-up accounts |

The automated suites (`node tools/run-tests.js`) also start real servers and drive the game in a browser.

The Fly.io deploy and the virtual-machine setup below were **not** run, because this environment has no hosting account.

## Option A: Fly.io (configuration included)

`fly.toml` describes one machine with one volume, Fly's HTTPS proxy, and the health check.

1. Install `flyctl` and sign in:

   ```sh
   fly auth login
   ```

2. Create the app from the included configuration. App names are global, so choose your own:

   ```sh
   fly launch --copy-config --name <your-app> --no-deploy
   ```

3. Create the volume for the database, in the region of `primary_region`:

   ```sh
   fly volumes create hum_data --size 1 --region lhr
   ```

4. Deploy:

   ```sh
   fly deploy
   ```

   Add `--local-only` to build with your own Docker instead of a remote builder.

5. Verify the public URL, as described in [Verifying a deployment](#verifying-a-deployment).

6. To use your own domain:

   ```sh
   fly certs add hum.example.org
   ```

   Then set the DNS records it prints.

Keep it at one machine (`fly scale count 1`). The database is a file on one volume, and the rate limits live in memory.

## Option B: a virtual machine with Caddy and systemd

`deploy/Caddyfile` and `deploy/the-hum.service` are ready to copy. These steps assume Ubuntu or Debian with Node.js 22.13 or newer.

```sh
sudo useradd --system --home /var/lib/the-hum --shell /usr/sbin/nologin the-hum
sudo mkdir -p /opt/the-hum /var/lib/the-hum && sudo chown the-hum:the-hum /var/lib/the-hum
sudo git clone https://github.com/cjgr4ham/backroomsidle /opt/the-hum   # or copy index.html, package.json and server/
sudo cp /opt/the-hum/deploy/the-hum.service /etc/systemd/system/
which node   # if it is not /usr/bin/node, change ExecStart in the unit
sudo systemctl daemon-reload && sudo systemctl enable --now the-hum
# Caddy: put your domain in deploy/Caddyfile, copy it to /etc/caddy/Caddyfile, then
sudo systemctl reload caddy
```

The server listens only on `127.0.0.1:8080`. Caddy obtains the certificate and forwards to it.

## Option C: any other container platform

Run the image with:

- a persistent volume at `/data`;
- exactly one instance;
- the platform's HTTPS in front.

The image already sets these defaults:

```
HOST=0.0.0.0  PORT=8080  DATA_DIR=/data  TRUST_PROXY=1  REQUIRE_HTTPS=1
```

A platform health check that reaches the container directly must send `X-Forwarded-Proto: https`, or `REQUIRE_HTTPS` refuses it. The image's own `HEALTHCHECK` does this.

Only use `TRUST_PROXY=1` behind a proxy that overwrites `X-Forwarded-For`, `X-Forwarded-Proto` and `X-Forwarded-Host`. The server takes the client address from the last `X-Forwarded-For` entry, which is the one the proxy adds.

## Verifying a deployment

Only call the game publicly available after these pass **on the public URL**:

1. Check the health endpoint:

   ```sh
   curl https://<host>/api/health
   ```

   It should return `{"ok":true,"service":"the-hum","features":["EXP-ACCOUNT-AUTH","EXP-CLOUD-SAVE","EXP-NOCLIP-LEADERBOARD"]}`.

2. Check that plain HTTP redirects:

   ```sh
   curl -I http://<host>/
   ```

   It should answer with a redirect to `https://`.

3. Open `https://<host>/` in a browser. A **Sign in** chip appears in the top bar. A copy without a server shows no chip at all.

4. Create an account, play for a minute and refresh. You should still be signed in, and Settings shows the cloud save.

5. Sign in from a second browser. It offers the cloud save.

6. Archive → Leaderboard loads and reads "Source: this server’s records".

## Backups and restores

- **Copy while running:**

  ```sh
  node server/backup.js /path/to/backup.db
  ```

  On Fly.io:

  ```sh
  fly ssh console -C "node server/backup.js /data/backup.db"
  fly ssh sftp get /data/backup.db
  ```

  Fly also snapshots volumes daily.

- **Restore:**
  1. Stop the server.
  2. Replace `DATA_DIR/the-hum.db` with the copy and delete `the-hum.db-wal` and `the-hum.db-shm`.
  3. **Give the file to the server's user**: `chown the-hum:the-hum`, or `chown 1000:1000` in the container. A restored file owned by root leaves the server unable to write it, and it stops at start.
  4. Start the server.

## What is still needed

Publishing needs two things this environment does not have.

**A hosting account and a deployment decision.** Someone has to choose:

- the platform: Fly.io as configured, a VM, or another container host;
- the app name;
- the region;
- the domain, if any.

Then they run the deploy with their own credentials, using the steps above.

**For a later Claude session to deploy:**

- a Fly.io deploy token scoped to the app (`fly tokens create deploy`), stored in the cloud environment's settings as the environment variable `FLY_API_TOKEN`;
- network access to `api.machines.dev`, `api.fly.io` and `registry.fly.io`.

Never paste a token into a chat.

Until a deployment passes [Verifying a deployment](#verifying-a-deployment) on its public URL, the game is not publicly available. The published artifact remains a static copy without accounts.
