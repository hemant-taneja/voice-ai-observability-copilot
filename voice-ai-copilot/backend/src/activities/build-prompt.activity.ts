import { db } from '../db/index'
import { AnalysisPrompt, PromptAction, PromptExecutedAction } from '../types/llm.types'
import { TranscriptRow } from './load-transcript.activity'
import { KpiConfig } from '../services/kpi-service'

export async function buildPrompt(
  transcript: TranscriptRow,
  kpiConfig: KpiConfig
): Promise<AnalysisPrompt> {
  const { rows } = await db.query(
    'SELECT script FROM agents WHERE id = $1',
    [transcript.agentId]
  )
  const agentScript = rows[0]?.script ?? 'No script provided.'

  // Action DEFINITIONS available to this agent (incl. the triggerPrompt whose
  // flaws we diagnose).
  const { rows: actionRows } = await db.query(
    'SELECT ghl_action_id, name, action_type, trigger_prompt, trigger_message FROM agent_actions WHERE agent_id = $1',
    [transcript.agentId]
  )
  const actions: PromptAction[] = actionRows.map((r: any) => ({
    ghlActionId: r.ghl_action_id,
    name: r.name,
    actionType: r.action_type,
    triggerPrompt: r.trigger_prompt ?? null,
    triggerMessage: r.trigger_message ?? null,
  }))

  // Deterministic record of what actually FIRED during this call (ground truth).
  const { rows: firedRows } = await db.query(
    'SELECT ghl_action_id, action_type, action_name FROM transcript_actions WHERE transcript_id = $1 ORDER BY trigger_received_at NULLS LAST',
    [transcript.id]
  )
  const executedActions: PromptExecutedAction[] = firedRows.map((r: any) => ({
    ghlActionId: r.ghl_action_id,
    actionType: r.action_type,
    actionName: r.action_name,
  }))

  return {
    agentScript,
    turns: transcript.turns,
    kpiGoals: kpiConfig.goals,
    actions,
    executedActions,
  }
}
