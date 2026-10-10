# The Hum: the game page and its optional server (accounts, cloud saves, the noclip leaderboard).
# One small image, no npm dependencies. The database lives on a volume mounted at /data.
# Build: docker build -t the-hum .
# Run:   docker run -p 8080:8080 -v hum-data:/data the-hum      (behind an HTTPS proxy; see docs/DEPLOYMENT.md)
FROM node:22-alpine

WORKDIR /app
# Only what the server needs: the page and the server code. Tests, tools and docs stay out of the image.
COPY package.json index.html ./
COPY server ./server

# Defaults for running behind a platform's HTTPS proxy. REQUIRE_HTTPS refuses plain-HTTP API requests and
# TRUST_PROXY reads X-Forwarded-* from that proxy; change both only if you know there is no proxy in front.
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8080 \
    DATA_DIR=/data \
    TRUST_PROXY=1 \
    REQUIRE_HTTPS=1

RUN mkdir -p /data && chown node:node /data
USER node
VOLUME ["/data"]
EXPOSE 8080

# The health check talks to the server directly, so it says it came through HTTPS the way the proxy would.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null --header="X-Forwarded-Proto: https" "http://127.0.0.1:${PORT}/api/health" || exit 1

# The server closes the database cleanly on SIGTERM, which is what `docker stop` and platforms send.
CMD ["node", "server/server.js"]
