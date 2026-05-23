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

    const kpiConfigRow = await this.database.query(
      `SELECT kc.id FROM kpi_configs kc
       JOIN agents a ON a.id = kc.agent_id
       WHERE a.ghl_agent_id = $1 AND a.location_id = $2`,
      [payload.agentId, payload.locationId]
    )

    return {
      id: rows[0].id,
      kpiConfigId: kpiConfigRow.rows[0]?.id ?? null,
      isNew: true,
    }
  }
}
