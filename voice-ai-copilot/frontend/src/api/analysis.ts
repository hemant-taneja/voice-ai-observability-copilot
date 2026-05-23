import { api } from './index'
import { AnalysisResult } from '../types/analysis.types'

export const analysisApi = {
  getByAgent: (agentId: string, locationId: string): Promise<AnalysisResult[]> =>
    api.get<AnalysisResult[]>(`/api/agents/${agentId}/analysis`, { params: { locationId } }).then((r) => r.data),
}
