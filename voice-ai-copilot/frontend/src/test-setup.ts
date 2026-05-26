// Global stubs for browser APIs not implemented in jsdom

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
})

// EventSource is not implemented in jsdom
;(globalThis as unknown as Record<string, unknown>).EventSource = class {
  onopen: null = null
  onmessage: null = null
  onerror: null = null
  close() {}
}
