import { api } from './index'
import { Agent, AgentDetail } from '../types/agent.types'

export interface SimulateTurn {
  speaker: 'agent' | 'user'
  text: string
  timestamp_ms: number
}

export interface SimulateResult {
  ok: boolean
  transcriptId: string
  workflowId: string
}

export const agentsApi = {
  list: (locationId: string): Promise<Agent[]> =>
    api.get<Agent[]>('/api/agents', { params: { locationId } }).then((r) => r.data),

  getById: (agentId: string, locationId: string): Promise<AgentDetail> =>
    api.get<AgentDetail>(`/api/agents/${agentId}`, { params: { locationId } }).then((r) => r.data),

  updateScript: (agentId: string, locationId: string, script: string): Promise<void> =>
    api.put(`/api/agents/${agentId}`, { script }, { params: { locationId } }).then(() => undefined),

  simulate: (agentId: string, locationId: string, turns: SimulateTurn[]): Promise<SimulateResult> =>
    api.post<SimulateResult>(`/api/agents/${agentId}/simulate`, { turns }, { params: { locationId } }).then((r) => r.data),

  syncFromHL: (locationId: string): Promise<{ synced: number }> =>
    api.post<{ synced: number }>('/api/agents/sync', {}, { params: { locationId } }).then((r) => r.data),
}
