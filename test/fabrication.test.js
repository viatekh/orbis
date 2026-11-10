import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generate } from '../src/generator.js';
import { buildJob, checkDesign, defaultFab, estimate, offsetPolygon, signedArea, withPins, normalizeFab, PROCESSES } from '../src/fabrication.js';
import { zip } from '../src/zip.js';

test('kerf offset grows parts and shrinks holes', () => {
  const d = generate({});
  const fab = { ...defaultFab('laser'), kerf: 0.4 };
  const job = buildJob(d, fab);
  const p0 = d.parts[0];
  assert.ok(Math.abs(signedArea(job.cut.polys[0])) > Math.abs(signedArea(p0.points)));
  assert.ok(Math.abs(job.inner.circles[0].r - (p0.holes[0].r - 0.2)) < 1e-9);
  assert.ok(Math.abs(signedArea(offsetPolygon(p0.points, -0.2))) < Math.abs(signedArea(p0.points)));
});

test('nested sheets keep every part on its sheet', () => {
  const d = generate({ rings: 9, outerDiameter: 700 });
  const fab = { ...defaultFab('laser'), layout: 'sheets', bedW: 400, bedH: 300 };
  const job = buildJob(d, fab);
  assert.equal(job.cut.polys.length, d.parts.length);
  for (const poly of job.cut.polys) {
    const inside = job.guides.some((g) => poly.every(([x, y]) => x >= g.x - 1e-6 && x <= g.x + g.w + 1e-6 && y >= g.y - 1e-6 && y <= g.y + g.h + 1e-6));
    assert.ok(inside, 'part spills off its sheet');
  }
  assert.ok(job.sheets >= 2);
});

test('nested parts never overlap', () => {
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const inside = ([x, y], poly) => {
    let hit = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i];
      const [xj, yj] = poly[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
    }
    return hit;
  };
  const box = (poly) => poly.reduce((b, [x, y]) => [Math.min(b[0], x), Math.min(b[1], y), Math.max(b[2], x), Math.max(b[3], y)], [Infinity, Infinity, -Infinity, -Infinity]);
  for (const params of [{}, { seed: 5, rings: 12 }, { seed: 77, rings: 4, wallAngle: 40 }, { seed: 9, rings: 9, outerDiameter: 300 }]) {
    const job = buildJob(generate(params), { ...defaultFab('laser'), layout: 'sheets' });
    const polys = job.cut.polys.map((p) => ({ p, b: box(p) }));
    for (let i = 0; i < polys.length; i++) {
      for (let j = i + 1; j < polys.length; j++) {
        const [A, B] = [polys[i], polys[j]];
        if (A.b[2] < B.b[0] || B.b[2] < A.b[0] || A.b[3] < B.b[1] || B.b[3] < A.b[1]) continue;
        assert.ok(!A.p.some((pt) => inside(pt, B.p)) && !B.p.some((pt) => inside(pt, A.p)), 'part inside another');
        for (let u = 0; u < A.p.length; u++) {
          const [a1, a2] = [A.p[u], A.p[(u + 1) % A.p.length]];
          for (let v = 0; v < B.p.length; v++) {
            const [b1, b2] = [B.p[v], B.p[(v + 1) % B.p.length]];
            assert.ok(!(cross(b1, b2, a1) * cross(b1, b2, a2) < 0 && cross(a1, a2, b1) * cross(a1, a2, b2) < 0), 'edges cross');
          }
        }
      }
    }
  }
});

test('plate and backer layouts are single discs', () => {
  const d = generate({});
  for (const layout of ['plate', 'backer']) {
    const job = buildJob(d, { ...defaultFab('laser'), layout });
    const discs = job.cut.circles.filter((c) => c.x === 0 && c.y === 0);
    assert.equal(discs.length, 1);
  }
});

test('DFM flags slice gaps narrower than a CNC bit', () => {
  const d = generate({ gapWidth: 2, ...{ minHole: PROCESSES.cnc.minHole, minWeb: PROCESSES.cnc.minWeb } });
  const checks = checkDesign(d, defaultFab('cnc'));
  assert.ok(checks.some((c) => c.level === 'fail' && /Slice gaps/.test(c.text)));
  assert.ok(checkDesign(generate({ gapWidth: 6 }), defaultFab('cnc')).every((c) => !/Slice gaps/.test(c.text) || c.level === 'ok'));
});

test('CNC limits keep holes at least the bit size', () => {
  const p = PROCESSES.cnc;
  const d = generate({ minHole: p.minHole, minWeb: p.minWeb, bubbleSize: 0.9 });
  for (const part of d.parts) for (const h of part.holes) assert.ok(h.r * 2 >= p.minHole - 1e-9);
});

test('estimates are positive for every process', () => {
  const d = generate({});
  for (const proc of Object.keys(PROCESSES)) {
    const e = estimate(d, defaultFab(proc));
    assert.ok(e.minutes > 0 && Number.isFinite(e.minutes), proc);
  }
});

test('zip writer produces a readable archive', () => {
  const z = zip([{ name: 'a.txt', data: 'hello' }, { name: 'b.bin', data: new Uint8Array([1, 2, 3]) }]);
  const dv = new DataView(z.buffer);
  assert.equal(dv.getUint32(0, true), 0x04034b50);
  assert.equal(dv.getUint32(z.length - 22, true), 0x06054b50);
  assert.equal(dv.getUint16(z.length - 12, true), 2);
});

test('locating pins land inside parts with web to spare, matching holes on the backer', () => {
  const d = generate({ seed: 7, rings: 8 });
  const fab = defaultFab('laser');
  const pinned = withPins(d, fab);
  const pins = pinned.parts.flatMap((p) => p.holes.filter((h) => h.kind === 'pin').map((h) => ({ h, p })));
  assert.ok(pins.length >= d.parts.length);
  for (const { h, p } of pins) {
    const ring = d.rings[p.ring];
    const r = Math.hypot(h.x, h.y);
    assert.ok(r - h.r >= ring.rIn + d.params.minWeb - 1e-6 && r + h.r <= ring.rOut - d.params.minWeb + 1e-6, 'pin too close to edge');
    for (const o of p.holes) if (o !== h) assert.ok(Math.hypot(o.x - h.x, o.y - h.y) >= o.r + h.r + d.params.minWeb - 1e-6, 'pin hits hole');
  }
  const backer = buildJob(d, { ...fab, layout: 'backer' });
  for (const { h } of pins) assert.ok(backer.inner.circles.some((c) => Math.hypot(c.x - h.x, c.y - h.y) < 1e-9), 'backer missing pin hole');
});

test('glue jig windows are oversize and share the backer alignment holes', () => {
  const d = generate({});
  const fab = { ...defaultFab('laser'), pins: false };
  const jig = buildJob(d, { ...fab, layout: 'jig' });
  const backer = buildJob(d, { ...fab, layout: 'backer', mounting: true });
  assert.ok(Math.abs(signedArea(jig.inner.polys[0])) > Math.abs(signedArea(d.parts[0].points)));
  const align = (job) => job.inner.circles.map((c) => `${c.x.toFixed(3)},${c.y.toFixed(3)}`).sort();
  assert.deepEqual(align(jig), align(backer));
  assert.equal(align(jig).length, 4);
});

test('normalizeFab repairs bad or hostile settings', () => {
  const f = normalizeFab({ process: 'nope', thickness: 'abc', kerf: 99, bedW: -5, material: '<img>', pinD: 7, pins: 'yes', layout: 'x' });
  assert.equal(f.process, 'laser');
  assert.equal(f.thickness, 3);
  assert.equal(f.kerf, 2);
  assert.equal(f.bedW, 50);
  assert.equal(f.material, 'birch');
  assert.equal(f.pinD, 3);
  assert.equal(f.pins, true);
  assert.equal(f.layout, 'assembled');
});

test('holes are cut before outlines and survive a wide kerf', () => {
  const d = generate({ minHole: 0.3 });
  const job = buildJob(d, { ...defaultFab('laser'), kerf: 2 });
  assert.ok(job.inner.circles.length > 0 && job.inner.circles.every((c) => c.r > 0));
  assert.equal(job.cut.circles.length, 0);
  assert.equal(job.cut.polys.length, d.parts.length);
});

test('part numbers export as strokes, not font text', async () => {
  const { fabSVG, toDXF } = await import('../src/export.js');
  const fab = { ...defaultFab('laser'), labels: true };
  const d = generate({});
  assert.doesNotMatch(fabSVG(d, fab), /<text/);
  assert.doesNotMatch(toDXF(d, fab), /\nTEXT\n/);
  assert.match(fabSVG(d, fab), /inkscape:label="2-LABELS"/);
});
