import { Router, Request, Response, NextFunction } from 'express'
import axios from 'axios'
import { config } from '../config'
import { db } from '../db/index'

export const oauthRouter = Router()

const GHL_BASE = 'https://services.leadconnectorhq.com'

/**
 * GET /oauth/callback
 *
 * GHL redirects here after the user authorizes the marketplace app.
 * Exchanges the authorization code for access + refresh tokens and
 * upserts the location (or agency) row in the database.
 *
 * GHL app settings → Advanced Settings → Redirect URI must be set to:
 *   https://<your-domain>/oauth/callback
 */
/**
 * GET /oauth/installing?companyId=xxx
 *
 * Intermediate page shown after a company-level OAuth install.
 * Polls until the INSTALL webhook has fired and minted a location token,
 * then redirects the user to the dashboard with the correct locationId.
 */
oauthRouter.get('/installing', (_req: Request, res: Response) => {
  const appUrl = config.appUrl ?? ''
  res.setHeader('Content-Type', 'text/html')
  res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Setting up Voice AI Copilot...</title>
  <style>
    body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #0f0f10; color: #e2e2e2; }
    .box { text-align: center; }
    .spinner { width: 40px; height: 40px; border: 3px solid #333; border-top-color: #6c63ff; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 16px; }
    @keyframes spin { to { transform: rotate(360deg); } }
    p { color: #888; margin: 8px 0 0; font-size: 14px; }
  </style>
</head>
<body>
  <div class="box">
    <div class="spinner"></div>
    <h2>Setting up your dashboard...</h2>
    <p>This takes just a moment.</p>
  </div>
  <script>
    const companyId = new URLSearchParams(location.search).get('companyId')
    let attempts = 0
    const max = 15

    async function poll() {
      try {
        const res = await fetch('/api/location-for-company?companyId=' + companyId)
        const data = await res.json()
        if (data.locationId) {
          window.location.replace('${appUrl}/?locationId=' + data.locationId + '&installed=1')
          return
        }
      } catch (_) {}

      attempts++
      if (attempts < max) {
        setTimeout(poll, 2000)
      } else {
        window.location.replace('${appUrl}/?installed=1')
      }
    }

    setTimeout(poll, 2000)
  </script>
</body>
</html>`)
})

/**
 * GET /api/location-for-company?companyId=xxx
 *
 * Returns the first location token minted for a given company.
 * Used by the /oauth/installing polling page.
 */
oauthRouter.get('/location-for-company', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { companyId } = req.query as { companyId?: string }
    if (!companyId) { res.json({ locationId: null }); return }

    const { rows } = await db.query<{ location_id: string }>(
      `SELECT location_id FROM locations
       WHERE company_id = $1
       ORDER BY created_at DESC LIMIT 1`,
      [companyId]
    )
    res.json({ locationId: rows[0]?.location_id ?? null })
  } catch (err) { next(err) }
})

oauthRouter.get('/callback', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code, locationId: qsLocationId } = req.query as { code?: string; locationId?: string }

    if (!code) {
      res.status(400).send('<h1>Installation failed</h1><p>Missing authorization code.</p>')
      return
    }

    if (!config.ghlClientId || !config.ghlClientSecret || !config.appUrl) {
      res.status(503).send('<h1>Not configured</h1><p>GHL_CLIENT_ID, GHL_CLIENT_SECRET, and APP_URL must be set.</p>')
      return
    }

    interface GHLTokenResponse {
      access_token: string
      refresh_token: string
      expires_in: number
      userType: 'Location' | 'Company'
      locationId?: string
      companyId?: string
    }

    let data: GHLTokenResponse
    try {
      const params = new URLSearchParams({
        client_id:     config.ghlClientId!,
        client_secret: config.ghlClientSecret!,
        grant_type:    'authorization_code',
        code,
        user_type:     'Location',
        redirect_uri:  `${config.appUrl}/oauth/callback`,
      })
      const resp = await axios.post(
        `${GHL_BASE}/oauth/token`,
        params,
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' } }
      )
      data = resp.data as GHLTokenResponse
    } catch (axiosErr: unknown) {
      const e = axiosErr as { response?: { status: number; data: unknown } }
      console.error('[oauth/callback] GHL token exchange failed:', e.response?.status, JSON.stringify(e.response?.data))
      throw axiosErr
    }

    const expiresAt = new Date(Date.now() + data.expires_in * 1000)

    if (data.userType === 'Location') {
      // Sub-account install — store location token directly
      await db.query(
        `INSERT INTO locations (location_id, access_token, refresh_token, token_expires_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (location_id) DO UPDATE
         SET access_token     = EXCLUDED.access_token,
             refresh_token    = EXCLUDED.refresh_token,
             token_expires_at = EXCLUDED.token_expires_at`,
        [data.locationId, data.access_token, data.refresh_token, expiresAt]
      )
      res.redirect(`${config.appUrl ?? '/'}/?locationId=${data.locationId}&installed=1`)
    } else if (data.userType === 'Company') {
      // Agency install — store agency token keyed by companyId.
      // Individual location tokens are minted via the AppInstall webhook
      // after the user selects which sub-accounts to grant access to.
      await db.query(
        `INSERT INTO locations (location_id, access_token, refresh_token, token_expires_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (location_id) DO UPDATE
         SET access_token     = EXCLUDED.access_token,
             refresh_token    = EXCLUDED.refresh_token,
             token_expires_at = EXCLUDED.token_expires_at`,
        [`company:${data.companyId}`, data.access_token, data.refresh_token, expiresAt]
      )
      // Redirect to a polling page — the INSTALL webhook fires async (2-3s later)
      // and mints the location token. The polling page waits for it then redirects.
      res.redirect(`${config.appUrl ?? ''}/oauth/installing?companyId=${data.companyId}`)
    } else {
      res.status(400).send('<h1>Installation failed</h1><p>Unknown token type received.</p>')
    }
  } catch (err) { next(err) }
})
