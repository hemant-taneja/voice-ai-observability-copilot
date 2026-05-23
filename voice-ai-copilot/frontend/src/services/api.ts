import axios from 'axios'
import type { AgentSummary, AgentDetail, KpiConfig, KpiGoal } from '@/types'

const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '',
})

export const api = {
  async listAgents(locationId: string): Promise<AgentSummary[]> {
    const { data } = await http.get('/api/agents', { params: { locationId } })
    return data
  },

  async getAgent(agentId: string, locationId: string): Promise<AgentDetail> {
    const { data } = await http.get(`/api/agents/${agentId}`, { params: { locationId } })
    return data
  },

  async getKpiConfig(agentId: string, locationId: string): Promise<KpiConfig | null> {
    try {
      const { data } = await http.get(`/api/kpi/${agentId}`, { params: { locationId } })
      return data
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { status?: number } }
        if (axiosErr?.response?.status === 404) return null
      }
      throw err
    }
  },

  async upsertKpiConfig(
    agentId: string,
    locationId: string,
    goals: KpiGoal[],
    successThreshold: number
  ): Promise<KpiConfig> {
    const { data } = await http.put(`/api/kpi/${agentId}`, { goals, successThreshold }, { params: { locationId } })
    return data
  },
}
