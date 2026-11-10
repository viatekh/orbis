import { useEffect, useId, useRef, useState } from 'react'
import { requestArrangementMesh } from '../lib/geometry/geometryWorkerClient'
import type { ArrangementMeshResult } from '../lib/geometry/arrangementMesh'
import type { Arrangement, StageComponent } from '../types'

/** Same shape as useArrangementGeometry — off-main-thread via the shared
 * geometry worker, stale-while-revalidate, per-caller request coalescing.
 * Pass `null` (e.g. while the 3D tab isn't the active view) to skip mesh
 * computation entirely — triangulation is real cost (see arrangementMesh.ts
 * / triangulate.ts), no reason to pay it off-screen. */
export function useArrangementMesh(
  arrangement: Arrangement | null,
  components: StageComponent[],
): { mesh: ArrangementMeshResult | null; error: string | null } {
  const callerKey = useId()
  const [result, setResult] = useState<ArrangementMeshResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const requestIdRef = useRef(0)

  useEffect(() => {
    if (!arrangement) {
      setResult(null)
      setError(null)
      return
    }
    const requestId = ++requestIdRef.current
    requestArrangementMesh(callerKey, arrangement, components)
      .then((r) => {
        if (requestIdRef.current === requestId) {
          setResult(r)
          setError(null)
        }
      })
      .catch((err: Error) => {
        if (requestIdRef.current === requestId) setError(err.message)
      })
  }, [callerKey, arrangement, components])

  return { mesh: result, error }
}
