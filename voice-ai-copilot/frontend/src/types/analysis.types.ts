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

export interface ScriptSuggestion {
  sectionTitle: string
  issue: string
  currentApproach: string
  suggestedScript: string
  impact: string
}

// One analysis run for a transcript
export interface AnalysisVersion {
  id: string
  overallScore: number
  passed: boolean
  kpiScores: KpiScore[]
  summary: string
  analyzedAt: string
  scriptSuggestions: ScriptSuggestion[]
  useActions: UseAction[]
}

// One transcript with all its analysis runs (latest first)
export interface TranscriptCard {
  transcriptId: string
  ghlCallId: string
  transcriptStatus: string   // 'pending' | 'analyzed' | 'analysis_failed'
  durationSeconds: number | null
  ingestedAt: string
  turns: TranscriptTurn[]
  analyses: AnalysisVersion[]  // sorted by analyzedAt DESC; empty when pending/failed
}

export interface KpiConfig {
  id: string
  agentId: string
  goals: KpiGoal[]
  successThreshold: number
  updatedAt: string
}
