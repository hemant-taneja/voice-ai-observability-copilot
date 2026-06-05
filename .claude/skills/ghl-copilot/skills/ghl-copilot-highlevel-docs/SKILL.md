---
name: ghl-copilot-highlevel-docs
description: This skill should be used when working with HighLevel developer documentation, marketplace setup, API integration, OAuth configuration, or webhook setup. Also triggers when the user says "HighLevel docs", "GHL documentation", "marketplace setup", "API scopes", "OAuth configuration", "webhook events", "developer portal", "app creation", or needs to reference official HighLevel documentation for the Voice AI Observability Copilot.
---

# HighLevel Developer Documentation Reference

## Documentation Portal Map

| Resource | URL | Content |
|---|---|---|
| **Developer Portal** | `developers.gohighlevel.com` | Main hub — docs, marketplace, community |
| **API v2 Docs** | `marketplace.gohighlevel.com/docs/` | OAuth, scopes, endpoints, webhooks |
| **API Reference (Stoplight)** | `highlevel.stoplight.io/docs/integrations/` | OpenAPI specs, try-it-out |
| **Support Portal** | `help.gohighlevel.com` | Guides, tutorials, troubleshooting |
| **GitHub API Docs** | `github.com/GoHighLevel/highlevel-api-docs` | OpenAPI source, community contributions |
| **Ideas Board** | `ideas.gohighlevel.com/integrations` | Feature requests, API roadmap |

## API Base URL

All v2 API calls use:
```
https://services.leadconnectorhq.com
```

Authentication: `Authorization: Bearer <access_token>`

## API Categories

| Category | Base Path | Key Operations |
|---|---|---|
| **Voice AI Agents** | `/voice-ai/agents` | CRUD agents, list for location |
| **Voice AI Call Logs** | `/voice-ai/call-logs` | List calls, get call details + transcript |
| **Voice AI Voices** | `/voice-ai/voices` | List available voices, get voice details |
| **Voice AI Actions** | `/voice-ai/agents/:id/actions` | CRUD agent actions |
| **Contacts** | `/contacts` | CRUD contacts, tags, notes, tasks |
| **Conversations** | `/conversations` | Messages, threads, SMS/email |
| **Opportunities** | `/opportunities` | Pipeline deals, stages |
| **Calendars** | `/calendars` | Appointments, availability, events |
| **Locations** | `/locations` | Sub-account management |
| **Users** | `/users` | Team members |
| **Payments** | `/payments` | Orders, transactions, subscriptions |
| **Invoices** | `/invoices` | Invoice CRUD, templates, estimates |
| **Forms** | `/forms` | Form submissions |
| **Surveys** | `/surveys` | Survey submissions |
| **Workflows** | `/workflows` | View workflows |
| **Funnels** | `/funnels` | Pages, redirects |

## Voice AI Scopes (Required for This Project)

| Scope | Access |
|---|---|
| `voice-ai-dashboard.readonly` | View call logs |
| `voice-ai-agents.readonly` | View Voice AI agents |
| `voice-ai-agents.write` | Create and modify agents |
| `voice-ai-agent-goals.readonly` | View agent actions |
| `voice-ai-agent-goals.write` | Manage agent actions |
| `locations.readonly` | View location data |
| `contacts.readonly` | View contacts (for caller context) |

## OAuth 2.0 Flow (Authorization Code Grant)

```
1. User clicks "Install" in GHL Marketplace
2. Redirect to: marketplace.gohighlevel.com/oauth/chooselocation
3. User selects location, grants scopes
4. GHL redirects to: {APP_URL}/oauth/callback?code=XXX
5. App exchanges code for tokens:
   POST https://services.leadconnectorhq.com/oauth/token
   Body: { client_id, client_secret, grant_type: "authorization_code", code, redirect_uri }
6. Response: { access_token, refresh_token, expires_in: 86399, locationId, companyId }
7. Store tokens in locations table
```

**Token lifecycle:**
- Access token: ~24 hours (86,399 seconds)
- Refresh token: 1 year or until used (single-use — response includes new refresh token)
- Two access levels: Agency (company-wide) and Location (sub-account)

## Webhook Signature Verification

**Current (Ed25519) — use `X-GHL-Signature` header:**
```
GHL Public Key: MCowBQYDK2VwAyEAi2HR1srL4o18O8BRa7gVJY7G7bupbN3H9AwJrHCDiOg=
```

**Legacy (RSA-SHA256) — `X-WH-Signature` header:**
- Deprecated July 1, 2026 — migrate to Ed25519

**Verification priority:** If `X-GHL-Signature` present → Ed25519. If only `X-WH-Signature` → RSA. Reject if verification fails.

## Webhook Reliability

- Failed deliveries retry up to **12 times** with exponential backoff + jitter
- Circuit breaker: evaluates every 3 days, pauses if success rate < 90% on 10,000+ webhooks
- Always respond **200 OK immediately**, process asynchronously
- Deduplicate using webhook IDs
- Monitor via Webhook Logs Dashboard in marketplace

## Marketplace App Types

| Type | Distribution | Limit |
|---|---|---|
| **Public** | Available to all GHL users | Unlimited installs |
| **Private** | Restricted access | Max 5 agency installs |
| **Agency** | All sub-accounts in agency | Agency-wide |
| **Sub-Account** | Specific location only | Per-location |

## Rate Limits

- **Burst:** 100 requests per 10 seconds
- **429 responses** include `Retry-After` header
- Rate limits vary by endpoint and plan tier

## Additional Resources

For complete scopes list, webhook event catalog, and API endpoint details, consult:
- **`references/scopes-reference.md`** — All OAuth scopes with access levels
- **`references/webhook-events.md`** — Webhook event types and payloads
- **`references/marketplace-guide.md`** — App creation, configuration, and submission
