# Voice AI Copilot — Architecture Reference

## Database Schema (PostgreSQL 15)

7 tables across 3 SQL migrations:

### locations
GHL sub-accounts with OAuth tokens (marketplace-ready).
```sql
CREATE TABLE locations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id      VARCHAR(255) UNIQUE NOT NULL,
  company_id       VARCHAR(255),          -- added in migration 003
  name             VARCHAR(255),
  access_token     TEXT,
  refresh_token    TEXT,
  token_expires_at TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);
```

### agents
Voice AI agents within a sub-account.
```sql
CREATE TABLE agents (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id  VARCHAR(255) NOT NULL REFERENCES locations(location_id) ON DELETE CASCADE,
  ghl_agent_id VARCHAR(255) NOT NULL,
  name         VARCHAR(255) NOT NULL,
  script       TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(location_id, ghl_agent_id)
);
CREATE INDEX idx_agents_location_id ON agents(location_id);
```

### kpi_configs
Per-agent KPI goals and success threshold.
```sql
CREATE TABLE kpi_configs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id          UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  goals             JSONB NOT NULL DEFAULT '[]',   -- [{name, description, weight}]
  success_threshold DECIMAL(3,2) NOT NULL DEFAULT 0.70,
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);
```

### transcripts
Call transcripts ingested from GHL webhooks.
```sql
CREATE TABLE transcripts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id         UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  location_id      VARCHAR(255) NOT NULL,
  ghl_call_id      VARCHAR(255) UNIQUE NOT NULL,  -- idempotency key
  caller_phone     VARCHAR(50),
  duration_seconds INTEGER,
  status           VARCHAR(50) NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'analyzed', 'analysis_failed')),
  turns            JSONB NOT NULL DEFAULT '[]',   -- [{speaker, text, timestamp_ms}]
  raw_payload      JSONB,
  ingested_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_transcripts_agent_id ON transcripts(agent_id);
CREATE INDEX idx_transcripts_status ON transcripts(status);
```

### analysis_results
LLM analysis output per transcript.
```sql
CREATE TABLE analysis_results (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transcript_id    UUID NOT NULL REFERENCES transcripts(id) ON DELETE CASCADE,
  kpi_config_id    UUID NOT NULL REFERENCES kpi_configs(id),
  overall_score    DECIMAL(3,2) NOT NULL CHECK (overall_score >= 0 AND overall_score <= 1),
  passed           BOOLEAN NOT NULL,
  kpi_scores       JSONB NOT NULL DEFAULT '[]',   -- [{goal, score, passed, evidence}]
  summary          TEXT NOT NULL,
  script_suggestions JSONB,                        -- added in migration 002
  llm_provider     VARCHAR(50) NOT NULL,
  llm_model        VARCHAR(100) NOT NULL,
  analyzed_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_analysis_transcript_id ON analysis_results(transcript_id);
```

### use_actions
Flagged transcript segments requiring human intervention.
```sql
CREATE TABLE use_actions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id           UUID NOT NULL REFERENCES analysis_results(id) ON DELETE CASCADE,
  transcript_turn_index INTEGER NOT NULL,
  type                  VARCHAR(50) NOT NULL
                        CHECK (type IN ('missed_opportunity', 'deviation', 'escalation_needed')),
  description           TEXT NOT NULL,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_use_actions_analysis_id ON use_actions(analysis_id);
```

## REST API Endpoints

### Agent Management
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/agents?locationId=` | ghlAuth | List agents for location |
| POST | `/api/agents/sync?locationId=` | ghlAuth | Sync agents from GHL Voice AI API |
| GET | `/api/agents/:agentId?locationId=` | ghlAuth | Get agent detail + analysis history |
| PUT | `/api/agents/:agentId?locationId=` | ghlAuth | Update agent script |
| POST | `/api/agents/:agentId/simulate?locationId=` | ghlAuth | Manual transcript analysis |
| POST | `/api/agents/:agentId/transcripts/:id/reanalyze?locationId=` | ghlAuth | Re-run analysis |

### KPI Configuration
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/kpi/:agentId?locationId=` | ghlAuth | Get KPI config for agent |
| PUT | `/api/kpi/:agentId?locationId=` | ghlAuth | Update KPI goals & threshold |
| POST | `/api/kpi/:agentId/suggest?locationId=` | ghlAuth | LLM-generate KPI suggestions from script |

### Webhooks
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/webhooks/ghl` | Ed25519 signature | GHL marketplace webhook (INSTALL, UNINSTALL, VoiceAiCallEnd) |
| POST | `/webhooks/call-completed` | HMAC-SHA256 | Legacy webhook for call transcripts |

### OAuth
| Method | Path | Description |
|--------|------|-------------|
| POST | `/oauth/callback` | GHL OAuth redirect handler |
| POST | `/oauth/installing` | HTML install page with polling |

### Real-time
| Method | Path | Description |
|--------|------|-------------|
| GET | `/stream?locationId=` | SSE endpoint (text/event-stream, 15s keepalive) |
| GET | `/health` | Health check → `{ status: "ok", timestamp }` |

## Infrastructure (docker-compose.yml)

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| postgres | postgres:16-alpine | 5432 | Application database |
| postgres_test | postgres:16-alpine | 5433 | Test database |
| redis | redis:7-alpine | 6379 | Cache / message queue |
| temporal | temporalio/auto-setup:1.24.2 | 7233 | Workflow engine |
| temporal-ui | temporalio/ui:2.26.2 | 8080 | Workflow visibility dashboard |

## Temporal Workflow

**`analyzeCallWorkflow`** — Linear pipeline with per-activity retry policies:

```
loadTranscriptActivity    (2 retries, 1s backoff)
  → loadKpiConfigActivity (2 retries, 1s backoff)
  → buildPromptActivity   (2 retries, 1s backoff)
  → callLLMActivity       (3 retries, 2s exponential backoff — handles rate limits)
  → persistResultsActivity(2 retries, 1s backoff)
  → broadcastSSEActivity  (2 retries, 1s backoff)

On failure → markFailedActivity (sets transcript.status = 'analysis_failed', pushes SSE event)
```

## LLM Provider Architecture

Factory pattern in `lib/llm/index.ts`:
- Reads `LLM_PROVIDER` env var (`openai` | `anthropic` | `groq`)
- `openai-provider.ts` — Uses `gpt-4o` with `response_format: { type: 'json_object' }`
- `anthropic-provider.ts` — Uses `claude-3-5-haiku` with structured JSON prompt
- Groq uses the OpenAI adapter with Groq's API endpoint

## Frontend Design System — "Dark Signal"

```css
--bg-base:       #0A0B0E;
--bg-surface:    #111318;
--bg-elevated:   #181B22;
--border:        #1E2230;
--text-primary:  #F0F4FF;
--text-secondary:#7C8BA0;
--signal:        #F59E0B;   /* amber — live indicators */
--pass:          #10B981;   /* emerald */
--fail:          #F43F5E;   /* rose */
--warning:       #FB923C;   /* orange */
```

Fonts: Syne (headings), IBM Plex Mono (metrics/timestamps), DM Sans (body/labels).
