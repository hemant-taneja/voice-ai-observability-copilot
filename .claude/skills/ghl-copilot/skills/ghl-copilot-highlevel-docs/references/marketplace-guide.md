# HighLevel Marketplace — App Creation & Configuration Guide

Sources:
- [App Creation Guide](https://marketplace.gohighlevel.com/docs/oauth/AppCreationGuide/index.html)
- [Getting Started with Marketplace](https://help.gohighlevel.com/support/solutions/articles/155000000136-how-to-get-started-with-the-developer-s-marketplace)
- [OAuth 2.0 Documentation](https://marketplace.gohighlevel.com/docs/Authorization/OAuth2.0/)

## Step 1: Create Developer Account

1. Sign up at `marketplace.gohighlevel.com`
2. Agency administrators can initiate via "Sell on Marketplace" in their GHL dashboard
3. Authenticate via password + OTP verification
4. Accept developer terms of service

## Step 2: Create Marketplace App

1. Navigate to **My Apps** → **Create App**
2. Complete profile information:
   - **App name** — displayed to users during install
   - **App type** — Public or Private
   - **Distribution** — Agency or Sub-Account
   - **Description** — what the app does
   - **Branding** — logo, screenshots

### App Types

| Type | Visibility | Install Limit |
|---|---|---|
| **Public** | All GHL users via marketplace | Unlimited |
| **Private** | Invite-only or direct link | Max 5 unique agency installs |

### Distribution Types

| Type | Scope | Use Case |
|---|---|---|
| **Agency** | All sub-accounts within an agency | Agency-wide tools |
| **Sub-Account** | Specific individual locations | Location-specific integrations |

## Step 3: Configure OAuth

### Set Redirect URL
```
{APP_URL}/oauth/callback
```

### Select Scopes

Request **minimum necessary** scopes. For the Voice AI Copilot:

```
voice-ai-dashboard.readonly
voice-ai-agents.readonly
voice-ai-agents.write
voice-ai-agent-goals.readonly
voice-ai-agent-goals.write
locations.readonly
contacts.readonly
```

**Scopes are locked once the app goes live.** Modifiable only in draft mode.

### Generate Client Credentials

- **Client ID** — public identifier for your app
- **Client Secret** — keep this secret, never expose in frontend code

Store in `.env`:
```
GHL_CLIENT_ID=your_client_id
GHL_CLIENT_SECRET=your_client_secret
```

## Step 4: Configure Webhooks

1. Go to Auth → Advanced Settings in the app dashboard
2. Paste webhook URL: `{APP_URL}/webhooks/ghl`
3. Select events to subscribe to:
   - `INSTALL` — triggered when app is installed on a location
   - `UNINSTALL` — triggered when app is removed
   - `VoiceAiCallEnd` — triggered when a Voice AI call completes
4. Copy Ed25519 public key for signature verification
5. Store in `.env`:
   ```
   GHL_WEBHOOK_SECRET=MCowBQYDK2VwAyEAi2HR1srL4o18O8BRa7gVJY7G7bupbN3H9AwJrHCDiOg=
   ```

**Webhook endpoints and event subscriptions remain flexible even after deployment.**

## Step 5: OAuth Installation Flow

### How Users Install Your App

```
1. User finds app in GHL Marketplace (or direct link for private apps)
2. Clicks "Install"
3. Redirected to: marketplace.gohighlevel.com/oauth/chooselocation
4. User selects account level:
   - Agency: Grants access to all sub-accounts
   - Sub-Account: Grants access to specific location
5. User reviews scopes and grants permission
6. GHL redirects to: {APP_URL}/oauth/callback?code=AUTHORIZATION_CODE
```

### Token Exchange

```
POST https://services.leadconnectorhq.com/oauth/token
Content-Type: application/x-www-form-urlencoded

Body:
  client_id={GHL_CLIENT_ID}
  client_secret={GHL_CLIENT_SECRET}
  grant_type=authorization_code
  code={AUTHORIZATION_CODE}
  user_type=Location        # or "Company" for agency
  redirect_uri={APP_URL}/oauth/callback

Response 200:
{
  "access_token": "string",
  "token_type": "Bearer",
  "expires_in": 86399,       // ~24 hours
  "refresh_token": "string", // Valid 1 year, single-use
  "scope": "string",
  "locationId": "string",
  "companyId": "string",
  "userId": "string"
}
```

### Token Refresh

```
POST https://services.leadconnectorhq.com/oauth/token
Content-Type: application/x-www-form-urlencoded

Body:
  client_id={GHL_CLIENT_ID}
  client_secret={GHL_CLIENT_SECRET}
  grant_type=refresh_token
  refresh_token={CURRENT_REFRESH_TOKEN}

Response 200:
{
  "access_token": "new_access_token",
  "token_type": "Bearer",
  "expires_in": 86399,
  "refresh_token": "new_refresh_token"  // Previous refresh token invalidated
}
```

**Important:** Refresh tokens are **single-use**. Each refresh response includes a new refresh_token that replaces the previous one.

### Cross-Level Token Generation

Convert agency token to location-specific token:
```
POST https://services.leadconnectorhq.com/oauth/locationToken
Headers: Authorization: Bearer {AGENCY_ACCESS_TOKEN}

Body:
{
  "companyId": "string",
  "locationId": "string"
}
```

## Step 6: Implement the App

### Required Endpoints in Your App

| Endpoint | Purpose |
|---|---|
| `GET /oauth/callback` | Receive authorization code from GHL |
| `POST /webhooks/ghl` | Receive webhook events |
| `GET /health` | Health check (recommended) |

### INSTALL Webhook Handler

When your app is installed on a location:
1. Receive INSTALL webhook with `locationId` and `companyId`
2. Exchange the authorization code for tokens (if not already done via OAuth callback)
3. Store location credentials in your database
4. Start syncing data (agents, etc.)

### UNINSTALL Webhook Handler

When your app is removed:
1. Receive UNINSTALL webhook
2. Clean up stored tokens for the location
3. Optionally retain user data per your data policy

## App Submission & Review

### Before Submitting

- [ ] App works end-to-end in sandbox
- [ ] OAuth flow completes successfully
- [ ] Webhooks are verified and processed correctly
- [ ] Error handling covers common failure modes
- [ ] App listing has complete description, screenshots, and branding
- [ ] Scopes are minimal — only request what's needed
- [ ] No hardcoded credentials in frontend code

### Submission Process

1. In marketplace dashboard, click **Submit for Review**
2. GHL team reviews the app
3. May request changes or clarifications
4. Once approved, app appears in the marketplace

### Post-Launch

- **Scopes are locked** — cannot add new scopes without new review
- **Webhook subscriptions** can be changed anytime
- **Monitor** via Webhook Logs Dashboard for delivery issues
- **Support** via `marketplace@gohighlevel.com`

## PKCE Support

For browser-based and mobile apps, GHL supports **OAuth 2.0 with PKCE** (Proof Key for Code Exchange) for external authentication flows. See [External Authentication docs](https://marketplace.gohighlevel.com/docs/oauth/ExternalAuthentication/index.html).

## API v1 Deprecation

- **API v1 end-of-support:** December 31, 2025
- Existing v1 connections continue working but receive no updates or support
- All new development must use API v2 with OAuth 2.0

## Key Links

| Resource | URL |
|---|---|
| Developer Portal | `developers.gohighlevel.com` |
| API v2 Docs | `marketplace.gohighlevel.com/docs/` |
| OAuth Docs | `marketplace.gohighlevel.com/docs/Authorization/OAuth2.0/` |
| Scopes Reference | `marketplace.gohighlevel.com/docs/Authorization/Scopes/` |
| Webhook Guide | `marketplace.gohighlevel.com/docs/webhook/WebhookIntegrationGuide/` |
| Voice AI APIs | `marketplace.gohighlevel.com/docs/ghl/voice-ai/voice-ai-api/` |
| Support Portal | `help.gohighlevel.com` |
| Developer Slack | Via `developers.gohighlevel.com` |
| GitHub API Docs | `github.com/GoHighLevel/highlevel-api-docs` |
| Ideas Board | `ideas.gohighlevel.com/integrations` |
| Dev Support Email | `marketplace@gohighlevel.com` |
