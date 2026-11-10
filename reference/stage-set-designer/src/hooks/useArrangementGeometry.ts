import { useEffect, useId, useRef, useState } from 'react'
import { requestArrangementGeometry } from '../lib/geometry/geometryWorkerClient'
import type { ArrangementGeometry } from '../lib/geometry/arrangement'
import type { Arrangement, StageComponent } from '../types'

/** Off-main-thread via the shared geometry worker — see
 * useComponentGeometry for why, and geometryWorkerClient.ts for how rapid
 * successive requests (e.g. dragging a radial-layer slider) get coalesced
 * per-caller instead of queuing every intermediate tick or colliding with
 * a concurrently-running useComponentGeometry instance. */
export function useArrangementGeometry(
  arrangement: Arrangement | null,
  components: StageComponent[],
): { geometry: ArrangementGeometry | null; error: string | null } {
  const callerKey = useId()
  const [result, setResult] = useState<ArrangementGeometry | null>(null)
  const [error, setError] = useState<string | null>(null)
  const requestIdRef = useRef(0)

  useEffect(() => {
    if (!arrangement) {
      setResult(null)
      setError(null)
      return
    }
    const requestId = ++requestIdRef.current
    requestArrangementGeometry(callerKey, arrangement, components)
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
  }, [callerKey, arrangement, components])

  return { geometry: result, error }
}
