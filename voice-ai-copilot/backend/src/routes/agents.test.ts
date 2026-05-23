process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5433/voice_copilot_test'
process.env.REDIS_URL = 'redis://localhost:6379'
process.env.TEMPORAL_ADDRESS = 'localhost:7233'
process.env.GHL_WEBHOOK_SECRET = 'test'
process.env.LLM_PROVIDER = 'openai'
process.env.OPENAI_API_KEY = 'sk-test'
process.env.NODE_ENV = 'test'

import express from 'express'

const mockListByLocation = jest.fn()
const mockGetDetail = jest.fn()

jest.mock('../services/agents-service', () => ({
  AgentsService: jest.fn().mockImplementation(() => ({
    listByLocation: mockListByLocation,
    getDetail: mockGetDetail,
  })),
}))

jest.mock('../middleware/ghl-auth', () => ({
  ghlAuth: () => (req: any, _res: any, next: any) => {
    const locationId = req.query.locationId || req.headers['x-ghl-location']
    if (!locationId) {
      return _res.status(401).json({ error: 'Unauthorized', code: 'MISSING_LOCATION' })
    }
    req.locationId = locationId
    next()
  },
}))

describe('Agents route', () => {
  let app: express.Express

  beforeAll(async () => {
    jest.resetModules()
    const mod = await import('../app')
    app = mod.app
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('GET /api/agents', () => {
    it('returns 401 when locationId is missing', async () => {
      const request = (await import('supertest')).default
      const res = await request(app).get('/api/agents')
      expect(res.status).toBe(401)
    })

    it('returns 200 with agent list when locationId is provided', async () => {
      const mockAgents = [
        {
          id: 'ag-1',
          ghlAgentId: 'ghl-ag-1',
          name: 'Agent Alpha',
          totalCalls: 12,
          analyzedCalls: 8,
          passRate: 0.75,
          avgScore: 0.82,
        },
      ]
      mockListByLocation.mockResolvedValue(mockAgents)

      const request = (await import('supertest')).default
      const res = await request(app).get('/api/agents?locationId=loc-test')
      expect(res.status).toBe(200)
      expect(Array.isArray(res.body)).toBe(true)
      expect(res.body[0].name).toBe('Agent Alpha')
      expect(res.body[0].passRate).toBe(0.75)
      expect(mockListByLocation).toHaveBeenCalledWith('loc-test')
    })
  })

  describe('GET /api/agents/:agentId', () => {
    it('returns 200 with agent detail when agent is found', async () => {
      const mockDetail = {
        id: 'ag-1',
        ghlAgentId: 'ghl-ag-1',
        name: 'Agent Alpha',
        recentAnalyses: [
          {
            transcriptId: 'tr-1',
            callId: 'call-1',
            analyzedAt: new Date('2025-01-01T00:00:00Z'),
            overallScore: 0.9,
            passed: true,
            summary: 'Good call',
            useActions: [{ type: 'missed_opportunity', description: 'Did not upsell', turnIndex: 3 }],
          },
        ],
      }
      mockGetDetail.mockResolvedValue(mockDetail)

      const request = (await import('supertest')).default
      const res = await request(app).get('/api/agents/ag-1?locationId=loc-test')
      expect(res.status).toBe(200)
      expect(res.body.id).toBe('ag-1')
      expect(res.body).toHaveProperty('recentAnalyses')
      expect(Array.isArray(res.body.recentAnalyses)).toBe(true)
      expect(mockGetDetail).toHaveBeenCalledWith('ag-1', 'loc-test')
    })

    it('returns 404 with AGENT_NOT_FOUND when agent does not exist', async () => {
      mockGetDetail.mockResolvedValue(null)

      const request = (await import('supertest')).default
      const res = await request(app).get('/api/agents/no-such-agent?locationId=loc-test')
      expect(res.status).toBe(404)
      expect(res.body.code).toBe('AGENT_NOT_FOUND')
    })
  })
})
