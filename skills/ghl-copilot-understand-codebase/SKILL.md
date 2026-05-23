---
name: ghl-copilot-understand-codebase
description: Use when starting any session on the Voice AI Observability Copilot project, before making any code changes, or when needing orientation on architecture, data flows, or module boundaries.
---

# Understanding the GHL Voice AI Copilot Codebase

## Architecture Overview

Two-layer HighLevel Marketplace App:

**Backend (Node.js / Express)**
```
src/
  routes/       # Thin HTTP handlers — one file per domain
  services/     # All business logic and AI pipeline
  models/       # DB schemas and data access
  middleware/   # GHL auth, error handling
  lib/          # GHL API client, LLM client (never call external APIs elsewhere)
  config/       # Environment and constants
```

**Frontend (Vue.js / Pinia)**
```
src/
  views/        # Route-level pages
  components/   # Reusable UI pieces
  stores/       # Pinia stores (global state)
  composables/  # Reusable composition functions
  api/          # Axios wrappers (one file per backend domain)
  router/       # Vue Router config
```

## Core Data Flow

```
GHL Voice AI call ends
  → Webhook hits POST /webhooks/call-completed
  → TranscriptService.ingest(transcript, locationId)
  → AnalysisService.analyze(transcript, agentKpiConfig)  ← LLM call
  → AnalysisResult saved to DB
  → Frontend polls GET /api/agents/:id/analysis
  → Dashboard renders metrics + recommendations
```

## Key Integration Points

| Point | Where | Risk |
|---|---|---|
| GHL OAuth tokens | `src/middleware/ghl-auth.js` | Token expiry — always refresh transparently |
| GHL API calls | `src/lib/ghl-client.js` | Rate limits — never call GHL outside this lib |
| Webhook ingestion | `src/routes/webhooks.js` | Silent drops — log every failed ingest |
| LLM analysis | `src/services/analysis-service.js` | Prompt changes affect all historical results |
| GHL Marketplace embed | Widget iframe or custom JS injection | CSP restrictions in GHL iframe context |

## Module Responsibilities

| File | Owns |
|---|---|
| `routes/webhooks.js` | GHL event ingestion entry point |
| `routes/agents.js` | Agent CRUD + analysis queries |
| `services/transcript-service.js` | Parsing, normalization, storage |
| `services/analysis-service.js` | LLM pipeline: KPI check → deviation → recommendation |
| `services/kpi-service.js` | Per-agent KPI config CRUD |
| `lib/ghl-client.js` | All GHL REST API calls + token refresh |
| `lib/llm-client.js` | All LLM calls (provider-agnostic wrapper) |
| `views/Dashboard.vue` | Main observability view |
| `views/AgentDetail.vue` | Per-agent analysis + recommendation panel |
| `stores/agents.js` | Agent list, selected agent |
| `stores/analysis.js` | Analysis results, recommendations, loading state |

## How to Orient Before Making Changes

1. Read `src/lib/ghl-client.js` — how GHL API calls are structured
2. Read `src/services/analysis-service.js` — the core AI pipeline
3. Run `git log --oneline -10` — what changed recently
4. Check `src/stores/` — what state the frontend already manages
5. Check the relevant route file for the domain you're touching

## When the Codebase Is New

If files above don't exist yet, read the assignment PDF at `docs/[Hiring] FSB Assignment Q226.pdf` and the design spec at `docs/superpowers/specs/` to understand the intended architecture before creating any file.
