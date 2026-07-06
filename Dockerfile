# ── Stage 1: build ───────────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app
# Toolchain to compile the better-sqlite3 native addon when no musl prebuilt
# binary is published for this Node version. This is a throwaway builder layer,
# so the tools are not stripped (they never reach the runtime image).
RUN apk add --no-cache python3 make g++
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
RUN npm run build:server

# ── Stage 2: runtime ─────────────────────────────────────────────────
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Build tools are required only to compile the better-sqlite3 native addon.
# They are removed in the same layer to keep the image lean.
RUN apk add --no-cache python3 make g++
COPY package*.json ./
RUN npm ci --omit=dev && apk del python3 make g++

COPY --from=build /app/dist        ./dist
COPY --from=build /app/dist-server ./dist-server

# Run as the unprivileged node user (uid 1000). The data dir is pre-created
# and owned by node so the anonymous volume is writable; bind mounts must be
# writable by uid 1000 on the host.
RUN mkdir -p /app/data && chown -R node:node /app/data
USER node

VOLUME /app/data
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO /dev/null "http://127.0.0.1:${API_PORT:-3001}/health" || exit 1
CMD ["node", "dist-server/index.js"]
