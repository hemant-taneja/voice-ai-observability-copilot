# ── Stage 1: build ───────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# ── Stage 2: runtime ─────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app

# Production deps only
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Install pm2 globally (pinned major, cached before code artifacts)
RUN npm install -g pm2@5

# Compiled JS from builder
COPY --from=builder /app/dist ./dist

# SQL migration files — tsc does not copy .sql, so copy manually
COPY src/db/migrations ./dist/db/migrations

# pm2 config
COPY ecosystem.config.js ./

# Run as unprivileged user
RUN chown -R node:node /app
USER node

EXPOSE 3000
CMD ["pm2-runtime", "ecosystem.config.js"]
