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
export const MOTIFS = { mixed: 'Mixed', slots: 'Nested slots', fan: 'Fan', louvre: 'Louvre', perf: 'Perforated', solid: 'Solid' };
export const STAGE_MATERIALS = ['birch', 'mdf', 'hdpe', 'aluminium'];

export const STAGE_GROUPS = [
  { id: 'stage', label: 'Stage' },
  { id: 'centre', label: 'Centrepiece' },
  { id: 'facade', label: 'Panel Lattice' },
  { id: 'fret', label: 'Fretwork' },
  { id: 'booth', label: 'DJ Booth' },
];

export const STAGE_PARAMS = [
  { key: 'seed', label: 'Seed', group: 'stage', min: 0, max: 999, step: 1, def: 7, rand: [0, 999] },
  { key: 'width', label: 'Stage Width (m)', group: 'stage', min: 4, max: 30, step: 0.5, def: 16, rand: [11, 22] },
  { key: 'deckHeight', label: 'Deck Height (m)', group: 'stage', min: 0.4, max: 2.4, step: 0.1, def: 1.2, rand: null },
  { key: 'deckDepth', label: 'Deck Depth (m)', group: 'stage', min: 2, max: 12, step: 1, def: 6, rand: null },
  { key: 'chaos', label: 'Randomness', group: 'stage', min: 0, max: 1, step: 0.01, def: 0.35, rand: [0, 0.8] },

  { key: 'discDiameter', label: 'Disc Ø (m)', group: 'centre', min: 1, max: 8, step: 0.1, def: 3.6, rand: [2.5, 5] },
  { key: 'lift', label: 'Lift Above Deck (m)', group: 'centre', min: 0, max: 4, step: 0.1, def: 1.4, rand: [0.9, 2] },

  { key: 'cells', label: 'Cells Around', group: 'facade', min: 10, max: 48, step: 2, def: 24, rand: [16, 36] },
  { key: 'stretch', label: 'Radial Stretch', group: 'facade', min: 0.6, max: 1.8, step: 0.05, def: 1, rand: [0.8, 1.4] },
  { key: 'crownHeight', label: 'Crown Height (m)', group: 'facade', min: 2, max: 12, step: 0.1, def: 7.5, rand: [6, 9.5] },
  { key: 'crownPoints', label: 'Crown Points', group: 'facade', min: 0, max: 9, step: 1, def: 5, rand: [0, 7] },
  { key: 'crownDepth', label: 'Crown Depth', group: 'facade', min: 0, max: 0.6, step: 0.01, def: 0.3, rand: [0.1, 0.5] },
  { key: 'squareness', label: 'Squareness', group: 'facade', min: 1.2, max: 5, step: 0.1, def: 2.4, rand: [1.6, 3.6] },
  { key: 'joint', label: 'Shadow Gap (mm)', group: 'facade', min: 20, max: 150, step: 5, def: 50, rand: [30, 80] },
  { key: 'subdivide', label: 'Subdivision', group: 'facade', min: 0, max: 1, step: 0.01, def: 0.4, rand: [0.1, 0.8] },
  { key: 'erode', label: 'Edge Erosion', group: 'facade', min: 0, max: 1, step: 0.01, def: 0.25, rand: [0, 0.6] },

  { key: 'detail', label: 'Detail', group: 'fret', min: 0, max: 1, step: 0.01, def: 0.6, rand: [0.3, 1] },
  { key: 'rim', label: 'Rim Width (mm)', group: 'fret', min: 30, max: 200, step: 5, def: 60, rand: [45, 100] },
  { key: 'overlay', label: 'Raised Layer', group: 'fret', min: 0, max: 1, step: 0.01, def: 0.45, rand: [0, 0.8] },

  { key: 'boothWidth', label: 'Booth Width (m)', group: 'booth', min: 0, max: 6, step: 0.1, def: 3, rand: [2, 4] },
  { key: 'boothHeight', label: 'Booth Height (m)', group: 'booth', min: 0.8, max: 1.1, step: 0.05, def: 1.1, rand: null },
];
export const STAGE_PARAM_MAP = Object.fromEntries(STAGE_PARAMS.map((p) => [p.key, p]));

export const STAGE_DEFAULTS = {
  ...Object.fromEntries(STAGE_PARAMS.map((p) => [p.key, p.def])),
  tiling: 'hex',
  motif: 'mixed',
  mirror: true,
  truss: true,
};

export function normalizeStage(input = {}) {
  const out = {};
  for (const def of STAGE_PARAMS) out[def.key] = quantize(def, input[def.key] ?? def.def);
  out.tiling = TILINGS[input.tiling] ? input.tiling : STAGE_DEFAULTS.tiling;
  out.motif = MOTIFS[input.motif] ? input.motif : STAGE_DEFAULTS.motif;
  out.mirror = typeof input.mirror === 'boolean' ? input.mirror : true;
  out.truss = typeof input.truss === 'boolean' ? input.truss : true;
  return out;
}

const FAB_LIMITS = { sheetW: [600, 4000], sheetH: [300, 2500], thickness: [3, 30], tool: [1, 20] };
export const STAGE_FAB_DEFAULTS = { sheetW: 2440, sheetH: 1220, thickness: 12, tool: 6, material: 'birch', labels: true, led: true };

export function normalizeStageFab(input = {}) {
  const out = { ...STAGE_FAB_DEFAULTS };
  for (const [key, [lo, hi]] of Object.entries(FAB_LIMITS)) {
    const n = Number(input[key]);
    if (input[key] !== undefined && input[key] !== '' && Number.isFinite(n)) out[key] = Math.min(hi, Math.max(lo, n));
  }
  if (STAGE_MATERIALS.includes(input.material)) out.material = input.material;
  for (const key of ['labels', 'led']) if (typeof input[key] === 'boolean') out[key] = input[key];
  return out;
}

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
  if (motif === 'solid' || depthMax - rim < o.minSlot) return out;
  const edges = edgesOf(P);
  const keep = (poly) => {
    if (poly.length >= 3 && area(poly) > o.minSlot * o.minSlot * 1.5 && inradius(poly) > o.minSlot * 0.45) out.cuts.push(poly);
  };
  if (o.reserve && (motif === 'louvre' || motif === 'perf')) motif = 'slots';

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

function panel(P, fret, extra) {
  return { points: P, holes: fret.holes, cuts: fret.cuts, label: labelSpot(P, fret.cuts, fret.holes, extra.rim), ...extra };
}

// ------------------------------------------------------------------ facade

function buildFacade(p, ctx) {
  const { W, deckH, D, cy, L, S, web } = ctx;
  const N = p.cells;
  const dv = TAU / N;
  const rBase = D / 2 + 150 + p.joint;
  const rTop = Math.max(deckH + p.crownHeight * M - cy, D / 2 + 900);
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
  const order = ['slots', 'fan', 'louvre', 'perf'];
  const shift = p.seed % order.length;
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
      const rollOver = rng();
      if (!P || inradius(P) < web * 0.9) continue;
      const pc = centroid(P);
      const inr = inradius(P);
      let motif = p.motif;
      if (motif === 'mixed') motif = rollMotif < p.chaos * 0.5 ? order[Math.floor(rollPick * order.length)] : order[(cell.i + shift) % order.length];
      const opts = {
        web, rim: p.rim, detail: p.detail, minSlot: ctx.minSlot, minHoleR: ctx.minHoleR,
        ang: Math.atan2(pc[1] + cy, pc[0]), parity: cell.i % 2, reserve: 0,
      };
      const common = { t, el: 'facade', rim: Math.min(p.rim, inr * 0.42), minWidth: Math.min(web, inr * 2) };
      // raised layer: a smaller panel stood off the centre of this one
      const island = rollOver < p.overlay && inr > web * 5 ? insetConvex(P, inr * 0.5) : null;
      if (island) {
        parts.push(panel(P, fretwork(P, motif === 'solid' ? 'solid' : 'slots', { ...opts, reserve: inr * 0.5 }), { ...common, z: 0 }));
        parts.push(panel(island, fretwork(island, motif === 'solid' ? 'solid' : 'fan', { ...opts, rim: web, detail: p.detail * 0.5 }), { ...common, rim: web, z: 1, t: clamp(t + 0.3, 0, 1) }));
      } else {
        parts.push(panel(P, fretwork(P, motif, opts), { ...common, z: 0 }));
      }
    }
  }
  if (!p.mirror) return parts;
  const flip = (pts) => pts.map(([x, y]) => [-x, y]).reverse();
  const mirrored = parts
    .filter((pt) => Math.abs(centroid(pt.points)[0]) > 1)
    .map((pt) => ({
      ...pt,
      points: flip(pt.points),
      cuts: pt.cuts.map(flip),
      holes: pt.holes.map((h) => ({ ...h, x: -h.x })),
      label: [-pt.label[0], pt.label[1]],
    }));
  return [...mirrored, ...parts];
}

// ------------------------------------------------------------------ stage

function partArea(part) {
  return area(part.points) - part.holes.reduce((s, h) => s + Math.PI * h.r * h.r, 0) - (part.cuts || []).reduce((s, c) => s + area(c), 0);
}

export function generateStage(input, discParams = DEFAULTS, fabInput = {}) {
  const p = normalizeStage(input);
  const fab = normalizeStageFab(fabInput);
  const L = Math.max(fab.sheetW, fab.sheetH) - 2 * EDGE;
  const S = Math.min(fab.sheetW, fab.sheetH) - 2 * EDGE;
  const W = p.width * M;
  const deckH = p.deckHeight * M;
  const D = p.discDiameter * M;
  const cy = deckH + p.lift * M + D / 2;
  const web = Math.max(30, fab.tool * 3, fab.thickness * 2.5);
  const ctx = { W, deckH, D, cy, L, S, web, minSlot: Math.max(22, fab.tool * 2.5), minHoleR: Math.max(14, fab.tool) };
  const notes = [];

  // centrepiece: the current disc design, re-sliced so each part fits a sheet
  const k = D / DISC_REF;
  const ref = generate(scaleParams({ ...DEFAULTS, ...discParams }, DISC_REF / (discParams.outerDiameter || DEFAULTS.outerDiameter)), {
    fit: { L: L / k, S: S / k },
  });
  const disc = {
    ...ref,
    parts: ref.parts.map((pt) => ({
      ...pt,
      points: pt.points.map(([x, y]) => [x * k, y * k]),
      holes: pt.holes.map((h) => ({ ...h, x: h.x * k, y: h.y * k, r: h.r * k })),
      label: [pt.label[0] * k, pt.label[1] * k],
      minWidth: pt.minWidth * k,
      spots: [],
    })),
    hairlines: ref.hairlines.map((h) => ({ ...h, r: h.r * k, pads: h.pads.map((d) => ({ x: d.x * k, y: d.y * k, r: d.r * k })) })),
    stats: { ...ref.stats, outerDiameter: D },
  };
  const centreParts = disc.parts.map((pt) => ({
    points: pt.points.map(([x, y]) => [x, y - cy]),
    holes: pt.holes.map((h) => ({ ...h, y: h.y - cy })),
    cuts: [],
    label: [pt.label[0], pt.label[1] - cy],
    minWidth: pt.minWidth,
    t: pt.t,
    el: 'centre',
    z: 2,
  }));

  const facade = p.tiling === 'none' ? [] : buildFacade(p, ctx);
  if (p.tiling !== 'none' && !facade.length) notes.push('No room for the panel lattice: widen the stage, raise the crown or shrink the disc.');

  const booth = [];
  const bw = p.boothWidth * M;
  if (bw >= 500) {
    const bh = Math.min(p.boothHeight * M, S);
    const n = Math.max(2, Math.ceil(bw / Math.min(L, 1300)));
    const pw = bw / n;
    for (let i = 0; i < n; i++) {
      const x0 = -bw / 2 + i * pw;
      const P = insetConvex([[x0, -deckH], [x0, -deckH - bh], [x0 + pw, -deckH - bh], [x0 + pw, -deckH]], 6);
      const fret = fretwork(P, p.motif === 'solid' ? 'solid' : 'slots', { web, rim: Math.max(p.rim, 70), detail: p.detail, minSlot: ctx.minSlot, minHoleR: ctx.minHoleR, ang: 0, parity: 0, reserve: 0 });
      booth.push(panel(P, fret, { t: 0, el: 'booth', z: 3, rim: Math.max(p.rim, 70), minWidth: web }));
    }
  }

  const parts = [...facade, ...centreParts, ...booth].map((pt, i) => ({ ...pt, id: String(i + 1), spots: [] }));

  let top = deckH;
  let half = W / 2;
  for (const pt of parts) {
    for (const [x, y] of pt.points) {
      if (-y > top) top = -y;
      if (Math.abs(x) > half) half = Math.abs(x);
    }
  }
  const total = parts.reduce((s, pt) => s + partArea(pt), 0);
  const edges = parts.reduce((s, pt) => s + perimeter(pt.points), 0);
  const traces = disc.hairlines.reduce((s, h) => s + h.r * (h.a1 - h.a0), 0);
  const density = (MATERIALS[fab.material] || MATERIALS.birch).density; // g/cm³
  const truss = p.truss ? { w: 2 * half + 1200, h: top + 600 } : null;

  return {
    params: p,
    fab,
    disc,
    centre: [0, -cy],
    parts,
    deck: { w: W, h: deckH, d: p.deckDepth * M },
    truss,
    notes,
    extent: { half, top },
    stats: {
      parts: parts.length,
      raised: parts.filter((pt) => pt.z === 1).length,
      widthM: (2 * half) / M,
      heightM: top / M,
      areaM2: total / 1e6,
      massKg: (total * fab.thickness * density) / 1e6,
      ledM: fab.led ? (edges + traces) / M : 0,
      deckModules: Math.ceil(W / 2000) * Math.ceil((p.deckDepth * M) / 1000),
      trussM: truss ? (2 * truss.h + truss.w) / M : 0,
      cutouts: parts.reduce((s, pt) => s + pt.holes.length + pt.cuts.length, 0),
    },
  };
}
