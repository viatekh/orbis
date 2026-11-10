import { useEffect, useId, useRef, useState } from 'react'
import { requestComponentGeometry } from '../lib/geometry/geometryWorkerClient'
import type { StageComponent } from '../types'
import type { GeometryResult } from '../lib/geometry/types'

/** Computes off the main thread via a shared worker (see
 * geometryWorkerClient.ts) so a heavy pattern recompute — tens to well over
 * a hundred milliseconds for a dense pattern — never freezes the UI. Keeps
 * showing the previous result while a new one is in flight (stale-while-
 * revalidate) rather than flashing empty on every keystroke.
 *
 * `useId()` gives this hook instance a stable identity across renders —
 * required so the worker client can coalesce rapid-fire requests from THIS
 * instance without dropping requests from a different instance called
 * concurrently elsewhere (e.g. DesignerPage runs this hook twice, for the
 * active component and a layer's component, at the same time). */
export function useComponentGeometry(component: StageComponent | null): { geometry: GeometryResult | null; error: string | null } {
  const callerKey = useId()
  const [result, setResult] = useState<GeometryResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const requestIdRef = useRef(0)

  useEffect(() => {
    if (!component) {
      setResult(null)
      setError(null)
      return
    }
    const requestId = ++requestIdRef.current
    requestComponentGeometry(callerKey, component)
      .then((r) => {
        if (requestIdRef.current === requestId) {
          setResult(r)
          setError(null)
        }
      })
      .catch((err: Error) => {
        // Keep showing whatever geometry was already on screen (stale-
        // while-revalidate) rather than blanking it — the failure is
        // surfaced via `error` instead.
        if (requestIdRef.current === requestId) setError(err.message)
      })
  }, [callerKey, component])

  return { geometry: result, error }
}
