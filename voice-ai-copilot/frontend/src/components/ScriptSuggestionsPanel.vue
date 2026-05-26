<template>
  <div class="suggestions-panel">
    <div class="panel-header">
      <div class="panel-title-row">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M2 10.5V12h1.5l5-5-1.5-1.5-5 5zM11.7 3.3a1 1 0 000-1.4l-1.6-1.6a1 1 0 00-1.4 0L7.5 1.5 10.5 4.5l1.2-1.2z"
            fill="currentColor"/>
        </svg>
        <span>Script Adjustments</span>
        <span class="count-badge mono">{{ suggestions.length }}</span>
      </div>
      <p class="panel-subtitle">
        Concrete script changes to address failures in this call
      </p>
    </div>

    <div class="suggestions-list">
      <div
        v-for="(s, i) in suggestions"
        :key="i"
        class="suggestion-card"
      >
        <div class="suggestion-header">
          <span class="section-tag">{{ s.sectionTitle }}</span>
        </div>

        <p class="issue-text">{{ s.issue }}</p>

        <div class="diff-block">
          <div class="diff-row current">
            <span class="diff-label">Current</span>
            <span class="diff-text">{{ s.currentApproach }}</span>
          </div>
          <div class="diff-arrow">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 2v10M3 8l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <div class="diff-row suggested">
            <span class="diff-label">Suggested</span>
            <span class="diff-text">{{ s.suggestedScript }}</span>
          </div>
        </div>

        <div class="impact-row">
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <circle cx="5.5" cy="5.5" r="5" stroke="currentColor" stroke-width="1.2"/>
            <path d="M5.5 3.5v2.5l1.5 1" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
          </svg>
          <span>{{ s.impact }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ScriptSuggestion } from '../types/analysis.types'

defineProps<{ suggestions: ScriptSuggestion[] }>()
</script>

<style scoped>
.suggestions-panel {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-left: 3px solid var(--warn);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

/* ── Header ──────────────────────────────────────────────── */
.panel-header {
  padding: 14px 18px 12px;
  border-bottom: 1px solid var(--border-subtle);
}

.panel-title-row {
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--warn);
  font-size: 13px;
  font-weight: 700;
  margin-bottom: 4px;
}

.count-badge {
  font-size: 10px;
  background: rgba(255, 167, 38, 0.15);
  border: 1px solid rgba(255, 167, 38, 0.25);
  color: var(--warn);
  padding: 1px 7px;
  border-radius: 99px;
}

.panel-subtitle {
  font-size: 11.5px;
  color: var(--text-muted);
  margin: 0;
}

/* ── Suggestions list ────────────────────────────────────── */
.suggestions-list {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.suggestion-card {
  padding: 14px 18px;
  border-bottom: 1px solid var(--border-subtle);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.suggestion-card:last-child {
  border-bottom: none;
}

/* ── Card header ─────────────────────────────────────────── */
.suggestion-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.section-tag {
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-2);
  background: var(--bg-hover);
  border: 1px solid var(--border);
  padding: 2px 8px;
  border-radius: 4px;
}

.issue-text {
  font-size: 13px;
  color: var(--text-2);
  line-height: 1.55;
  margin: 0;
}

/* ── Diff block ──────────────────────────────────────────── */
.diff-block {
  display: flex;
  flex-direction: column;
  gap: 4px;
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  padding: 10px 12px;
}

.diff-row {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}

.diff-label {
  font-size: 9.5px;
  font-family: var(--font-mono);
  font-weight: 700;
  letter-spacing: 0.06em;
  padding: 2px 6px;
  border-radius: 3px;
  flex-shrink: 0;
  margin-top: 1px;
  min-width: 60px;
  text-align: center;
}

.diff-row.current .diff-label {
  background: var(--fail-dim);
  color: var(--fail);
  border: 1px solid rgba(255, 65, 105, 0.2);
}

.diff-row.suggested .diff-label {
  background: var(--pass-dim);
  color: var(--pass);
  border: 1px solid rgba(0, 201, 141, 0.2);
}

.diff-text {
  font-size: 12.5px;
  color: var(--text);
  line-height: 1.5;
  font-style: italic;
}

.diff-arrow {
  display: flex;
  justify-content: center;
  color: var(--text-muted);
  padding: 2px 0;
}

/* ── Impact ──────────────────────────────────────────────── */
.impact-row {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  font-size: 11.5px;
  color: var(--text-muted);
  line-height: 1.45;
}

.impact-row svg {
  flex-shrink: 0;
  margin-top: 1px;
  color: var(--accent);
}
</style>
