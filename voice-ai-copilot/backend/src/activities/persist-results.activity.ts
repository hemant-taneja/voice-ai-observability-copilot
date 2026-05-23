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

    const { rows } = await client.query(
      `INSERT INTO analysis_results
         (transcript_id, kpi_config_id, overall_score, passed, kpi_scores, summary, llm_provider, llm_model)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        job.transcriptId,
        job.kpiConfigId,
        output.overallScore,
        output.passed,
        JSON.stringify(output.kpiScores),
        output.summary,
        output.provider,
        output.model,
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
