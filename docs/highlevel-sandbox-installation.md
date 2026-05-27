# HighLevel Sandbox Setup and Installation Guide

This guide documents how to install and run the Voice AI Copilot observability suite for local development and inside a HighLevel sandbox sub-account.

The current deployed backend and dashboard are hosted at:

```text
https://voice-agent-copilot.duckdns.org
```

The analysis backend is deployed on GCP behind Caddy HTTPS. It runs the Express API, Temporal worker, PostgreSQL, Redis, and Temporal services with Docker Compose. The HighLevel sandbox install uses a private HighLevel app and OAuth location install flow.

---

## 1. System Components

| Component | Purpose |
|---|---|
| Vue dashboard | Observability UI for synced Voice AI agents, KPI configuration, transcript analysis, and simulation |
| Express API | OAuth callback, agent sync, KPI APIs, transcript ingestion, and SSE updates |
| Temporal worker | Runs asynchronous transcript analysis workflows |
| PostgreSQL | Stores locations, OAuth tokens, synced agents, KPI goals, transcripts, and analysis results |
| Redis | Supporting runtime service |
| Caddy | HTTPS reverse proxy for the GCP deployment |
| HighLevel private app | Grants sandbox sub-account access through OAuth |

---

## 2. Local Development Setup

### Prerequisites

- Node.js 20+
- Docker Desktop
- npm
- At least one LLM API key: OpenAI, Anthropic, or Groq

### Install dependencies

```bash
cd voice-ai-copilot
npm install
```

### Configure environment

```bash
cp .env.example .env
```

For local development, set:

```text
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/voice_copilot
REDIS_URL=redis://localhost:6379
TEMPORAL_ADDRESS=localhost:7233
TEMPORAL_NAMESPACE=default
LLM_PROVIDER=openai
OPENAI_API_KEY=<your-key>
PORT=3000
NODE_ENV=development
VITE_API_BASE_URL=http://localhost:3000
```

`GHL_CLIENT_ID` and `GHL_CLIENT_SECRET` can be left empty for local demo mode unless testing OAuth with a tunnel.

### Start local infrastructure

```bash
make infra
```

This starts PostgreSQL, Redis, Temporal, and Temporal UI.

### Run migrations and seed demo data

```bash
make migrate
make seed
```

The seed creates `demo-location-001` with sample agents, so the dashboard can be used without a HighLevel install.

### Start the app locally

```bash
make dev
```

Local URLs:

| Service | URL |
|---|---|
| Frontend | `http://localhost:5173` |
| Backend | `http://localhost:3000` |
| Temporal UI | `http://localhost:8080` |
| Demo dashboard | `http://localhost:5173/?locationId=demo-location-001` |

### Simulate transcript ingestion locally

From another terminal:

```bash
cd voice-ai-copilot/backend
npm run simulate
```

Additional examples:

```bash
npm run simulate -- ghl-ag-1 pass
npm run simulate -- ghl-ag-1 fail
npm run simulate -- all
```

This posts a signed mock webhook to the local backend and exercises the full analysis path: webhook ingestion, Temporal workflow, LLM analysis, persistence, and SSE update.

---

## 3. GCP Backend Deployment

The backend around analysis has already been deployed on GCP at:

```text
https://voice-agent-copilot.duckdns.org
```

The deployed stack runs through Docker Compose:

| Service | Runtime role |
|---|---|
| `app` | Express API and Temporal worker via pm2 |
| `postgres` | Application database |
| `redis` | Redis runtime service |
| `temporal` | Temporal server |
| `caddy` | HTTPS reverse proxy and static frontend hosting |

The deployed backend must have these production environment values configured:

```text
APP_URL=https://voice-agent-copilot.duckdns.org
DUCKDNS_DOMAIN=voice-agent-copilot.duckdns.org
GHL_CLIENT_ID=6a1621b8baab5b591f8bf450-mpn9rfzh
GHL_CLIENT_SECRET=<private-app-secret>
LLM_PROVIDER=<openai|anthropic|groq>
OPENAI_API_KEY=<if using OpenAI>
ANTHROPIC_API_KEY=<if using Anthropic>
GROQ_API_KEY=<if using Groq>
POSTGRES_PASSWORD=<production-password>
GHL_WEBHOOK_SECRET=<legacy-mock-webhook-secret>
```

### GCP runtime verification

SSH into the GCP VM and run:

```bash
cd /opt/voice-ai-copilot/voice-ai-copilot
docker compose ps
```

Expected result: `app`, `postgres`, `redis`, `temporal`, and `caddy` are running.

Check the public health endpoint:

```bash
curl https://voice-agent-copilot.duckdns.org/health
```

Expected result:

```json
{"status":"ok","timestamp":"..."}
```

If the deployment was updated, rebuild and restart:

```bash
docker compose build
docker compose up -d
docker compose exec app node dist/db/migrate.js
```

---

## 4. HighLevel Private App Setup

A private HighLevel app has been created for the sandbox install flow.

### OAuth install URL

Open this URL while logged into the target HighLevel sandbox account:

```text
https://marketplace.gohighlevel.com/v2/oauth/chooselocation?response_type=code&redirect_uri=https%3A%2F%2Fvoice-agent-copilot.duckdns.org%2Foauth%2Fcallback&client_id=6a1621b8baab5b591f8bf450-mpn9rfzh&scope=voice-ai-dashboard.readonly+voice-ai-agents.readonly+voice-ai-agents.write+voice-ai-agent-goals.readonly+voice-ai-agent-goals.write+oauth.write+oauth.readonly&version_id=6a1621b8baab5b591f8bf450
```

### Required app settings

| Setting | Value |
|---|---|
| Redirect URI | `https://voice-agent-copilot.duckdns.org/oauth/callback` |
| Install target | Sub-account/location |
| OAuth callback | `GET /oauth/callback` |
| Main webhook endpoint | `POST /webhooks/ghl` |

### Required scopes

```text
voice-ai-dashboard.readonly
voice-ai-agents.readonly
voice-ai-agents.write
voice-ai-agent-goals.readonly
voice-ai-agent-goals.write
oauth.write
oauth.readonly
```

---

## 5. Install in a HighLevel Sandbox

1. Log in to the HighLevel sandbox account.
2. Open the private app OAuth install URL above.
3. Choose the sandbox sub-account/location to install into.
4. Approve the requested scopes.
5. HighLevel redirects to:

```text
https://voice-agent-copilot.duckdns.org/oauth/callback
```

6. The backend exchanges the OAuth code for a location token.
7. The backend stores the token against the HighLevel `locationId`.
8. The user is redirected to the observability dashboard:

```text
https://voice-agent-copilot.duckdns.org/?locationId=<HIGHLEVEL_LOCATION_ID>&installed=1
```

At this point, the HighLevel sandbox location is connected, but agents are not automatically imported yet.

---

## 6. Sync Voice AI Agents

Any Voice AI agent connected to the installed HighLevel sub-account can be synced into the observability dashboard.

### Sync from the dashboard

1. Open the dashboard URL returned after install.
2. Confirm the left sidebar shows the installed `locationId`.
3. Click `Sync from HighLevel`.
4. The dashboard calls:

```http
POST /api/agents/sync?locationId=<HIGHLEVEL_LOCATION_ID>
```

5. The backend calls the HighLevel Voice AI agent APIs using the stored OAuth token.
6. Synced agents appear on the dashboard.

### Sync from curl

```bash
curl -X POST "https://voice-agent-copilot.duckdns.org/api/agents/sync?locationId=<HIGHLEVEL_LOCATION_ID>"
```

Expected response:

```json
{"synced":1}
```

The number depends on how many Voice AI agents are available in the installed sandbox sub-account.

---

## 7. Configure KPI Goals

After agents are synced:

1. Open an agent from the dashboard.
2. Review the synced script/prompt.
3. Configure KPI goals and the success threshold.
4. Save the KPI configuration.

Transcript analysis requires a KPI config for the agent. If a transcript is received before KPI goals are configured, the transcript can be stored but no analysis workflow will be started for that transcript.

---

## 8. Transcript Webhook Status

The server is implemented to listen for HighLevel marketplace webhooks at:

```text
POST https://voice-agent-copilot.duckdns.org/webhooks/ghl
```

Implemented webhook handling:

| Event | Status | Notes |
|---|---|---|
| `INSTALL` | Implemented | Used for install/token setup where applicable |
| `UNINSTALL` | Implemented | Removes stored location connection |
| `VoiceAiCallEnd` | Implemented | Parses transcript, stores it, starts Temporal analysis workflow |

Current validation status:

- The live HighLevel `VoiceAiCallEnd` webhook has not been end-to-end tested because the required Voice AI integrations were not available on the current account.
- The server-side listener and transcript analysis pipeline have been completed.
- The transcript ingestion flow has been tested using mock webhook simulation.
- Mock simulations validate webhook ingestion, transcript storage, Temporal workflow execution, LLM analysis, result persistence, and dashboard SSE refresh.

For demo and QA, use the mock simulation flow until the HighLevel account has the required Voice AI webhook integrations available.

---

## 9. Run the Observability Suite in Sandbox

Use this checklist for a sandbox demo or evaluator handoff:

1. Confirm the deployed backend is healthy:

```bash
curl https://voice-agent-copilot.duckdns.org/health
```

2. Install the private app into a sandbox sub-account using the OAuth URL.
3. Confirm redirect lands on:

```text
https://voice-agent-copilot.duckdns.org/?locationId=<HIGHLEVEL_LOCATION_ID>&installed=1
```

4. Click `Sync from HighLevel`.
5. Confirm agents appear in the dashboard.
6. Open an agent and configure KPI goals.
7. Run a mock transcript analysis if live Voice AI webhooks are unavailable.
8. Verify that the dashboard updates with score, pass/fail status, KPI breakdown, use-action flags, and script suggestions.

### Mock analysis on the deployed sandbox

If live HighLevel transcript webhooks are unavailable, run a mock analysis from the GCP VM after the target agent has been synced and configured with KPI goals:

```bash
cd /opt/voice-ai-copilot/voice-ai-copilot
docker compose exec \
  -e SIMULATE_LOCATION_ID=<HIGHLEVEL_LOCATION_ID> \
  -e SIMULATE_AGENT_ID=<HIGHLEVEL_AGENT_ID> \
  app node dist/scripts/simulate-webhook.js all
```

Then refresh the dashboard for the same `locationId` and open the synced agent. The new analysis cards should appear after the Temporal workflow completes.

---

## 10. Troubleshooting

### OAuth callback returns "Not configured"

Check that the GCP `.env` contains:

```text
APP_URL=https://voice-agent-copilot.duckdns.org
GHL_CLIENT_ID=6a1621b8baab5b591f8bf450-mpn9rfzh
GHL_CLIENT_SECRET=<private-app-secret>
```

Restart after changes:

```bash
docker compose up -d
```

### Dashboard opens but no agents appear

Click `Sync from HighLevel`. If it fails, verify:

- The app was installed into the same sub-account being viewed.
- The URL contains the correct `locationId`.
- The backend has a stored token for that `locationId`.
- The HighLevel sub-account has Voice AI agents configured.

### Sync fails after a long delay

The backend supports refreshing expired HighLevel tokens. If refresh fails, reinstall the private app into the sandbox sub-account and retry sync.

### Transcript does not analyze

Verify:

- The agent is synced.
- The agent has KPI goals configured.
- Temporal worker is running.
- The webhook payload contains `locationId`, `agentId`, `id`, and transcript text.

### Live HighLevel transcript webhook is unavailable

Use the mock simulation path. This is the current tested path because live Voice AI transcript integrations were not available on the account used during implementation.
