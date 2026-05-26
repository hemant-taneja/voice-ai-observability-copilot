import { ref } from 'vue'

export interface Toast {
  id: number
  message: string
  type: 'success' | 'error'
}

let nextId = 0
const toasts = ref<Toast[]>([])

export function useToast() {
  function add(message: string, type: Toast['type'] = 'success', durationMs = 4000) {
    const id = ++nextId
    toasts.value.push({ id, message, type })
    setTimeout(() => remove(id), durationMs)
  }

  function remove(id: number) {
    const idx = toasts.value.findIndex((t) => t.id === id)
    if (idx !== -1) toasts.value.splice(idx, 1)
  }

  return { toasts, add, remove }
}
