<template>
  <div class="rec-panel">
    <div class="rec-header">
      <div class="rec-title-row">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M7 1v2M7 11v2M1 7h2M11 7h2M3.2 3.2l1.4 1.4M9.4 9.4l1.4 1.4M3.2 10.8l1.4-1.4M9.4 4.6l1.4-1.4" stroke="var(--warn)" stroke-width="1.3" stroke-linecap="round"/>
        </svg>
        <span class="rec-title">Recommendations</span>
        <span class="rec-count mono">{{ sortedRecs.length }}</span>
      </div>
      <p class="rec-sub">Based on latest call analysis</p>
    </div>

    <div class="rec-list">
      <div
        v-for="rec in sortedRecs"
        :key="`${rec.goal}-${rec.score}`"
        class="rec-card"
        :class="`priority-${priority(rec)}`"
      >
        <div class="rec-top">
          <div class="priority-dot" :class="`priority-${priority(rec)}`" />
          <span class="rec-goal">{{ rec.goal }}</span>
          <span class="priority-tag" :class="`priority-${priority(rec)}`">
            {{ priority(rec).toUpperCase() }}
          </span>
        </div>
        <p class="rec-evidence">{{ rec.evidence }}</p>
        <div class="rec-score-bar">
          <div class="rec-score-fill" :class="`priority-${priority(rec)}`" :style="{ width: `${rec.score * 100}%` }" />
        </div>
      </div>
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
.rec-panel {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

/* ── Header ──────────────────────────────────────────────── */
.rec-header {
  padding: 14px 18px;
  border-bottom: 1px solid var(--border-subtle);
  background: rgba(255, 171, 46, 0.04);
}

.rec-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.rec-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--text);
  flex: 1;
}

.rec-count {
  font-size: 10px;
  color: var(--text-muted);
  background: var(--bg-hover);
  border: 1px solid var(--border);
  padding: 1px 7px;
  border-radius: 99px;
}

.rec-sub {
  font-size: 11.5px;
  color: var(--text-muted);
  margin-top: 3px;
}

/* ── List ────────────────────────────────────────────────── */
.rec-list {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.rec-card {
  padding: 14px 18px;
  border-bottom: 1px solid var(--border-subtle);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.rec-card:last-child {
  border-bottom: none;
}

.rec-top {
  display: flex;
  align-items: center;
  gap: 8px;
}

.priority-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.priority-dot.priority-high   { background: var(--fail); box-shadow: 0 0 6px var(--fail-glow); }
.priority-dot.priority-medium { background: var(--warn); }
.priority-dot.priority-low    { background: var(--accent); }

.rec-goal {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--text);
  flex: 1;
}

.priority-tag {
  font-size: 9px;
  font-family: var(--font-mono);
  font-weight: 700;
  letter-spacing: 0.07em;
  padding: 2px 7px;
  border-radius: 99px;
}

.priority-tag.priority-high {
  background: var(--fail-dim);
  color: var(--fail);
  border: 1px solid rgba(255,65,105,0.2);
}

.priority-tag.priority-medium {
  background: var(--warn-dim);
  color: var(--warn);
  border: 1px solid rgba(255,171,46,0.2);
}

.priority-tag.priority-low {
  background: var(--accent-dim);
  color: var(--accent);
  border: 1px solid rgba(79,136,255,0.2);
}

.rec-evidence {
  font-size: 12.5px;
  color: var(--text-2);
  line-height: 1.55;
}

/* ── Score bar ───────────────────────────────────────────── */
.rec-score-bar {
  height: 3px;
  background: var(--border);
  border-radius: 2px;
  overflow: hidden;
}

.rec-score-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 600ms ease;
}

.rec-score-fill.priority-high   { background: var(--fail); }
.rec-score-fill.priority-medium { background: var(--warn); }
.rec-score-fill.priority-low    { background: var(--accent); }
</style>
