process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5433/voice_copilot_test'
process.env.REDIS_URL = 'redis://localhost:6379'
process.env.TEMPORAL_ADDRESS = 'localhost:7233'
process.env.GHL_WEBHOOK_SECRET = 'test'
process.env.LLM_PROVIDER = 'openai'
process.env.OPENAI_API_KEY = 'sk-test'
process.env.NODE_ENV = 'test'

import express from 'express'

describe('GET /api/agents', () => {
  let app: express.Express

  beforeAll(async () => {
    jest.resetModules()
    jest.mock('../middleware/ghl-auth', () => ({
      ghlAuth: () => (req: express.Request, _res: express.Response, next: express.NextFunction) => {
        next()
      },
    }))
    jest.mock('../db/index', () => ({
      db: {
        query: jest.fn().mockResolvedValue({
          rows: [{
            id: 'ag-1', ghl_agent_id: 'ghl-ag-1', name: 'Agent Alpha',
            script: 'Book appointments.',
            pass_rate: '0.75', total_calls: '12', open_use_actions: '2',
          }],
        }),
      },
    }))
    const mod = await import('../app')
    app = mod.app
  })

  it('returns agent list with metrics for a locationId', async () => {
    const request = (await import('supertest')).default
    const res = await request(app).get('/api/agents?locationId=loc-test')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body[0].name).toBe('Agent Alpha')
    expect(res.body[0].passRate).toBe(0.75)
  })
})
