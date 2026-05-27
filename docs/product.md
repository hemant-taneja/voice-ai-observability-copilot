# Product, UX & Implementation

## Problem

Voice AI agents handle hundreds of calls per day. There is no visibility into whether they are actually achieving their goals — greeting callers warmly, following the script, handling objections, escalating when needed. Managers cannot listen to every call. Problems compound silently.

## Solution

Attach a configurable "success rubric" (KPI goals) to each agent. Every call transcript is automatically evaluated against that rubric by an LLM. Results are pushed live to a dashboard so managers see patterns instantly, coaches can act on specific moments, and agents can be improved based on evidence rather than guesswork.

---

## UX Principles

**Zero-latency feedback**
Analysis results are pushed via SSE the moment Temporal finishes. No polling, no manual refresh. The dashboard updates while the manager is still looking at it.

**Agent-scoped KPIs**
Goals are configured per agent, not globally. An outbound sales agent (book appointments, handle price objections) and an inbound support agent (resolve issues, show empathy) have entirely different success criteria.

**Actionable, not just scored**
Beyond pass/fail, the system identifies specific moments in the transcript:
- `missed_opportunity` — agent could have upsold, retained, or offered an alternative
- `deviation` — agent went off-script or gave incorrect information
- `escalation_needed` — caller showed frustration or complexity that needed a human

Each flag is linked to the exact turn index so the coach can jump straight to the relevant moment.

**Script improvement loop**
Analysis feeds into script suggestions. The LLM recommends specific wording changes based on what worked and what did not across calls. The agent's script can then be updated in the UI and future analyses use the new version.

**Playground for safe iteration**
Agents and KPI configs can be validated with synthetic transcripts before going live. No real calls, no real customers, no risk. This also lets the team demo the product without needing a live GHL environment.

---

## Information Architecture

```
Dashboard
  Purpose: aggregate view across all agents
  Shows: total calls, pass rate, avg score, open actions
  Updates: live via SSE when any analysis completes

  └── Agent Card (per agent)
        Shows: name, call count, pass rate trend

       └── Agent Detail
             Shows: per-call transcript history, KPI breakdown per call
             └── Transcript Viewer — turn-by-turn with use action annotations
             └── Script Suggestions — LLM-recommended wording changes
             └── KPI Config Editor — configure goals, weights, pass threshold

Playground
  Purpose: manual testing and iteration
  Flow: pick agent → add turns → run analysis → see live result
```

---

## Key Implementation Decisions

### Deterministic scoring

The overall score is computed server-side as a weighted average of per-goal LLM scores. The LLM cannot inflate or hallucinate the final score. This makes the scoring auditable and consistent — changing goal weights immediately changes historical score interpretation.

```
overall_score = Σ(goal.weight × goal.score) / Σ(goal.weight)
```

### Idempotent ingestion

GHL retries webhook delivery on timeout. The `ghl_call_id` UNIQUE constraint silently deduplicates repeat deliveries. The frontend and analysis pipeline never see a call twice.

### SSE stream architecture

Each connected frontend client subscribes to `/stream?locationId=xxx`. When an analysis completes, the Temporal activity POSTs to `/internal/broadcast` with the locationId and agentId. The SSE manager fans out the event to all clients subscribed to that location. No message broker needed at current scale.

### LLM provider abstraction

The `callLLM` activity uses a provider-agnostic interface. Switching from OpenAI to Anthropic or Groq is a single env var change (`LLM_PROVIDER`). The prompt format and output schema are identical across providers.

### Agent sync (not auto-creation)

Agents do not auto-create on transcript ingestion. They must exist in the DB before a transcript can be stored for them. This is intentional — it prevents orphaned agent records from rogue webhooks and keeps the agent list clean. Agents are synced explicitly via `POST /api/agents/sync`.

### Token storage

GHL OAuth tokens are stored in the `locations` table. Agency-level tokens are stored as `company:<companyId>`. Location-level tokens are stored as plain `locationId`. The `mintAndStoreLocationToken` function uses the agency token to obtain a location-scoped token via GHL's `/oauth/locationToken` endpoint.

---

## Frontend State Management

```
stores/agents.ts    — agent list, per-agent metrics
stores/analysis.ts  — transcript history, analysis results per agent
stores/stream.ts    — SSE connection state (connected/disconnected)
stores/review.ts    — local review notes per transcript (not yet persisted)
```

SSE events (`analysis.complete`, `analysis.failed`) trigger store refreshes and toast notifications. The Playground watches the same SSE stream — it knows an analysis is done when it receives the event matching its submitted `transcriptId`.

---

## Limitations (current)

**Token expiry** — GHL access tokens expire in ~24 hours. There is no automatic refresh. After expiry, API calls (agent sync) will fail with 401. Fix: implement a background refresh job using the stored `refresh_token`.

**Agent sync is manual** — After installing on a new sub-account, someone must call `POST /api/agents/sync` to pull agents in. Fix: trigger sync automatically inside `mintAndStoreLocationToken` after the INSTALL webhook fires.

**Review notes are local** — Transcript annotations and review comments are stored in frontend Pinia store only. They are lost on page refresh. Fix: move to a backend `reviews` table with agent/transcript FK.
