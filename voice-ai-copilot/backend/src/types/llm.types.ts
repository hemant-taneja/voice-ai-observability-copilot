import { GHLTranscriptTurn } from './ghl.types'
import { KpiGoal, KpiScore, UseActionInput, ActionFindingInput } from './analysis.types'

// An action DEFINITION available to the agent — what the LLM evaluates the
// transcript against (did it fire when triggerPrompt says it should have?).
export interface PromptAction {
  ghlActionId: string | null
  name: string
  actionType: string
  triggerPrompt: string | null
  triggerMessage: string | null
}

// A deterministic record that an action FIRED during the call (ground truth).
export interface PromptExecutedAction {
  ghlActionId: string | null
  actionType: string
  actionName: string
}

export interface AnalysisPrompt {
  agentScript: string
  turns: GHLTranscriptTurn[]
  kpiGoals: KpiGoal[]
  actions: PromptAction[]
  executedActions: PromptExecutedAction[]
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
  actionFindings: ActionFindingInput[]
}

export interface LLMProvider {
  readonly providerName: string
  readonly modelName: string
  analyze(prompt: AnalysisPrompt): Promise<AnalysisOutput>
  suggestKpiGoals(script: string): Promise<KpiGoal[]>
}
