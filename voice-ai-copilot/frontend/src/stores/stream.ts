import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface StreamEvent {
  type: string
  agentId?: string
}

export const useStreamStore = defineStore('stream', () => {
  const connected = ref(false)
  const lastEvent = ref<StreamEvent | null>(null)

  function setConnected(value: boolean) { connected.value = value }
  function setLastEvent(event: StreamEvent) { lastEvent.value = { ...event } }

  return { connected, lastEvent, setConnected, setLastEvent }
})
