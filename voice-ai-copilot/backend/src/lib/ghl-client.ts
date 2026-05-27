import axios from 'axios'
import { db as defaultDb, Database } from '../db/index'
import { GHLAgent } from '../types/ghl.types'

const GHL_BASE = 'https://services.leadconnectorhq.com'

interface TokenRow extends Record<string, unknown> {
  access_token: string
  refresh_token: string
  token_expires_at: Date | null
}

export class GHLClientError extends Error {
  constructor(
    message: string,
    public readonly upstreamStatus?: number
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
    const { data } = await axios.post(`${GHL_BASE}/oauth/token`, {
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: process.env.GHL_CLIENT_ID,
      client_secret: process.env.GHL_CLIENT_SECRET,
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
          Version: '2021-04-15',
          Accept: 'application/json',
        },
        params,
      })
      return data
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 401 && !retried) {
        await this.refreshToken(locationId, token.refresh_token)
        return this.get<T>(path, locationId, true)
      }
      throw new GHLClientError(`HighLevel request failed for ${path}`, status)
    }
  }

  async listAgents(locationId: string): Promise<GHLAgent[]> {
    const data = await this.get<{ agents: GHLAgent[] }>(
      '/voice-ai/agents',
      locationId,
      false,
      { locationId, page: 1, pageSize: 100 }
    )
    return data.agents ?? []
  }
}
