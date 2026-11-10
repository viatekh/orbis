// Festival stage facade generator. A front elevation built from flat panels:
// a ring-circuit disc as the centrepiece, surrounded by a lattice of fretwork
// panels with a crown silhouette, and a DJ booth front.
// Every panel is generated small enough to cut from one sheet.
//
// Coordinates are millimetres in SVG orientation: x either side of the
// centreline, y DOWN, ground at y = 0 (so heights are negative y).

import { subRng } from './rng.js';
import { generate, scaleParams, DEFAULTS, quantize } from './generator.js';
import { MATERIALS, signedArea } from './fabrication.js';

const M = 1000;
const TAU = Math.PI * 2;
const EDGE = 40; // sheet margin kept clear on every side
const DISC_REF = 1000; // the disc is generated at this diameter, then scaled

export const TILINGS = { hex: 'Hex', diamond: 'Diamond', shard: 'Shard', brick: 'Brick', none: 'None' };
export const MODULES = { stepped: 'Stepped', pyramid: 'Folded', scales: 'Scales', flat: 'Flat' };
export const MOTIFS = { mixed: 'Mixed', window: 'Window', slots: 'Nested slots', fan: 'Fan', rays: 'Slat fan', louvre: 'Louvre', perf: 'Perforated', solid: 'Solid' };
export const CENTRES = { disc: 'Ring disc', iris: 'Iris', star: 'Star', rosette: 'Rosette', opening: 'Void', none: 'No core' };
export const PETAL_SHAPES = { leaf: 'Leaf', eye: 'Eye', teardrop: 'Teardrop', diamond: 'Diamond', blade: 'Blade' };
const INHERIT = { inherit: 'Same as cell' };
export const PIECE_MODULES = { ...INHERIT, ...MODULES };
export const PIECE_MOTIFS = { ...INHERIT, ...MOTIFS };
export const FORMS = { flat: 'Flat', dome: 'Dome', barrel: 'Barrel', cone: 'Cone', ripple: 'Ripple' };
export const PRINT_SETS = { none: 'Nothing', fit: 'Everything that fits', core: 'Core', petal: 'Petals', spike: 'Spikes' };
export const STAGE_MATERIALS = ['birch', 'mdf', 'hdpe', 'aluminium'];

export const STAGE_GROUPS = [
  { id: 'stage', label: 'Stage' },
  { id: 'centre', label: 'Centre & Medallions' },
  { id: 'petal', label: 'Petal Ring' },
  { id: 'spike', label: 'Spikes' },
  { id: 'facade', label: 'Panel Lattice' },
  { id: 'fret', label: 'Source Panel' },
  { id: 'booth', label: 'DJ Booth' },
];

export const STAGE_PARAMS = [
  { key: 'seed', label: 'Seed', group: 'stage', min: 0, max: 999, step: 1, def: 7, rand: [0, 999] },
  { key: 'width', label: 'Stage Width (m)', group: 'stage', min: 4, max: 30, step: 0.5, def: 18, rand: [13, 22] },
  { key: 'deckHeight', label: 'Deck Height (m)', group: 'stage', min: 0.4, max: 2.4, step: 0.1, def: 1.2, rand: null },
  { key: 'deckDepth', label: 'Deck Depth (m)', group: 'stage', min: 2, max: 12, step: 1, def: 6, rand: null },
  { key: 'chaos', label: 'Randomness', group: 'stage', min: 0, max: 1, step: 0.01, def: 0.35, rand: [0, 0.8] },

  { key: 'discDiameter', label: 'Centre Ø (m)', group: 'centre', min: 1, max: 8, step: 0.1, def: 3.2, rand: [2.4, 4.4] },
  { key: 'lift', label: 'Lift Above Deck (m)', group: 'centre', min: 0, max: 4, step: 0.1, def: 1.7, rand: [1.2, 2.4] },
  { key: 'corePoints', label: 'Core Points', group: 'centre', min: 5, max: 16, step: 1, def: 8, rand: [5, 12] },
  { key: 'coreGap', label: 'Core Gap (mm)', group: 'centre', min: 0, max: 1500, step: 10, def: 0, rand: [0, 500] },
  { key: 'discZ', label: 'Core Stand-off (mm)', group: 'centre', min: 0, max: 800, step: 10, def: 300, rand: [150, 500] },
  { key: 'discStep', label: 'Ring Step (mm)', group: 'centre', min: -150, max: 150, step: 5, def: 45, rand: [-80, 100] },
  { key: 'sideDisc', label: 'Side Medallion Ø (m)', group: 'centre', min: 0, max: 4, step: 0.1, def: 1.8, rand: [0, 2.6] },
  { key: 'sideOffset', label: 'Medallion Offset (m)', group: 'centre', min: 2, max: 12, step: 0.1, def: 6.2, rand: [4.5, 7] },

  { key: 'petals', label: 'Petals', group: 'petal', min: 0, max: 24, step: 1, def: 14, rand: [0, 18] },
  { key: 'petalLength', label: 'Length (m)', group: 'petal', min: 0.5, max: 2.3, step: 0.05, def: 1.5, rand: [1, 2] },
  { key: 'petalWidth', label: 'Width (m)', group: 'petal', min: 0.2, max: 1.1, step: 0.05, def: 0.7, rand: [0.45, 1] },
  { key: 'petalLean', label: 'Lean (°)', group: 'petal', min: -60, max: 60, step: 1, def: 22, rand: [-45, 45] },
  { key: 'petalAsym', label: 'Flame', group: 'petal', min: 0, max: 0.6, step: 0.01, def: 0.3, rand: [0, 0.55] },
  { key: 'petalLayers', label: 'Layers', group: 'petal', min: 1, max: 3, step: 1, def: 3, rand: [2, 3] },

  { key: 'spikes', label: 'Spikes', group: 'spike', min: 0, max: 24, step: 1, def: 0, rand: [0, 14] },
  { key: 'spikeStart', label: 'Start Radius (m)', group: 'spike', min: 1, max: 10, step: 0.1, def: 3.4, rand: [2.6, 4.5] },
  { key: 'spikeLength', label: 'Length (m)', group: 'spike', min: 0.5, max: 2.3, step: 0.05, def: 2, rand: [1.2, 2.3] },
  { key: 'spikeWidth', label: 'Width (m)', group: 'spike', min: 0.15, max: 1.1, step: 0.05, def: 0.5, rand: [0.3, 0.8] },

  { key: 'cells', label: 'Cells Around', group: 'facade', min: 10, max: 48, step: 2, def: 24, rand: [16, 30] },
  { key: 'stretch', label: 'Radial Stretch', group: 'facade', min: 0.6, max: 1.8, step: 0.05, def: 1, rand: [0.8, 1.4] },
  { key: 'crownHeight', label: 'Crown Height (m)', group: 'facade', min: 2, max: 12, step: 0.1, def: 8.4, rand: [7.8, 10] },
  { key: 'crownPoints', label: 'Crown Points', group: 'facade', min: 0, max: 9, step: 1, def: 5, rand: [0, 7] },
  { key: 'crownDepth', label: 'Crown Depth', group: 'facade', min: 0, max: 0.6, step: 0.01, def: 0.18, rand: [0.1, 0.45] },
  { key: 'squareness', label: 'Squareness', group: 'facade', min: 1.2, max: 5, step: 0.1, def: 2.8, rand: [1.8, 3.6] },
  { key: 'joint', label: 'Shadow Gap (mm)', group: 'facade', min: 20, max: 150, step: 5, def: 50, rand: [30, 80] },
  { key: 'subdivide', label: 'Subdivision', group: 'facade', min: 0, max: 1, step: 0.01, def: 0.2, rand: [0, 0.5] },
  { key: 'erode', label: 'Edge Erosion', group: 'facade', min: 0, max: 1, step: 0.01, def: 0.1, rand: [0, 0.5] },

  { key: 'formDepth', label: 'Form Depth (m)', group: 'facade', min: -4, max: 4, step: 0.1, def: 1.5, rand: [-2.5, 2.5] },

  { key: 'depth', label: 'Relief Depth (mm)', group: 'fret', min: -600, max: 600, step: 10, def: 260, rand: [-350, 450] },
  { key: 'steps', label: 'Steps', group: 'fret', min: 1, max: 4, step: 1, def: 2, rand: [1, 3] },
  { key: 'detail', label: 'Detail', group: 'fret', min: 0, max: 1, step: 0.01, def: 0.6, rand: [0.3, 1] },
  { key: 'rim', label: 'Rim Width (mm)', group: 'fret', min: 30, max: 200, step: 5, def: 60, rand: [45, 100] },
  { key: 'etch', label: 'Etch Lines', group: 'fret', min: 0, max: 3, step: 1, def: 1, rand: [0, 3] },
  { key: 'overlay', label: 'Raised Islands', group: 'fret', min: 0, max: 1, step: 0.01, def: 0.4, rand: [0, 0.8] },

  { key: 'boothWidth', label: 'Booth Width (m)', group: 'booth', min: 0, max: 6, step: 0.1, def: 3, rand: [2, 4] },
  { key: 'boothHeight', label: 'Booth Height (m)', group: 'booth', min: 0.8, max: 1.1, step: 0.05, def: 1.1, rand: null },
];
export const STAGE_PARAM_MAP = Object.fromEntries(STAGE_PARAMS.map((p) => [p.key, p]));

const CHOICES = {
  tiling: TILINGS, module: MODULES, motif: MOTIFS, centre: CENTRES, form: FORMS, petalShape: PETAL_SHAPES,
  coreModule: PIECE_MODULES, coreMotif: PIECE_MOTIFS, spikeModule: PIECE_MODULES, spikeMotif: PIECE_MOTIFS, petalMotif: PIECE_MOTIFS,
};
// Each piece can follow the lattice cell or carry its own module and fretwork.
const own = (p, piece, kind) => (p[`${piece}${kind}`] && p[`${piece}${kind}`] !== 'inherit' ? p[`${piece}${kind}`] : p[kind.toLowerCase()]);
const FLAGS = ['mirror', 'truss', 'backlit'];

export const STAGE_DEFAULTS = {
  ...Object.fromEntries(STAGE_PARAMS.map((p) => [p.key, p.def])),
  tiling: 'hex',
  module: 'stepped',
  motif: 'mixed',
  centre: 'disc',
  form: 'flat',
  petalShape: 'leaf',
  coreModule: 'inherit',
  coreMotif: 'inherit',
  spikeModule: 'inherit',
  spikeMotif: 'inherit',
  petalMotif: 'inherit',
  mirror: true,
  truss: true,
  backlit: true,
};

export function normalizeStage(input = {}) {
  const out = {};
  for (const def of STAGE_PARAMS) out[def.key] = quantize(def, input[def.key] ?? def.def);
  for (const [key, set] of Object.entries(CHOICES)) out[key] = set[input[key]] ? input[key] : STAGE_DEFAULTS[key];
  for (const key of FLAGS) out[key] = typeof input[key] === 'boolean' ? input[key] : STAGE_DEFAULTS[key];
  return out;
}

const FAB_LIMITS = { sheetW: [600, 4000], sheetH: [300, 2500], thickness: [3, 30], tool: [1, 20], printBed: [100, 2000], printThickness: [1, 30] };
export const STAGE_FAB_DEFAULTS = { sheetW: 2440, sheetH: 1220, thickness: 12, tool: 6, material: 'birch', labels: true, led: true, printBed: 245, printThickness: 4, printSet: 'none' };

export function normalizeStageFab(input = {}) {
  const out = { ...STAGE_FAB_DEFAULTS };
  for (const [key, [lo, hi]] of Object.entries(FAB_LIMITS)) {
    const n = Number(input[key]);
    if (input[key] !== undefined && input[key] !== '' && Number.isFinite(n)) out[key] = Math.min(hi, Math.max(lo, n));
  }
  if (STAGE_MATERIALS.includes(input.material)) out.material = input.material;
  if (PRINT_SETS[input.printSet]) out.printSet = input.printSet;
  for (const key of ['labels', 'led']) if (typeof input[key] === 'boolean') out[key] = input[key];
  return out;
}

// ------------------------------------------------------------------ placement
// A part's points/cuts/holes are its FLAT cut shape. `frame` places that shape in
// 3D: world = o + u*x + v*y, with z towards the audience.

const flatFrame = (z) => ({ o: [0, 0, z], u: [1, 0, 0], v: [0, 1, 0] });
const add3 = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit3 = (a) => {
  const l = Math.hypot(...a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export function world(part, [x, y]) {
  const { o, u, v } = part.frame;
  return [o[0] + u[0] * x + v[0] * y, o[1] + u[1] * x + v[1] * y, o[2] + u[2] * x + v[2] * y];
}
const mirrorPart = (pt) => {
  const f = ([x, y, z]) => [-x, y, z];
  return { ...pt, frame: { o: f(pt.frame.o), u: f(pt.frame.u), v: f(pt.frame.v) } };
};

// ------------------------------------------------------------------ convex geometry
// Every lattice panel is a convex polygon, which keeps clipping and insetting exact.

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const area = (pts) => Math.abs(signedArea(pts));
const perimeter = (pts) => pts.reduce((s, p, i) => s + Math.hypot(p[0] - pts[(i + 1) % pts.length][0], p[1] - pts[(i + 1) % pts.length][1]), 0);
const centroid = (pts) => [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];

// Keep the part of a convex polygon where nx*x + ny*y <= c.
function clipHalf(poly, nx, ny, c) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const da = nx * a[0] + ny * a[1] - c;
    const db = nx * b[0] + ny * b[1] - c;
    if (da <= 0) out.push(a);
    if (da <= 0 !== db <= 0) {
      const t = da / (da - db);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out;
}

// Inward unit normal and offset of each edge: dist(p) = nx*x + ny*y - c is the depth inside that edge.
function edgesOf(poly) {
  const sgn = Math.sign(signedArea(poly)) || 1;
  return poly.map((a, i) => {
    const b = poly[(i + 1) % poly.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const nx = (-sgn * (b[1] - a[1])) / len;
    const ny = (sgn * (b[0] - a[0])) / len;
    return { nx, ny, c: nx * a[0] + ny * a[1] };
  });
}
const deeper = (poly, e, d) => clipHalf(poly, -e.nx, -e.ny, -(e.c + d)); // keep depth >= d
const shallower = (poly, e, d) => clipHalf(poly, e.nx, e.ny, e.c + d); // keep depth <= d
const solid = (poly) => (poly.length >= 3 && area(poly) > 1 ? poly : null);

function insetConvex(poly, d) {
  let out = poly;
  for (const e of edgesOf(poly)) {
    out = deeper(out, e, d);
    if (out.length < 3) return null;
  }
  return solid(out);
}

// Depth of a point inside a convex polygon (negative outside).
function insideBy(poly, x, y) {
  return edgesOf(poly).reduce((m, e) => Math.min(m, e.nx * x + e.ny * y - e.c), Infinity);
}
const inradius = (poly) => insideBy(poly, ...centroid(poly));

function segDist(x, y, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const t = clamp(((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  return Math.hypot(x - a[0] - dx * t, y - a[1] - dy * t);
}

// The tightest bounding box of a convex polygon lies along one of its edges.
function fitsSheet(poly, L, S) {
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 1e-6) continue;
    const ux = (b[0] - a[0]) / len;
    const uy = (b[1] - a[1]) / len;
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (const [x, y] of poly) {
      const u = x * ux + y * uy;
      const v = -x * uy + y * ux;
      u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v);
    }
    const w = u1 - u0;
    const h = v1 - v0;
    if ((w <= L && h <= S) || (w <= S && h <= L)) return true;
  }
  return false;
}

// ------------------------------------------------------------------ lattice

// Tilings are defined on a flat (u, v) grid: v counts columns around the disc,
// u steps outward. Mapping u through an exponential keeps cells the same shape
// as they grow with radius, which is what gives the mandala look.
function tilingCells(tiling, N, uMax) {
  const cells = [];
  const HEX = 2 / Math.sqrt(3);
  const spec = {
    hex: { step: 0.75 * HEX, first: HEX / 2 },
    diamond: { step: 0.62, first: 0.62 },
    shard: { step: 0.8, first: 0.8 },
    brick: { step: 0.72, first: 0.36 },
  }[tiling];
  if (!spec) return cells;
  for (let i = 0; i < 60; i++) {
    const cu = spec.first + i * spec.step;
    if (cu - spec.first > uMax) break;
    const off = i % 2 ? 0.5 : 0;
    for (let j = -N / 2; j <= N / 2; j++) {
      const cv = j + off;
      if (cv <= -N / 2 + 1e-9 || cv > N / 2 + 1e-9) continue;
      const add = (verts, k = 0) => cells.push({ i, cv, k, verts });
      if (tiling === 'hex') {
        add([[cu + HEX / 2, cv], [cu + HEX / 4, cv + 0.5], [cu - HEX / 4, cv + 0.5], [cu - HEX / 2, cv], [cu - HEX / 4, cv - 0.5], [cu + HEX / 4, cv - 0.5]]);
      } else if (tiling === 'diamond') {
        add([[cu - 0.62, cv], [cu, cv + 0.5], [cu + 0.62, cv], [cu, cv - 0.5]]);
      } else if (tiling === 'shard') {
        add([[cu, cv - 0.5], [cu, cv + 0.5], [cu + 0.8, cv]], 0);
        add([[cu, cv - 0.5], [cu - 0.8, cv], [cu, cv + 0.5]], 1);
      } else {
        add([[cu - 0.36, cv - 0.5], [cu - 0.36, cv + 0.5], [cu + 0.36, cv + 0.5], [cu + 0.36, cv - 0.5]]);
      }
    }
  }
  return cells;
}

function subdivide(poly, parity) {
  const c = centroid(poly);
  const k = poly.length;
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  if (k === 6) return [0, 2, 4].map((s) => [c, poly[(s + parity) % 6], poly[(s + parity + 1) % 6], poly[(s + parity + 2) % 6]]);
  if (k === 4) return parity ? [[poly[0], poly[1], poly[2]], [poly[0], poly[2], poly[3]]] : [[poly[1], poly[2], poly[3]], [poly[1], poly[3], poly[0]]];
  if (k === 3) {
    const [m0, m1, m2] = [mid(poly[0], poly[1]), mid(poly[1], poly[2]), mid(poly[2], poly[0])];
    return [[poly[0], m0, m2], [m0, poly[1], m1], [m2, m1, poly[2]], [m0, m1, m2]];
  }
  return poly.map((p, i) => [c, p, poly[(i + 1) % k]]);
}

// Split a cell until every piece fits a sheet, plus optional extra splits for intricacy.
function refine(poly, depth, o) {
  const must = !fitsSheet(poly, o.L, o.S);
  const roll = o.rng();
  const roomy = inradius(poly) > o.minInr * 2.6;
  const wanted = roomy && depth < 2 && !(o.axis && depth > 0) && roll < o.want;
  if (depth < 5 && (must || wanted)) return subdivide(poly, (depth + o.parity) % 2).flatMap((ch) => refine(ch, depth + 1, o));
  return [poly];
}

// ------------------------------------------------------------------ fretwork

// Cut patterns inside a convex panel. Returns polygon cuts and round holes; everything
// keeps at least `web` of material around it. `reserve` keeps the centre solid from that depth.
function fretwork(P, motif, o) {
  const out = { cuts: [], holes: [] };
  const inr = inradius(P);
  const rim = Math.min(Math.max(o.rim, o.web), inr * 0.42);
  const depthMax = o.reserve ? Math.min(o.reserve - o.web * 0.6, inr * 0.9) : inr * 0.9;
  if (motif === 'solid' || rim < o.web || depthMax - rim < o.minSlot) return out; // too small to cut into safely
  const edges = edgesOf(P);
  const keep = (poly) => {
    if (poly.length >= 3 && area(poly) > o.minSlot * o.minSlot * 1.5 && inradius(poly) > o.minSlot * 0.45) out.cuts.push(poly);
  };
  if (o.reserve && motif !== 'slots') motif = 'slots';

  if (motif === 'window') {
    // one big opening: a frame for a diffuser or infill panel
    const w = insetConvex(P, rim);
    if (w) keep(w);
    return out;
  }

  if (motif === 'slots') {
    // concentric rings of slots, bridged at the corners
    const room = depthMax - rim;
    let levels = 1 + Math.round(o.detail * 3);
    while (levels > 1 && room / levels < o.minSlot + o.web) levels--;
    const band = room / levels;
    const slot = Math.max(o.minSlot, Math.min(band, band - Math.max(o.web, band * 0.4)));
    for (let l = 0; l < levels; l++) {
      const d1 = rim + l * band;
      const d2 = Math.min(d1 + slot, depthMax);
      edges.forEach((e, i) => {
        let q = shallower(deeper(P, e, d1), e, d2);
        edges.forEach((f, j) => {
          if (j !== i && q.length >= 3) q = deeper(q, f, d2 + o.web * 0.7);
        });
        keep(q);
      });
    }
    return out;
  }

  const P1 = insetConvex(P, rim);
  if (!P1) return out;

  if (motif === 'fan') {
    // spokes from the centre to every corner, with concentric webs
    const c = centroid(P1);
    const levels = 1 + Math.round(o.detail * 2);
    const inner = edgesOf(P1);
    P1.forEach((a, i) => {
      const tri = insetConvex([c, a, P1[(i + 1) % P1.length]], o.web / 2);
      if (!tri) return;
      const e = inner[i];
      const h = Math.min(e.nx * c[0] + e.ny * c[1] - e.c, depthMax - rim);
      let n = levels;
      while (n > 1 && h / n < o.minSlot + o.web) n--;
      for (let k = 0; k < n; k++) {
        keep(shallower(deeper(tri, e, (h * k) / n + (k ? o.web / 2 : 0)), e, (h * (k + 1)) / n - (k < n - 1 ? o.web / 2 : 0)));
      }
    });
    return out;
  }

  if (motif === 'rays') {
    // slats fanned from one corner
    const n = P1.length;
    const i = (o.parity + (o.spin || 0)) % n;
    const V = P1[i];
    const a0 = Math.atan2(P1[(i + 1) % n][1] - V[1], P1[(i + 1) % n][0] - V[0]);
    let sweep = Math.atan2(P1[(i + n - 1) % n][1] - V[1], P1[(i + n - 1) % n][0] - V[0]) - a0;
    while (sweep > Math.PI) sweep -= TAU;
    while (sweep < -Math.PI) sweep += TAU;
    const reach = Math.max(...P1.map((q) => Math.hypot(q[0] - V[0], q[1] - V[1])));
    let count = Math.round(lerp(4, 11, o.detail));
    while (count > 2 && (reach * Math.abs(sweep)) / count / 2 < o.minSlot) count--;
    const pitch = sweep / count;
    const r0 = Math.min(reach * 0.6, o.web / Math.abs(Math.sin(pitch / 4)) / 2);
    const side = Math.sign(sweep) || 1;
    for (let k = 0; k < count; k++) {
      const b0 = a0 + pitch * (k + 0.25);
      const b1 = a0 + pitch * (k + 0.75);
      const half = (dir, keepSide) => [-Math.sin(dir) * keepSide * side, Math.cos(dir) * keepSide * side];
      let q = P1;
      for (const [nx, ny] of [half(b0, -1), half(b1, 1)]) q = clipHalf(q, nx, ny, nx * V[0] + ny * V[1]);
      const m = (b0 + b1) / 2;
      q = clipHalf(q, -Math.cos(m), -Math.sin(m), -(Math.cos(m) * V[0] + Math.sin(m) * V[1] + r0));
      keep(q);
    }
    return out;
  }

  if (motif === 'louvre') {
    const phi = o.ang + (o.parity ? Math.PI / 2 : 0);
    const ux = Math.cos(phi);
    const uy = Math.sin(phi);
    const along = P1.map(([x, y]) => x * ux + y * uy);
    const lo = Math.min(...along);
    const hi = Math.max(...along);
    const slot = Math.max(o.minSlot, lerp(120, 36, o.detail));
    const bar = Math.max(o.web, slot * 0.7);
    const n = Math.floor((hi - lo + bar) / (slot + bar));
    const start = (lo + hi) / 2 - (n * (slot + bar) - bar) / 2;
    for (let k = 0; k < n; k++) {
      const s = start + k * (slot + bar);
      keep(clipHalf(clipHalf(P1, -ux, -uy, -s), ux, uy, s + slot));
    }
    return out;
  }

  // perf: a halftone of holes, largest at the centre
  const [cx, cy] = centroid(P1);
  const pitch = Math.max(lerp(240, 100, o.detail), 2 * o.minHoleR + o.web);
  const n = Math.ceil((inr * 2) / pitch) + 1;
  for (let a = -n; a <= n; a++) {
    for (let b = -n; b <= n; b++) {
      const x = cx + (a + (b % 2 ? 0.5 : 0)) * pitch;
      const y = cy + b * pitch * 0.866;
      const r = pitch * 0.36 * (1 - 0.55 * Math.min(1, Math.hypot(x - cx, y - cy) / inr));
      if (r >= o.minHoleR && insideBy(P1, x, y) >= r) out.holes.push({ x, y, r, kind: 'bubble' });
    }
  }
  return out;
}

// Where a panel number has the most room: clear of the edge and of every cut.
function labelSpot(P, cuts, holes, rim) {
  const c = centroid(P);
  const cands = [c];
  edgesOf(P).forEach((e, i) => {
    const a = P[i];
    const b = P[(i + 1) % P.length];
    for (const t of [0.5, 0.3, 0.7]) cands.push([lerp(a[0], b[0], t) + e.nx * rim * 0.5, lerp(a[1], b[1], t) + e.ny * rim * 0.5]);
  });
  let best = null;
  for (const [x, y] of cands) {
    let clear = insideBy(P, x, y);
    for (const h of holes) clear = Math.min(clear, Math.hypot(h.x - x, h.y - y) - h.r);
    for (const cut of cuts) {
      const inside = insideBy(cut, x, y) > 0;
      const d = cut.reduce((m, a, i) => Math.min(m, segDist(x, y, a, cut[(i + 1) % cut.length])), Infinity);
      clear = Math.min(clear, inside ? -d : d);
    }
    if (!best || clear > best.clear) best = { pt: [x, y], clear };
  }
  return best.pt;
}

// Etch-only detail: score lines that follow the outline inside the rim, so they never cross a cut.
let ETCH_LINES = 0;
function panel(P, fret, extra) {
  const etch = [];
  if (ETCH_LINES && extra.rim >= 36 && !extra.plain) {
    for (let k = 1; k <= ETCH_LINES; k++) {
      const line = insetConvex(P, (extra.rim * k) / (ETCH_LINES + 1));
      if (line) etch.push(line);
    }
  }
  return { points: P, holes: fret.holes, cuts: fret.cuts, etch, label: labelSpot(P, fret.cuts, fret.holes, extra.rim), ...extra };
}

// ------------------------------------------------------------------ modules
// A module turns one flat cell into the panels that build it: a single fretwork
// panel, a stack of stepped frames, or a folded pyramid of tilted faces.

const MIX = ['slots', 'fan', 'rays', 'louvre', 'perf'];

function modulePanels(P, m) {
  const { web } = m.opts;
  const lift = m.lift || FLAT_LIFT;
  const inr = inradius(P);
  const cP = centroid(P);
  const base = { t: m.t, el: m.el, minWidth: Math.min(web, inr * 2) };
  const flat = (poly, fret, z, layer, rim = Math.min(m.opts.rim, inradius(poly) * 0.42)) => ({ ...panel(poly, fret, { ...base, rim, layer }), frame: lift.frame(cP, m.z0 + z) });

  // folded: every edge becomes a triangular face rising to an apex. On a curved form the
  // base corners follow the surface, so this is also how a form is turned into flat facets.
  if (m.module === 'pyramid' && (Math.abs(m.depth) >= 30 || lift.curved) && P.length <= 8) {
    const at = (q, extra = 0) => [q[0], q[1], lift.z(q[0], q[1]) + m.z0 + extra];
    const C = at(cP, m.depth);
    const out = [];
    P.forEach((a, i) => {
      const A = at(a);
      const B = at(P[(i + 1) % P.length]);
      const e = add3(B, A, -1);
      const len = Math.hypot(...e);
      if (len < web * 3) return;
      const u = unit3(e);
      const w = add3(C, A, -1);
      const along = dot3(w, u);
      const perp = add3(w, u, -along);
      const slant = Math.hypot(...perp);
      const tri = insetConvex([[0, 0], [len, 0], [along, slant]], 4);
      if (!tri || inradius(tri) < web) return;
      const fret = fretwork(tri, m.motif, { ...m.opts, ang: 0, spin: 2, reserve: 0 });
      out.push({
        ...panel(tri, fret, { ...base, rim: Math.min(m.opts.rim, inradius(tri) * 0.42), layer: 1 + (i % 2), tilted: true }),
        frame: { o: A, u, v: unit3(perp) },
      });
    });
    if (out.length) return out;
  }

  // scales: the panel hinges up from its inner edge, overlapping the next row like a shingle
  if (m.module === 'scales' && Math.abs(m.depth) >= 30 && m.origin) {
    const d = Math.hypot(cP[0] - m.origin[0], cP[1] - m.origin[1]) || 1;
    const r = [(cP[0] - m.origin[0]) / d, (cP[1] - m.origin[1]) / d];
    const t = [r[1], -r[0]];
    const hingeAt = Math.min(...P.map((q) => q[0] * r[0] + q[1] * r[1]));
    const h = [cP[0] + r[0] * (hingeAt - (cP[0] * r[0] + cP[1] * r[1])), cP[1] + r[1] * (hingeAt - (cP[0] * r[0] + cP[1] * r[1]))];
    const local = P.map((q) => [(q[0] - h[0]) * t[0] + (q[1] - h[1]) * t[1], (q[0] - h[0]) * r[0] + (q[1] - h[1]) * r[1]]);
    const f = lift.frame(cP, m.z0);
    const to3 = (v2) => add3([f.u[0] * v2[0], f.u[1] * v2[0], f.u[2] * v2[0]], f.v, v2[1]);
    const n = cross3(f.u, f.v);
    const tilt = Math.atan2(m.depth, inr * 2.4);
    const part = panel(local, fretwork(local, m.motif, { ...m.opts, ang: Math.PI / 2 }), { ...base, rim: Math.min(m.opts.rim, inr * 0.42), layer: m.parity || 0, tilted: true });
    return [{ ...part, frame: { o: add3(add3(f.o, to3(h)), n, 0), u: to3(t), v: unit3(add3(to3(r).map((x) => x * Math.cos(tilt)), n, Math.sin(tilt))) } }];
  }

  if (m.module === 'stepped') {
    let K = m.steps;
    const minBand = Math.max(web * 1.8, 55);
    while (K > 0 && (inr * 0.85) / (K + 1) < minBand) K--;
    if (K > 0) {
      const band = (inr * 0.85) / (K + 1);
      const out = [];
      for (let k = 0; k < K; k++) {
        const outer = k ? insetConvex(P, k * band) : P;
        const win = insetConvex(P, k * band + band * 0.72);
        if (!outer || !win) break;
        out.push(flat(outer, { cuts: [win], holes: [] }, (k * m.depth) / K, k, band * 0.72));
      }
      const cap = insetConvex(P, K * band);
      if (cap) out.push(flat(cap, fretwork(cap, m.motif, m.opts), m.depth, K));
      return out;
    }
  }

  // flat panel, optionally with a smaller island stood off its centre
  const island = m.overlayRoll < m.overlay && inr > web * 5 ? insetConvex(P, inr * 0.5) : null;
  if (!island) return [flat(P, fretwork(P, m.motif, m.opts), 0, 0)];
  const solid = m.motif === 'solid';
  return [
    flat(P, fretwork(P, solid ? 'solid' : 'slots', { ...m.opts, reserve: inr * 0.5 }), 0, 0),
    { ...flat(island, fretwork(island, solid ? 'solid' : 'fan', { ...m.opts, rim: web, detail: m.opts.detail * 0.5 }), Math.max(60, Math.abs(m.depth) * 0.5), 1, web), raised: true },
  ];
}

// ------------------------------------------------------------------ forms
// The back surface the panels sit on. Panels stay flat: each one is placed on the
// tangent plane at its centre (or folded into facets that follow the surface).

const FLAT_LIFT = { curved: false, z: () => 0, frame: (c, zoff) => flatFrame(zoff) };

function makeLift(p, ctx) {
  const k = p.formDepth * M;
  if (p.form === 'flat' || !k) return FLAT_LIFT;
  const R = Math.max(ctx.W / 2, 3000);
  const shape = {
    dome: (x, y) => 1 - (x * x + y * y) / (R * R),
    barrel: (x) => 1 - (x * x) / (R * R),
    cone: (x, y) => 1 - Math.hypot(x, y) / R,
    ripple: (x, y) => 0.5 * Math.cos((Math.hypot(x, y) / R) * TAU * 1.5),
  }[p.form];
  const z = (x, y) => k * shape(x, y + ctx.cy);
  return {
    curved: true,
    z,
    frame: (c, zoff) => {
      const fx = (z(c[0] + 10, c[1]) - z(c[0] - 10, c[1])) / 20;
      const fy = (z(c[0], c[1] + 10) - z(c[0], c[1] - 10)) / 20;
      const n = unit3([-fx, -fy, 1]);
      const u = unit3([1, 0, fx]);
      const v = cross3(n, u);
      let o = add3([c[0], c[1], z(c[0], c[1])], n, zoff);
      o = add3(add3(o, u, -c[0]), v, -c[1]);
      return { o, u, v };
    },
  };
}

// ------------------------------------------------------------------ lattice

function buildFacade(p, ctx, holes) {
  const { W, deckH, cy, L, S, web } = ctx;
  const N = p.cells;
  const dv = TAU / N;
  const rBase = ctx.rBase;
  const rTop = Math.max(deckH + p.crownHeight * M - cy, rBase + 900);
  const rSide = W / 2;
  const e = p.squareness;
  const silhouette = (th) => {
    const base = (Math.abs(Math.cos(th) / rTop) ** e + Math.abs(Math.sin(th) / rSide) ** e) ** (-1 / e);
    if (!p.crownPoints) return base;
    const phase = (th / Math.PI) * p.crownPoints;
    const peak = Math.abs((((phase % 1) + 1) % 1) - 0.5) * 2; // 1 at each crown point
    return base * (1 - p.crownDepth * (1 - peak));
  };
  const rMax = Math.max(rTop, rSide) * 1.05;
  const uMax = Math.log(rMax / rBase) / (dv * p.stretch);
  const toXY = ([u, v]) => {
    const r = rBase * Math.exp(u * dv * p.stretch);
    const a = Math.PI / 2 - v * dv;
    return [r * Math.cos(a), -cy - r * Math.sin(a)];
  };
  const shift = p.seed % MIX.length;
  const parts = [];

  for (const cell of tilingCells(p.tiling, N, uMax)) {
    if (p.mirror && cell.cv < -1e-9) continue; // the left half is a mirror image of the right
    const axis = p.mirror && (Math.abs(cell.cv) < 1e-9 || Math.abs(cell.cv - N / 2) < 1e-9);
    const rng = subRng(p.seed, 'cell', cell.i, Math.round(cell.cv * 2), cell.k);
    const raw = cell.verts.map(toXY);
    const c = centroid(raw);
    const rc = Math.hypot(c[0], c[1] + cy);
    const lim = silhouette(Math.atan2(c[0], -(c[1] + cy)));
    const edge = rc / lim;
    const erodeRoll = rng();
    if (edge > 1) continue;
    if (edge > 0.7 && erodeRoll < (p.erode * (edge - 0.7)) / 0.3) continue;
    // medallions punch clean holes through the lattice
    if (holes.some((h) => [c, ...raw].some(([x, y]) => Math.hypot(Math.abs(x) - h.x, y - h.y) < h.r))) continue;

    let poly = clipHalf(raw, 0, 1, -(deckH + 30));
    poly = clipHalf(clipHalf(poly, 1, 0, W / 2), -1, 0, W / 2);
    if (poly.length < 3 || area(poly) < 0.45 * area(raw) || area(poly) < 6e4) continue;

    const t = clamp(1 - (rc - rBase) / (rMax * 0.8 - rBase), 0, 1);
    const pieces = refine(poly, 0, {
      L, S, rng, axis, parity: (cell.i + cell.k) % 2, minInr: Math.max(web * 1.6, 90),
      want: p.subdivide * (0.3 + 0.7 * edge),
    });
    for (const piece of pieces) {
      const P = insetConvex(piece, p.joint / 2);
      const rollMotif = rng();
      const rollPick = rng();
      const overlayRoll = rng();
      if (!P || inradius(P) < web * 0.9) continue;
      const pc = centroid(P);
      let motif = p.motif;
      if (motif === 'mixed') motif = rollMotif < p.chaos * 0.5 ? MIX[Math.floor(rollPick * MIX.length)] : MIX[(cell.i + shift) % MIX.length];
      parts.push(
        ...modulePanels(P, {
          module: p.module, motif, depth: p.depth, steps: p.steps, overlay: p.overlay, overlayRoll, z0: 0, t, el: 'facade',
          lift: ctx.lift, origin: [0, -cy], parity: cell.i % 2,
          opts: { ...ctx.fret, ang: Math.atan2(pc[1] + cy, pc[0]), parity: cell.i % 2, reserve: 0 },
        }),
      );
    }
  }
  if (!p.mirror) return parts;
  return [...parts.filter((pt) => Math.abs(world(pt, centroid(pt.points))[0]) > 1).map(mirrorPart), ...parts];
}

// ------------------------------------------------------------------ petals

// One petal in its own frame: base at the origin, tip along +x. Both sides are
// concave curves, so the outline is convex however lopsided the flame gets.
// Half-width profiles along the petal (0 = base, 1 = tip). All are concave, so every petal is convex.
const PROFILES = {
  leaf: (t) => Math.sin(Math.PI * t) ** 0.85,
  eye: (t) => 4 * t * (1 - t),
  teardrop: (t) => (Math.sqrt(t) * (1 - t)) / 0.3849,
  diamond: (t) => (t < 0.35 ? t / 0.35 : (1 - t) / 0.65),
  blade: (t) => Math.min(1, t / 0.08) * (1 - t) ** 0.6,
};
function petalShape(len, width, asym, kind = 'leaf') {
  const n = 12;
  const f = PROFILES[kind] || PROFILES.leaf;
  const ts = Array.from({ length: n + 1 }, (_, i) => i / n);
  if (kind === 'diamond') ts.splice(5, 0, 0.35);
  if (kind === 'blade') ts.splice(1, 0, 0.08);
  ts.sort((x, y) => x - y);
  const side = (k) => ts.map((t) => [t * len, k * f(t)]);
  const up = side((width / 2) * (1 + asym));
  const down = side((-width / 2) * (1 - asym)).reverse();
  const pts = [...up, ...down.slice(1, -1)];
  return pts.filter((q, i) => Math.hypot(q[0] - pts[(i + 1) % pts.length][0], q[1] - pts[(i + 1) % pts.length][1]) > 1);
}

// A petal's stacked layers, flat and unplaced (used by the ring and the source preview).
function petalLayers(P, p, ctx, t) {
  const inr = inradius(P);
  const K = p.petalLayers;
  const out = [];
  for (let k = 0; k < K; k++) {
    const poly = k ? insetConvex(P, k * inr * 0.3) : P;
    if (!poly || inradius(poly) < ctx.web * 1.2) break;
    const top = k === K - 1;
    const pin = inradius(poly);
    let fret = { cuts: [], holes: [] };
    if (top) {
      const [x, y] = centroid(poly);
      const r = pin * 0.5;
      if (r >= ctx.fret.minHoleR) fret.holes.push({ x, y, r, kind: 'bubble' }); // the eye
    } else {
      const motif = p.petalMotif === 'inherit' ? (p.motif === 'solid' ? 'solid' : 'slots') : p.petalMotif === 'mixed' ? 'rays' : p.petalMotif;
      // nested slots hug the outline under the next layer; other motifs use the whole face
      if (motif === 'slots') fret = fretwork(poly, 'slots', { ...ctx.fret, rim: Math.min(ctx.fret.rim, 45), detail: 0, ang: 0, parity: 0, reserve: inr * 0.3 + ctx.web });
      else fret = fretwork(poly, motif, { ...ctx.fret, rim: Math.min(ctx.fret.rim, 45), ang: Math.PI / 2, parity: 1, spin: 0, reserve: 0 });
    }
    out.push({ ...panel(poly, fret, { t: clamp(t + k * 0.25, 0, 1), el: 'petal', rim: Math.min(45, pin * 0.4), minWidth: ctx.web, layer: k }), z: k });
  }
  return out;
}

function buildPetals(p, ctx) {
  const n = p.petals;
  if (!n) return [];
  const { cy, deckH, L, S } = ctx;
  const len = Math.min(p.petalLength * M, L);
  const width = Math.min(p.petalWidth * M, S);
  const r0 = ctx.rInner + 100;
  const step = Math.max(40, Math.abs(p.depth) * 0.35);
  const parts = [];
  for (let i = 0; i < n; i++) {
    const th = (i * TAU) / n; // clockwise from straight up
    if (p.mirror && th > Math.PI + 1e-9) continue;
    const axis = p.mirror && (th < 1e-9 || Math.abs(th - Math.PI) < 1e-9);
    const phi = Math.atan2(-Math.cos(th), Math.sin(th)) + (axis ? 0 : (p.petalLean * Math.PI) / 180);
    const base = [r0 * Math.sin(th), -cy - r0 * Math.cos(th)];
    const c = Math.cos(phi);
    const s = Math.sin(phi);
    const raw = petalShape(len, width, axis ? 0 : p.petalAsym, p.petalShape).map(([x, y]) => [base[0] + x * c - y * s, base[1] + x * s + y * c]);
    const P = clipHalf(raw, 0, 1, -(deckH + 30));
    if (P.length < 3 || area(P) < 0.6 * area(raw)) continue;
    for (const layer of petalLayers(P, p, ctx, 0.35)) {
      const { z, ...rest } = layer;
      const part = { ...rest, frame: ctx.lift.frame(centroid(P), ctx.petalZ + z * step) };
      parts.push(part);
      if (p.mirror && !axis) parts.push(mirrorPart(part));
    }
  }
  return parts;
}

// ------------------------------------------------------------------ cores

function buildDisc(discParams, seedShift, D, cx, cy, z0, step, ctx) {
  const { L, S } = ctx;
  const k = D / DISC_REF;
  const src = { ...DEFAULTS, ...discParams };
  // manufacturing limits are set at full size, so a small medallion keeps cuttable holes and webs
  const limits = { minHole: (ctx.fret.minHoleR * 2.2) / k, minWeb: ctx.web / k };
  const ref = generate({ ...scaleParams(src, DISC_REF / src.outerDiameter), ...limits, seed: (src.seed + seedShift) % 1000 }, { fit: { L: L / k, S: S / k } });
  const parts = ref.parts.map((pt) => ({
    points: pt.points.map(([x, y]) => [x * k + cx, y * k - cy]),
    holes: pt.holes.map((h) => ({ ...h, x: h.x * k + cx, y: h.y * k - cy, r: h.r * k })),
    cuts: [],
    etch: [],
    label: [pt.label[0] * k + cx, pt.label[1] * k - cy],
    minWidth: pt.minWidth * k,
    t: pt.t,
    el: 'core',
    layer: pt.ring,
    frame: flatFrame(z0 + pt.ring * step),
  }));
  const hairlines = ref.hairlines.map((h) => ({ t: h.t, r: h.r * k, a0: h.a0, a1: h.a1 }));
  return { parts, traces: [{ cx, cy: -cy, z: z0 - 20, hairlines }] };
}

// Polygon cores: rings of convex cells around the centre, each built with the current module.
function coreCells(type, n, R) {
  const P = (r, a) => [r * Math.sin(a), -r * Math.cos(a)]; // a clockwise from straight up
  const h = Math.PI / n;
  const cells = [];
  const ngon = (r, k, cx = 0, cy = 0, rot = 0) => Array.from({ length: k }, (_, i) => [cx + r * Math.sin(rot + (i * TAU) / k), cy - r * Math.cos(rot + (i * TAU) / k)]);
  if (type === 'iris') {
    cells.push({ ring: 2, poly: ngon(0.2 * R, n) });
    for (let i = 0; i < n; i++) cells.push({ ring: 1, poly: [P(0.24 * R, 2 * h * i - h), P(0.6 * R, 2 * h * i - h), P(0.6 * R, 2 * h * i + h), P(0.24 * R, 2 * h * i + h)] });
    for (let i = 0; i < 2 * n; i++) cells.push({ ring: 0, poly: [P(0.64 * R, h * i), P(R, h * i), P(R, h * (i + 1)), P(0.64 * R, h * (i + 1))] });
  } else if (type === 'star') {
    for (let i = 0; i < n; i++) {
      const a = 2 * h * i;
      cells.push({ ring: 1, poly: [[0, 0], P(0.42 * R, a - h), P(0.8 * R, a), P(0.42 * R, a + h)] });
      cells.push({ ring: 0, poly: [P(0.42 * R, a + h), P(0.8 * R, a), P(R, a + h), P(0.8 * R, a + 2 * h)] });
    }
  } else if (type === 'rosette') {
    const ringR = 0.68 * R;
    const rs = Math.min(0.3 * R, ringR * Math.sin(h) * 0.98);
    cells.push({ ring: 1, poly: ngon(Math.max(0.2 * R, ringR - rs * 1.05), n, 0, 0, h) });
    for (let i = 0; i < n; i++) cells.push({ ring: 0, poly: ngon(rs, 6, ...P(ringR, 2 * h * i), 2 * h * i) });
  }
  return cells;
}

function buildCore(type, p, ctx, D, cx, cy, z0, discParams, seedShift) {
  if (type === 'disc') return buildDisc(discParams, seedShift, D, cx, cy, z0, p.discStep, ctx);
  const shift = p.seed % MIX.length;
  const parts = [];
  const never = () => 1;
  for (const cell of coreCells(type, p.corePoints, D / 2)) {
    const placed = cell.poly.map(([x, y]) => [x + cx, y - cy]);
    const pieces = refine(placed, 0, { L: ctx.L, S: ctx.S, rng: never, axis: false, parity: cell.ring % 2, minInr: 90, want: 0 });
    for (const piece of pieces) {
      const poly = insetConvex(piece, Math.min(p.joint, 60) / 2);
      if (!poly || inradius(poly) < ctx.web * 0.9) continue;
      const c = centroid(poly);
      parts.push(
        ...modulePanels(poly, {
          module: own(p, 'core', 'Module'), motif: own(p, 'core', 'Motif') === 'mixed' ? MIX[(cell.ring + shift) % MIX.length] : own(p, 'core', 'Motif'), depth: p.depth * 0.7, steps: p.steps,
          overlay: p.overlay, overlayRoll: 0.5, z0: z0 + cell.ring * p.discStep, t: clamp(0.25 + cell.ring * 0.35, 0, 1), el: 'core',
          origin: [cx, -cy], parity: cell.ring % 2, opts: { ...ctx.fret, ang: Math.atan2(c[1] + cy, c[0] - cx), parity: cell.ring % 2, reserve: 0 },
        }),
      );
    }
  }
  return { parts, traces: [] };
}

// ------------------------------------------------------------------ spikes

// Long kites radiating from behind the lattice: a sunburst or a ring of horns.
function buildSpikes(p, ctx) {
  const n = p.spikes;
  if (!n) return [];
  const { cy, deckH } = ctx;
  const len = Math.min(p.spikeLength * M, ctx.L);
  const w = Math.min(p.spikeWidth * M, ctx.S);
  const r0 = p.spikeStart * M;
  const parts = [];
  for (let i = 0; i < n; i++) {
    const th = ((i + 0.5) * TAU) / n;
    if (p.mirror && th > Math.PI) continue;
    const dir = [Math.sin(th), -Math.cos(th)];
    const nrm = [dir[1], -dir[0]];
    const at = (d, k) => [dir[0] * (r0 + d) + nrm[0] * k, -cy + dir[1] * (r0 + d) + nrm[1] * k];
    const raw = [at(0, 0), at(len * 0.3, w / 2), at(len, 0), at(len * 0.3, -w / 2)];
    const P = clipHalf(raw, 0, 1, -(deckH + 30));
    if (P.length < 3 || area(P) < 0.6 * area(raw)) continue;
    const made = modulePanels(P, {
      module: own(p, 'spike', 'Module') === 'scales' ? 'flat' : own(p, 'spike', 'Module'), motif: own(p, 'spike', 'Motif') === 'mixed' ? 'louvre' : own(p, 'spike', 'Motif'), depth: p.depth * 0.6, steps: 1, overlay: 0, overlayRoll: 1,
      z0: -60, t: 0.9, el: 'spike', lift: ctx.lift, origin: [0, -cy], opts: { ...ctx.fret, ang: Math.atan2(dir[1], dir[0]), parity: 1, reserve: 0 },
    });
    parts.push(...made);
    if (p.mirror) parts.push(...made.map(mirrorPart));
  }
  return parts;
}

// ------------------------------------------------------------------ stage

function partArea(part) {
  return area(part.points) - part.holes.reduce((s, h) => s + Math.PI * h.r * h.r, 0) - (part.cuts || []).reduce((s, c) => s + area(c), 0);
}

const SOLID_CORES = ['disc', 'iris', 'star', 'rosette'];

function context(p, fab) {
  const L = Math.max(fab.sheetW, fab.sheetH) - 2 * EDGE;
  const S = Math.min(fab.sheetW, fab.sheetH) - 2 * EDGE;
  const D = p.discDiameter * M;
  const deckH = p.deckHeight * M;
  const web = Math.max(30, fab.tool * 3, fab.thickness * 2.5);
  const fret = { web, rim: p.rim, detail: p.detail, minSlot: Math.max(22, fab.tool * 2.5), minHoleR: Math.max(14, fab.tool) };
  const hasCore = SOLID_CORES.includes(p.centre);
  // where the surrounding elements start: core edge (or the void), plus the gap
  const rInner = p.centre === 'none' ? 260 : D / 2 + (hasCore ? 60 : 0) + p.coreGap;
  const petalLen = p.petals ? Math.min(p.petalLength * M, L) : 0;
  const ctx = {
    L, S, D, deckH, web, fret, rInner, hasCore,
    W: p.width * M,
    cy: deckH + p.lift * M + D / 2,
    rBase: rInner + 100 + p.joint + petalLen * 0.55,
    petalZ: Math.max(80, p.discZ * 0.5),
  };
  ctx.lift = makeLift(p, ctx);
  return ctx;
}

// The origin pieces every instance is spawned from, laid flat for the editor preview.
export function sourcePanels(input, fabInput = {}, only = null) {
  const p = normalizeStage(input);
  const ctx = context(p, normalizeStageFab(fabInput));
  ETCH_LINES = p.etch;
  const want = (k) => !only || only === k;
  const out = { cell: [], petal: [], spike: [], core: [] };
  const opts = { ...ctx.fret, ang: Math.PI / 2, parity: 0, reserve: 0 };
  if (want('cell')) {
    const HEX = [0, 1, 2, 3, 4, 5].map((i) => [520 * Math.sin((i * Math.PI) / 3), -520 * Math.cos((i * Math.PI) / 3)]);
    const shape = { hex: HEX, diamond: [[0, -640], [420, 0], [0, 640], [-420, 0]], shard: [[0, -560], [500, 320], [-500, 320]], brick: [[-560, -360], [560, -360], [560, 360], [-560, 360]] }[p.tiling] || HEX;
    out.cell = modulePanels(shape, {
      module: p.module, motif: p.motif === 'mixed' ? MIX[p.seed % MIX.length] : p.motif, depth: p.depth, steps: p.steps,
      overlay: p.overlay, overlayRoll: 0.5, z0: 0, t: 0.5, el: 'facade', origin: [0, 2000], opts,
    });
  }
  if (want('petal')) {
    const len = Math.min(p.petalLength * M, ctx.L);
    const up = petalShape(len, Math.min(p.petalWidth * M, ctx.S), p.petalAsym, p.petalShape).map(([x, y]) => [y, len / 2 - x]);
    const step = Math.max(40, Math.abs(p.depth) * 0.35);
    out.petal = petalLayers(up, p, ctx, 0.35).map(({ z, ...rest }) => ({ ...rest, frame: flatFrame(z * step) }));
  }
  if (want('spike')) {
    const len = Math.min(p.spikeLength * M, ctx.L);
    const w = Math.min(p.spikeWidth * M, ctx.S);
    const module = own(p, 'spike', 'Module');
    const motif = own(p, 'spike', 'Motif');
    out.spike = modulePanels([[0, len / 2], [w / 2, len * 0.2], [0, -len / 2], [-w / 2, len * 0.2]], {
      module: module === 'scales' ? 'flat' : module, motif: motif === 'mixed' ? 'louvre' : motif, depth: p.depth * 0.6, steps: 1,
      overlay: 0, overlayRoll: 1, z0: 0, t: 0.9, el: 'spike', opts: { ...opts, parity: 1 },
    });
  }
  if (want('core') && ctx.hasCore) out.core = buildCore(p.centre, p, { ...ctx, lift: FLAT_LIFT }, 1800, 0, 0, 0, DEFAULTS, 0).parts;
  return out;
}

export function generateStage(input, discParams = DEFAULTS, fabInput = {}) {
  const p = normalizeStage(input);
  ETCH_LINES = p.etch;
  const fab = normalizeStageFab(fabInput);
  const ctx = context(p, fab);
  const { L, S, W, deckH, D, cy, web } = ctx;
  const notes = [];
  const traces = [];

  const centreParts = [];
  const liftZ = (x) => ctx.lift.z(x, -cy);
  if (ctx.hasCore) {
    const core = buildCore(p.centre, p, ctx, D, 0, cy, p.discZ + liftZ(0), discParams, 0);
    centreParts.push(...core.parts);
    traces.push(...core.traces);
  }

  // side medallions: a smaller core, mirrored either side
  const holes = [];
  const sideD = p.sideDisc * M;
  if (sideD >= 800) {
    const sx = Math.min(p.sideOffset * M, W / 2 - sideD / 2 - 100);
    if (sx - sideD / 2 < ctx.rBase) notes.push('Side medallions overlap the centre: raise Medallion Offset or widen the stage.');
    else {
      const side = buildCore(ctx.hasCore ? p.centre : 'disc', p, ctx, sideD, sx, cy, p.discZ * 0.7 + liftZ(sx), discParams, 17);
      centreParts.push(...side.parts, ...side.parts.map(mirrorPart));
      for (const tr of side.traces) traces.push(tr, { ...tr, flip: true });
      holes.push({ x: sx, y: -cy, r: sideD / 2 + 40 + p.joint });
    }
  }

  const facade = p.tiling === 'none' ? [] : buildFacade(p, ctx, holes);
  if (p.tiling !== 'none' && !facade.length) notes.push('No room for the panel lattice: widen the stage, raise the crown or shrink the centre.');
  const petals = buildPetals(p, ctx);
  const spikes = buildSpikes(p, ctx);

  const booth = [];
  const bw = p.boothWidth * M;
  if (bw >= 500) {
    const bh = Math.min(p.boothHeight * M, S);
    const n = Math.max(2, Math.ceil(bw / Math.min(L, 1300)));
    const pw = bw / n;
    for (let i = 0; i < n; i++) {
      const x0 = -bw / 2 + i * pw;
      const P = insetConvex([[x0, -deckH], [x0, -deckH - bh], [x0 + pw, -deckH - bh], [x0 + pw, -deckH]], 6);
      const fret = fretwork(P, p.motif === 'solid' ? 'solid' : 'slots', { ...ctx.fret, rim: Math.max(p.rim, 70), ang: 0, parity: 0, reserve: 0 });
      booth.push({ ...panel(P, fret, { t: 0, el: 'booth', layer: 0, rim: Math.max(p.rim, 70), minWidth: web }), frame: flatFrame(1400) });
    }
  }

  // 3D printing: chosen elements whose panels fit the printer bed leave the CNC sheets
  const printable = (pt) => {
    if (fab.printSet === 'none' || pt.el === 'booth') return false;
    if (fab.printSet !== 'fit' && pt.el !== fab.printSet) return false;
    return fitsSheet(pt.points, fab.printBed - 10, fab.printBed - 10);
  };
  const parts = [...spikes, ...facade, ...petals, ...centreParts, ...booth].map((pt, i) => ({ ...pt, id: String(i + 1), spots: [], print: printable(pt) }));
  const wanted = fab.printSet === 'none' ? 0 : parts.filter((pt) => pt.el !== 'booth' && (fab.printSet === 'fit' || pt.el === fab.printSet)).length;

  let top = deckH;
  let half = W / 2;
  let zMax = 0;
  let zMin = 0;
  for (const pt of parts) {
    for (const q of pt.points) {
      const [x, y, z] = world(pt, q);
      if (-y > top) top = -y;
      if (Math.abs(x) > half) half = Math.abs(x);
      if (pt.el !== 'booth') {
        zMax = Math.max(zMax, z);
        zMin = Math.min(zMin, z);
      }
    }
  }
  const cnc = parts.filter((pt) => !pt.print);
  const printed = parts.filter((pt) => pt.print);
  const total = cnc.reduce((s, pt) => s + partArea(pt), 0);
  const printVol = printed.reduce((s, pt) => s + partArea(pt), 0) * fab.printThickness; // mm³
  const footprint = parts.reduce((s, pt) => s + area(pt.points), 0);
  const edges = parts.reduce((s, pt) => s + perimeter(pt.points), 0);
  const traceLen = traces.reduce((s, tr) => s + tr.hairlines.reduce((q, h) => q + h.r * (h.a1 - h.a0), 0), 0);
  const density = (MATERIALS[fab.material] || MATERIALS.birch).density; // g/cm³
  const truss = p.truss ? { w: 2 * half + 1200, h: top + 600 } : null;

  return {
    params: p,
    fab,
    traces,
    centre: [0, -cy],
    parts,
    deck: { w: W, h: deckH, d: p.deckDepth * M },
    truss,
    notes,
    extent: { half, top, zMin, zMax },
    stats: {
      parts: parts.length,
      printed: printed.length,
      printSkipped: wanted - printed.length,
      printKg: (printVol * 0.5 * 1.24) / 1e6, // ~50% effective infill, PLA
      printHours: (printVol * 0.5) / 12 / 3600, // ~12 mm³/s
      raised: parts.filter((pt) => pt.frame.o[2] > 1 && !pt.tilted).length,
      tilted: parts.filter((pt) => pt.tilted).length,
      widthM: (2 * half) / M,
      heightM: top / M,
      reliefMm: zMax - zMin,
      areaM2: total / 1e6,
      diffuserM2: p.backlit ? (footprint - total) / 1e6 : 0,
      massKg: (total * fab.thickness * density) / 1e6,
      ledM: fab.led ? (edges + traceLen) / M : 0,
      deckModules: Math.ceil(W / 2000) * Math.ceil((p.deckDepth * M) / 1000),
      trussM: truss ? (2 * truss.h + truss.w) / M : 0,
      cutouts: parts.reduce((s, pt) => s + pt.holes.length + pt.cuts.length, 0),
    },
  };
}
