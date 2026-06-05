import { api } from './index'
import { ActionAnalytics } from '../types/analysis.types'

export const actionsApi = {
  getAnalytics: (agentId: string, locationId: string): Promise<ActionAnalytics[]> =>
    api
      .get<ActionAnalytics[]>(`/api/agents/${agentId}/actions/analytics`, { params: { locationId } })
      .then((r) => r.data),
}
