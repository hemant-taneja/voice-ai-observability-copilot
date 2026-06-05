---
name: ghl-copilot-scope-feature
description: This skill should be used when any feature request arrives for the Voice AI Observability Copilot, before planning or writing any code. Also triggers when the user says "add a feature", "I want to build", "scope this", "what would it take to add", or needs to map all affected layers and surface GHL integration risks.
---

# Scoping Features for the GHL Copilot

Run this before `superpowers:writing-plans`. Never skip it — GHL integration risks are non-obvious.

## Scope Checklist

Answer every question. Leave nothing as "probably fine."

### Backend (`voice-ai-copilot/backend/src/`)
- [ ] New or modified **route**? Which domain file? (`routes/webhooks.ts`, `routes/agents.ts`, `routes/kpi.ts`, `routes/stream.ts`, `routes/oauth.ts`)
- [ ] New or modified **service**? (`services/transcript-service.ts`, `services/agents-service.ts`, `services/kpi-service.ts`)
- [ ] **DB schema change**? If yes -> new migration file in `db/migrations/` (next number after 003)
- [ ] New or modified **Temporal activity**? Check `activities/` — currently 8 activity files
- [ ] New or modified **GHL API call**? Check: required OAuth scope, rate limit, sandbox availability. All calls go through `lib/ghl-client.ts`
- [ ] **LLM prompt change**? Changes in `activities/build-prompt.activity.ts` affect all future analyses
- [ ] New **TypeScript types**? Add to `types/ghl.types.ts`, `types/llm.types.ts`, or `types/analysis.types.ts`

### Frontend (`voice-ai-copilot/frontend/src/`)
- [ ] New **view** (route-level page)? Add to `router/index.ts` (currently 3 routes: `/`, `/agents/:id`, `/playground`)
- [ ] New **component**? Reusable -> `components/`. Page-specific -> stay in `views/`
- [ ] New **Pinia store state**? Or can an existing store be extended? (`stores/agents.ts`, `stores/analysis.ts`, `stores/stream.ts`, `stores/review.ts`)
- [ ] New **API method** in `api/agents.ts`, `api/analysis.ts`, or `api/kpi.ts`?
- [ ] New **composable**? (`composables/useSSE.ts`, `composables/useToast.ts`)

### Integration Risk
- [ ] Touches **GHL OAuth / token handling**? -> High risk. Test in sandbox first
- [ ] Touches **webhook processing** (`routes/webhooks.ts`)? -> Missed events are silent. Add structured logging
- [ ] Affects **existing analysis results** in the DB? -> May require backfill or migration
- [ ] Requires new **GHL Marketplace permissions**? -> Requires marketplace app update + review
- [ ] Runs **inside the GHL iframe**? -> Check CSP headers; inline scripts may be blocked
- [ ] Modifies **Temporal workflow** (`workflows/analyze-call.workflow.ts`)? -> Affects in-flight workflows

### Cross-Cutting
- [ ] Does this affect **all agents** or just a subset?
- [ ] Does this need **error handling** for GHL API being down?
- [ ] Does this change the **public API contract** (response shape, new fields)?
- [ ] Does this affect the **SSE event stream** (`lib/sse-manager.ts`)?

## Output Format

Write this summary before handing off to `superpowers:writing-plans`:

```
Feature: <name>
Backend changes: <files / modules>
Frontend changes: <files / components>
GHL API impact: <yes/no — scope + risk>
DB migration: <yes/no>
Temporal workflow change: <yes/no>
Risk level: Low | Medium | High
Risk notes: <specific concerns>
Blockers: <unresolved dependencies>
```

## Risk Level Guide

| Level | When |
|---|---|
| **Low** | Pure frontend, no GHL API, no DB schema change, no Temporal change |
| **Medium** | New backend route + service, existing GHL scopes, new activity |
| **High** | GHL OAuth changes, webhook processing, LLM prompt changes, marketplace permission changes, Temporal workflow restructuring |
