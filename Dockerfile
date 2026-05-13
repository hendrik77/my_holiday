# ── Stage 1: build ───────────────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
RUN npm run build:server

# ── Stage 2: runtime ─────────────────────────────────────────────────
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Build tools are required only to compile the better-sqlite3 native addon.
# They are removed in the same layer to keep the image lean.
RUN apk add --no-cache python3 make g++
COPY package*.json ./
RUN npm ci --omit=dev && apk del python3 make g++

COPY --from=build /app/dist        ./dist
COPY --from=build /app/dist-server ./dist-server

VOLUME /app/data
EXPOSE 3001
CMD ["node", "dist-server/index.js"]
