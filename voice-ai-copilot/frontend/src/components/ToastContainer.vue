<template>
  <Teleport to="body">
    <div class="toast-container" aria-live="polite">
      <TransitionGroup name="toast" tag="div" class="toast-stack">
        <div
          v-for="toast in toasts"
          :key="toast.id"
          class="toast"
          :class="toast.type"
          @click="remove(toast.id)"
        >
          <span class="toast-dot" />
          <span class="toast-msg">{{ toast.message }}</span>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { useToast } from '../composables/useToast'

const { toasts, remove } = useToast()
</script>

<style scoped>
.toast-container {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 9999;
  pointer-events: none;
}

.toast-stack {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: flex-end;
}

.toast {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  border-radius: 8px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-left-width: 3px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-2);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18);
  pointer-events: all;
  cursor: pointer;
  min-width: 220px;
  max-width: 340px;
}

.toast.success { border-left-color: var(--pass); }
.toast.error   { border-left-color: var(--fail); }

.toast-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

.toast.success .toast-dot { background: var(--pass); }
.toast.error   .toast-dot { background: var(--fail); }

/* TransitionGroup animations */
.toast-enter-active { transition: all 250ms ease; }
.toast-leave-active { transition: all 200ms ease; }
.toast-enter-from   { opacity: 0; transform: translateX(20px); }
.toast-leave-to     { opacity: 0; transform: translateX(20px); }
</style>
