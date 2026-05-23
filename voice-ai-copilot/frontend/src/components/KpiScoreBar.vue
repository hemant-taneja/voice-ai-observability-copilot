<template>
  <div class="kpi-score-bar">
    <div class="kpi-header">
      <span class="kpi-name">{{ goal }}</span>
      <span class="badge" :class="passed ? 'badge-pass' : 'badge-fail'">{{ passed ? '✓' : '✗' }}</span>
    </div>
    <div class="kpi-bar-row">
      <div class="kpi-bar">
        <div class="kpi-fill" :style="{ width: `${score * 100}%`, background: passed ? 'var(--pass)' : 'var(--fail)' }" />
      </div>
      <span class="kpi-score mono">{{ (score * 100).toFixed(0) }}</span>
    </div>
    <p v-if="evidence" class="kpi-evidence text-muted">{{ evidence }}</p>
  </div>
</template>

<script setup lang="ts">
defineProps<{ goal: string; score: number; passed: boolean; evidence?: string }>()
</script>

<style scoped>
.kpi-score-bar { display: flex; flex-direction: column; gap: var(--space-2); }
.kpi-header { display: flex; justify-content: space-between; align-items: center; }
.kpi-name { font-size: 13px; color: var(--text-primary); }
.kpi-bar-row { display: flex; align-items: center; gap: var(--space-2); }
.kpi-bar { flex: 1; height: 6px; background: var(--border); border-radius: 3px; overflow: hidden; }
.kpi-fill { height: 100%; border-radius: 3px; transition: width 500ms ease; }
.kpi-score { font-size: 12px; color: var(--text-secondary); min-width: 28px; text-align: right; }
.kpi-evidence { font-size: 12px; line-height: 1.4; }
</style>
