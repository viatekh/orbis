import {
  Shapes,
  Hexagon,
  Stamp,
  GitBranch,
  Waves,
  Cpu,
  Fish,
  Layers,
  Rows3,
  Route,
  Triangle,
  Shell,
  Activity,
  Grid2x2,
  Gem,
  Orbit,
  Flower2,
  Target,
  Scan,
  Dna,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { HideToggleButton } from './HideToggleButton'
import { useHideable } from './useHideable'
import type { PatternKind } from '../../types'

const KIND_META: Record<PatternKind, { label: string; hint: string; icon: typeof Shapes }> = {
  voronoi: { label: 'Voronoi', hint: 'Organic cells', icon: Shapes },
  hexagon: { label: 'Hexagon', hint: 'Honeycomb tiling', icon: Hexagon },
  stamp: { label: 'Stamp', hint: 'Repeated motif rings', icon: Stamp },
  vein: { label: 'Vein', hint: 'Branching fishbone', icon: GitBranch },
  flow: { label: 'Flow', hint: 'Wood-grain streamlines', icon: Waves },
  circuit: { label: 'Circuit', hint: 'PCB-trace routing', icon: Cpu },
  manta: { label: 'Manta', hint: 'Gill-like sweeping ribs', icon: Fish },
  scales: { label: 'Scales', hint: 'Overlapping shingles', icon: Layers },
  rungs: { label: 'Rungs', hint: 'Ladder rails + rungs', icon: Rows3 },
  maze: { label: 'Maze', hint: 'Perfect-maze corridors', icon: Route },
  sierpinski: { label: 'Sierpinski', hint: 'Recursive triangle fractal', icon: Triangle },
  truchet: { label: 'Truchet', hint: 'Randomized arc tiles', icon: Shell },
  zebra: { label: 'Zebra', hint: 'Parallel wavy stripes', icon: Activity },
  stagger: { label: 'Stagger', hint: 'Brick-bond grid', icon: Grid2x2 },
  marble: { label: 'Marble', hint: 'Chaotic swirled veining', icon: Gem },
  vesica: { label: 'Vesica', hint: 'Overlapping circle lattice', icon: Orbit },
  phyllo: { label: 'Phyllo', hint: 'Golden-angle seed spiral', icon: Flower2 },
  rings: { label: 'Rings', hint: 'Concentric arc bands', icon: Target },
  hilbert: { label: 'Hilbert', hint: 'Space-filling curve', icon: Scan },
  life: { label: 'Life', hint: "Conway's Game of Life", icon: Dna },
}

export const KIND_ORDER: PatternKind[] = [
  'voronoi',
  'hexagon',
  'stamp',
  'vein',
  'flow',
  'circuit',
  'manta',
  'scales',
  'rungs',
  'maze',
  'sierpinski',
  'truchet',
  'zebra',
  'stagger',
  'marble',
  'vesica',
  'phyllo',
  'rings',
  'hilbert',
  'life',
]

export function PatternKindPicker({ value, onChange }: { value: PatternKind; onChange: (kind: PatternKind) => void }) {
  const hideable = useHideable('Pattern kind')
  if (hideable.hidden && !hideable.debugMode) return null

  return (
    <div className={cn('flex flex-col gap-1.5', hideable.hidden && 'opacity-40')}>
      <div className="flex items-center gap-1.5">
        {hideable.debugMode && <HideToggleButton hidden={hideable.hidden} onToggle={hideable.toggle} />}
        <span className="text-xs font-medium text-neutral-400">Pattern kind</span>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {KIND_ORDER.map((kind) => {
          const meta = KIND_META[kind]
          const Icon = meta.icon
          const active = value === kind
          return (
            <button
              key={kind}
              type="button"
              onClick={() => onChange(kind)}
              title={meta.hint}
              className={cn(
                'flex flex-col items-center gap-1 rounded-lg border px-2 py-2 text-center transition-colors',
                active
                  ? 'border-purple-500 bg-purple-500/15 text-purple-200'
                  : 'border-neutral-700 bg-neutral-900 text-neutral-400 hover:border-neutral-600 hover:text-neutral-200',
              )}
            >
              <Icon size={16} />
              <span className="text-[11px] leading-tight">{meta.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
