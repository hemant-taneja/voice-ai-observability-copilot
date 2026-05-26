import { Request, Response, NextFunction } from 'express'
import { Pool } from 'pg'

const TEST_URL = 'postgresql://postgres:postgres@127.0.0.1:5433/voice_copilot_test'

function setTestEnv() {
  process.env.DATABASE_URL = TEST_URL
  process.env.REDIS_URL = 'redis://localhost:6379'
  process.env.TEMPORAL_ADDRESS = 'localhost:7233'
  process.env.GHL_WEBHOOK_SECRET = 'test-secret'
  process.env.LLM_PROVIDER = 'openai'
  process.env.OPENAI_API_KEY = 'sk-test'
  process.env.NODE_ENV = 'test'
}

describe('ghlAuth middleware', () => {
  let pool: Pool
  const TEST_LOC = 'test-loc-ghlauth-001'

  beforeAll(async () => {
    setTestEnv()
    jest.resetModules()
    pool = new Pool({ connectionString: TEST_URL })
    // Seed a test location
    await pool.query(
      `INSERT INTO locations (location_id, name) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [TEST_LOC, 'Test Location']
    )
  })

  afterAll(() => pool.end())

  function makeReqRes(locationId?: string) {
    const req = {
      query: locationId ? { locationId } : {},
      headers: {},
    } as unknown as Request
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    } as unknown as Response
    const next = jest.fn() as NextFunction
    return { req, res, next }
  }

  it('calls next() when locationId is valid and exists in DB', async () => {
    jest.resetModules()
    const { ghlAuth } = await import('./ghl-auth')
    const { req, res, next } = makeReqRes(TEST_LOC)
    await ghlAuth()(req, res, next)
    expect(next).toHaveBeenCalledWith()
    expect(res.status).not.toHaveBeenCalled()
  })

  it('returns 401 when locationId is missing', async () => {
    jest.resetModules()
    const { ghlAuth } = await import('./ghl-auth')
    const { req, res, next } = makeReqRes()
    await ghlAuth()(req, res, next)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('returns 401 when locationId does not exist in DB', async () => {
    jest.resetModules()
    const { ghlAuth } = await import('./ghl-auth')
    const { req, res, next } = makeReqRes('nonexistent-loc')
    await ghlAuth()(req, res, next)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })
})
