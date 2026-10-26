import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generate } from '../src/generator.js';
import { triangulate, toSTL } from '../src/mesh.js';
import { signedArea, defaultFab } from '../src/fabrication.js';

const triArea = ({ pts, tris }) => {
  let s = 0;
  for (let i = 0; i < tris.length; i += 3) {
    const [a, b, c] = [pts[tris[i]], pts[tris[i + 1]], pts[tris[i + 2]]];
    s += ((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) / 2;
  }
  return s;
};
const circle = (cx, cy, r, n = 24) => Array.from({ length: n }, (_, i) => [cx + r * Math.cos((i / n) * 2 * Math.PI), cy + r * Math.sin((i / n) * 2 * Math.PI)]);

test('triangulates every part, holes included, with matching area', () => {
  for (const seed of [1, 40, 77, 300]) {
    const d = generate({ seed, rings: 9, notchDensity: 0.9, edge: 3, wallAngle: 30 });
    for (const part of d.parts) {
      const holes = part.holes.map((h) => circle(h.x, h.y, h.r));
      const expected = Math.abs(signedArea(part.points)) - holes.reduce((s, h) => s + Math.abs(signedArea(h)), 0);
      const got = triArea(triangulate(part.points, holes));
      assert.ok(Math.abs(got - expected) / expected < 1e-6, `seed ${seed} part ${part.id}: ${got} vs ${expected}`);
    }
  }
});

test('STL has a valid binary layout', () => {
  const d = generate({});
  const { buffer, triangles } = toSTL(d, defaultFab('print'));
  assert.ok(triangles > 1000);
  assert.equal(buffer.byteLength, 84 + 50 * triangles);
  assert.equal(new DataView(buffer).getUint32(80, true), triangles);
});
