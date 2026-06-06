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
          Version: '2023-02-21',
        }),
        params: { locationId: 'loc-123' },
      })
    )
  })

  it('sends the token refresh as application/x-www-form-urlencoded (GHL rejects JSON)', async () => {
    mockedAxios.get
      .mockRejectedValueOnce({ response: { status: 401 } })
      .mockResolvedValueOnce({ data: { agents: [] } })
    mockedAxios.post.mockResolvedValueOnce({
      data: { access_token: 'new-tok', refresh_token: 'new-ref', expires_in: 86400 },
    })
    ;(mockDb.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [{ access_token: 'old-tok', refresh_token: 'ref-xyz', token_expires_at: null }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ access_token: 'new-tok', refresh_token: 'new-ref', token_expires_at: null }] })

    const client = new GHLClient(mockDb as Database)
    await client.listAgents('loc-123')

    // GHL's /oauth/token requires form-encoding; a plain object would serialize as JSON and 400.
    const body = mockedAxios.post.mock.calls[0][1]
    expect(body).toBeInstanceOf(URLSearchParams)
    expect((body as URLSearchParams).get('grant_type')).toBe('refresh_token')
    expect((body as URLSearchParams).get('refresh_token')).toBe('ref-xyz')
  })

  it('reads agent actions embedded in the single-agent detail ({ agent: { actions } })', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        agent: {
          id: 'ag-1',
          name: 'Sales Agent',
          actions: [
            {
              id: 'act-1',
              name: 'Send SMS Confirmation',
              actionType: 'SMS',
              actionParameters: { triggerPrompt: 'When the caller agrees to book' },
            },
          ],
        },
      },
    })
    const client = new GHLClient(mockDb as Database)
    const actions = await client.getAgentActions('loc-123', 'ag-1')
    expect(actions).toHaveLength(1)
    expect(actions[0].actionType).toBe('SMS')
    expect(actions[0].actionParameters?.triggerPrompt).toContain('book')
    // Hits the agent-detail endpoint — GHL has no /agents/:id/actions route.
    expect(mockedAxios.get).toHaveBeenCalledWith(
      expect.stringContaining('/voice-ai/agents/ag-1'),
      expect.objectContaining({ params: { locationId: 'loc-123' } })
    )
    expect(mockedAxios.get).not.toHaveBeenCalledWith(
      expect.stringContaining('/voice-ai/agents/ag-1/actions'),
      expect.anything()
    )
  })

  it('handles actions at the top level of the agent detail ({ actions })', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: { id: 'ag-2', actions: [{ id: 'act-2', name: 'Book Appointment', actionType: 'APPOINTMENT_BOOKING' }] },
    })
    const client = new GHLClient(mockDb as Database)
    const actions = await client.getAgentActions('loc-123', 'ag-2')
    expect(actions).toHaveLength(1)
    expect(actions[0].actionType).toBe('APPOINTMENT_BOOKING')
  })

  it('returns [] when the agent detail has no actions', async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: { agent: { id: 'ag-3' } } })
    const client = new GHLClient(mockDb as Database)
    expect(await client.getAgentActions('loc-123', 'ag-3')).toEqual([])
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
    expect(mockedAxios.get).toHaveBeenLastCalledWith(
      expect.stringContaining('/voice-ai/agents'),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer new-tok' }),
        params: { locationId: 'loc-123' },
      })
    )
  })
})
