<template>
  <div class="recommendation-panel">
    <h3 class="panel-title display">RECOMMENDATIONS</h3>
    <div v-if="!recommendations.length" class="empty text-muted mono">No recommendations yet</div>
    <div
      v-for="rec in sortedRecs"
      :key="`${rec.goal}-${rec.score}`"
      class="rec-card"
      :class="`priority-${priority(rec)}`"
    >
      <div class="rec-header">
        <span class="rec-priority mono">{{ priority(rec).toUpperCase() }}</span>
        <span class="rec-type mono text-muted">{{ rec.goal }}</span>
      </div>
      <p class="rec-body">{{ rec.evidence }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { KpiScore } from '../types/analysis.types'

const props = defineProps<{ recommendations: KpiScore[] }>()

function priority(rec: KpiScore): 'high' | 'medium' | 'low' {
  if (rec.score < 0.4) return 'high'
  if (rec.score < 0.7) return 'medium'
  return 'low'
}

const sortedRecs = computed(() =>
  [...props.recommendations].filter((r) => !r.passed).sort((a, b) => a.score - b.score)
)
</script>

<style scoped>
.recommendation-panel { display: flex; flex-direction: column; gap: var(--space-3); }
.panel-title { font-size: 11px; letter-spacing: 0.1em; color: var(--text-muted); margin-bottom: var(--space-1); }
.empty { font-size: 12px; padding: var(--space-4) 0; }
.rec-card { border: 1px solid var(--border); border-top-width: 2px; border-radius: 6px; padding: var(--space-3) var(--space-4); }
.rec-card.priority-high   { border-top-color: var(--fail); }
.rec-card.priority-medium { border-top-color: var(--warning); }
.rec-card.priority-low    { border-top-color: var(--info); }
.rec-header { display: flex; justify-content: space-between; margin-bottom: var(--space-2); }
.rec-priority { font-size: 10px; letter-spacing: 0.1em; color: var(--text-secondary); }
.rec-type     { font-size: 10px; }
.rec-body     { font-size: 13px; color: var(--text-primary); line-height: 1.5; }
</style>
