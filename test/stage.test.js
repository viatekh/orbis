import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateStage, sourcePanels, world, STAGE_DEFAULTS, TILINGS, MODULES, MOTIFS, normalizeStage } from '../src/stage.js';
import { stageJob, checkStage, settingOutCSV, printFiles } from '../src/stagefab.js';
import { STAGE_PRESETS } from '../src/stagepresets.js';
import { CENTRES, FORMS, ETCH_PATTERNS, TENDRIL_STYLES, scaleStage } from '../src/stage.js';
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
      for (const el of ['facade', 'petal', 'core']) {
        const set = stage.parts.filter((p) => p.el === el);
        assert.ok(set.length > 5, `${tiling} ${module} ${el}`);
        if (el !== 'core') assert.equal(set.filter((p) => centreX(p) > 1).length, set.filter((p) => centreX(p) < -1).length, `${tiling} ${module} ${el}`);
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
      const panels = stage.parts.filter((p) => p.el !== 'core');
      if (motif !== 'solid') assert.ok(panels.some((p) => p.cuts.length + p.holes.length > 0), motif);
      for (const p of panels) {
        for (const cut of p.cuts) for (const [x, y] of cut) assert.ok(edgeDist(p.points, x, y) > 25, `${motif}/${module} cut too close to edge of panel ${p.id}`);
        for (const h of p.holes) assert.ok(edgeDist(p.points, h.x, h.y) - h.r > 25, `${motif}/${module} hole too close to edge`);
      }
    }
  }
});

test('modules give real depth', () => {
  const flat = generateStage({ ...STAGE_DEFAULTS, module: 'flat', overlay: 0, petals: 0, discZ: 0, discStep: 0, sideDisc: 0, layerGap: 0 }, DEFAULTS);
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
  const recessed = generateStage({ ...STAGE_DEFAULTS, module: 'stepped', depth: -400, layerGap: 0 }, DEFAULTS);
  assert.ok(recessed.extent.zMin <= -399);
});

test('petals, medallions and open portal', () => {
  const base = generateStage(STAGE_DEFAULTS, DEFAULTS);
  assert.equal(base.traces.length, 3);
  assert.equal(generateStage({ ...STAGE_DEFAULTS, petals: 0 }, DEFAULTS).parts.filter((p) => p.el === 'petal').length, 0);
  const open = generateStage({ ...STAGE_DEFAULTS, centre: 'opening', sideDisc: 0 }, DEFAULTS);
  assert.equal(open.parts.filter((p) => p.el === 'core').length, 0);
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

test('every core, form and preset builds panels that fit a sheet', () => {
  const builds = [
    ...Object.keys(CENTRES).map((centre) => ({ centre })),
    ...Object.keys(FORMS).flatMap((form) => [{ form, formDepth: 3, module: 'pyramid' }, { form, formDepth: -3, module: 'scales' }, { form, formDepth: 2, module: 'stepped' }]),
    ...Object.values(STAGE_PRESETS),
  ];
  for (const over of builds) {
    const stage = generateStage({ ...STAGE_DEFAULTS, ...over }, DEFAULTS);
    assert.ok(stage.parts.length > 20, JSON.stringify(over));
    for (const p of stage.parts) for (const q of p.points) assert.ok(world(p, q).every(Number.isFinite), JSON.stringify(over));
    assert.equal(stageJob(stage).oversize, 0, JSON.stringify(over));
    assert.ok(!elevationSVG(stage, { yaw: 30, pitch: 20 }).includes('NaN'));
  }
  assert.equal(generateStage({ ...STAGE_DEFAULTS, centre: 'none', sideDisc: 0 }, DEFAULTS).parts.filter((p) => p.el === 'core').length, 0);
  const gap = (coreGap) => Math.min(...generateStage({ ...STAGE_DEFAULTS, centre: 'opening', petals: 0, coreGap }, DEFAULTS).parts.filter((p) => p.el === 'facade').flatMap((p) => p.points.map((q) => Math.hypot(world(p, q)[0], world(p, q)[1] + 4500))));
  assert.ok(gap(800) > gap(0) + 700);
  const dome = generateStage({ ...STAGE_DEFAULTS, form: 'dome', formDepth: 3 }, DEFAULTS);
  assert.ok(dome.stats.reliefMm > 2000);
});

test('3D printing takes parts that fit the bed off the CNC sheets', () => {
  const none = generateStage(STAGE_DEFAULTS, DEFAULTS);
  assert.equal(none.stats.printed, 0);
  assert.equal(printFiles(none).length, 0);
  const small = generateStage(STAGE_DEFAULTS, DEFAULTS, { printSet: 'fit', printBed: 245 });
  const big = generateStage(STAGE_DEFAULTS, DEFAULTS, { printSet: 'fit', printBed: 800 });
  assert.ok(big.stats.printed > small.stats.printed);
  assert.ok(big.stats.printed > 50 && big.stats.printKg > 1);
  assert.equal(stageJob(big).cut.polys.length, big.parts.length - big.stats.printed);
  const files = printFiles(big);
  assert.equal(files.length, big.stats.printed);
  const dv = new DataView(files[0].data);
  assert.equal(files[0].data.byteLength, 84 + dv.getUint32(80, true) * 50);
  const petals = generateStage(STAGE_DEFAULTS, DEFAULTS, { printSet: 'petal', printBed: 800 });
  assert.ok(petals.parts.filter((p) => p.print).every((p) => p.el === 'petal'));
});

test('etch detail never crosses a cutout', () => {
  for (const etchPattern of Object.keys(ETCH_PATTERNS)) {
    const stage = generateStage({ ...STAGE_DEFAULTS, etchPattern, etch: 3, module: 'flat', motif: 'mixed' }, DEFAULTS);
    const lines = stage.parts.flatMap((p) => p.etchLines.map((l) => [p, l]));
    if (etchPattern !== 'outline') assert.ok(lines.length > 200, etchPattern);
    else assert.ok(stage.parts.some((p) => p.etch.length), etchPattern);
    for (const [p, [a, b]] of lines) {
      for (const t of [0.02, 0.5, 0.98]) {
        const x = a[0] + (b[0] - a[0]) * t;
        const y = a[1] + (b[1] - a[1]) * t;
        for (const h of p.holes) assert.ok(Math.hypot(x - h.x, y - h.y) > h.r, `${etchPattern} line inside a hole`);
        for (const cut of p.cuts) {
          const sgn = Math.sign(signedArea(cut));
          const inside = cut.every((q, i) => {
            const r = cut[(i + 1) % cut.length];
            return sgn * ((r[0] - q[0]) * (y - q[1]) - (r[1] - q[1]) * (x - q[0])) > 0;
          });
          assert.ok(!inside, `${etchPattern} line inside a cut on panel ${p.id}`);
        }
      }
    }
    assert.equal(stageJob(stage).engrave.lines.length, lines.length);
  }
});

test('tendrils, layers, mandala core, freeform petals and scaling', () => {
  for (const tendrilStyle of Object.keys(TENDRIL_STYLES)) {
    const stage = generateStage({ ...STAGE_DEFAULTS, tendrils: 3, tendrilStyle, tendrilCurl: 0.9 }, DEFAULTS);
    const t = stage.parts.filter((p) => p.el === 'tendril');
    assert.ok(t.length > 20, tendrilStyle);
    assert.equal(t.filter((p) => centreX(p) > 1).length, t.filter((p) => centreX(p) < -1).length);
    assert.equal(stageJob(stage).oversize, 0, tendrilStyle);
    for (const p of t) for (const q of p.points) assert.ok(world(p, q)[1] <= -stage.deck.h + 1);
  }
  const zOf = (stage, el) => Math.min(...stage.parts.filter((p) => p.el === el).map((p) => p.frame.o[2]));
  const a = generateStage({ ...STAGE_DEFAULTS, layerOrder: ['spike', 'tendril', 'facade', 'petal', 'core'] }, DEFAULTS);
  const b = generateStage({ ...STAGE_DEFAULTS, layerOrder: ['spike', 'tendril', 'petal', 'facade', 'core'] }, DEFAULTS);
  assert.ok(zOf(a, 'petal') > zOf(a, 'facade') && zOf(b, 'petal') < zOf(b, 'facade'));
  assert.equal(generateStage({ ...STAGE_DEFAULTS, hidden: ['petal'] }, DEFAULTS).parts.filter((p) => p.el === 'petal').length, 0);
  assert.deepEqual(normalizeStage({ layerOrder: ['core', 'bogus', 'core'] }).layerOrder.slice(-1), ['core']);
  assert.equal(normalizeStage({ layerOrder: ['core'] }).layerOrder.length, 5);

  const m1 = generateStage({ ...STAGE_DEFAULTS, centre: 'mandala', corePoints: 7 }, DEFAULTS).parts.filter((p) => p.el === 'core');
  assert.ok(m1.length > 30);
  const free = generateStage({ ...STAGE_DEFAULTS, petalShape: 'freeform', petalNodes: [1, 0.2, 0.9, 0.1, 0.6] }, DEFAULTS);
  assert.ok(free.parts.filter((p) => p.el === 'petal').length >= 14);

  const big = scaleStage(STAGE_DEFAULTS, 1.5);
  assert.equal(big.width, 27);
  assert.ok(Math.abs(big.discDiameter - STAGE_DEFAULTS.discDiameter * 1.5) < 0.06 && big.rim === 90);
  assert.equal(big.cells, STAGE_DEFAULTS.cells);
});

test('pattern library keeps a full web between every cutout', async () => {
  const { PATTERNS } = await import('../src/patterns.js');
  const seg = (x, y, a, b) => {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy || 1)));
    return Math.hypot(x - a[0] - dx * t, y - a[1] - dy * t);
  };
  const toPoly = (x, y, Q) => Math.min(...Q.map((a, i) => seg(x, y, a, Q[(i + 1) % Q.length])));
  for (const motif of Object.keys(PATTERNS)) {
    for (const detail of [0, 1]) {
      const stage = generateStage({ ...STAGE_DEFAULTS, motif, petalMotif: motif, module: 'flat', overlay: 0, detail, cells: 14 }, DEFAULTS);
      const panels = stage.parts.filter((p) => p.el === 'facade' || p.el === 'petal');
      assert.ok(panels.filter((p) => p.cuts.length + p.holes.length > 1).length > panels.length / 3, `${motif} fills most panels`);
      let web = Infinity;
      for (const p of panels) {
        p.cuts.forEach((A, i) => {
          for (const B of p.cuts.slice(i + 1)) for (const [P, Q] of [[A, B], [B, A]]) for (const [x, y] of P) web = Math.min(web, toPoly(x, y, Q));
          for (const h of p.holes) web = Math.min(web, toPoly(h.x, h.y, A) - h.r);
        });
        p.holes.forEach((a, i) => {
          for (const b of p.holes.slice(i + 1)) web = Math.min(web, Math.hypot(a.x - b.x, a.y - b.y) - a.r - b.r);
        });
      }
      assert.ok(web > 29.5, `${motif} at detail ${detail}: web ${web.toFixed(1)}`);
    }
  }
});

test('grid layout, clean splits and curated random rolls', async () => {
  const { randomStage, RECIPE_NAMES } = await import('../src/stagerandom.js');
  // grid: every whole lattice module is the same size
  const grid = generateStage({ ...STAGE_DEFAULTS, layout: 'grid', module: 'flat', motif: 'solid', overlay: 0, subdivide: 0, erode: 0, petals: 0 }, DEFAULTS);
  const hexes = grid.parts.filter((p) => p.el === 'facade' && p.points.length === 6);
  assert.ok(hexes.length > 100);
  const areas = hexes.map((p) => Math.abs(p.points.reduce((s, q, i) => s + q[0] * p.points[(i + 1) % 6][1] - p.points[(i + 1) % 6][0] * q[1], 0)) / 2);
  assert.ok(Math.max(...areas) / Math.min(...areas) < 1.01, 'grid hexes are identical');
  for (const name of RECIPE_NAMES) {
    for (let i = 0; i < 3; i++) {
      const roll = randomStage(STAGE_DEFAULTS, name);
      assert.equal(roll.recipe, name);
      const stage = generateStage(normalizeStage(roll), DEFAULTS);
      assert.ok(stage.parts.length > 20, `${name} builds a stage`);
      assert.equal(stageJob(stage).oversize, 0, `${name} fits its sheets`);
    }
  }
});
