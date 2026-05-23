<template>
  <div class="dashboard">
    <header class="dash-header">
      <div class="header-left">
        <h1 class="display">VOICE AI COPILOT</h1>
        <svg class="signal-wave" :class="{ disconnected: !streamStore.connected }" viewBox="0 0 80 24" fill="none">
          <path d="M0 12 Q10 4 20 12 Q30 20 40 12 Q50 4 60 12 Q70 20 80 12" stroke="var(--signal)" stroke-width="2" fill="none"/>
        </svg>
      </div>
      <div class="header-right">
        <LiveIndicator :connected="streamStore.connected" />
      </div>
    </header>

    <div class="metrics-row">
      <MetricCard label="TOTAL CALLS" :value="totalCalls" />
      <MetricCard label="PASS RATE" :value="passRate" />
      <MetricCard label="AVG SCORE" :value="avgScore" />
      <MetricCard label="USE ACTIONS" :value="openUseActions" />
    </div>

    <section class="agents-section">
      <h2 class="section-title mono">AGENTS</h2>
      <div v-if="agentsStore.loading" class="loading mono text-muted">Loading agents...</div>
      <div v-else class="agents-grid">
        <AgentCard
          v-for="(agent, i) in agentsStore.agents"
          :key="agent.id"
          :agent="agent"
          :style="{ animationDelay: `${i * 60}ms` }"
          class="agent-reveal"
        />
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useAgentsStore } from '../stores/agents'
import { useStreamStore } from '../stores/stream'
import { useAnalysisStore } from '../stores/analysis'
import { useSSE } from '../composables/useSSE'
import MetricCard from '../components/MetricCard.vue'
import LiveIndicator from '../components/LiveIndicator.vue'
import AgentCard from '../components/AgentCard.vue'

const locationId = new URLSearchParams(window.location.search).get('locationId') ?? 'dev-loc'

const agentsStore = useAgentsStore()
const streamStore = useStreamStore()
const analysisStore = useAnalysisStore()

const { connected } = useSSE(locationId, (event) => {
  streamStore.setConnected(true)
  if (event.type === 'analysis.complete' && event.agentId) {
    agentsStore.fetchAll(locationId)
    analysisStore.fetchResults(event.agentId, locationId)
  }
})

streamStore.setConnected(connected.value)

onMounted(() => agentsStore.fetchAll(locationId))

const totalCalls = computed(() =>
  agentsStore.agents.reduce((s, a) => s + a.totalCalls, 0)
)

const passRate = computed(() => {
  const rates = agentsStore.agents.filter((a) => a.passRate !== null).map((a) => a.passRate!)
  if (!rates.length) return null
  return `${Math.round((rates.reduce((a, b) => a + b, 0) / rates.length) * 100)}%`
})

const avgScore = computed(() => {
  const rates = agentsStore.agents.filter((a) => a.passRate !== null).map((a) => a.passRate!)
  if (!rates.length) return null
  return (rates.reduce((a, b) => a + b, 0) / rates.length).toFixed(2)
})

const openUseActions = computed(() =>
  agentsStore.agents.reduce((s, a) => s + a.openUseActions, 0)
)
</script>

<style scoped>
.dashboard { padding: var(--space-6); max-width: 1200px; margin: 0 auto; }

.dash-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-6);
  padding-bottom: var(--space-5);
  border-bottom: 1px solid var(--border);
}

.header-left { display: flex; align-items: center; gap: var(--space-4); }

h1 { font-size: 18px; font-weight: 800; letter-spacing: 0.12em; color: var(--text-primary); }

.signal-wave { width: 64px; height: 20px; opacity: 0.7; }
.signal-wave:not(.disconnected) { animation: breathe 2.4s ease-in-out infinite; }
.signal-wave.disconnected { opacity: 0.15; }

@keyframes breathe {
  0%, 100% { opacity: 0.4; transform: scaleY(1); }
  50%       { opacity: 0.9; transform: scaleY(1.3); }
}

.metrics-row {
  display: flex;
  gap: var(--space-4);
  margin-bottom: var(--space-8);
  flex-wrap: wrap;
}

.section-title {
  font-size: 10px;
  letter-spacing: 0.12em;
  color: var(--text-muted);
  margin-bottom: var(--space-4);
}

.agents-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: var(--space-4);
}

.agent-reveal { animation: reveal 400ms ease-out both; }

@keyframes reveal {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}

.loading { padding: var(--space-6) 0; }
</style>
