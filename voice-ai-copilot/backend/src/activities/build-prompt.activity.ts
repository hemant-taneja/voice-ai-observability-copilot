import { db } from '../db/index'
import { AnalysisPrompt } from '../types/llm.types'
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
  return {
    agentScript,
    turns: transcript.turns,
    kpiGoals: kpiConfig.goals,
  }
}
