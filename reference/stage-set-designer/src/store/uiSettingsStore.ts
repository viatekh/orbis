import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

interface UiSettingsState {
  /** When on: every hideable control shows a small eye toggle next to it,
   * and controls already hidden render dimmed (rather than vanishing) so
   * they can be brought back. When off: hidden controls simply don't
   * render, and the toggles themselves are invisible — a clean UI with no
   * trace of the hide mechanism. */
  debugMode: boolean
  hiddenControls: string[]
  toggleDebugMode: () => void
  setControlHidden: (id: string, hidden: boolean) => void
  /** Which top-level sidebar sections (Shape, Pattern, Fabrication, etc.)
   * are collapsed — presence in the array means collapsed, absence means
   * open, so every section defaults open without needing an entry. Kept
   * here alongside hiddenControls for the same reason: a personal layout
   * preference, not project data. */
  collapsedSections: string[]
  toggleSectionCollapsed: (id: string) => void
}

/** Deliberately a separate store/localStorage key from the project store —
 * this is a personal UI preference (which controls you've decided to hide),
 * not project data, so it shouldn't travel with project export/import and
 * shouldn't bump the project schema version. */
export const useUiSettingsStore = create<UiSettingsState>()(
  persist(
    (set) => ({
      debugMode: false,
      hiddenControls: [],
      collapsedSections: [],
      toggleDebugMode: () => set((s) => ({ debugMode: !s.debugMode })),
      setControlHidden: (id, hidden) =>
        set((s) => ({
          hiddenControls: hidden
            ? s.hiddenControls.includes(id)
              ? s.hiddenControls
              : [...s.hiddenControls, id]
            : s.hiddenControls.filter((c) => c !== id),
        })),
      toggleSectionCollapsed: (id) =>
        set((s) => ({
          collapsedSections: s.collapsedSections.includes(id)
            ? s.collapsedSections.filter((c) => c !== id)
            : [...s.collapsedSections, id],
        })),
    }),
    {
      name: 'stage-set-designer-ui-prefs',
      storage: createJSONStorage(() => localStorage),
    },
  ),
)
