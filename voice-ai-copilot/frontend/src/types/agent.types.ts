export interface Agent {
  id: string
  ghlAgentId: string
  name: string
  script: string | null
  passRate: number | null
  totalCalls: number
  openUseActions: number
}

export interface AgentAnalysis {
  transcriptId: string
  callId: string
  analyzedAt: string
  overallScore: number
  passed: boolean
  kpiScores: Array<{ goal: string; score: number; passed: boolean; evidence: string }>
  summary: string
  useActions: Array<{ type: string; description: string; turnIndex: number }>
}

export interface AgentDetail {
  id: string
  ghlAgentId: string
  name: string
  script: string | null
  recentAnalyses: AgentAnalysis[]
}
