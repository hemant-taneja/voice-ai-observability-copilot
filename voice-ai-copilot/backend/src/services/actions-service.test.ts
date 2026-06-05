// Set env vars before any module imports that load config
process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5433/voice_copilot_test'
process.env.REDIS_URL = 'redis://localhost:6379'
process.env.TEMPORAL_ADDRESS = 'localhost:7233'
process.env.GHL_WEBHOOK_SECRET = 'test'
process.env.LLM_PROVIDER = 'openai'
process.env.OPENAI_API_KEY = 'sk-test'
process.env.NODE_ENV = 'test'

import { ActionsService } from './actions-service'
import { Database } from '../db/index'
import { GHLAction } from '../types/ghl.types'

const mockDb = (): jest.Mocked<Partial<Database>> => ({
  query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
})

const sqlOf = (db: jest.Mocked<Partial<Database>>): string[] =>
  (db.query as jest.Mock).mock.calls.map((c) => String(c[0]))

const paramsOf = (db: jest.Mocked<Partial<Database>>): unknown[][] =>
  (db.query as jest.Mock).mock.calls.map((c) => c[1] as unknown[])

describe('ActionsService.upsertFromGHL', () => {
  it('upserts every action and pulls triggerPrompt from actionParameters', async () => {
    const db = mockDb()
    const service = new ActionsService(db as Database)

    const actions: GHLAction[] = [
      { id: 'act-1', name: 'Send SMS', actionType: 'SMS', actionParameters: { triggerPrompt: 'When booked', triggerMessage: 'Texted you' } },
      { id: 'act-2', name: 'Book', actionType: 'APPOINTMENT_BOOKING' },
    ]
    const count = await service.upsertFromGHL('agent-uuid', actions)

    expect(count).toBe(2)
    const inserts = sqlOf(db).filter((s) => /INSERT INTO agent_actions/i.test(s))
    expect(inserts).toHaveLength(2)
    // trigger_prompt is param index 4 (0-based) in the insert
    expect(paramsOf(db)[0][4]).toBe('When booked')
    expect(paramsOf(db)[1][4]).toBeNull()
  })

  it('skips actions without an id and never issues a DELETE', async () => {
    const db = mockDb()
    const service = new ActionsService(db as Database)

    const count = await service.upsertFromGHL('agent-uuid', [
      { id: '', name: 'No id', actionType: 'SMS' } as GHLAction,
    ])

    expect(count).toBe(1) // returns the input length
    expect(sqlOf(db).filter((s) => /INSERT INTO agent_actions/i.test(s))).toHaveLength(0)
    expect(sqlOf(db).filter((s) => /DELETE/i.test(s))).toHaveLength(0)
  })
})

describe('ActionsService.getAnalytics', () => {
  it('maps rollup rows into ActionAnalytics', async () => {
    const db = mockDb()
    ;(db.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [{ id: 'agent-uuid' }] }) // agent ownership check
      .mockResolvedValueOnce({
        rows: [
          {
            ghl_action_id: 'act-2',
            action_type: 'SMS',
            name: 'Send Confirmation SMS',
            trigger_prompt: 'After booking',
            fire_count: '0',
            missed_count: '1',
            incorrect_count: '0',
            latest_prompt_flaw: 'too vague',
            latest_suggested_trigger_prompt: 'be specific',
          },
        ],
      })

    const service = new ActionsService(db as Database)
    const result = await service.getAnalytics('agent-uuid', 'loc-1')

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      actionType: 'SMS',
      fireCount: 0,
      missedCount: 1,
      incorrectCount: 0,
      latestPromptFlaw: 'too vague',
    })
  })

  it('returns [] when the agent does not belong to the location', async () => {
    const db = mockDb()
    ;(db.query as jest.Mock).mockResolvedValueOnce({ rows: [] })
    const service = new ActionsService(db as Database)
    expect(await service.getAnalytics('agent-uuid', 'loc-1')).toEqual([])
  })
})
