# Voice AI Copilot - Submission README

Voice AI Copilot is an observability and coaching suite for HighLevel Voice AI agents. It connects to a HighLevel sub-account through a private marketplace app, syncs Voice AI agents, ingests call transcripts, analyzes them against configurable KPI goals, and streams results into a dashboard in real time.

Deployed sandbox URL:

```text
https://voice-agent-copilot.duckdns.org
```

HighLevel private app install URL:

```text
https://marketplace.gohighlevel.com/v2/oauth/chooselocation?response_type=code&redirect_uri=https%3A%2F%2Fvoice-agent-copilot.duckdns.org%2Foauth%2Fcallback&client_id=6a1621b8baab5b591f8bf450-mpn9rfzh&scope=voice-ai-dashboard.readonly+voice-ai-agents.readonly+voice-ai-agents.write+voice-ai-agent-goals.readonly+voice-ai-agent-goals.write+oauth.write+oauth.readonly&version_id=6a1621b8baab5b591f8bf450
```

## Architecture

The system is split into a Vue dashboard, a Node/Express backend, and an asynchronous analysis pipeline.

```text
HighLevel Private App
  -> OAuth callback / webhook delivery
  -> Express API on GCP
  -> PostgreSQL for tokens, agents, KPI configs, transcripts, analysis results
  -> Temporal workflow for transcript analysis
  -> LLM provider for KPI reasoning and coaching suggestions
  -> SSE stream back to Vue dashboard
```

The backend is deployed on GCP using Docker Compose. The production VM runs:

| Service | Purpose |
|---|---|
| `app` | Express API and Temporal worker |
| `postgres` | Persistent storage |
| `redis` | Runtime support service |
| `temporal` | Workflow orchestration |
| `caddy` | HTTPS reverse proxy and frontend hosting |

Important routes:

| Route | Purpose |
|---|---|
| `GET /oauth/callback` | Exchanges HighLevel OAuth code and stores the location token |
| `POST /api/agents/sync` | Pulls Voice AI agents from the installed HighLevel location |
| `POST /webhooks/ghl` | Receives HighLevel marketplace webhooks, including `VoiceAiCallEnd` |
| `POST /webhooks/call-completed` | Mock/simulation webhook used for QA |
| `GET /stream?locationId=...` | Server-sent events for live dashboard refresh |

## Team of One Ownership

I handled the project as a "Team of One" across product, design, engineering, and QA.

**Product:** I scoped the product around the highest-value pain point: managers need to know whether Voice AI agents are actually following goals and creating good outcomes without listening to every call. The core loop is install, sync agents, configure KPI goals, ingest transcripts, review analysis, and improve scripts.

**Design:** I designed the dashboard around operational review rather than a marketing-style interface. The main views prioritize scanability: agent health, pass/fail status, KPI scores, transcript moments, use-action flags, and script suggestions. The goal was to make the next action obvious to a manager or QA reviewer.

**Engineering:** I built the backend as an event-driven pipeline. OAuth stores location tokens, agent sync pulls real HighLevel Voice AI agents, transcript ingestion is idempotent, Temporal handles retryable analysis workflows, and SSE keeps the frontend updated without polling. LLM scoring is structured, while the final overall score is calculated deterministically from weighted KPI goals.

**QA:** I tested the system with seeded local data and mock webhook simulations. The mock flow exercises the same backend path used by live transcripts: webhook receipt, transcript persistence, Temporal workflow, LLM analysis, database persistence, and dashboard refresh. I also documented sandbox setup and known integration limits so reviewers can distinguish completed behavior from account-dependent behavior.

## Functional vs Mocked

| Area | Status | Notes |
|---|---|---|
| GCP backend deployment | Functional | Deployed at `https://voice-agent-copilot.duckdns.org` |
| HighLevel private app OAuth install | Functional | Installs into a selected sub-account/location and stores OAuth token |
| Agent sync from HighLevel | Functional | `Sync from HighLevel` calls the real HighLevel Voice AI agent API for the installed location |
| Dashboard views | Functional | Shows synced agents, KPI config, analysis results, transcript details, and script suggestions |
| KPI configuration | Functional | Goals and success thresholds are stored per agent |
| Transcript analysis pipeline | Functional | Temporal workflow calls configured LLM provider and persists results |
| Real-time dashboard updates | Functional | SSE stream refreshes dashboard after analysis completes |
| Live `VoiceAiCallEnd` webhook listener | Implemented, not live-verified | Server endpoint is complete, but the current HighLevel account did not have the required Voice AI integrations available for an end-to-end live webhook test |
| Mock transcript webhook | Functional | Tested using signed mock webhook simulation against the same ingestion and analysis path |
| Demo seed data | Mock/dev only | Used for local review without a HighLevel install |
| Mock transcript content | Mock/dev only | Used to demonstrate pass, fail, and partial call outcomes |

## How to Run or Review

Local development and sandbox installation steps are documented here:

```text
docs/highlevel-sandbox-installation.md
```

The shortest sandbox review path is:

1. Open the private app install URL.
2. Install it into a HighLevel sandbox sub-account.
3. Land on the dashboard with `?locationId=<HIGHLEVEL_LOCATION_ID>&installed=1`.
4. Click `Sync from HighLevel`.
5. Configure KPI goals for a synced agent.
6. Use mock transcript simulation if live Voice AI transcript webhooks are unavailable.

## Known Limitation

The live HighLevel transcript webhook could not be tested end to end because the required Voice AI integrations were not available on my account. The receiving endpoint and analysis pipeline are implemented, and the same server-side path has been validated through mock webhook simulation.

