// Dedicated worker: runs the pure pattern-geometry pipeline off the main
// thread. computePatternGeometry/computeArrangementGeometry can take tens to
// well over a hundred milliseconds for a dense pattern — running that
// synchronously on the main thread freezes every input, scroll, and repaint
// for the duration. Moving it here keeps the UI responsive even while a
// heavy recompute is in flight; the client in geometryWorkerClient.ts
// coalesces rapid-fire requests (e.g. a slider drag) down to "only the
// latest matters" so the worker never builds a growing backlog.
import { computeComponentGeometry } from './pipeline'
import { computeArrangementGeometry } from './arrangement'
import { computeArrangementMesh } from './arrangementMesh'
import type { StageComponent, Arrangement } from '../../types'

type Request =
  | { kind: 'component'; seq: number; component: StageComponent }
  | { kind: 'arrangement'; seq: number; arrangement: Arrangement; components: StageComponent[] }
  | { kind: 'mesh'; seq: number; arrangement: Arrangement; components: StageComponent[] }

const ctx = self as unknown as { onmessage: ((e: MessageEvent<Request>) => void) | null; postMessage: (msg: unknown) => void }

// A single malformed component (most often stale/partially-migrated data —
// a saved project from an older schema version missing a field the current
// code assumes is always present) must never take down geometry for every
// OTHER component too. Catching here and posting an explicit error message
// back is what makes that possible: the client can resolve just this one
// request and keep pumping the rest, rather than the request silently never
// coming back at all (which — see geometryWorkerClient.ts — used to wedge
// the whole queue, since nothing ever cleared its "busy" flag).
ctx.onmessage = (e: MessageEvent<Request>) => {
  const req = e.data
  try {
    if (req.kind === 'component') {
      const result = computeComponentGeometry(req.component)
      ctx.postMessage({ seq: req.seq, result })
    } else if (req.kind === 'arrangement') {
      const result = computeArrangementGeometry(req.arrangement, req.components)
      ctx.postMessage({ seq: req.seq, result })
    } else {
      const result = computeArrangementMesh(req.arrangement, req.components)
      ctx.postMessage({ seq: req.seq, result })
    }
  } catch (err) {
    const label = req.kind === 'component' ? `component "${req.component.name}" (${req.component.id})` : `arrangement "${req.arrangement.name}" (${req.arrangement.id})`
    ctx.postMessage({ seq: req.seq, error: `Geometry computation failed for ${label}: ${err instanceof Error ? err.message : String(err)}` })
  }
}
