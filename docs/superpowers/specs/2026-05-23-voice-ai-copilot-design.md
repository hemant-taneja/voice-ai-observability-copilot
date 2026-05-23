# Voice AI Observability Copilot — Design Spec

**Date:** 2026-05-23
**Status:** Approved
**Assignment:** HighLevel FSB Q226

---

## 1. Objective

Build an Agent Observability Copilot that automates the "Monitor" and "Analyze" phases for HighLevel Voice AI agents. The system ingests call transcripts, scores them against per-agent KPI configurations using an LLM, and surfaces failures, deviations, and actionable recommendations through a real-time dashboard embedded inside HighLevel.

---

## 2. Decisions & Rationale

| Decision | Choice | Rationale |
|---|---|---|
| GHL integration | Hybrid: Custom JS demo + OAuth-ready backend | No marketplace review delay; backend is marketplace-upgradeable with one change |
| Backend | Node.js + TypeScript + Express | Required by assignment |
| Frontend | Vue 3 + TypeScript + Vite + Pinia | Required by assignment |
| Database | Local PostgreSQL (Docker Compose) | Zero cloud latency, production-grade schema, avoids Supabase regional issues |
| Job orchestration | Temporal + Redis | Durable workflows, per-activity retries, built-in visibility — correct for long-running LLM jobs |
| LLM | Provider-agnostic adapter (OpenAI \| Anthropic via `LLM_PROVIDER` env var) | Shows architecture thinking; swap providers without touching business logic |
| Transcript ingestion | Real GHL webhook handler + seeded mock data | Webhook is real; seeds ensure demo always looks rich |
| UI aesthetic | Dark Signal — IBM Plex Mono + Syne + DM Sans, amber accent | Observability-grade, distinctive, memorable |

---

## 3. Project Structure

```
voice-ai-copilot/
  backend/
    src/
      routes/
        webhooks.ts         # POST /webhooks/call-completed
        agents.ts           # Agent CRUD + analysis queries
        kpi.ts              # Per-agent KPI config CRUD
        stream.ts           # GET /stream (SSE endpoint)
      services/
        transcript-service.ts
        analysis-service.ts
        kpi-service.ts
      workflows/
        analyze-call.workflow.ts   # Temporal workflow
      activities/
        load-transcript.activity.ts
        load-kpi-config.activity.ts
        build-prompt.activity.ts
        call-llm.activity.ts
        persist-results.activity.ts
        broadcast-sse.activity.ts
      workers/
        temporal-worker.ts
      lib/
        ghl-client.ts
        llm-client.ts
        sse-manager.ts
      models/
        agent.ts
        transcript.ts
        analysis.ts
        kpi-config.ts
        location.ts
      middleware/
        ghl-auth.ts
        error-handler.ts
      db/
        index.ts
        migrations/
        seeds/
      types/
        ghl.types.ts
        analysis.types.ts
        llm.types.ts
      config.ts
      app.ts
      server.ts
    package.json
    tsconfig.json

  frontend/
    src/
      views/
        Dashboard.vue
        AgentDetail.vue
      components/
        AgentCard.vue
        KpiScoreBar.vue
        TranscriptViewer.vue
        RecommendationPanel.vue
        UseActionBadge.vue
        MetricCard.vue
        LiveIndicator.vue
        KpiConfigEditor.vue
      stores/
        agents.ts
        analysis.ts
        transcripts.ts
        stream.ts
      api/
        agents.ts
        analysis.ts
        kpi.ts
      composables/
        useSSE.ts
        useAgentMetrics.ts
      router/
        index.ts
      types/
        agent.types.ts
        analysis.types.ts
      main.ts
    index.html
    vite.config.ts
    package.json
    tsconfig.json

  widget/
    inject.js          # Custom JS snippet pasted into GHL custom values
    iframe-host.html   # Wrapper page loaded by GHL iframe

  docs/
    superpowers/specs/
    superpowers/plans/

  docker-compose.yml
  .env.example
  Makefile             # make dev, make seed, make test
  README.md
  CHANGELOG.md
```

---

## 4. Data Model

Six PostgreSQL tables:

```sql
-- GHL sub-accounts — stores OAuth tokens (marketplace-ready)
CREATE TABLE locations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id      VARCHAR(255) UNIQUE NOT NULL,
  name             VARCHAR(255),
  access_token     TEXT,
  refresh_token    TEXT,
  token_expires_at TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Voice AI agents within a sub-account
CREATE TABLE agents (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id  VARCHAR(255) NOT NULL REFERENCES locations(location_id),
  ghl_agent_id VARCHAR(255) NOT NULL,
  name         VARCHAR(255) NOT NULL,
  script       TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(location_id, ghl_agent_id)
);

-- Per-agent KPI configuration
CREATE TABLE kpi_configs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id          UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  goals             JSONB NOT NULL,   -- [{name, description, weight}]
  success_threshold DECIMAL(3,2) DEFAULT 0.70,
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Call transcripts ingested from GHL webhooks
CREATE TABLE transcripts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id         UUID NOT NULL REFERENCES agents(id),
  location_id      VARCHAR(255) NOT NULL,
  ghl_call_id      VARCHAR(255) UNIQUE NOT NULL,  -- idempotency key
  caller_phone     VARCHAR(50),
  duration_seconds INTEGER,
  status           VARCHAR(50) DEFAULT 'pending', -- pending | analyzed | analysis_failed
  turns            JSONB NOT NULL,  -- [{speaker, text, timestamp_ms}]
  raw_payload      JSONB,
  ingested_at      TIMESTAMPTZ DEFAULT NOW()
);

-- LLM analysis output per transcript
CREATE TABLE analysis_results (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transcript_id  UUID NOT NULL REFERENCES transcripts(id) ON DELETE CASCADE,
  kpi_config_id  UUID NOT NULL REFERENCES kpi_configs(id),
  overall_score  DECIMAL(3,2) NOT NULL,  -- 0.00–1.00
  passed         BOOLEAN NOT NULL,
  kpi_scores     JSONB NOT NULL,  -- [{goal, score, passed, evidence}]
  summary        TEXT NOT NULL,
  llm_provider   VARCHAR(50) NOT NULL,
  llm_model      VARCHAR(100) NOT NULL,
  analyzed_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Flagged transcript segments requiring human intervention
CREATE TABLE use_actions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id           UUID NOT NULL REFERENCES analysis_results(id) ON DELETE CASCADE,
  transcript_turn_index INTEGER NOT NULL,
  type                  VARCHAR(50) NOT NULL,  -- missed_opportunity | deviation | escalation_needed
  description           TEXT NOT NULL,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);
```

**Key design decisions:**
- `turns` and `kpi_scores` as JSONB — document-like data, no separate tables needed
- `ghl_call_id UNIQUE` — webhook idempotency, GHL can fire duplicates
- `raw_payload` on transcripts — re-analyze without re-fetching from GHL
- `status` on transcripts — surfaces `analysis_failed` rows in dashboard for manual retry
- `locations` table — OAuth token storage makes backend marketplace-ready from day one

---

## 5. GHL Integration Layer

### 5a. Hybrid Auth

**Custom JS demo mode:**
- `inject.js` reads `locationId` from the GHL page context and passes it as a URL param to the iframe
- `ghl-auth.ts` middleware reads `locationId`, validates it exists in the `locations` table, attaches `req.ghlContext`

**Marketplace upgrade path:**
- Swap the `locationId` extraction in `ghl-auth.ts` to read from the signed GHL iframe header
- All other backend code is unchanged

### 5b. Webhook Ingestion

```
POST /webhooks/call-completed
  1. Verify HMAC-SHA256 signature against GHL_WEBHOOK_SECRET
  2. Parse transcript turns from payload
  3. Upsert transcript row (ghl_call_id = idempotency key)
  4. Start Temporal workflow: AnalyzeCallWorkflow({ transcriptId, agentId, locationId })
  5. Return 200 immediately — GHL never times out
```

### 5c. GHL API Client (`ghl-client.ts`)

```typescript
interface GHLClient {
  listAgents(locationId: string): Promise<GHLAgent[]>
  getCallTranscript(callId: string, locationId: string): Promise<GHLTranscript>
  refreshToken(locationId: string): Promise<void>
}
```

- Token refresh is transparent — on 401, refreshes once and retries
- All calls go through this client; no raw axios calls to GHL elsewhere
- Logs every call with `{ locationId, endpoint, statusCode }` for debuggability

---

## 6. AI Analysis Pipeline

### 6a. Temporal Workflow

```typescript
// workflows/analyze-call.workflow.ts
export async function analyzeCallWorkflow(input: AnalysisJobData): Promise<void> {
  const transcript = await loadTranscriptActivity(input.transcriptId)
  const kpiConfig  = await loadKpiConfigActivity(input.agentId)
  const prompt     = await buildPromptActivity(transcript, kpiConfig)
  const output     = await callLLMActivity(prompt)      // retried on rate limit/timeout
  await persistResultsActivity(output, input)
  await broadcastSSEActivity(input.locationId, input.agentId)
}
```

**Activity retry policies:**
- `callLLMActivity`: 3 attempts, exponential backoff starting at 2s — handles rate limits
- All other activities: 2 attempts, 1s initial backoff — DB/network transient failures
- On workflow failure: transcript `status` set to `analysis_failed`, SSE event pushed to dashboard

### 6b. LLM Adapter

```typescript
// types/llm.types.ts
interface LLMProvider {
  analyze(prompt: AnalysisPrompt): Promise<AnalysisOutput>
}

interface AnalysisPrompt {
  agentScript: string
  turns: TranscriptTurn[]
  kpiGoals: KpiGoal[]
}

interface AnalysisOutput {
  overallScore: number
  passed: boolean
  kpiScores: KpiScore[]
  summary: string
  useActions: UseActionInput[]
}
```

- `llm-client.ts` factory reads `LLM_PROVIDER` env var (`openai` | `anthropic`)
- Both providers use structured JSON output mode — no brittle string parsing
- `OpenAIProvider` uses `gpt-4o` with `response_format: { type: 'json_object' }`
- `AnthropicProvider` uses `claude-3-5-haiku` with a structured JSON prompt

### 6c. SSE Manager

```typescript
class SSEManager {
  private connections = new Map<string, Response[]>()  // keyed by locationId
  add(locationId: string, res: Response): void
  remove(locationId: string, res: Response): void
  broadcast(locationId: string, event: SSEEvent): void
}
```

- `GET /stream?locationId=xxx` — frontend connects on mount
- `useSSE.ts` composable auto-reconnects with exponential backoff on disconnect
- Events: `analysis.complete`, `analysis.failed`, `transcript.ingested`

### 6d. Infrastructure

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:16
    ports: ["5432:5432"]
    environment: { POSTGRES_DB: voice_copilot, POSTGRES_USER: postgres, POSTGRES_PASSWORD: postgres }
    volumes: ["pgdata:/var/lib/postgresql/data"]

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
    volumes: ["redisdata:/data"]

  temporal:
    image: temporalio/auto-setup:1.24
    ports: ["7233:7233"]
    environment: { DB: postgres12, DB_PORT: 5432, POSTGRES_USER: postgres, POSTGRES_PWD: postgres, POSTGRES_DB: temporal }
    depends_on: [postgres]

  temporal-ui:
    image: temporalio/ui:2.26
    ports: ["8080:8080"]
    environment: { TEMPORAL_ADDRESS: temporal:7233 }
```

### 6e. Approach 3 Upgrade Path (documented, not implemented)

With Temporal already in place, the Approach 3 event-driven pipeline upgrade is:
- Split `analyzeCallWorkflow` into three chained workflows: `IngestWorkflow → AnalysisWorkflow → RecommendationWorkflow`
- Each workflow is independently retryable and observable in the Temporal UI
- No changes to routes, services, or frontend

---

## 7. Dashboard UI

### 7a. Aesthetic System — "Dark Signal"

```css
/* Color palette */
--bg-base:       #0A0B0E;
--bg-surface:    #111318;
--bg-elevated:   #181B22;
--border:        #1E2230;
--text-primary:  #F0F4FF;
--text-secondary:#7C8BA0;
--signal:        #F59E0B;   /* amber — live indicators, use actions */
--pass:          #10B981;   /* emerald */
--fail:          #F43F5E;   /* rose */
--warning:       #FB923C;   /* orange */

/* Typography */
--font-display: 'Syne', sans-serif;         /* headings, agent names */
--font-mono:    'IBM Plex Mono', monospace; /* metric values, scores, timestamps */
--font-ui:      'DM Sans', sans-serif;      /* body, labels, buttons */
```

**Differentiator:** SVG waveform in the header breathes (CSS animation) when SSE is connected, flat when disconnected — the UI's liveness is visible at a glance.

### 7b. Views

**Dashboard.vue** — all agents overview:
- Header: location name + live waveform indicator
- Metric row: total calls, pass rate, avg KPI score, open use actions (IBM Plex Mono values)
- Agent grid: `AgentCard` components with health-colored left border
- Failure trend: `vue-chartjs` line chart (last 7 days)
- Staggered reveal animation on load (CSS `animation-delay` per card)

**AgentDetail.vue** — per-agent drill-down:
- Three-panel layout: call history list | KPI scorecard | recommendations
- TranscriptViewer below: full turn-by-turn with `UseActionBadge` inline at flagged turn indices
- `KpiConfigEditor` expandable panel: set goal names, weights, success threshold
- SSE-driven: new analysis updates the view without page reload

### 7c. Components

| Component | Responsibility |
|---|---|
| `AgentCard.vue` | Health summary, pass rate bar, call count, use action count. Left border = health color. Click → AgentDetail |
| `KpiScoreBar.vue` | Single goal: label, animated fill bar (0–1), pass/fail badge, evidence tooltip |
| `TranscriptViewer.vue` | Renders `turns[]` with speaker, timestamp (IBM Plex Mono). `UseActionBadge` rendered at exact `transcript_turn_index` |
| `UseActionBadge.vue` | Amber left border, type label, description. Slide-in animation on first render |
| `RecommendationPanel.vue` | Cards grouped by priority (high/med/low). Top border color = priority. Type tag in mono |
| `MetricCard.vue` | Stat tile with count-up animation on load |
| `LiveIndicator.vue` | Pulsing amber dot — green/grey based on SSE connection state |
| `KpiConfigEditor.vue` | Inline form: goal CRUD + success threshold slider. Saves to `kpi_configs` table |

### 7d. State + Data Flow

```
Dashboard mount:
  agentsStore.fetchAll(locationId)
  streamStore.connect(locationId)  → useSSE opens EventSource

SSE event 'analysis.complete' received:
  analysisStore.fetchResults(agentId)  → updates AgentCard + AgentDetail reactively

AgentDetail mount:
  analysisStore.fetchResults(agentId)
  transcriptStore.fetchList(agentId)
```

### 7e. GHL Iframe Constraints

- Fixed sidebar width (~400px) or full-panel depending on GHL route
- `inject.js` detects GHL route, renders appropriate layout
- `locationId` passed via `postMessage` from GHL parent frame to the iframe (no `localStorage` cross-origin access in sandboxed iframes)
- Tailwind CSS purge keeps bundle small — critical inside an iframe

---

## 8. Error Handling

| Boundary | Failure | Handling |
|---|---|---|
| Webhook | Invalid HMAC signature | 401, logged |
| Webhook | Malformed payload | 400, logged with raw body |
| Webhook | Duplicate `ghl_call_id` | 200 silently — idempotent |
| LLM activity | Timeout / rate limit | Temporal retries × 3 with exponential backoff |
| LLM activity | Max retries exceeded | `transcripts.status = 'analysis_failed'`, SSE push `analysis.failed` |
| GHL API | 401 expired token | Auto-refresh + retry once |
| GHL API | 429 rate limit | Temporal reschedule after `Retry-After` header |
| All routes | Unhandled error | Central `error-handler.ts` — logs with context, returns `{ error, code }`, never leaks stack traces |

Failed analyses surface in the dashboard with an amber "Analysis failed — retry?" badge. One click re-enqueues the Temporal workflow.

---

## 9. Testing Strategy

### Backend
```
unit/
  services/analysis-service.test.ts   — mock LLM, test KPI scoring logic
  lib/llm-client.test.ts              — both providers return valid AnalysisOutput
  lib/ghl-client.test.ts              — token refresh, retry on 401

integration/
  routes/webhooks.test.ts             — supertest: valid payload → 200, bad sig → 401
  routes/agents.test.ts               — CRUD against voice_copilot_test DB
  workflows/analyze-call.test.ts      — Temporal TestWorkflowEnvironment, LLM activity mocked

e2e/
  dashboard.spec.ts                   — Playwright: load dashboard, agent cards render
  agent-detail.spec.ts                — Playwright: transcript + recommendations visible
```

### Frontend
```
unit/
  stores/analysis.test.ts         — Vitest: actions, state transitions
  composables/useSSE.test.ts      — mock EventSource, verify reconnect logic

component/
  AgentCard.test.ts               — Vue Test Utils: pass/fail border color
  TranscriptViewer.test.ts        — use_action flags at correct turn index
  KpiScoreBar.test.ts             — score 0.38 renders correct fill width
```

**Coverage targets:** Services + lib 90%+, routes 80%+, Vue components critical paths only.

**Seed data:** 3 agents, 20 transcripts each (mix of pass/fail/analysis_failed), 1 transcript with 4 use actions for compelling TranscriptViewer demo.

---

## 10. What Is Real vs Mocked

| Feature | Status | Notes |
|---|---|---|
| GHL webhook handler | Real | HMAC verification, idempotency, Temporal enqueue |
| Transcript ingestion | Real | Parses turns from GHL payload |
| LLM analysis pipeline | Real | Calls actual OpenAI or Anthropic API |
| KPI scoring + recommendations | Real | LLM structured output, persisted to Postgres |
| SSE live updates | Real | EventSource → `broadcast()` on workflow completion |
| GHL OAuth flow | Architecture-ready | Token table exists; custom JS passes locationId for demo |
| GHL Marketplace listing | Not implemented | Documented upgrade path in README |
| Seed data | Mocked | Realistic transcripts baked into `db/seeds/` |

---

## 11. Development Setup

```bash
# Prerequisites: Docker Desktop, Node.js 20+, Temporal CLI

make dev        # docker compose up + ts-node-dev backend + vite frontend + temporal worker
make seed       # run migrations + seed 3 agents with 60 transcripts
make test       # backend jest + frontend vitest
make ngrok      # expose :3000 for GHL webhook testing
```

`.env.example`:
```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/voice_copilot
REDIS_URL=redis://localhost:6379
TEMPORAL_ADDRESS=localhost:7233
GHL_CLIENT_ID=
GHL_CLIENT_SECRET=
GHL_WEBHOOK_SECRET=
LLM_PROVIDER=openai          # openai | anthropic
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
VITE_API_BASE_URL=http://localhost:3000
```

---

## 12. README Architecture Note — Approach 3

The current pipeline uses a linear Temporal workflow (Approach 2). Approach 3 upgrades this to an explicit event-driven pipeline:

- `IngestWorkflow` → signals `AnalysisWorkflow` on completion
- `AnalysisWorkflow` → signals `RecommendationWorkflow` on completion
- Each stage is independently observable, retryable, and scalable

With Temporal already in place, this upgrade touches only `workflows/` — routes, services, and frontend are unchanged.
