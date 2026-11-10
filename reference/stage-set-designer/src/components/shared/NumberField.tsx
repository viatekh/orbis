import { useEffect, useRef } from 'react'
import { clamp, cn } from '../../lib/utils'
import { HideToggleButton } from './HideToggleButton'
import { useHideable } from './useHideable'

interface NumberFieldProps {
  label: string
  value: number
  min?: number
  max?: number
  step?: number
  suffix?: string
  slider?: boolean
  onChange: (value: number) => void
  onDragStart?: () => void
  onDragEnd?: () => void
}

export function NumberField({
  label,
  value,
  min = 0,
  max = 1000,
  step = 1,
  suffix,
  slider = true,
  onChange,
  onDragStart,
  onDragEnd,
}: NumberFieldProps) {
  const { debugMode, hidden, toggle } = useHideable(label)

  // A range input's native 'input' event can fire well over 60 times/sec
  // while dragging — each one committing straight to the store used to
  // trigger a full (potentially 30-100ms+) pattern-geometry recompute.
  // Coalescing to one commit per animation frame keeps the slider feeling
  // responsive (the thumb still tracks the pointer immediately — that's
  // the browser's native behavior, not React's) while capping how often
  // downstream work actually happens.
  const rafRef = useRef<number | null>(null)
  const pendingRef = useRef<number | null>(null)
  useEffect(
    () => () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    },
    [],
  )
  const scheduleChange = (v: number) => {
    pendingRef.current = v
    if (rafRef.current == null) {
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null
        if (pendingRef.current != null) {
          onChange(pendingRef.current)
          pendingRef.current = null
        }
      })
    }
  }

  if (hidden && !debugMode) return null

  return (
    <label className={cn('flex flex-col gap-1 text-sm', hidden && 'opacity-40')}>
      <span className="flex items-center justify-between text-neutral-400">
        <span className="flex items-center gap-1.5">
          {debugMode && <HideToggleButton hidden={hidden} onToggle={toggle} />}
          <span>{label}</span>
        </span>
        <span className="text-neutral-200 tabular-nums">
          {value}
          {suffix ?? ''}
        </span>
      </span>
      <div className="flex items-center gap-2">
        {slider && (
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => scheduleChange(clamp(Number(e.target.value), min, max))}
            onPointerDown={onDragStart}
            onPointerUp={onDragEnd}
            className="flex-1 accent-purple-500"
          />
        )}
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(clamp(Number(e.target.value), min, max))}
          className="w-20 rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-right text-sm"
        />
      </div>
    </label>
  )
}
