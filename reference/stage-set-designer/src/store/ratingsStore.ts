import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { generateId } from '../lib/utils'
import type { ShapePrimitive, PatternConfig, GeometryStats } from '../lib/geometry/types'
import type { CenterHoleConfig } from '../types'

export type DesignRating = 'good' | 'ok'

export interface RatingEntry {
  id: string
  rating: DesignRating
  createdAt: string
  componentName: string
  shape: ShapePrimitive
  pattern: PatternConfig
  centerHole: CenterHoleConfig
  stats: Pick<GeometryStats, 'leafCells' | 'totalCells' | 'cutAreaMm2' | 'materialAreaMm2'>
}

interface RatingsState {
  entries: RatingEntry[]
  addRating: (entry: Omit<RatingEntry, 'id' | 'createdAt'>) => void
  removeRating: (id: string) => void
  clearRatings: () => void
}

/** A separate store/localStorage key from both the project store and the UI
 * prefs store: these are training-data snapshots (what a rated design's full
 * params looked like at rating time), not current project state or personal
 * layout preferences, so they shouldn't travel with project export/import
 * and should keep accumulating across whatever project is currently open. */
export const useRatingsStore = create<RatingsState>()(
  persist(
    (set) => ({
      entries: [],
      addRating: (entry) =>
        set((s) => ({
          entries: [...s.entries, { ...entry, id: generateId(), createdAt: new Date().toISOString() }],
        })),
      removeRating: (id) => set((s) => ({ entries: s.entries.filter((e) => e.id !== id) })),
      clearRatings: () => set({ entries: [] }),
    }),
    {
      name: 'stage-set-designer-ratings',
      storage: createJSONStorage(() => localStorage),
    },
  ),
)
