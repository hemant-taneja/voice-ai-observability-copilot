# Voice AI Observability Copilot

An Agent Observability Copilot that automates the Monitor and Analyze phases for HighLevel Voice AI agents.

## Architecture

```
GHL Webhook → Express handler (HMAC verified) → Temporal workflow
  → Load transcript + KPI config
  → Build LLM prompt
  → Call LLM (OpenAI or Anthropic, retried on rate limit)
  → Persist analysis results + use actions
  → SSE broadcast → Vue dashboard updates live
```

**Stack:** Node.js + TypeScript, Express, Temporal, PostgreSQL, Redis, Vue 3 + Pinia, TailwindCSS

## What Is Real vs Mocked

| Feature | Status |
|---|---|
| GHL webhook handler | Real — HMAC-SHA256 verified, idempotent |
| Transcript ingestion | Real |
| LLM analysis pipeline | Real — OpenAI or Anthropic via env var |
| SSE live updates | Real |
| Seed data | Mocked — 3 agents, 60 transcripts |
| GHL OAuth flow | Architecture-ready — upgrade path below |

## Prerequisites

- Docker Desktop
- Node.js 20+

## Quick Start

```bash
# 1. Clone and install
git clone https://github.com/hemant-taneja/voice-ai-observability-copilot
cd voice-ai-copilot
cp .env.example .env
# Fill in OPENAI_API_KEY (or ANTHROPIC_API_KEY) and GHL_WEBHOOK_SECRET

# 2. Start infrastructure
make infra

# 3. Run migrations + seed demo data
make migrate
make seed

# 4. Start backend + frontend
make dev

# 5. Open dashboard
# http://localhost:5173?locationId=demo-location-001
# Temporal UI: http://localhost:8080
```

## GHL Integration

**Custom JS Widget (demo mode):**
Paste `widget/inject.js` into GHL Settings → Custom JS. Update the iframe src to your deployed URL.

**Marketplace App (upgrade path):**
1. Register app at developers.gohighlevel.com
2. Add OAuth callback to `POST /auth/callback` — stores tokens in `locations` table
3. In `ghl-auth.ts`, replace query-param `locationId` with signed GHL iframe header

## Architecture Notes — Approach 3 Upgrade

The current pipeline is a linear Temporal workflow. To upgrade to an explicit event-driven pipeline:

- Split `analyze-call.workflow.ts` into three chained workflows: `IngestWorkflow → AnalysisWorkflow → RecommendationWorkflow`
- Each workflow is independently retryable and visible in the Temporal UI
- No changes required to routes, services, or frontend

This upgrade touches only `src/workflows/` — the rest of the system is unchanged.

## Team of One

Designed and implemented as a Team of One owning Product, Design, Engineering, and QA:

- **Product:** Assignment requirements mapped to Monitor + Analyze loops with a clear real vs mocked distinction
- **Design:** Dark Signal aesthetic — deliberate, distinctive, not generic AI tooling
- **Engineering:** Temporal for durable LLM workflows, provider-agnostic LLM adapter, HMAC-verified webhooks
- **QA:** Unit + integration + workflow tests, seeded demo data for consistent demo experience
