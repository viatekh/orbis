import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generate, normalizeParams, DEFAULTS, PARAMS } from '../src/generator.js';
import { fabSVG, toDXF } from '../src/export.js';
import { defaultFab } from '../src/fabrication.js';
import { designSVG } from '../src/render.js';

const SAMPLES = [
  {},
  { seed: 3, rings: 14, innerRadius: 10, fill: 0.3 },
  { seed: 9, rings: 6, wallAngle: 70, notchDepth: 0.8, notchDensity: 1, edge: 6 },
  { seed: 500, rings: 1, maxSplits: 6, gapWidth: 30, bubbleSize: 0.95 },
  { seed: 77, rings: 16, fill: 0.9, hairlines: 24, bubbleSpacing: 4 },
];

test('same params produce identical geometry', () => {
  assert.deepEqual(generate({ seed: 12 }), generate({ seed: 12 }));
  assert.notDeepEqual(generate({ seed: 12 }).parts, generate({ seed: 13 }).parts);
});

test('changing cutout params leaves slice layout untouched', () => {
  const a = generate({ seed: 5, bubbleSize: 0.2 });
  const b = generate({ seed: 5, bubbleSize: 0.8 });
  assert.deepEqual(a.parts.map((p) => p.points), b.parts.map((p) => p.points));
});

test('normalizeParams clamps and quantizes', () => {
  const p = normalizeParams({ rings: 99, gapWidth: 5.1234, seed: 'x' });
  assert.equal(p.rings, 16);
  assert.equal(p.gapWidth, 5.1);
  assert.equal(p.seed, DEFAULTS.seed);
  assert.equal(Object.keys(p).length, PARAMS.length);
});

function checkWellFormed(params) {
    const d = generate(params);
    const R = d.params.outerDiameter / 2;
    assert.equal(d.rings.length, d.params.rings);
    assert.equal(d.stats.parts, d.parts.length);
    for (const part of d.parts) {
      const ring = d.rings[part.ring];
      assert.ok(part.points.length >= 4);
      for (const [x, y] of part.points) {
        assert.ok(Number.isFinite(x) && Number.isFinite(y));
        const r = Math.hypot(x, y);
        assert.ok(r <= R + 1e-6 && r >= ring.rIn - 1e-6, `point r=${r} outside band`);
      }
      for (const h of part.holes) {
        const r = Math.hypot(h.x, h.y);
        assert.ok(h.r > 0);
        assert.ok(r - h.r >= ring.rIn && r + h.r <= ring.rOut, 'hole escapes its band');
      }
    }
    for (const h of d.hairlines) {
      const ring = d.rings[h.ring];
      assert.ok(h.r > ring.gapIn && h.r < ring.rIn, 'hairline not inside its gap');
      assert.ok(h.a1 > h.a0);
    }
}

for (const params of SAMPLES) {
  test(`geometry is well-formed: ${JSON.stringify(params)}`, () => checkWellFormed(params));
}

test('fuzz: 300 random parameter sets are well-formed', () => {
  let s = 1;
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 300; i++) {
    const params = Object.fromEntries(PARAMS.map((p) => [p.key, p.min + rand() * (p.max - p.min)]));
    checkWellFormed(params);
  }
});

test('exports are structurally valid', () => {
  const d = generate({});
  const dxf = toDXF(d, defaultFab('laser'));
  assert.match(dxf, /^0\nSECTION/);
  assert.match(dxf, /EOF\n$/);
  assert.equal((dxf.match(/\nPOLYLINE\n/g) || []).length, d.parts.length);
  assert.equal((dxf.match(/\nCIRCLE\n/g) || []).length, d.stats.cutouts + d.hairlines.reduce((s, h) => s + h.pads.length, 0));
  assert.equal((dxf.match(/\nARC\n/g) || []).length, d.hairlines.length);
  const cut = fabSVG(d, defaultFab('laser'));
  assert.match(cut, /width="[\d.]+mm"/);
  assert.match(cut, /inkscape:label="CUT"/);
  assert.doesNotMatch(designSVG(d), /NaN/);
});
