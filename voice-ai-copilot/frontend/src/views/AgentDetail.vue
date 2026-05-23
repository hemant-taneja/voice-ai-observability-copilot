<template>
  <div class="agent-detail">
    <nav class="breadcrumb">
      <button class="back-btn mono" @click="$router.push('/')">← BACK</button>
    </nav>

    <div v-if="loading" class="loading mono">Loading...</div>
    <div v-else-if="error" class="error">{{ error }}</div>
    <template v-else-if="agent">
      <header class="agent-header">
        <h1 class="display">{{ agent.name }}</h1>
      </header>

      <section class="analyses-section">
        <h2 class="section-title mono">RECENT ANALYSES</h2>
        <div v-if="!agent.recentAnalyses.length" class="empty mono text-muted">No analyses yet</div>
        <div
          v-for="analysis in agent.recentAnalyses"
          :key="analysis.transcriptId"
          class="analysis-card card"
        >
          <div class="analysis-header">
            <span class="call-id mono text-muted">{{ analysis.callId }}</span>
            <span class="analysis-date text-muted">{{ formatDate(analysis.analyzedAt) }}</span>
            <span
              class="score-badge badge"
              :class="analysis.passed ? 'badge--pass' : 'badge--fail'"
            >
              {{ analysis.passed ? 'PASS' : 'FAIL' }} {{ pct(analysis.overallScore) }}
            </span>
          </div>
          <p class="summary">{{ analysis.summary }}</p>
          <div v-if="analysis.useActions.length" class="use-actions">
            <UseActionBadge
              v-for="(action, i) in analysis.useActions"
              :key="i"
              :type="action.type as 'missed_opportunity' | 'deviation' | 'escalation_needed'"
              :description="action.description"
            />
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { agentsApi } from '../api/agents'
import type { AgentDetail } from '../types/agent.types'
import UseActionBadge from '../components/UseActionBadge.vue'

const route = useRoute()
const id = route.params.id as string
const locationId = (route.query.locationId as string) ?? 'dev-loc'

const agent = ref<AgentDetail | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

onMounted(async () => {
  try {
    agent.value = await agentsApi.getById(id, locationId)
  } catch (e) {
    error.value = 'Failed to load agent'
  } finally {
    loading.value = false
  }
})

const passRateLabel = computed(() => {
  return null
})

function pct(score: number): string {
  return `${Math.round(score * 100)}%`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
</script>

<style scoped>
.agent-detail { padding: var(--space-6); max-width: 1000px; margin: 0 auto; }
.breadcrumb { margin-bottom: var(--space-6); }
.back-btn {
  background: none;
  border: none;
  color: var(--color-text-secondary, var(--text-secondary));
  cursor: pointer;
  font-size: var(--text-sm, 13px);
  letter-spacing: 0.1em;
  padding: var(--space-2) 0;
  transition: color var(--transition-fast, 160ms ease);
}
.back-btn:hover { color: var(--color-text-primary, var(--text-primary)); }
.agent-header { margin-bottom: var(--space-8); }
h1 { font-size: var(--text-2xl, 22px); font-weight: var(--font-bold, 700); margin-bottom: var(--space-4); }
.section-title { font-size: 10px; letter-spacing: 0.12em; color: var(--text-muted); margin-bottom: var(--space-4); }
.analysis-card {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: var(--space-4) var(--space-5);
  margin-bottom: var(--space-4);
}
.analysis-header { display: flex; align-items: center; gap: var(--space-3); flex-wrap: wrap; margin-bottom: var(--space-3); }
.call-id { font-size: var(--text-xs, 11px); }
.analysis-date { font-size: var(--text-xs, 11px); flex: 1; text-align: right; }
.score-badge { font-size: var(--text-xs, 11px); padding: 2px 8px; border-radius: 4px; font-family: var(--font-mono); font-weight: 600; letter-spacing: 0.05em; }
.badge--pass { background: rgba(34, 197, 94, 0.15); color: var(--pass, #22c55e); }
.badge--fail { background: rgba(239, 68, 68, 0.15); color: var(--fail, #ef4444); }
.summary { font-size: var(--text-sm, 13px); color: var(--text-secondary); line-height: 1.6; margin-bottom: var(--space-3); }
.use-actions { display: flex; flex-direction: column; gap: var(--space-2); }
.loading, .empty, .error { color: var(--text-muted); font-size: var(--text-sm, 13px); padding: var(--space-8) 0; }
.error { color: var(--fail, #ef4444); }
</style>
