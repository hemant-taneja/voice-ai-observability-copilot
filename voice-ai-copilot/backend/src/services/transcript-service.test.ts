// Set env vars before any module imports that load config
process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5433/voice_copilot_test'
process.env.REDIS_URL = 'redis://localhost:6379'
process.env.TEMPORAL_ADDRESS = 'localhost:7233'
process.env.GHL_WEBHOOK_SECRET = 'test'
process.env.LLM_PROVIDER = 'openai'
process.env.OPENAI_API_KEY = 'sk-test'
process.env.NODE_ENV = 'test'

import { TranscriptService } from './transcript-service'
import { Database } from '../db/index'
import { GHLCallCompletedPayload } from '../types/ghl.types'

// Route each query by the SQL it runs so ingest() gets coherent results
// regardless of call order.
function routedDb(): jest.Mocked<Partial<Database>> {
  const query = jest.fn().mockImplementation((sql: string) => {
    if (/SELECT id FROM transcripts WHERE ghl_call_id/i.test(sql)) return Promise.resolve({ rows: [] })
    if (/INSERT INTO transcripts/i.test(sql)) return Promise.resolve({ rows: [{ id: 'tr-1' }] })
    if (/INSERT INTO transcript_actions/i.test(sql)) return Promise.resolve({ rows: [] })
    if (/kpi_configs/i.test(sql)) return Promise.resolve({ rows: [{ id: 'kpi-1' }] })
    return Promise.resolve({ rows: [] })
  })
  return { query }
}

const sqlOf = (db: jest.Mocked<Partial<Database>>): string[] =>
  (db.query as jest.Mock).mock.calls.map((c) => String(c[0]))

const basePayload = (extra: Partial<GHLCallCompletedPayload> = {}): GHLCallCompletedPayload => ({
  callId: 'call-1',
  locationId: 'loc-1',
  agentId: 'ghl-ag-1',
  turns: [{ speaker: 'agent', text: 'Hi', timestamp_ms: 0 }],
  ...extra,
})

describe('TranscriptService.ingest — executedCallActions', () => {
  it('persists one transcript_actions row per executed action', async () => {
    const db = routedDb()
    const service = new TranscriptService(db as Database)

    const result = await service.ingest(basePayload({
      createdAt: '2026-06-05T10:00:00.000Z',
      executedCallActions: [
        { _id: 'x1', actionType: 'APPOINTMENT_BOOKING', actionName: 'Book', executedAt: '2026-06-05T10:00:30.000Z', triggerReceivedAt: '2026-06-05T10:00:29.000Z' },
        { _id: 'x2', actionType: 'SMS', actionName: 'Send SMS' },
      ],
    }))

    expect(result.isNew).toBe(true)
    const inserts = sqlOf(db).filter((s) => /INSERT INTO transcript_actions/i.test(s))
    expect(inserts).toHaveLength(2)
    // action_type / action_name are params 2 and 3
    const firstParams = (db.query as jest.Mock).mock.calls.find((c) => /transcript_actions/i.test(String(c[0])))![1]
    expect(firstParams[0]).toBe('tr-1')
    expect(firstParams[2]).toBe('APPOINTMENT_BOOKING')
  })

  it('inserts no transcript_actions when the payload carries none', async () => {
    const db = routedDb()
    const service = new TranscriptService(db as Database)

    await service.ingest(basePayload())

    expect(sqlOf(db).filter((s) => /INSERT INTO transcript_actions/i.test(s))).toHaveLength(0)
  })

  it('does not insert actions for a duplicate (already-ingested) call', async () => {
    const db = routedDb()
    ;(db.query as jest.Mock).mockImplementation((sql: string) => {
      if (/SELECT id FROM transcripts WHERE ghl_call_id/i.test(sql)) return Promise.resolve({ rows: [{ id: 'existing' }] })
      if (/kpi_configs/i.test(sql)) return Promise.resolve({ rows: [{ id: 'kpi-1' }] })
      return Promise.resolve({ rows: [] })
    })
    const service = new TranscriptService(db as Database)

    const result = await service.ingest(basePayload({
      executedCallActions: [{ actionType: 'SMS', actionName: 'Send SMS' }],
    }))

    expect(result.isNew).toBe(false)
    expect(sqlOf(db).filter((s) => /INSERT INTO transcript_actions/i.test(s))).toHaveLength(0)
  })
})
