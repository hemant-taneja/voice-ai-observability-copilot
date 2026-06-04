---
name: ghl-copilot-ghl-api
description: This skill should be used when working with GoHighLevel API integration, webhooks, OAuth flow, or marketplace features in the Voice AI Observability Copilot. Also triggers when the user says "GHL API", "webhook payload", "OAuth flow", "token refresh", "marketplace install", "GHL endpoint", "Voice AI API", or needs to understand how the app communicates with HighLevel.
---

# GHL API Integration in the Voice AI Copilot

## Integration Architecture

All GHL communication flows through two entry points:

| Direction | Entry Point | File |
|---|---|---|
| GHL -> App | Webhooks | `routes/webhooks.ts` |
| App -> GHL | REST API | `lib/ghl-client.ts` |

**Golden rule:** Never call GHL APIs outside `lib/ghl-client.ts`. Never process webhooks outside `routes/webhooks.ts`.

## GHL Client (`lib/ghl-client.ts`)

### Interface

```typescript
interface GHLClient {
  listAgents(locationId: string): Promise<GHLAgent[]>
  getAgent(agentId: string, locationId: string): Promise<GHLAgent>
  getCallTranscript(callId: string, locationId: string): Promise<GHLTranscript>
  refreshToken(locationId: string): Promise<void>
}
```

### Token Management

- OAuth tokens stored in `locations` table: `access_token`, `refresh_token`, `token_expires_at`
- On 401 response: auto-refreshes using `refresh_token`, updates DB, retries once
- On refresh failure: throws — user must re-install marketplace app
- Callers never manage tokens directly

### Rate Limiting

- GHL rate limits vary by endpoint and plan tier
- `429` responses include `Retry-After` header
- For webhook-triggered workflows: Temporal handles retry with backoff
- For sync endpoints: Return 429 to frontend, let user retry

## Webhook Ingestion

### Webhook Types

| Webhook | Path | Verification | Events |
|---|---|---|---|
| Marketplace | `POST /webhooks/ghl` | Ed25519 signature | INSTALL, UNINSTALL, VoiceAiCallEnd |
| Legacy | `POST /webhooks/call-completed` | HMAC-SHA256 | Call transcript payload |

### Ed25519 Verification (Marketplace)

```typescript
// routes/webhooks.ts
import { verify } from 'crypto';

function verifyEd25519(body: Buffer, signature: string, publicKey: string): boolean {
  return verify(null, body, publicKey, Buffer.from(signature, 'base64'));
}
```

### HMAC-SHA256 Verification (Legacy)

```typescript
import crypto from 'crypto';

function verifyHMAC(body: string, signature: string, secret: string): boolean {
  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
```

### Webhook Payload — VoiceAiCallEnd

```typescript
// types/ghl.types.ts
interface VoiceAiCallEndPayload {
  type: 'VoiceAiCallEnd';
  locationId: string;
  agentId: string;
  callId: string;
  callerPhone: string;
  durationSeconds: number;
  transcript: {
    turns: Array<{
      speaker: 'agent' | 'caller';
      text: string;
      timestamp_ms: number;
    }>;
  };
}
```

### Idempotency

- `ghl_call_id` is UNIQUE in `transcripts` table
- Duplicate webhooks are accepted silently (200 response)
- `ON CONFLICT (ghl_call_id) DO NOTHING` in the upsert query

## OAuth Flow

### Installation Flow

```
User clicks "Install" in GHL Marketplace
  -> Redirects to: https://marketplace.gohighlevel.com/oauth/chooselocation
  -> User selects location
  -> GHL redirects to: APP_URL/oauth/callback?code=XXX
  -> routes/oauth.ts exchanges code for tokens
  -> Stores in locations table: access_token, refresh_token, token_expires_at, company_id
  -> Renders HTML install page with polling (oauth/installing)
```

### Token Refresh

```typescript
// Automatic in ghl-client.ts
async function refreshToken(locationId: string): Promise<void> {
  const location = await db.query(
    'SELECT refresh_token FROM locations WHERE location_id = $1',
    [locationId]
  );
  const response = await axios.post('https://services.leadconnectorhq.com/oauth/token', {
    grant_type: 'refresh_token',
    refresh_token: location.rows[0].refresh_token,
    client_id: config.ghlClientId,
    client_secret: config.ghlClientSecret,
  });
  await db.query(
    `UPDATE locations SET access_token = $1, refresh_token = $2,
     token_expires_at = NOW() + interval '1 second' * $3 WHERE location_id = $4`,
    [response.data.access_token, response.data.refresh_token,
     response.data.expires_in, locationId]
  );
}
```

## GHL Auth Middleware

```typescript
// middleware/ghl-auth.ts
// Reads locationId from query param or x-ghl-location-id header
// Validates against locations table
// Attaches ghlContext to request:
interface GHLContext {
  locationId: string;
  name: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  tokenExpiresAt: Date | null;
}
```

## Multi-Tenancy

- Every protected route requires `locationId` via `ghlAuth()` middleware
- All DB queries filter by `location_id`
- GHL API calls include the location's OAuth token
- SSE connections are scoped to `locationId`

## Adding New GHL API Calls

1. Add method to `lib/ghl-client.ts`
2. Define types in `types/ghl.types.ts`
3. Call only via the client — never raw `axios`/`fetch`
4. Handle 401 (token refresh is automatic)
5. Log errors with `{ locationId, endpoint, statusCode }`
6. Test with mocked responses

## Additional Resources

For GHL API endpoint reference, webhook payload schemas, and marketplace setup, consult:
- **`references/api-reference.md`** — GHL API endpoints, request/response formats, scopes
- **`references/highlevel-docs.md`** — Official HighLevel documentation links, Voice AI API quick reference, required scopes
- **`ghl-copilot-highlevel-docs` skill** — Full marketplace guide, complete scopes list, webhook event catalog
