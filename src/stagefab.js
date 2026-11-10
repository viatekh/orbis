// Turning a stage facade into things a workshop and a build crew can use:
// nested CNC sheets, checks, and a setting-out list.

import { buildJob } from './fabrication.js';
import { world } from './stage.js';
import { extrude, trisToSTL } from './mesh.js';

// Nesting runs on a 5 mm grid: full-size sheets at 1 mm would be needlessly slow.
const Q = 5;

export function stageJob(stage) {
  const fab = stage.fab;
  // Stepped modules: each frame's window offcut holds the next frame, so a whole stack
  // nests in the footprint of its outer frame.
  const small1 = (p) => ({
    id: p.id,
    points: p.points.map(([x, y]) => [x / Q, y / Q]),
    holes: p.holes.map((h) => ({ x: h.x / Q, y: h.y / Q, r: h.r / Q })),
    cuts: (p.cuts || []).map((c) => c.map(([x, y]) => [x / Q, y / Q])),
    etch: (p.etch || []).map((c) => c.map(([x, y]) => [x / Q, y / Q])),
    etchLines: (p.etchLines || []).map((c) => c.map(([x, y]) => [x / Q, y / Q])),
    label: [p.label[0] / Q, p.label[1] / Q],
    minWidth: p.minWidth / Q,
    spots: [],
  });
  const groups = [];
  for (const p of stage.parts) {
    const last = groups[groups.length - 1];
    if (p.stack > 0 && last && last[last.length - 1].stack === p.stack - 1 && p.stackGap >= fab.tool * 1.5 + 3) last.push(p);
    else groups.push([p]);
  }
  const nestedParts = [];
  let nestedCount = 0;
  for (const g of groups) {
    if (g.length === 1 || g.some((p) => p.print)) {
      for (const p of g) if (!p.print) nestedParts.push(small1(p));
      continue;
    }
    // innermost first; every frame but the outermost cuts its window after what sits inside it
    const inner = g.slice(1).reverse().map((p, i) => ({ ...small1(p), cutsLast: i > 0 }));
    nestedParts.push({ ...small1(g[0]), nested: inner });
    nestedCount += inner.length;
  }
  const small = {
    parts: nestedParts.length || !stage.parts.length ? nestedParts : stage.parts.filter((p) => !p.print).map((p) => ({
      id: p.id,
      points: p.points.map(([x, y]) => [x / Q, y / Q]),
      holes: p.holes.map((h) => ({ x: h.x / Q, y: h.y / Q, r: h.r / Q })),
      cuts: (p.cuts || []).map((c) => c.map(([x, y]) => [x / Q, y / Q])),
      etch: (p.etch || []).map((c) => c.map(([x, y]) => [x / Q, y / Q])),
      etchLines: (p.etchLines || []).map((c) => c.map(([x, y]) => [x / Q, y / Q])),
      label: [p.label[0] / Q, p.label[1] / Q],
      minWidth: p.minWidth / Q,
      spots: [],
    })),
    hairlines: [],
    rings: [],
    params: { minWeb: 1 },
    stats: { outerDiameter: 100 },
    pinned: true,
    labelSize: 5,
  };
  const job = buildJob(small, {
    process: 'cnc', kerf: 0, tool: fab.tool / Q, bedW: fab.sheetW / Q, bedH: fab.sheetH / Q,
    layout: 'sheets', labels: fab.labels, pins: false, engrave: false, mounting: false, border: 0,
  });
  const up = (g) => ({
    polys: g.polys.map((poly) => poly.map(([x, y]) => [x * Q, y * Q])),
    circles: g.circles.map((c) => ({ x: c.x * Q, y: c.y * Q, r: c.r * Q })),
  });
  const passes = Math.max(1, Math.ceil(stage.fab.thickness / fab.tool));
  const cut = job.stats.cutLengthMm * Q;
  return {
    inner: up(job.inner),
    cut: up(job.cut),
    engrave: { arcs: [], dots: [], polys: job.engrave.polys.map((poly) => poly.map(([x, y]) => [x * Q, y * Q])), lines: job.engrave.lines.map((l) => l.map(([x, y]) => [x * Q, y * Q])) },
    labels: job.labels.map((l) => ({ ...l, x: l.x * Q, y: l.y * Q, size: l.size * Q })),
    guides: job.guides.map((g) => ({ ...g, x: g.x * Q, y: g.y * Q, w: g.w * Q, h: g.h * Q })),
    bounds: Number.isFinite(job.bounds.w) ? { x: job.bounds.x * Q, y: job.bounds.y * Q, w: job.bounds.w * Q, h: job.bounds.h * Q } : { x: 0, y: 0, w: fab.sheetW, h: fab.sheetH },
    notes: [],
    sheets: job.sheets,
    oversize: job.oversize,
    nested: nestedCount,
    stats: { cutLengthMm: cut, pierces: job.stats.pierces, passes, minutes: (cut * passes) / 50 / 60 + (job.stats.pierces * 4) / 60 },
  };
}

export function checkStage(stage, job) {
  const { fab, stats, params: p } = stage;
  const out = stage.notes.map((text) => ({ level: 'warn', text }));
  const add = (level, text) => out.push({ level, text });
  const fmt = (n) => (Math.round(n * 10) / 10).toString();

  if (job.oversize) add('fail', `${job.oversize} panel${job.oversize > 1 ? 's are' : ' is'} larger than a ${fab.sheetW}×${fab.sheetH} sheet.`);
  else add('ok', `${stats.parts - stats.printed} panels nest onto ${job.sheets} sheet${job.sheets > 1 ? 's' : ''} of ${fab.sheetW}×${fab.sheetH}.`);
  if (job.nested) add('info', `${job.nested} panels are cut from the window offcuts of the frames around them. Cut order matters there: innermost piece first, the frame's window after — the files list them in that order.`);

  if (fab.printSet !== 'none') {
    if (stats.printed) add('ok', `${stats.printed} parts print on a ${fab.printBed} mm bed, ${fab.printThickness} mm thick.`);
    if (stats.printSkipped) add(stats.printed ? 'info' : 'warn', `${stats.printSkipped} chosen parts are larger than the ${fab.printBed} mm bed and stay on the CNC sheets.`);
  }
  if (fab.fixing) add(stats.fixings ? 'ok' : 'warn', stats.fixings ? `${stats.fixings} fixing holes of ${fab.fixing} mm in the back-plane panels and curved parts — one bolt and stand-off each.` : `No room for ${fab.fixing} mm fixing holes: widen the Rim.`);
  const holes = stage.parts.flatMap((pt) => pt.holes);
  const small = holes.filter((h) => h.r * 2 < fab.tool * 1.1).length;
  if (small) add('fail', `${small} round cutouts are smaller than the ${fab.tool} mm bit — use a smaller bit or a larger disc.`);
  else add('ok', `${stats.cutouts} cutouts clear the ${fab.tool} mm bit; inside corners get ${fmt(fab.tool / 2)} mm radii.`);
  if (stats.raised) add('info', `${stats.raised} panels stand off the back plane, up to ${Math.round(stats.reliefMm)} mm of relief — the setting-out list gives each stand-off for spacers.`);
  if (stats.tilted) add('info', `${stats.tilted} tilted faces meet at ridges: bevel the edges or join them with brackets.`);
  if (stats.diffuserM2 > 0.05) add('info', `Backlighting needs about ${fmt(stats.diffuserM2)} m² of diffuser behind the cutouts.`);

  const thinnest = stage.parts.reduce((m, pt) => Math.min(m, pt.minWidth), Infinity);
  const fragile = Math.max(20, fab.thickness * 2);
  if (thinnest < fragile) add('warn', `Thinnest panel section is ${fmt(thinnest)} mm — fragile in ${fab.thickness} mm sheet. Use thicker sheet, a wider Rim, or raise Band Fill on the disc.`);
  else add('ok', `Thinnest panel section ${fmt(thinnest)} mm.`);

  if (stage.truss) add('info', `Goalpost shown at ${fmt(stage.truss.w / 1000)} m span × ${fmt(stage.truss.h / 1000)} m — indicative only.`);
  add('info', `${fmt(stats.areaM2)} m² of facade up to ${fmt(stats.heightM)} m acts as a sail. Structure, fixings and wind loading need sign-off by a qualified engineer.`);
  return out;
}

// One row per panel: where it sits relative to the stage centreline, the ground and the back plane.
export function settingOutCSV(stage) {
  const rows = ['panel,element,centre_x_mm,centre_height_mm,standoff_mm,width_mm,height_mm,tilted,cutouts,fixing_holes'];
  for (const pt of stage.parts) {
    const w = pt.points.map((q) => world(pt, q));
    const span = (i) => [Math.min(...w.map((q) => q[i])), Math.max(...w.map((q) => q[i]))];
    const [x0, x1] = span(0);
    const [y0, y1] = span(1);
    const [z0, z1] = span(2);
    rows.push([pt.id, pt.el, Math.round((x0 + x1) / 2), Math.round(-(y0 + y1) / 2), Math.round((z0 + z1) / 2), Math.round(x1 - x0), Math.round(y1 - y0), pt.tilted ? 'yes' : 'no', pt.holes.filter((h) => h.kind !== 'fix').length + pt.cuts.length, pt.holes.filter((h) => h.kind === 'fix').length].join(','));
  }
  return rows.join('\n') + '\n';
}

// One STL per printed part: its flat shape extruded to the print thickness, lying on the bed.
export function printFiles(stage) {
  const circle = (h) => Array.from({ length: 32 }, (_, i) => [h.x + h.r * Math.cos((i * Math.PI) / 16), h.y + h.r * Math.sin((i * Math.PI) / 16)]);
  return stage.parts
    .filter((pt) => pt.print)
    .map((pt) => {
      const x0 = Math.min(...pt.points.map((q) => q[0]));
      const y0 = Math.min(...pt.points.map((q) => q[1]));
      const shift = (poly) => poly.map(([x, y]) => [x - x0, y - y0]);
      const tris = [];
      extrude(tris, shift(pt.points), [...(pt.cuts || []).map(shift), ...pt.holes.map((h) => shift(circle(h)))], 0, stage.fab.printThickness);
      return { name: `panel-${pt.id}-${pt.el}.stl`, data: trisToSTL(tris, `Orbis stage panel ${pt.id} (mm)`).buffer };
    });
}
