import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useReviewStore = defineStore('review', () => {
  // Reactive set of all reviewed localStorage keys — replaced on every toggle
  // so Vue's ref-level reactivity fires correctly.
  const reviewedKeys = ref<Set<string>>(new Set())

  // Per-agent (DB UUID) count of reviewed use actions — used by the sidebar badge.
  const reviewedCountByAgent = ref<Record<string, number>>({})

  /** Call once on app start to hydrate from localStorage. */
  function hydrate() {
    const keys = new Set<string>()
    const counts: Record<string, number> = {}
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key) continue
      if (
        (key.startsWith('ua-reviewed-') || key.startsWith('ua-escalation-handled-')) &&
        localStorage.getItem(key) === 'true'
      ) {
        keys.add(key)
      }
      if (key.startsWith('agent-reviewed-count-')) {
        const agentId = key.slice('agent-reviewed-count-'.length)
        const n = parseInt(localStorage.getItem(key) ?? '0', 10)
        if (n > 0) counts[agentId] = n
      }
    }
    reviewedKeys.value = keys
    reviewedCountByAgent.value = counts
  }

  /** Toggle a use-action reviewed key. Pass agentId to keep sidebar counts accurate. */
  function setReviewed(storageKey: string, value: boolean, agentId?: string) {
    const next = new Set(reviewedKeys.value)
    if (value) next.add(storageKey)
    else next.delete(storageKey)
    reviewedKeys.value = next
    localStorage.setItem(storageKey, String(value))

    if (agentId) {
      const current = reviewedCountByAgent.value[agentId] ?? 0
      const updated = Math.max(0, current + (value ? 1 : -1))
      reviewedCountByAgent.value = { ...reviewedCountByAgent.value, [agentId]: updated }
      localStorage.setItem(`agent-reviewed-count-${agentId}`, String(updated))
    }
  }

  function isReviewed(storageKey: string): boolean {
    return reviewedKeys.value.has(storageKey)
  }

  /** Effective open action count for the sidebar badge. */
  function openActionsFor(agentId: string, backendCount: number): number {
    return Math.max(0, backendCount - (reviewedCountByAgent.value[agentId] ?? 0))
  }

  return { reviewedKeys, reviewedCountByAgent, hydrate, setReviewed, isReviewed, openActionsFor }
})
