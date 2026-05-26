import { GHLTranscriptTurn } from './ghl.types'
import { KpiGoal, KpiScore, UseActionInput } from './analysis.types'

export interface AnalysisPrompt {
  agentScript: string
  turns: GHLTranscriptTurn[]
  kpiGoals: KpiGoal[]
}

export interface ScriptSuggestion {
  sectionTitle: string    // e.g. "Objection Handling", "Closing"
  issue: string           // what went wrong in the call
  currentApproach: string // what the agent actually said/did
  suggestedScript: string // concrete replacement text for the script
  impact: string          // which KPI this improves and why
}

export interface AnalysisOutput {
  overallScore: number
  passed: boolean
  kpiScores: KpiScore[]
  summary: string
  useActions: UseActionInput[]
  scriptSuggestions: ScriptSuggestion[]
}

export interface LLMProvider {
  readonly providerName: string
  readonly modelName: string
  analyze(prompt: AnalysisPrompt): Promise<AnalysisOutput>
  suggestKpiGoals(script: string): Promise<KpiGoal[]>
}
