// Set env vars before any module imports that load config
process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5433/voice_copilot_test'
process.env.REDIS_URL = 'redis://localhost:6379'
process.env.TEMPORAL_ADDRESS = 'localhost:7233'
process.env.GHL_WEBHOOK_SECRET = 'test'
process.env.LLM_PROVIDER = 'openai'
process.env.OPENAI_API_KEY = 'sk-test'
process.env.NODE_ENV = 'test'

import { AgentsService } from './agents-service'
import { Database } from '../db/index'

const mockDb = (): jest.Mocked<Partial<Database>> => ({
  query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
})

const sqlOf = (db: jest.Mocked<Partial<Database>>): string[] =>
  (db.query as jest.Mock).mock.calls.map((c) => String(c[0]))

describe('AgentsService.upsertFromGHL', () => {
  it('upserts every incoming agent and returns the count', async () => {
    const db = mockDb()
    const service = new AgentsService(db as Database)

    const count = await service.upsertFromGHL('loc-1', [
      { id: 'a1', name: 'Alpha' },
      { id: 'a2', name: 'Beta' },
    ])

    expect(count).toBe(2)
    const inserts = sqlOf(db).filter((sql) => /INSERT INTO agents/i.test(sql))
    expect(inserts).toHaveLength(2)
  })

  it('does NOT delete agents that are absent from the GHL response', async () => {
    const db = mockDb()
    const service = new AgentsService(db as Database)

    // GHL returns only one agent; the location may have others with history.
    await service.upsertFromGHL('loc-1', [{ id: 'a1', name: 'Alpha' }])

    const deletes = sqlOf(db).filter((sql) => /DELETE/i.test(sql))
    expect(deletes).toHaveLength(0)
  })
})
