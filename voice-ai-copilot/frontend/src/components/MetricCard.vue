<template>
  <div class="metric-card">
    <span class="metric-label">{{ label }}</span>
    <span class="metric-value">{{ value ?? '—' }}</span>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  label: string
  value: string | number | null
}>()
</script>

<style scoped>
.metric-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: var(--space-4) var(--space-5);
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  min-width: 140px;
}
.metric-label {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-muted);
}
.metric-value {
  font-family: var(--font-mono);
  font-size: 28px;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1;
}
</style>
