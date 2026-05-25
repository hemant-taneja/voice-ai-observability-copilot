<template>
  <div class="use-action" :class="[type, { 'is-reviewed': reviewed }]">

    <!-- Top row: type label + review button -->
    <div class="ua-top">
      <div class="ua-left">
        <div class="ua-type-row">
          <span class="ua-icon">{{ typeIcon }}</span>
          <span class="ua-type">{{ typeLabel }}</span>
          <span v-if="turnIndex != null" class="turn-chip mono">turn {{ turnIndex }}</span>
        </div>
        <span class="ua-meaning">{{ typeMeaning }}</span>
      </div>

      <button
        class="review-btn"
        :class="{ reviewed }"
        @click="toggleReviewed"
        :title="reviewed ? (isEscalation ? 'Mark as unhandled' : 'Mark as pending') : (isEscalation ? 'Mark as handled — remove from escalation banner' : 'Mark as reviewed')"
      >
        <svg v-if="reviewed" width="11" height="11" viewBox="0 0 11 11" fill="none">
          <path d="M1.5 5.5l3 3 5-5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <svg v-else width="11" height="11" viewBox="0 0 11 11" fill="none">
          <circle cx="5.5" cy="5.5" r="4.5" stroke="currentColor" stroke-width="1.3"/>
        </svg>
        <span>{{ reviewed ? reviewedBtnLabel : reviewBtnLabel }}</span>
      </button>
    </div>

    <!-- Description -->
    <p class="ua-desc">{{ description }}</p>

    <!-- Note area -->
    <div class="note-section">
      <div v-if="note && !noteOpen" class="note-preview" @click="openNote">
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M1.5 8.5l1-3 5.5-5.5.5.5L3 6.5z" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/>
        </svg>
        <span>{{ note }}</span>
      </div>

      <button v-else-if="!noteOpen" class="add-note-btn" @click="openNote">
        + Add coaching note
      </button>

      <div v-if="noteOpen" class="note-edit">
        <textarea
          ref="noteRef"
          v-model="note"
          class="note-area"
          placeholder="Describe the action taken, coaching point, or follow-up…"
          rows="2"
          @keydown.escape="noteOpen = false"
          @input="saveNote"
        />
        <div class="note-edit-footer">
          <button class="note-done-btn" @click="saveNote(); noteOpen = false">Done</button>
          <button v-if="note" class="note-clear-btn" @click="clearNote">Clear</button>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { computed, ref, nextTick, onMounted } from 'vue'

const props = defineProps<{
  type: 'missed_opportunity' | 'deviation' | 'escalation_needed'
  description: string
  turnIndex?: number | null
  actionId?: string | null
}>()

// ── localStorage keys ──────────────────────────────────────
// escalation_needed uses a separate key so AgentDetail can query it independently
const isEscalation = computed(() => props.type === 'escalation_needed')
const keyReviewed  = computed(() => {
  if (!props.actionId) return null
  return isEscalation.value
    ? `ua-escalation-handled-${props.actionId}`
    : `ua-reviewed-${props.actionId}`
})
const keyNote = computed(() => props.actionId ? `ua-note-${props.actionId}` : null)

// ── State ──────────────────────────────────────────────────
const reviewed = ref(false)
const note     = ref('')
const noteOpen = ref(false)
const noteRef  = ref<HTMLTextAreaElement | null>(null)

onMounted(() => {
  if (keyReviewed.value) reviewed.value = localStorage.getItem(keyReviewed.value) === 'true'
  if (keyNote.value)     note.value     = localStorage.getItem(keyNote.value) ?? ''
})

// ── Actions ────────────────────────────────────────────────
function toggleReviewed() {
  reviewed.value = !reviewed.value
  if (keyReviewed.value) localStorage.setItem(keyReviewed.value, String(reviewed.value))
}

async function openNote() {
  noteOpen.value = true
  await nextTick()
  noteRef.value?.focus()
}

function saveNote() {
  if (keyNote.value) localStorage.setItem(keyNote.value, note.value)
}

function clearNote() {
  note.value = ''
  saveNote()
  noteOpen.value = false
}

// ── Label maps ─────────────────────────────────────────────
const typeLabel = computed(() => ({
  missed_opportunity: 'Missed Opportunity',
  deviation:          'Script Deviation',
  escalation_needed:  'Escalation Needed',
}[props.type]))

const typeIcon = computed(() => ({
  missed_opportunity: '◈',
  deviation:          '△',
  escalation_needed:  '⚠',
}[props.type]))

const typeMeaning = computed(() => ({
  missed_opportunity: 'Agent could have acted but didn\'t — coaching opportunity',
  deviation:          'Agent deviated from the expected script or process',
  escalation_needed:  'This segment requires human review or intervention',
}[props.type]))

// ── Review button labels (differ for escalation type) ──────
const reviewBtnLabel    = computed(() => isEscalation.value ? 'Mark as handled' : 'Review')
const reviewedBtnLabel  = computed(() => isEscalation.value ? 'Handled ✓' : 'Reviewed')
</script>

<style scoped>
.use-action {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  border-left: 3px solid var(--warn);
  background: rgba(255, 171, 46, 0.06);
  transition: opacity var(--t-base);
}

.use-action.deviation {
  border-left-color: var(--accent);
  background: rgba(79, 136, 255, 0.06);
}

.use-action.escalation_needed {
  border-left-color: var(--fail);
  background: rgba(255, 65, 105, 0.06);
}

.use-action.is-reviewed {
  opacity: 0.5;
}

/* ── Top row ─────────────────────────────────────────────── */
.ua-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.ua-left {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.ua-type-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.ua-icon {
  font-size: 12px;
  color: var(--warn);
  flex-shrink: 0;
}

.use-action.deviation .ua-icon         { color: var(--accent); }
.use-action.escalation_needed .ua-icon { color: var(--fail); }

.ua-type {
  font-size: 10px;
  font-family: var(--font-mono);
  font-weight: 700;
  letter-spacing: 0.07em;
  color: var(--warn);
  text-transform: uppercase;
}

.use-action.deviation .ua-type         { color: var(--accent); }
.use-action.escalation_needed .ua-type { color: var(--fail); }

.turn-chip {
  font-size: 9.5px;
  color: var(--text-muted);
  background: var(--bg-hover);
  border: 1px solid var(--border);
  padding: 0 5px;
  border-radius: 4px;
  margin-left: 2px;
}

.ua-meaning {
  font-size: 10.5px;
  color: var(--text-muted);
  font-style: italic;
  line-height: 1.3;
}

/* ── Review button ───────────────────────────────────────── */
.review-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 10.5px;
  font-weight: 600;
  font-family: var(--font-sans);
  padding: 3px 8px;
  border-radius: 99px;
  border: 1px solid var(--border);
  background: var(--bg-hover);
  color: var(--text-muted);
  cursor: pointer;
  transition: all var(--t-fast);
  flex-shrink: 0;
  white-space: nowrap;
}

.review-btn:hover {
  background: var(--pass-dim);
  border-color: rgba(0, 201, 141, 0.3);
  color: var(--pass);
}

.review-btn.reviewed {
  background: var(--pass-dim);
  border-color: rgba(0, 201, 141, 0.3);
  color: var(--pass);
}

.review-btn.reviewed:hover {
  background: var(--fail-dim);
  border-color: rgba(255, 65, 105, 0.3);
  color: var(--fail);
}

/* ── Description ─────────────────────────────────────────── */
.ua-desc {
  font-size: 13px;
  color: var(--text-2);
  line-height: 1.5;
  margin: 0;
}

/* ── Note section ────────────────────────────────────────── */
.note-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.add-note-btn {
  align-self: flex-start;
  font-size: 11px;
  font-weight: 500;
  font-family: var(--font-sans);
  color: var(--text-muted);
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  transition: color var(--t-fast);
}

.add-note-btn:hover { color: var(--accent); }

.note-preview {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  font-size: 11.5px;
  color: var(--text-muted);
  font-style: italic;
  line-height: 1.4;
  cursor: pointer;
  padding: 6px 8px;
  border-radius: var(--radius-xs);
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  transition: border-color var(--t-fast);
}

.note-preview:hover { border-color: var(--border); }

.note-preview svg {
  flex-shrink: 0;
  margin-top: 2px;
  color: var(--accent);
}

.note-edit {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.note-area {
  width: 100%;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-xs);
  padding: 7px 10px;
  color: var(--text);
  font-family: var(--font-sans);
  font-size: 12px;
  line-height: 1.5;
  resize: vertical;
  box-sizing: border-box;
  transition: border-color var(--t-fast);
}

.note-area::placeholder { color: var(--text-muted); }
.note-area:focus { outline: none; border-color: var(--accent); }

.note-edit-footer {
  display: flex;
  align-items: center;
  gap: 8px;
}

.note-done-btn {
  font-size: 11px;
  font-weight: 600;
  font-family: var(--font-sans);
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: var(--radius-xs);
  padding: 4px 12px;
  cursor: pointer;
  transition: opacity var(--t-fast);
}

.note-done-btn:hover { opacity: 0.85; }

.note-clear-btn {
  font-size: 11px;
  font-weight: 500;
  font-family: var(--font-sans);
  background: none;
  color: var(--text-muted);
  border: none;
  padding: 0;
  cursor: pointer;
  transition: color var(--t-fast);
}

.note-clear-btn:hover { color: var(--fail); }
</style>
