<template>
  <div class="dashboard">

    <!-- Page header -->
    <header class="page-header">
      <div class="header-content">
        <div class="header-text">
          <h1 class="page-title">Performance Overview</h1>
          <p class="page-sub">Real-time monitoring across all voice AI agents</p>
        </div>
        <div class="header-badge" v-if="agentsStore.agents.length">
          <span class="badge-dot" />
          <span class="mono">{{ agentsStore.agents.length }} agent{{ agentsStore.agents.length !== 1 ? 's' : '' }}</span>
        </div>
      </div>
    </header>

    <!-- Metric cards -->
    <section class="metrics-section">
      <div class="metrics-grid">
        <MetricCard
          label="Total Calls"
          :value="totalCalls"
          icon="phone"
        />
        <MetricCard
          label="Pass Rate"
          :value="passRateStr"
          icon="check"
          :status="passRateStatus"
        />
        <MetricCard
          label="Avg Score"
          :value="avgScoreStr"
          icon="bar"
          :status="avgScoreStatus"
        />
        <MetricCard
          label="Open Actions"
          :value="openUseActions"
          icon="bolt"
          :status="openUseActions > 0 ? 'warn' : null"
        />
      </div>
    </section>

    <!-- Agent grid -->
    <section class="agents-section">
      <div class="section-head">
        <div class="section-title-row">
          <h2 class="section-title">Agents</h2>
          <span v-if="agentsStore.agents.length" class="count-pill mono">
            {{ agentsStore.agents.length }}
          </span>
          <button class="sync-btn" :class="{ syncing }" :disabled="syncing" @click="syncAgents">
            <svg v-if="!syncing" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 12a9 9 0 0 1-9 9m9-9a9 9 0 0 0-9-9m9 9H3m9 9a9 9 0 0 1-9-9m9 9c-1.66 0-3-4.03-3-9s1.34-9 3-9m-9 9a9 9 0 0 1 9-9"/>
            </svg>
            <svg v-else class="spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
            </svg>
            {{ syncing ? 'Syncing…' : 'Sync from HighLevel' }}
          </button>
        </div>
        <p class="section-sub">Click an agent to view call history and KPI details</p>
      </div>

      <!-- Loading -->
      <div v-if="agentsStore.loading" class="agents-grid">
        <div class="card-skeleton" v-for="i in 4" :key="i" />
      </div>

      <!-- Empty -->
      <div v-else-if="!agentsStore.agents.length" class="empty-state">
        <div class="empty-icon">
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <circle cx="20" cy="20" r="18" stroke="var(--border)" stroke-width="2"/>
            <path d="M10 20 Q15 10 20 20 Q25 30 30 20"
              stroke="var(--text-muted)" stroke-width="2" stroke-linecap="round" fill="none"/>
          </svg>
        </div>
        <p class="empty-title">No agents found</p>
        <p class="empty-hint">
          Click <strong>Sync from HighLevel</strong> above to pull your Voice AI agents from this location.
        </p>
        <button class="sync-btn sync-btn--lg" :class="{ syncing }" :disabled="syncing" @click="syncAgents">
          <svg v-if="!syncing" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 12a9 9 0 0 1-9 9m9-9a9 9 0 0 0-9-9m9 9H3m9 9a9 9 0 0 1-9-9m9 9c-1.66 0-3-4.03-3-9s1.34-9 3-9m-9 9a9 9 0 0 1 9-9"/>
          </svg>
          <svg v-else class="spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
          </svg>
          {{ syncing ? 'Syncing…' : 'Sync from HighLevel' }}
        </button>
      </div>

      <!-- Grid -->
      <div v-else class="agents-grid">
        <AgentCard
          v-for="(agent, i) in agentsStore.agents"
          :key="agent.id"
          :agent="agent"
          :locationId="locationId"
          :style="{ animationDelay: `${i * 50}ms` }"
          class="agent-reveal"
        />
      </div>
    </section>

  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useAgentsStore } from '../stores/agents'
import { useToast } from '../composables/useToast'
import { agentsApi } from '../api/agents'
import MetricCard from '../components/MetricCard.vue'
import AgentCard from '../components/AgentCard.vue'

const props = defineProps<{ locationId: string }>()
const agentsStore = useAgentsStore()
const { add: addToast } = useToast()
const syncing = ref(false)

onMounted(() => agentsStore.fetchAll(props.locationId))

async function syncAgents() {
  syncing.value = true
  try {
    const { synced } = await agentsApi.syncFromHL(props.locationId)
    await agentsStore.fetchAll(props.locationId)
    addToast(`Synced ${synced} agent${synced !== 1 ? 's' : ''} from HighLevel`, 'success')
  } catch {
    addToast('Sync failed — check HighLevel connection', 'error')
  } finally {
    syncing.value = false
  }
}

const totalCalls = computed(() =>
  agentsStore.agents.reduce((s, a) => s + a.totalCalls, 0)
)

const ratesWithData = computed(() =>
  agentsStore.agents.filter((a) => a.passRate !== null).map((a) => a.passRate!)
)

const avgRate = computed(() =>
  ratesWithData.value.length
    ? ratesWithData.value.reduce((a, b) => a + b, 0) / ratesWithData.value.length
    : null
)

const passRateStr = computed(() =>
  avgRate.value !== null ? `${Math.round(avgRate.value * 100)}%` : null
)

const passRateStatus = computed(() => {
  if (avgRate.value === null) return null
  return avgRate.value >= 0.7 ? 'pass' : 'fail'
})

const avgScoreStr = computed(() =>
  avgRate.value !== null ? avgRate.value.toFixed(2) : null
)

const avgScoreStatus = computed(() => {
  if (avgRate.value === null) return null
  if (avgRate.value >= 0.7) return 'pass'
  if (avgRate.value >= 0.5) return 'warn'
  return 'fail'
})

const openUseActions = computed(() =>
  agentsStore.agents.reduce((s, a) => s + a.openUseActions, 0)
)
</script>

<style scoped>
.dashboard {
  padding: 32px 36px;
  max-width: 1140px;
  display: flex;
  flex-direction: column;
  gap: 32px;
}

/* ── Page header ─────────────────────────────────────────── */
.page-header {
  border-bottom: 1px solid var(--border-subtle);
  padding-bottom: 24px;
}

.header-content {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
}

.page-title {
  font-size: 26px;
  font-weight: 800;
  color: var(--text);
  letter-spacing: -0.03em;
  line-height: 1.15;
}

.page-sub {
  font-size: 13.5px;
  color: var(--text-muted);
  margin-top: 5px;
  font-weight: 400;
}

.header-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--text-muted);
  background: var(--bg-card);
  border: 1px solid var(--border);
  padding: 5px 12px;
  border-radius: 99px;
  white-space: nowrap;
  box-shadow: var(--shadow-sm);
}

.badge-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--pass);
  box-shadow: 0 0 5px var(--pass-glow);
  animation: pulse-ring 2s ease-in-out infinite;
}

/* ── Metrics ─────────────────────────────────────────────── */
.metrics-section { }

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
}

@media (max-width: 900px) {
  .metrics-grid { grid-template-columns: repeat(2, 1fr); }
}

/* ── Agents section ──────────────────────────────────────── */
.agents-section {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.section-head { }

.section-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.section-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text);
  letter-spacing: -0.01em;
}

.count-pill {
  font-size: 10.5px;
  color: var(--text-muted);
  background: var(--bg-card);
  border: 1px solid var(--border);
  padding: 2px 9px;
  border-radius: 99px;
}

.section-sub {
  font-size: 12.5px;
  color: var(--text-muted);
  margin-top: 3px;
}

/* ── Agent grid ──────────────────────────────────────────── */
.agents-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(290px, 1fr));
  gap: 14px;
}

.agent-reveal {
  animation: fade-up 360ms ease-out both;
}

/* ── Skeletons ───────────────────────────────────────────── */
.card-skeleton {
  height: 160px;
  border-radius: var(--radius-lg);
  background: linear-gradient(90deg, var(--bg-card) 25%, var(--bg-hover) 50%, var(--bg-card) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.6s ease-in-out infinite;
  border: 1px solid var(--border);
}

.card-skeleton:nth-child(2) { animation-delay: 0.1s; }
.card-skeleton:nth-child(3) { animation-delay: 0.2s; }
.card-skeleton:nth-child(4) { animation-delay: 0.3s; }

/* ── Sync button ─────────────────────────────────────────── */
.sync-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11.5px;
  font-weight: 600;
  color: var(--text-2);
  background: var(--bg-card);
  border: 1px solid var(--border);
  padding: 5px 12px;
  border-radius: 99px;
  cursor: pointer;
  transition: all var(--t-fast);
  white-space: nowrap;
  margin-left: auto;
}

.sync-btn:hover:not(:disabled) {
  color: var(--accent);
  border-color: var(--accent);
  background: var(--bg-hover);
}

.sync-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.sync-btn--lg {
  font-size: 13px;
  padding: 8px 18px;
  margin-top: 4px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.spin {
  animation: spin 0.8s linear infinite;
}

/* ── Empty state ─────────────────────────────────────────── */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 56px 32px;
  background: var(--bg-card);
  border: 1px dashed var(--border);
  border-radius: var(--radius-lg);
  text-align: center;
}

.empty-icon { opacity: 0.5; }

.empty-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-2);
}

.empty-hint {
  font-size: 13px;
  color: var(--text-muted);
  max-width: 340px;
  line-height: 1.6;
}
</style>
