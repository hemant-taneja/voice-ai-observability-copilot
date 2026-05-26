<template>
  <RouterLink
    :to="{ name: 'AgentDetail', params: { id: agent.id }, query: { locationId } }"
    class="agent-card"
    :class="health"
  >
    <!-- Top: name + status -->
    <div class="card-top">
      <div class="agent-info">
        <span class="agent-name">{{ agent.name }}</span>
        <span class="agent-ghl mono">{{ agent.ghlAgentId }}</span>
      </div>
      <span class="status-badge" :class="health">
        {{ health === 'pass' ? 'Passing' : health === 'fail' ? 'Failing' : 'No data' }}
      </span>
    </div>

    <!-- Middle: score ring + stats -->
    <div class="card-body">
      <div class="score-ring-wrap">
        <svg width="76" height="76" viewBox="0 0 76 76">
          <!-- Track -->
          <circle cx="38" cy="38" r="30" fill="none" stroke="var(--border)" stroke-width="5"/>
          <!-- Progress -->
          <circle
            cx="38" cy="38" r="30"
            fill="none"
            :stroke="ringColor"
            stroke-width="5"
            stroke-linecap="round"
            :stroke-dasharray="circumference"
            :stroke-dashoffset="offset"
            transform="rotate(-90 38 38)"
            class="ring-progress"
          />
        </svg>
        <div class="ring-center">
          <span class="ring-value mono" :class="health">{{ passRateDisplay }}</span>
          <span class="ring-sub">pass rate</span>
        </div>
      </div>

      <div class="card-stats">
        <div class="stat-item">
          <span class="stat-val mono">{{ agent.totalCalls }}</span>
          <span class="stat-lbl">total calls</span>
        </div>
        <div class="stat-item" :class="{ 'stat-warn': agent.openUseActions > 0 }">
          <span class="stat-val mono">{{ agent.openUseActions }}</span>
          <span class="stat-lbl">open actions</span>
        </div>
      </div>
    </div>

    <!-- Bottom progress bar -->
    <div class="progress-track">
      <div
        class="progress-fill"
        :style="{ width: agent.passRate !== null ? `${agent.passRate * 100}%` : '0%' }"
        :class="health"
      />
    </div>
  </RouterLink>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import type { Agent } from '../types/agent.types'

const props = defineProps<{ agent: Agent; locationId: string }>()

const health = computed(() => {
  if (props.agent.passRate === null) return 'unknown'
  return props.agent.passRate >= 0.7 ? 'pass' : 'fail'
})

const ringColor = computed(() => ({
  pass: 'var(--pass)',
  fail: 'var(--fail)',
  unknown: 'var(--border)',
}[health.value]))

const passRateDisplay = computed(() =>
  props.agent.passRate !== null ? `${Math.round(props.agent.passRate * 100)}%` : '—'
)

const circumference = 2 * Math.PI * 30

const offset = computed(() => {
  const pct = props.agent.passRate ?? 0
  return circumference * (1 - pct)
})
</script>

<style scoped>
.agent-card {
  display: flex;
  flex-direction: column;
  gap: 18px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 20px 20px 0;
  text-decoration: none;
  cursor: pointer;
  transition: background var(--t-base), border-color var(--t-base), transform var(--t-base), box-shadow var(--t-base);
  position: relative;
  overflow: hidden;
  box-shadow: var(--shadow-card);
}

/* Left accent bar */
.agent-card::before {
  content: '';
  position: absolute;
  top: 0; left: 0; bottom: 0;
  width: 3px;
  background: var(--border);
  transition: background var(--t-base);
}

.agent-card.pass::before { background: var(--pass); }
.agent-card.fail::before { background: var(--fail); }

.agent-card:hover {
  background: var(--bg-hover);
  border-color: var(--text-muted);
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
  text-decoration: none;
}

.agent-card.pass:hover { border-color: rgba(0,201,141,0.4); box-shadow: 0 4px 24px rgba(0,201,141,0.1); }
.agent-card.fail:hover { border-color: rgba(255,65,105,0.4); box-shadow: 0 4px 24px rgba(255,65,105,0.1); }

/* ── Top ─────────────────────────────────────────────────── */
.card-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
}

.agent-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.agent-name {
  font-size: 14.5px;
  font-weight: 700;
  color: var(--text);
  letter-spacing: -0.01em;
  line-height: 1.25;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.agent-ghl {
  font-size: 10.5px;
  color: var(--text-muted);
}

.status-badge {
  font-size: 10.5px;
  font-weight: 600;
  padding: 3px 9px;
  border-radius: 99px;
  flex-shrink: 0;
  letter-spacing: 0.01em;
}

.status-badge.pass {
  background: var(--pass-dim);
  color: var(--pass);
  border: 1px solid rgba(0,201,141,0.25);
}

.status-badge.fail {
  background: var(--fail-dim);
  color: var(--fail);
  border: 1px solid rgba(255,65,105,0.25);
}

.status-badge.unknown {
  background: var(--bg-hover);
  color: var(--text-muted);
  border: 1px solid var(--border);
}

/* ── Body ────────────────────────────────────────────────── */
.card-body {
  display: flex;
  align-items: center;
  gap: 20px;
}

/* ── Ring ────────────────────────────────────────────────── */
.score-ring-wrap {
  position: relative;
  flex-shrink: 0;
  width: 76px;
  height: 76px;
}

.ring-progress {
  transition: stroke-dashoffset 800ms cubic-bezier(0.4, 0, 0.2, 1), stroke 300ms ease;
}

.ring-center {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
}

.ring-value {
  font-size: 17px;
  font-weight: 700;
  line-height: 1;
  color: var(--text);
}

.ring-value.pass { color: var(--pass); }
.ring-value.fail { color: var(--fail); }

.ring-sub {
  font-size: 8.5px;
  color: var(--text-muted);
  letter-spacing: 0.04em;
}

/* ── Stats ───────────────────────────────────────────────── */
.card-stats {
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 1;
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.stat-val {
  font-size: 22px;
  font-weight: 700;
  color: var(--text);
  line-height: 1;
  letter-spacing: -0.02em;
}

.stat-lbl {
  font-size: 10.5px;
  color: var(--text-muted);
  font-weight: 500;
}

.stat-warn .stat-val { color: var(--warn); }

/* ── Progress bar ────────────────────────────────────────── */
.progress-track {
  height: 3px;
  background: var(--border-subtle);
  margin: 0 -20px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  transition: width 800ms cubic-bezier(0.4, 0, 0.2, 1);
  background: var(--border);
}

.progress-fill.pass { background: var(--pass); }
.progress-fill.fail { background: var(--fail); }
</style>
