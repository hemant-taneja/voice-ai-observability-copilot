<template>
  <div class="kpi-editor">
    <button class="toggle-btn" @click="open = !open">
      <div class="toggle-left">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <rect x="1.5" y="1.5" width="4" height="4" rx="1" stroke="currentColor" stroke-width="1.3"/>
          <rect x="8.5" y="1.5" width="4" height="4" rx="1" stroke="currentColor" stroke-width="1.3"/>
          <rect x="1.5" y="8.5" width="4" height="4" rx="1" stroke="currentColor" stroke-width="1.3"/>
          <rect x="8.5" y="8.5" width="4" height="4" rx="1" stroke="currentColor" stroke-width="1.3"/>
        </svg>
        <span>KPI Configuration</span>
        <span class="goal-count mono">{{ localGoals.length }} goals</span>
      </div>
      <svg
        class="chevron"
        width="14" height="14" viewBox="0 0 14 14" fill="none"
        :style="{ transform: open ? 'rotate(180deg)' : 'none' }"
      >
        <path d="M3 5l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>

    <div v-if="open" class="editor-body">
      <div class="goals-list">
        <div v-for="(goal, i) in localGoals" :key="i" class="goal-row">
          <div class="goal-fields">
            <input v-model="goal.name" class="input-field" placeholder="Goal name (e.g. Book Appointment)" />
            <input v-model="goal.description" class="input-field desc" placeholder="Success criteria..." />
          </div>
          <div class="goal-actions">
            <div class="weight-wrap">
              <label class="weight-label mono">wt</label>
              <input v-model.number="goal.weight" type="number" min="0" max="1" step="0.05" class="input-field weight mono" />
            </div>
            <button class="remove-btn" @click="removeGoal(i)" title="Remove goal">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div class="goal-toolbar">
        <button class="add-btn" @click="addGoal">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M6 1v10M1 6h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          Add Goal
        </button>
        <button class="suggest-btn" :disabled="suggesting" @click="suggestGoals" title="Derive goals from the agent's script via AI">
          <svg v-if="suggesting" width="12" height="12" viewBox="0 0 12 12" fill="none" class="spin">
            <circle cx="6" cy="6" r="4.5" stroke="currentColor" stroke-width="1.5" stroke-dasharray="14" stroke-dashoffset="4"/>
          </svg>
          <svg v-else width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M6 1l1.5 3.5H11l-2.8 2 1.1 3.5L6 8 2.7 10l1.1-3.5L1 4.5h3.5z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>
          </svg>
          {{ suggesting ? 'Suggesting…' : 'Suggest from Script' }}
        </button>
      </div>
      <p v-if="suggestError" class="suggest-error">{{ suggestError }}</p>

      <div class="threshold-row">
        <div class="threshold-label">
          <span>Pass threshold</span>
          <span class="mono dim">Agent passes if score ≥ this value</span>
        </div>
        <input
          v-model.number="localThreshold"
          type="number" min="0" max="1" step="0.05"
          class="input-field weight mono"
        />
      </div>

      <div class="editor-footer">
        <button class="save-btn" :disabled="saving" @click="save">
          <svg v-if="saving" width="12" height="12" viewBox="0 0 12 12" fill="none" class="spin">
            <circle cx="6" cy="6" r="4.5" stroke="currentColor" stroke-width="1.5" stroke-dasharray="14" stroke-dashoffset="4"/>
          </svg>
          {{ saving ? 'Saving…' : 'Save Configuration' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import type { KpiGoal } from '../types/analysis.types'
import { kpiApi } from '../api/kpi'

const props = defineProps<{
  agentId: string
  locationId: string
  initialGoals: KpiGoal[]
  initialThreshold: number
}>()

const emit = defineEmits<{ save: [goals: KpiGoal[], threshold: number] }>()

const open = ref(false)
const saving = ref(false)
const suggesting = ref(false)
const suggestError = ref<string | null>(null)
const localGoals = ref<KpiGoal[]>(props.initialGoals.map((g) => ({ ...g })))
const localThreshold = ref(props.initialThreshold)

watch(() => props.initialGoals, (val) => { localGoals.value = val.map((g) => ({ ...g })) })

function addGoal() { localGoals.value.push({ name: '', description: '', weight: 0.33 }) }
function removeGoal(index: number) { localGoals.value.splice(index, 1) }

async function suggestGoals() {
  suggesting.value = true
  suggestError.value = null
  try {
    const goals = await kpiApi.suggestGoals(props.agentId, props.locationId)
    localGoals.value = goals
  } catch {
    suggestError.value = 'Could not suggest goals — make sure the agent has a script set.'
  } finally {
    suggesting.value = false
  }
}

async function save() {
  saving.value = true
  try { emit('save', localGoals.value, localThreshold.value) }
  finally { saving.value = false; open.value = false }
}
</script>

<style scoped>
.kpi-editor {
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  background: var(--bg-card);
}

/* ── Toggle button ───────────────────────────────────────── */
.toggle-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  background: none;
  border: none;
  color: var(--text-2);
  font-size: 13.5px;
  font-weight: 600;
  cursor: pointer;
  transition: background var(--t-fast), color var(--t-fast);
}

.toggle-btn:hover {
  background: var(--bg-hover);
  color: var(--text);
}

.toggle-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.goal-count {
  font-size: 10px;
  color: var(--text-muted);
  background: var(--bg-hover);
  border: 1px solid var(--border);
  padding: 1px 7px;
  border-radius: 99px;
}

.chevron {
  color: var(--text-muted);
  transition: transform 200ms ease;
  flex-shrink: 0;
}

/* ── Editor body ─────────────────────────────────────────── */
.editor-body {
  padding: 16px 18px;
  border-top: 1px solid var(--border-subtle);
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* ── Goals ───────────────────────────────────────────────── */
.goals-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.goal-row {
  display: flex;
  gap: 8px;
  align-items: flex-start;
}

.goal-fields {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.goal-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  padding-top: 1px;
}

.weight-wrap {
  display: flex;
  align-items: center;
  gap: 4px;
}

.weight-label {
  font-size: 10px;
  color: var(--text-muted);
}

/* ── Inputs ──────────────────────────────────────────────── */
.input-field {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 7px 10px;
  color: var(--text);
  font-family: var(--font-sans);
  font-size: 13px;
  width: 100%;
  transition: border-color var(--t-fast);
}

.input-field::placeholder { color: var(--text-muted); }

.input-field:focus {
  outline: none;
  border-color: var(--accent);
}

.input-field.desc {
  font-size: 12px;
  color: var(--text-2);
}

.input-field.weight {
  width: 60px;
  text-align: center;
  padding: 7px 6px;
}

/* ── Buttons ─────────────────────────────────────────────── */
.remove-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  cursor: pointer;
  transition: all var(--t-fast);
  flex-shrink: 0;
}

.remove-btn:hover {
  background: var(--fail-dim);
  border-color: rgba(255,65,105,0.3);
  color: var(--fail);
}

.add-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: none;
  border: 1px dashed var(--border);
  border-radius: var(--radius-sm);
  padding: 7px 14px;
  color: var(--text-2);
  font-size: 12.5px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--t-fast);
  align-self: flex-start;
}

.add-btn:hover {
  background: var(--accent-dim);
  border-color: rgba(79,136,255,0.3);
  color: var(--accent);
}

/* ── Goal toolbar ────────────────────────────────────────── */
.goal-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.suggest-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: none;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 7px 14px;
  color: var(--text-2);
  font-size: 12.5px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--t-fast);
}

.suggest-btn:hover:not(:disabled) {
  background: rgba(79, 136, 255, 0.08);
  border-color: rgba(79, 136, 255, 0.4);
  color: var(--accent);
}

.suggest-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.suggest-error {
  font-size: 11.5px;
  color: var(--fail);
  margin: 0;
}

/* ── Threshold ───────────────────────────────────────────── */
.threshold-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
}

.threshold-label {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.threshold-label span:first-child {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
}

.dim { color: var(--text-muted); font-size: 11px; }

/* ── Footer ──────────────────────────────────────────────── */
.editor-footer {
  display: flex;
  justify-content: flex-end;
}

.save-btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  background: var(--accent);
  border: none;
  border-radius: var(--radius-sm);
  padding: 9px 20px;
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity var(--t-fast), transform var(--t-fast);
}

.save-btn:hover:not(:disabled) {
  opacity: 0.9;
  transform: translateY(-1px);
}

.save-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.spin { animation: spin 0.8s linear infinite; }
</style>
