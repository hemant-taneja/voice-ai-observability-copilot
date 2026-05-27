export interface GHLTranscriptTurn {
  speaker: 'agent' | 'user'
  text: string
  timestamp_ms: number
}

// Internal payload format (used by /webhooks/call-completed and TranscriptService)
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

// ── Marketplace webhook event types ──────────────────────────────────────────

export interface VoiceAiCallEndPayload {
  type: 'VoiceAiCallEnd'
  id: string
  locationId: string
  agentId: string
  contactId: string
  fromNumber: string
  createdAt: string
  duration: number
  summary: string
  transcript: string
  translation?: { transcript: string; language: string }
  extractedData?: Record<string, string>
  messageId: string
  trialCall: boolean
}

export interface AppInstallPayload {
  type: 'INSTALL'
  appId: string
  locationId?: string
  companyId: string
  userId?: string
  planId?: string
  timestamp: string
}

export interface AppUninstallPayload {
  type: 'UNINSTALL'
  appId: string
  locationId?: string
  companyId: string
  timestamp: string
}
