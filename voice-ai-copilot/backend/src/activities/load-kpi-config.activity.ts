import { KpiService, KpiConfig } from '../services/kpi-service'

const kpiService = new KpiService()

export async function loadKpiConfig(kpiConfigId: string): Promise<KpiConfig> {
  const config = await kpiService.getConfigById(kpiConfigId)
  if (!config) throw new Error(`No KPI config found: ${kpiConfigId}`)
  return config
}
