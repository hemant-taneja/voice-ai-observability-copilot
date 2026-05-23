<template>
  <div class="use-action-badge">
    <span class="ua-type mono">⚡ {{ typeLabel }}</span>
    <p class="ua-description">{{ description }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  type: 'missed_opportunity' | 'deviation' | 'escalation_needed'
  description: string
}>()

const typeLabel = computed(() => ({
  missed_opportunity: 'MISSED OPPORTUNITY',
  deviation: 'DEVIATION',
  escalation_needed: 'ESCALATION NEEDED',
}[props.type]))
</script>

<style scoped>
.use-action-badge {
  margin: var(--space-2) 0;
  border-left: 3px solid var(--signal);
  padding: var(--space-2) var(--space-4);
  background: rgba(245, 158, 11, 0.06);
  border-radius: 0 4px 4px 0;
}
.ua-type { font-size: 10px; letter-spacing: 0.1em; color: var(--signal); display: block; margin-bottom: 2px; }
.ua-description { font-size: 12px; color: var(--text-secondary); line-height: 1.4; }
</style>
