# Technical Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│  GoHighLevel Platform                                               │
│                                                                     │
│  Voice AI Agent ──→ Call ends ──→ VoiceAiCallEnd webhook           │
│  Marketplace    ──→ Install   ──→ OAuth callback + INSTALL webhook  │
└────────────────────────────┬────────────────────────────────────────┘
                             │ HTTPS
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Caddy (Reverse Proxy + HTTPS via DuckDNS/Let's Encrypt)           │
│                                                                     │
│  /oauth/*     → app:3000                                            │
│  /webhooks/*  → app:3000                                            │
│  /api/*       → app:3000                                            │
│  /stream*     → app:3000  (SSE, flush_interval -1)                 │
│  /*           → /srv/frontend  (Vue SPA)                            │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Node.js / Express Backend (app:3000)                              │
│                                                                     │
│  GET  /oauth/callback           OAuth token exchange                │
│  POST /webhooks/ghl             Marketplace events (Ed25519)        │
│  POST /webhooks/call-completed  Legacy webhook (HMAC)              │
│  GET  /api/agents               List agents + metrics               │
│  POST /api/agents/sync          Pull agents from GHL API           │
│  POST /api/agents/:id/simulate  Playground test run                │
│  GET  /stream                   SSE stream per locationId          │
└──────────┬──────────────────────────────┬───────────────────────────┘
           │                              │
           ▼                              ▼
┌──────────────────────┐      ┌──────────────────────────────────────┐
│  PostgreSQL          │      │  Temporal Worker                     │
│                      │      │  (task queue: voice-ai-analysis)     │
│  locations           │      │                                      │
│  agents              │      │  analyzeCallWorkflow:                │
│  kpi_configs         │      │  1. loadTranscript                   │
│  transcripts         │◀─────│  2. loadKpiConfig                    │
│  analysis_results    │      │  3. buildPrompt                      │
│  use_actions         │      │  4. callLLM  ──→ OpenAI/Claude/Groq  │
└──────────────────────┘      │  5. persistResults                   │
                              │  6. broadcastSSE ──→ frontend        │
                              └──────────────────────────────────────┘
```

---

## Data Flow: Call Analysis

```
1. GHL fires POST /webhooks/ghl  { type: "VoiceAiCallEnd", transcript: "...", ... }
           │
           ▼
2. Ed25519 signature verified against GHL's public key
           │
           ▼
3. parseTranscriptToTurns()
   "AI Agent: Hello\nCaller: Hi"  →  [{ speaker: 'agent', text: 'Hello' }, ...]
           │
           ▼
4. TranscriptService.ingest()
   - Check ghl_call_id UNIQUE constraint (idempotency)
   - INSERT into transcripts (status: 'pending')
   - Lookup kpi_config for this agent
           │
           ▼
5. Temporal: client.workflow.start('analyzeCallWorkflow', { transcriptId, kpiConfigId, ... })
           │
           ▼  (async, in Temporal worker)
6. loadTranscript   → fetch turns from DB
7. loadKpiConfig    → fetch goals + threshold
8. buildPrompt      → agent script + turns + KPI goals → LLM prompt
9. callLLM          → OpenAI / Anthropic / Groq
10. persistResults  → INSERT analysis_results + use_actions, UPDATE transcript status
11. broadcastSSE    → SSE push to connected frontend clients
```

---

## OAuth & Install Flow

```
Agency install:
  User clicks Install → GHL OAuth → POST /oauth/callback
  → userType: 'Company' → store company:<companyId> token
  → GHL fires INSTALL webhook per sub-account selected
  → mintAndStoreLocationToken() → POST /oauth/locationToken with agency token
  → store locationId token in DB

Location install (direct via chooselocation URL):
  User opens chooselocation URL → selects sub-account → GHL OAuth
  → POST /oauth/callback → userType: 'Location'
  → store locationId token directly
  → redirect to /?locationId=xxx&installed=1
```

---

## Database Schema

```sql
locations
  location_id      VARCHAR UNIQUE   -- 'abc123' or 'company:xyz'
  access_token     TEXT
  refresh_token    TEXT
  token_expires_at TIMESTAMPTZ

agents
  location_id      VARCHAR  → locations.location_id
  ghl_agent_id     VARCHAR  -- GHL's internal agent ID
  name             VARCHAR
  script           TEXT     -- agent prompt/script for LLM context
  UNIQUE(location_id, ghl_agent_id)

kpi_configs
  agent_id          UUID  → agents.id  (1:1)
  goals             JSONB   -- [{ name, description, weight }]
  success_threshold DECIMAL -- 0.00–1.00

transcripts
  agent_id      UUID  → agents.id
  ghl_call_id   VARCHAR UNIQUE  -- idempotency key
  turns         JSONB   -- [{ speaker, text, timestamp_ms }]
  status        VARCHAR -- pending | analyzed | analysis_failed

analysis_results
  transcript_id      UUID  → transcripts.id
  overall_score      DECIMAL  -- deterministic weighted average
  passed             BOOLEAN
  kpi_scores         JSONB  -- [{ goalName, score, reasoning }]
  summary            TEXT
  script_suggestions JSONB

use_actions
  analysis_id           UUID  → analysis_results.id
  transcript_turn_index INTEGER
  type                  VARCHAR  -- missed_opportunity | deviation | escalation_needed
  description           TEXT
```

---

## Temporal Workflow Details

### analyzeCallWorkflow

Activity timeout groups:
- **Default activities**: 30s `startToClose`, max 2 retries
- **LLM call**: 2min `startToClose`, max 3 retries, exponential backoff (2s initial, 2× coefficient)

Error path: any failure → `markTranscriptFailed()` → `broadcastSSEFailure()` → rethrow for Temporal retry logic.

### Why Temporal over a simple job queue

| Concern | Temporal | Bull/BullMQ |
|---------|----------|-------------|
| Per-activity retries with backoff | Built-in | Manual per-step |
| Audit trail per workflow run | Full history UI | Logs only |
| Partial failure recovery | Resume from last step | Restart from beginning |
| Timeout per activity step | Per-activity config | Queue-wide |

---

## Security

### Webhook verification

| Endpoint | Method | Key source |
|----------|--------|------------|
| `POST /webhooks/ghl` | Ed25519 | GHL's published public key (env override: `GHL_WEBHOOK_PUBLIC_KEY`) |
| `POST /webhooks/call-completed` | HMAC-SHA256 | `GHL_WEBHOOK_SECRET` env var |

### Location auth (API endpoints)

All `/api/*` routes require `?locationId=` query param or `X-GHL-Location` header. The `ghlAuth` middleware verifies the location exists in DB before proceeding.

---

## GHL Marketplace Setup

### App settings

| Setting | Value |
|---------|-------|
| Redirect URI | `https://your-domain/oauth/callback` |
| Distribution | Sub-account |

### Required scopes

```
voice-ai-dashboard.readonly
voice-ai-agents.readonly
voice-ai-agents.write
voice-ai-agent-goals.readonly
voice-ai-agent-goals.write
oauth.write
oauth.readonly
```

### Webhook configuration

| Setting | Value |
|---------|-------|
| Webhook URL | `https://your-domain/webhooks/ghl` |
| Events | `AppInstall`, `AppUninstall`, `VoiceAiCallEnd` |

### Install URL

```
https://marketplace.gohighlevel.com/v2/oauth/chooselocation?response_type=code&redirect_uri=https://your-domain/oauth/callback&client_id=YOUR_CLIENT_ID&scope=voice-ai-dashboard.readonly+voice-ai-agents.readonly+voice-ai-agents.write+voice-ai-agent-goals.readonly+voice-ai-agent-goals.write+oauth.write+oauth.readonly&user_type=Location
```

---

## Real vs Mock

| Feature | Status | Notes |
|---------|--------|-------|
| GHL OAuth install flow | **Real** | Agency + location tokens, upserted on reinstall |
| Marketplace webhook verification | **Real** | Ed25519 with GHL's published public key |
| VoiceAiCallEnd transcript ingestion | **Real** | Parses GHL transcript string → structured turns |
| Agent sync from GHL API | **Real** | `POST /api/agents/sync` → GHL `/voice-ai/agents` |
| LLM call analysis | **Real** | Provider from `LLM_PROVIDER` env var |
| KPI scoring (overall score) | **Real** | Deterministic weighted average — not from LLM |
| SSE real-time updates | **Real** | Push event when analysis completes |
| Token refresh | **TODO** | GHL tokens expire ~24h — no auto-refresh yet |
| Agent auto-sync on install | **TODO** | Manual sync required via `/api/agents/sync` |
| Seed data (`demo-location-001`) | **Dev only** | Local development only |
| Phone provisioning | **N/A** | GHL manages calls; we receive webhook payloads only |
| Audio transcription | **N/A** | GHL provides text; no audio processing |

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `REDIS_URL` | Yes | Redis connection string |
| `TEMPORAL_ADDRESS` | Yes | Temporal server address |
| `LLM_PROVIDER` | Yes | `openai` \| `anthropic` \| `groq` |
| `OPENAI_API_KEY` | If openai | OpenAI API key |
| `ANTHROPIC_API_KEY` | If anthropic | Anthropic API key |
| `GROQ_API_KEY` | If groq | Groq API key |
| `GHL_CLIENT_ID` | Production | GHL marketplace app client ID |
| `GHL_CLIENT_SECRET` | Production | GHL marketplace app secret |
| `GHL_WEBHOOK_SECRET` | Production | HMAC secret for legacy webhook |
| `GHL_WEBHOOK_PUBLIC_KEY` | Optional | Override GHL's Ed25519 public key on rotation |
| `APP_URL` | Production | Full URL of deployed backend (no trailing slash) |
| `DUCKDNS_DOMAIN` | Production | DuckDNS subdomain for Caddy HTTPS |
| `PORT` | No | Backend port (default: 3000) |
