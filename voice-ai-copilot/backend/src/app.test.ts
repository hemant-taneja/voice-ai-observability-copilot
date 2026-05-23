import request from 'supertest'

function setTestEnv() {
  process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5433/voice_copilot_test'
  process.env.REDIS_URL = 'redis://localhost:6379'
  process.env.TEMPORAL_ADDRESS = 'localhost:7233'
  process.env.GHL_WEBHOOK_SECRET = 'test-secret'
  process.env.LLM_PROVIDER = 'openai'
  process.env.OPENAI_API_KEY = 'sk-test'
  process.env.NODE_ENV = 'test'
}

describe('app', () => {
  let app: import('express').Express

  beforeAll(async () => {
    setTestEnv()
    jest.resetModules()
    const mod = await import('./app')
    app = mod.app
  })

  it('GET /health returns 200 with status ok', async () => {
    const res = await request(app).get('/health')
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ok')
    expect(res.body.timestamp).toBeDefined()
  })

  it('unknown route returns 404 with error body', async () => {
    const res = await request(app).get('/not-a-real-route')
    expect(res.status).toBe(404)
    expect(res.body.code).toBe('NOT_FOUND')
  })
})
