import type { StageComponent, Arrangement } from '../../types'
import type { GeometryResult } from './types'
import type { ArrangementGeometry } from './arrangement'
import type { ArrangementMeshResult } from './arrangementMesh'

type Request =
  | { kind: 'component'; seq: number; component: StageComponent }
  | { kind: 'arrangement'; seq: number; arrangement: Arrangement; components: StageComponent[] }
  | { kind: 'mesh'; seq: number; arrangement: Arrangement; components: StageComponent[] }

let worker: Worker | null = null
let seqCounter = 0
let busy = false
const inFlightResolvers = new Map<number, { resolve: (result: unknown) => void; reject: (err: Error) => void }>()

/** Clears whatever request is currently marked in-flight (rejecting its
 * promise rather than leaving it hanging forever) and un-wedges the queue.
 * Shared by both failure paths: a `{ error }` response for a request the
 * worker caught and reported itself, and the worker-level `onerror` event
 * for anything that escaped that (e.g. the module failed to even load). */
function failInFlight(seq: number | undefined, message: string) {
  if (seq !== undefined) {
    const entry = inFlightResolvers.get(seq)
    inFlightResolvers.delete(seq)
    entry?.reject(new Error(message))
  } else {
    // No seq to target (a raw worker.onerror can't tell us which request
    // was running) — fail every in-flight entry rather than guessing.
    for (const entry of inFlightResolvers.values()) entry.reject(new Error(message))
    inFlightResolvers.clear()
  }
  busy = false
  pump()
}

/** Requests not yet sent to the worker, one slot per CALLER (keyed by the
 * `callerKey` each hook instance passes in — see useComponentGeometry /
 * useArrangementGeometry). A new request from the same caller overwrites
 * its own slot (that's the "coalesce a slider drag down to the latest
 * value" behavior); a request from a DIFFERENT caller gets its own slot
 * instead of stomping this one. Without per-caller keys, DesignerPage's
 * three concurrent geometry hooks (active component, arrangement, layer
 * component) firing in the same commit would silently drop two of every
 * three updates — exactly the "changes don't seem to apply" bug this fixes. */
const pendingByCaller = new Map<string, { req: Request; resolve: (result: unknown) => void; reject: (err: Error) => void }>()

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./geometry.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent<{ seq: number; result?: unknown; error?: string }>) => {
      if (e.data.error !== undefined) {
        console.error(e.data.error)
        failInFlight(e.data.seq, e.data.error)
        return
      }
      const entry = inFlightResolvers.get(e.data.seq)
      inFlightResolvers.delete(e.data.seq)
      busy = false
      entry?.resolve(e.data.result)
      pump()
    }
    // Anything that escapes the worker's own try/catch — a module that
    // fails to load, an out-of-memory, a genuine engine bug — lands here
    // instead. Without this, that one failure would leave `busy` stuck
    // true forever with no message ever coming back to clear it, silently
    // freezing geometry for every component from then on.
    worker.onerror = (e: ErrorEvent) => {
      console.error('Geometry worker crashed:', e.message)
      failInFlight(undefined, `Geometry worker crashed: ${e.message}`)
    }
  }
  return worker
}

function pump() {
  if (busy) return
  const nextKey = pendingByCaller.keys().next().value
  if (nextKey === undefined) return
  const entry = pendingByCaller.get(nextKey)!
  pendingByCaller.delete(nextKey)
  busy = true
  inFlightResolvers.set(entry.req.seq, { resolve: entry.resolve, reject: entry.reject })
  getWorker().postMessage(entry.req)
}

function send<T>(callerKey: string, req: Request): Promise<T> {
  return new Promise((resolve, reject) => {
    pendingByCaller.set(callerKey, { req, resolve: resolve as (result: unknown) => void, reject })
    pump()
  })
}

export function requestComponentGeometry(callerKey: string, component: StageComponent): Promise<GeometryResult> {
  return send(callerKey, { kind: 'component', seq: ++seqCounter, component })
}

export function requestArrangementGeometry(
  callerKey: string,
  arrangement: Arrangement,
  components: StageComponent[],
): Promise<ArrangementGeometry> {
  return send(callerKey, { kind: 'arrangement', seq: ++seqCounter, arrangement, components })
}

export function requestArrangementMesh(
  callerKey: string,
  arrangement: Arrangement,
  components: StageComponent[],
): Promise<ArrangementMeshResult> {
  return send(callerKey, { kind: 'mesh', seq: ++seqCounter, arrangement, components })
}
