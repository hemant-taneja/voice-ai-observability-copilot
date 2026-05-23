import { defineStore } from 'pinia'
import { ref } from 'vue'
import { agentsApi } from '../api/agents'
import { Agent } from '../types/agent.types'

export const useAgentsStore = defineStore('agents', () => {
  const agents = ref<Agent[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const locationId = ref<string | null>(null)

  async function fetchAll(locId: string): Promise<void> {
    locationId.value = locId
    loading.value = true
    error.value = null
    try {
      agents.value = await agentsApi.list(locId)
    } catch (e) {
      error.value = 'Failed to load agents'
    } finally {
      loading.value = false
    }
  }

  function getById(id: string): Agent | undefined {
    return agents.value.find((a) => a.id === id)
  }

  return { agents, loading, error, locationId, fetchAll, getById }
})
