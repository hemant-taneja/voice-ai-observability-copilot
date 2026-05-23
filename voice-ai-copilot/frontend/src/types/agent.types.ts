export interface Agent {
  id: string
  ghlAgentId: string
  name: string
  script: string | null
  passRate: number | null
  totalCalls: number
  openUseActions: number
}
