import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateStage, sourcePanels, world, STAGE_DEFAULTS, TILINGS, MODULES, MOTIFS, normalizeStage } from '../src/stage.js';
import { stageJob, checkStage, settingOutCSV } from '../src/stagefab.js';
import { elevationSVG, sourceSVG } from '../src/stagerender.js';
import { DEFAULTS } from '../src/generator.js';
import { signedArea } from '../src/fabrication.js';

const tilings = Object.keys(TILINGS).filter((k) => k !== 'none');
const modules = Object.keys(MODULES);
const centreX = (p) => p.points.reduce((s, q) => s + world(p, q)[0], 0) / p.points.length;

test('stage is deterministic', () => {
  assert.deepEqual(generateStage(STAGE_DEFAULTS, DEFAULTS).parts, generateStage(STAGE_DEFAULTS, DEFAULTS).parts);
});

test('every panel fits a sheet, across tilings, modules and sizes', () => {
  let n = 0;
  for (const tiling of tilings) {
    for (const module of modules) {
      const [seed, width, discDiameter, crownHeight, cells, depth] = [[7, 18, 3.2, 7.4, 22, 260], [3, 30, 8, 12, 10, -600], [99, 6, 1.5, 3, 48, 600], [500, 22, 5, 9.5, 16, 120]][n++ % 4];
      const stage = generateStage({ ...STAGE_DEFAULTS, tiling, module, seed, width, discDiameter, crownHeight, cells, depth }, { ...DEFAULTS, wallAngle: 40 });
      const job = stageJob(stage);
      assert.equal(job.oversize, 0, `${tiling} ${module} seed ${seed}`);
      assert.equal(job.cut.polys.length, stage.parts.length);
    }
  }
});

test('mirrored stage is symmetric; nothing below the deck or outside the stage', () => {
  for (const tiling of tilings) {
    for (const module of modules) {
      const stage = generateStage({ ...STAGE_DEFAULTS, tiling, module }, DEFAULTS);
      for (const el of ['facade', 'petal', 'disc']) {
        const set = stage.parts.filter((p) => p.el === el);
        assert.ok(set.length > 5, `${tiling} ${module} ${el}`);
        if (el !== 'disc') assert.equal(set.filter((p) => centreX(p) > 1).length, set.filter((p) => centreX(p) < -1).length, `${tiling} ${module} ${el}`);
      }
      for (const p of stage.parts) {
        for (const q of p.points) {
          const [x, y] = world(p, q);
          assert.ok(y <= -stage.deck.h + 1, `${tiling} ${module} panel ${p.id} dips below deck`);
          if (p.el === 'facade') assert.ok(Math.abs(x) <= stage.deck.w / 2 + 1, `panel ${p.id} overhangs the stage`);
        }
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
      return len < 1e-6 ? m : Math.min(m, (sgn * ((b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]))) / len);
    }, Infinity);
  };
  for (const motif of Object.keys(MOTIFS)) {
    for (const module of modules) {
      const stage = generateStage({ ...STAGE_DEFAULTS, motif, module, detail: 1 }, DEFAULTS);
      const panels = stage.parts.filter((p) => p.el !== 'disc');
      if (motif !== 'solid') assert.ok(panels.some((p) => p.cuts.length + p.holes.length > 0), motif);
      for (const p of panels) {
        for (const cut of p.cuts) for (const [x, y] of cut) assert.ok(edgeDist(p.points, x, y) > 25, `${motif}/${module} cut too close to edge of panel ${p.id}`);
        for (const h of p.holes) assert.ok(edgeDist(p.points, h.x, h.y) - h.r > 25, `${motif}/${module} hole too close to edge`);
      }
    }
  }
});

test('modules give real depth', () => {
  const flat = generateStage({ ...STAGE_DEFAULTS, module: 'flat', overlay: 0, petals: 0, discZ: 0, discStep: 0, sideDisc: 0 }, DEFAULTS);
  assert.equal(flat.stats.reliefMm, 0);
  const stepped = generateStage({ ...STAGE_DEFAULTS, module: 'stepped', depth: 400 }, DEFAULTS);
  assert.ok(stepped.stats.reliefMm >= 400);
  const folded = generateStage({ ...STAGE_DEFAULTS, module: 'pyramid', depth: 300 }, DEFAULTS);
  assert.ok(folded.stats.tilted > 100);
  // a folded face is cut at its true (slant) size, so its flat shape is larger than its footprint
  const face = folded.parts.find((p) => p.tilted);
  const flatArea = Math.abs(signedArea(face.points));
  const shadow = Math.abs(signedArea(face.points.map((q) => world(face, q).slice(0, 2))));
  assert.ok(flatArea > shadow * 1.02);
  const recessed = generateStage({ ...STAGE_DEFAULTS, module: 'stepped', depth: -400 }, DEFAULTS);
  assert.ok(recessed.extent.zMin <= -399);
});

test('petals, medallions and open portal', () => {
  const base = generateStage(STAGE_DEFAULTS, DEFAULTS);
  assert.equal(base.traces.length, 3);
  assert.equal(generateStage({ ...STAGE_DEFAULTS, petals: 0 }, DEFAULTS).parts.filter((p) => p.el === 'petal').length, 0);
  const open = generateStage({ ...STAGE_DEFAULTS, centre: 'opening', sideDisc: 0 }, DEFAULTS);
  assert.equal(open.parts.filter((p) => p.el === 'disc').length, 0);
  const swirl = generateStage({ ...STAGE_DEFAULTS, mirror: false }, DEFAULTS);
  assert.ok(swirl.parts.filter((p) => p.el === 'petal').length > 20);
});

test('checks, drawings, source preview and setting-out list', () => {
  const stage = generateStage(STAGE_DEFAULTS, DEFAULTS);
  const job = stageJob(stage);
  const checks = checkStage(stage, job);
  assert.ok(!checks.some((c) => c.level === 'fail'), JSON.stringify(checks));
  assert.ok(job.inner.polys.length > 200);
  assert.ok(stage.stats.areaM2 > 5 && stage.stats.massKg > 20 && stage.stats.ledM > 50);
  const csv = settingOutCSV(stage).trim().split('\n');
  assert.equal(csv.length, stage.parts.length + 1);
  assert.ok(csv[0].includes('standoff_mm'));
  for (const view of [{}, { yaw: 40, pitch: 30 }, { mode: 'setout' }, { mode: 'day', yaw: -20, draft: true }]) {
    const svg = elevationSVG(stage, view);
    assert.ok(svg.startsWith('<svg') && !svg.includes('NaN'));
  }
  const src = sourcePanels(STAGE_DEFAULTS);
  assert.ok(src.cell.length >= 2 && src.petal.length >= 2);
  assert.ok(!sourceSVG(src.cell).includes('NaN'));
  const n = normalizeStage({ width: 999, tiling: 'nope', module: 'nope', backlit: 'yes' });
  assert.deepEqual([n.width, n.tiling, n.module, n.backlit], [30, 'hex', 'stepped', true]);
});
