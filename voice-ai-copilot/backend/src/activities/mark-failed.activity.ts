import { db } from '../db/index'

export async function markTranscriptFailed(transcriptId: string): Promise<void> {
  await db.query(
    `UPDATE transcripts SET status = 'analysis_failed' WHERE id = $1`,
    [transcriptId]
  )
}
