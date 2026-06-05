---
name: ghl-copilot-understand-codebase
description: This skill should be used when starting any session on the Voice AI Observability Copilot project, when needing orientation on architecture, data flows, module boundaries, or before making any code changes. Also triggers when the user asks "how does the codebase work", "explain the architecture", "what does this project do", or "where is X implemented".
---

# Understanding the GHL Voice AI Copilot Codebase

## Architecture Overview

Monorepo with two workspaces under `voice-ai-copilot/`:

**Backend** (`backend/src/` — Node.js / Express / TypeScript)
```
routes/          # Thin HTTP handlers — one file per domain
services/        # Business logic (transcript ingestion, agent sync, KPI)
activities/      # Temporal activity implementations (8 files)
workflows/       # Temporal workflow definitions
workers/         # Temporal worker process
middleware/      # GHL auth (location-based), error handler (AppError)
lib/             # External clients — GHL API, LLM providers, SSE manager
  llm/           # Provider-agnostic LLM adapter (index.ts, openai-provider.ts, anthropic-provider.ts)
  ghl-client.ts  # All GHL REST API calls + OAuth token refresh
  sse-manager.ts # In-memory SSE broadcast by locationId
db/              # PostgreSQL pool, migration runner, seed script
  migrations/    # SQL migration files (001_initial.sql, 002_script_suggestions.sql, 003_location_company_id.sql)
types/           # Shared TypeScript interfaces (ghl.types.ts, llm.types.ts, analysis.types.ts)
config.ts        # Zod-validated environment config
app.ts           # Express app setup with middleware chain
server.ts        # Server startup/shutdown
```

**Frontend** (`frontend/src/` — Vue 3 / Pinia / Vite / Tailwind)
```
views/           # Route-level pages (Dashboard.vue, AgentDetail.vue, Playground.vue)
components/      # Reusable UI (13 components including AgentCard, KpiScoreBar, TranscriptViewer, etc.)
stores/          # Pinia stores (agents.ts, analysis.ts, stream.ts, review.ts)
composables/     # Composition functions (useSSE.ts, useToast.ts)
api/             # Axios wrappers (index.ts, agents.ts, analysis.ts, kpi.ts)
services/        # HTTP client (api.ts)
router/          # Vue Router config (3 routes: /, /agents/:id, /playground)
types/           # TypeScript interfaces (agent.types.ts, analysis.types.ts)
assets/          # CSS (main.css, design-system.css — "Dark Signal" aesthetic)
```

## Core Data Flow

```
GHL Voice AI call ends
  -> Webhook: POST /webhooks/ghl (Ed25519-verified) OR POST /webhooks/call-completed (HMAC-SHA256)
  -> routes/webhooks.ts parses payload, upserts transcript (ghl_call_id = idempotency key)
  -> Temporal workflow started: analyzeCallWorkflow({ transcriptId, agentId, locationId })
     -> loadTranscriptActivity
     -> loadKpiConfigActivity
     -> buildPromptActivity
     -> callLLMActivity (retried 3x, exponential backoff)
     -> persistResultsActivity (saves analysis_results + use_actions)
     -> broadcastSSEActivity -> SSE push to frontend
  -> On failure: markFailedActivity sets transcript.status = 'analysis_failed'
  -> Frontend receives SSE event 'analysis.complete' -> stores refresh reactively
```

## Module Responsibilities

| File | Owns |
|---|---|
| `routes/webhooks.ts` | GHL webhook ingestion (Ed25519 + HMAC verification) |
| `routes/agents.ts` | Agent CRUD, sync from GHL, simulate analysis, reanalyze |
| `routes/kpi.ts` | Per-agent KPI config CRUD + LLM-powered KPI suggestions |
| `routes/stream.ts` | SSE endpoint for real-time dashboard updates |
| `routes/oauth.ts` | GHL OAuth callback + marketplace install flow |
| `services/transcript-service.ts` | Transcript parsing, normalization, storage |
| `services/agents-service.ts` | Agent CRUD, GHL sync, script updates |
| `services/kpi-service.ts` | KPI goals management, success threshold |
| `lib/ghl-client.ts` | All GHL REST API calls + transparent token refresh |
| `lib/llm/index.ts` | LLM provider factory (reads `LLM_PROVIDER` env var) |
| `lib/llm/openai-provider.ts` | OpenAI + Groq adapter (JSON mode) |
| `lib/llm/anthropic-provider.ts` | Anthropic adapter (structured JSON prompt) |
| `lib/sse-manager.ts` | In-memory SSE connections keyed by locationId |
| `workflows/analyze-call.workflow.ts` | Temporal workflow orchestrating 7 activities |
| `views/Dashboard.vue` | Agent grid, metrics row, live waveform indicator |
| `views/AgentDetail.vue` | Three-panel: call history, KPI scorecard, recommendations |
| `views/Playground.vue` | Manual transcript simulation |
| `stores/agents.ts` | Agent list, selected agent state |
| `stores/analysis.ts` | Analysis results, KPI scores, loading state |
| `stores/stream.ts` | SSE connection state |
| `stores/review.ts` | UI state for review panel |

## How to Orient Before Making Changes

1. Read `backend/src/config.ts` — all environment variables and their validation
2. Read `backend/src/lib/ghl-client.ts` — how GHL API calls are structured
3. Read `backend/src/workflows/analyze-call.workflow.ts` — the core analysis pipeline
4. Read `backend/src/lib/llm/index.ts` — how LLM providers are selected
5. Check `frontend/src/stores/` — what state the frontend manages
6. Check the relevant route file for the domain being touched
7. Run `git log --oneline -10` — what changed recently

## Key Integration Points

| Point | File | Risk |
|---|---|---|
| GHL OAuth tokens | `middleware/ghl-auth.ts` | Token expiry — refresh is transparent in ghl-client.ts |
| GHL API calls | `lib/ghl-client.ts` | Rate limits — never call GHL outside this lib |
| Webhook ingestion | `routes/webhooks.ts` | Silent drops — log every failed ingest |
| LLM analysis | `activities/call-llm.activity.ts` | Prompt changes affect all future results |
| SSE broadcast | `lib/sse-manager.ts` + `activities/broadcast-sse.activity.ts` | Cross-process via HTTP callback |
| Temporal workflows | `workflows/analyze-call.workflow.ts` | Activity retry policies affect reliability |

## Additional Resources

For detailed architecture diagrams, database schema, and API contracts, consult:
- **`references/architecture.md`** — Full DB schema (7 tables), API endpoints, infrastructure layout
