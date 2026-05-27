# Voice AI Copilot

Real-time observability and coaching platform for GoHighLevel Voice AI agents. Every call transcript is automatically scored against configurable KPI goals, actionable coaching moments are surfaced, and script improvements are suggested — live in the dashboard the moment a call ends.

---

## What It Does

- **Ingests** call transcripts via GHL marketplace webhooks (`VoiceAiCallEnd`)
- **Analyzes** transcripts against per-agent KPI goals using OpenAI / Anthropic / Groq
- **Scores** each call deterministically (weighted average, not from LLM)
- **Flags** missed opportunities, script deviations, and escalation needs
- **Streams** results to a Vue 3 dashboard in real-time via SSE
- **Suggests** script improvements based on what worked and what didn't

## Docs

| Document | Contents |
|----------|----------|
| [Architecture](docs/architecture.md) | System design, data flow, DB schema, tech stack, real vs mock |
| [Product & Implementation](docs/product.md) | UX rationale, thought process, implementation decisions |
| [Demo Guide](docs/demo-guide.md) | Demo transcripts, showcase walkthrough (internal) |
| [Future Scope](docs/future-scope.md) | Roadmap and planned improvements |

---

## Quick Start (Local Development)

### Prerequisites

- Node.js 20+, Docker Desktop
- API key for one LLM provider (OpenAI / Anthropic / Groq)

### 1. Start infrastructure

```bash
cd voice-ai-copilot
make infra
```

Starts: Postgres (5432), Redis (6379), Temporal (7233), Temporal UI (8080)

### 2. Configure environment

```bash
cp .env.example .env
# Fill in: LLM_PROVIDER, OPENAI_API_KEY (or equivalent)
# GHL_CLIENT_ID and GHL_CLIENT_SECRET can be left empty for local dev
```

### 3. Migrate and seed

```bash
make migrate
make seed
```

### 4. Start dev servers

```bash
make dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3000
- Temporal UI: http://localhost:8080

The seed creates `demo-location-001` with sample agents so the dashboard works immediately without a GHL install.

---

## Production Deployment (GCP + Docker Compose)

### Prerequisites

- Linux VM with Docker + Docker Compose
- Domain pointed at server (DuckDNS free subdomain works)
- GHL marketplace app with client credentials

### 1. Clone, configure, build

```bash
git clone <repo-url> && cd voice-ai-copilot
cp .env.example .env          # fill in all values
cd frontend && npm install && npm run build && cd ..
```

### 2. Start and migrate

```bash
sudo docker compose up -d
sudo docker compose exec app npm run db:migrate
```

### 3. Install GHL marketplace app

See the [GHL Marketplace Setup](docs/architecture.md#ghl-marketplace-setup) section in the architecture doc.

After install, sync agents:
```bash
curl -X POST "https://your-domain/api/agents/sync?locationId=YOUR_LOCATION_ID"
```

### Health check

```bash
curl https://your-domain/health   # → {"ok":true}
sudo docker compose ps            # all services running
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vue 3, TypeScript, Vite, Pinia |
| Backend | Node.js, Express, TypeScript |
| Workflow engine | Temporal (self-hosted) |
| Database | PostgreSQL 15 |
| Reverse proxy | Caddy 2 (automatic HTTPS) |
| LLM | OpenAI / Anthropic / Groq |
