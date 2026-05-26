// backend/src/db/index.test.ts
// Requires postgres_test running on port 5433
import { Pool } from 'pg'

const TEST_URL = 'postgresql://postgres:postgres@127.0.0.1:5433/voice_copilot_test'

describe('db pool', () => {
  beforeAll(() => {
    process.env.DATABASE_URL = TEST_URL
    process.env.REDIS_URL = 'redis://localhost:6379'
    process.env.TEMPORAL_ADDRESS = 'localhost:7233'
    process.env.GHL_WEBHOOK_SECRET = 'test'
    process.env.LLM_PROVIDER = 'openai'
    process.env.OPENAI_API_KEY = 'sk-test'
    process.env.NODE_ENV = 'test'
    jest.resetModules()
  })

  it('executes a simple query successfully', async () => {
    const { db } = await import('./index')
    const result = await db.query<{ sum: number }>('SELECT 1 + 1 AS sum')
    expect(result.rows[0].sum).toBe(2)
    await db.end()
  })
})
