<template>
  <div class="diff-panel">
    <div class="diff-header">
      <div class="diff-title-row">
        <span class="diff-title">Suggested Script Changes</span>
        <span class="diff-count mono">{{ suggestions.length }} suggestion{{ suggestions.length !== 1 ? 's' : '' }}</span>
      </div>
      <div class="diff-actions">
        <button class="dismiss-btn" @click="$emit('dismiss')">Dismiss</button>
        <button class="save-btn" @click="handleSave">
          Save to Script
        </button>
      </div>
    </div>

    <div class="diff-legend">
      <span class="legend-item removed-legend">− Removed</span>
      <span class="legend-item added-legend">+ Added</span>
    </div>

    <div class="diff-body">
      <div
        v-for="(chunk, i) in diffChunks"
        :key="i"
        class="diff-line"
        :class="{
          'diff-removed': chunk.removed,
          'diff-added': chunk.added,
        }"
      >
        <span class="diff-gutter">{{ chunk.removed ? '−' : chunk.added ? '+' : ' ' }}</span>
        <span class="diff-text">{{ chunk.value }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { diffLines } from 'diff'
import type { ScriptSuggestion } from '../types/analysis.types'

const props = defineProps<{
  currentScript: string
  suggestions: ScriptSuggestion[]
}>()

const emit = defineEmits<{
  save: [newScript: string]
  dismiss: []
}>()

// Apply all suggestions to produce the merged script
const suggestedScript = computed((): string => {
  let merged = props.currentScript
  for (const s of props.suggestions) {
    if (s.currentApproach && merged.includes(s.currentApproach)) {
      merged = merged.replace(s.currentApproach, s.suggestedScript)
    } else {
      merged += `\n\n## ${s.sectionTitle} — Suggested Addition\n${s.suggestedScript}`
    }
  }
  return merged
})

// Line-level diff chunks between current and suggested
const diffChunks = computed(() => {
  return diffLines(props.currentScript, suggestedScript.value)
    .flatMap((chunk) => {
      // Split multi-line chunks into individual lines so each gets its own row
      const lines = chunk.value.split('\n')
      // Remove trailing empty string from trailing newline split
      if (lines[lines.length - 1] === '') lines.pop()
      return lines.map((line) => ({
        value: line,
        added: chunk.added ?? false,
        removed: chunk.removed ?? false,
      }))
    })
})

function handleSave() {
  emit('save', suggestedScript.value)
}
</script>

<style scoped>
.diff-panel {
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--bg-surface);
}

.diff-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  background: var(--bg-card);
  border-bottom: 1px solid var(--border);
  flex-wrap: wrap;
}

.diff-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.diff-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-2);
}

.diff-count {
  font-size: 10.5px;
  color: var(--accent);
  background: rgba(79, 136, 255, 0.1);
  border: 1px solid rgba(79, 136, 255, 0.2);
  padding: 1px 8px;
  border-radius: 99px;
}

.diff-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.dismiss-btn {
  font-size: 12px;
  font-weight: 600;
  font-family: var(--font-sans);
  background: none;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 6px 14px;
  color: var(--text-muted);
  cursor: pointer;
  transition: all var(--t-fast);
}

.dismiss-btn:hover {
  background: var(--bg-hover);
  color: var(--text-2);
}

.save-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  font-family: var(--font-sans);
  background: var(--accent);
  border: none;
  border-radius: var(--radius-sm);
  padding: 6px 14px;
  color: #fff;
  cursor: pointer;
  transition: opacity var(--t-fast);
}

.save-btn:hover:not(:disabled) { opacity: 0.88; }
.save-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.diff-legend {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 6px 16px;
  border-bottom: 1px solid var(--border-subtle);
  background: var(--bg-card);
}

.legend-item {
  font-size: 11px;
  font-family: var(--font-mono);
  font-weight: 600;
}

.removed-legend { color: #dc2626; }
.added-legend   { color: #16a34a; }

.diff-body {
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.6;
  overflow-y: auto;
  max-height: 420px;
}

.diff-line {
  display: flex;
  align-items: flex-start;
  gap: 0;
  padding: 0;
}

.diff-removed {
  background: rgba(220, 38, 38, 0.08);
}

.diff-added {
  background: rgba(22, 163, 74, 0.08);
}

.diff-gutter {
  width: 28px;
  min-width: 28px;
  text-align: center;
  padding: 1px 0;
  color: var(--text-muted);
  user-select: none;
  flex-shrink: 0;
}

.diff-removed .diff-gutter { color: #dc2626; }
.diff-added   .diff-gutter { color: #16a34a; }

.diff-text {
  flex: 1;
  padding: 1px 10px 1px 0;
  color: var(--text-2);
  white-space: pre-wrap;
  word-break: break-word;
}

.diff-removed .diff-text { color: #dc2626; }
.diff-added   .diff-text { color: #16a34a; }

.spin { animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
