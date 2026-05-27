import { ref, onUnmounted } from 'vue'

export interface SSEEvent {
  type: 'analysis.complete' | 'analysis.failed' | 'transcript.ingested' | 'connected'
  agentId?: string
  locationId?: string
}

export function useSSE(locationId: string, onEvent: (event: SSEEvent) => void | Promise<void>) {
  const connected = ref(false)
  let source: EventSource | null = null
  let retryDelay = 1000

  function connect() {
    const base = import.meta.env.VITE_API_BASE_URL ?? ''
    source = new EventSource(`${base}/stream?locationId=${encodeURIComponent(locationId)}`)

    source.onopen = () => {
      connected.value = true
      retryDelay = 1000
    }

    source.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data) as SSEEvent
        onEvent(event)
      } catch { /* malformed event */ }
    }

    source.onerror = () => {
      connected.value = false
      source?.close()
      source = null
      setTimeout(connect, Math.min(retryDelay, 30_000))
      retryDelay = Math.min(retryDelay * 2, 30_000)
    }
  }

  connect()

  onUnmounted(() => {
    source?.close()
    source = null
  })

  return { connected }
}
