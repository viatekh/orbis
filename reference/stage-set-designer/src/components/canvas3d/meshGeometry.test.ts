import { describe, expect, it } from 'vitest'
import { trianglesToBufferGeometry } from './meshGeometry'
import type { Tri3 } from '../../lib/export/stlExport'

describe('trianglesToBufferGeometry', () => {
  it('writes a non-indexed position attribute, 9 floats per triangle in a,b,c order', () => {
    const tris: Tri3[] = [
      { a: { x: 0, y: 0, z: 0 }, b: { x: 1, y: 0, z: 0 }, c: { x: 0, y: 1, z: 0 } },
      { a: { x: 5, y: 5, z: 5 }, b: { x: 6, y: 5, z: 5 }, c: { x: 5, y: 6, z: 5 } },
    ]
    const geometry = trianglesToBufferGeometry(tris)
    const position = geometry.getAttribute('position')
    expect(position.count).toBe(6) // 2 triangles × 3 vertices, non-indexed
    expect(geometry.getIndex()).toBeNull()
    expect([position.getX(0), position.getY(0), position.getZ(0)]).toEqual([0, 0, 0])
    expect([position.getX(1), position.getY(1), position.getZ(1)]).toEqual([1, 0, 0])
    expect([position.getX(3), position.getY(3), position.getZ(3)]).toEqual([5, 5, 5])
  })

  it('computes a flat per-face normal pointing +Z for a CCW triangle in the XY plane', () => {
    const tris: Tri3[] = [{ a: { x: 0, y: 0, z: 0 }, b: { x: 1, y: 0, z: 0 }, c: { x: 0, y: 1, z: 0 } }]
    const geometry = trianglesToBufferGeometry(tris)
    const normal = geometry.getAttribute('normal')
    expect(normal).toBeDefined()
    for (let i = 0; i < 3; i++) {
      expect(normal.getX(i)).toBeCloseTo(0)
      expect(normal.getY(i)).toBeCloseTo(0)
      expect(normal.getZ(i)).toBeCloseTo(1)
    }
  })

  it('handles an empty triangle list without throwing', () => {
    const geometry = trianglesToBufferGeometry([])
    expect(geometry.getAttribute('position').count).toBe(0)
  })
})
