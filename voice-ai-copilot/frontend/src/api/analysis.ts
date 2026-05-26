import { api } from './index'
import { TranscriptCard } from '../types/analysis.types'

export const analysisApi = {
  getByAgent: (agentId: string, locationId: string): Promise<TranscriptCard[]> =>
    api.get<TranscriptCard[]>(`/api/agents/${agentId}/analysis`, { params: { locationId } }).then((r) => r.data),

  reanalyze: (agentId: string, transcriptId: string, locationId: string): Promise<{ ok: boolean; workflowId: string }> =>
    api.post(`/api/agents/${agentId}/transcripts/${transcriptId}/reanalyze`, {}, { params: { locationId } }).then((r) => r.data),
}
