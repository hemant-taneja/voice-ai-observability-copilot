/**
 * Demo Reset Script
 *
 * Clears all call transcripts and analysis results for the demo location
 * (loc-seed-1) so simulations can be run fresh for a clean demo.
 *
 * Agents, KPI configs, and the location itself are preserved so you can
 * immediately re-run simulations without re-seeding.
 *
 * Usage:
 *   npm run reset-demo
 *   # or in production Docker:
 *   docker compose exec app node dist/scripts/reset-demo.js
 */

import { Pool } from 'pg'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.join(__dirname, '../../../.env') })

const LOCATION_ID = process.env.SIMULATE_LOCATION_ID ?? 'loc-seed-1'
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

async function resetDemo() {
  const client = await pool.connect()
  try {
    // ── Show current state ────────────────────────────────────
    const before = await client.query<{ transcripts: string; analyses: string; use_actions: string }>(`
      SELECT
        (SELECT COUNT(*) FROM transcripts       WHERE location_id = $1)                           AS transcripts,
        (SELECT COUNT(*) FROM analysis_results  WHERE transcript_id IN
          (SELECT id FROM transcripts WHERE location_id = $1))                                    AS analyses,
        (SELECT COUNT(*) FROM use_actions WHERE analysis_id IN
          (SELECT ar.id FROM analysis_results ar
           JOIN transcripts t ON t.id = ar.transcript_id
           WHERE t.location_id = $1))                                                             AS use_actions
    `, [LOCATION_ID])

    const { transcripts, analyses, use_actions } = before.rows[0]
    console.log(`\nDemo reset for location: ${LOCATION_ID}`)
    console.log('─'.repeat(40))
    console.log(`  Before: ${transcripts} transcripts  |  ${analyses} analyses  |  ${use_actions} USE actions`)

    if (Number(transcripts) === 0) {
      console.log('\n  Nothing to clear — demo is already clean.')
      console.log('  Run: docker compose exec app node dist/scripts/simulate-webhook.js all\n')
      return
    }

    // ── Delete (cascades to analysis_results → use_actions) ──
    await client.query(`DELETE FROM transcripts WHERE location_id = $1`, [LOCATION_ID])

    console.log(`  After:  0 transcripts  |  0 analyses  |  0 USE actions`)
    console.log('\n  ✓ Demo data cleared. Agents and KPI configs are intact.')
    console.log('  Run: docker compose exec app node dist/scripts/simulate-webhook.js all\n')

  } finally {
    client.release()
    await pool.end()
  }
}

resetDemo().catch((err) => {
  console.error('Reset failed:', err)
  process.exit(1)
})
