<template>
  <div class="metric-card" :class="status">
    <div class="metric-header">
      <span class="metric-label">{{ label }}</span>
      <div class="metric-icon" :class="[icon, status]">
        <svg v-if="icon === 'phone'" width="15" height="15" viewBox="0 0 14 14" fill="none">
          <path d="M2 2h3l1.5 3.5-1.5 1C5.5 8.5 5.5 8.5 7.5 10.5l1-1.5L12 10.5v2.5C5.5 13.5 1.5 8 2 2Z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
        </svg>
        <svg v-else-if="icon === 'check'" width="15" height="15" viewBox="0 0 14 14" fill="none">
          <circle cx="7" cy="7" r="5.5" stroke="currentColor" stroke-width="1.3"/>
          <path d="M4.5 7l2 2 3-3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <svg v-else-if="icon === 'bar'" width="15" height="15" viewBox="0 0 14 14" fill="none">
          <rect x="1.5" y="7" width="2.5" height="5.5" rx="1" stroke="currentColor" stroke-width="1.3"/>
          <rect x="5.75" y="4" width="2.5" height="8.5" rx="1" stroke="currentColor" stroke-width="1.3"/>
          <rect x="10" y="1.5" width="2.5" height="11" rx="1" stroke="currentColor" stroke-width="1.3"/>
        </svg>
        <svg v-else-if="icon === 'bolt'" width="15" height="15" viewBox="0 0 14 14" fill="none">
          <path d="M8.5 1.5L4 7.5h4.5L5.5 12.5l6-7H7L8.5 1.5Z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
        </svg>
      </div>
    </div>

    <div class="metric-value mono">{{ value ?? '—' }}</div>

    <div class="metric-footer">
      <div class="metric-bar">
        <div class="metric-bar-fill" :class="status" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  label: string
  value: string | number | null
  icon?: 'phone' | 'check' | 'bar' | 'bolt'
  status?: 'pass' | 'fail' | 'warn' | null
}>()
</script>

<style scoped>
.metric-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 20px 22px 16px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
  position: relative;
  overflow: hidden;
  transition: border-color var(--t-base), box-shadow var(--t-base);
}

.metric-card::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 2px;
  background: var(--border);
  transition: background var(--t-base);
}

.metric-card.pass::before { background: var(--pass); }
.metric-card.fail::before { background: var(--fail); }
.metric-card.warn::before { background: var(--warn); }

/* ── Header ──────────────────────────────────────────────── */
.metric-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.metric-label {
  font-size: 11.5px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
  line-height: 1.3;
}

.metric-icon {
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: var(--icon-bg);
  color: var(--text-muted);
  border: 1px solid var(--border-subtle);
  flex-shrink: 0;
  transition: all var(--t-base);
}

.metric-icon.pass { background: var(--pass-dim); color: var(--pass); border-color: rgba(0,201,141,0.2); }
.metric-icon.fail { background: var(--fail-dim); color: var(--fail); border-color: rgba(255,65,105,0.2); }
.metric-icon.warn { background: var(--warn-dim); color: var(--warn); border-color: rgba(245,158,11,0.2); }

/* ── Value ───────────────────────────────────────────────── */
.metric-value {
  font-size: 32px;
  font-weight: 600;
  color: var(--text);
  line-height: 1;
  letter-spacing: -0.03em;
}

/* ── Footer ──────────────────────────────────────────────── */
.metric-footer {
  margin-top: auto;
}

.metric-bar {
  height: 3px;
  background: var(--border-subtle);
  border-radius: 2px;
  overflow: hidden;
}

.metric-bar-fill {
  height: 100%;
  width: 100%;
  background: var(--border);
  border-radius: 2px;
  opacity: 0.5;
}

.metric-bar-fill.pass { background: var(--pass); opacity: 0.7; }
.metric-bar-fill.fail { background: var(--fail); opacity: 0.7; }
.metric-bar-fill.warn { background: var(--warn); opacity: 0.7; }
</style>
