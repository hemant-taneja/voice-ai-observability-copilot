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
oauthRouter.get('/callback', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code } = req.query as { code?: string }

    if (!code) {
      res.status(400).send('<h1>Installation failed</h1><p>Missing authorization code.</p>')
      return
    }

    const { data } = await axios.post(
      `${GHL_BASE}/oauth/token`,
      {
        client_id: config.ghlClientId,
        client_secret: config.ghlClientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: `${config.appUrl}/oauth/callback`,
      },
      { headers: { 'Content-Type': 'application/json', Accept: 'application/json' } }
    )

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
      res.redirect(`${config.appUrl}/?locationId=${data.locationId}&installed=1`)
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
      res.redirect(`${config.appUrl}/?installed=1`)
    } else {
      res.status(400).send('<h1>Installation failed</h1><p>Unknown token type received.</p>')
    }
  } catch (err) { next(err) }
})
