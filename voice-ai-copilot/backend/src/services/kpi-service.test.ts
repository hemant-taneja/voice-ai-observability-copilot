process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5433/voice_copilot_test'
process.env.REDIS_URL = 'redis://localhost:6379'
process.env.TEMPORAL_ADDRESS = 'localhost:7233'
process.env.GHL_WEBHOOK_SECRET = 'test'
process.env.LLM_PROVIDER = 'openai'
process.env.OPENAI_API_KEY = 'sk-test'
process.env.NODE_ENV = 'test'

import { Database } from '../db/index'
import { KpiService } from './kpi-service'
import { KpiGoal } from '../types/analysis.types'

describe('KpiService', () => {
  let mockDb: Partial<Database>

  beforeEach(() => {
    jest.clearAllMocks()
    mockDb = { query: jest.fn() }
  })

  it('returns config for known agent', async () => {
    ;(mockDb.query as jest.Mock).mockResolvedValueOnce({
      rows: [{ goals: [{ name: 'Greeting', description: 'Did agent greet?', weight: 1 }], pass_threshold: 70 }],
    })
    const svc = new KpiService(mockDb as Database)
    const result = await svc.getConfig('ag-1')
    expect(result).toEqual({
      goals: [{ name: 'Greeting', description: 'Did agent greet?', weight: 1 }],
      passThreshold: 70,
    })
  })

  it('returns null for unknown agent', async () => {
    ;(mockDb.query as jest.Mock).mockResolvedValueOnce({ rows: [] })
    const svc = new KpiService(mockDb as Database)
    const result = await svc.getConfig('unknown')
    expect(result).toBeNull()
  })

  it('upserts config', async () => {
    ;(mockDb.query as jest.Mock).mockResolvedValueOnce({ rows: [] })
    const svc = new KpiService(mockDb as Database)
    const goals: KpiGoal[] = [{ name: 'Closing', description: 'Agent closed properly', weight: 2 }]
    await svc.upsertConfig('ag-2', goals, 80)
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('ON CONFLICT'),
      ['ag-2', JSON.stringify(goals), 80]
    )
  })
})
