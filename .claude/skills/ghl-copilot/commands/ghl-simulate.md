---
description: Simulate a GHL webhook call to test the analysis pipeline
argument-hint: [agent-name-or-id]
allowed-tools: Bash(npx:*), Bash(npm:*), Bash(curl:*), Read
---

Simulate a Voice AI call webhook to test the full analysis pipeline end-to-end.

**Option A — Use the built-in script:**

If `voice-ai-copilot/backend/src/scripts/simulate-webhook.ts` exists:
```
cd voice-ai-copilot/backend && npx ts-node src/scripts/simulate-webhook.ts
```

**Option B — Manual curl (if script doesn't exist or user wants a custom payload):**

1. Read `voice-ai-copilot/backend/src/routes/webhooks.ts` to understand the expected payload format and signature method.

2. Construct a test payload:
```json
{
  "ghl_call_id": "simulated-call-<timestamp>",
  "location_id": "demo-location-001",
  "agent_id": "<agent_id from agents table>",
  "caller_phone": "+1555000<random>",
  "duration_seconds": 120,
  "turns": [
    {"speaker": "agent", "text": "Hello, thank you for calling. How can I help you today?", "timestamp_ms": 0},
    {"speaker": "caller", "text": "Hi, I'm interested in your services.", "timestamp_ms": 2000},
    {"speaker": "agent", "text": "I'd be happy to help with that. Can I get your name?", "timestamp_ms": 4500},
    {"speaker": "caller", "text": "Sure, it's John Smith.", "timestamp_ms": 6000},
    {"speaker": "agent", "text": "Great, John. Let me tell you about our offerings.", "timestamp_ms": 8000}
  ]
}
```

3. If HMAC verification is required, compute the signature and include it as `x-ghl-signature` header.

4. POST to `http://localhost:3000/webhooks/call-completed`.

**After simulation:**
1. Check the response status code (should be 200)
2. Check the Temporal UI at http://localhost:8080 for the workflow execution
3. Report whether the analysis completed or failed
4. If the user provided an agent name/id (`$1`), use that for the agent_id
