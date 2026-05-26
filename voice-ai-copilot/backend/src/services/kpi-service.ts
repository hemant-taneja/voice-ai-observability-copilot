import { db as defaultDb, Database } from '../db/index'
import { KpiGoal } from '../types/analysis.types'

export interface KpiConfig {
  id: string
  agentId: string
  goals: KpiGoal[]
  successThreshold: number
  updatedAt: Date
}

export class KpiService {
  constructor(private readonly database: Database = defaultDb) {}

  async getConfig(agentId: string): Promise<KpiConfig | null> {
    const { rows } = await this.database.query(
      'SELECT id, agent_id, goals, success_threshold, updated_at FROM kpi_configs WHERE agent_id = $1',
      [agentId]
    )
    if (!rows[0]) return null
    const row = rows[0]
    return {
      id: row.id,
      agentId: row.agent_id,
      goals: row.goals as KpiGoal[],
      successThreshold: parseFloat(row.success_threshold),
      updatedAt: row.updated_at,
    }
  }

  async getConfigById(id: string): Promise<KpiConfig | null> {
    const { rows } = await this.database.query(
      'SELECT id, agent_id, goals, success_threshold, updated_at FROM kpi_configs WHERE id = $1',
      [id]
    )
    if (!rows[0]) return null
    const row = rows[0]
    return {
      id: row.id,
      agentId: row.agent_id,
      goals: row.goals as KpiGoal[],
      successThreshold: parseFloat(row.success_threshold),
      updatedAt: row.updated_at,
    }
  }

  async upsertConfig(agentId: string, goals: KpiGoal[], successThreshold: number): Promise<KpiConfig> {
    const { rows } = await this.database.query(
      `INSERT INTO kpi_configs (agent_id, goals, success_threshold)
       VALUES ($1, $2, $3)
       ON CONFLICT (agent_id)
       DO UPDATE SET goals = $2, success_threshold = $3, updated_at = NOW()
       RETURNING id, agent_id, goals, success_threshold, updated_at`,
      [agentId, JSON.stringify(goals), successThreshold]
    )
    const row = rows[0]
    return {
      id: row.id,
      agentId: row.agent_id,
      goals: row.goals as KpiGoal[],
      successThreshold: parseFloat(row.success_threshold),
      updatedAt: row.updated_at,
    }
  }
}
