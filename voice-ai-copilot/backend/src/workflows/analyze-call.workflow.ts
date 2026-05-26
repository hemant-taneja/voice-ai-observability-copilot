import { proxyActivities, ActivityOptions } from '@temporalio/workflow'
import type * as activities from '../activities/index'

const defaultOptions: ActivityOptions = {
  startToCloseTimeout: '30 seconds',
  retry: { maximumAttempts: 2, initialInterval: '1s' },
}

const llmOptions: ActivityOptions = {
  startToCloseTimeout: '2 minutes',
  retry: { maximumAttempts: 3, initialInterval: '2s', backoffCoefficient: 2 },
}

const {
  loadTranscript,
  loadKpiConfig,
  buildPrompt,
  persistResults,
  broadcastSSE,
  broadcastSSEFailure,
  markTranscriptFailed,
} = proxyActivities<typeof activities>(defaultOptions)

const { callLLM } = proxyActivities<typeof activities>(llmOptions)

export interface AnalyzeCallInput {
  transcriptId: string
  agentId: string
  locationId: string
  kpiConfigId: string
}

export async function analyzeCallWorkflow(input: AnalyzeCallInput): Promise<void> {
  try {
    const transcript = await loadTranscript(input.transcriptId)
    const kpiConfig  = await loadKpiConfig(input.kpiConfigId)
    const prompt     = await buildPrompt(transcript, kpiConfig)
    const output     = await callLLM(prompt)
    await persistResults(output, input)
    await broadcastSSE(input.locationId, input.agentId)
  } catch (err) {
    await markTranscriptFailed(input.transcriptId)
    await broadcastSSEFailure(input.locationId, input.agentId)
    throw err
  }
}
