import { api } from './index'
import { Agent } from '../types/agent.types'

export const agentsApi = {
  list: (locationId: string): Promise<Agent[]> =>
    api.get<Agent[]>('/api/agents', { params: { locationId } }).then((r) => r.data),
}
