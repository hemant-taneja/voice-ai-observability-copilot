import { defineStore } from 'pinia'
import { ref } from 'vue'
import { analysisApi } from '../api/analysis'
import { kpiApi } from '../api/kpi'
import { AnalysisResult, KpiConfig, KpiGoal } from '../types/analysis.types'

export const useAnalysisStore = defineStore('analysis', () => {
  const resultsByAgent = ref<Record<string, AnalysisResult[]>>({})
  const kpiConfigs = ref<Record<string, KpiConfig>>({})
  const loading = ref(false)

  async function fetchResults(agentId: string, locationId: string): Promise<void> {
    loading.value = true
    try {
      resultsByAgent.value[agentId] = await analysisApi.getByAgent(agentId, locationId)
    } finally {
      loading.value = false
    }
  }

  async function fetchKpiConfig(agentId: string, locationId: string): Promise<void> {
    try {
      kpiConfigs.value[agentId] = await kpiApi.get(agentId, locationId)
    } catch {
      // No config yet
    }
  }

  async function saveKpiConfig(
    agentId: string, locationId: string,
    goals: KpiGoal[], successThreshold: number
  ): Promise<void> {
    kpiConfigs.value[agentId] = await kpiApi.upsert(agentId, locationId, goals, successThreshold)
  }

  function getResults(agentId: string): AnalysisResult[] {
    return resultsByAgent.value[agentId] ?? []
  }

  function getLatestResult(agentId: string): AnalysisResult | null {
    return resultsByAgent.value[agentId]?.[0] ?? null
  }

  return {
    resultsByAgent, kpiConfigs, loading,
    fetchResults, fetchKpiConfig, saveKpiConfig,
    getResults, getLatestResult,
  }
})
