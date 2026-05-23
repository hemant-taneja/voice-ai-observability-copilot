export type UseActionType = 'missed_opportunity' | 'deviation' | 'escalation_needed'

export interface KpiGoal {
  name: string
  description: string
  weight: number
}

export interface KpiScore {
  goalName: string
  score: number
  weight: number
}

export interface UseAction {
  type: UseActionType
  description: string
  turnIndex: number
}

export interface Analysis {
  transcriptId: string
  callId: string
  analyzedAt: string
  overallScore: number
  passed: boolean
  summary: string
  useActions: UseAction[]
}

export interface AgentSummary {
  id: string
  ghlAgentId: string
  name: string
  totalCalls: number
  analyzedCalls: number
  passRate: number | null
  avgScore: number | null
}

export interface AgentDetail extends AgentSummary {
  recentAnalyses: Analysis[]
}

export interface KpiConfig {
  id: string
  agentId: string
  goals: KpiGoal[]
  successThreshold: number
  updatedAt: string
}

export interface SSEEvent {
  type: 'analysis_complete' | 'analysis_failed'
  agentId: string
  locationId: string
  timestamp: string
}
