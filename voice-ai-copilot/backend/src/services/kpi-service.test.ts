import { KpiService } from './kpi-service'
import { Database } from '../db/index'
import { KpiGoal } from '../types/analysis.types'

const mockDb = (): jest.Mocked<Partial<Database>> => ({
  query: jest.fn(),
})

const goals: KpiGoal[] = [
  { name: 'Book Appointment', description: 'Confirm a slot', weight: 0.6 },
  { name: 'Handle Objection', description: 'Address concerns', weight: 0.4 },
]

describe('KpiService', () => {
  it('returns kpi config for a known agentId', async () => {
    const db = mockDb()
    ;(db.query as jest.Mock).mockResolvedValue({
      rows: [{ id: 'kpi-1', agent_id: 'ag-1', goals, success_threshold: '0.70', updated_at: new Date() }],
    })
    const service = new KpiService(db as Database)
    const config = await service.getConfig('ag-1')
    expect(config).not.toBeNull()
    expect(config!.goals).toHaveLength(2)
    expect(config!.successThreshold).toBe(0.7)
  })

  it('returns null when no config exists', async () => {
    const db = mockDb()
    ;(db.query as jest.Mock).mockResolvedValue({ rows: [] })
    const service = new KpiService(db as Database)
    const config = await service.getConfig('ag-unknown')
    expect(config).toBeNull()
  })

  it('upserts a kpi config', async () => {
    const db = mockDb()
    ;(db.query as jest.Mock).mockResolvedValue({ rows: [{ id: 'kpi-1' }] })
    const service = new KpiService(db as Database)
    await service.upsertConfig('ag-1', goals, 0.75)
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO kpi_configs'),
      expect.arrayContaining(['ag-1', 0.75])
    )
  })
})
