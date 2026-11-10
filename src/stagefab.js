// Turning a stage facade into things a workshop and a build crew can use:
// nested CNC sheets, checks, and a setting-out list.

import { buildJob } from './fabrication.js';

// Nesting runs on a 5 mm grid: full-size sheets at 1 mm would be needlessly slow.
const Q = 5;

export function stageJob(stage) {
  const fab = stage.fab;
  const small = {
    parts: stage.parts.map((p) => ({
      id: p.id,
      points: p.points.map(([x, y]) => [x / Q, y / Q]),
      holes: p.holes.map((h) => ({ x: h.x / Q, y: h.y / Q, r: h.r / Q })),
      label: [p.label[0] / Q, p.label[1] / Q],
      minWidth: p.minWidth / Q,
      spots: [],
    })),
    hairlines: [],
    rings: [],
    params: { minWeb: 1 },
    stats: { outerDiameter: 100 },
    pinned: true,
    labelSize: 8,
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
    engrave: { arcs: [], polys: [], dots: [] },
    labels: job.labels.map((l) => ({ ...l, x: l.x * Q, y: l.y * Q, size: l.size * Q })),
    guides: job.guides.map((g) => ({ ...g, x: g.x * Q, y: g.y * Q, w: g.w * Q, h: g.h * Q })),
    bounds: { x: job.bounds.x * Q, y: job.bounds.y * Q, w: job.bounds.w * Q, h: job.bounds.h * Q },
    notes: [],
    sheets: job.sheets,
    oversize: job.oversize,
    stats: { cutLengthMm: cut, pierces: job.stats.pierces, passes, minutes: (cut * passes) / 50 / 60 + (job.stats.pierces * 4) / 60 },
  };
}

export function checkStage(stage, job) {
  const { fab, stats, params: p } = stage;
  const out = stage.notes.map((text) => ({ level: 'warn', text }));
  const add = (level, text) => out.push({ level, text });
  const fmt = (n) => (Math.round(n * 10) / 10).toString();

  if (job.oversize) add('fail', `${job.oversize} panel${job.oversize > 1 ? 's are' : ' is'} larger than a ${fab.sheetW}×${fab.sheetH} sheet.`);
  else add('ok', `${stats.parts} panels nest onto ${job.sheets} sheet${job.sheets > 1 ? 's' : ''} of ${fab.sheetW}×${fab.sheetH}.`);

  const holes = stage.parts.flatMap((pt) => pt.holes);
  const small = holes.filter((h) => h.r * 2 < fab.tool * 1.1).length;
  if (small) add('fail', `${small} cutouts are smaller than the ${fab.tool} mm bit — use a smaller bit or a larger disc.`);
  else if (holes.length) add('ok', `${holes.length} cutouts, smallest Ø ${fmt(Math.min(...holes.map((h) => h.r * 2)))} mm.`);

  const thinnest = stage.parts.reduce((m, pt) => Math.min(m, pt.minWidth), Infinity);
  const fragile = Math.max(30, fab.thickness * 2.5);
  if (thinnest < fragile) add('warn', `Thinnest panel section is ${fmt(thinnest)} mm — fragile in ${fab.thickness} mm sheet. Raise Band Fill on the disc or use a larger Disc Ø.`);
  else add('ok', `Thinnest panel section ${fmt(thinnest)} mm.`);

  const discTop = p.deckHeight + p.lift + p.discDiameter;
  if (p.boothWidth >= 0.5 && p.lift < p.boothHeight) add('info', `The booth covers the bottom ${fmt((p.boothHeight - p.lift) * 100)} cm of the disc.`);
  if (stage.truss) add('info', `Goalpost shown at ${fmt(stage.truss.w / 1000)} m span × ${fmt(stage.truss.h / 1000)} m — indicative only.`);
  add('info', `${fmt(stats.areaM2)} m² of facade up to ${fmt(Math.max(discTop, stats.heightM))} m acts as a sail. Structure, fixings and wind loading need sign-off by a qualified engineer.`);
  return out;
}

// One row per panel: where its centre sits relative to the stage centreline and the ground.
export function settingOutCSV(stage) {
  const rows = ['panel,element,centre_x_mm,centre_height_mm,width_mm,height_mm,cutouts'];
  for (const pt of stage.parts) {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const [x, y] of pt.points) {
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
    rows.push([pt.id, pt.el, Math.round((x0 + x1) / 2), Math.round(-(y0 + y1) / 2), Math.round(x1 - x0), Math.round(y1 - y0), pt.holes.length].join(','));
  }
  return rows.join('\n') + '\n';
}
