export interface GHLTranscriptTurn {
  speaker: 'agent' | 'user'
  text: string
  timestamp_ms: number
}

// ── Voice AI Action (tool-call) types ────────────────────────────────────────

// The set of action types GHL Voice AI supports (from the Voice AI OpenAPI spec).
export type GHLActionType =
  | 'CALL_TRANSFER'
  | 'DATA_EXTRACTION'
  | 'IN_CALL_DATA_EXTRACTION'
  | 'WORKFLOW_TRIGGER'
  | 'SMS'
  | 'APPOINTMENT_BOOKING'
  | 'CUSTOM_ACTION'
  | 'KNOWLEDGE_BASE'

// An action DEFINITION bound to an agent — GET /voice-ai/agents/:id/actions.
// actionParameters.triggerPrompt holds the "when to invoke" logic we analyse.
export interface GHLAction {
  id: string
  name: string
  actionType: GHLActionType
  actionParameters?: {
    triggerPrompt?: string
    triggerMessage?: string
    [key: string]: unknown
  }
}

// A single action INVOCATION recorded during a call — arrives inside the
// VoiceAiCallEnd webhook payload's executedCallActions[] array.
export interface GHLExecutedAction {
  _id?: string
  actionType: GHLActionType
  actionName: string
  description?: string
  actionParameters?: Record<string, unknown>
  executedAt?: string
  triggerReceivedAt?: string
}

// Internal payload format (used by /webhooks/call-completed and TranscriptService)
export interface GHLCallCompletedPayload {
  callId: string
  locationId: string
  agentId: string
  callerPhone?: string
  durationSeconds?: number
  turns: GHLTranscriptTurn[]
  createdAt?: string
  executedCallActions?: GHLExecutedAction[]
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
  executedCallActions?: GHLExecutedAction[]
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
