import { db as defaultDb, Database } from '../db/index'
import { GHLCallCompletedPayload } from '../types/ghl.types'

export interface IngestResult {
  id: string
  kpiConfigId: string | null
  isNew: boolean
}

export class TranscriptService {
  constructor(private readonly database: Database = defaultDb) {}

  async ingest(payload: GHLCallCompletedPayload): Promise<IngestResult> {
    // Idempotency check — ghl_call_id is UNIQUE
    const existing = await this.database.query(
      'SELECT id FROM transcripts WHERE ghl_call_id = $1',
      [payload.callId]
    )
    if (existing.rows[0]) {
      const kpiConfigRow = await this.database.query(
        `SELECT kc.id FROM kpi_configs kc
         JOIN agents a ON a.id = kc.agent_id
         WHERE a.ghl_agent_id = $1 AND a.location_id = $2`,
        [payload.agentId, payload.locationId]
      )
      return {
        id: existing.rows[0].id,
        kpiConfigId: kpiConfigRow.rows[0]?.id ?? null,
        isNew: false,
      }
    }

    const { rows } = await this.database.query(
      `INSERT INTO transcripts
         (agent_id, location_id, ghl_call_id, caller_phone, duration_seconds, turns, raw_payload, status)
       VALUES (
         (SELECT id FROM agents WHERE ghl_agent_id = $1 AND location_id = $2),
         $2, $3, $4, $5, $6, $7, 'pending'
       )
       RETURNING id`,
      [
        payload.agentId,
        payload.locationId,
        payload.callId,
        payload.callerPhone ?? null,
        payload.durationSeconds ?? null,
        JSON.stringify(payload.turns),
        JSON.stringify(payload),
      ]
    )

    const transcriptId = rows[0].id

    // Persist the deterministic record of which actions (tools) fired during the
    // call. These arrive inside the VoiceAiCallEnd webhook's executedCallActions.
    await this.insertExecutedActions(transcriptId, payload)

    const kpiConfigRow = await this.database.query(
      `SELECT kc.id FROM kpi_configs kc
       JOIN agents a ON a.id = kc.agent_id
       WHERE a.ghl_agent_id = $1 AND a.location_id = $2`,
      [payload.agentId, payload.locationId]
    )

    return {
      id: transcriptId,
      kpiConfigId: kpiConfigRow.rows[0]?.id ?? null,
      isNew: true,
    }
  }

  private async insertExecutedActions(
    transcriptId: string,
    payload: GHLCallCompletedPayload
  ): Promise<void> {
    const actions = payload.executedCallActions ?? []
    console.log('[transcript-service] persisting executed actions', {
      transcriptId,
      count: actions.length,
      types: actions.map(a => a.actionType),
    })
    for (const action of actions) {
      await this.database.query(
        `INSERT INTO transcript_actions
           (transcript_id, ghl_action_id, action_type, action_name, parameters, executed_at, trigger_received_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          transcriptId,
          // GHL's live webhook uses "actionId"; "_id" is the documented/legacy
          // name. This id must equal agent_actions.ghl_action_id so findings and
          // the analytics fireCount can link back to the synced definition.
          action.actionId ?? action._id ?? null,
          action.actionType,
          action.actionName,
          JSON.stringify(action.actionParameters ?? {}),
          action.executedAt ?? null,
          action.triggerReceivedAt ?? null,
        ]
      )
    }
  }
}
