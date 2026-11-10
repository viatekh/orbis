import type { ReactNode } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useUiSettingsStore } from '../../store/uiSettingsStore'

/** A titled section that can be collapsed to just its header — the state
 * persists (per section `id`) across reloads, via the same personal-
 * preference store the per-control hide/show mechanism uses. Meant for the
 * sidebar's own top-level panels (Shape, Pattern, Fabrication, Export…),
 * which — unlike the enabled-gated sections inside Pattern (Radial
 * effects, Dispersion, Surface detail, Edge detail) — have no existing
 * on/off switch of their own to double as a collapse control. */
export function CollapsibleSection({
  id,
  title,
  headerRight,
  /** Subtle style for a secondary toggle nested inside another section
   * (e.g. Fabrication's own "Advanced" block) — same collapse behavior and
   * persistence, but sized/colored to read as a minor sub-toggle rather
   * than competing with the enclosing section's own header. */
  compact = false,
  children,
}: {
  id: string
  title: string
  headerRight?: ReactNode
  compact?: boolean
  children: ReactNode
}) {
  const collapsed = useUiSettingsStore((s) => s.collapsedSections.includes(id))
  const toggle = useUiSettingsStore((s) => s.toggleSectionCollapsed)
  const iconSize = compact ? 12 : 14

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => toggle(id)}
          className={cn(
            'flex items-center gap-1.5',
            compact ? 'text-xs text-neutral-500 hover:text-neutral-300' : 'text-sm font-medium text-neutral-200 hover:text-white',
          )}
          aria-expanded={!collapsed}
        >
          {collapsed ? <ChevronRight size={iconSize} /> : <ChevronDown size={iconSize} />}
          {title}
        </button>
        {headerRight}
      </div>
      <div className={cn('flex flex-col gap-4', collapsed && 'hidden')}>{children}</div>
    </div>
  )
}
