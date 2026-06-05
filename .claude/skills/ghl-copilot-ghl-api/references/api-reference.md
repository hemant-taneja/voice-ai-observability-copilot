# GHL API Reference for Voice AI Copilot

## Base URLs

| Environment | Base URL |
|---|---|
| Production | `https://services.leadconnectorhq.com` |
| OAuth | `https://marketplace.gohighlevel.com` |

## Authentication

All API calls require Bearer token authentication:
```
Authorization: Bearer <access_token>
```

Tokens are per-location, stored in the `locations` table.

## Voice AI Endpoints

### List Voice AI Agents

```
GET /voice-ai/agents
Query: locationId={locationId}
Headers: Authorization: Bearer {access_token}

Response 200:
{
  "agents": [
    {
      "id": "string",
      "name": "string",
      "script": "string",
      "status": "active" | "inactive",
      "createdAt": "ISO-8601",
      "updatedAt": "ISO-8601"
    }
  ]
}
```

### Get Voice AI Agent

```
GET /voice-ai/agents/{agentId}
Query: locationId={locationId}
Headers: Authorization: Bearer {access_token}

Response 200:
{
  "id": "string",
  "name": "string",
  "script": "string",
  "status": "active" | "inactive",
  "configuration": { ... }
}
```

## OAuth Endpoints

### Authorize

```
GET https://marketplace.gohighlevel.com/oauth/chooselocation
Query:
  response_type=code
  redirect_uri={APP_URL}/oauth/callback
  client_id={GHL_CLIENT_ID}
  scope=contacts.readonly locations.readonly
```

### Token Exchange

```
POST /oauth/token
Content-Type: application/x-www-form-urlencoded

Body:
  grant_type=authorization_code
  code={authorization_code}
  client_id={GHL_CLIENT_ID}
  client_secret={GHL_CLIENT_SECRET}
  redirect_uri={APP_URL}/oauth/callback

Response 200:
{
  "access_token": "string",
  "token_type": "Bearer",
  "expires_in": 86400,
  "refresh_token": "string",
  "scope": "string",
  "locationId": "string",
  "companyId": "string"
}
```

### Token Refresh

```
POST /oauth/token
Content-Type: application/x-www-form-urlencoded

Body:
  grant_type=refresh_token
  refresh_token={refresh_token}
  client_id={GHL_CLIENT_ID}
  client_secret={GHL_CLIENT_SECRET}

Response 200:
{
  "access_token": "string",
  "token_type": "Bearer",
  "expires_in": 86400,
  "refresh_token": "string"
}
```

## Webhook Payloads

### INSTALL Event
```json
{
  "type": "INSTALL",
  "locationId": "string",
  "companyId": "string",
  "userId": "string"
}
```

### UNINSTALL Event
```json
{
  "type": "UNINSTALL",
  "locationId": "string",
  "companyId": "string"
}
```

### VoiceAiCallEnd Event
```json
{
  "type": "VoiceAiCallEnd",
  "locationId": "string",
  "data": {
    "callId": "string",
    "agentId": "string",
    "callerPhone": "string",
    "durationSeconds": 120,
    "direction": "inbound" | "outbound",
    "status": "completed" | "failed" | "no-answer",
    "transcript": {
      "turns": [
        {
          "speaker": "agent" | "caller",
          "text": "string",
          "timestamp_ms": 0
        }
      ]
    },
    "recording": {
      "url": "string",
      "durationMs": 120000
    }
  }
}
```

### Legacy call-completed Webhook
```json
{
  "ghl_call_id": "string",
  "location_id": "string",
  "agent_id": "string",
  "caller_phone": "string",
  "duration_seconds": 120,
  "turns": [
    {
      "speaker": "agent" | "caller",
      "text": "string",
      "timestamp_ms": 0
    }
  ]
}
```

## Required OAuth Scopes

| Scope | Used For |
|---|---|
| `locations.readonly` | Location info |
| `contacts.readonly` | Contact context (future) |
| Voice AI scopes | Agent listing, transcript access |

## Rate Limits

| Tier | Requests/min | Burst |
|---|---|---|
| Standard | 60 | 10 |
| Premium | 120 | 20 |

Rate limited responses return:
```
HTTP 429 Too Many Requests
Retry-After: 30
```

## Error Responses

```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "error": "Invalid access token"
}
```

Common errors:
| Status | Cause | Action |
|---|---|---|
| 401 | Token expired | Auto-refresh in ghl-client.ts |
| 403 | Insufficient scope | Check marketplace app permissions |
| 404 | Resource not found | Verify IDs |
| 429 | Rate limited | Respect Retry-After header |
| 500 | GHL server error | Retry with backoff |

## GHL Marketplace Setup

### App Configuration

1. Create app at `https://marketplace.gohighlevel.com`
2. Set OAuth redirect URI: `{APP_URL}/oauth/callback`
3. Request required scopes
4. Set webhook URL: `{APP_URL}/webhooks/ghl`
5. Enable webhook events: INSTALL, UNINSTALL, VoiceAiCallEnd
6. Generate webhook signing key (Ed25519)
7. Store `GHL_CLIENT_ID`, `GHL_CLIENT_SECRET` in `.env`

### Webhook Setup

1. In marketplace app settings, configure webhook endpoint
2. Select events to subscribe to
3. Copy Ed25519 public key for signature verification
4. Store in `GHL_WEBHOOK_SECRET` env var

### Testing with Sandbox

- GHL provides sandbox environments for testing
- Some API behaviors differ in sandbox (limited data, different rate limits)
- Use `npm run simulate` for local webhook testing without GHL
