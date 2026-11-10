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
    speed: 12, pierce: 0.3, toolLabel: 'Beam Ø', pinD: 3,
  },
  cnc: {
    label: 'CNC', tool: 3.175, kerf: 0, minHole: 3.4, minWeb: 3, bed: [1220, 610], thickness: 6,
    material: 'birch', materials: ['birch', 'mdf', 'aluminium', 'brass', 'hdpe', 'acrylic'],
    speed: 20, pierce: 2, toolLabel: 'Bit Ø', pinD: 6,
  },
  print: {
    label: '3D Print', tool: 0.4, kerf: 0, minHole: 1.2, minWeb: 1.2, bed: [256, 256], thickness: 2,
    material: 'pla', materials: ['pla', 'petg'], speed: 0, pierce: 0, toolLabel: 'Nozzle Ø', pinD: 1.75,
  },
  plot: {
    label: 'Pen Plot', tool: 0.5, kerf: 0, minHole: 0.6, minWeb: 0.6, bed: [420, 297], thickness: 0,
    material: 'paper', materials: ['paper'], speed: 40, pierce: 0.1, toolLabel: 'Pen Ø', pinD: 3,
  },
};

export const LAYOUTS = {
  assembled: 'Assembled',
  sheets: 'Nested sheets',
  plate: 'Stencil plate',
  backer: 'Backer disc',
  jig: 'Jig for glue-up',
};

// Typical stock for locating pins: dowel, bamboo skewer, filament, steel dowel pin.
export const PIN_SIZES = [1.75, 2, 3, 4, 5, 6, 8];

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
    pins: true,
    pinD: pr.pinD,
    jigClearance: 0.2,
    engrave: true,
    labels: false,
    mounting: true,
    border: 12,
    relief: 3,
    ringStep: 0.6,
    stlBase: true,
  };
}

// Settings arrive from localStorage, imported JSON and old versions: never trust them.
const FAB_LIMITS = {
  thickness: [0, 50], kerf: [0, 2], tool: [0.05, 25], bedW: [50, 3000], bedH: [50, 3000],
  jigClearance: [0, 2], border: [4, 60], relief: [0.4, 30], ringStep: [-3, 3],
};

export function normalizeFab(input = {}) {
  const process = PROCESSES[input.process] ? input.process : 'laser';
  const def = defaultFab(process);
  const out = { ...def };
  for (const [key, [lo, hi]] of Object.entries(FAB_LIMITS)) {
    const n = Number(input[key]);
    if (input[key] !== undefined && input[key] !== '' && Number.isFinite(n)) out[key] = Math.min(hi, Math.max(lo, n));
  }
  if (PROCESSES[process].materials.includes(input.material)) out.material = input.material;
  if (LAYOUTS[input.layout]) out.layout = input.layout;
  if (PIN_SIZES.includes(Number(input.pinD))) out.pinD = Number(input.pinD);
  for (const key of ['pins', 'engrave', 'labels', 'mounting', 'stlBase']) if (typeof input[key] === 'boolean') out[key] = input[key];
  return out;
}

// Largest outer diameter that fits the bed for the current process and layout.
export function fitDiameter(fab) {
  const disc = fab.process === 'print' ? fab.stlBase : fab.layout !== 'assembled' && fab.layout !== 'sheets';
  return Math.min(fab.bedW, fab.bedH) - (disc ? 2 * fab.border : 0) - 4;
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

// ------------------------------------------------------------------ assembly

// Locating pins: two holes per part (one on short parts) at the roomiest spots
// near each end, so every part only drops onto the backer one way.
export function pinHoleRadius(fab) {
  return fab.pinD / 2 + 0.05;
}

export function withPins(design, fab) {
  if (design.pinned || !fab.pins || fab.process === 'plot') return design;
  const r = pinHoleRadius(fab);
  const need = r + design.params.minWeb;
  const best = (list) => list.reduce((m, sp) => (!m || sp.clear > m.clear ? sp : m), null);
  let pinless = 0;
  const parts = design.parts.map((part) => {
    const ok = part.spots.filter((sp) => sp.clear >= need && Math.hypot(sp.x - part.label[0], sp.y - part.label[1]) > r + 4);
    let pins = [best(ok.filter((sp) => sp.u < 0.4)), best(ok.filter((sp) => sp.u > 0.6))].filter(Boolean);
    if (!pins.length && ok.length) pins = [best(ok)];
    if (!pins.length) pinless++;
    return { ...part, holes: [...part.holes, ...pins.map((sp) => ({ x: sp.x, y: sp.y, r, kind: 'pin' }))] };
  });
  const pins = parts.reduce((n, p) => n + p.holes.filter((h) => h.kind === 'pin').length, 0);
  return { ...design, parts, pinned: true, pinStats: { pins, pinless } };
}

export const alignmentHoles = (design, fab) => {
  const outer = design.stats.outerDiameter / 2 + fab.border;
  const r = Math.max(fab.process === 'cnc' ? fab.tool / 2 + 0.2 : 0, fab.pins ? pinHoleRadius(fab) : 2);
  return Array.from({ length: 4 }, (_, i) => {
    // uneven spacing so the jig can only sit on the backer one way round
    const a = [45, 135, 225, 300][i] * (Math.PI / 180);
    return { x: (outer - fab.border / 2) * Math.cos(a), y: (outer - fab.border / 2) * Math.sin(a), r };
  });
};

// Plain-language build steps for the current process and options.
export function assemblySteps(design, fab) {
  const pin = `${fab.pinD} mm`;
  const pinStock = { 1.75: '1.75 mm filament', 2: '2 mm steel pins', 3: '3 mm dowel or bamboo skewer', 6: '6 mm dowel' }[fab.pinD] || `${pin} dowel`;
  if (fab.process === 'print') {
    return fab.stlBase
      ? [
          'Print the STL as one piece: base, rings and traces are fused, so nothing needs aligning.',
          'For multi-colour, load base / rings / traces STLs from the Bundle together as one multi-part object; they share the same origin.',
          ...(fab.pins ? [`Printing in sections? Rings have ${pin} pin holes and the base has matching pegs.`] : []),
        ]
      : ['Print the rings STL. Each part is a separate body.', ...(fab.pins ? [`Glue onto a backer with ${pinStock} through the pin holes.`] : [])];
  }
  if (fab.process === 'plot') return ['Plot the SVG at 100% scale. Everything is drawn in place.'];
  const steps = [`Cut the parts (${fab.layout === 'sheets' ? 'Nested sheets' : 'Assembled'} layout)${fab.labels ? ' with part numbers' : ''}.`];
  steps.push(`Cut the Backer disc${fab.pins ? ` — it has matching ${pin} pin holes` : ''}${fab.engrave ? ' and the engraved traces' : ''}.`);
  if (fab.pins) {
    steps.push(`Push ${pinStock} into the backer's pin holes, then drop each part onto its pins. Each part only fits one way.`);
    steps.push('Glue, then trim the pins flush from behind.');
  } else {
    steps.push('Cut the Jig, pin it to the backer through the four alignment holes (they only line up one way).');
    steps.push('Drop each part into its window in the jig, glue, then lift the jig off.');
  }
  return steps;
}

// ------------------------------------------------------------------ jobs
//
// A job is the toolpath-level description every exporter consumes:
//   inner:   through-cuts made FIRST (holes, windows, pin holes), while the stock is still held
//   cut:     outlines cut LAST, so nothing shifts or drops before its holes are done
//   engrave: open arcs, closed polylines and filled dots (score / V-carve / ink)
//   labels:  engraved part numbers
//   guides:  sheet outlines (not machined)

export function buildJob(rawDesign, fab) {
  const design = withPins(rawDesign, fab);
  const R = design.stats.outerDiameter / 2;
  const k = (fab.process === 'laser' ? fab.kerf : 0) / 2;
  const job = {
    inner: { polys: [], circles: [] },
    cut: { polys: [], circles: [] },
    engrave: { arcs: [], polys: [], dots: [], lines: [] },
    labels: [],
    guides: [],
    notes: [],
  };
  // a kerf wider than the hole still leaves a hole: keep a pierce point
  const hole = (c) => ({ x: c.x, y: c.y, r: Math.max(0.05, c.r - k) });
  const labelSize = design.labelSize ?? Math.max(2.5, Math.min(5, minPartWidth(design) * 0.45));

  const addTraces = () => {
    if (!fab.engrave) return;
    for (const h of design.hairlines) {
      job.engrave.arcs.push({ cx: 0, cy: 0, r: h.r, a0: h.a0, a1: h.a1 });
      for (const d of h.pads) job.engrave.dots.push({ x: d.x, y: d.y, r: d.r });
    }
  };
  const addMounting = (force = false) => {
    if (!fab.mounting && !force) return;
    for (const h of alignmentHoles(design, fab)) job.inner.circles.push(hole(h));
  };

  switch (fab.layout) {
    case 'plate': {
      const outer = R + fab.border;
      job.cut.circles.push({ x: 0, y: 0, r: outer + k });
      for (const p of design.parts) job.inner.polys.push(offsetPolygon(p.points, -k));
      addTraces();
      addMounting();
      job.bounds = square(outer + 2);
      job.notes.push('Plate stays in one piece; parts are cut out of it as windows.');
      break;
    }
    case 'backer': {
      const outer = R + fab.border;
      job.cut.circles.push({ x: 0, y: 0, r: outer + k });
      for (const p of design.parts) {
        job.engrave.polys.push(p.points);
        for (const h of p.holes) if (h.kind === 'pin') job.inner.circles.push(hole(h));
      }
      addTraces();
      addMounting();
      if (fab.labels) for (const p of design.parts) job.labels.push({ x: p.label[0], y: p.label[1], text: p.id, size: labelSize });
      job.bounds = square(outer + 2);
      job.notes.push(fab.pins ? 'Backer has a pin hole under every part pin, plus engraved outlines.' : 'Backer is engraved with every part outline.');
      break;
    }
    case 'jig': {
      // Stencil with slightly oversize windows; pinned to the backer it holds every part in place for gluing.
      const outer = R + fab.border;
      const clear = fab.jigClearance + k;
      job.cut.circles.push({ x: 0, y: 0, r: outer + k });
      for (const p of design.parts) job.inner.polys.push(offsetPolygon(p.points, clear));
      addMounting(true);
      job.bounds = square(outer + 2);
      job.notes.push(`Windows are ${fab.jigClearance} mm oversize. Align to the backer with pins through the four alignment holes.`);
      break;
    }
    case 'sheets':
      packSheets(design, fab, k, job, labelSize);
      job.notes.push('Traces live between parts: engrave them on a Backer disc.');
      break;
    default: {
      for (const p of design.parts) {
        job.cut.polys.push(offsetPolygon(p.points, k));
        for (const h of p.holes) job.inner.circles.push(hole(h));
        if (fab.labels) job.labels.push({ x: p.label[0], y: p.label[1], text: p.id, size: labelSize });
      }
      // traces sit in the gaps between parts, so on a cutter they belong on the backer
      if (fab.process === 'plot') addTraces();
      else if (design.hairlines.length && fab.engrave) job.notes.push('Traces are engraved on the Backer disc.');
      job.bounds = square(R * 1.02);
    }
  }
  job.stats = jobStats(job);
  return job;
}

const perimeter = (pts) => pts.reduce((s, p, i) => s + Math.hypot(p[0] - pts[(i + 1) % pts.length][0], p[1] - pts[(i + 1) % pts.length][1]), 0);

// What the machine actually does for this sheet: drives the time estimate.
function jobStats(job) {
  let cut = 0;
  let pierces = 0;
  for (const g of [job.inner, job.cut]) {
    for (const p of g.polys) cut += perimeter(p);
    for (const c of g.circles) cut += TAU * c.r;
    pierces += g.polys.length + g.circles.length;
  }
  let engrave = 0;
  for (const a of job.engrave.arcs) engrave += a.r * (a.a1 - a.a0);
  for (const p of job.engrave.polys) engrave += perimeter(p);
  for (const l of job.engrave.lines || []) engrave += Math.hypot(l[1][0] - l[0][0], l[1][1] - l[0][1]);
  for (const d of job.engrave.dots) engrave += TAU * d.r;
  return { cutLengthMm: cut, engraveLengthMm: engrave, pierces };
}

const square = (r) => ({ x: -r, y: -r, w: 2 * r, h: 2 * r });

function minPartWidth(design) {
  return design.parts.reduce((m, p) => Math.min(m, p.minWidth), Infinity);
}

// Nesting. Each part is rotated to its tightest bounding box, then dropped onto a
// per-sheet skyline (1 mm columns) using its true top and bottom profiles, so arcs
// spoon into each other instead of each claiming a whole rectangle.
function profile(pts, x0, cols, pad) {
  const lo = new Float64Array(cols).fill(Infinity);
  const hi = new Float64Array(cols).fill(-Infinity);
  for (let i = 0; i < pts.length; i++) {
    let [ax, ay] = pts[i];
    let [bx, by] = pts[(i + 1) % pts.length];
    if (ax > bx) [ax, ay, bx, by] = [bx, by, ax, ay];
    const c0 = Math.max(0, Math.floor(ax - x0));
    const c1 = Math.min(cols - 1, Math.floor(bx - x0));
    for (let c = c0; c <= c1; c++) {
      // the edge's y-range inside this column
      const xa = Math.max(ax, x0 + c);
      const xb = Math.min(bx, x0 + c + 1);
      const ya = bx === ax ? ay : ay + ((by - ay) * (xa - ax)) / (bx - ax);
      const yb = bx === ax ? by : ay + ((by - ay) * (xb - ax)) / (bx - ax);
      lo[c] = Math.min(lo[c], ya, yb);
      hi[c] = Math.max(hi[c], ya, yb);
    }
  }
  // widen the underside by the part spacing so neighbours keep their distance sideways too
  const hiP = new Float64Array(cols + 2 * pad).fill(-Infinity);
  for (let c = 0; c < cols; c++) {
    if (lo[c] === Infinity) continue;
    for (let d = 0; d <= 2 * pad; d++) {
      hiP[c + d] = Math.max(hiP[c + d], hi[c]);
    }
  }
  return { lo, hi: hiP };
}

function orient(poly, a, pad) {
  const c = Math.cos(a);
  const s = Math.sin(a);
  const pts = poly.map((pt) => rot(pt, c, s));
  const b = bbox(pts);
  const cols = Math.max(1, Math.ceil(b.w));
  return { a, b, cols, ...profile(pts.map(([x, y]) => [x, y - b.y0]), b.x0, cols, pad) };
}

function packSheets(design, fab, k, job, labelSize) {
  const margin = 5;
  const gap = Math.ceil((fab.process === 'cnc' ? fab.tool * 1.5 : 0) + 3);
  const W = Math.floor(fab.bedW);
  const H = Math.floor(fab.bedH);
  const innerW = W - 2 * margin;
  const innerH = H - 2 * margin;

  const items = design.parts.map((p) => {
    const poly = offsetPolygon(p.points, k);
    // tightest box that fits the sheet; the smallest box overall is not always one that fits
    let best = null;
    const consider = (a) => {
      const b = bbox(poly.map((pt) => rot(pt, Math.cos(a), Math.sin(a))));
      const ok = (b.w <= innerW && b.h <= innerH) || (b.w <= innerH && b.h <= innerW);
      const score = b.w * b.h + (ok ? 0 : 1e15);
      if (!best || score < best.score - 1e-9) best = { a, b, score };
    };
    for (let deg = 0; deg < 180; deg += 3) consider((deg * Math.PI) / 180);
    // simple polygons sit tightest along one of their own edges
    if (poly.length <= 12) poly.forEach((pt, i) => consider(-Math.atan2(poly[(i + 1) % poly.length][1] - pt[1], poly[(i + 1) % poly.length][0] - pt[0])));
    // refine around the winner: long straight parts need to sit dead square to fit
    const coarse = best.a;
    for (let d = -1.5; d <= 1.5; d += 0.125) consider(coarse + (d * Math.PI) / 180);
    let a = best.a + (best.b.h > best.b.w ? Math.PI / 2 : 0); // long side along the bed
    let o = orient(poly, a, gap);
    if (o.b.w > innerW && o.b.w <= innerH && o.b.h <= innerW) o = orient(poly, (a += Math.PI / 2), gap);
    const fits = o.b.w <= innerW && o.b.h <= innerH;
    // both ways up, so crescents can face whichever way nests deeper
    return { p, poly, fits, options: fits ? [o, orient(poly, a + Math.PI, gap)] : [o] };
  });
  items.sort((u, v) => v.options[0].b.w * v.options[0].b.h - u.options[0].b.w * u.options[0].b.h);

  const sheets = [];
  const newSheet = () => {
    const sheet = { w: W, h: H, sky: new Float64Array(W + 2 * gap).fill(margin - gap), items: [], fill: 0 };
    sheets.push(sheet);
    return sheet;
  };
  // lowest resting position for one orientation on one sheet
  const drop = (sheet, o) => {
    let best = null;
    for (let x = margin; x + o.b.w <= W - margin + 1e-9; x += 4) {
      let y = margin;
      for (let c = 0; c < o.lo.length; c++) {
        if (o.lo[c] === Infinity) continue;
        y = Math.max(y, sheet.sky[x + gap + c] + gap - o.lo[c]);
      }
      if (y + o.b.h > H - margin) continue;
      if (!best || y + o.b.h < best.bottom - 1e-9) best = { x, y, bottom: y + o.b.h };
    }
    return best;
  };

  for (const it of items) {
    if (!it.fits) {
      const o = it.options[0];
      sheets.push({ w: o.b.w + 2 * margin, h: o.b.h + 2 * margin, oversize: true, items: [{ it, o, x: margin, y: margin }] });
      continue;
    }
    let placed = null;
    // big jobs: try the emptiest and the newest sheets, not every sheet
    const open = sheets.length <= 14 ? sheets : [...new Set([...sheets.filter((sh) => !sh.oversize).sort((u, v) => u.fill - v.fill).slice(0, 10), ...sheets.slice(-4)])];
    for (const sheet of open) {
      if (sheet.oversize) continue;
      for (const o of it.options) {
        const d = drop(sheet, o);
        if (d && (!placed || d.bottom < placed.d.bottom)) placed = { sheet, o, d };
      }
      if (placed) break;
    }
    if (!placed) {
      const sheet = newSheet();
      placed = { sheet, o: it.options[0], d: drop(sheet, it.options[0]) };
    }
    const { sheet, o, d } = placed;
    for (let c = 0; c < o.hi.length; c++) {
      if (o.hi[c] !== -Infinity) sheet.sky[d.x + c] = Math.max(sheet.sky[d.x + c], d.y + o.hi[c]);
    }
    sheet.fill += o.b.w * o.b.h;
    sheet.items.push({ it, o, x: d.x, y: d.y });
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
    for (const { it, o, x, y } of s.items) {
      const c = Math.cos(o.a);
      const sn = Math.sin(o.a);
      const tx = ox + x - o.b.x0;
      const ty = oy + y - o.b.y0;
      const tf = (pt) => {
        const [px, py] = rot(pt, c, sn);
        return [px + tx, py + ty];
      };
      job.cut.polys.push(it.poly.map(tf));
      for (const h of it.p.holes) {
        const [hx, hy] = tf([h.x, h.y]);
        job.inner.circles.push({ x: hx, y: hy, r: Math.max(0.05, h.r - k) });
      }
      for (const c of it.p.cuts || []) job.inner.polys.push(c.map(tf));
      for (const e of it.p.etch || []) job.engrave.polys.push(e.map(tf));
      for (const e of it.p.etchLines || []) job.engrave.lines.push(e.map(tf));
      if (fab.labels) {
        const [lx, ly] = tf(it.p.label);
        job.labels.push({ x: lx, y: ly, text: it.p.id, size: labelSize });
      }
    }
  });
  job.sheets = used.length;
  job.oversize = used.filter((s) => s.oversize).length;
  const rows = Math.ceil(used.length / cols);
  job.bounds = { x: -2, y: -2, w: Math.min(cols, used.length) * colW - 16, h: rows * rowH - 16 };
}

// ------------------------------------------------------------------ checks

export function checkDesign(rawDesign, fab) {
  const design = withPins(rawDesign, fab);
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
  const total = ['plate', 'backer', 'jig'].includes(fab.layout) || (fab.process === 'print' && fab.stlBase) ? D + 2 * fab.border : D;
  if (fab.process === 'print') {
    if (total > bedMin) add('fail', `${fmt(total)} mm disc won't fit the ${fab.bedW}×${fab.bedH} bed. Use Fit to bed, or set Outer Ø to ${Math.floor(fitDiameter(fab))} or less.`);
    else add('ok', `Fits the ${fab.bedW}×${fab.bedH} bed.`);
  } else if (fab.layout === 'sheets') {
    const job = buildJob(design, fab);
    if (job.oversize) add('fail', `${job.oversize} part${job.oversize > 1 ? 's are' : ' is'} larger than the bed.`);
    else add('ok', `Packs onto ${job.sheets} sheet${job.sheets > 1 ? 's' : ''} of ${fab.bedW}×${fab.bedH}.`);
  } else if (total > bedMin && total > bedMax) {
    add('fail', `${fmt(total)} mm is larger than the ${fab.bedW}×${fab.bedH} bed. ${fab.layout === 'assembled' ? 'Switch to Nested sheets or use Fit to bed.' : 'Use Fit to bed.'}`);
  } else if (total > bedMin) {
    add('warn', `${fmt(total)} mm only fits the bed's long axis — check your work area.`);
  } else add('ok', `Fits the ${fab.bedW}×${fab.bedH} bed.`);

  if (design.pinStats) {
    const { pins, pinless } = design.pinStats;
    if (pinless) add('warn', `${pinless} part${pinless > 1 ? 's are' : ' is'} too narrow for ${fab.pinD} mm pins — use a smaller pin or the Glue jig.`);
    else add('ok', `${pins} locating pins (${fab.pinD} mm) — every part has its own.`);
  }
  const discLayout = ['plate', 'backer', 'jig'].includes(fab.layout) || (fab.process === 'print' && fab.stlBase);
  if (discLayout && (fab.mounting || fab.layout === 'jig')) {
    const hr = alignmentHoles(design, fab)[0].r;
    const need = 2 * hr + 2 * p.minWeb;
    if (fab.border < need) add('fail', `Border (${fmt(fab.border)} mm) is too narrow for the ${fmt(hr * 2)} mm alignment holes — raise it to ${Math.ceil(need)}+.`);
  }
  if (fab.layout === 'jig' && p.gapWidth - 2 * fab.jigClearance < 1.5) {
    add('warn', `Jig walls between windows are under 1.5 mm — widen Gap Width.`);
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
    const js = buildJob(design, fab).stats;
    const passes = fab.process === 'cnc' ? Math.max(1, Math.ceil(fab.thickness / (fab.tool * 0.5))) : fab.process === 'laser' ? Math.max(1, Math.ceil(fab.thickness / 4)) : 1;
    const secs = (js.cutLengthMm * passes) / pr.speed + js.pierces * pr.pierce + js.engraveLengthMm / (pr.speed * (fab.process === 'laser' ? 3 : 1));
    out.minutes = secs / 60;
    out.passes = passes;
    out.cutLengthMm = js.cutLengthMm;
    out.pierces = js.pierces;
    const disc = Math.PI * (s.outerDiameter / 2 + fab.border) ** 2;
    const area = fab.layout === 'plate' || fab.layout === 'jig' ? disc - s.areaMm2 : fab.layout === 'backer' ? disc : s.areaMm2;
    out.mass = (area * fab.thickness * mat.density) / 1000;
  }
  out.pierces ??= pierces;
  return out;
}
