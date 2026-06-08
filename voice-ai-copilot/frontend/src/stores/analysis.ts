import { defineStore } from 'pinia'
import { ref } from 'vue'
import { analysisApi } from '../api/analysis'
import { actionsApi } from '../api/actions'
import { kpiApi } from '../api/kpi'
import { TranscriptCard, KpiConfig, KpiGoal, ActionAnalytics } from '../types/analysis.types'

export const useAnalysisStore = defineStore('analysis', () => {
  const cardsByAgent = ref<Record<string, TranscriptCard[]>>({})
  const kpiConfigs = ref<Record<string, KpiConfig>>({})
  const actionAnalyticsByAgent = ref<Record<string, ActionAnalytics[]>>({})
  const loading = ref(false)

  async function fetchResults(agentId: string, locationId: string): Promise<void> {
    loading.value = true
    try {
      cardsByAgent.value[agentId] = await analysisApi.getByAgent(agentId, locationId)
    } finally {
      loading.value = false
    }
  }

  async function fetchActionAnalytics(agentId: string, locationId: string): Promise<void> {
    actionAnalyticsByAgent.value[agentId] = await actionsApi.getAnalytics(agentId, locationId)
  }

  function getActionAnalytics(agentId: string): ActionAnalytics[] {
    return actionAnalyticsByAgent.value[agentId] ?? []
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

  function getCards(agentId: string): TranscriptCard[] {
    return cardsByAgent.value[agentId] ?? []
  }

  return {
    cardsByAgent, kpiConfigs, actionAnalyticsByAgent, loading,
    fetchResults, fetchActionAnalytics, fetchKpiConfig, saveKpiConfig,
    getCards, getActionAnalytics,
  }
})
