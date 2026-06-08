<template>
  <div class="action-analytics">
    <div class="section-header-row">
      <h2 class="section-title">Action Analytics</h2>
      <span class="section-count mono">{{ analytics.length }}</span>
    </div>

    <div v-if="analytics.length === 0" class="empty-state">
      No actions synced for this agent yet — run a sync from HighLevel.
    </div>

    <div v-else class="action-list">
      <div v-for="a in analytics" :key="a.ghlActionId ?? a.name" class="action-card" :class="severity(a)">
        <div class="action-top">
          <div class="action-ident">
            <span class="action-icon">{{ toolIcon(a.actionType) }}</span>
            <div class="action-name-col">
              <span class="action-name">{{ a.name }}</span>
              <span class="action-type-badge mono">{{ a.actionType }}</span>
            </div>
          </div>
          <div class="action-stats">
            <span class="stat fire" title="Times invoked">{{ a.fireCount }}× fired</span>
            <span v-if="a.missedCount > 0" class="stat missed">{{ a.missedCount }} missed</span>
            <span v-if="a.incorrectCount > 0" class="stat incorrect">{{ a.incorrectCount }} incorrect</span>
          </div>
        </div>

        <!-- Diagnosed flaw in the action's triggerPrompt + suggested rewrite -->
        <div v-if="a.latestPromptFlaw" class="flaw-block">
          <div class="flaw-row">
            <span class="flaw-label">Trigger prompt flaw</span>
            <p class="flaw-text">{{ a.latestPromptFlaw }}</p>
          </div>
          <div v-if="a.triggerPrompt" class="flaw-row">
            <span class="flaw-label">Current trigger prompt</span>
            <p class="flaw-current mono">{{ a.triggerPrompt }}</p>
          </div>
          <div v-if="a.latestSuggestedTriggerPrompt" class="flaw-row">
            <span class="flaw-label suggested">Suggested trigger prompt</span>
            <p class="flaw-suggested mono">{{ a.latestSuggestedTriggerPrompt }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ActionAnalytics } from '../types/analysis.types'

defineProps<{ analytics: ActionAnalytics[] }>()

function severity(a: ActionAnalytics): string {
  if (a.incorrectCount > 0) return 'has-incorrect'
  if (a.missedCount > 0) return 'has-missed'
  return 'clean'
}

function toolIcon(actionType: string): string {
  return {
    SMS: '✉',
    APPOINTMENT_BOOKING: '📅',
    CALL_TRANSFER: '↗',
    WORKFLOW_TRIGGER: '⚡',
    DATA_EXTRACTION: '⛏',
    IN_CALL_DATA_EXTRACTION: '⛏',
    CUSTOM_ACTION: '◇',
    KNOWLEDGE_BASE: '📖',
  }[actionType] ?? '◇'
}
</script>

<style scoped>
.section-header-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.section-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-2);
  margin: 0;
}

.section-count {
  font-size: 11px;
  color: var(--text-muted);
  background: var(--bg-card);
  border: 1px solid var(--border);
  padding: 1px 8px;
  border-radius: 99px;
}

.empty-state {
  padding: 24px;
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
}

.action-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.action-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-left-width: 3px;
  border-radius: var(--radius-md);
  padding: 12px 14px;
}

.action-card.clean         { border-left-color: var(--pass); }
.action-card.has-missed    { border-left-color: var(--warn); }
.action-card.has-incorrect { border-left-color: var(--fail); }

.action-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.action-ident {
  display: flex;
  align-items: center;
  gap: 10px;
}

.action-icon {
  font-size: 15px;
  flex-shrink: 0;
  color: var(--text-2);
}

.action-name-col {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.action-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-2);
}

.action-type-badge {
  font-size: 9.5px;
  letter-spacing: 0.05em;
  color: var(--text-muted);
}

.action-stats {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.stat {
  font-size: 10.5px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 99px;
  white-space: nowrap;
}

.stat.fire      { background: var(--bg-hover);          color: var(--text-muted); }
.stat.missed    { background: rgba(255, 171, 46, 0.12); color: var(--warn); }
.stat.incorrect { background: rgba(255, 65, 105, 0.12); color: var(--fail); }

.flaw-block {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border-subtle);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.flaw-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.flaw-label {
  font-size: 9.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-muted);
}

.flaw-label.suggested { color: var(--pass); }

.flaw-text {
  font-size: 12px;
  color: var(--text-2);
  line-height: 1.5;
  margin: 0;
}

.flaw-current,
.flaw-suggested {
  font-size: 11.5px;
  line-height: 1.5;
  margin: 0;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  white-space: pre-wrap;
}

.flaw-current {
  background: var(--bg-surface);
  color: var(--text-muted);
  border: 1px solid var(--border);
}

.flaw-suggested {
  background: rgba(0, 201, 141, 0.06);
  color: var(--text-2);
  border: 1px solid rgba(0, 201, 141, 0.2);
}
</style>
