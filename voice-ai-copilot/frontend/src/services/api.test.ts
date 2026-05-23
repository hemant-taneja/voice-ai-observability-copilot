import { describe, it, expect, vi, beforeEach } from 'vitest'

// Use vi.hoisted so these run before vi.mock() hoisting resolves the factory
const { mockGet, mockPut } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPut: vi.fn(),
}))

// Mock axios before importing api — factory references hoisted mocks
vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({ get: mockGet, put: mockPut })),
  },
}))

import { api } from './api'

describe('api service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('listAgents calls GET /api/agents with locationId', async () => {
    const agents = [{ id: '1', name: 'Agent A', ghlAgentId: 'ghl-1', totalCalls: 5, analyzedCalls: 3, passRate: 0.8, avgScore: 0.75 }]
    mockGet.mockResolvedValue({ data: agents })
    const result = await api.listAgents('loc-1')
    expect(mockGet).toHaveBeenCalledWith('/api/agents', { params: { locationId: 'loc-1' } })
    expect(result).toEqual(agents)
  })

  it('getAgent calls GET /api/agents/:agentId with locationId', async () => {
    const agent = {
      id: 'ag-1',
      ghlAgentId: 'ghl-1',
      name: 'Agent A',
      totalCalls: 5,
      analyzedCalls: 3,
      passRate: 0.8,
      avgScore: 0.75,
      recentAnalyses: [],
    }
    mockGet.mockResolvedValue({ data: agent })
    const result = await api.getAgent('ag-1', 'loc-1')
    expect(mockGet).toHaveBeenCalledWith('/api/agents/ag-1', { params: { locationId: 'loc-1' } })
    expect(result).toEqual(agent)
  })

  it('getKpiConfig returns null on 404', async () => {
    mockGet.mockRejectedValue({ response: { status: 404 } })
    const result = await api.getKpiConfig('ag-1', 'loc-1')
    expect(result).toBeNull()
  })

  it('getKpiConfig rethrows non-404 errors', async () => {
    const error = { response: { status: 500 } }
    mockGet.mockRejectedValue(error)
    await expect(api.getKpiConfig('ag-1', 'loc-1')).rejects.toEqual(error)
  })

  it('upsertKpiConfig calls PUT /api/kpi/:agentId', async () => {
    const config = { id: 'kpi-1', agentId: 'ag-1', goals: [], successThreshold: 0.7, updatedAt: '2024-01-01' }
    mockPut.mockResolvedValue({ data: config })
    const result = await api.upsertKpiConfig('ag-1', 'loc-1', [], 0.7)
    expect(mockPut).toHaveBeenCalledWith(
      '/api/kpi/ag-1',
      { goals: [], successThreshold: 0.7 },
      { params: { locationId: 'loc-1' } }
    )
    expect(result).toEqual(config)
  })
})
