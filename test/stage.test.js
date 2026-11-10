import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateStage, STAGE_DEFAULTS, TILINGS, MOTIFS, normalizeStage } from '../src/stage.js';
import { stageJob, checkStage, settingOutCSV } from '../src/stagefab.js';
import { DEFAULTS } from '../src/generator.js';
import { signedArea } from '../src/fabrication.js';

const tilings = Object.keys(TILINGS).filter((k) => k !== 'none');
const motifs = Object.keys(MOTIFS);

test('stage is deterministic', () => {
  assert.deepEqual(generateStage(STAGE_DEFAULTS, DEFAULTS).parts, generateStage(STAGE_DEFAULTS, DEFAULTS).parts);
});

test('every panel fits a sheet, for every tiling and a spread of sizes', () => {
  for (const tiling of tilings) {
    for (const [seed, width, discDiameter, crownHeight, cells] of [[7, 16, 3.6, 7.5, 24], [3, 30, 8, 12, 10], [99, 6, 1.5, 3, 48], [500, 22, 5, 9.5, 16]]) {
      const stage = generateStage({ ...STAGE_DEFAULTS, tiling, seed, width, discDiameter, crownHeight, cells, subdivide: 0 }, { ...DEFAULTS, wallAngle: 40 });
      const job = stageJob(stage);
      assert.equal(job.oversize, 0, `${tiling} seed ${seed}`);
      assert.equal(job.cut.polys.length, stage.parts.length);
    }
  }
});

test('mirrored lattice is symmetric and nothing sits below the deck or outside the stage', () => {
  for (const tiling of tilings) {
    const stage = generateStage({ ...STAGE_DEFAULTS, tiling }, DEFAULTS);
    const facade = stage.parts.filter((p) => p.el === 'facade');
    assert.ok(facade.length > 40, tiling);
    const cx = (p) => p.points.reduce((s, q) => s + q[0], 0) / p.points.length;
    assert.equal(facade.filter((p) => cx(p) > 1).length, facade.filter((p) => cx(p) < -1).length, tiling);
    for (const p of facade) {
      for (const [x, y] of p.points) {
        assert.ok(y <= -stage.deck.h + 1, `${tiling} panel ${p.id} dips below deck`);
        assert.ok(Math.abs(x) <= stage.deck.w / 2 + 1, `${tiling} panel ${p.id} overhangs the stage`);
      }
    }
  }
});

test('fretwork stays inside its panel and leaves a web', () => {
  const edgeDist = (poly, x, y) => {
    const sgn = Math.sign(signedArea(poly));
    return poly.reduce((m, a, i) => {
      const b = poly[(i + 1) % poly.length];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      return Math.min(m, (sgn * ((b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]))) / len);
    }, Infinity);
  };
  for (const motif of motifs) {
    const stage = generateStage({ ...STAGE_DEFAULTS, motif, detail: 1 }, DEFAULTS);
    const facade = stage.parts.filter((p) => p.el !== 'centre');
    if (motif !== 'solid') assert.ok(facade.some((p) => p.cuts.length + p.holes.length > 0), motif);
    for (const p of facade) {
      for (const cut of p.cuts) for (const [x, y] of cut) assert.ok(edgeDist(p.points, x, y) > 25, `${motif} cut too close to edge of panel ${p.id}`);
      for (const h of p.holes) assert.ok(edgeDist(p.points, h.x, h.y) - h.r > 25, `${motif} hole too close to edge`);
    }
  }
});

test('raised layer, checks, stats and setting-out list', () => {
  const stage = generateStage({ ...STAGE_DEFAULTS, overlay: 1 }, DEFAULTS);
  assert.ok(stage.stats.raised > 10);
  assert.equal(generateStage({ ...STAGE_DEFAULTS, overlay: 0 }, DEFAULTS).stats.raised, 0);
  const job = stageJob(stage);
  const checks = checkStage(stage, job);
  assert.ok(!checks.some((c) => c.level === 'fail'), JSON.stringify(checks));
  assert.ok(job.inner.polys.length > 200);
  assert.ok(stage.stats.areaM2 > 5 && stage.stats.massKg > 20 && stage.stats.ledM > 50);
  assert.equal(settingOutCSV(stage).trim().split('\n').length, stage.parts.length + 1);
  const n = normalizeStage({ width: 999, tiling: 'nope', motif: 'nope' });
  assert.deepEqual([n.width, n.tiling, n.motif], [30, 'hex', 'mixed']);
});
