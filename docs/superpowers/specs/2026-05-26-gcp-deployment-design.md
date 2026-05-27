# GCP Deployment + CI/CD Design

**Date:** 2026-05-26
**Branch:** feat/voice-ai-copilot
**Approach:** Approach B — Docker Compose on GCE VM, build on VM, SSH deploy via GitHub Actions

---

## 1. Goals

- Deploy the voice-ai-copilot monorepo (backend + frontend) to GCP using the $300 free credits
- Auto-deploy on every push to `main` via GitHub Actions (tests → deploy)
- Keep infrastructure simple enough to maintain without DevOps expertise
- ~$27/month total → ~11 months on $300 credits

---

## 2. Infrastructure

### Compute

| Resource | Spec | Cost |
|---|---|---|
| GCE VM | `e2-medium`, Ubuntu 22.04 LTS, `asia-south1-a` (Mumbai) | ~$27/mo |
| Static IP | Regional external IP attached to VM | ~$0 (in use) |
| Firebase Hosting | Vue SPA static build | Free |
| Artifact Registry | Not used (Approach B builds on VM) | $0 |

### VM Services (all Docker Compose)

```
GCE e2-medium
└── docker-compose.yml
      ├── postgres    PostgreSQL 15 alpine — app DB + Temporal DB
      ├── redis       Redis 7 alpine
      ├── temporal    temporalio/auto-setup:1.25 (uses postgres)
      ├── app         Node 20 alpine — Express server + Temporal worker via pm2
      └── caddy       Caddy 2 alpine — HTTPS reverse proxy, auto Let's Encrypt
```

### Frontend

Firebase Hosting serves the Vite production build. The build sets `VITE_API_BASE_URL=https://voice-copilot.duckdns.org` (or whatever DuckDNS subdomain is chosen).

### Domain

- **Free option (recommended):** DuckDNS subdomain e.g. `voice-copilot.duckdns.org`
  - Sign up at duckdns.org with Google, create a subdomain, point it at the GCE static IP
  - Caddy auto-provisions a Let's Encrypt HTTPS cert for it — no extra config
- `voice-copilot.duckdns.org` → GCE static IP → Caddy → backend port 3000
- Frontend: `yourproject.web.app` (Firebase default, free HTTPS included)

---

## 3. Key Design Decisions

### Single `app` container for server + worker

`broadcast-sse.activity.ts` hardcodes `http://127.0.0.1:${port}/internal/broadcast`. Splitting server and worker into separate containers would break this localhost call. Running both processes inside one container via pm2 preserves the behavior with zero code changes.

pm2 `ecosystem.config.js` runs:
- `dist/server.js` — Express API
- `dist/workers/temporal-worker.js` — Temporal worker

### PostgreSQL shared between app and Temporal

Temporal's auto-setup image creates its own databases (`temporal`, `temporal_visibility`) inside the shared PostgreSQL instance. The app uses a separate `voice_copilot` database. One PostgreSQL container, two logical databases.

### Secrets management

Secrets (API keys, DB password, GHL webhook secret, etc.) live in a `.env` file on the VM at `/opt/voice-ai-copilot/.env`. This file is **never committed to git**. GitHub Actions secrets hold only:
- `GCE_SSH_PRIVATE_KEY` — SSH key for deploy access
- `GCE_VM_IP` — VM static IP
- `GCE_VM_USER` — SSH username (e.g. `ubuntu`)
- `FIREBASE_SERVICE_ACCOUNT` — Firebase deploy credentials
- `VITE_API_BASE_URL` — public backend URL for frontend build

### Data persistence

PostgreSQL and Redis data are stored in named Docker volumes on the VM disk. **No managed backup is set up initially.** For production hardening, a cron job running `pg_dump` to Cloud Storage should be added later.

---

## 4. Docker Compose Services

```yaml
services:
  postgres:
    image: postgres:15-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: voice_copilot
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    volumes:
      - redis_data:/data

  temporal:
    image: temporalio/auto-setup:1.25
    restart: unless-stopped
    environment:
      DB: postgresql
      DB_PORT: 5432
      POSTGRES_USER: postgres
      POSTGRES_PWD: ${POSTGRES_PASSWORD}
      POSTGRES_SEEDS: postgres
    depends_on:
      - postgres

  app:
    build:
      context: ./backend
    restart: unless-stopped
    environment:
      DATABASE_URL: postgresql://postgres:${POSTGRES_PASSWORD}@postgres:5432/voice_copilot
      REDIS_URL: redis://redis:6379
      TEMPORAL_ADDRESS: temporal:7233
      TEMPORAL_NAMESPACE: default
      GHL_WEBHOOK_SECRET: ${GHL_WEBHOOK_SECRET}
      LLM_PROVIDER: ${LLM_PROVIDER}
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
      GROQ_API_KEY: ${GROQ_API_KEY}
      PORT: 3000
      NODE_ENV: production
    depends_on:
      - postgres
      - redis
      - temporal

  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
    depends_on:
      - app

volumes:
  postgres_data:
  redis_data:
  caddy_data:
```

---

## 5. Dockerfile (backend)

Multi-stage build. Stage 1 compiles TypeScript. Stage 2 is the lean runtime image with pm2.

```dockerfile
# Stage 1 — build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# Stage 2 — runtime
FROM node:20-alpine
WORKDIR /app
RUN npm install -g pm2
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package.json ./
COPY ecosystem.config.js ./
EXPOSE 3000
CMD ["pm2-runtime", "ecosystem.config.js"]
```

`ecosystem.config.js`:
```js
module.exports = {
  apps: [
    { name: 'server', script: 'dist/server.js' },
    { name: 'worker', script: 'dist/workers/temporal-worker.js' }
  ]
}
```

---

## 6. GitHub Actions CI/CD Workflow

Trigger: push to `main`

```
Jobs:
  test
    ├── npm ci (root)
    ├── npm run test -w backend
    └── npm run test -w frontend

  deploy (needs: test)
    ├── Build frontend: npm run build -w frontend (with VITE_API_BASE_URL secret)
    ├── Deploy frontend: Firebase Hosting action
    └── SSH to GCE VM:
          git -C /opt/voice-ai-copilot pull origin main
          docker compose build
          docker compose up -d
          docker compose exec -T app node dist/db/migrate.js
```

---

## 7. One-Time GCP Setup Steps (Manual)

1. Create GCP project, link billing to $300 credits
2. Enable APIs: Compute Engine, Firebase
3. Create `e2-medium` VM, Ubuntu 22.04 LTS, `asia-south1-a` (Mumbai), 20GB boot disk
4. Reserve and attach static external IP
5. Create firewall rules: allow TCP 22, 80, 443 inbound
6. SSH into VM, install Docker + Docker Compose plugin
7. Clone repo to `/opt/voice-ai-copilot`
8. Create `/opt/voice-ai-copilot/.env` with all secrets
9. Add deploy SSH key to VM's `~/.ssh/authorized_keys`
10. Add SSH private key + other secrets to GitHub Actions secrets
11. `firebase init hosting` in the frontend directory, link to Firebase project
12. Register a DuckDNS subdomain (duckdns.org), point it at the GCE static IP
13. First deploy: `docker compose build && docker compose up -d` on the VM
14. Run initial migration: `docker compose exec app node dist/db/migrate.js`

---

## 8. Files to Create

| File | Location |
|---|---|
| `Dockerfile` | `voice-ai-copilot/backend/Dockerfile` |
| `ecosystem.config.js` | `voice-ai-copilot/backend/ecosystem.config.js` |
| `docker-compose.yml` | `voice-ai-copilot/docker-compose.yml` |
| `.env.example` | already exists — update with `POSTGRES_PASSWORD` |
| `Caddyfile` | `voice-ai-copilot/Caddyfile` |
| `.github/workflows/deploy.yml` | `.github/workflows/deploy.yml` |
| `.dockerignore` | `voice-ai-copilot/backend/.dockerignore` |
| `firebase.json` | `voice-ai-copilot/frontend/firebase.json` |
| `.firebaserc` | `voice-ai-copilot/frontend/.firebaserc` |
