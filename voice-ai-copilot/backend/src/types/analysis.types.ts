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

// One judgment about an agent Action (tool call): was it invoked correctly,
// missed when it should have fired, or fired incorrectly? For misses/incorrect
// fires, promptFlaw explains the flaw in the action's triggerPrompt.
export interface ActionFindingInput {
  ghlActionId: string | null
  actionType: string
  actionName: string
  transcriptTurnIndex: number
  status: 'correct' | 'missed' | 'incorrect'
  description: string
  promptFlaw?: string | null
  suggestedTriggerPrompt?: string | null
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
