// Making the design physical: process presets, materials, kerf compensation,
// sheet nesting, plate/backer layouts, design-for-manufacture checks, estimates.

const TAU = Math.PI * 2;

export const MATERIALS = {
  birch: { label: 'Birch ply', density: 0.68, fill: '#dcc196', edge: '#6b4a26', engrave: '#7d5631' },
  mdf: { label: 'MDF', density: 0.75, fill: '#b08b68', edge: '#3f2a1a', engrave: '#4e3523' },
  acrylic: { label: 'Clear acrylic', density: 1.19, fill: 'rgba(205,238,246,0.3)', edge: '#c4ecf6', engrave: '#eefafd' },
  black: { label: 'Black acrylic', density: 1.19, fill: '#1c1d20', edge: '#050506', engrave: '#8a8f96' },
  aluminium: { label: 'Aluminium 6061', density: 2.7, fill: '#c9ced4', edge: '#6f767e', engrave: '#858c95' },
  brass: { label: 'Brass', density: 8.5, fill: '#d4ad4f', edge: '#7a5b18', engrave: '#94711f' },
  hdpe: { label: 'HDPE', density: 0.95, fill: '#efefea', edge: '#9a9a94', engrave: '#b5b5ae' },
  pla: { label: 'PLA', density: 1.24, fill: '#ff7a2f', edge: '#a8460f', engrave: '#c4561a' },
  petg: { label: 'PETG', density: 1.27, fill: '#2fa8a0', edge: '#165f5a', engrave: '#1d7972' },
  paper: { label: 'Paper + pen', density: 0.8, fill: '#fbfaf6', edge: '#22252a', engrave: '#22252a' },
};

export const PROCESSES = {
  laser: {
    label: 'Laser', tool: 0.15, kerf: 0.15, minHole: 1, minWeb: 1.5, bed: [600, 400], thickness: 3,
    material: 'birch', materials: ['birch', 'mdf', 'acrylic', 'black', 'paper'],
    speed: 12, pierce: 0.3, toolLabel: 'Beam Ø',
  },
  cnc: {
    label: 'CNC', tool: 3.175, kerf: 0, minHole: 3.4, minWeb: 3, bed: [1220, 610], thickness: 6,
    material: 'birch', materials: ['birch', 'mdf', 'aluminium', 'brass', 'hdpe', 'acrylic'],
    speed: 20, pierce: 2, toolLabel: 'Bit Ø',
  },
  print: {
    label: '3D Print', tool: 0.4, kerf: 0, minHole: 1.2, minWeb: 1.2, bed: [256, 256], thickness: 2,
    material: 'pla', materials: ['pla', 'petg'], speed: 0, pierce: 0, toolLabel: 'Nozzle Ø',
  },
  plot: {
    label: 'Pen Plot', tool: 0.5, kerf: 0, minHole: 0.6, minWeb: 0.6, bed: [420, 297], thickness: 0,
    material: 'paper', materials: ['paper'], speed: 40, pierce: 0.1, toolLabel: 'Pen Ø',
  },
};

export const LAYOUTS = {
  assembled: 'Assembled',
  sheets: 'Nested sheets',
  plate: 'Stencil plate',
  backer: 'Backer disc',
};

export function defaultFab(process = 'laser') {
  const pr = PROCESSES[process];
  return {
    process,
    material: pr.material,
    thickness: pr.thickness,
    kerf: pr.kerf,
    tool: pr.tool,
    bedW: pr.bed[0],
    bedH: pr.bed[1],
    layout: 'assembled',
    engrave: true,
    labels: false,
    mounting: true,
    border: 12,
    relief: 3,
    ringStep: 0.6,
    stlBase: true,
  };
}

// ------------------------------------------------------------------ geometry helpers

export function signedArea(pts) {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    s += x1 * y2 - x2 * y1;
  }
  return s / 2;
}

// Miter offset; positive grows the shape. Miters are capped at 4× the offset.
export function offsetPolygon(pts, d) {
  if (!d) return pts;
  const sgn = Math.sign(signedArea(pts)) || 1;
  const n = pts.length;
  const normal = (p, q) => {
    const dx = q[0] - p[0];
    const dy = q[1] - p[1];
    const len = Math.hypot(dx, dy) || 1;
    return [(sgn * dy) / len, (-sgn * dx) / len];
  };
  return pts.map((p, i) => {
    const n1 = normal(pts[(i + n - 1) % n], p);
    const n2 = normal(p, pts[(i + 1) % n]);
    const k = d / Math.max(0.25, 1 + n1[0] * n2[0] + n1[1] * n2[1]);
    return [p[0] + (n1[0] + n2[0]) * k, p[1] + (n1[1] + n2[1]) * k];
  });
}

const circlePts = (cx, cy, r, n = 64) =>
  Array.from({ length: n }, (_, i) => [cx + r * Math.cos((i / n) * TAU), cy + r * Math.sin((i / n) * TAU)]);

function bbox(pts) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) {
    if (x < x0) x0 = x;
    if (y < y0) y0 = y;
    if (x > x1) x1 = x;
    if (y > y1) y1 = y;
  }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
}

const rot = ([x, y], c, s) => [x * c - y * s, x * s + y * c];

// ------------------------------------------------------------------ jobs
//
// A job is the toolpath-level description every exporter consumes:
//   cut:     closed polylines and circles that go all the way through
//   engrave: open arcs, closed polylines and filled dots (score / V-carve / ink)
//   labels:  engraved part numbers
//   guides:  sheet outlines (not machined)

export function buildJob(design, fab) {
  const R = design.stats.outerDiameter / 2;
  const k = (fab.process === 'laser' ? fab.kerf : 0) / 2;
  const job = { cut: { polys: [], circles: [] }, engrave: { arcs: [], polys: [], dots: [] }, labels: [], guides: [], notes: [] };
  const labelSize = Math.max(2.5, Math.min(5, minPartWidth(design) * 0.45));

  const addTraces = () => {
    if (!fab.engrave) return;
    for (const h of design.hairlines) {
      job.engrave.arcs.push({ cx: 0, cy: 0, r: h.r, a0: h.a0, a1: h.a1 });
      for (const d of h.pads) job.engrave.dots.push({ x: d.x, y: d.y, r: d.r });
    }
  };
  const addMounting = (outerR) => {
    if (!fab.mounting) return;
    const hr = Math.max(fab.process === 'cnc' ? fab.tool / 2 + 0.2 : 0, 2);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + Math.PI / 4;
      job.cut.circles.push({ x: (outerR - fab.border / 2) * Math.cos(a), y: (outerR - fab.border / 2) * Math.sin(a), r: hr - k });
    }
  };

  switch (fab.layout) {
    case 'plate': {
      const outer = R + fab.border;
      job.cut.circles.push({ x: 0, y: 0, r: outer + k });
      for (const p of design.parts) job.cut.polys.push(offsetPolygon(p.points, -k));
      addTraces();
      addMounting(outer);
      job.bounds = square(outer + 2);
      job.notes.push('Plate stays in one piece; parts are cut out of it as windows.');
      break;
    }
    case 'backer': {
      const outer = R + fab.border;
      job.cut.circles.push({ x: 0, y: 0, r: outer + k });
      for (const p of design.parts) job.engrave.polys.push(p.points);
      addTraces();
      addMounting(outer);
      if (fab.labels) for (const p of design.parts) job.labels.push({ x: p.label[0], y: p.label[1], text: p.id, size: labelSize });
      job.bounds = square(outer + 2);
      job.notes.push('Backer is engraved with every part outline for glue-up registration.');
      break;
    }
    case 'sheets':
      packSheets(design, fab, k, job, labelSize);
      job.notes.push('Traces live between parts: engrave them on a Backer disc.');
      break;
    default: {
      for (const p of design.parts) {
        job.cut.polys.push(offsetPolygon(p.points, k));
        for (const h of p.holes) job.cut.circles.push({ x: h.x, y: h.y, r: h.r - k });
        if (fab.labels) job.labels.push({ x: p.label[0], y: p.label[1], text: p.id, size: labelSize });
      }
      addTraces();
      job.bounds = square(R * 1.02);
    }
  }
  return job;
}

const square = (r) => ({ x: -r, y: -r, w: 2 * r, h: 2 * r });

function minPartWidth(design) {
  return design.parts.reduce((m, p) => Math.min(m, p.minWidth), Infinity);
}

// Rotate each part to its smallest bounding box, then shelf-pack onto bed-sized sheets.
function packSheets(design, fab, k, job, labelSize) {
  const margin = 5;
  const gap = Math.max(fab.process === 'cnc' ? fab.tool * 1.5 : 0, 0) + 3;
  const W = fab.bedW;
  const H = fab.bedH;

  const items = design.parts.map((p) => {
    const poly = offsetPolygon(p.points, k);
    let best = null;
    for (let deg = 0; deg < 180; deg += 3) {
      const a = (deg * Math.PI) / 180;
      const c = Math.cos(a);
      const s = Math.sin(a);
      const b = bbox(poly.map((pt) => rot(pt, c, s)));
      if (!best || b.w * b.h < best.b.w * best.b.h) best = { a, b };
    }
    let { a, b } = best;
    if (b.h > b.w) {
      // lay long side horizontal
      a += Math.PI / 2;
      b = bbox(poly.map((pt) => rot(pt, Math.cos(a), Math.sin(a))));
    }
    return { p, poly, a, b };
  });
  items.sort((u, v) => v.b.h - u.b.h);

  const sheets = [];
  let sheet = null;
  const newSheet = (w = W, h = H) => {
    sheet = { w, h, x: margin, y: margin, shelfH: 0, items: [] };
    sheets.push(sheet);
  };
  newSheet();
  for (const it of items) {
    let { w, h } = it.b;
    if (w > W - 2 * margin || h > H - 2 * margin) {
      if (h <= W - 2 * margin && w <= H - 2 * margin) {
        it.a += Math.PI / 2;
        it.b = bbox(it.poly.map((pt) => rot(pt, Math.cos(it.a), Math.sin(it.a))));
        ({ w, h } = it.b);
      } else {
        const prev = sheet;
        newSheet(w + 2 * margin, h + 2 * margin);
        sheet.oversize = true;
        sheet.items.push({ ...it, x: margin, y: margin });
        sheet = prev;
        continue;
      }
    }
    if (sheet.x + w > W - margin) {
      sheet.y += sheet.shelfH + gap;
      sheet.x = margin;
      sheet.shelfH = 0;
    }
    if (sheet.y + h > H - margin) newSheet();
    sheet.items.push({ ...it, x: sheet.x, y: sheet.y });
    sheet.x += w + gap;
    sheet.shelfH = Math.max(sheet.shelfH, h);
  }

  // lay sheets out in a near-square grid so the file previews and imports sensibly
  const used = sheets.filter((s) => s.items.length);
  const cols = Math.ceil(Math.sqrt(used.length));
  const colW = Math.max(...used.map((s) => s.w)) + 20;
  const rowH = Math.max(...used.map((s) => s.h)) + 20;
  used.forEach((s, i) => {
    const ox = (i % cols) * colW;
    const oy = Math.floor(i / cols) * rowH;
    job.guides.push({ x: ox, y: oy, w: s.w, h: s.h, oversize: !!s.oversize });
    for (const it of s.items) {
      const c = Math.cos(it.a);
      const sn = Math.sin(it.a);
      const tx = ox + it.x - it.b.x0;
      const ty = oy + it.y - it.b.y0;
      const tf = (pt) => {
        const [x, y] = rot(pt, c, sn);
        return [x + tx, y + ty];
      };
      job.cut.polys.push(it.poly.map(tf));
      for (const h of it.p.holes) {
        const [x, y] = tf([h.x, h.y]);
        job.cut.circles.push({ x, y, r: h.r - k });
      }
      if (fab.labels) {
        const [x, y] = tf(it.p.label);
        job.labels.push({ x, y, text: it.p.id, size: labelSize });
      }
    }
  });
  job.sheets = used.length;
  job.oversize = used.filter((s) => s.oversize).length;
  const rows = Math.ceil(used.length / cols);
  job.bounds = { x: -2, y: -2, w: Math.min(cols, used.length) * colW - 16, h: rows * rowH - 16 };
}

// ------------------------------------------------------------------ checks

export function checkDesign(design, fab) {
  const pr = PROCESSES[fab.process];
  const p = design.params;
  const out = [];
  const add = (level, text) => out.push({ level, text });
  const D = design.stats.outerDiameter;
  const tool = fab.tool;
  const fmt = (n) => (Math.round(n * 10) / 10).toString();

  // slice gaps and ring gaps must clear the tool so neighbouring parts survive
  const ringGap = design.rings.reduce((m, r, i) => (i ? Math.min(m, r.rIn - r.gapIn) : m), Infinity);
  const clearance = fab.process === 'cnc' ? tool * 1.05 : fab.process === 'laser' ? fab.kerf + 0.4 : tool;
  if (fab.process !== 'plot') {
    if (p.gapWidth < clearance) add('fail', `Slice gaps (${fmt(p.gapWidth)} mm) are narrower than the ${pr.toolLabel.toLowerCase()} — parts would merge. Raise Gap Width to ${fmt(clearance)}+.`);
    else add('ok', `Slice gaps ${fmt(p.gapWidth)} mm clear the ${pr.toolLabel.toLowerCase()}.`);
    if (Number.isFinite(ringGap) && ringGap < clearance) add('fail', `Rings are only ${fmt(ringGap)} mm apart — less than the ${pr.toolLabel.toLowerCase()}. Lower Band Fill or use fewer rings.`);
  }

  const thin = design.parts.filter((pt) => pt.minWidth < p.minWeb - 0.01);
  const thinnest = design.parts.reduce((m, pt) => Math.min(m, pt.minWidth), Infinity);
  if (thin.length) add('warn', `${thin.length} part${thin.length > 1 ? 's' : ''} narrow to ${fmt(thinnest)} mm — under the ${fmt(p.minWeb)} mm minimum web.`);
  else if (design.parts.length) add('ok', `Thinnest section ${fmt(thinnest)} mm.`);

  if (p.wallAngle > 50) add('warn', `Wall angle ${p.wallAngle}° makes knife-edge tips that can snap or scorch.`);
  if (fab.process === 'cnc' && p.notchDepth > 0) add('info', `Inside corners get ${fmt(tool / 2)} mm radii from the bit.`);

  const holes = design.parts.flatMap((pt) => pt.holes);
  if (holes.length) {
    const smallest = Math.min(...holes.map((h) => h.r * 2));
    add('ok', `${holes.length} holes, smallest Ø ${fmt(smallest)} mm (min ${fmt(p.minHole)}).`);
  }

  const bedMax = Math.max(fab.bedW, fab.bedH);
  const bedMin = Math.min(fab.bedW, fab.bedH);
  const total = fab.layout === 'plate' || fab.layout === 'backer' ? D + 2 * fab.border : D;
  if (fab.process === 'print') {
    if (total > bedMin) add('fail', `${fmt(total)} mm disc won't fit the ${fab.bedW}×${fab.bedH} bed. Set Outer Ø to ${Math.floor(bedMin - (fab.stlBase ? 2 * fab.border : 0))} or less.`);
    else add('ok', `Fits the ${fab.bedW}×${fab.bedH} bed.`);
  } else if (fab.layout === 'sheets') {
    const job = buildJob(design, fab);
    if (job.oversize) add('fail', `${job.oversize} part${job.oversize > 1 ? 's are' : ' is'} larger than the bed.`);
    else add('ok', `Packs onto ${job.sheets} sheet${job.sheets > 1 ? 's' : ''} of ${fab.bedW}×${fab.bedH}.`);
  } else if (total > bedMin && total > bedMax) {
    add('warn', `${fmt(total)} mm is larger than the ${fab.bedW}×${fab.bedH} bed. Switch layout to Nested sheets.`);
  } else if (total > bedMin) {
    add('warn', `${fmt(total)} mm only fits the bed's long axis — check your work area.`);
  } else add('ok', `Fits the ${fab.bedW}×${fab.bedH} bed.`);

  if (fab.layout === 'assembled' && fab.process !== 'plot' && fab.process !== 'print') {
    add('info', `${design.parts.length} loose parts — mount them on a Backer disc.`);
  }
  return out;
}

// ------------------------------------------------------------------ estimates

export function estimate(design, fab) {
  const pr = PROCESSES[fab.process];
  const mat = MATERIALS[fab.material] || MATERIALS.birch;
  const s = design.stats;
  const pierces = s.parts + s.cutouts;
  const out = {};
  if (fab.process === 'print') {
    const R = s.outerDiameter / 2 + (fab.stlBase ? fab.border : 0);
    const baseVol = fab.stlBase ? Math.PI * R * R * fab.thickness : 0;
    const avgH = fab.relief + (fab.ringStep * (design.rings.length - 1)) / 2;
    const vol = baseVol + s.areaMm2 * Math.max(0.2, avgH);
    const infill = 0.45; // perimeters + 15% infill, roughly
    out.mass = (vol * infill * mat.density) / 1000;
    out.minutes = (vol * infill) / 10 / 60; // ~10 mm³/s
    out.volume = vol;
  } else {
    const passes = fab.process === 'cnc' ? Math.max(1, Math.ceil(fab.thickness / (fab.tool * 0.5))) : fab.process === 'laser' ? Math.max(1, Math.ceil(fab.thickness / 4)) : 1;
    const engrave = fab.engrave ? s.engraveLengthMm : 0;
    const secs = (s.cutLengthMm * passes) / pr.speed + pierces * pr.pierce + engrave / (pr.speed * (fab.process === 'laser' ? 3 : 1));
    out.minutes = secs / 60;
    out.passes = passes;
    const disc = Math.PI * (s.outerDiameter / 2 + fab.border) ** 2;
    const area = fab.layout === 'plate' ? disc - s.areaMm2 : fab.layout === 'backer' ? disc : s.areaMm2;
    out.mass = (area * fab.thickness * mat.density) / 1000;
  }
  out.pierces = pierces;
  return out;
}
