# Voice AI Observability Copilot

Real-time KPI dashboard and call analysis engine for GoHighLevel AI voice agents.

## What It Does

- **Ingests** GHL webhook events when AI voice calls complete
- **Analyzes** transcripts with GPT-4o or Claude Haiku via Temporal durable workflows
- **Streams** results to a Vue 3 dashboard over SSE
- **Embeds** a compact widget in the GHL marketplace iframe

## Architecture

```
GHL Webhook → Express (HMAC verified) → TranscriptService
                                         ↓
                              Temporal: analyzeCallWorkflow
                                   ↓              ↓
                             GPT-4o/Haiku    PostgreSQL
                                         ↓
                              SSE broadcast → Vue 3 Dashboard
```

## Quick Start

### Prerequisites
- Node.js 20+
- Docker Desktop
- ngrok (for GHL webhook tunnel)

### 1. Start infrastructure

```bash
cd voice-ai-copilot
make infra
```

Starts: Postgres (5432), Postgres test (5433), Redis (6379), Temporal (7233), Temporal UI (8080)

### 2. Configure environment

```bash
cp .env.example .env
# Fill in GHL_CLIENT_ID, GHL_CLIENT_SECRET, GHL_WEBHOOK_SECRET
# Set LLM_PROVIDER=openai and OPENAI_API_KEY=sk-...
```

### 3. Run migrations + seed

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

### 5. Expose webhook to GHL

```bash
make ngrok
# Copy the HTTPS URL → GHL Settings → Custom Webhook
```

## Testing

```bash
make test
```

Backend: 40+ Jest tests
Frontend: 16+ Vitest tests

## API Reference

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /webhooks/call-completed | HMAC | Ingest call transcript |
| GET | /api/agents | locationId | List agents with metrics |
| GET | /api/agents/:id | locationId | Agent detail + analyses |
| GET | /api/kpi/:agentId | locationId | Get KPI config |
| PUT | /api/kpi/:agentId | locationId | Upsert KPI config |
| GET | /stream | locationId | SSE real-time stream |

## KPI Configuration

Define goals per agent via `PUT /api/kpi/:agentId`:

```json
{
  "goals": [
    { "name": "Book Appointment", "description": "Confirm a specific slot", "weight": 0.6 },
    { "name": "Handle Objection", "description": "Address concerns professionally", "weight": 0.4 }
  ],
  "successThreshold": 0.70
}
```

## GHL Widget

Embed the compact widget in the GHL marketplace:

```
https://your-app.com/widget.html?locationId={location_id}
```

Shows real-time agent performance with live SSE updates.

## Tech Stack

| Layer | Tech |
|-------|------|
| Backend | Node.js + Express + TypeScript |
| Workflow | Temporal (durable, retries, backoff) |
| LLM | OpenAI GPT-4o / Anthropic Claude Haiku |
| Database | PostgreSQL 16 (via pg Pool) |
| Frontend | Vue 3 + Vite + Pinia + TypeScript |
| Auth | GHL OAuth 2.0 + HMAC webhook signatures |
| Realtime | Server-Sent Events (SSE) |
