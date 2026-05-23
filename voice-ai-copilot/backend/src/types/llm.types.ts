import { GHLTranscriptTurn } from './ghl.types'
import { KpiGoal, KpiScore, UseActionInput } from './analysis.types'

export interface AnalysisPrompt {
  agentScript: string
  turns: GHLTranscriptTurn[]
  kpiGoals: KpiGoal[]
}

export interface AnalysisOutput {
  overallScore: number
  passed: boolean
  kpiScores: KpiScore[]
  summary: string
  useActions: UseActionInput[]
}

export interface LLMProvider {
  readonly providerName: string
  readonly modelName: string
  analyze(prompt: AnalysisPrompt): Promise<AnalysisOutput>
}
