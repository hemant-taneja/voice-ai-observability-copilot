# GCP Deployment + CI/CD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy voice-ai-copilot to a single GCE e2-medium VM (Mumbai) with Docker Compose + Firebase Hosting for the frontend, auto-deploying on every push to `main` via GitHub Actions.

**Architecture:** All backend services (Postgres, Redis, Temporal server, Express API, Temporal worker) run in Docker Compose on one VM. The Express server and Temporal worker share a single container managed by pm2 so that localhost-based SSE broadcasting works without code changes. The Vue frontend is built in CI and deployed to Firebase Hosting.

**Tech Stack:** Docker, Docker Compose, pm2, Caddy (HTTPS reverse proxy), GitHub Actions, Firebase Hosting, GCP Compute Engine (e2-medium, asia-south1), DuckDNS (free subdomain), temporalio/auto-setup, Node 20 alpine.

---

## File Map

| Action | File |
|---|---|
| Create | `voice-ai-copilot/backend/Dockerfile` |
| Create | `voice-ai-copilot/backend/ecosystem.config.js` |
| Create | `voice-ai-copilot/backend/.dockerignore` |
| Create | `voice-ai-copilot/docker-compose.yml` |
| Create | `voice-ai-copilot/Caddyfile` |
| Modify | `voice-ai-copilot/.env.example` |
| Create | `voice-ai-copilot/frontend/firebase.json` |
| Create | `voice-ai-copilot/frontend/.firebaserc` |
| Create | `.github/workflows/deploy.yml` |

---

## Task 1: Backend Dockerfile, .dockerignore, and ecosystem.config.js

**Files:**
- Create: `voice-ai-copilot/backend/Dockerfile`
- Create: `voice-ai-copilot/backend/.dockerignore`
- Create: `voice-ai-copilot/backend/ecosystem.config.js`

**Context:** The build runs from `./backend` as Docker context (set in docker-compose.yml). The migrate script reads SQL files via `__dirname + '/migrations/...'` — after `tsc` only `.ts` → `.js` is copied, so we must manually copy the `.sql` files into `dist/db/migrations/` in the runtime stage.

- [ ] **Step 1: Create `.dockerignore`**

  File: `voice-ai-copilot/backend/.dockerignore`

  ```
  node_modules
  dist
  .env
  .env.*
  !.env.example
  *.log
  coverage
  .nyc_output
  ```

- [ ] **Step 2: Create `ecosystem.config.js`**

  File: `voice-ai-copilot/backend/ecosystem.config.js`

  ```js
  module.exports = {
    apps: [
      { name: 'server', script: 'dist/server.js', instances: 1 },
      { name: 'worker', script: 'dist/workers/temporal-worker.js', instances: 1 },
    ],
  }
  ```

- [ ] **Step 3: Create `Dockerfile`**

  File: `voice-ai-copilot/backend/Dockerfile`

  ```dockerfile
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

  # Compiled JS
  COPY --from=builder /app/dist ./dist

  # SQL migration files — tsc does not copy .sql, so copy manually
  COPY src/db/migrations ./dist/db/migrations

  # pm2 config
  COPY ecosystem.config.js ./

  RUN npm install -g pm2

  EXPOSE 3000
  CMD ["pm2-runtime", "ecosystem.config.js"]
  ```

- [ ] **Step 4: Verify the image builds locally**

  Run from `voice-ai-copilot/` directory:
  ```bash
  docker build -t vac-backend-test ./backend
  ```
  Expected: Build completes, final image tagged `vac-backend-test`. No errors.

- [ ] **Step 5: Confirm SQL files are present in the image**

  ```bash
  docker run --rm vac-backend-test ls dist/db/migrations
  ```
  Expected output includes `001_initial.sql` and `002_script_suggestions.sql`.

- [ ] **Step 6: Clean up test image**

  ```bash
  docker rmi vac-backend-test
  ```

- [ ] **Step 7: Commit**

  ```bash
  git add voice-ai-copilot/backend/Dockerfile voice-ai-copilot/backend/.dockerignore voice-ai-copilot/backend/ecosystem.config.js
  git commit -m "feat(deploy): add backend Dockerfile, dockerignore, pm2 config"
  ```

---

## Task 2: docker-compose.yml

**Files:**
- Create: `voice-ai-copilot/docker-compose.yml`

**Context:** Five services: `postgres`, `redis`, `temporal`, `app`, `caddy`. The `app` service is built from `./backend`. Temporal uses the same Postgres instance as the app (different logical databases). The `app` container has all required env vars; secrets come from the `.env` file on the VM.

- [ ] **Step 1: Create `docker-compose.yml`**

  File: `voice-ai-copilot/docker-compose.yml`

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
      healthcheck:
        test: ["CMD-SHELL", "pg_isready -U postgres"]
        interval: 5s
        timeout: 5s
        retries: 10

    redis:
      image: redis:7-alpine
      restart: unless-stopped
      volumes:
        - redis_data:/data

    temporal:
      image: temporalio/auto-setup:1.25.0
      restart: unless-stopped
      environment:
        DB: postgresql
        DB_PORT: 5432
        POSTGRES_USER: postgres
        POSTGRES_PWD: ${POSTGRES_PASSWORD}
        POSTGRES_SEEDS: postgres
      depends_on:
        postgres:
          condition: service_healthy

    app:
      build:
        context: ./backend
      restart: unless-stopped
      environment:
        DATABASE_URL: postgresql://postgres:${POSTGRES_PASSWORD}@postgres:5432/voice_copilot
        REDIS_URL: redis://redis:6379
        TEMPORAL_ADDRESS: temporal:7233
        TEMPORAL_NAMESPACE: default
        GHL_CLIENT_ID: ${GHL_CLIENT_ID}
        GHL_CLIENT_SECRET: ${GHL_CLIENT_SECRET}
        GHL_WEBHOOK_SECRET: ${GHL_WEBHOOK_SECRET}
        LLM_PROVIDER: ${LLM_PROVIDER}
        OPENAI_API_KEY: ${OPENAI_API_KEY}
        ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
        GROQ_API_KEY: ${GROQ_API_KEY}
        PORT: 3000
        NODE_ENV: production
      depends_on:
        postgres:
          condition: service_healthy
        redis:
          condition: service_started
        temporal:
          condition: service_started

    caddy:
      image: caddy:2-alpine
      restart: unless-stopped
      ports:
        - "80:80"
        - "443:443"
        - "443:443/udp"
      volumes:
        - ./Caddyfile:/etc/caddy/Caddyfile:ro
        - caddy_data:/data
        - caddy_config:/config
      depends_on:
        - app

  volumes:
    postgres_data:
    redis_data:
    caddy_data:
    caddy_config:
  ```

- [ ] **Step 2: Validate the Compose file**

  Run from `voice-ai-copilot/` directory:
  ```bash
  docker compose config
  ```
  Expected: Prints the fully resolved config with no errors. All service names, ports, and volumes listed correctly.

- [ ] **Step 3: Commit**

  ```bash
  git add voice-ai-copilot/docker-compose.yml
  git commit -m "feat(deploy): add docker-compose.yml with all services"
  ```

---

## Task 3: Caddyfile and .env.example update

**Files:**
- Create: `voice-ai-copilot/Caddyfile`
- Modify: `voice-ai-copilot/.env.example`

**Context:** Caddy acts as HTTPS reverse proxy. When the VM's IP is pointed at by the DuckDNS subdomain, Caddy auto-provisions a Let's Encrypt cert. `DUCKDNS_DOMAIN` is a variable so the actual subdomain is set in the `.env` file on the VM, not hardcoded.

- [ ] **Step 1: Create `Caddyfile`**

  File: `voice-ai-copilot/Caddyfile`

  ```
  {env.DUCKDNS_DOMAIN} {
      reverse_proxy app:3000
  }
  ```

  Caddy reads `DUCKDNS_DOMAIN` from the environment at startup (e.g. `voice-copilot.duckdns.org`). Let's Encrypt cert is provisioned automatically on first request.

- [ ] **Step 2: Update `docker-compose.yml` to pass `DUCKDNS_DOMAIN` to Caddy**

  Open `voice-ai-copilot/docker-compose.yml`. In the `caddy` service, add an `environment` block:

  ```yaml
    caddy:
      image: caddy:2-alpine
      restart: unless-stopped
      environment:
        DUCKDNS_DOMAIN: ${DUCKDNS_DOMAIN}
      ports:
        - "80:80"
        - "443:443"
        - "443:443/udp"
      volumes:
        - ./Caddyfile:/etc/caddy/Caddyfile:ro
        - caddy_data:/data
        - caddy_config:/config
      depends_on:
        - app
  ```

- [ ] **Step 3: Update `.env.example`**

  Open `voice-ai-copilot/.env.example` and add the two new required variables:

  ```bash
  # Database password (used by Docker Compose for postgres + Temporal)
  POSTGRES_PASSWORD=change-me-in-production

  # DuckDNS subdomain for HTTPS (e.g. voice-copilot.duckdns.org)
  DUCKDNS_DOMAIN=your-subdomain.duckdns.org
  ```

  Add these after the existing `# Database` block.

- [ ] **Step 4: Validate updated Compose file**

  ```bash
  docker compose config
  ```
  Expected: No errors, `DUCKDNS_DOMAIN` appears in caddy service environment.

- [ ] **Step 5: Commit**

  ```bash
  git add voice-ai-copilot/Caddyfile voice-ai-copilot/docker-compose.yml voice-ai-copilot/.env.example
  git commit -m "feat(deploy): add Caddyfile for HTTPS and update env.example"
  ```

---

## Task 4: Firebase Hosting config

**Files:**
- Create: `voice-ai-copilot/frontend/firebase.json`
- Create: `voice-ai-copilot/frontend/.firebaserc`

**Context:** Firebase Hosting serves the Vite `dist/` output. The `rewrites` rule redirects all paths to `index.html` so Vue Router's history mode works. `.firebaserc` contains a placeholder project ID — the user must replace it with their Firebase project ID after running `firebase init` (or edit it directly after creating the project in the Firebase console).

- [ ] **Step 1: Create `firebase.json`**

  File: `voice-ai-copilot/frontend/firebase.json`

  ```json
  {
    "hosting": {
      "public": "dist",
      "ignore": [
        "firebase.json",
        "**/.*",
        "**/node_modules/**"
      ],
      "rewrites": [
        {
          "source": "**",
          "destination": "/index.html"
        }
      ],
      "headers": [
        {
          "source": "/assets/**",
          "headers": [
            { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
          ]
        }
      ]
    }
  }
  ```

- [ ] **Step 2: Create `.firebaserc`**

  File: `voice-ai-copilot/frontend/.firebaserc`

  ```json
  {
    "projects": {
      "default": "REPLACE_WITH_YOUR_FIREBASE_PROJECT_ID"
    }
  }
  ```

  **Action required:** Replace `REPLACE_WITH_YOUR_FIREBASE_PROJECT_ID` with the actual Firebase project ID after creating the project at console.firebase.google.com.

- [ ] **Step 3: Commit**

  ```bash
  git add voice-ai-copilot/frontend/firebase.json voice-ai-copilot/frontend/.firebaserc
  git commit -m "feat(deploy): add Firebase Hosting config for Vue SPA"
  ```

---

## Task 5: GitHub Actions CI/CD workflow

**Files:**
- Create: `.github/workflows/deploy.yml`

**Context:** Two jobs — `test` (always runs) and `deploy` (runs only on `main`, needs `test` to pass). The deploy job: builds the frontend with `VITE_API_BASE_URL` injected at build time, deploys it to Firebase, then SSHes into the GCE VM and runs `git pull → docker compose build → docker compose up -d → migrate`. The `appleboy/ssh-action` handles the SSH step. Backend tests work without real infrastructure because `test-setup.ts` sets stub env vars before each test file loads.

**Required GitHub Actions secrets (set these in repo Settings → Secrets → Actions):**

| Secret | Value |
|---|---|
| `GCE_VM_IP` | Static IP of the GCE VM |
| `GCE_VM_USER` | SSH username on the VM (e.g. `ubuntu`) |
| `GCE_SSH_PRIVATE_KEY` | Private key matching the public key added to the VM |
| `FIREBASE_SERVICE_ACCOUNT` | JSON service account key from Firebase console |
| `FIREBASE_PROJECT_ID` | Your Firebase project ID |
| `VITE_API_BASE_URL` | e.g. `https://voice-copilot.duckdns.org` |

- [ ] **Step 1: Create `.github/workflows/deploy.yml`**

  File: `.github/workflows/deploy.yml`

  ```yaml
  name: Test & Deploy

  on:
    push:
      branches: [main]

  jobs:
    test:
      name: Run tests
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4

        - uses: actions/setup-node@v4
          with:
            node-version: 20
            cache: npm

        - name: Install dependencies
          run: npm ci

        - name: Backend tests
          run: npm run test -w backend

        - name: Frontend tests
          run: npm run test -w frontend

    deploy:
      name: Deploy
      needs: test
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4

        - uses: actions/setup-node@v4
          with:
            node-version: 20
            cache: npm

        - name: Install dependencies
          run: npm ci

        - name: Build frontend
          run: npm run build -w frontend
          env:
            VITE_API_BASE_URL: ${{ secrets.VITE_API_BASE_URL }}

        - name: Deploy frontend to Firebase Hosting
          uses: FirebaseExtended/action-hosting-deploy@v0
          with:
            repoToken: ${{ secrets.GITHUB_TOKEN }}
            firebaseServiceAccount: ${{ secrets.FIREBASE_SERVICE_ACCOUNT }}
            projectId: ${{ secrets.FIREBASE_PROJECT_ID }}
            channelId: live
            entryPoint: voice-ai-copilot/frontend

        - name: Deploy backend to GCE VM
          uses: appleboy/ssh-action@v1
          with:
            host: ${{ secrets.GCE_VM_IP }}
            username: ${{ secrets.GCE_VM_USER }}
            key: ${{ secrets.GCE_SSH_PRIVATE_KEY }}
            script: |
              set -e
              cd /opt/voice-ai-copilot
              git pull origin main
              docker compose build
              docker compose up -d
              echo "Waiting for services to be healthy..."
              sleep 20
              docker compose exec -T app node dist/db/migrate.js
              echo "Deploy complete."
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add .github/workflows/deploy.yml
  git commit -m "feat(deploy): add GitHub Actions CI/CD workflow"
  ```

---

## Task 6: One-time GCP + Firebase manual setup

**Context:** These steps are run once by a human, not automated. Do them in order. Steps 1–10 set up the VM. Steps 11–14 set up Firebase. Step 15 is the first deploy.

### GCP VM Setup

- [ ] **Step 1: Create a GCP project**

  Go to console.cloud.google.com → New Project. Name it (e.g. `voice-ai-copilot`). Link billing to your $300 free credits account.

- [ ] **Step 2: Enable required APIs**

  In the GCP console, go to APIs & Services → Enable APIs:
  - Compute Engine API
  - (Firebase is managed separately at firebase.google.com)

- [ ] **Step 3: Reserve a static external IP**

  GCP Console → VPC Network → IP addresses → Reserve External Static Address.
  - Region: `asia-south1`
  - Name: `voice-ai-copilot-ip`

  Note the IP address — you'll need it for DuckDNS and GitHub secrets.

- [ ] **Step 4: Create the VM**

  GCP Console → Compute Engine → Create Instance:
  - Name: `voice-ai-copilot`
  - Region: `asia-south1` (Mumbai), Zone: `asia-south1-a`
  - Machine type: `e2-medium` (2 vCPU, 4 GB RAM)
  - Boot disk: Ubuntu 22.04 LTS, 25 GB SSD
  - Network → External IP: select the static IP reserved in Step 3
  - Firewall: check "Allow HTTP traffic" and "Allow HTTPS traffic"

- [ ] **Step 5: Create firewall rule for SSH**

  GCP Console → VPC Network → Firewall → Create Rule:
  - Name: `allow-ssh`
  - Direction: Ingress
  - Source IP: `0.0.0.0/0`
  - Protocols/Ports: TCP 22

- [ ] **Step 6: SSH into the VM and install Docker**

  Click SSH in the GCP console, then run:
  ```bash
  sudo apt-get update
  sudo apt-get install -y ca-certificates curl gnupg
  sudo install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  sudo chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list
  sudo apt-get update
  sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  sudo usermod -aG docker $USER
  ```
  Log out and back in for the group change to take effect.

- [ ] **Step 7: Clone the repo onto the VM**

  ```bash
  sudo mkdir -p /opt/voice-ai-copilot
  sudo chown $USER:$USER /opt/voice-ai-copilot
  git clone https://github.com/YOUR_ORG/YOUR_REPO.git /opt/voice-ai-copilot
  ```

- [ ] **Step 8: Create the `.env` file on the VM**

  ```bash
  cp /opt/voice-ai-copilot/voice-ai-copilot/.env.example /opt/voice-ai-copilot/voice-ai-copilot/.env
  nano /opt/voice-ai-copilot/voice-ai-copilot/.env
  ```

  Fill in all values:
  ```
  DATABASE_URL=postgresql://postgres:YOUR_STRONG_PASSWORD@postgres:5432/voice_copilot
  REDIS_URL=redis://redis:6379
  TEMPORAL_ADDRESS=temporal:7233
  TEMPORAL_NAMESPACE=default
  GHL_CLIENT_ID=your-ghl-client-id
  GHL_CLIENT_SECRET=your-ghl-client-secret
  GHL_WEBHOOK_SECRET=your-strong-webhook-secret
  LLM_PROVIDER=openai
  OPENAI_API_KEY=sk-...
  ANTHROPIC_API_KEY=
  GROQ_API_KEY=
  PORT=3000
  NODE_ENV=production
  POSTGRES_PASSWORD=YOUR_STRONG_PASSWORD
  DUCKDNS_DOMAIN=voice-copilot.duckdns.org
  ```
  `POSTGRES_PASSWORD` must match the password in `DATABASE_URL`.

- [ ] **Step 9: Generate and add deploy SSH key**

  On your **local machine** (not the VM):
  ```bash
  ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/gce_deploy_key -N ""
  cat ~/.ssh/gce_deploy_key.pub
  ```

  Copy the public key output. On the VM:
  ```bash
  echo "PASTE_PUBLIC_KEY_HERE" >> ~/.ssh/authorized_keys
  chmod 600 ~/.ssh/authorized_keys
  ```

  The private key (`~/.ssh/gce_deploy_key` content) goes into GitHub secret `GCE_SSH_PRIVATE_KEY`.

- [ ] **Step 10: Set up DuckDNS**

  1. Go to duckdns.org, sign in with Google
  2. Create a subdomain (e.g. `voice-copilot`)
  3. Set its IP to the GCE static IP from Step 3
  4. Verify: `ping voice-copilot.duckdns.org` should resolve to your GCE IP

### Firebase Setup

- [ ] **Step 11: Create Firebase project**

  Go to console.firebase.google.com → Add project → link to the same GCP project created in Step 1. Enable Hosting.

- [ ] **Step 12: Update `.firebaserc` with real project ID**

  In your local repo, open `voice-ai-copilot/frontend/.firebaserc` and replace `REPLACE_WITH_YOUR_FIREBASE_PROJECT_ID` with your actual Firebase project ID (found in Firebase Console → Project Settings).

  Commit the change:
  ```bash
  git add voice-ai-copilot/frontend/.firebaserc
  git commit -m "chore: set Firebase project ID"
  git push origin main
  ```

- [ ] **Step 13: Generate Firebase service account for GitHub Actions**

  Firebase Console → Project Settings → Service Accounts → Generate New Private Key. Download the JSON file.

  In GitHub repo → Settings → Secrets → Actions, add:
  - `FIREBASE_SERVICE_ACCOUNT` = paste the entire JSON content
  - `FIREBASE_PROJECT_ID` = your project ID

- [ ] **Step 14: Add remaining GitHub Actions secrets**

  | Secret | Value |
  |---|---|
  | `GCE_VM_IP` | The static IP from GCP Step 3 |
  | `GCE_VM_USER` | Your VM username (run `whoami` on the VM) |
  | `GCE_SSH_PRIVATE_KEY` | Content of `~/.ssh/gce_deploy_key` (private key) |
  | `VITE_API_BASE_URL` | `https://voice-copilot.duckdns.org` |

### First Deploy

- [ ] **Step 15: Run the first deploy manually on the VM**

  SSH into the VM:
  ```bash
  cd /opt/voice-ai-copilot/voice-ai-copilot
  docker compose build
  docker compose up -d
  ```

  Wait 30 seconds for Temporal to fully initialise, then run migrations:
  ```bash
  docker compose exec app node dist/db/migrate.js
  ```
  Expected: `✓ Migrations complete`

- [ ] **Step 16: Verify all services are running**

  ```bash
  docker compose ps
  ```
  Expected: All 5 services show `Up` or `running` status.

  ```bash
  curl http://localhost:3000/health
  ```
  Expected: `{"status":"ok","timestamp":"..."}`

- [ ] **Step 17: Verify HTTPS is working**

  From your local machine (after DuckDNS propagates, usually instant):
  ```bash
  curl https://voice-copilot.duckdns.org/health
  ```
  Expected: `{"status":"ok","timestamp":"..."}` — Caddy has auto-provisioned the Let's Encrypt cert.

- [ ] **Step 18: Trigger the first automated deploy**

  Make a trivial commit and push to `main`:
  ```bash
  git commit --allow-empty -m "chore: trigger first automated deploy"
  git push origin main
  ```

  In GitHub → Actions, watch the `Test & Deploy` workflow run. Both jobs should go green.

---

## Self-Review Notes

- **Spec coverage:** All 9 files from the spec's file map are accounted for across Tasks 1–5. One-time GCP setup is covered in Task 6.
- **SQL migrations:** Explicitly handled in Task 1 Step 3 (`COPY src/db/migrations ./dist/db/migrations`) — without this, `migrate.js` would fail with ENOENT at runtime.
- **DuckDNS_DOMAIN in caddy service:** Added to docker-compose in Task 3 Step 2 so Caddy receives it as an environment variable.
- **Health check on postgres:** Added `healthcheck` to postgres and `condition: service_healthy` on dependents so Temporal and app wait for Postgres to be ready before starting.
- **Migration timing:** `sleep 20` before migrations gives Temporal time to finish its own schema setup in Postgres after `docker compose up -d`. Not elegant but reliable for this setup.
