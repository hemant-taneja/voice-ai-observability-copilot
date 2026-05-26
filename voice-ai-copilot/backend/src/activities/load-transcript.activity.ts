import { db } from '../db/index'
import { GHLTranscriptTurn } from '../types/ghl.types'

export interface TranscriptRow {
  id: string
  agentId: string
  locationId: string
  turns: GHLTranscriptTurn[]
  durationSeconds: number | null
}

export async function loadTranscript(transcriptId: string): Promise<TranscriptRow> {
  const { rows } = await db.query(
    'SELECT id, agent_id, location_id, turns, duration_seconds FROM transcripts WHERE id = $1',
    [transcriptId]
  )
  if (!rows[0]) throw new Error(`Transcript not found: ${transcriptId}`)
  const row = rows[0]
  return {
    id: row.id,
    agentId: row.agent_id,
    locationId: row.location_id,
    turns: row.turns as GHLTranscriptTurn[],
    durationSeconds: row.duration_seconds,
  }
}
