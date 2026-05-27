# Voice AI Copilot — Architecture

```
  HighLevel Platform
  ┌──────────────────────┐
  │  GHL Marketplace App │  OAuth install → auto-registers webhook
  └──────────┬───────────┘
             │  POST /webhooks/call-completed
             │  (HMAC-signed payload: call metadata + transcript turns)
             ▼
  ┌──────────────────────────────────────────────────────────┐
  │                GCP e2-medium VM  (asia-south1)           │
  │                                                          │
  │  ┌────────────┐                                          │
  │  │   Caddy    │  :443  HTTPS + auto-TLS (DuckDNS)       │
  │  │            │  SSE: flush_interval -1 (no buffering)   │
  │  └─────┬──────┘                                          │
  │        │  reverse proxy                                   │
  │        ▼                                                  │
  │  ┌───────────────────────────────────────────────────┐   │
  │  │              Express API  :3000                   │   │
  │  │                                                   │   │
  │  │  POST /webhooks/call-completed                    │   │
  │  │        verify HMAC signature                      │   │
  │  │        insert transcript → Postgres               │   │
  │  │        startWorkflow()  ──────────────────────►   │   │
  │  │                                            Temporal   │
  │  │  GET  /stream?locationId=…   (SSE)         :7233  │   │
  │  │        ◄── Redis pub/sub broadcast                │   │
  │  │                                                   │   │
  │  │  REST  /api/agents  /api/kpi  /api/analysis       │   │
  │  └───────────────────────────────────────────────────┘   │
  │                                                          │
  │  ┌───────────────────────────────────────────────────┐   │
  │  │       Temporal Worker   (pm2, same container)     │   │
  │  │                                                   │   │
  │  │  analyzeCall workflow                             │   │
  │  │    1.  loadKpiConfig    ── read Postgres          │   │
  │  │    2.  runLlmAnalysis   ── OpenAI / Anthropic /   │   │
  │  │                              Groq  (swappable)    │   │
  │  │    3.  persistResults   ── write Postgres         │   │
  │  │    4.  broadcastSSE     ── Redis pub/sub          │   │
  │  │                                                   │   │
  │  │  Durable execution: auto-retry on LLM timeout,   │   │
  │  │  resumes from checkpoint if server restarts       │   │
  │  └───────────────────────────────────────────────────┘   │
  │                                                          │
  │   ┌──────────┐    ┌─────────┐    ┌──────────────────┐   │
  │   │ Postgres │    │  Redis  │    │ Temporal Server  │   │
  │   │  :5432   │    │  :6379  │    │ auto-setup :7233 │   │
  │   └──────────┘    └─────────┘    └──────────────────┘   │
  └──────────────────────────────────────────────────────────┘
             │
             │  SSE  EventSource (persistent HTTP connection)
             ▼
  ┌──────────────────────────────────────────┐
  │           Vue 3 Dashboard                │
  │   voice-agent-copilot.duckdns.org        │
  │   ?locationId=loc-seed-1                 │
  │   Served as static files by Caddy        │
  └──────────────────────────────────────────┘


  CI / CD
  ─────────────────────────────────────────────────────────
  Push to main
    → GitHub Actions: run 57 tests (Jest + Vitest)
    → SSH into GCP VM
    → git pull → npm ci → build frontend → docker compose up
    → run DB migrations
  Zero manual steps.


  LLM Provider  (single env var, no code change needed)
  ─────────────────────────────────────────────────────────
  LLM_PROVIDER=openai     →  GPT-4o
  LLM_PROVIDER=anthropic  →  Claude 3.5 Sonnet
  LLM_PROVIDER=groq       →  Llama 3.3 70B  (via Groq API)


  Data Model  (Postgres)
  ─────────────────────────────────────────────────────────
  locations
    └── agents
          ├── kpi_configs   (goals + weights + pass threshold)
          └── transcripts
                └── analysis_results
                      ├── kpi_scores      (per-goal score + evidence)
                      ├── use_actions     (deviation / missed / escalation)
                      └── script_suggestions  (LLM-generated rewrites)
```
