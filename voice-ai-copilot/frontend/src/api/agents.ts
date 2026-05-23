import { api } from './index'
import { Agent, AgentDetail } from '../types/agent.types'

export const agentsApi = {
  list: (locationId: string): Promise<Agent[]> =>
    api.get<Agent[]>('/api/agents', { params: { locationId } }).then((r) => r.data),

  getById: (agentId: string, locationId: string): Promise<AgentDetail> =>
    api.get<AgentDetail>(`/api/agents/${agentId}`, { params: { locationId } }).then((r) => r.data),
}
