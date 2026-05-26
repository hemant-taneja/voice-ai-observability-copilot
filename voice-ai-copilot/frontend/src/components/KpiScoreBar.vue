<template>
  <div class="kpi-score-bar">
    <div class="kpi-top">
      <span class="kpi-name">{{ goal }}</span>
      <div class="kpi-right">
        <span class="kpi-pct mono" :class="passed ? 'pass' : 'fail'">{{ (score * 100).toFixed(0) }}</span>
        <span class="kpi-badge" :class="passed ? 'pass' : 'fail'">{{ passed ? '✓' : '✗' }}</span>
      </div>
    </div>
    <div class="kpi-bar">
      <div
        class="kpi-fill"
        :class="passed ? 'pass' : 'fail'"
        :style="{ width: `${score * 100}%` }"
      />
    </div>
    <p v-if="evidence" class="kpi-evidence">{{ evidence }}</p>
  </div>
</template>

<script setup lang="ts">
defineProps<{ goal: string; score: number; passed: boolean; evidence?: string }>()
</script>

<style scoped>
.kpi-score-bar {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.kpi-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.kpi-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text);
}

.kpi-right {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.kpi-pct {
  font-size: 13px;
  font-weight: 600;
  line-height: 1;
}

.kpi-pct.pass { color: var(--pass); }
.kpi-pct.fail { color: var(--fail); }

.kpi-badge {
  font-size: 10px;
  font-weight: 700;
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
}

.kpi-badge.pass { background: var(--pass-dim); color: var(--pass); }
.kpi-badge.fail { background: var(--fail-dim); color: var(--fail); }

.kpi-bar {
  height: 5px;
  background: var(--border);
  border-radius: 3px;
  overflow: hidden;
}

.kpi-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 600ms cubic-bezier(0.4, 0, 0.2, 1);
}

.kpi-fill.pass { background: var(--pass); }
.kpi-fill.fail { background: var(--fail); }

.kpi-evidence {
  font-size: 11.5px;
  color: var(--text-muted);
  line-height: 1.5;
  font-style: italic;
}
</style>
