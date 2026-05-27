// Set environment variables before importing anything
process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5433/voice_copilot_test'
process.env.REDIS_URL = 'redis://localhost:6379'
process.env.TEMPORAL_ADDRESS = 'localhost:7233'
process.env.GHL_WEBHOOK_SECRET = 'test'
process.env.LLM_PROVIDER = 'openai'
process.env.OPENAI_API_KEY = 'sk-test'
process.env.NODE_ENV = 'test'

jest.mock('axios')

import axios from 'axios'
import { Database } from '../db/index'
import { GHLClient } from './ghl-client'

const mockedAxios = axios as jest.Mocked<typeof axios>

describe('GHLClient', () => {
  let mockDb: Partial<Database>

  beforeEach(() => {
    jest.clearAllMocks()
    mockDb = {
      query: jest.fn().mockResolvedValue({
        rows: [{ access_token: 'tok-abc', refresh_token: 'ref-xyz', token_expires_at: null }],
      }),
    }
  })

  it('lists agents using the stored access token', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: { agents: [{ id: 'ag-1', name: 'Agent Alpha' }] },
    })
    const client = new GHLClient(mockDb as Database)
    const agents = await client.listAgents('loc-123')
    expect(agents).toHaveLength(1)
    expect(agents[0].name).toBe('Agent Alpha')
    expect(mockedAxios.get).toHaveBeenCalledWith(
      expect.stringContaining('/voice-ai/agents'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer tok-abc',
          Version: '2021-04-15',
        }),
        params: expect.objectContaining({ locationId: 'loc-123' }),
      })
    )
  })

  it('retries with refreshed token on 401', async () => {
    mockedAxios.get
      .mockRejectedValueOnce({ response: { status: 401 } })
      .mockResolvedValueOnce({ data: { agents: [] } })
    mockedAxios.post.mockResolvedValueOnce({
      data: { access_token: 'new-tok', refresh_token: 'new-ref', expires_in: 86400 },
    })
    ;(mockDb.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [{ access_token: 'old-tok', refresh_token: 'ref-xyz', token_expires_at: null }] })
      .mockResolvedValueOnce({ rows: [] }) // UPDATE query after refresh
      .mockResolvedValueOnce({ rows: [{ access_token: 'new-tok', refresh_token: 'new-ref', token_expires_at: null }] })

    const client = new GHLClient(mockDb as Database)
    const agents = await client.listAgents('loc-123')
    expect(agents).toHaveLength(0)
    expect(mockedAxios.post).toHaveBeenCalledTimes(1)
    expect(mockedAxios.get).toHaveBeenCalledTimes(2)
  })
})
