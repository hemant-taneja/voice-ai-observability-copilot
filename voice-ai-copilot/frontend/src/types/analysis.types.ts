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

// A deterministic record that an agent Action (tool) fired during the call.
export interface TranscriptActionRecord {
  id: string
  ghlActionId: string | null
  actionType: string
  actionName: string
  executedAt: string | null
  triggerReceivedAt: string | null
}

// An LLM judgment about an Action: invoked correctly, missed, or fired wrong.
export interface ActionFinding {
  id: string
  ghlActionId: string | null
  actionType: string
  actionName: string
  transcriptTurnIndex: number
  status: 'correct' | 'missed' | 'incorrect'
  description: string
  promptFlaw: string | null
  suggestedTriggerPrompt: string | null
}

// Per-agent rollup for the actions analytics panel.
export interface ActionAnalytics {
  ghlActionId: string | null
  actionType: string
  name: string
  triggerPrompt: string | null
  fireCount: number
  missedCount: number
  incorrectCount: number
  latestPromptFlaw: string | null
  latestSuggestedTriggerPrompt: string | null
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
  actionFindings: ActionFinding[]
}

// One transcript with all its analysis runs (latest first)
export interface TranscriptCard {
  transcriptId: string
  ghlCallId: string
  transcriptStatus: string   // 'pending' | 'analyzed' | 'analysis_failed'
  durationSeconds: number | null
  ingestedAt: string
  turns: TranscriptTurn[]
  transcriptActions: TranscriptActionRecord[]  // deterministic fires, chronological
  analyses: AnalysisVersion[]  // sorted by analyzedAt DESC; empty when pending/failed
}

export interface KpiConfig {
  id: string
  agentId: string
  goals: KpiGoal[]
  successThreshold: number
  updatedAt: string
}
