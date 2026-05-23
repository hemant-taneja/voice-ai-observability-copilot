import { api } from './index'
import { KpiConfig, KpiGoal } from '../types/analysis.types'

export const kpiApi = {
  get: (agentId: string, locationId: string): Promise<KpiConfig> =>
    api.get<KpiConfig>(`/api/kpi/${agentId}`, { params: { locationId } }).then((r) => r.data),

  upsert: (agentId: string, locationId: string, goals: KpiGoal[], successThreshold: number): Promise<KpiConfig> =>
    api.put<KpiConfig>(`/api/kpi/${agentId}`, { goals, successThreshold }, { params: { locationId } }).then((r) => r.data),
}
