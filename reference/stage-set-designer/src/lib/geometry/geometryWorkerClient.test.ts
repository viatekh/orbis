import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_CENTER_HOLE_SHAPE, DEFAULT_EDGE_DETAIL, DEFAULT_PATTERN_CONFIG, DEFAULT_SHAPE } from './constants'
import type { StageComponent } from '../../types'

function makeComponent(id: string): StageComponent {
  const now = new Date().toISOString()
  return {
    id,
    name: id,
    shape: { ...DEFAULT_SHAPE },
    pattern: structuredClone(DEFAULT_PATTERN_CONFIG),
    centerHole: {
      enabled: false,
      shape: { ...DEFAULT_CENTER_HOLE_SHAPE },
      offsetX: 0,
      offsetY: 0,
      margin: 0,
      edgeDetail: { ...DEFAULT_EDGE_DETAIL },
    },
    material: { thicknessMm: 6, label: 'Plywood' },
    createdAt: now,
    updatedAt: now,
  }
}

interface MockMessage {
  data: unknown
}
interface MockError {
  message: string
}

/** Stands in for the real Worker (unavailable in this test environment) —
 * just enough surface for geometryWorkerClient.ts to talk to: postMessage
 * records what was sent so the test can reply, onmessage/onerror are the
 * two hooks the client actually listens on. */
class MockWorker {
  static lastInstance: MockWorker | undefined
  onmessage: ((e: MockMessage) => void) | null = null
  onerror: ((e: MockError) => void) | null = null
  posted: Array<{ seq: number; [key: string]: unknown }> = []
  constructor() {
    MockWorker.lastInstance = this
  }
  postMessage(msg: { seq: number; [key: string]: unknown }) {
    this.posted.push(msg)
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('geometryWorkerClient — worker failure recovery', () => {
  // Regression for the real bug this was built to fix: before, a request
  // that never got a reply (the worker threw with no try/catch, or died
  // outright) left `busy` stuck true forever with nothing to clear it —
  // every OTHER component's geometry request would then queue behind it
  // and never run, which is exactly "I see components listed but nothing
  // ever renders."
  it('an { error } response rejects only that request and leaves the queue able to process the next one', async () => {
    vi.stubGlobal('Worker', MockWorker)
    vi.resetModules()
    const { requestComponentGeometry } = await import('./geometryWorkerClient')

    const failing = requestComponentGeometry('caller-a', makeComponent('bad'))
    await Promise.resolve()
    const worker = MockWorker.lastInstance!
    expect(worker.posted.length).toBe(1)
    const seq1 = worker.posted[0].seq

    worker.onmessage?.({ data: { seq: seq1, error: 'boom: bad component data' } })
    await expect(failing).rejects.toThrow('boom: bad component data')

    const ok = requestComponentGeometry('caller-b', makeComponent('good'))
    await Promise.resolve()
    expect(worker.posted.length).toBe(2)
    const seq2 = worker.posted[1].seq
    worker.onmessage?.({ data: { seq: seq2, result: { ok: true } } })
    await expect(ok).resolves.toEqual({ ok: true })
  })

  it('a raw worker.onerror event fails whatever was in flight and un-wedges the queue', async () => {
    vi.stubGlobal('Worker', MockWorker)
    vi.resetModules()
    const { requestComponentGeometry } = await import('./geometryWorkerClient')

    const first = requestComponentGeometry('caller-a', makeComponent('x'))
    await Promise.resolve()
    const worker = MockWorker.lastInstance!

    worker.onerror?.({ message: 'worker crashed' })
    await expect(first).rejects.toThrow('worker crashed')

    const second = requestComponentGeometry('caller-b', makeComponent('y'))
    await Promise.resolve()
    expect(worker.posted.length).toBe(2)
    const seq2 = worker.posted[1].seq
    worker.onmessage?.({ data: { seq: seq2, result: { ok: true } } })
    await expect(second).resolves.toEqual({ ok: true })
  })

  it('a successful response still resolves normally (no regression on the happy path)', async () => {
    vi.stubGlobal('Worker', MockWorker)
    vi.resetModules()
    const { requestComponentGeometry } = await import('./geometryWorkerClient')

    const req = requestComponentGeometry('caller-a', makeComponent('fine'))
    await Promise.resolve()
    const worker = MockWorker.lastInstance!
    const seq = worker.posted[0].seq
    worker.onmessage?.({ data: { seq, result: { cutPaths: [] } } })
    await expect(req).resolves.toEqual({ cutPaths: [] })
  })

  it('requestArrangementMesh posts a kind:"mesh" request and resolves on reply', async () => {
    vi.stubGlobal('Worker', MockWorker)
    vi.resetModules()
    const { requestArrangementMesh } = await import('./geometryWorkerClient')

    const arrangement = { id: 'a1', name: 'A', layers: [], createdAt: '', updatedAt: '' }
    const req = requestArrangementMesh('caller-a', arrangement, [])
    await Promise.resolve()
    const worker = MockWorker.lastInstance!
    expect(worker.posted[0]).toMatchObject({ kind: 'mesh', arrangement })
    const seq = worker.posted[0].seq
    worker.onmessage?.({ data: { seq, result: { layers: [] } } })
    await expect(req).resolves.toEqual({ layers: [] })
  })
})
