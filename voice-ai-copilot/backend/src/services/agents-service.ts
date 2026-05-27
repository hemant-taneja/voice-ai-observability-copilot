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
  script: string | null
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
         COUNT(DISTINCT t.id)  AS total_calls,
         COUNT(DISTINCT ar.id) AS analyzed_calls,
         AVG(ar.overall_score) AS avg_score,
         AVG(CASE WHEN ar.passed THEN 1.0 ELSE 0.0 END) AS pass_rate,
         COUNT(DISTINCT ua.id) AS open_use_actions
       FROM agents a
       LEFT JOIN transcripts t  ON t.agent_id = a.id
       LEFT JOIN analysis_results ar ON ar.transcript_id = t.id
       LEFT JOIN use_actions ua ON ua.analysis_id = ar.id
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
        openUseActions: parseInt(row.open_use_actions, 10) || 0,
      }
    })
  }

  async getAnalyses(agentId: string, locationId: string): Promise<object[]> {
    const { rows: agentRows } = await this.database.query(
      'SELECT id FROM agents WHERE id = $1 AND location_id = $2',
      [agentId, locationId]
    )
    if (!agentRows[0]) return []

    // One row per transcript, analyses aggregated as a JSON array sorted latest-first
    const { rows } = await this.database.query(
      `SELECT
         t.id          AS transcript_id,
         t.ghl_call_id,
         t.status,
         t.duration_seconds,
         t.ingested_at,
         t.turns,
         COALESCE(
           json_agg(
             json_build_object(
               'id',               ar.id,
               'overallScore',     ar.overall_score,
               'passed',           ar.passed,
               'kpiScores',        ar.kpi_scores,
               'summary',          ar.summary,
               'analyzedAt',       ar.analyzed_at,
               'scriptSuggestions', ar.script_suggestions,
               'useActions', (
                 SELECT COALESCE(json_agg(
                   json_build_object(
                     'id',                  ua.id,
                     'type',                ua.type,
                     'description',         ua.description,
                     'transcriptTurnIndex', ua.transcript_turn_index
                   )
                 ), '[]'::json)
                 FROM use_actions ua WHERE ua.analysis_id = ar.id
               )
             ) ORDER BY ar.analyzed_at DESC
           ) FILTER (WHERE ar.id IS NOT NULL),
           '[]'::json
         ) AS analyses
       FROM transcripts t
       LEFT JOIN analysis_results ar ON ar.transcript_id = t.id
       WHERE t.agent_id = $1
       GROUP BY t.id
       ORDER BY t.ingested_at DESC
       LIMIT 50`,
      [agentId]
    )

    return rows.map((row: any) => ({
      transcriptId: row.transcript_id,
      ghlCallId: row.ghl_call_id,
      transcriptStatus: row.status,
      durationSeconds: row.duration_seconds ?? null,
      ingestedAt: row.ingested_at,
      turns: row.turns ?? [],
      analyses: (row.analyses ?? []).map((a: any) => ({
        id: a.id,
        overallScore: a.overallScore != null ? parseFloat(a.overallScore) : null,
        passed: a.passed,
        kpiScores: a.kpiScores ?? [],
        summary: a.summary,
        analyzedAt: a.analyzedAt,
        scriptSuggestions: a.scriptSuggestions ?? [],
        useActions: a.useActions ?? [],
      })),
    }))
  }

  async reanalyzeTranscript(agentId: string, transcriptId: string, locationId: string): Promise<{ kpiConfigId: string; ghlAgentId: string }> {
    // Verify the transcript belongs to this agent/location and fetch ghl_agent_id
    const { rows } = await this.database.query(
      `SELECT t.id, a.ghl_agent_id
       FROM transcripts t
       JOIN agents a ON a.id = t.agent_id
       WHERE t.id = $1 AND a.id = $2 AND a.location_id = $3`,
      [transcriptId, agentId, locationId]
    )
    if (!rows[0]) throw new Error('Transcript not found')

    const ghlAgentId: string = rows[0].ghl_agent_id

    // Get current KPI config for the agent (always use latest, not snapshot)
    const { rows: kpiRows } = await this.database.query(
      'SELECT id FROM kpi_configs WHERE agent_id = $1',
      [agentId]
    )
    if (!kpiRows[0]) throw new Error('No KPI config for this agent')

    const kpiConfigId: string = kpiRows[0].id

    // Reset transcript status to pending so it can be re-processed
    await this.database.query(
      `UPDATE transcripts SET status = 'pending' WHERE id = $1`,
      [transcriptId]
    )

    return { kpiConfigId, ghlAgentId }
  }

  async upsertFromGHL(locationId: string, ghlAgents: Array<Record<string, unknown>>): Promise<number> {
    for (const agent of ghlAgents) {
      const id     = (agent.id ?? agent.agentId ?? agent._id) as string
      const name   = (agent.name ?? agent.agentName ?? agent.title ?? agent.label ?? 'Unnamed Agent') as string
      const script = (agent.script ?? agent.prompt ?? agent.systemPrompt ?? agent.voicePrompt ?? null) as string | null
      await this.database.query(
        `INSERT INTO agents (location_id, ghl_agent_id, name, script)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (location_id, ghl_agent_id) DO UPDATE
         SET name = EXCLUDED.name,
             script = COALESCE(EXCLUDED.script, agents.script),
             updated_at = NOW()`,
        [locationId, id, name, script]
      )
    }
    return ghlAgents.length
  }

  async updateScript(agentId: string, locationId: string, script: string): Promise<void> {
    const { rowCount } = await this.database.query(
      'UPDATE agents SET script = $1, updated_at = NOW() WHERE id = $2 AND location_id = $3',
      [script, agentId, locationId]
    )
    if (!rowCount) throw new Error('Agent not found')
  }

  async getDetail(agentId: string, locationId: string): Promise<AgentDetail | null> {
    const { rows: agentRows } = await this.database.query(
      'SELECT id, ghl_agent_id, name, script FROM agents WHERE id = $1 AND location_id = $2',
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
         ar.kpi_scores,
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
      script: agent.script ?? null,
      recentAnalyses: analysisRows.map((row: any) => ({
        transcriptId: row.transcript_id,
        callId: row.ghl_call_id,
        analyzedAt: row.analyzed_at,
        overallScore: parseFloat(row.overall_score),
        passed: row.passed,
        kpiScores: row.kpi_scores ?? [],
        summary: row.summary,
        useActions: row.use_actions ?? [],
      })),
    }
  }
}
