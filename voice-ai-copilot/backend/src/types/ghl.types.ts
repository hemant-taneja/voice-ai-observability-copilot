export interface GHLTranscriptTurn {
  speaker: 'agent' | 'user'
  text: string
  timestamp_ms: number
}

export interface GHLCallCompletedPayload {
  callId: string
  locationId: string
  agentId: string
  callerPhone?: string
  durationSeconds?: number
  turns: GHLTranscriptTurn[]
}

export interface GHLAgent {
  id: string
  name: string
  script?: string
}
