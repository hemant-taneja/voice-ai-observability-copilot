import { db } from '../db/index'
import { AnalysisOutput } from '../types/llm.types'
import { AnalysisJobData } from '../types/analysis.types'

export async function persistResults(
  output: AnalysisOutput & { provider: string; model: string },
  job: AnalysisJobData
): Promise<string> {
  const client = await db.getClient()
  try {
    await client.query('BEGIN')

    // Load KPI config to compute the score deterministically — never trust LLM's overallScore
    const { rows: configRows } = await client.query(
      'SELECT goals, success_threshold FROM kpi_configs WHERE id = $1',
      [job.kpiConfigId]
    )
    const goals: Array<{ name: string; weight: number }> = configRows[0]?.goals ?? []
    const threshold: number = Number(configRows[0]?.success_threshold ?? 0.7)

    const totalWeight = goals.reduce((s, g) => s + g.weight, 0) || 1
    const overallScore = output.kpiScores.reduce((sum, kpi) => {
      const goal = goals.find((g) => g.name === kpi.goal)
      const weight = goal ? goal.weight / totalWeight : 1 / output.kpiScores.length
      return sum + kpi.score * weight
    }, 0)
    const passed = overallScore >= threshold

    const { rows } = await client.query(
      `INSERT INTO analysis_results
         (transcript_id, kpi_config_id, overall_score, passed, kpi_scores, summary, llm_provider, llm_model, script_suggestions)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        job.transcriptId,
        job.kpiConfigId,
        Math.min(1, Math.max(0, overallScore)),
        passed,
        JSON.stringify(output.kpiScores),
        output.summary,
        output.provider,
        output.model,
        JSON.stringify(output.scriptSuggestions ?? []),
      ]
    )

    const analysisId = rows[0].id

    for (const ua of output.useActions) {
      await client.query(
        `INSERT INTO use_actions (analysis_id, transcript_turn_index, type, description)
         VALUES ($1, $2, $3, $4)`,
        [analysisId, ua.transcriptTurnIndex, ua.type, ua.description]
      )
    }

    await client.query(
      `UPDATE transcripts SET status = 'analyzed' WHERE id = $1`,
      [job.transcriptId]
    )

    await client.query('COMMIT')
    return analysisId
  } catch (err) {
    await client.query('ROLLBACK')
    await db.query(
      `UPDATE transcripts SET status = 'analysis_failed' WHERE id = $1`,
      [job.transcriptId]
    )
    throw err
  } finally {
    client.release()
  }
}
