import request from 'supertest'
import express, { Request, Response, NextFunction } from 'express'

function setTestEnv() {
  process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5433/voice_copilot_test'
  process.env.REDIS_URL = 'redis://localhost:6379'
  process.env.TEMPORAL_ADDRESS = 'localhost:7233'
  process.env.GHL_WEBHOOK_SECRET = 'test-secret'
  process.env.LLM_PROVIDER = 'openai'
  process.env.OPENAI_API_KEY = 'sk-test'
  process.env.NODE_ENV = 'test'
}

describe('errorHandler middleware', () => {
  beforeAll(() => setTestEnv())

  function makeApp(throwFn: (req: Request, res: Response, next: NextFunction) => void) {
    const app = express()
    app.get('/test', throwFn)
    // We'll dynamically import the errorHandler
    app.use(async (err: Error, req: Request, res: Response, next: NextFunction) => {
      const { errorHandler } = await import('./error-handler')
      return errorHandler(err, req, res, next)
    })
    return app
  }

  it('returns 400 for AppError with status 400', async () => {
    const app = makeApp((_req, _res, next) => {
      const { AppError } = require('./error-handler')
      next(new AppError('Validation failed', 400, 'VALIDATION_ERROR'))
    })
    const res = await request(app).get('/test')
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('VALIDATION_ERROR')
    expect(res.body.error).toBe('Validation failed')
  })

  it('returns 500 for generic errors and does not leak internal details', async () => {
    const app = makeApp((_req, _res, next) => {
      next(new Error('Secret database connection string'))
    })
    const res = await request(app).get('/test')
    expect(res.status).toBe(500)
    expect(res.body.code).toBe('INTERNAL_ERROR')
    expect(res.body.error).toBe('An unexpected error occurred')
    // Must NOT expose the real error message
    expect(res.body.error).not.toContain('Secret')
  })

  it('returns 404 for AppError with status 404', async () => {
    const app = makeApp((_req, _res, next) => {
      const { AppError } = require('./error-handler')
      next(new AppError('Resource not found', 404, 'NOT_FOUND'))
    })
    const res = await request(app).get('/test')
    expect(res.status).toBe(404)
    expect(res.body.code).toBe('NOT_FOUND')
  })
})
