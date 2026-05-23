import axios from 'axios'
import { db as defaultDb, Database } from '../db/index'
import { GHLAgent } from '../types/ghl.types'

const GHL_BASE = 'https://services.leadconnectorhq.com'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface TokenRow extends Record<string, any> {
  access_token: string
  refresh_token: string
  token_expires_at: Date | null
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

  private async get<T>(path: string, locationId: string, retried = false): Promise<T> {
    const token = await this.getToken(locationId)
    try {
      const { data } = await axios.get<T>(`${GHL_BASE}${path}`, {
        headers: { Authorization: `Bearer ${token.access_token}`, Version: '2021-07-28' },
      })
      return data
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 401 && !retried) {
        await this.refreshToken(locationId, token.refresh_token)
        return this.get<T>(path, locationId, true)
      }
      throw err
    }
  }

  async listAgents(locationId: string): Promise<GHLAgent[]> {
    const data = await this.get<{ agents: GHLAgent[] }>(
      `/locations/${locationId}/voice-agents`,
      locationId
    )
    return data.agents ?? []
  }
}
