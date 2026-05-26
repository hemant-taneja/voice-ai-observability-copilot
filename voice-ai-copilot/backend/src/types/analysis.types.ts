export interface KpiGoal {
  name: string
  description: string
  weight: number
}

export interface KpiScore {
  goal: string
  score: number
  passed: boolean
  evidence: string
}

export interface UseActionInput {
  transcriptTurnIndex: number
  type: 'missed_opportunity' | 'deviation' | 'escalation_needed'
  description: string
}

export interface AnalysisResult {
  transcriptId: string
  kpiConfigId: string
  overallScore: number
  passed: boolean
  kpiScores: KpiScore[]
  summary: string
  useActions: UseActionInput[]
}

export interface AnalysisJobData {
  transcriptId: string
  agentId: string
  locationId: string
  kpiConfigId: string
}
