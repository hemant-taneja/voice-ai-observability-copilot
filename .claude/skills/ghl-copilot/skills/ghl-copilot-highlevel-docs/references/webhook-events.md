# HighLevel Webhook Events Reference

Source: [Webhook Integration Guide](https://marketplace.gohighlevel.com/docs/webhook/WebhookIntegrationGuide/index.html)

## Signature Verification

### Ed25519 (Current — `X-GHL-Signature`)

```typescript
import { verify } from 'crypto';

const GHL_PUBLIC_KEY = 'MCowBQYDK2VwAyEAi2HR1srL4o18O8BRa7gVJY7G7bupbN3H9AwJrHCDiOg=';

function verifyEd25519(rawBody: Buffer, signature: string): boolean {
  const publicKey = crypto.createPublicKey({
    key: Buffer.from(GHL_PUBLIC_KEY, 'base64'),
    format: 'der',
    type: 'spki',
  });
  return verify(null, rawBody, publicKey, Buffer.from(signature, 'base64'));
}
```

### RSA-SHA256 (Legacy — `X-WH-Signature`)

**Deprecated July 1, 2026** — migrate to Ed25519 before this date.

### Verification Priority

```
If X-GHL-Signature present → verify Ed25519
Else if X-WH-Signature present → verify RSA-SHA256 (legacy)
Else → reject (no signature)
```

## Webhook Event Categories

### Contact Events

| Event | Trigger |
|---|---|
| `ContactCreate` | New contact created |
| `ContactUpdate` | Contact details modified |
| `ContactDelete` | Contact removed |
| `ContactDndUpdate` | Do-not-disturb status changed |
| `ContactTagUpdate` | Tags added/removed on contact |
| `NoteCreate` | Note added to contact |
| `NoteUpdate` | Note modified |
| `NoteDelete` | Note removed |
| `TaskCreate` | Task created for contact |
| `TaskComplete` | Task marked complete |

### Conversation Events

| Event | Trigger |
|---|---|
| `ConversationUnreadUpdate` | Unread status changed |
| `InboundMessage` | Message received from contact |
| `OutboundMessage` | Message sent to contact |

### Opportunity Events

| Event | Trigger |
|---|---|
| `OpportunityCreate` | New opportunity created |
| `OpportunityUpdate` | Opportunity details modified |
| `OpportunityDelete` | Opportunity removed |
| `OpportunityStageUpdate` | Opportunity moved between pipeline stages |
| `OpportunityStatusUpdate` | Opportunity status changed (won/lost/open) |
| `OpportunityMonetaryValueUpdate` | Deal value changed |
| `OpportunityAssignedToUpdate` | Assigned team member changed |

### Appointment Events

| Event | Trigger |
|---|---|
| `AppointmentCreate` | Appointment booked |
| `AppointmentUpdate` | Appointment modified |
| `AppointmentDelete` | Appointment cancelled |

### Voice AI Events (Used by This Project)

| Event | Trigger | Key Payload Fields |
|---|---|---|
| `VoiceAiCallEnd` | Voice AI call completed | `locationId`, `agentId`, `callId`, `transcript`, `durationSeconds` |

### Marketplace Events (Used by This Project)

| Event | Trigger | Key Payload Fields |
|---|---|---|
| `INSTALL` | App installed on a location | `locationId`, `companyId`, `userId` |
| `UNINSTALL` | App removed from a location | `locationId`, `companyId` |

### Other Events

| Category | Events |
|---|---|
| **Invoice** | InvoiceCreate, InvoiceUpdate, InvoiceDelete, InvoiceSent, InvoiceVoid |
| **Product** | ProductCreate, ProductUpdate, ProductDelete |
| **Task** | TaskCreate, TaskComplete |
| **Location** | LocationCreate, LocationUpdate |
| **User** | UserCreate, UserUpdate, UserDelete |

## Webhook Delivery & Reliability

### Retry Policy

- **Max retries:** 12 (excluding original attempt)
- **Strategy:** Exponential backoff with random jitter
- **Jitter:** Distributes retries from seconds to minutes to avoid thundering herd

### Circuit Breaker

Evaluated every 3 days using past 3-day data:
1. Applies only if URL receives **10,000+ webhooks** in the evaluation window
2. **First flag** (success rate < 90%): Warning email sent
3. **Second flag** (3 days later, still failing): Webhook delivery **paused**
4. **Resume:** Fix endpoint, re-enable subscriptions in marketplace dashboard

### Best Practices

```typescript
// GOOD — respond immediately, process async
app.post('/webhooks/ghl', (req, res) => {
  res.status(200).json({ received: true }); // Respond immediately
  processWebhookAsync(req.body);             // Process in background
});

// BAD — processing before responding risks timeouts
app.post('/webhooks/ghl', async (req, res) => {
  await processWebhook(req.body);  // May timeout!
  res.status(200).json({ ok: true });
});
```

- Always respond **200 OK** immediately
- Process webhook payload asynchronously (Temporal handles this for us)
- Store webhook IDs for deduplication
- Log all activities and errors
- Only return error codes for genuine infrastructure issues

## Webhook Configuration

### Setup Steps

1. Create OAuth application in marketplace dashboard
2. Go to Auth → Advanced Settings
3. Paste webhook URL (must be HTTPS in production)
4. Select scopes (locked once app goes live)
5. Choose specific events in Webhook section
6. Scopes are changeable **only in draft mode**
7. Webhook endpoints and event subscriptions remain flexible after deployment

### Monitoring

Via **Webhook Logs Dashboard**:
- Navigate to Application Dashboard → Insights → Logs → Webhooks tab
- View all events, success/failure rates, detailed payloads
- Filter by event type, status codes, webhook IDs
- Manual retry available for failed deliveries

## VoiceAiCallEnd Payload (Detailed)

```json
{
  "type": "VoiceAiCallEnd",
  "locationId": "string",
  "data": {
    "callId": "string",
    "agentId": "string",
    "callerPhone": "string",
    "durationSeconds": 120,
    "direction": "inbound | outbound",
    "status": "completed | failed | no-answer",
    "transcript": {
      "turns": [
        {
          "speaker": "agent | caller",
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

## INSTALL Payload

```json
{
  "type": "INSTALL",
  "locationId": "string",
  "companyId": "string",
  "userId": "string"
}
```

## UNINSTALL Payload

```json
{
  "type": "UNINSTALL",
  "locationId": "string",
  "companyId": "string"
}
```
