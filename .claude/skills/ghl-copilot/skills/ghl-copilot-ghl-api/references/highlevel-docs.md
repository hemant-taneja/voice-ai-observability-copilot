# HighLevel External Documentation — Quick Reference

## Official Documentation Links

| Resource | URL | Use When |
|---|---|---|
| **API v2 Docs** | [marketplace.gohighlevel.com/docs/](https://marketplace.gohighlevel.com/docs/) | Looking up endpoint specs, request/response schemas |
| **OAuth 2.0 Docs** | [marketplace.gohighlevel.com/docs/Authorization/OAuth2.0/](https://marketplace.gohighlevel.com/docs/Authorization/OAuth2.0/) | Implementing or debugging OAuth flow |
| **Scopes Reference** | [marketplace.gohighlevel.com/docs/Authorization/Scopes/](https://marketplace.gohighlevel.com/docs/Authorization/Scopes/) | Checking which scopes to request |
| **Webhook Guide** | [marketplace.gohighlevel.com/docs/webhook/WebhookIntegrationGuide/](https://marketplace.gohighlevel.com/docs/webhook/WebhookIntegrationGuide/index.html) | Webhook setup, signature verification, retry policies |
| **Voice AI APIs** | [marketplace.gohighlevel.com/docs/ghl/voice-ai/voice-ai-api/](https://marketplace.gohighlevel.com/docs/ghl/voice-ai/voice-ai-api/index.html) | Voice AI agent CRUD, call logs, transcripts |
| **Voice AI Overview** | [help.gohighlevel.com/.../voice-ai-public-apis](https://help.gohighlevel.com/support/solutions/articles/155000006379-voice-ai-public-apis) | Understanding Voice AI API capabilities |
| **App Creation Guide** | [marketplace.gohighlevel.com/docs/oauth/AppCreationGuide/](https://marketplace.gohighlevel.com/docs/oauth/AppCreationGuide/index.html) | Creating marketplace apps, configuring OAuth |
| **GitHub API Docs** | [github.com/GoHighLevel/highlevel-api-docs](https://github.com/GoHighLevel/highlevel-api-docs) | OpenAPI specs, community contributions |
| **Developer Portal** | [developers.gohighlevel.com](https://developers.gohighlevel.com/) | Main hub for docs, marketplace, Slack community |
| **Support Portal** | [help.gohighlevel.com](https://help.gohighlevel.com/) | Guides, tutorials, troubleshooting |
| **Ideas Board** | [ideas.gohighlevel.com/integrations](https://ideas.gohighlevel.com/integrations) | Feature requests, API roadmap |

## Voice AI API Endpoints (Quick Reference)

Base URL: `https://services.leadconnectorhq.com`

### Agents
| Method | Path | Description |
|---|---|---|
| GET | `/voice-ai/agents?locationId=` | List agents for location |
| POST | `/voice-ai/agents` | Create new agent |
| GET | `/voice-ai/agents/{agentId}?locationId=` | Get agent details |
| PATCH | `/voice-ai/agents/{agentId}` | Update agent |
| DELETE | `/voice-ai/agents/{agentId}?locationId=` | Delete agent |

### Agent Actions
| Method | Path | Description |
|---|---|---|
| POST | `/voice-ai/agents/{agentId}/actions` | Create agent action |
| GET | `/voice-ai/agents/{agentId}/actions/{actionId}` | Get action details |
| PUT | `/voice-ai/agents/{agentId}/actions/{actionId}` | Update action |
| DELETE | `/voice-ai/agents/{agentId}/actions/{actionId}` | Delete action |

### Call Logs
| Method | Path | Description |
|---|---|---|
| GET | `/voice-ai/call-logs?locationId=` | List call logs (filterable) |
| GET | `/voice-ai/call-logs/{callId}?locationId=` | Get call details + transcript |

### Voices
| Method | Path | Description |
|---|---|---|
| GET | `/voice-ai/voices` | List available voices (paginated, filterable) |
| GET | `/voice-ai/voices/{voiceId}` | Get voice details + preview URL |

## Required Scopes for This Project

```
voice-ai-dashboard.readonly    # Call logs
voice-ai-agents.readonly       # Read agents
voice-ai-agents.write          # Create/update agents
voice-ai-agent-goals.readonly  # Read agent actions
voice-ai-agent-goals.write     # Manage agent actions
locations.readonly              # Location data
contacts.readonly               # Caller context
```

## Key Technical Notes

- **API v1 is end-of-support** as of December 31, 2025 — use v2 only
- **Ed25519 webhook signature** is the current standard — `X-WH-Signature` (RSA) deprecated July 1, 2026
- **Ed25519 public key:** `MCowBQYDK2VwAyEAi2HR1srL4o18O8BRa7gVJY7G7bupbN3H9AwJrHCDiOg=`
- **Access tokens expire in ~24 hours** (86,399 seconds)
- **Refresh tokens are single-use** — each refresh returns a new refresh_token
- **Rate limits:** 100 requests per 10 seconds (burst), varies by endpoint and plan
- **Scopes lock when app goes live** — plan carefully during development

## For Full Documentation

See the `ghl-copilot-highlevel-docs` skill for:
- Complete OAuth scopes list → `references/scopes-reference.md`
- All webhook events and payloads → `references/webhook-events.md`
- Marketplace app creation guide → `references/marketplace-guide.md`
