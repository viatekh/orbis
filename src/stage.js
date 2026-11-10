// Festival stage facade generator. A front elevation built from flat panels:
// a ring-circuit disc as the centrepiece, mirrored wings, and a DJ booth front.
// Every panel is generated small enough to cut from one sheet.
//
// Coordinates are millimetres in SVG orientation: x to stage left/right of the
// centreline, y DOWN, ground at y = 0 (so heights are negative y).

import { subRng } from './rng.js';
import { generate, scaleParams, fitSpan, DEFAULTS, quantize } from './generator.js';
import { MATERIALS, signedArea } from './fabrication.js';

const M = 1000;
const DEG = Math.PI / 180;
const EDGE = 40; // sheet margin kept clear on every side
const JOINT = 80; // gap between neighbouring arc panels
const DISC_REF = 1000; // the disc is generated at this diameter, then scaled

export const WING_STYLES = { fins: 'Fins', rays: 'Rays', arcs: 'Arcs', none: 'None' };
export const STAGE_MATERIALS = ['birch', 'mdf', 'hdpe', 'aluminium'];

export const STAGE_GROUPS = [
  { id: 'stage', label: 'Stage' },
  { id: 'centre', label: 'Centrepiece' },
  { id: 'wings', label: 'Wings' },
  { id: 'booth', label: 'DJ Booth' },
];

export const STAGE_PARAMS = [
  { key: 'seed', label: 'Seed', group: 'stage', min: 0, max: 999, step: 1, def: 7, rand: [0, 999] },
  { key: 'width', label: 'Stage Width (m)', group: 'stage', min: 4, max: 30, step: 0.5, def: 14, rand: [9, 20] },
  { key: 'deckHeight', label: 'Deck Height (m)', group: 'stage', min: 0.4, max: 2.4, step: 0.1, def: 1.2, rand: null },
  { key: 'deckDepth', label: 'Deck Depth (m)', group: 'stage', min: 2, max: 12, step: 1, def: 6, rand: null },
  { key: 'chaos', label: 'Randomness', group: 'stage', min: 0, max: 1, step: 0.01, def: 0.35, rand: [0, 0.8] },

  { key: 'discDiameter', label: 'Disc Ø (m)', group: 'centre', min: 1, max: 8, step: 0.1, def: 4, rand: [2.5, 5.5] },
  { key: 'lift', label: 'Lift Above Deck (m)', group: 'centre', min: 0, max: 4, step: 0.1, def: 1.3, rand: [0.8, 2] },

  { key: 'wingCount', label: 'Panels per Side', group: 'wings', min: 1, max: 14, step: 1, def: 6, rand: [3, 10] },
  { key: 'wingHeight', label: 'Wing Height (m)', group: 'wings', min: 1.5, max: 10, step: 0.1, def: 6, rand: [4, 8] },
  { key: 'wingSweep', label: 'Sweep', group: 'wings', min: -1, max: 1, step: 0.05, def: 0.6, rand: [-1, 1] },
  { key: 'wingFill', label: 'Panel Fill', group: 'wings', min: 0.3, max: 0.95, step: 0.01, def: 0.7, rand: [0.45, 0.9] },
  { key: 'wingTilt', label: 'Tilt (°)', group: 'wings', min: -40, max: 40, step: 1, def: 20, rand: [-35, 35] },
  { key: 'wingCutouts', label: 'Cutouts', group: 'wings', min: 0, max: 1, step: 0.01, def: 0.6, rand: [0, 1] },

  { key: 'boothWidth', label: 'Booth Width (m)', group: 'booth', min: 0, max: 6, step: 0.1, def: 3, rand: [2, 4] },
  { key: 'boothHeight', label: 'Booth Height (m)', group: 'booth', min: 0.8, max: 1.1, step: 0.05, def: 1.1, rand: null },
];
export const STAGE_PARAM_MAP = Object.fromEntries(STAGE_PARAMS.map((p) => [p.key, p]));

export const STAGE_DEFAULTS = {
  ...Object.fromEntries(STAGE_PARAMS.map((p) => [p.key, p.def])),
  wingStyle: 'fins',
  mirror: true,
  truss: true,
};

export function normalizeStage(input = {}) {
  const out = {};
  for (const def of STAGE_PARAMS) out[def.key] = quantize(def, input[def.key] ?? def.def);
  out.wingStyle = WING_STYLES[input.wingStyle] ? input.wingStyle : STAGE_DEFAULTS.wingStyle;
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

// ------------------------------------------------------------------ geometry

const rotP = ([x, y], a) => {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [x * c - y * s, x * s + y * c];
};
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// Keep the part of a convex polygon with x >= v (sign 1) or x <= v (sign -1).
function clipX(poly, v, sign) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const ia = (a[0] - v) * sign >= 0;
    const ib = (b[0] - v) * sign >= 0;
    if (ia) out.push(a);
    if (ia !== ib) {
      const t = (v - a[0]) / (b[0] - a[0]);
      out.push([v, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out;
}

// Distance from a point to the nearest edge of a convex polygon (negative outside).
function insideBy(poly, x, y) {
  const sgn = Math.sign(signedArea(poly)) || 1;
  let m = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const [ax, ay] = poly[i];
    const [bx, by] = poly[(i + 1) % poly.length];
    const len = Math.hypot(bx - ax, by - ay) || 1;
    m = Math.min(m, (sgn * ((bx - ax) * (y - ay) - (by - ay) * (x - ax))) / len);
  }
  return m;
}

function labelIn(q, holes) {
  const [cx, cy] = centroid(q);
  const xs = q.map((pt) => pt[0]);
  const ys = q.map((pt) => pt[1]);
  const cands = [[cx, cy]];
  for (let i = 1; i < 12; i++) {
    for (let j = 1; j < 6; j++) cands.push([lerp(Math.min(...xs), Math.max(...xs), i / 12), lerp(Math.min(...ys), Math.max(...ys), j / 6)]);
  }
  return roomiest(cands, (x, y) => insideBy(q, x, y), holes);
}

const centroid = (pts) => {
  const n = pts.length;
  return [pts.reduce((s, p) => s + p[0], 0) / n, pts.reduce((s, p) => s + p[1], 0) / n];
};

function polyArea(part) {
  return Math.abs(signedArea(part.points)) - part.holes.reduce((s, h) => s + Math.PI * h.r * h.r, 0);
}
const perimeter = (pts) => pts.reduce((s, p, i) => s + Math.hypot(p[0] - pts[(i + 1) % pts.length][0], p[1] - pts[(i + 1) % pts.length][1]), 0);

// Roomiest of a set of candidate points: far from the panel edge and from every cutout.
function roomiest(cands, edgeDist, holes) {
  let best = null;
  for (const [x, y] of cands) {
    const clear = holes.reduce((m, h) => Math.min(m, Math.hypot(h.x - x, h.y - y) - h.r), edgeDist(x, y));
    if (!best || clear > best.clear) best = { pt: [x, y], clear };
  }
  return best.pt;
}

// A straight tapered panel ("blade") from `base` along angle `ang`, cut into
// sheet-length segments. Local frame: x along the blade, y across it.
function blade({ base, ang, len, w0, w1, slant = 0, holes = null, web, maxLen }) {
  const s = clamp(slant, -len * 0.35, len * 0.35);
  const quad = [[0, -w0 / 2], [len - s, -w1 / 2], [len + s, w1 / 2], [0, w0 / 2]];
  const x1 = len + Math.abs(s);
  const n = Math.max(1, Math.ceil(x1 / maxLen));
  const segs = [];
  for (let i = 0; i < n; i++) {
    let q = clipX(quad, (x1 * i) / n, 1);
    q = clipX(q, (x1 * (i + 1)) / n, -1);
    if (q.length >= 3) segs.push(q);
  }
  const circles = [];
  if (holes) {
    const { r, spacing, from, to } = holes;
    for (let x = len * from; x <= len * to; x += spacing) circles.push({ x, y: 0, r });
  }
  const tf = (pt) => {
    const [x, y] = rotP(pt, ang);
    return [x + base[0], y + base[1]];
  };
  return segs.map((q) => {
    const mine = circles.filter((c) => insideBy(q, c.x, c.y) >= c.r + web);
    return {
      points: q.map(tf),
      holes: mine.map((c) => {
        const [x, y] = tf([c.x, c.y]);
        return { x, y, r: c.r, kind: 'bubble' };
      }),
      label: tf(labelIn(q, mine)),
      minWidth: Math.min(w0, w1),
    };
  });
}

// An arc band panel centred on (0, -cy); angles are measured up from horizontal.
function arcPanel(cy, rIn, rOut, a0, a1, holeR, web) {
  const pt = (r, a) => [r * Math.cos(a), -cy - r * Math.sin(a)];
  const steps = Math.max(2, Math.ceil((a1 - a0) / (1.5 * DEG)));
  const points = [];
  for (let i = 0; i <= steps; i++) points.push(pt(rOut, lerp(a0, a1, i / steps)));
  for (let i = steps; i >= 0; i--) points.push(pt(rIn, lerp(a0, a1, i / steps)));
  const mid = (rIn + rOut) / 2;
  const holes = [];
  if (holeR > 0) {
    const step = Math.max(2 * holeR + web, holeR * 3.2) / mid;
    const pad = (holeR + web + 20) / mid;
    const count = Math.floor((a1 - a0 - 2 * pad) / step) + 1;
    const start = (a0 + a1) / 2 - ((count - 1) * step) / 2;
    for (let i = 0; i < count; i++) {
      const [x, y] = pt(mid, start + i * step);
      holes.push({ x, y, r: holeR, kind: 'bubble' });
    }
  }
  const cands = [];
  for (let i = 1; i < 12; i++) {
    for (const f of [0.5, 0.2, 0.8]) cands.push([lerp(rIn, rOut, f), lerp(a0, a1, i / 12)]);
  }
  const polar = cands.map(([r, a]) => [...pt(r, a), r, a]);
  const edge = new Map(polar.map(([x, y, r, a]) => [`${x},${y}`, Math.min(r - rIn, rOut - r, (a - a0) * r, (a1 - a) * r)]));
  const label = roomiest(polar.map(([x, y]) => [x, y]), (x, y) => edge.get(`${x},${y}`), holes);
  return { points, holes, label, minWidth: rOut - rIn };
}

// ------------------------------------------------------------------ wings (stage-right side, x > 0)

function buildWing(p, ctx, seedTag) {
  const { W, deckH, D, cy, L, S, web, minHoleR } = ctx;
  const rng = subRng(p.seed, 'wing', seedTag);
  const n = p.wingCount;
  const H = p.wingHeight * M;
  const out = [];
  const taper = (t) => 1 - 0.62 * Math.abs(p.wingSweep) * (p.wingSweep > 0 ? t : 1 - t);
  const jitter = () => 1 - p.chaos * 0.25 * rng();
  const holeSpec = (w, len) => {
    const r = w * (0.14 + 0.12 * p.wingCutouts);
    if (rng() >= p.wingCutouts || r < minHoleR || w - 2 * r < 2 * web) return null;
    const run = 0.35 + 0.5 * rng();
    const from = 0.08 + rng() * (0.84 - run);
    return { r, spacing: Math.max(2 * r + web, w * 0.85), from, to: Math.min(0.92, from + run), len };
  };

  if (p.wingStyle === 'fins') {
    const xs = Math.max(D / 2, (p.boothWidth * M) / 2) + 250;
    const xe = W / 2;
    if (xe - xs < 300) return { parts: out, note: 'No room for wings: widen the stage or shrink the disc.' };
    const pitch = (xe - xs) / n;
    const pw = Math.min(pitch * p.wingFill, S);
    for (let i = 0; i < n; i++) {
      const t = n > 1 ? i / (n - 1) : 0;
      const len = Math.max(600, H * taper(t) * jitter());
      const slant = (-Math.tan(p.wingTilt * DEG) * pw) / 2;
      const parts = blade({
        base: [xs + pitch * (i + 0.5), -deckH], ang: -Math.PI / 2, len, w0: pw, w1: pw, slant,
        holes: holeSpec(pw, len), web, maxLen: L,
      });
      for (const part of parts) out.push({ ...part, t: 1 - t * 0.8, el: 'wing' });
    }
    return { parts: out };
  }

  const r1 = D / 2 + 250;
  // rays and arcs always get some headroom above the disc centre, however low Wing Height is set
  const capY = Math.max(deckH + H, cy + D / 2 + 1500);
  if (p.wingStyle === 'rays') {
    // fan angles snap to whole degrees so long blades sit square on the sheet
    const aLo = -p.wingTilt * DEG;
    const aHi = 78 * DEG;
    const pitch = (aHi - aLo) / n;
    for (let i = 0; i < n; i++) {
      const t = n > 1 ? i / (n - 1) : 0;
      const a = Math.round((aLo + pitch * (i + 0.5)) / DEG) * DEG;
      let reach = W / 2 / Math.max(0.05, Math.cos(a));
      if (a > 0.02) reach = Math.min(reach, (capY - cy) / Math.sin(a));
      const w0 = Math.min(S, r1 * pitch * p.wingFill);
      if (a < -0.02) reach = Math.min(reach, (cy - deckH - w0) / Math.sin(-a));
      const r2 = r1 + (reach - r1) * taper(t) * jitter();
      if (r2 - r1 < 500) continue;
      const w1 = Math.min(S, w0 * lerp(1, Math.min(2.2, r2 / r1), 0.6));
      const len = r2 - r1;
      const parts = blade({
        base: [r1 * Math.cos(a), -cy - r1 * Math.sin(a)], ang: -a, len, w0, w1, slant: -w1 * 0.25 * Math.sign(p.wingTilt || 1),
        holes: holeSpec(Math.min(w0, w1), len), web, maxLen: L,
      });
      for (const part of parts) out.push({ ...part, t: 1 - t * 0.8, el: 'wing' });
    }
    return { parts: out, note: out.length ? null : 'No room for rays: raise Wing Height or widen the stage.' };
  }

  if (p.wingStyle === 'arcs') {
    const rEnd = W / 2;
    if (rEnd - r1 < 300) return { parts: out, note: 'No room for wings: widen the stage or shrink the disc.' };
    const pitch = (rEnd - r1) / n;
    const bw = Math.min(pitch * p.wingFill, S * 0.8);
    for (let j = 0; j < n; j++) {
      const t = n > 1 ? j / (n - 1) : 0;
      const rIn = r1 + j * pitch + (pitch - bw) / 2;
      const rOut = rIn + bw;
      const drop = cy - deckH - 60;
      const lo = Math.max(-(p.wingTilt + 20) * DEG, drop >= rOut ? -70 * DEG : -Math.asin(clamp(drop / rOut, 0, 1)));
      const hi = Math.min(80 * DEG, Math.asin(clamp((capY - cy) / rOut, -1, 1)));
      if (hi - lo < 10 * DEG) continue;
      const cover = (hi - lo) * taper(t) * jitter();
      const a0 = lo + (hi - lo - cover) * rng() * p.chaos;
      const gapAng = JOINT / ((rIn + rOut) / 2);
      const maxSpan = fitSpan(rIn, rOut, L, S);
      const count = Math.max(Math.ceil(cover / maxSpan), 1 + Math.floor(rng() * 2.5 * p.chaos));
      const span = (cover - (count - 1) * gapAng) / count;
      if (span < 4 * DEG) continue;
      const r = bw * (0.16 + 0.14 * p.wingCutouts);
      for (let k = 0; k < count; k++) {
        const s = a0 + k * (span + gapAng);
        const holed = rng() < p.wingCutouts && r >= minHoleR && bw - 2 * r >= 2 * web;
        out.push({ ...arcPanel(cy, rIn, rOut, s, s + span, holed ? r : 0, web), t: 1 - t * 0.8, el: 'wing' });
      }
    }
    return { parts: out, note: out.length ? null : 'No room for arcs: raise Wing Height or widen the stage.' };
  }
  return { parts: out };
}

const mirrorPart = (part) => ({
  ...part,
  points: part.points.map(([x, y]) => [-x, y]).reverse(),
  holes: part.holes.map((h) => ({ ...h, x: -h.x })),
  label: [-part.label[0], part.label[1]],
});

// ------------------------------------------------------------------ stage

export function generateStage(input, discParams = DEFAULTS, fabInput = {}) {
  const p = normalizeStage(input);
  const fab = normalizeStageFab(fabInput);
  const L = Math.max(fab.sheetW, fab.sheetH) - 2 * EDGE;
  const S = Math.min(fab.sheetW, fab.sheetH) - 2 * EDGE;
  const W = p.width * M;
  const deckH = p.deckHeight * M;
  const D = p.discDiameter * M;
  const cy = deckH + p.lift * M + D / 2;
  const web = Math.max(40, fab.tool * 4);
  const ctx = { W, deckH, D, cy, L, S, web, minHoleR: Math.max(15, fab.tool) };
  const notes = [];

  // centrepiece: the current disc design, re-sliced so each part fits a sheet
  const k = D / DISC_REF;
  const ref = generate(scaleParams({ ...DEFAULTS, ...discParams }, DISC_REF / (discParams.outerDiameter || DEFAULTS.outerDiameter)), {
    fit: { L: L / k, S: S / k },
  });
  const scalePart = (pt) => ({
    ...pt,
    points: pt.points.map(([x, y]) => [x * k, y * k]),
    holes: pt.holes.map((h) => ({ ...h, x: h.x * k, y: h.y * k, r: h.r * k })),
    label: [pt.label[0] * k, pt.label[1] * k],
    minWidth: pt.minWidth * k,
    spots: [],
  });
  const disc = {
    ...ref,
    parts: ref.parts.map(scalePart),
    hairlines: ref.hairlines.map((h) => ({ ...h, r: h.r * k, pads: h.pads.map((d) => ({ x: d.x * k, y: d.y * k, r: d.r * k })) })),
    stats: { ...ref.stats, outerDiameter: D },
  };
  const centreParts = disc.parts.map((pt) => ({
    points: pt.points.map(([x, y]) => [x, y - cy]),
    holes: pt.holes.map((h) => ({ ...h, y: h.y - cy })),
    label: [pt.label[0], pt.label[1] - cy],
    minWidth: pt.minWidth,
    t: pt.t,
    el: 'centre',
  }));

  let right = [];
  let left = [];
  if (p.wingStyle !== 'none') {
    const r = buildWing(p, ctx, 'r');
    if (r.note) notes.push(r.note);
    right = r.parts;
    left = (p.mirror ? right : buildWing(p, ctx, 'l').parts).map(mirrorPart);
  }

  const booth = [];
  const bw = p.boothWidth * M;
  if (bw >= 500) {
    const bh = Math.min(p.boothHeight * M, S);
    const n = Math.ceil(bw / L);
    const pw = bw / n;
    const r = bh * 0.11;
    for (let i = 0; i < n; i++) {
      const x0 = -bw / 2 + i * pw;
      const holes = [];
      const step = r * 3.6;
      const count = Math.max(0, Math.floor((pw - 2 * (r + web)) / step) + 1);
      for (let j = 0; j < count; j++) holes.push({ x: x0 + pw / 2 + (j - (count - 1) / 2) * step, y: -deckH - bh * 0.5, r, kind: 'bubble' });
      booth.push({
        points: [[x0, -deckH], [x0, -deckH - bh], [x0 + pw, -deckH - bh], [x0 + pw, -deckH]],
        holes, label: [x0 + pw / 2, -deckH - bh * 0.22], minWidth: Math.min(pw, bh), t: 0, el: 'booth',
      });
    }
  }

  const parts = [...left, ...centreParts, ...right, ...booth].map((pt, i) => ({ ...pt, id: String(i + 1), spots: [] }));

  let top = deckH;
  let half = W / 2;
  for (const pt of parts) {
    for (const [x, y] of pt.points) {
      if (-y > top) top = -y;
      if (Math.abs(x) > half) half = Math.abs(x);
    }
  }
  const area = parts.reduce((s, pt) => s + polyArea(pt), 0);
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
      widthM: (2 * half) / M,
      heightM: top / M,
      areaM2: area / 1e6,
      massKg: (area * fab.thickness * density) / 1e6,
      ledM: fab.led ? (edges + traces) / M : 0,
      deckModules: Math.ceil(W / 2000) * Math.ceil((p.deckDepth * M) / 1000),
      trussM: truss ? (2 * truss.h + truss.w) / M : 0,
      holes: parts.reduce((s, pt) => s + pt.holes.length, 0),
    },
  };
}
