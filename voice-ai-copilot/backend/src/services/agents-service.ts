import { db as defaultDb, Database } from '../db/index'

export interface AgentSummary {
  id: string
  ghlAgentId: string
  name: string
  totalCalls: number
  analyzedCalls: number
  passRate: number | null
  avgScore: number | null
}

export interface AgentDetail {
  id: string
  ghlAgentId: string
  name: string
  recentAnalyses: Array<{
    transcriptId: string
    callId: string
    analyzedAt: Date
    overallScore: number
    passed: boolean
    summary: string
    useActions: Array<{ type: string; description: string; turnIndex: number }>
  }>
}

export class AgentsService {
  constructor(private readonly database: Database = defaultDb) {}

  async listByLocation(locationId: string): Promise<AgentSummary[]> {
    const { rows } = await this.database.query(
      `SELECT
         a.id,
         a.ghl_agent_id,
         a.name,
         COUNT(t.id) AS total_calls,
         COUNT(ar.id) AS analyzed_calls,
         AVG(ar.overall_score) AS avg_score,
         AVG(CASE WHEN ar.passed THEN 1.0 ELSE 0.0 END) AS pass_rate
       FROM agents a
       LEFT JOIN transcripts t ON t.agent_id = a.id
       LEFT JOIN analysis_results ar ON ar.transcript_id = t.id
       WHERE a.location_id = $1
       GROUP BY a.id, a.ghl_agent_id, a.name
       ORDER BY a.name`,
      [locationId]
    )

    return rows.map((row: any) => {
      const analyzedCalls = parseInt(row.analyzed_calls, 10)
      return {
        id: row.id,
        ghlAgentId: row.ghl_agent_id,
        name: row.name,
        totalCalls: parseInt(row.total_calls, 10),
        analyzedCalls,
        avgScore: analyzedCalls > 0 && row.avg_score != null ? parseFloat(row.avg_score) : null,
        passRate: analyzedCalls > 0 && row.pass_rate != null ? parseFloat(row.pass_rate) : null,
      }
    })
  }

  async getDetail(agentId: string, locationId: string): Promise<AgentDetail | null> {
    const { rows: agentRows } = await this.database.query(
      'SELECT id, ghl_agent_id, name FROM agents WHERE id = $1 AND location_id = $2',
      [agentId, locationId]
    )

    if (!agentRows[0]) return null

    const agent = agentRows[0] as any

    const { rows: analysisRows } = await this.database.query(
      `SELECT
         t.id AS transcript_id,
         t.ghl_call_id,
         ar.overall_score,
         ar.passed,
         ar.summary,
         ar.analyzed_at,
         (
           SELECT json_agg(json_build_object('type', ua.type, 'description', ua.description, 'turnIndex', ua.transcript_turn_index))
           FROM use_actions ua WHERE ua.analysis_id = ar.id
         ) AS use_actions
       FROM analysis_results ar
       JOIN transcripts t ON t.id = ar.transcript_id
       WHERE t.agent_id = $1
       ORDER BY ar.analyzed_at DESC
       LIMIT 10`,
      [agentId]
    )

    return {
      id: agent.id,
      ghlAgentId: agent.ghl_agent_id,
      name: agent.name,
      recentAnalyses: analysisRows.map((row: any) => ({
        transcriptId: row.transcript_id,
        callId: row.ghl_call_id,
        analyzedAt: row.analyzed_at,
        overallScore: parseFloat(row.overall_score),
        passed: row.passed,
        summary: row.summary,
        useActions: row.use_actions ?? [],
      })),
    }
  }
}
