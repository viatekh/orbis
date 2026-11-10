import * as THREE from 'three'
import type { Tri3 } from '../../lib/export/stlExport'

/** Converts a triangle soup (as produced by stlExport.ts's buildComponentMesh)
 * into a Three.js BufferGeometry. Deliberately non-indexed — no vertex is
 * shared between triangles, so `computeVertexNormals()` naturally yields a
 * flat per-face normal at every corner (the same faceted look STL export
 * already treats this data as), rather than smoothing across edges that are
 * actually flat panel faces. */
export function trianglesToBufferGeometry(tris: Tri3[]): THREE.BufferGeometry {
  const positions = new Float32Array(tris.length * 9)
  for (let i = 0; i < tris.length; i++) {
    const { a, b, c } = tris[i]
    const o = i * 9
    positions[o] = a.x
    positions[o + 1] = a.y
    positions[o + 2] = a.z
    positions[o + 3] = b.x
    positions[o + 4] = b.y
    positions[o + 5] = b.z
    positions[o + 6] = c.x
    positions[o + 7] = c.y
    positions[o + 8] = c.z
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.computeVertexNormals()
  return geometry
}
