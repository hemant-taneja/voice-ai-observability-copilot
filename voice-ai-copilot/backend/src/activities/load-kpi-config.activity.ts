import { KpiService, KpiConfig } from '../services/kpi-service'

const kpiService = new KpiService()

export async function loadKpiConfig(agentId: string): Promise<KpiConfig> {
  const config = await kpiService.getConfig(agentId)
  if (!config) throw new Error(`No KPI config for agent: ${agentId}`)
  return config
}
