import { setActivePinia, createPinia } from 'pinia'
import { useAgentsStore } from './agents'
import { vi } from 'vitest'

vi.mock('../api/agents', () => ({
  agentsApi: {
    list: vi.fn().mockResolvedValue([
      { id: 'ag-1', ghlAgentId: 'g-1', name: 'Alpha', script: null,
        passRate: 0.82, totalCalls: 12, openUseActions: 2 },
    ]),
  },
}))

describe('agentsStore', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('fetches agents and stores them', async () => {
    const store = useAgentsStore()
    expect(store.agents).toHaveLength(0)
    await store.fetchAll('loc-123')
    expect(store.agents).toHaveLength(1)
    expect(store.agents[0].name).toBe('Alpha')
    expect(store.loading).toBe(false)
  })

  it('sets loading to true while fetching', async () => {
    const store = useAgentsStore()
    const promise = store.fetchAll('loc-123')
    expect(store.loading).toBe(true)
    await promise
    expect(store.loading).toBe(false)
  })
})
