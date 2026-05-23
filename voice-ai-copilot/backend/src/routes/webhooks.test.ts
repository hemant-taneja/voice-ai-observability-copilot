// Set environment variables before everything
process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5433/voice_copilot_test'
process.env.REDIS_URL = 'redis://localhost:6379'
process.env.TEMPORAL_ADDRESS = 'localhost:7233'
process.env.GHL_WEBHOOK_SECRET = 'test-webhook-secret'
process.env.LLM_PROVIDER = 'openai'
process.env.OPENAI_API_KEY = 'sk-test'
process.env.NODE_ENV = 'test'

import crypto from 'crypto'
import express from 'express'

function makeSignature(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex')
}

describe('POST /webhooks/call-completed', () => {
  let app: express.Express
  const SECRET = 'test-webhook-secret'

  const validPayload = {
    callId: 'call-abc-123',
    locationId: 'loc-test',
    agentId: 'ag-test',
    callerPhone: '+1234567890',
    durationSeconds: 68,
    turns: [
      { speaker: 'agent', text: 'Hello!', timestamp_ms: 0 },
      { speaker: 'user', text: 'Hi there', timestamp_ms: 2000 },
    ],
  }

  beforeAll(async () => {
    jest.resetModules()

    jest.mock('../services/transcript-service', () => ({
      TranscriptService: jest.fn().mockImplementation(() => ({
        ingest: jest.fn().mockResolvedValue({ id: 'tr-new', kpiConfigId: 'kpi-1', isNew: true }),
      })),
    }))
    jest.mock('@temporalio/client', () => ({
      Client: jest.fn().mockImplementation(() => ({
        workflow: { start: jest.fn().mockResolvedValue({ workflowId: 'wf-1' }) },
      })),
      Connection: { connect: jest.fn().mockResolvedValue({}) },
    }))

    const { app: a } = await import('../app')
    app = a
  })

  it('returns 401 for missing signature', async () => {
    const request = (await import('supertest')).default
    const res = await request(app)
      .post('/webhooks/call-completed')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify(validPayload))
    expect(res.status).toBe(401)
    expect(res.body.code).toBe('INVALID_SIGNATURE')
  })

  it('returns 401 for wrong signature', async () => {
    const request = (await import('supertest')).default
    const body = JSON.stringify(validPayload)
    const res = await request(app)
      .post('/webhooks/call-completed')
      .set('Content-Type', 'application/json')
      .set('x-ghl-signature', 'wrong-sig')
      .send(body)
    expect(res.status).toBe(401)
    expect(res.body.code).toBe('INVALID_SIGNATURE')
  })

  it('returns 200 and enqueues workflow for valid signed payload', async () => {
    const request = (await import('supertest')).default
    const body = JSON.stringify(validPayload)
    const sig = makeSignature(body, SECRET)
    const res = await request(app)
      .post('/webhooks/call-completed')
      .set('Content-Type', 'application/json')
      .set('x-ghl-signature', sig)
      .send(body)
    expect(res.status).toBe(200)
    expect(res.body.received).toBe(true)
  })
})
