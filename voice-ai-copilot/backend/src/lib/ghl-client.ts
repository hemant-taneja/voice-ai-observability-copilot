import axios from 'axios'
import { db as defaultDb, Database } from '../db/index'
import { GHLAgent, GHLAction } from '../types/ghl.types'

const GHL_BASE = 'https://services.leadconnectorhq.com'

interface TokenRow extends Record<string, unknown> {
  access_token: string
  refresh_token: string
  token_expires_at: Date | null
}

export class GHLClientError extends Error {
  constructor(
    message: string,
    public readonly upstreamStatus?: number,
    public readonly upstreamMessage?: unknown
  ) {
    super(message)
    this.name = 'GHLClientError'
    Error.captureStackTrace(this, this.constructor)
  }
}

export class GHLClient {
  constructor(private readonly database: Database = defaultDb) {}

  private async getToken(locationId: string): Promise<TokenRow> {
    const { rows } = await this.database.query<TokenRow>(
      'SELECT access_token, refresh_token, token_expires_at FROM locations WHERE location_id = $1',
      [locationId]
    )
    if (!rows[0]) throw new Error(`No token found for locationId: ${locationId}`)
    return rows[0]
  }

  private async refreshToken(locationId: string, refreshToken: string): Promise<string> {
    // GHL's /oauth/token requires application/x-www-form-urlencoded — a plain
    // object serializes as JSON and is rejected with 400 invalid_request.
    // Mirrors the working initial exchange in routes/oauth.ts.
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: process.env.GHL_CLIENT_ID ?? '',
      client_secret: process.env.GHL_CLIENT_SECRET ?? '',
    })

    const { data } = await axios.post(`${GHL_BASE}/oauth/token`, params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    })

    const expiresAt = new Date(Date.now() + data.expires_in * 1000)
    await this.database.query(
      `UPDATE locations SET access_token = $1, refresh_token = $2, token_expires_at = $3
       WHERE location_id = $4`,
      [data.access_token, data.refresh_token, expiresAt, locationId]
    )

    return data.access_token
  }

  private async get<T>(
    path: string,
    locationId: string,
    retried = false,
    params?: Record<string, string | number>
  ): Promise<T> {
    const token = await this.getToken(locationId)
    try {
      const { data } = await axios.get<T>(`${GHL_BASE}${path}`, {
        headers: {
          Authorization: `Bearer ${token.access_token}`,
          Version: '2023-02-21',
          Accept: 'application/json',
        },
        params,
      })
      return data
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 401 && !retried) {
        await this.refreshToken(locationId, token.refresh_token)
        return this.get<T>(path, locationId, true, params)
      }
      const data = (err as { response?: { data?: unknown } })?.response?.data
      throw new GHLClientError(`HighLevel request failed for ${path}`, status, data)
    }
  }

  async listAgents(locationId: string): Promise<GHLAgent[]> {
    const data = await this.get<{ agents: GHLAgent[] }>(
      '/voice-ai/agents',
      locationId,
      false,
      { locationId }
    )
    return data.agents ?? []
  }

  // Fetch the action (tool-call) definitions bound to an agent. The response
  // shape varies slightly across GHL versions, so accept the common envelopes
  // ({ actions }, { data }) or a bare array.
  async getAgentActions(locationId: string, ghlAgentId: string): Promise<GHLAction[]> {
    const data = await this.get<{ actions?: GHLAction[]; data?: GHLAction[] } | GHLAction[]>(
      `/voice-ai/agents/${ghlAgentId}/actions`,
      locationId,
      false,
      { locationId }
    )
    if (Array.isArray(data)) return data
    return data.actions ?? data.data ?? []
  }
}
