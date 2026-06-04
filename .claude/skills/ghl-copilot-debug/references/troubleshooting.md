# Voice AI Copilot — Troubleshooting Reference

## Webhook Troubleshooting

### Ed25519 Signature Verification Failure
**Symptom:** POST `/webhooks/ghl` returns 401
**Steps:**
1. Read `routes/webhooks.ts` — find the Ed25519 verification logic
2. Check that `GHL_WEBHOOK_SECRET` in `.env` matches the GHL app dashboard secret
3. Verify the raw body is used for signature verification (not parsed JSON)
4. Check that the `x-ghl-signature` header is present in the request
5. For testing: use the `simulate-webhook.ts` script which bypasses verification

### HMAC-SHA256 Verification Failure
**Symptom:** POST `/webhooks/call-completed` returns 401
**Steps:**
1. Check `GHL_WEBHOOK_SECRET` env var
2. Verify HMAC is computed over the raw request body
3. Check `x-ghl-signature` header format (hex string)
4. Compare with: `crypto.createHmac('sha256', secret).update(rawBody).digest('hex')`

### Transcript Not Appearing in DB
**Steps:**
1. Check webhook response code (should be 200)
2. Query: `SELECT * FROM transcripts ORDER BY ingested_at DESC LIMIT 5;`
3. Check for unique constraint violation on `ghl_call_id`
4. Verify `agent_id` exists in `agents` table
5. Verify `location_id` exists in `locations` table

## Temporal Workflow Troubleshooting

### Workflow Not Starting
**Steps:**
1. Verify Temporal server is running: `docker compose ps temporal`
2. Check Temporal connection in `config.ts`: `TEMPORAL_ADDRESS=localhost:7233`
3. Verify worker is running: Check for the `temporal-worker.ts` process
4. Check Temporal UI at `http://localhost:8080` — look for the `voice-copilot` namespace

### Activity Failing Repeatedly
**Steps:**
1. In Temporal UI, find the workflow execution
2. Click on the failed activity — check the error message
3. Common causes:
   - `callLLMActivity`: API key invalid, rate limited, model unavailable
   - `persistResultsActivity`: DB constraint violation, missing FK
   - `broadcastSSEActivity`: Main server not running (can't POST to /internal/broadcast)
   - `loadTranscriptActivity`: Transcript deleted between webhook and activity execution
4. Check retry count — if max retries exhausted, workflow fails

### Worker Not Processing Activities
**Steps:**
1. Check worker process is running separately from main server
2. Worker connects to Temporal at `TEMPORAL_ADDRESS`
3. Worker registers activities from `activities/index.ts`
4. Check worker logs for connection errors
5. Verify `TEMPORAL_NAMESPACE` matches (default: 'default')

## SSE Troubleshooting

### Frontend Not Receiving Events
**Steps:**
1. Open browser DevTools → Network tab → filter by EventStream
2. Verify connection to `GET /stream?locationId=xxx` shows `200 text/event-stream`
3. Check for 15-second `:keepalive` comments in the stream
4. Verify `locationId` matches between frontend and backend

### SSE Connection Drops
**Steps:**
1. Check `composables/useSSE.ts` — exponential backoff reconnection
2. Proxy/firewall may close idle connections — keepalive should prevent this
3. Check browser console for EventSource errors
4. Verify no CORS issues (check `app.ts` CORS middleware)

### Events Not Broadcasting After Analysis
**Steps:**
1. `broadcastSSEActivity` POSTs to `/internal/broadcast` on the main server
2. If worker and server are different processes, ensure the HTTP call succeeds
3. Check `sse-manager.ts` — connections are in-memory, won't survive server restart
4. Verify the broadcast payload: `{ type: 'analysis.complete' | 'analysis.failed', agentId }`

## LLM Provider Troubleshooting

### OpenAI Provider Errors
**Steps:**
1. Check `OPENAI_API_KEY` is valid and has credits
2. Verify `LLM_PROVIDER=openai` in `.env`
3. Check model availability: `gpt-4o` requires specific API tier
4. Rate limit errors: Temporal retries handle this, but check for 429 responses
5. JSON mode issues: Verify `response_format: { type: 'json_object' }` is set

### Anthropic Provider Errors
**Steps:**
1. Check `ANTHROPIC_API_KEY` is valid
2. Verify `LLM_PROVIDER=anthropic` in `.env`
3. Check model: `claude-3-5-haiku` must be available on the account
4. JSON parsing: Anthropic uses structured prompting, not a JSON mode flag

### Groq Provider Errors
**Steps:**
1. Groq uses the OpenAI adapter with different base URL
2. Check `GROQ_API_KEY` or equivalent env var
3. Model availability may differ from OpenAI

## GHL API Troubleshooting

### Token Refresh Failing
**Steps:**
1. Check `locations` table: `access_token`, `refresh_token`, `token_expires_at`
2. `ghl-client.ts` auto-refreshes on 401 using `refresh_token`
3. If refresh token is expired/revoked, user must re-install the marketplace app
4. Check `GHL_CLIENT_ID` and `GHL_CLIENT_SECRET` in `.env`

### Agent Sync Returning Empty
**Steps:**
1. POST `/api/agents/sync?locationId=xxx` triggers GHL API call
2. Check `ghl-client.ts` → `listAgents()` method
3. Verify location has Voice AI agents configured in GHL
4. Check GHL API response in server logs
5. Token may have wrong scopes for Voice AI API

### OAuth Flow Issues
**Steps:**
1. Check `routes/oauth.ts` — callback handler
2. Verify `GHL_CLIENT_ID` and redirect URI match GHL app config
3. Check `company_id` in locations table (added in migration 003)
4. The install flow uses an HTML page with inline polling — check CSP

## Database Troubleshooting

### Migration Failures
**Steps:**
1. Check Postgres is running: `docker compose ps postgres`
2. Migrations are idempotent (`IF NOT EXISTS` throughout)
3. Run manually: `cd voice-ai-copilot/backend && npx ts-node src/db/migrate.ts`
4. Check for lock issues: `SELECT * FROM pg_locks WHERE NOT granted;`

### Connection Pool Exhaustion
**Steps:**
1. Pool max is 10 connections (set in `db/index.ts`)
2. Check for leaked connections — ensure `getClient()` calls release
3. Monitor: `SELECT count(*) FROM pg_stat_activity WHERE datname = 'voice_copilot';`
4. Increase pool size if needed in `db/index.ts`

## Frontend Troubleshooting

### Dashboard Not Loading Agents
**Steps:**
1. Check browser console for API errors
2. Verify `VITE_API_BASE_URL` in frontend environment
3. Check `stores/agents.ts` — `fetchAll()` action
4. Verify backend is running on the expected port
5. Check CORS — `app.ts` should allow the frontend origin

### Components Not Updating After SSE Event
**Steps:**
1. Check `stores/stream.ts` — SSE event handler
2. Verify store action is called on event receipt
3. Check Vue reactivity — ensure `ref()` is used correctly
4. Open Vue DevTools → check store state changes
