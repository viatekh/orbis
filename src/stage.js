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
import { lerp, clamp, area, perimeter, centroid, clipHalf, edgesOf, deeper, shallower, solid, insetConvex, insideBy, inradius, segDist, fitsSheet } from './convex.js';
import { PATTERNS, patternCells } from './patterns.js';
import { RIBBON_MOTIFS, RIBBON_PROFILES, makeSpine, ribbonParts } from './ribbon.js';

export { RIBBON_MOTIFS };

const M = 1000;
const TAU = Math.PI * 2;
const EDGE = 40; // sheet margin kept clear on every side
const DISC_REF = 1000; // the disc is generated at this diameter, then scaled

export const TILINGS = { hex: 'Hex', diamond: 'Diamond', shard: 'Shard', brick: 'Brick', none: 'None' };
export const MODULES = { stepped: 'Stepped', pyramid: 'Folded', mix: 'Star & frame', scales: 'Scales', flat: 'Flat' };
export const LAYOUTS = { radial: 'Radial', grid: 'Grid' };
export const MOTIFS = { mixed: 'Mixed', window: 'Window', slots: 'Nested slots', fan: 'Fan', rays: 'Slat fan', louvre: 'Louvre', perf: 'Perforated', ...PATTERNS, solid: 'Solid' };
export const CENTRES = { disc: 'Ring disc', iris: 'Iris', star: 'Star', rosette: 'Rosette', mandala: 'Mandala', opening: 'Void', none: 'No core' };
export const PETAL_SHAPES = { leaf: 'Leaf', eye: 'Eye', teardrop: 'Teardrop', diamond: 'Diamond', blade: 'Blade', freeform: 'Freeform' };
export const LAYERS = { spike: 'Spikes', tendril: 'Tendrils', facade: 'Lattice', petal: 'Petals', core: 'Core' };
export const ETCH_PATTERNS = { outline: 'Outline', hatch: 'Hatch', grid: 'Grid', rings: 'Contours', ...PATTERNS };
export const TENDRIL_STYLES = { horn: 'Horn', flame: 'Flame', feather: 'Feather', vine: 'Vine' };
const INHERIT = { inherit: 'Same as cell' };
export const PIECE_MODULES = { ...INHERIT, ...MODULES };
export const PIECE_MOTIFS = { ...INHERIT, ...MOTIFS };
export const FORMS = { flat: 'Flat', funnel: 'Funnel', cone: 'Cone', dome: 'Dome', barrel: 'Barrel', ripple: 'Ripple' };
export const PRINT_SETS = { none: 'Nothing', fit: 'Everything that fits', core: 'Core', petal: 'Petals', spike: 'Spikes', tendril: 'Tendrils' };
export const STAGE_MATERIALS = ['birch', 'mdf', 'hdpe', 'aluminium'];

export const STAGE_GROUPS = [
  { id: 'stage', label: 'Stage' },
  { id: 'centre', label: 'Centre & Medallions' },
  { id: 'petal', label: 'Petal Ring' },
  { id: 'spike', label: 'Spikes' },
  { id: 'tendril', label: 'Tendrils' },
  { id: 'facade', label: 'Panel Lattice' },
  { id: 'fret', label: 'Source Panel' },
];

export const STAGE_PARAMS = [
  { key: 'seed', label: 'Seed', group: 'stage', min: 0, max: 999, step: 1, def: 7, rand: [0, 999] },
  { key: 'width', label: 'Stage Width (m)', group: 'stage', min: 4, max: 30, step: 0.5, def: 18, rand: [13, 22] },
  { key: 'deckHeight', label: 'Deck Height (m)', group: 'stage', min: 0.4, max: 2.4, step: 0.1, def: 1.2, rand: null },
  { key: 'deckDepth', label: 'Deck Depth (m)', group: 'stage', min: 2, max: 12, step: 1, def: 6, rand: null },
  { key: 'chaos', label: 'Randomness', group: 'stage', min: 0, max: 1, step: 0.01, def: 0.35, rand: [0, 0.8] },

  { key: 'layerGap', label: 'Layer Spacing (mm)', group: 'stage', min: 0, max: 600, step: 10, def: 140, rand: [60, 260] },

  { key: 'discDiameter', label: 'Centre Ø (m)', group: 'centre', min: 1, max: 8, step: 0.1, def: 3.2, rand: [2.4, 4.4] },
  { key: 'lift', label: 'Lift Above Deck (m)', group: 'centre', min: 0, max: 4, step: 0.1, def: 1.7, rand: [1.2, 2.4] },
  { key: 'corePoints', label: 'Core Points', group: 'centre', min: 5, max: 16, step: 1, def: 8, rand: [5, 12] },
  { key: 'coreGap', label: 'Core Gap (mm)', group: 'centre', min: 0, max: 1500, step: 10, def: 0, rand: [0, 500] },
  { key: 'discZ', label: 'Core Stand-off (mm)', group: 'centre', min: 0, max: 800, step: 10, def: 120, rand: [150, 500] },
  { key: 'discStep', label: 'Ring Step (mm)', group: 'centre', min: -150, max: 150, step: 5, def: 45, rand: [-80, 100] },
  { key: 'sideDisc', label: 'Side Medallion Ø (m)', group: 'centre', min: 0, max: 4, step: 0.1, def: 1.8, rand: [0, 2.6] },
  { key: 'sideOffset', label: 'Medallion Offset (m)', group: 'centre', min: 2, max: 12, step: 0.1, def: 6.2, rand: [4.5, 7] },

  { key: 'petals', label: 'Petals', group: 'petal', min: 0, max: 24, step: 1, def: 14, rand: [0, 18] },
  { key: 'petalLength', label: 'Length (m)', group: 'petal', min: 0.5, max: 2.3, step: 0.05, def: 1.5, rand: [1, 2] },
  { key: 'petalWidth', label: 'Width (m)', group: 'petal', min: 0.2, max: 1.1, step: 0.05, def: 0.7, rand: [0.45, 1] },
  { key: 'petalLean', label: 'Lean (°)', group: 'petal', min: -60, max: 60, step: 1, def: 22, rand: [-45, 45] },
  { key: 'petalAsym', label: 'Flame', group: 'petal', min: 0, max: 0.6, step: 0.01, def: 0.3, rand: [0, 0.55] },
  { key: 'petalCurl', label: 'Curl', group: 'petal', min: -1, max: 1, step: 0.01, def: 0, rand: [-0.8, 0.8] },
  { key: 'petalLayers', label: 'Layers', group: 'petal', min: 1, max: 3, step: 1, def: 3, rand: [2, 3] },

  { key: 'spikes', label: 'Spikes', group: 'spike', min: 0, max: 24, step: 1, def: 0, rand: [0, 14] },
  { key: 'spikeStart', label: 'Start Radius (m)', group: 'spike', min: 1, max: 10, step: 0.1, def: 3.4, rand: [2.6, 4.5] },
  { key: 'spikeLength', label: 'Length (m)', group: 'spike', min: 0.5, max: 2.3, step: 0.05, def: 2, rand: [1.2, 2.3] },
  { key: 'spikeWidth', label: 'Width (m)', group: 'spike', min: 0.15, max: 1.1, step: 0.05, def: 0.5, rand: [0.3, 0.8] },

  { key: 'spikeCurl', label: 'Curl (flame)', group: 'spike', min: -1, max: 1, step: 0.01, def: 0, rand: [-0.8, 0.8] },

  { key: 'tendrils', label: 'Per Side', group: 'tendril', min: 0, max: 6, step: 1, def: 0, rand: [0, 4] },
  { key: 'tendrilLength', label: 'Length (m)', group: 'tendril', min: 2, max: 10, step: 0.1, def: 6, rand: [4, 8] },
  { key: 'tendrilCurl', label: 'Curl', group: 'tendril', min: -1, max: 1, step: 0.01, def: 0.55, rand: [-0.9, 0.9] },
  { key: 'tendrilWidth', label: 'Base Width (m)', group: 'tendril', min: 0.2, max: 1.1, step: 0.05, def: 0.7, rand: [0.4, 1] },
  { key: 'tendrilFrom', label: 'First Angle (°)', group: 'tendril', min: 0, max: 150, step: 1, def: 25, rand: [10, 70] },
  { key: 'tendrilSweep', label: 'Fan Sweep (°)', group: 'tendril', min: 0, max: 150, step: 1, def: 85, rand: [40, 110] },
  { key: 'tendrilLeaves', label: 'Leaves / Barbs', group: 'tendril', min: 0, max: 1, step: 0.01, def: 0.7, rand: [0.3, 1] },

  { key: 'cells', label: 'Cells Around', group: 'facade', min: 10, max: 48, step: 2, def: 24, rand: [16, 30] },
  { key: 'stretch', label: 'Radial Stretch', group: 'facade', min: 0.6, max: 1.8, step: 0.05, def: 1, rand: [0.8, 1.4] },
  { key: 'crownHeight', label: 'Crown Height (m)', group: 'facade', min: 2, max: 12, step: 0.1, def: 8.4, rand: [7.8, 10] },
  { key: 'crownPoints', label: 'Crown Points', group: 'facade', min: 0, max: 9, step: 1, def: 5, rand: [0, 7] },
  { key: 'crownDepth', label: 'Crown Depth', group: 'facade', min: 0, max: 0.6, step: 0.01, def: 0.18, rand: [0.1, 0.45] },
  { key: 'squareness', label: 'Squareness', group: 'facade', min: 1.2, max: 5, step: 0.1, def: 2.8, rand: [1.8, 3.6] },
  { key: 'joint', label: 'Shadow Gap (mm)', group: 'facade', min: 20, max: 150, step: 5, def: 50, rand: [30, 80] },
  { key: 'subdivide', label: 'Subdivision', group: 'facade', min: 0, max: 1, step: 0.01, def: 0.1, rand: [0, 0.5] },
  { key: 'erode', label: 'Edge Erosion', group: 'facade', min: 0, max: 1, step: 0.01, def: 0, rand: [0, 0.5] },

  { key: 'formDepth', label: 'Form Depth (m)', group: 'facade', min: -8, max: 8, step: 0.1, def: -3, rand: [-5, 5] },
  { key: 'zones', label: 'Bands', group: 'facade', min: 1, max: 6, step: 1, def: 3, rand: [2, 5] },
  { key: 'bandStep', label: 'Band Step (mm)', group: 'facade', min: -800, max: 800, step: 10, def: 250, rand: [-500, 500] },

  { key: 'depth', label: 'Relief Depth (mm)', group: 'fret', min: -600, max: 600, step: 10, def: 260, rand: [-350, 450] },
  { key: 'steps', label: 'Steps', group: 'fret', min: 1, max: 4, step: 1, def: 2, rand: [1, 3] },
  { key: 'detail', label: 'Detail', group: 'fret', min: 0, max: 1, step: 0.01, def: 0.6, rand: [0.3, 1] },
  { key: 'rim', label: 'Rim Width (mm)', group: 'fret', min: 30, max: 200, step: 5, def: 60, rand: [45, 100] },
  { key: 'etch', label: 'Etch Lines', group: 'fret', min: 0, max: 3, step: 1, def: 1, rand: [0, 3] },
  { key: 'overlay', label: 'Raised Islands', group: 'fret', min: 0, max: 1, step: 0.01, def: 0.4, rand: [0, 0.8] },

  { key: 'boothWidth', label: 'Booth Width (m)', group: 'booth', min: 0, max: 6, step: 0.1, def: 0, rand: null },
  { key: 'boothHeight', label: 'Booth Height (m)', group: 'booth', min: 0.8, max: 1.1, step: 0.05, def: 1.1, rand: null },
];
export const STAGE_PARAM_MAP = Object.fromEntries(STAGE_PARAMS.map((p) => [p.key, p]));

const CHOICES = {
  tiling: TILINGS, module: MODULES, motif: MOTIFS, centre: CENTRES, form: FORMS, petalShape: PETAL_SHAPES,
  etchPattern: ETCH_PATTERNS, tendrilStyle: TENDRIL_STYLES, layout: LAYOUTS, ribbonMotif: RIBBON_MOTIFS,
  coreModule: PIECE_MODULES, coreMotif: PIECE_MOTIFS, spikeModule: PIECE_MODULES, spikeMotif: PIECE_MOTIFS, petalMotif: PIECE_MOTIFS,
};
// Each piece can follow the lattice cell or carry its own module and fretwork.
const own = (p, piece, kind) => (p[`${piece}${kind}`] && p[`${piece}${kind}`] !== 'inherit' ? p[`${piece}${kind}`] : p[kind.toLowerCase()]);
const FLAGS = ['mirror', 'truss', 'backlit', 'spikeCrown'];

export const STAGE_DEFAULTS = {
  ...Object.fromEntries(STAGE_PARAMS.map((p) => [p.key, p.def])),
  tiling: 'hex',
  layout: 'radial',
  module: 'stepped',
  motif: 'mixed',
  centre: 'disc',
  form: 'funnel',
  petalShape: 'leaf',
  etchPattern: 'outline',
  tendrilStyle: 'horn',
  ribbonMotif: 'vein',
  layerOrder: Object.keys(LAYERS), // back to front
  hidden: [],
  petalNodes: [0.5, 0.9, 1, 0.7, 0.35], // freeform petal half-widths from base to tip
  coreModule: 'inherit',
  coreMotif: 'inherit',
  spikeModule: 'inherit',
  spikeMotif: 'inherit',
  petalMotif: 'inherit',
  mirror: true,
  spikeCrown: false, // spikes ride the crown edge instead of a fixed radius
  truss: true,
  backlit: true,
};

export function normalizeStage(input = {}) {
  const out = {};
  for (const def of STAGE_PARAMS) out[def.key] = quantize(def, input[def.key] ?? def.def);
  for (const [key, set] of Object.entries(CHOICES)) out[key] = set[input[key]] ? input[key] : STAGE_DEFAULTS[key];
  for (const key of FLAGS) out[key] = typeof input[key] === 'boolean' ? input[key] : STAGE_DEFAULTS[key];
  const order = Array.isArray(input.layerOrder) ? input.layerOrder.filter((k, i, a) => LAYERS[k] && a.indexOf(k) === i) : [];
  out.layerOrder = [...Object.keys(LAYERS).filter((k) => !order.includes(k)), ...order];
  out.hidden = Array.isArray(input.hidden) ? Object.keys(LAYERS).filter((k) => input.hidden.includes(k)) : [];
  out.petalNodes = STAGE_DEFAULTS.petalNodes.map((d, i) => {
    const v = Number(Array.isArray(input.petalNodes) ? input.petalNodes[i] : d);
    return Number.isFinite(v) ? Math.round(Math.min(1, Math.max(0.05, v)) * 100) / 100 : d;
  });
  return out;
}

const FAB_LIMITS = { sheetW: [600, 4000], sheetH: [300, 2500], thickness: [3, 30], tool: [1, 20], printBed: [100, 2000], printThickness: [1, 30], fixing: [0, 16] };
// Resize the whole design: sizes scale together, fabrication constants (sheet, bit, thickness) do not.
const SCALED = ['width', 'discDiameter', 'lift', 'coreGap', 'discZ', 'discStep', 'sideDisc', 'sideOffset', 'bandStep', 'petalLength', 'petalWidth', 'spikeStart', 'spikeLength', 'spikeWidth', 'tendrilLength', 'tendrilWidth', 'crownHeight', 'joint', 'formDepth', 'depth', 'rim', 'layerGap'];
export function scaleStage(params, k) {
  const out = { ...params };
  for (const key of SCALED) out[key] = params[key] * k;
  return normalizeStage(out);
}

export const STAGE_FAB_DEFAULTS = { sheetW: 2440, sheetH: 1220, thickness: 12, tool: 6, material: 'birch', labels: true, led: true, printBed: 245, printThickness: 4, printSet: 'none', fixing: 0 };

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

// Splits are chosen to look deliberate: a hexagon becomes a centre with six matching
// surrounds, a diamond two mirrored halves, anything long is halved across its length.
function subdivide(poly) {
  const c = centroid(poly);
  const k = poly.length;
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const len = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  if (k === 6) {
    const inner = poly.map((q) => mid(q, c));
    return [inner, ...poly.map((q, i) => [q, poly[(i + 1) % 6], inner[(i + 1) % 6], inner[i]])];
  }
  if (k === 4) {
    const sides = poly.map((q, i) => len(q, poly[(i + 1) % 4]));
    if (Math.max(...sides) < Math.min(...sides) * 1.25) {
      // a diamond: cut along the shorter diagonal
      return len(poly[0], poly[2]) < len(poly[1], poly[3]) ? [[poly[0], poly[1], poly[2]], [poly[0], poly[2], poly[3]]] : [[poly[1], poly[2], poly[3]], [poly[1], poly[3], poly[0]]];
    }
    const i = sides[0] + sides[2] > sides[1] + sides[3] ? 0 : 1;
    const [m0, m1] = [mid(poly[i], poly[i + 1]), mid(poly[i + 2], poly[(i + 3) % 4])];
    return [[poly[i], m0, m1, poly[(i + 3) % 4]], [m0, poly[i + 1], poly[i + 2], m1]];
  }
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
  if (depth < 5 && (must || wanted)) return subdivide(poly).flatMap((ch) => refine(ch, depth + 1, o));
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
          if (j !== i && q.length >= 3) q = deeper(q, f, d2 + o.web);
        });
        keep(q);
      });
    }
    return out;
  }

  const P1 = insetConvex(P, rim);
  if (!P1) return out;

  if (PATTERNS[motif]) {
    const c = centroid(P1);
    const pitch = Math.max(lerp(300, 135, o.detail), (o.minSlot + o.web) * 1.7);
    const res = patternCells(motif, P1, {
      pitch, gap: o.web, minR: o.minHoleR, ang: o.ang || 0,
      rng: subRng('fret', motif, Math.round(c[0]), Math.round(c[1]), P.length),
    });
    res.polys.forEach(keep);
    for (const h of res.holes) out.holes.push({ ...h, kind: 'bubble' });
    return out;
  }

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

// Parameter interval of segment a→b that lies at least `margin` inside a convex polygon's edges.
function insideInterval(a, b, edges, margin) {
  let t0 = 0;
  let t1 = 1;
  for (const e of edges) {
    const da = e.nx * a[0] + e.ny * a[1] - e.c - margin;
    const db = e.nx * b[0] + e.ny * b[1] - e.c - margin;
    if (da < 0 && db < 0) return null;
    if (da < 0) t0 = Math.max(t0, da / (da - db));
    else if (db < 0) t1 = Math.min(t1, da / (da - db));
  }
  return t1 - t0 > 1e-6 ? [t0, t1] : null;
}

// Etch-only detail: score lines on the solid parts of a panel. Every line is clipped
// against the cutouts (with a margin), so nothing is engraved across an opening.
let ETCH = { n: 0, pattern: 'outline' };
const ETCH_GAP = 8;
function etchDetail(P, fret, rim) {
  const out = { etch: [], etchLines: [] };
  if (!ETCH.n) return out;
  if (ETCH.pattern === 'outline') {
    if (rim < 36) return out;
    for (let k = 1; k <= ETCH.n; k++) {
      const line = insetConvex(P, (rim * k) / (ETCH.n + 1));
      if (line) out.etch.push(line);
    }
    return out;
  }
  const Pin = insetConvex(P, Math.max(14, Math.min(rim, 40) * 0.4));
  if (!Pin) return out;
  const bounds = edgesOf(Pin);
  const spacing = [0, 190, 120, 78][ETCH.n];
  const segs = [];
  const within = (a, b) => {
    const iv = insideInterval(a, b, bounds, 0);
    if (iv) segs.push([[a[0] + (b[0] - a[0]) * iv[0], a[1] + (b[1] - a[1]) * iv[0]], [a[0] + (b[0] - a[0]) * iv[1], a[1] + (b[1] - a[1]) * iv[1]]]);
  };
  const c = centroid(Pin);
  const reach = Math.max(...Pin.map((q) => Math.hypot(q[0] - c[0], q[1] - c[1]))) + 10;
  const hatch = (ang) => {
    const d = [Math.cos(ang), Math.sin(ang)];
    const n = [-d[1], d[0]];
    for (let k = -Math.ceil(reach / spacing); k * spacing <= reach; k++) {
      const m = [c[0] + n[0] * (k + 0.5) * spacing, c[1] + n[1] * (k + 0.5) * spacing];
      within([m[0] - d[0] * reach, m[1] - d[1] * reach], [m[0] + d[0] * reach, m[1] + d[1] * reach]);
    }
  };
  const edge0 = Math.atan2(P[1][1] - P[0][1], P[1][0] - P[0][0]);
  if (ETCH.pattern === 'hatch') hatch(edge0 + Math.PI / 4);
  else if (ETCH.pattern === 'grid') {
    hatch(edge0 + Math.PI / 6);
    hatch(edge0 - Math.PI / 6);
  } else if (ETCH.pattern === 'rings') {
    for (let d = spacing * 0.5; d < inradius(Pin); d += spacing * 0.6) {
      const ring = insetConvex(Pin, d);
      if (!ring) break;
      ring.forEach((q, i) => segs.push([q, ring[(i + 1) % ring.length]]));
    }
  } else if (ETCH.pattern !== 'voronoi') {
    // library patterns: draw each shape's outline once
    const res = patternCells(ETCH.pattern, Pin, {
      pitch: spacing * 1.25, gap: Math.max(16, spacing * 0.16), inset: 0, minR: 10, ang: edge0,
      rng: subRng('etch', ETCH.pattern, Math.round(c[0]), Math.round(c[1]), P.length),
    });
    const seen = new Set();
    const key = (q) => `${Math.round(q[0])},${Math.round(q[1])}`;
    for (const poly of res.polys) {
      poly.forEach((a, i) => {
        const b = poly[(i + 1) % poly.length];
        const k = [key(a), key(b)].sort().join('|');
        if (!seen.has(k) && insideBy(Pin, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2) > 0.5) segs.push([a, b]);
        seen.add(k);
      });
    }
    for (const h of res.holes) {
      for (let i = 0; i < 14; i++) segs.push([[h.x + h.r * Math.cos((i * TAU) / 14), h.y + h.r * Math.sin((i * TAU) / 14)], [h.x + h.r * Math.cos(((i + 1) * TAU) / 14), h.y + h.r * Math.sin(((i + 1) * TAU) / 14)]]);
    }
  } else {
    // voronoi: each pair of neighbouring sites shares one edge on their bisector
    const rng = subRng('etch', Math.round(c[0]), Math.round(c[1]), P.length);
    const count = clamp(Math.round(area(Pin) / (spacing * spacing * 1.5)), 3, 24);
    const sites = [];
    for (let tries = 0; sites.length < count && tries < count * 12; tries++) {
      const q = [c[0] + (rng() * 2 - 1) * reach, c[1] + (rng() * 2 - 1) * reach];
      if (insideBy(Pin, q[0], q[1]) > 0 && sites.every((o) => Math.hypot(o[0] - q[0], o[1] - q[1]) > spacing * 0.45)) sites.push(q);
    }
    for (let i = 0; i < sites.length; i++) {
      for (let j = i + 1; j < sites.length; j++) {
        const [si, sj] = [sites[i], sites[j]];
        const m = [(si[0] + sj[0]) / 2, (si[1] + sj[1]) / 2];
        const len = Math.hypot(sj[0] - si[0], sj[1] - si[1]);
        const d = [-(sj[1] - si[1]) / len, (sj[0] - si[0]) / len];
        // keep only the stretch that is nearer to these two sites than to any other
        const closer = sites.filter((_, k) => k !== i && k !== j).map((sk) => {
          const l = Math.hypot(sk[0] - si[0], sk[1] - si[1]);
          const nx = -(sk[0] - si[0]) / l;
          const ny = -(sk[1] - si[1]) / l;
          return { nx, ny, c: nx * ((si[0] + sk[0]) / 2) + ny * ((si[1] + sk[1]) / 2) };
        });
        const a = [m[0] - d[0] * reach * 2, m[1] - d[1] * reach * 2];
        const b = [m[0] + d[0] * reach * 2, m[1] + d[1] * reach * 2];
        const iv = insideInterval(a, b, [...bounds, ...closer], 0);
        if (iv) segs.push([[a[0] + (b[0] - a[0]) * iv[0], a[1] + (b[1] - a[1]) * iv[0]], [a[0] + (b[0] - a[0]) * iv[1], a[1] + (b[1] - a[1]) * iv[1]]]);
      }
    }
  }
  // remove the parts of each line that fall inside (or too near) a cutout
  const cutEdges = fret.cuts.map(edgesOf);
  for (const [a, b] of segs) {
    let keep = [[0, 1]];
    const remove = (iv) => {
      if (iv) keep = keep.flatMap(([u, v]) => [[u, Math.min(v, iv[0])], [Math.max(u, iv[1]), v]].filter(([x, y]) => y - x > 1e-6));
    };
    for (const edges of cutEdges) remove(insideInterval(a, b, edges, -ETCH_GAP));
    for (const h of fret.holes) {
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const fx = a[0] - h.x;
      const fy = a[1] - h.y;
      const A = dx * dx + dy * dy;
      const B = 2 * (fx * dx + fy * dy);
      const disc = B * B - 4 * A * (fx * fx + fy * fy - (h.r + ETCH_GAP) ** 2);
      if (disc > 0) remove([Math.max(0, (-B - Math.sqrt(disc)) / (2 * A)), Math.min(1, (-B + Math.sqrt(disc)) / (2 * A))]);
    }
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    for (const [u, v] of keep) {
      if ((v - u) * len > (PATTERNS[ETCH.pattern] && ETCH.pattern !== "voronoi" ? 6 : 25)) out.etchLines.push([[a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u], [a[0] + (b[0] - a[0]) * v, a[1] + (b[1] - a[1]) * v]]);
    }
  }
  return out;
}

// Fixing holes for bolting a panel to the structure behind: in the solid rim, at the corners
// (every other corner once there are more than four), clear of the edge and of every cutout.
function withFixings(P, fret, rim, r) {
  if (!r) return fret;
  const e = rim / 2;
  if (e < r + 9 || rim - e < r + 6) return fret;
  const edges = edgesOf(P);
  const holes = [];
  const stepBy = P.length > 4 ? 2 : 1;
  for (let i = 0; i < P.length; i += stepBy) {
    const a = edges[(i + P.length - 1) % P.length];
    const b = edges[i];
    // the point that is `e` inside both edges meeting at this corner
    const det = a.nx * b.ny - a.ny * b.nx;
    if (Math.abs(det) < 0.2) continue;
    const [ca, cb] = [a.c + e, b.c + e];
    const x = (ca * b.ny - cb * a.ny) / det;
    const y = (a.nx * cb - b.nx * ca) / det;
    if (insideBy(P, x, y) > e - 0.5) holes.push({ x, y, r, kind: 'fix' });
  }
  return holes.length >= 2 ? { cuts: fret.cuts, holes: [...fret.holes, ...holes] } : fret;
}

function panel(P, fret, extra) {
  return { points: P, holes: fret.holes, cuts: fret.cuts, ...etchDetail(P, fret, extra.rim), label: labelSpot(P, fret.cuts, fret.holes, extra.rim), ...extra };
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
  const flat = (poly, fret, z, layer, rim = Math.min(m.opts.rim, inradius(poly) * 0.42)) => ({ ...panel(poly, layer === 0 ? withFixings(poly, fret, rim, m.opts.fixR) : fret, { ...base, rim, layer }), frame: lift.frame(cP, m.z0 + z) });

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
    funnel: (x, y) => 1 - Math.sqrt(Math.min(1.6, Math.hypot(x, y) / R)), // steepens toward the centre, like a vortex
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
  const { rTop, rSide, silhouette } = ctx;
  const rMax = Math.max(rTop, rSide) * 1.05;
  const grid = p.layout === 'grid';
  const gridS = Math.min(Math.max(W / N, 420), S / 1.2);
  let cellsIn;
  let toXY;
  if (grid) {
    // a regular lattice: every module the same size and shape, like a wall of identical pods
    const s = gridS;
    const step = { hex: 0.75 * (2 / Math.sqrt(3)), diamond: 0.62, shard: 0.8, brick: 0.72 }[p.tiling] || 1;
    const iC = 2 * Math.ceil((cy - deckH) / (s * step) / 2 + 1);
    const first = { hex: 1 / Math.sqrt(3), diamond: 0.62, shard: 0.8, brick: 0.36 }[p.tiling] || 0;
    const uC = first + iC * step + (p.tiling === 'shard' ? 0.4 : 0);
    toXY = ([u, v]) => [v * s, -cy - (u - uC) * s];
    cellsIn = tilingCells(p.tiling, 2 * Math.ceil(W / s / 2 + 2), (iC + rTop / (s * step) + 2) * step).map((cell) => ({ ...cell, raw: cell.verts.map(toXY), band: 0, Nb: N, row: cell.i }));
  } else {
    // Radial: cells grow with radius, so the lattice is built in concentric bands. When a
    // cell would outgrow a sheet the next band starts with twice as many cells around,
    // which keeps every module a similar size instead of ballooning toward the edge.
    cellsIn = [];
    const limit = (S * 0.9) / (1.16 * Math.max(0.8, p.stretch));
    let r0 = rBase;
    let rows = 0;
    for (let b = 0, Nb = N; b < 6 && r0 < rMax; b++, Nb = 2 * Math.round(Nb * 0.75)) {
      const dvb = TAU / Nb;
      const rEnd = Math.max(r0 * 1.3, limit / dvb);
      const start = r0;
      const map = ([u, v]) => {
        const r = start * Math.exp(u * dvb * p.stretch);
        const a = Math.PI / 2 - v * dvb;
        return [r * Math.cos(a), -cy - r * Math.sin(a)];
      };
      let reach = r0;
      let last = 0;
      for (const cell of tilingCells(p.tiling, Nb, Math.log(Math.min(rEnd, rMax) / r0) / (dvb * p.stretch))) {
        const raw = cell.verts.map(map);
        const far = Math.max(...raw.map(([x, y]) => Math.hypot(x, y + cy)));
        if (far > rEnd * 1.02) continue;
        reach = Math.max(reach, far);
        last = Math.max(last, cell.i);
        cellsIn.push({ ...cell, raw, band: b, Nb, row: rows + cell.i });
      }
      rows += last + 1;
      r0 = Math.max(reach, r0 * 1.05) + p.joint * 1.5;
    }
  }
  const rHole = p.centre === 'none' ? 0 : ctx.rInner + 60 + (p.petals ? Math.min(p.petalLength * M, L) * 0.3 : 0);
  const shift = p.seed % MIX.length;
  const parts = [];
  const rIn = grid ? rHole : rBase;
  const rOut = Math.min(rTop, rSide) * 0.95;

  // pass 1: which cells survive the silhouette, the erosion and the clipping
  const kept = [];
  for (const cell of cellsIn) {
    if (p.mirror && cell.cv < -1e-9) continue; // the left half is a mirror image of the right
    const axis = p.mirror && (Math.abs(cell.cv) < 1e-9 || (!grid && Math.abs(cell.cv - cell.Nb / 2) < 1e-9));
    const raw = cell.raw;
    const c = centroid(raw);
    const rc = Math.hypot(c[0], c[1] + cy);
    const ring = grid ? Math.round(rc / gridS / 0.9) : cell.row;
    const rng = subRng(p.seed, 'cell', cell.band, cell.i, Math.round(cell.cv * 2), cell.k);
    const lim = silhouette(Math.atan2(c[0], -(c[1] + cy)));
    const edge = rc / lim;
    const erodeRoll = rng();
    if (edge > 1) continue;
    if (grid && rHole && [c, ...raw].some(([x, y]) => Math.hypot(x, y + cy) < rHole)) continue;
    if (edge > 0.7 && erodeRoll < (p.erode * (edge - 0.7)) / 0.3) continue;
    // medallions punch clean holes through the lattice
    if (holes.some((h) => [c, ...raw].some(([x, y]) => Math.hypot(Math.abs(x) - h.x, y - h.y) < h.r))) continue;

    let poly = clipHalf(raw, 0, 1, -(deckH + 30));
    if (raw.some(([x]) => Math.abs(x) > W / 2)) continue; // a module cut by the stage edge is just a fragment
    if (poly.length < 3 || area(poly) < 0.6 * area(raw) || area(poly) < 6e4) continue;
    const keys = cell.verts.map(([u, v]) => `${cell.band}:${Math.round(u * 50)},${Math.round(v * 50)}`);
    // cells on the centreline, against the core or standing on the deck are anchored
    const anchored = (p.mirror && raw.some(([x]) => Math.abs(x) < (grid ? gridS : 1) * 0.6 + 1)) || (!grid && cell.i === 0) || poly.length !== raw.length || raw.some(([, y]) => y > -(deckH + 30) - 1);
    kept.push({ cell, axis, raw, c, rc, ring, rng, edge, poly, keys, anchored, alive: true });
  }
  // drop loners and stray islands: a module hanging off the edge by one side, or a
  // clump cut off from the rest, reads as a mistake
  const need = p.tiling === 'shard' || p.tiling === 'brick' ? 1 : 2;
  const byPoint = new Map();
  kept.forEach((k, id) => {
    if (p.tiling === 'brick') k.cell.verts.forEach(([u, v], i) => {
      const [u2, v2] = k.cell.verts[(i + 1) % k.cell.verts.length];
      k.keys.push(`${k.cell.band}:${Math.round((u + u2) * 25)},${Math.round((v + v2) * 25)}`);
    });
    for (const key of k.keys) byPoint.set(key, [...(byPoint.get(key) || []), id]);
  });
  kept.forEach((k, id) => {
    const seen = new Map();
    for (const key of k.keys) for (const other of byPoint.get(key)) if (other !== id) seen.set(other, (seen.get(other) || 0) + 1);
    k.next = [...seen].filter(([, n]) => n >= 2).map(([other]) => other);
  });
  for (let pass = 0; pass < 3; pass++) {
    for (const k of kept) if (k.alive && k.next.filter((o) => kept[o].alive).length + (k.anchored ? 1 : 0) < need) k.alive = false;
  }
  const group = new Array(kept.length).fill(-1);
  const sizes = [];
  kept.forEach((k, id) => {
    if (!k.alive || group[id] >= 0) return;
    const g = sizes.length;
    const stack = [id];
    group[id] = g;
    let n = 0;
    while (stack.length) {
      const cur = stack.pop();
      n++;
      for (const o of kept[cur].next) if (kept[o].alive && group[o] < 0) { group[o] = g; stack.push(o); }
    }
    sizes.push(n);
  });
  const least = Math.max(5, Math.max(...sizes) * 0.2);
  kept.forEach((k, id) => { if (group[id] >= 0 && sizes[group[id]] < least) k.alive = false; });

  for (const { cell, axis, c, rc, ring, rng, edge, poly, alive } of kept) {
    if (!alive) continue;
    const t = clamp(1 - (rc - rBase) / (rMax * 0.8 - rBase), 0, 1);
    const pieces = refine(poly, 0, {
      L, S, rng, axis, parity: (ring + cell.k) % 2, minInr: Math.max(web * 1.6, 90),
      want: p.subdivide * (0.3 + 0.7 * edge),
    });
    // one module, one motif: the pieces of a split cell stay a matching set
    const rollMotif = rng();
    const rollPick = rng();
    let motif = p.motif;
    if (motif === 'mixed') motif = rollMotif < p.chaos * 0.5 ? MIX[Math.floor(rollPick * MIX.length)] : MIX[(ring + shift) % MIX.length];
    // bands: concentric zones that step in depth and alternate module, so a big field has form
    const band = grid ? Math.min(p.zones - 1, Math.floor((p.zones * Math.max(0, rc - rIn)) / Math.max(1, rOut - rIn))) : cell.band + Math.min(p.zones - 1, Math.floor((p.zones * Math.max(0, rc - rIn)) / Math.max(1, rOut - rIn)));
    let module = p.module === 'mix' ? (ring % 2 ? 'stepped' : 'pyramid') : p.module;
    if (band % 2) module = { stepped: 'pyramid', pyramid: 'stepped', flat: 'stepped' }[module] || module;
    const zBand = band * p.bandStep;
    for (const piece of pieces) {
      const P = insetConvex(piece, p.joint / 2);
      const overlayRoll = rng();
      if (!P || inradius(P) < web * 0.9) continue;
      const pc = centroid(P);
      parts.push(
        ...modulePanels(P, {
          module, motif, depth: p.depth, steps: p.steps, overlay: p.overlay, overlayRoll, z0: ctx.zOf('facade') + zBand, t, el: 'facade',
          lift: ctx.lift, origin: [0, -cy], parity: ring % 2,
          opts: { ...ctx.fret, ang: Math.atan2(pc[1] + cy, pc[0]), parity: ring % 2, reserve: 0 },
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
// Freeform: straight runs through the five dragged widths, lifted to their upper hull so the petal stays convex.
function freeProfile(nodes) {
  const pts = [[0, 0], ...nodes.map((w, i) => [(i + 1) / 6, w]), [1, 0]];
  const hull = [];
  for (const q of pts) {
    while (hull.length >= 2) {
      const [a, b] = [hull[hull.length - 2], hull[hull.length - 1]];
      if ((b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0]) >= 0) hull.pop();
      else break;
    }
    hull.push(q);
  }
  return (t) => {
    const i = Math.max(1, hull.findIndex((q) => q[0] >= t - 1e-9));
    const [a, b] = [hull[i - 1], hull[i]];
    return a[1] + ((b[1] - a[1]) * (t - a[0])) / (b[0] - a[0]);
  };
}
function petalShape(len, width, asym, kind = 'leaf', nodes = null) {
  const n = 12;
  const f = kind === 'freeform' && nodes ? freeProfile(nodes) : PROFILES[kind] || PROFILES.leaf;
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

// A curled petal: the same profiles as a straight one, swept along a bending spine.
function curledPetal(p, ctx, base, phi, len, width) {
  const profile = p.petalShape === 'freeform' ? freeProfile(p.petalNodes) : RIBBON_PROFILES[p.petalShape] || RIBBON_PROFILES.leaf;
  const out = [];
  const K = p.petalLayers;
  for (let k = 0; k < K; k++) {
    const f = 1 - 0.2 * k;
    const spine = makeSpine({ start: base, heading: phi, length: len * f, turn: (u) => p.petalCurl * 1.9 * (u * f) ** 1.3, step: 30 });
    const top = k === K - 1 && K > 1;
    const motif = p.motif === 'solid' ? 'solid' : top ? 'eyes' : k ? 'lanes' : p.ribbonMotif;
    const pieces = ribbonParts(spine, widthOf((u) => profile(clamp(u * f, 0, 1)), width * (1 - 0.3 * k), p.petalAsym), ribbonOpts(p, ctx, motif));
    for (const { u, ...pc } of pieces) out.push({ ...pc, t: clamp(0.35 + k * 0.25, 0, 1), el: 'petal', layer: k, organic: true, z: k });
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
    if (p.petalCurl && !axis) {
      const made = curledPetal(p, ctx, base, phi, len, width).map(({ z, ...rest }) => ({ ...rest, frame: ctx.lift.frame(centroid(rest.points), ctx.zOf('petal') + z * step) }));
      parts.push(...made);
      if (p.mirror) parts.push(...made.map(mirrorPart));
      continue;
    }
    const raw = petalShape(len, width, axis ? 0 : p.petalAsym, p.petalShape, p.petalNodes).map(([x, y]) => [base[0] + x * c - y * s, base[1] + x * s + y * c]);
    const P = clipHalf(raw, 0, 1, -(deckH + 30));
    if (P.length < 3 || area(P) < 0.6 * area(raw)) continue;
    for (const layer of petalLayers(P, p, ctx, 0.35)) {
      const { z, ...rest } = layer;
      const part = { ...rest, frame: ctx.lift.frame(centroid(P), ctx.zOf('petal') + z * step) };
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
    etchLines: [],
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
function coreCells(type, n, R, seed) {
  const P = (r, a) => [r * Math.sin(a), -r * Math.cos(a)]; // a clockwise from straight up
  const h = Math.PI / n;
  const cells = [];
  const ngon = (r, k, cx = 0, cy = 0, rot = 0) => Array.from({ length: k }, (_, i) => [cx + r * Math.sin(rot + (i * TAU) / k), cy - r * Math.cos(rot + (i * TAU) / k)]);
  if (type === 'mandala') {
    // dihedral: one half-wedge is designed at random, mirrored, then repeated n times
    const rng = subRng(seed, 'mandala');
    cells.push({ ring: 3, poly: ngon(0.16 * R, n, 0, 0, h) });
    let r = 0.2 * R;
    for (let band = 0; band < 3; band++) {
      const last = band === 2;
      const r2 = last ? R : r + (R - r) * (0.3 + 0.25 * rng());
      const cut = h * (0.35 + 0.3 * rng());
      const roll = rng();
      const pointed = rng() < 0.6;
      const spans = roll < 0.55 ? [[-cut, cut], [cut, 2 * h - cut]] : roll < 0.8 ? [[-h, h]] : [[0, 2 * h]];
      for (let i = 0; i < n; i++) {
        for (const [a0, a1] of spans) {
          const b = 2 * h * i;
          const shoulder = pointed ? r2 * 0.93 : r2;
          cells.push({ ring: 2 - band, poly: [P(r + 0.03 * R, b + a0), P(shoulder, b + a0), ...(pointed ? [P(r2, b + (a0 + a1) / 2)] : []), P(shoulder, b + a1), P(r + 0.03 * R, b + a1)] });
        }
      }
      r = r2;
    }
  } else if (type === 'iris') {
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
  for (const cell of coreCells(type, p.corePoints, D / 2, p.seed + seedShift)) {
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
  const parts = [];
  for (let i = 0; i < n; i++) {
    const th = ((i + 0.5) * TAU) / n;
    if (p.mirror && th > Math.PI) continue;
    const r0 = p.spikeCrown ? ctx.silhouette(th) * 0.94 : p.spikeStart * M;
    const dir = [Math.sin(th), -Math.cos(th)];
    const nrm = [dir[1], -dir[0]];
    const at = (d, k) => [dir[0] * (r0 + d) + nrm[0] * k, -cy + dir[1] * (r0 + d) + nrm[1] * k];
    if (p.spikeCurl) {
      const spine = makeSpine({ start: at(0, 0), heading: Math.atan2(dir[1], dir[0]), length: len, turn: (u) => p.spikeCurl * 1.7 * u ** 1.3 + 0.35 * p.spikeCurl * Math.sin(u * TAU) });
      const made = placeRibbon(ribbonParts(spine, widthOf(RIBBON_PROFILES.flame, w, 0.25), ribbonOpts(p, ctx)), ctx, { z: ctx.zOf('spike'), el: 'spike', t: 0.9 });
      parts.push(...made);
      if (p.mirror) parts.push(...made.map(mirrorPart));
      continue;
    }
    const raw = [at(0, 0), at(len * 0.3, w / 2), at(len, 0), at(len * 0.3, -w / 2)];
    const P = clipHalf(raw, 0, 1, -(deckH + 30));
    if (P.length < 3 || area(P) < 0.6 * area(raw)) continue;
    const made = modulePanels(P, {
      module: own(p, 'spike', 'Module') === 'scales' ? 'flat' : own(p, 'spike', 'Module'), motif: own(p, 'spike', 'Motif') === 'mixed' ? 'louvre' : own(p, 'spike', 'Motif'), depth: p.depth * 0.6, steps: 1, overlay: 0, overlayRoll: 1,
      z0: ctx.zOf('spike'), t: 0.9, el: 'spike', lift: ctx.lift, origin: [0, -cy], opts: { ...ctx.fret, ang: Math.atan2(dir[1], dir[0]), parity: 1, reserve: 0 },
    });
    parts.push(...made);
    if (p.mirror) parts.push(...made.map(mirrorPart));
  }
  return parts;
}

// ------------------------------------------------------------------ tendrils

// Organic elements are ribbons (see ribbon.js): one curved outline per sheet-sized piece.
const ribbonOpts = (p, ctx, motif) => ({
  L: ctx.L, S: ctx.S, web: ctx.web, rim: p.rim, minSlot: ctx.fret.minSlot, minHoleR: ctx.fret.minHoleR,
  motif: motif || (p.motif === 'solid' ? 'solid' : p.ribbonMotif), detail: p.detail, etch: p.etch, clipY: -(ctx.deckH + 30), fixR: ctx.fret.fixR,
});
// Turn ribbon pieces into placed stage parts.
function placeRibbon(pieces, ctx, { z, el, t, layer = 0, raised = false }) {
  return pieces.map((pc) => {
    const { u, ...rest } = pc;
    return { ...rest, t: clamp(typeof t === 'function' ? t(u) : t, 0, 1), el, layer, raised, organic: true, frame: ctx.lift.frame(centroid(pc.points), z) };
  });
}
const widthOf = (profile, w, asym = 0) => (u) => {
  const k = (w / 2) * profile(u);
  return [k * (1 + asym), k * (1 - asym)];
};

// Flowing horns, flames, feathers and vines, each a curved ribbon cut in sheet-sized lengths.
function buildTendrils(p, ctx) {
  const n = p.tendrils;
  if (!n) return [];
  const { cy } = ctx;
  const total = p.tendrilLength * M;
  const w0 = Math.min(p.tendrilWidth * M, ctx.S * 0.9);
  const z0 = ctx.zOf('tendril');
  const style = p.tendrilStyle;
  const parts = [];
  const add = (made) => {
    parts.push(...made);
    if (p.mirror) parts.push(...made.map(mirrorPart));
  };
  for (const side of p.mirror ? [1] : [1, -1]) {
    for (let i = 0; i < n; i++) {
      const th = ((p.tendrilFrom + (n > 1 ? (i * p.tendrilSweep) / (n - 1) : p.tendrilSweep / 2)) * Math.PI) / 180;
      const start = [side * ctx.rBase * 0.9 * Math.sin(th), -cy - ctx.rBase * 0.9 * Math.cos(th)];
      const heading = Math.atan2(-Math.cos(th), side * Math.sin(th));
      const bend = -side * p.tendrilCurl * TAU * 0.7 * (1 - 0.1 * i);
      const wave = style === 'flame' ? -side * 0.45 : 0;
      const turn = (u) => bend * u ** 1.4 + wave * Math.sin(u * TAU * 1.25);
      const length = total * (1 - 0.07 * i);
      const spine = makeSpine({ start, heading, length, turn });
      const t = (u) => 1 - u;
      if (style === 'vine') {
        const stem = Math.max(160, w0 * 0.3);
        add(placeRibbon(ribbonParts(spine, widthOf((u) => 0.45 + 0.55 * (1 - u), stem), ribbonOpts(p, ctx, 'solid')), ctx, { z: z0, el: 'tendril', t }));
        const gap = clamp(stem * 2.6, 380, 900) / Math.max(0.25, p.tendrilLeaves);
        let k = 0;
        for (let s = gap * 0.6; s < length * 0.97; s += gap, k++) {
          const q = spine[Math.min(spine.length - 1, Math.round(s / (spine[1].s - spine[0].s)))];
          const sgn = k % 2 ? 1 : -1;
          const len = clamp(w0 * 1.9 * (1 - 0.55 * q.u), 360, Math.min(1500, ctx.L));
          const leaf = makeSpine({ start: [q.x - Math.sin(q.h) * sgn * stem * 0.2, q.y + Math.cos(q.h) * sgn * stem * 0.2], heading: q.h + sgn * 0.95, length: len, turn: (u) => -sgn * 0.7 * u });
          add(placeRibbon(ribbonParts(leaf, widthOf(RIBBON_PROFILES.leaf, len * 0.44), ribbonOpts(p, ctx)), ctx, { z: z0 + 45, el: 'tendril', t: clamp(1.1 - q.u, 0, 1), layer: 1 }));
        }
        continue;
      }
      const profile = RIBBON_PROFILES[style] || RIBBON_PROFILES.horn;
      const asym = style === 'flame' ? 0.3 * side : 0;
      add(placeRibbon(ribbonParts(spine, widthOf(profile, w0, asym), ribbonOpts(p, ctx)), ctx, { z: z0, el: 'tendril', t }));
      // a narrower ribbon stood off the first gives the horn a raised spine
      if (p.overlay > 0.3 && w0 >= 420) {
        const over = makeSpine({ start, heading, length: length * 0.82, turn: (u) => turn(u * 0.82) });
        add(placeRibbon(ribbonParts(over, widthOf((u) => profile(u * 0.82), w0 * 0.42, asym), ribbonOpts(p, ctx, 'eyes')), ctx, { z: z0 + Math.max(60, Math.abs(p.depth) * 0.35), el: 'tendril', t: (u) => 1.15 - u, layer: 1, raised: true }));
      }
    }
  }
  return parts;
}

// ------------------------------------------------------------------ stage

function partArea(part) {
  return area(part.points) - part.holes.reduce((s, h) => s + Math.PI * h.r * h.r, 0) - (part.cuts || []).reduce((s, c) => s + area(c), 0);
}

const SOLID_CORES = ['disc', 'iris', 'star', 'rosette', 'mandala'];

function context(p, fab) {
  const L = Math.max(fab.sheetW, fab.sheetH) - 2 * EDGE;
  const S = Math.min(fab.sheetW, fab.sheetH) - 2 * EDGE;
  const D = p.discDiameter * M;
  const deckH = p.deckHeight * M;
  const web = Math.max(30, fab.tool * 3, fab.thickness * 2.5);
  const fret = { web, rim: p.rim, detail: p.detail, minSlot: Math.max(22, fab.tool * 2.5), minHoleR: Math.max(14, fab.tool), fixR: fab.fixing / 2 };
  const hasCore = SOLID_CORES.includes(p.centre);
  // where the surrounding elements start: core edge (or the void), plus the gap
  const rInner = p.centre === 'none' ? 260 : D / 2 + (hasCore ? 60 : 0) + p.coreGap;
  const petalLen = p.petals ? Math.min(p.petalLength * M, L) : 0;
  const ctx = {
    L, S, D, deckH, web, fret, rInner, hasCore,
    W: p.width * M,
    cy: deckH + p.lift * M + D / 2,
    rBase: rInner + 100 + p.joint + petalLen * 0.55,
    latticeOn: p.tiling !== 'none' && !p.hidden.includes('facade'),
    zOf: (el) => p.layerOrder.indexOf(el) * p.layerGap,
    show: (el) => !p.hidden.includes(el),
  };
  // the crown silhouette: how far the facade reaches in each direction from the centre
  const rTop = Math.max(deckH + p.crownHeight * M - ctx.cy, ctx.rBase + 900);
  const rSide = ctx.W / 2;
  const e = p.squareness;
  ctx.rTop = rTop;
  ctx.rSide = rSide;
  ctx.silhouette = (th) => {
    const base = (Math.abs(Math.cos(th) / rTop) ** e + Math.abs(Math.sin(th) / rSide) ** e) ** (-1 / e);
    if (!p.crownPoints) return base;
    const phase = (th / Math.PI) * p.crownPoints;
    const peak = Math.abs((((phase % 1) + 1) % 1) - 0.5) * 2; // 1 at each crown point
    return base * (1 - p.crownDepth * (1 - peak));
  };
  ctx.lift = makeLift(p, ctx);
  return ctx;
}

// The origin pieces every instance is spawned from, laid flat for the editor preview.
export function sourcePanels(input, fabInput = {}, only = null) {
  const p = normalizeStage(input);
  const ctx = context(p, normalizeStageFab(fabInput));
  ETCH = { n: p.etch, pattern: p.etchPattern };
  const want = (k) => !only || only === k;
  const out = { cell: [], petal: [], spike: [], core: [], tendril: [] };
  const flatCtx = { ...ctx, lift: FLAT_LIFT, deckH: -1e7 };
  const opts = { ...ctx.fret, ang: Math.PI / 2, parity: 0, reserve: 0 };
  if (want('cell')) {
    const HEX = [0, 1, 2, 3, 4, 5].map((i) => [520 * Math.sin((i * Math.PI) / 3), -520 * Math.cos((i * Math.PI) / 3)]);
    const shape = { hex: HEX, diamond: [[0, -640], [420, 0], [0, 640], [-420, 0]], shard: [[0, -560], [500, 320], [-500, 320]], brick: [[-560, -360], [560, -360], [560, 360], [-560, 360]] }[p.tiling] || HEX;
    out.cell = modulePanels(shape, {
      module: p.module === 'mix' ? 'pyramid' : p.module, motif: p.motif === 'mixed' ? MIX[p.seed % MIX.length] : p.motif, depth: p.depth, steps: p.steps,
      overlay: p.overlay, overlayRoll: 0.5, z0: 0, t: 0.5, el: 'facade', origin: [0, 2000], opts,
    });
  }
  if (want('petal')) {
    const len = Math.min(p.petalLength * M, ctx.L);
    const up = petalShape(len, Math.min(p.petalWidth * M, ctx.S), p.petalAsym, p.petalShape, p.petalNodes).map(([x, y]) => [y, len / 2 - x]);
    const step = Math.max(40, Math.abs(p.depth) * 0.35);
    out.petal = p.petalCurl
      ? curledPetal(p, flatCtx, [0, len / 2], -Math.PI / 2, len, Math.min(p.petalWidth * M, ctx.S)).map(({ z, ...rest }) => ({ ...rest, frame: flatFrame(z * step) }))
      : petalLayers(up, p, ctx, 0.35).map(({ z, ...rest }) => ({ ...rest, frame: flatFrame(z * step) }));
  }
  if (want('tendril')) {
    // one tendril on its own, rising from the bottom of the preview
    const one = { ...p, tendrils: 1, tendrilFrom: 0, tendrilSweep: 0, mirror: false, tendrilLength: Math.min(p.tendrilLength, 6) };
    out.tendril = buildTendrils(one, { ...flatCtx, cy: 0, rBase: 0, zOf: () => 0 });
  }
  if (want('spike')) {
    const len = Math.min(p.spikeLength * M, ctx.L);
    const w = Math.min(p.spikeWidth * M, ctx.S);
    const module = own(p, 'spike', 'Module');
    const motif = own(p, 'spike', 'Motif');
    if (p.spikeCurl) {
      const spine = makeSpine({ start: [0, len / 2], heading: -Math.PI / 2, length: len, turn: (u) => p.spikeCurl * 1.7 * u ** 1.3 + 0.35 * p.spikeCurl * Math.sin(u * TAU) });
      out.spike = placeRibbon(ribbonParts(spine, widthOf(RIBBON_PROFILES.flame, w, 0.25), ribbonOpts(p, flatCtx)), flatCtx, { z: 0, el: 'spike', t: 0.9 });
    } else out.spike = modulePanels([[0, len / 2], [w / 2, len * 0.2], [0, -len / 2], [-w / 2, len * 0.2]], {
      module: module === 'scales' ? 'flat' : module, motif: motif === 'mixed' ? 'louvre' : motif, depth: p.depth * 0.6, steps: 1,
      overlay: 0, overlayRoll: 1, z0: 0, t: 0.9, el: 'spike', opts: { ...opts, parity: 1 },
    });
  }
  if (want('core') && ctx.hasCore) out.core = buildCore(p.centre, p, { ...ctx, lift: FLAT_LIFT }, 1800, 0, 0, 0, DEFAULTS, 0).parts;
  return out;
}

export function generateStage(input, discParams = DEFAULTS, fabInput = {}) {
  const p = normalizeStage(input);
  ETCH = { n: p.etch, pattern: p.etchPattern };
  const fab = normalizeStageFab(fabInput);
  const ctx = context(p, fab);
  const { L, S, W, deckH, D, cy, web } = ctx;
  const notes = [];
  const traces = [];

  const centreParts = [];
  const liftZ = (x) => ctx.lift.z(x, -cy);
  if (ctx.hasCore && ctx.show('core')) {
    const core = buildCore(p.centre, p, ctx, D, 0, cy, ctx.zOf('core') + p.discZ + liftZ(0), discParams, 0);
    centreParts.push(...core.parts);
    traces.push(...core.traces);
  }

  // side medallions: a smaller core, mirrored either side
  const holes = [];
  const sideD = p.sideDisc * M;
  if (sideD >= 800 && ctx.show('core')) {
    const sx = Math.min(p.sideOffset * M, W / 2 - sideD / 2 - 100);
    if (sx - sideD / 2 < ctx.rBase) notes.push('Side medallions overlap the centre: raise Medallion Offset or widen the stage.');
    else {
      const side = buildCore(ctx.hasCore ? p.centre : 'disc', p, ctx, sideD, sx, cy, ctx.zOf('core') + p.discZ * 0.5 + liftZ(sx), discParams, 17);
      centreParts.push(...side.parts, ...side.parts.map(mirrorPart));
      for (const tr of side.traces) traces.push(tr, { ...tr, flip: true });
      holes.push({ x: sx, y: -cy, r: sideD / 2 + 40 + p.joint });
    }
  }

  const latticeOn = ctx.latticeOn;
  const facade = latticeOn ? buildFacade(p, ctx, holes) : [];
  if (latticeOn && !facade.length) notes.push('No room for the panel lattice: widen the stage, raise the crown or shrink the centre.');
  const petals = ctx.show('petal') ? buildPetals(p, ctx) : [];
  const spikes = ctx.show('spike') ? buildSpikes(p, ctx) : [];
  const tendrils = ctx.show('tendril') ? buildTendrils(p, ctx) : [];

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
  const parts = [...spikes, ...tendrils, ...facade, ...petals, ...centreParts, ...booth].map((pt, i) => ({ ...pt, id: String(i + 1), spots: [], print: printable(pt) }));
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
      cutouts: parts.reduce((s, pt) => s + pt.holes.filter((h) => h.kind !== 'fix').length + pt.cuts.length, 0),
      fixings: parts.reduce((s, pt) => s + pt.holes.filter((h) => h.kind === 'fix').length, 0),
    },
  };
}
