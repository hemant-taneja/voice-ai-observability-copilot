<template>
  <div class="agent-detail">
    <header class="detail-header">
      <RouterLink to="/" class="back-link mono">← AGENTS</RouterLink>
      <h1 class="display">{{ agent?.name ?? 'Loading...' }}</h1>
      <LiveIndicator :connected="streamStore.connected" />
    </header>

    <div class="detail-grid" v-if="latestResult">
      <section class="panel calls-panel">
        <h2 class="panel-title mono">CALLS</h2>
        <div class="calls-list">
          <div
            v-for="result in results"
            :key="result.id"
            class="call-item"
            :class="{ selected: selectedResult?.id === result.id, pass: result.passed, fail: !result.passed }"
            @click="selectedResult = result"
          >
            <span class="mono text-muted">{{ formatDate(result.analyzedAt) }}</span>
            <span class="badge" :class="result.passed ? 'badge-pass' : 'badge-fail'">
              {{ result.passed ? 'PASS' : 'FAIL' }}
            </span>
            <span class="mono text-secondary">{{ result.durationSeconds }}s</span>
          </div>
        </div>
      </section>

      <section class="panel kpi-panel">
        <h2 class="panel-title mono">KPI SCORECARD</h2>
        <div class="kpi-scores">
          <KpiScoreBar
            v-for="score in selectedResult?.kpiScores ?? []"
            :key="score.goal"
            :goal="score.goal"
            :score="score.score"
            :passed="score.passed"
            :evidence="score.evidence"
          />
        </div>
        <div class="overall-score surface">
          <span class="mono text-muted">OVERALL</span>
          <span class="mono overall-value">{{ ((selectedResult?.overallScore ?? 0) * 100).toFixed(0) }}</span>
          <span class="badge" :class="selectedResult?.passed ? 'badge-pass' : 'badge-fail'">
            {{ selectedResult?.passed ? 'PASSING' : 'FAILING' }}
          </span>
        </div>
        <KpiConfigEditor
          :agentId="id"
          :locationId="locationId"
          :initialGoals="kpiConfig?.goals ?? []"
          :initialThreshold="kpiConfig?.successThreshold ?? 0.7"
          @save="handleKpiSave"
        />
      </section>

      <section class="panel recs-panel">
        <RecommendationPanel :recommendations="selectedResult?.kpiScores ?? []" />
      </section>
    </div>

    <section v-if="selectedResult" class="transcript-section surface">
      <h2 class="panel-title mono">TRANSCRIPT — {{ selectedResult.ghlCallId }}</h2>
      <TranscriptViewer
        :turns="selectedResult.turns"
        :useActions="selectedResult.useActions"
      />
    </section>

    <div v-else class="empty mono text-muted">No analysis results yet for this agent.</div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { useAgentsStore } from '../stores/agents'
import { useAnalysisStore } from '../stores/analysis'
import { useStreamStore } from '../stores/stream'
import { useSSE } from '../composables/useSSE'
import LiveIndicator from '../components/LiveIndicator.vue'
import KpiScoreBar from '../components/KpiScoreBar.vue'
import RecommendationPanel from '../components/RecommendationPanel.vue'
import TranscriptViewer from '../components/TranscriptViewer.vue'
import KpiConfigEditor from '../components/KpiConfigEditor.vue'
import type { AnalysisResult, KpiGoal } from '../types/analysis.types'

const props = defineProps<{ id: string }>()

const locationId = new URLSearchParams(window.location.search).get('locationId') ?? 'dev-loc'

const agentsStore = useAgentsStore()
const analysisStore = useAnalysisStore()
const streamStore = useStreamStore()

const selectedResult = ref<AnalysisResult | null>(null)

const agent = computed(() => agentsStore.getById(props.id))
const results = computed(() => analysisStore.getResults(props.id))
const latestResult = computed(() => analysisStore.getLatestResult(props.id))
const kpiConfig = computed(() => analysisStore.kpiConfigs[props.id])

useSSE(locationId, (event) => {
  if (event.type === 'analysis.complete' && event.agentId === props.id) {
    analysisStore.fetchResults(props.id, locationId)
  }
})

onMounted(async () => {
  await Promise.all([
    agentsStore.fetchAll(locationId),
    analysisStore.fetchResults(props.id, locationId),
    analysisStore.fetchKpiConfig(props.id, locationId),
  ])
  selectedResult.value = latestResult.value
})

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })
}

async function handleKpiSave(goals: KpiGoal[], threshold: number) {
  await analysisStore.saveKpiConfig(props.id, locationId, goals, threshold)
}
</script>

<style scoped>
.agent-detail { padding: var(--space-6); max-width: 1400px; margin: 0 auto; }

.detail-header {
  display: flex;
  align-items: center;
  gap: var(--space-5);
  margin-bottom: var(--space-6);
  padding-bottom: var(--space-5);
  border-bottom: 1px solid var(--border);
}

.back-link { font-size: 11px; letter-spacing: 0.08em; color: var(--text-muted); text-decoration: none; }
.back-link:hover { color: var(--text-primary); }

h1 { font-size: 18px; font-weight: 700; flex: 1; }

.detail-grid {
  display: grid;
  grid-template-columns: 200px 1fr 260px;
  gap: var(--space-4);
  margin-bottom: var(--space-5);
}

.panel {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.panel-title { font-size: 10px; letter-spacing: 0.1em; color: var(--text-muted); margin-bottom: var(--space-2); }

.calls-list { display: flex; flex-direction: column; gap: var(--space-2); overflow-y: auto; max-height: 400px; }

.call-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: var(--space-2) var(--space-3);
  border-radius: 4px;
  cursor: pointer;
  border-left: 2px solid transparent;
}

.call-item:hover { background: var(--bg-elevated); }
.call-item.selected { background: var(--bg-elevated); border-left-color: var(--signal); }
.call-item.pass { border-left-color: var(--pass); }
.call-item.fail { border-left-color: var(--fail); }

.kpi-scores { display: flex; flex-direction: column; gap: var(--space-4); }

.overall-score {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-4);
  margin-top: var(--space-2);
}

.overall-value { font-size: 24px; font-weight: 600; }

.transcript-section { padding: var(--space-5); }

.empty { padding: var(--space-8) 0; font-size: 13px; }
</style>
