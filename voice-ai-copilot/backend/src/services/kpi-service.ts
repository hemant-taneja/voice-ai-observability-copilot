import { db as defaultDb, Database } from '../db/index'
import { KpiGoal } from '../types/analysis.types'

interface KpiConfigRow extends Record<string, any> {
  agent_id: string
  goals: KpiGoal[]
  pass_threshold: number
  updated_at: Date
}

export class KpiService {
  constructor(private readonly database: Database = defaultDb) {}

  async getConfig(agentId: string): Promise<{ goals: KpiGoal[]; passThreshold: number } | null> {
    const { rows } = await this.database.query<KpiConfigRow>(
      'SELECT goals, pass_threshold FROM kpi_configs WHERE agent_id = $1',
      [agentId]
    )
    if (!rows[0]) return null
    return { goals: rows[0].goals, passThreshold: rows[0].pass_threshold }
  }

  async upsertConfig(
    agentId: string,
    goals: KpiGoal[],
    passThreshold: number
  ): Promise<void> {
    await this.database.query(
      `INSERT INTO kpi_configs (agent_id, goals, pass_threshold)
       VALUES ($1, $2, $3)
       ON CONFLICT (agent_id)
       DO UPDATE SET goals = EXCLUDED.goals,
                     pass_threshold = EXCLUDED.pass_threshold,
                     updated_at = now()`,
      [agentId, JSON.stringify(goals), passThreshold]
    )
  }
}
