import { db as defaultDb, Database } from '../db/index'
import { GHLClient } from '../lib/ghl-client'
import { GHLAction } from '../types/ghl.types'

export interface ActionAnalytics {
  ghlActionId: string | null
  actionType: string
  name: string
  triggerPrompt: string | null
  fireCount: number
  missedCount: number
  incorrectCount: number
  latestPromptFlaw: string | null
  latestSuggestedTriggerPrompt: string | null
}

export class ActionsService {
  constructor(private readonly database: Database = defaultDb) {}

  // Upsert the action DEFINITIONS for a single agent (internal UUID).
  // Non-destructive: actions absent from the GHL response are not deleted —
  // absence is unreliable (scope/pagination/transient errors), mirroring the
  // rationale in AgentsService.upsertFromGHL.
  async upsertFromGHL(agentUuid: string, ghlActions: GHLAction[]): Promise<number> {
    for (const action of ghlActions) {
      if (!action.id) continue
      const params = action.actionParameters ?? {}
      await this.database.query(
        `INSERT INTO agent_actions
           (agent_id, ghl_action_id, action_type, name, trigger_prompt, trigger_message, parameters)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (agent_id, ghl_action_id) DO UPDATE
         SET action_type     = EXCLUDED.action_type,
             name            = EXCLUDED.name,
             trigger_prompt  = EXCLUDED.trigger_prompt,
             trigger_message = EXCLUDED.trigger_message,
             parameters      = EXCLUDED.parameters,
             updated_at      = NOW()`,
        [
          agentUuid,
          action.id,
          action.actionType,
          action.name,
          params.triggerPrompt ?? null,
          params.triggerMessage ?? null,
          JSON.stringify(params),
        ]
      )
    }
    return ghlActions.length
  }

  // Orchestrates action-definition sync for every agent in a location. One
  // agent's fetch failure logs { locationId, agentId, endpoint } and is skipped
  // — it never aborts the whole sync.
  async syncFromGHL(locationId: string, ghlClient: GHLClient): Promise<number> {
    const { rows } = await this.database.query(
      'SELECT id, ghl_agent_id FROM agents WHERE location_id = $1',
      [locationId]
    )
    let total = 0
    for (const row of rows as Array<{ id: string; ghl_agent_id: string }>) {
      try {
        const actions = await ghlClient.getAgentActions(locationId, row.ghl_agent_id)
        total += await this.upsertFromGHL(row.id, actions)
      } catch (err) {
        console.warn('[actions/sync] failed to sync actions', {
          locationId,
          agentId: row.ghl_agent_id,
          endpoint: `/voice-ai/agents/${row.ghl_agent_id}/actions`,
          error: (err as Error).message,
        })
      }
    }
    return total
  }

  // Per-agent rollup for the actions analytics panel. Joins each synced action
  // definition to its fires (transcript_actions) and its latest findings.
  async getAnalytics(agentId: string, locationId: string): Promise<ActionAnalytics[]> {
    const { rows: agentRows } = await this.database.query(
      'SELECT id FROM agents WHERE id = $1 AND location_id = $2',
      [agentId, locationId]
    )
    if (!agentRows[0]) return []

    const { rows } = await this.database.query(
      `SELECT
         aa.ghl_action_id,
         aa.action_type,
         aa.name,
         aa.trigger_prompt,
         COALESCE(fires.fire_count, 0)      AS fire_count,
         COALESCE(find.missed_count, 0)     AS missed_count,
         COALESCE(find.incorrect_count, 0)  AS incorrect_count,
         find.latest_prompt_flaw,
         find.latest_suggested_trigger_prompt
       FROM agent_actions aa
       LEFT JOIN (
         SELECT ta.ghl_action_id, COUNT(*) AS fire_count
         FROM transcript_actions ta
         JOIN transcripts t ON t.id = ta.transcript_id
         WHERE t.agent_id = $1
         GROUP BY ta.ghl_action_id
       ) fires ON fires.ghl_action_id = aa.ghl_action_id
       LEFT JOIN (
         SELECT
           af.ghl_action_id,
           COUNT(*) FILTER (WHERE af.status = 'missed')    AS missed_count,
           COUNT(*) FILTER (WHERE af.status = 'incorrect') AS incorrect_count,
           (array_agg(af.prompt_flaw ORDER BY af.created_at DESC)
              FILTER (WHERE af.prompt_flaw IS NOT NULL))[1] AS latest_prompt_flaw,
           (array_agg(af.suggested_trigger_prompt ORDER BY af.created_at DESC)
              FILTER (WHERE af.suggested_trigger_prompt IS NOT NULL))[1] AS latest_suggested_trigger_prompt
         FROM action_findings af
         JOIN analysis_results ar ON ar.id = af.analysis_id
         JOIN transcripts t ON t.id = ar.transcript_id
         WHERE t.agent_id = $1
         GROUP BY af.ghl_action_id
       ) find ON find.ghl_action_id = aa.ghl_action_id
       WHERE aa.agent_id = $1
       ORDER BY aa.name`,
      [agentId]
    )

    return rows.map((row: any) => ({
      ghlActionId: row.ghl_action_id,
      actionType: row.action_type,
      name: row.name,
      triggerPrompt: row.trigger_prompt ?? null,
      fireCount: parseInt(row.fire_count, 10) || 0,
      missedCount: parseInt(row.missed_count, 10) || 0,
      incorrectCount: parseInt(row.incorrect_count, 10) || 0,
      latestPromptFlaw: row.latest_prompt_flaw ?? null,
      latestSuggestedTriggerPrompt: row.latest_suggested_trigger_prompt ?? null,
    }))
  }
}
