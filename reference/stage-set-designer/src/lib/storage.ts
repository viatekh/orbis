import type { StateStorage } from 'zustand/middleware'

// Zustand's persist middleware writes on every state change — dragging a
// slider fires ~60 updates/sec, each serializing the whole project. This
// debounces the actual localStorage write and flushes on tab-hide/unload so
// nothing is lost.
function createDebouncedLocalStorage(delayMs: number): StateStorage {
  let pendingValue: string | null = null
  let pendingName: string | null = null
  let timer: ReturnType<typeof setTimeout> | null = null

  const flush = () => {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    if (pendingName !== null && pendingValue !== null) {
      localStorage.setItem(pendingName, pendingValue)
      pendingName = null
      pendingValue = null
    }
  }

  if (typeof window !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush()
    })
    window.addEventListener('beforeunload', flush)
  }

  return {
    getItem: (name) => localStorage.getItem(name),
    setItem: (name, value) => {
      pendingName = name
      pendingValue = value
      if (timer) clearTimeout(timer)
      timer = setTimeout(flush, delayMs)
    },
    removeItem: (name) => {
      pendingName = null
      pendingValue = null
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
      localStorage.removeItem(name)
    },
  }
}

export const debouncedLocalStorage = createDebouncedLocalStorage(400)
