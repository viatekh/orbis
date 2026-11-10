import { NumberField } from './NumberField'
import { Select } from './Select'
import { SegmentedControl } from './SegmentedControl'
import type { EdgeDetailConfig, EdgeDetailKind } from '../../types'

const KIND_OPTIONS: { value: EdgeDetailKind; label: string }[] = [
  { value: 'dots', label: 'Dots' },
  { value: 'ticks', label: 'Ticks' },
  { value: 'dashes', label: 'Dashes' },
  { value: 'wave', label: 'Wave' },
  { value: 'zigzag', label: 'Zigzag' },
]

/** Shared field set for an EdgeDetailConfig — used both for the component's
 * own outer-edge decoration (PatternPanel) and a Portal hole's rim
 * decoration (CenterHolePanel). Just the fields; the caller supplies its
 * own heading/checkbox row and hide-scope, since the two contexts want
 * different surrounding copy. */
export function EdgeDetailFields({
  config,
  onChange,
}: {
  config: EdgeDetailConfig
  onChange: (patch: Partial<EdgeDetailConfig>) => void
}) {
  return (
    <div className="flex flex-col gap-4">
      <Select value={config.kind} options={KIND_OPTIONS} onChange={(kind) => onChange({ kind })} />

      <SegmentedControl
        hideKey="Edge detail mode"
        value={config.mode}
        options={[
          { value: 'cut', label: 'Cut' },
          { value: 'etch', label: 'Etch' },
        ]}
        onChange={(mode) => onChange({ mode })}
      />

      <NumberField
        label={config.kind === 'wave' || config.kind === 'zigzag' ? 'Wavelength' : 'Spacing'}
        value={config.spacing}
        min={2}
        max={100}
        step={1}
        suffix="mm"
        onChange={(spacing) => onChange({ spacing })}
      />
      <NumberField
        label={config.kind === 'wave' || config.kind === 'zigzag' ? 'Band depth' : 'Size'}
        value={config.size}
        min={0.5}
        max={60}
        step={0.5}
        suffix="mm"
        onChange={(size) => onChange({ size })}
      />
      <NumberField
        label="Offset"
        value={config.offset}
        min={0}
        max={60}
        step={0.5}
        suffix="mm"
        onChange={(offset) => onChange({ offset })}
      />
    </div>
  )
}
