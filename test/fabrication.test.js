import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generate } from '../src/generator.js';
import { buildJob, checkDesign, defaultFab, estimate, offsetPolygon, signedArea, PROCESSES } from '../src/fabrication.js';
import { zip } from '../src/zip.js';

test('kerf offset grows parts and shrinks holes', () => {
  const d = generate({});
  const fab = { ...defaultFab('laser'), kerf: 0.4 };
  const job = buildJob(d, fab);
  const p0 = d.parts[0];
  assert.ok(Math.abs(signedArea(job.cut.polys[0])) > Math.abs(signedArea(p0.points)));
  assert.ok(Math.abs(job.cut.circles[0].r - (p0.holes[0].r - 0.2)) < 1e-9);
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
