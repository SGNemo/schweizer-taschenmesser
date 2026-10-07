# Build context is the repository root (so the PWA can be built and served by the same image):
#   docker compose -f server/docker-compose.yml up --build
# syntax=docker/dockerfile:1

# ---- 1. PWA -------------------------------------------------------------------------------
FROM node:25-bookworm-slim AS web
WORKDIR /repo/web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

# ---- 2. Sync server -----------------------------------------------------------------------
FROM node:25-bookworm-slim AS server-build
WORKDIR /repo/server
# better-sqlite3 ships prebuilt binaries; the toolchain is only a fallback for other platforms.
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/*
COPY server/package.json server/package-lock.json ./
RUN npm ci
COPY server/ ./
RUN npm run build && npm prune --omit=dev

# ---- 3. Runtime ---------------------------------------------------------------------------
FROM node:25-bookworm-slim AS runtime
ENV NODE_ENV=production \
    PORT=8787 \
    HOST=0.0.0.0 \
    DB_PATH=/data/sync.db \
    WEB_DIR=/app/web
WORKDIR /app
COPY --from=server-build /repo/server/node_modules ./node_modules
COPY --from=server-build /repo/server/dist ./dist
COPY --from=server-build /repo/server/package.json ./
COPY --from=web /repo/web/dist ./web
RUN mkdir /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/index.js"]
