<template>
  <div class="kpi-editor">
    <button class="toggle-btn mono" @click="open = !open">{{ open ? '▲' : '▼' }} KPI CONFIGURATION</button>

    <div v-if="open" class="editor-body">
      <div class="goals-list">
        <div v-for="(goal, i) in localGoals" :key="i" class="goal-row">
          <input v-model="goal.name" class="goal-input" placeholder="Goal name" />
          <input v-model.number="goal.weight" type="number" min="0" max="1" step="0.05" class="weight-input mono" />
          <input v-model="goal.description" class="desc-input" placeholder="What does success look like?" />
          <button class="remove-btn" @click="removeGoal(i)">✕</button>
        </div>
      </div>

      <button class="add-btn" @click="addGoal">+ Add Goal</button>

      <div class="threshold-row">
        <label class="mono">Pass threshold</label>
        <input v-model.number="localThreshold" type="number" min="0" max="1" step="0.05" class="weight-input mono" />
      </div>

      <button class="save-btn" :disabled="saving" @click="save">{{ saving ? 'Saving...' : 'Save Configuration' }}</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import type { KpiGoal } from '../types/analysis.types'

const props = defineProps<{
  agentId: string
  locationId: string
  initialGoals: KpiGoal[]
  initialThreshold: number
}>()

const emit = defineEmits<{ save: [goals: KpiGoal[], threshold: number] }>()

const open = ref(false)
const saving = ref(false)
const localGoals = ref<KpiGoal[]>(props.initialGoals.map((g) => ({ ...g })))
const localThreshold = ref(props.initialThreshold)

watch(() => props.initialGoals, (val) => { localGoals.value = val.map((g) => ({ ...g })) })

function addGoal() { localGoals.value.push({ name: '', description: '', weight: 0 }) }
function removeGoal(index: number) { localGoals.value.splice(index, 1) }

async function save() {
  saving.value = true
  try {
    emit('save', localGoals.value, localThreshold.value)
  } finally {
    saving.value = false
    open.value = false
  }
}
</script>

<style scoped>
.kpi-editor { border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
.toggle-btn {
  width: 100%; padding: var(--space-3) var(--space-4);
  background: var(--bg-surface); border: none;
  color: var(--text-secondary); font-size: 11px;
  letter-spacing: 0.08em; cursor: pointer; text-align: left;
}
.toggle-btn:hover { background: var(--bg-elevated); color: var(--text-primary); }
.editor-body {
  padding: var(--space-4); background: var(--bg-surface);
  display: flex; flex-direction: column; gap: var(--space-3);
  border-top: 1px solid var(--border);
}
.goal-row { display: grid; grid-template-columns: 1fr 60px 2fr 24px; gap: var(--space-2); align-items: center; }
input {
  background: var(--bg-base); border: 1px solid var(--border);
  border-radius: 4px; padding: var(--space-2) var(--space-3);
  color: var(--text-primary); font-family: var(--font-ui); font-size: 13px;
}
input:focus { outline: none; border-color: var(--signal); }
.weight-input { font-family: var(--font-mono); font-size: 13px; }
.threshold-row { display: flex; align-items: center; justify-content: space-between; }
.threshold-row label { font-size: 12px; color: var(--text-secondary); }
.add-btn, .save-btn, .remove-btn {
  background: none; border: 1px solid var(--border);
  color: var(--text-secondary); padding: var(--space-2) var(--space-3);
  border-radius: 4px; cursor: pointer; font-size: 12px; font-family: var(--font-ui);
}
.save-btn { background: var(--signal); color: #000; border-color: var(--signal); font-weight: 500; }
.save-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.remove-btn { border: none; padding: 0 4px; font-size: 14px; }
</style>
