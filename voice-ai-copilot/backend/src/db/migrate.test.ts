import { Pool } from 'pg'

const TEST_URL = 'postgresql://postgres:postgres@localhost:5433/voice_copilot_test'

describe('migrations', () => {
  let pool: Pool

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_URL
    process.env.REDIS_URL = 'redis://localhost:6379'
    process.env.TEMPORAL_ADDRESS = 'localhost:7233'
    process.env.GHL_WEBHOOK_SECRET = 'test'
    process.env.LLM_PROVIDER = 'openai'
    process.env.OPENAI_API_KEY = 'sk-test'
    process.env.NODE_ENV = 'test'
    jest.resetModules()
    pool = new Pool({ connectionString: TEST_URL })
    const { runMigrations } = await import('./migrate')
    await runMigrations(TEST_URL)
  })

  afterAll(() => pool.end())

  const tables = ['locations', 'agents', 'kpi_configs', 'transcripts', 'analysis_results', 'use_actions']

  it.each(tables)('table "%s" exists after migration', async (table) => {
    const { rows } = await pool.query(
      `SELECT EXISTS (
         SELECT FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = $1
       ) AS exists`,
      [table]
    )
    expect(rows[0].exists).toBe(true)
  })
})
