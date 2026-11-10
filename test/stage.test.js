import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateStage, STAGE_DEFAULTS, WING_STYLES, normalizeStage } from '../src/stage.js';
import { stageJob, checkStage, settingOutCSV } from '../src/stagefab.js';
import { DEFAULTS } from '../src/generator.js';

const styles = Object.keys(WING_STYLES);

test('stage is deterministic', () => {
  const a = generateStage(STAGE_DEFAULTS, DEFAULTS);
  const b = generateStage(STAGE_DEFAULTS, DEFAULTS);
  assert.deepEqual(a.parts, b.parts);
});

test('every panel fits a sheet, for every wing style and a spread of sizes', () => {
  for (const wingStyle of styles) {
    for (const [seed, width, discDiameter, wingHeight, wingTilt] of [[7, 14, 4, 6, 20], [3, 30, 8, 10, -40], [99, 6, 1.5, 3, 0], [500, 20, 5.5, 8, 37]]) {
      const stage = generateStage({ ...STAGE_DEFAULTS, wingStyle, seed, width, discDiameter, wingHeight, wingTilt, chaos: 0.8 }, { ...DEFAULTS, wallAngle: 40 });
      const job = stageJob(stage);
      assert.equal(job.oversize, 0, `${wingStyle} seed ${seed}`);
      assert.ok(job.sheets >= 1);
      assert.equal(job.cut.polys.length, stage.parts.length);
    }
  }
});

test('mirrored wings are symmetric and nothing sits below the deck', () => {
  for (const wingStyle of ['fins', 'rays', 'arcs']) {
    const stage = generateStage({ ...STAGE_DEFAULTS, wingStyle }, DEFAULTS);
    const wings = stage.parts.filter((p) => p.el === 'wing');
    assert.ok(wings.length > 0, wingStyle);
    const sumX = wings.reduce((s, p) => s + p.label[0], 0);
    assert.ok(Math.abs(sumX) < 1e-6, wingStyle);
    for (const p of stage.parts) for (const [, y] of p.points) assert.ok(y <= -stage.deck.h + 1, `${wingStyle} panel ${p.id} dips below deck`);
  }
});

test('cutouts stay inside their panels with a web', () => {
  const stage = generateStage({ ...STAGE_DEFAULTS, wingStyle: 'rays', wingCutouts: 1 }, DEFAULTS);
  for (const p of stage.parts.filter((q) => q.el !== 'centre')) {
    for (const h of p.holes) {
      for (const [x, y] of p.points) assert.ok(Math.hypot(x - h.x, y - h.y) > h.r + 20);
    }
  }
});

test('checks, stats and setting-out list', () => {
  const stage = generateStage(STAGE_DEFAULTS, DEFAULTS);
  const job = stageJob(stage);
  const checks = checkStage(stage, job);
  assert.ok(!checks.some((c) => c.level === 'fail'), JSON.stringify(checks));
  assert.ok(stage.stats.areaM2 > 5 && stage.stats.massKg > 20 && stage.stats.ledM > 50);
  assert.equal(settingOutCSV(stage).trim().split('\n').length, stage.parts.length + 1);
  assert.equal(normalizeStage({ width: 999, wingStyle: 'nope' }).width, 30);
});
