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

export interface UseAction {
  id: string
  transcriptTurnIndex: number
  type: 'missed_opportunity' | 'deviation' | 'escalation_needed'
  description: string
}

export interface TranscriptTurn {
  speaker: 'agent' | 'user'
  text: string
  timestamp_ms: number
}

export interface AnalysisResult {
  id: string
  overallScore: number
  passed: boolean
  kpiScores: KpiScore[]
  summary: string
  analyzedAt: string
  transcriptId: string
  ghlCallId: string
  durationSeconds: number | null
  ingestedAt: string
  turns: TranscriptTurn[]
  useActions: UseAction[]
}

export interface KpiConfig {
  id: string
  agentId: string
  goals: KpiGoal[]
  successThreshold: number
  updatedAt: string
}
