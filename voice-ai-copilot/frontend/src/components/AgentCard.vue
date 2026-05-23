<template>
  <RouterLink :to="`/agents/${agent.id}`" class="agent-card-link">
    <div class="agent-card" :class="healthClass">
      <div class="agent-header">
        <span class="agent-name display">{{ agent.name }}</span>
        <span class="badge" :class="healthClass === 'passing' ? 'badge-pass' : 'badge-fail'">
          {{ healthClass === 'passing' ? 'PASSING' : 'FAILING' }}
        </span>
      </div>
      <div class="agent-pass-rate">
        <span class="rate-value mono">{{ passRateDisplay }}</span>
        <div class="rate-bar">
          <div class="rate-fill" :style="{ width: passRatePercent, background: healthColor }" />
        </div>
      </div>
      <div class="agent-meta">
        <span class="mono text-secondary">{{ agent.totalCalls }} calls</span>
        <span v-if="agent.openUseActions" class="badge badge-signal">⚡ {{ agent.openUseActions }}</span>
      </div>
    </div>
  </RouterLink>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import type { Agent } from '../types/agent.types'

const props = defineProps<{ agent: Agent }>()

const healthClass = computed(() => {
  if (props.agent.passRate === null) return 'unknown'
  return props.agent.passRate >= 0.7 ? 'passing' : 'failing'
})

const healthColor = computed(() => {
  if (healthClass.value === 'passing') return 'var(--pass)'
  if (healthClass.value === 'failing') return 'var(--fail)'
  return 'var(--text-muted)'
})

const passRateDisplay = computed(() =>
  props.agent.passRate !== null ? `${Math.round(props.agent.passRate * 100)}%` : '—'
)

const passRatePercent = computed(() =>
  props.agent.passRate !== null ? `${props.agent.passRate * 100}%` : '0%'
)
</script>

<style scoped>
.agent-card-link { text-decoration: none; display: block; }
.agent-card {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-left: 3px solid var(--text-muted);
  border-radius: 8px;
  padding: var(--space-4) var(--space-5);
  cursor: pointer;
  transition: background 160ms ease, border-color 160ms ease;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.agent-card:hover { background: var(--bg-elevated); }
.agent-card.passing { border-left-color: var(--pass); }
.agent-card.failing { border-left-color: var(--fail); }
.agent-header { display: flex; justify-content: space-between; align-items: center; }
.agent-name { font-size: 15px; font-weight: 700; color: var(--text-primary); }
.agent-pass-rate { display: flex; flex-direction: column; gap: 6px; }
.rate-value { font-size: 22px; font-weight: 600; color: var(--text-primary); }
.rate-bar { height: 4px; background: var(--border); border-radius: 2px; overflow: hidden; }
.rate-fill { height: 100%; border-radius: 2px; transition: width 600ms ease; }
.agent-meta { display: flex; align-items: center; justify-content: space-between; }
</style>
