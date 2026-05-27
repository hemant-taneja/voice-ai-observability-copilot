# Voice AI Copilot

A real-time observability and coaching platform for GoHighLevel (GHL) Voice AI agents. Analyzes call transcripts against configurable KPI goals using an LLM, surfaces missed opportunities and deviations, and suggests script improvements — all visible in a live dashboard the moment a call ends.

---

## Table of Contents

- [Architecture](#architecture)
- [What's Real vs Mock](#whats-real-vs-mock)
- [Installation Guide](#installation-guide)
- [GHL Marketplace Setup](#ghl-marketplace-setup)
- [Testing Process](#testing-process)
- [Product UX & Thought Process](#product-ux--thought-process)
- [Demo Transcript & Showcase Guide](#demo-transcript--showcase-guide)
- [Future Scope](#future-scope)

---

## Architecture

### System Overview

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
│  /stream*     → app:3000 (SSE, flush_interval -1)                  │
│  /*           → /srv/frontend (Vue SPA)                             │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Node.js / Express Backend (app:3000)                              │
│                                                                     │
│  GET  /oauth/callback          OAuth token exchange                 │
│  POST /webhooks/ghl            Marketplace events (Ed25519)         │
│  POST /webhooks/call-completed Legacy webhook (HMAC)               │
│  GET  /api/agents              List agents + metrics                │
│  POST /api/agents/sync         Pull agents from GHL API            │
│  POST /api/agents/:id/simulate Playground test run                 │
│  GET  /stream                  SSE stream per locationId           │
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

### Key Design Decisions

**Temporal for workflow orchestration** — LLM calls can take 10–60s and must be retried on failure. Temporal gives durable execution, automatic retries with backoff, and a full audit trail of every analysis run without managing state machines manually.

**Idempotent transcript ingestion** — `ghl_call_id` has a UNIQUE constraint. Duplicate webhook deliveries (GHL retries on timeout) are silently deduplicated. The frontend never sees duplicate results.

**Deterministic scoring** — The LLM returns raw KPI scores (0–1 per goal). The overall score is computed server-side as a weighted average. The LLM cannot inflate or hallucinate the final score.

**SSE over WebSockets** — Analysis results are pushed to the frontend the instant they are ready. SSE is simpler than WebSockets for one-directional streaming and works transparently through Caddy with `flush_interval -1`.

**Ed25519 for marketplace webhooks** — GHL signs all marketplace webhook payloads with their private key. Verification uses GHL's published public key (not a secret) with an env override (`GHL_WEBHOOK_PUBLIC_KEY`) for key rotation without a redeploy.

### Database Schema

```
locations        GHL sub-account OAuth tokens (keyed by location_id or company:<id>)
agents           Voice AI agents per location (ghl_agent_id, name, script)
kpi_configs      Goals array (JSONB) + pass threshold per agent (1:1 with agents)
transcripts      Call records with structured turns (JSONB), status: pending/analyzed/failed
analysis_results LLM output: overall_score, kpi_scores (JSONB), summary, script_suggestions
use_actions      Moment-level flags: missed_opportunity / deviation / escalation_needed
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vue 3, TypeScript, Vite, Pinia |
| Backend | Node.js, Express, TypeScript |
| Workflow engine | Temporal (self-hosted) |
| Database | PostgreSQL 15 |
| Cache | Redis 7 |
| Reverse proxy | Caddy 2 (automatic HTTPS) |
| Deployment | Docker Compose on GCP VM |
| LLM | OpenAI / Anthropic / Groq (configurable via `LLM_PROVIDER`) |

---

## What's Real vs Mock

| Feature | Status | Notes |
|---------|--------|-------|
| GHL OAuth install flow | **Real** | Agency + location tokens stored, upserted on reinstall |
| Marketplace webhook verification | **Real** | Ed25519 with GHL's published public key |
| VoiceAiCallEnd transcript ingestion | **Real** | Parses GHL transcript string → structured turns |
| Agent sync from GHL API | **Real** | `POST /api/agents/sync` calls GHL `/voice-ai/agents` |
| LLM call analysis | **Real** | Provider selected by `LLM_PROVIDER` env var |
| KPI scoring (overall score) | **Real** | Deterministic weighted average — not from LLM |
| SSE real-time updates | **Real** | Frontend receives push event when analysis completes |
| Token refresh | **TODO** | Tokens expire ~24h — no automatic refresh yet |
| Agent auto-sync on install | **TODO** | Manual sync required via `/api/agents/sync` |
| Seed data (`demo-location-001`) | **Dev only** | Pre-seeded location + agents for local development |
| Phone number provisioning | **N/A** | GHL manages calls; we only receive webhook payloads |
| Transcript audio | **N/A** | GHL provides text transcript; no audio processing |

---

## Installation Guide

### Prerequisites

- Linux server with Docker + Docker Compose (tested: GCP e2-micro)
- Domain pointed at server (DuckDNS free subdomain works fine)
- GHL account with marketplace app creation access
- API key for at least one LLM provider

### 1. Clone and configure

```bash
git clone <repo-url>
cd voice-ai-copilot
cp .env.example .env
nano .env
```

Key values to set:

```env
POSTGRES_PASSWORD=<strong-random-password>
DATABASE_URL=postgresql://postgres:<same-password>@postgres:5432/voice_copilot
DUCKDNS_DOMAIN=your-subdomain.duckdns.org
APP_URL=https://your-subdomain.duckdns.org
LLM_PROVIDER=openai        # openai | anthropic | groq
OPENAI_API_KEY=sk-...
# GHL values filled after Step 4
GHL_CLIENT_ID=
GHL_CLIENT_SECRET=
```

### 2. Build frontend

```bash
cd frontend && npm install && npm run build && cd ..
```

### 3. Start services

```bash
sudo docker compose up -d
sudo docker compose exec app npm run db:migrate
```

Verify:
```bash
sudo docker compose ps
curl https://your-domain/health   # → {"ok":true}
```

### 4. Create GHL marketplace app

See [GHL Marketplace Setup](#ghl-marketplace-setup). Add `GHL_CLIENT_ID` and `GHL_CLIENT_SECRET` to `.env`.

### 5. Restart app with GHL credentials

```bash
sudo docker compose restart app
```

### 6. Install on a sub-account

Open this URL in a browser while logged into GHL:

```
https://marketplace.gohighlevel.com/v2/oauth/chooselocation?response_type=code&redirect_uri=https://your-domain/oauth/callback&client_id=YOUR_CLIENT_ID&scope=voice-ai-dashboard.readonly+voice-ai-agents.readonly+voice-ai-agents.write+voice-ai-agent-goals.readonly+voice-ai-agent-goals.write+oauth.write+oauth.readonly&user_type=Location
```

You will be redirected to `https://your-domain/?locationId=LOCATION_ID&installed=1`.

### 7. Sync agents

```bash
curl -X POST "https://your-domain/api/agents/sync?locationId=YOUR_LOCATION_ID"
# → {"ok":true,"synced":N}
```

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

Signature verification uses GHL's Ed25519 public key — no additional shared secret needed.

---

## Testing Process

### Option A — Playground (recommended, no real calls needed)

1. Open `https://your-domain/?locationId=YOUR_LOCATION_ID`
2. Click an agent → **KPI Config** → add at least one goal → save
3. Click **Playground** in the sidebar
4. Select the agent, add transcript turns, click **Run Analysis**
5. Watch the right panel update live via SSE

### Option B — Real GHL call

1. Ensure the agent has a phone number assigned in GHL
2. Make a call to the agent's number
3. After the call ends GHL fires `VoiceAiCallEnd` automatically
4. Dashboard updates within ~10–30s (LLM analysis time)

### Verify pipeline health

```bash
# All containers running
sudo docker compose ps

# Live logs
sudo docker compose logs -f app

# Recent transcripts and status
sudo docker compose exec postgres psql -U postgres -d voice_copilot \
  -c "SELECT ghl_call_id, status, ingested_at FROM transcripts ORDER BY ingested_at DESC LIMIT 10;"

# Recent analysis results
sudo docker compose exec postgres psql -U postgres -d voice_copilot \
  -c "SELECT t.ghl_call_id, ar.overall_score, ar.passed, ar.analyzed_at
      FROM analysis_results ar
      JOIN transcripts t ON t.id = ar.transcript_id
      ORDER BY ar.analyzed_at DESC LIMIT 5;"
```

---

## Product UX & Thought Process

### Problem

Voice AI agents handle hundreds of calls per day with no visibility into whether they are achieving their goals — greeting callers warmly, following the script, handling objections, escalating appropriately. Managers cannot listen to every call.

### Solution

Attach a configurable "success rubric" (KPI goals) to each agent. Every call transcript is automatically evaluated against that rubric by an LLM. Results are pushed live to a dashboard so managers see patterns instantly and coaches can act on specific moments.

### UX Principles

**Zero-latency feedback** — SSE pushes results the moment analysis finishes. No polling, no manual refresh.

**Agent-scoped KPIs** — Goals are set per agent. An outbound sales agent and an inbound support agent have entirely different success criteria.

**Actionable, not just scored** — Beyond pass/fail, the system identifies specific moments: missed opportunities, script deviations, and escalation needs — each linked to the exact turn in the transcript.

**Script improvement loop** — Analysis feeds into script suggestions. The LLM recommends specific wording changes based on what worked and what did not.

**Playground for iteration** — Agents and KPI configs can be validated with synthetic transcripts before going live. No real calls needed for setup or testing.

### Information Architecture

```
Dashboard           aggregate metrics across all agents
  └── Agent Card    per-agent summary (calls, pass rate, avg score)
       └── Agent Detail    transcript history, per-call scores, use actions
            └── Transcript Viewer     turn-by-turn with annotations
            └── Script Suggestions    LLM-recommended wording changes
       └── KPI Config Editor    goals, weights, pass threshold
Playground          manual transcript submission and live analysis result
```

---

## Demo Transcript & Showcase Guide

### Recommended demo flow (~10 minutes)

**1. Show the empty state** — Open dashboard, explain it updates automatically when calls come in.

**2. Configure KPI goals** — Click an agent → KPI Config. Add:

| Goal | Description | Weight |
|------|-------------|--------|
| Retention attempt | Agent tried to retain customer before cancelling | 0.4 |
| Reason discovery | Agent asked why the customer wants to cancel | 0.3 |
| Empathy | Agent acknowledged the customer's feelings | 0.2 |
| Professional close | Agent ended the call professionally | 0.1 |

Pass threshold: **0.70** → Save.

**3. Run a FAILING transcript in Playground:**

```
Agent: Hi there! Thanks for calling. How can I assist you today?
User: Yeah I want to cancel my account.
Agent: Okay, I can help with that. Can I get your account email?
User: It's john@example.com
Agent: Got it. I've submitted the cancellation request. You'll get a confirmation email.
User: That's it?
Agent: Yes, is there anything else I can help you with?
User: No.
Agent: Have a great day!
```

Expected result: Score ~0.15 (FAIL) — no retention attempt, no reason asked, minimal empathy.

**4. Show the use actions** — point out the `missed_opportunity` flags at turns 2 and 4.

**5. Show script suggestions** — the LLM recommends exact wording changes.

**6. Run a PASSING transcript** to show the contrast:

```
Agent: Hi! Thanks for calling, you're speaking with support. How can I help?
User: I want to cancel my account.
Agent: I'm sorry to hear that. Before I process anything, could I ask what's prompted this decision?
User: It's just too expensive for me right now.
Agent: Understood — budget matters. We actually have a pause option that keeps your account safe at a 60% reduced rate. Would that work for you?
User: Oh, I didn't know about that. Yeah, let's do that.
Agent: Perfect, I've switched you to the pause plan. You'll get a confirmation email shortly. Anything else?
User: No, thanks.
Agent: Great, have a wonderful day!
```

Expected result: Score ~0.95 (PASS) — reason discovered, retention offered, empathetic, professional close.

**7. Switch back to dashboard** — show both scores visible, pass rate updated in real-time.

---

## Future Scope

### Near term
- **Automatic token refresh** — GHL tokens expire ~24h. Background job to refresh using stored `refresh_token`.
- **Auto-sync agents on install** — Trigger sync inside `mintAndStoreLocationToken` so agents appear immediately after sub-account install.
- **Notification panel** — Replace toasts with a persistent activity feed of recent analysis completions.

### Medium term
- **Performance trends** — Track agent score trajectories over time. Highlight agents improving vs declining.
- **Multi-location agency view** — Aggregate metrics across all sub-accounts for agency-level managers.
- **Review notes persistence** — Move transcript annotations from frontend local store to backend DB.
- **Failed analysis recovery** — One-click reanalyze for transcripts with status `analysis_failed`.

### Long term
- **Real-time call coaching** — Live in-call hints to the agent based on conversation trajectory.
- **A/B script testing** — Run two script variants, compare KPI outcomes statistically across call cohorts.
- **Automated script updates** — Push approved improvements back to GHL via the Voice AI agents write API.
- **Fine-tuned scoring model** — Train a domain-specific model on accumulated transcripts + human feedback to reduce LLM cost and latency.
