---
name: ghl-copilot-debug
description: This skill should be used when encountering any bug, error, failure, or unexpected behavior in the Voice AI Observability Copilot. Also triggers when the user says "debug this", "why is this failing", "troubleshoot", "webhook not working", "SSE not connecting", "Temporal workflow failed", "LLM error", "analysis not completing", or "dashboard not updating".
---

# Debugging the GHL Voice AI Copilot

## Systematic Approach

Before proposing any fix, complete these steps in order:

1. **Identify the layer** — Which layer is the error in?
2. **Read the relevant source** — Never guess at code; read the actual file
3. **Trace the data flow** — Follow the request through the pipeline
4. **Check the boundaries** — Most bugs live at integration boundaries
5. **Verify the fix** — Run tests before claiming done

## Layer Identification

| Symptom | Layer | Start Reading |
|---|---|---|
| Webhook returns non-200 | Backend routes | `routes/webhooks.ts` |
| Analysis never completes | Temporal workflow | `workflows/analyze-call.workflow.ts` + Temporal UI at :8080 |
| LLM returns bad output | LLM provider | `activities/build-prompt.activity.ts` + `lib/llm/` |
| Dashboard doesn't update | SSE pipeline | `lib/sse-manager.ts` + `composables/useSSE.ts` |
| Agent list empty | GHL sync | `services/agents-service.ts` + `lib/ghl-client.ts` |
| KPI scores wrong | Scoring logic | `activities/persist-results.activity.ts` |
| DB query fails | Database | `db/index.ts` + check migration state |
| Auth fails (401) | Middleware | `middleware/ghl-auth.ts` + `locations` table |
| Frontend API error | API layer | `frontend/src/api/*.ts` + browser network tab |
| Config validation error | Startup | `config.ts` — check `.env` against Zod schema |

## Common Issue Patterns

### Webhook Not Processing
1. Check Ed25519 / HMAC signature verification in `routes/webhooks.ts`
2. Check `ghl_call_id` uniqueness — duplicates are silently accepted (200)
3. Check Temporal client connection — workflow may fail to start
4. Check `transcripts` table: is the row inserted with `status = 'pending'`?

### Temporal Workflow Stuck
1. Open Temporal UI at `http://localhost:8080`
2. Find the workflow by ID or search by agent/location
3. Check which activity failed and its error message
4. Check worker is running: `workers/temporal-worker.ts` must be a separate process
5. Check activity retry policies — `callLLMActivity` retries 3x with exponential backoff

### SSE Not Pushing Updates
1. Verify frontend connects: `GET /stream?locationId=xxx` should return `text/event-stream`
2. Check `lib/sse-manager.ts` — connections are in-memory, keyed by locationId
3. The broadcast path: `broadcastSSEActivity` -> HTTP POST to `/internal/broadcast` -> SSE push
4. Cross-process issue: worker process must call the main server's broadcast endpoint
5. Check 15-second keepalive comments — if missing, connection may be dead

### LLM Analysis Failing
1. Check `LLM_PROVIDER` env var matches the API key provided
2. Check `activities/call-llm.activity.ts` for the error type (rate limit, timeout, auth)
3. Rate limits: Temporal will retry 3x with exponential backoff (2s, 4s, 8s)
4. Bad JSON output: Check `lib/llm/openai-provider.ts` or `anthropic-provider.ts` parsing
5. Verify the prompt in `activities/build-prompt.activity.ts` matches expected LLM format

### GHL API Errors
1. Check token expiry in `locations` table — `token_expires_at` column
2. Token refresh is automatic in `lib/ghl-client.ts` on 401
3. Rate limit (429): Check `Retry-After` header
4. Scope errors: Verify marketplace app has required permissions
5. Sandbox differences: Some GHL API endpoints behave differently in sandbox

## Debugging Commands

```bash
# Check infrastructure health
make infra              # Ensure Postgres, Redis, Temporal are running
docker compose ps       # See container status

# Check database state
docker compose exec postgres psql -U postgres -d voice_copilot \
  -c "SELECT status, count(*) FROM transcripts GROUP BY status;"

# Check Temporal workflows
# Open http://localhost:8080 for Temporal UI

# Simulate a webhook for testing
npm run simulate --prefix voice-ai-copilot/backend

# Run backend tests
npm test --prefix voice-ai-copilot/backend

# Run specific test
npx jest --prefix voice-ai-copilot/backend src/routes/webhooks.test.ts --no-coverage
```

## Error Handling Reference

| Boundary | Failure | Handling |
|---|---|---|
| Webhook | Invalid signature | 401, logged |
| Webhook | Malformed payload | 400, logged with raw body |
| Webhook | Duplicate `ghl_call_id` | 200 silently (idempotent) |
| LLM activity | Timeout / rate limit | Temporal retries x3, exponential backoff |
| LLM activity | Max retries exceeded | `status = 'analysis_failed'`, SSE push |
| GHL API | 401 expired token | Auto-refresh + retry once |
| GHL API | 429 rate limit | Temporal reschedule after Retry-After |
| All routes | Unhandled error | `middleware/error-handler.ts` — logs context, returns `{ error, code }` |

## Additional Resources

For detailed troubleshooting flows and error catalog, consult:
- **`references/troubleshooting.md`** — Step-by-step debugging procedures for each subsystem
