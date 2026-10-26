// Circular circuit generator: concentric bands sliced into parts, with notches,
// bubble cutouts, via rows and hairline traces. All units are millimetres.

import { subRng } from './rng.js';

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

export const GROUPS = [
  { id: 'layout', label: 'Layout' },
  { id: 'slices', label: 'Slices' },
  { id: 'notches', label: 'Notches & Edges' },
  { id: 'cutouts', label: 'Cutouts' },
  { id: 'traces', label: 'Traces' },
  { id: 'fab', label: 'Fabrication' },
];

// `rand` is the range used by Randomize — narrower than min/max so random
// designs stay in the good-looking part of the parameter space.
export const PARAMS = [
  { key: 'seed', label: 'Seed', group: 'layout', min: 0, max: 999, step: 1, def: 40, rand: [0, 999] },
  { key: 'rings', label: 'Rings', group: 'layout', min: 1, max: 16, step: 1, def: 7, rand: [4, 12] },
  { key: 'outerDiameter', label: 'Outer Ø (mm)', group: 'layout', min: 100, max: 1200, step: 10, def: 470, rand: null },
  { key: 'innerRadius', label: 'Inner Radius', group: 'layout', min: 10, max: 200, step: 1, def: 55, rand: [20, 90] },
  { key: 'fill', label: 'Band Fill', group: 'layout', min: 0.15, max: 0.9, step: 0.01, def: 0.5, rand: [0.35, 0.75] },
  { key: 'chaos', label: 'Randomness', group: 'layout', min: 0, max: 1, step: 0.01, def: 0.5, rand: [0.1, 0.9] },

  { key: 'startSpread', label: 'Start Spread', group: 'slices', min: 0, max: 360, step: 1, def: 341, rand: [90, 360] },
  { key: 'minSlice', label: 'Min Slice Angle', group: 'slices', min: 20, max: 350, step: 1, def: 146, rand: [90, 320] },
  { key: 'maxSplits', label: 'Max Splits', group: 'slices', min: 1, max: 6, step: 1, def: 3, rand: [1, 4] },
  { key: 'gapWidth', label: 'Gap Width', group: 'slices', min: 0.5, max: 30, step: 0.05, def: 5.15, rand: [2, 12] },
  { key: 'wallAngle', label: 'Wall Angle', group: 'slices', min: 0, max: 80, step: 1, def: 0, rand: [0, 60] },

  { key: 'notchDepth', label: 'Notch Depth', group: 'notches', min: 0, max: 0.85, step: 0.01, def: 0.31, rand: [0.1, 0.7] },
  { key: 'notchDensity', label: 'Notch Density', group: 'notches', min: 0, max: 1, step: 0.01, def: 0.5, rand: [0.1, 0.9] },
  { key: 'edge', label: 'Edge Chamfer', group: 'notches', min: 0, max: 10, step: 0.1, def: 0, rand: [0, 5] },

  { key: 'bubbleSize', label: 'Bubble Size', group: 'cutouts', min: 0, max: 0.95, step: 0.01, def: 0.43, rand: [0.2, 0.9] },
  { key: 'bubbleSpacing', label: 'Bubble Spacing', group: 'cutouts', min: 4, max: 60, step: 0.5, def: 20, rand: [8, 30] },
  { key: 'bubbleDensity', label: 'Bubble Coverage', group: 'cutouts', min: 0, max: 1, step: 0.01, def: 0.55, rand: [0.2, 0.9] },
  { key: 'viaDensity', label: 'Via Rows', group: 'cutouts', min: 0, max: 1, step: 0.01, def: 0.3, rand: [0, 0.9] },

  { key: 'hairlines', label: 'Hairlines', group: 'traces', min: 0, max: 24, step: 1, def: 7, rand: [2, 16] },
  { key: 'traceSweep', label: 'Trace Sweep', group: 'traces', min: 10, max: 340, step: 1, def: 160, rand: [60, 300] },
  { key: 'tracePads', label: 'Trace Pads', group: 'traces', min: 0, max: 1, step: 0.01, def: 0.5, rand: [0, 1] },

  // Manufacturing limits: geometry never goes below these (set by the process preset).
  { key: 'minHole', label: 'Min Hole Ø', group: 'fab', min: 0.3, max: 12, step: 0.1, def: 1, rand: null },
  { key: 'minWeb', label: 'Min Web', group: 'fab', min: 0.3, max: 10, step: 0.1, def: 1.5, rand: null },
];

export const PARAM_MAP = Object.fromEntries(PARAMS.map((p) => [p.key, p]));
export const DEFAULTS = Object.fromEntries(PARAMS.map((p) => [p.key, p.def]));

export function quantize(def, v) {
  const n = Math.min(def.max, Math.max(def.min, Number(v)));
  if (!Number.isFinite(n)) return def.def;
  const q = Math.round((n - def.min) / def.step) * def.step + def.min;
  const decimals = (String(def.step).split('.')[1] || '').length;
  return Number(q.toFixed(decimals));
}

export function normalizeParams(input = {}) {
  const out = {};
  for (const def of PARAMS) out[def.key] = quantize(def, input[def.key] ?? def.def);
  return out;
}

const polar = (r, a) => [r * Math.cos(a), r * Math.sin(a)];
const lerp = (a, b, t) => a + (b - a) * t;

// Does circular interval [a0, a0+l0] overlap [a1, a1+l1] (with padding)?
function circOverlap(a0, l0, a1, l1, pad) {
  const d = (((a1 - a0) % TAU) + TAU) % TAU;
  return d < l0 + pad || d > TAU - l1 - pad;
}

export function generate(input) {
  const p = normalizeParams(input);
  const R = p.outerDiameter / 2;
  const r0 = Math.min(p.innerRadius, R * 0.85);

  const weights = [];
  for (let i = 0; i < p.rings; i++) {
    const rr = subRng(p.seed, 'ring', i);
    weights.push(Math.max(0.25, 1 + p.chaos * (rr() * 1.6 - 0.8)));
  }
  const sumW = weights.reduce((s, w) => s + w, 0);

  const rings = [];
  let cursor = r0;
  for (let i = 0; i < p.rings; i++) {
    const pitch = ((R - r0) * weights[i]) / sumW;
    rings.push({
      index: i,
      gapIn: cursor,
      rIn: cursor + pitch * (1 - p.fill),
      rOut: cursor + pitch,
      t: p.rings > 1 ? i / (p.rings - 1) : 0.5,
    });
    cursor += pitch;
  }

  const parts = [];
  for (const ring of rings) parts.push(...buildRing(p, ring));
  const hairlines = buildHairlines(p, rings);

  return { params: p, rings, parts, hairlines, stats: computeStats(p, rings, parts, hairlines) };
}

function buildRing(p, ring) {
  const rng = subRng(p.seed, 'slice', ring.index);
  const { rIn, rOut } = ring;
  const w = rOut - rIn;
  const mid = (rIn + rOut) / 2;
  const gapAng = p.gapWidth / mid;

  const start = -Math.PI / 2 + rng() * p.startSpread * DEG;
  let cover = lerp(p.minSlice, 360, rng()) * DEG;
  cover = Math.min(cover, TAU - Math.max(gapAng, 0.5 * DEG)); // always leave a seam

  const minPiece = Math.max(12 * DEG, gapAng * 2, (2 * p.edge + 6) / mid);
  let n = 1 + Math.floor(rng() * p.maxSplits);
  while (n > 1 && (cover - (n - 1) * gapAng) / n < minPiece * 1.5) n--;

  const ws = Array.from({ length: n }, () => 0.35 + rng() * (0.65 + p.chaos));
  const sumWs = ws.reduce((s, v) => s + v, 0);
  const usable = cover - (n - 1) * gapAng;
  const wallSign = rng() < 0.5 ? -1 : 1;
  const delta = (Math.tan(p.wallAngle * DEG) * w * wallSign) / rOut;

  const pieces = [];
  let a = start;
  for (let k = 0; k < n; k++) {
    const len = (usable * ws[k]) / sumWs;
    const prng = subRng(p.seed, 'piece', ring.index, k);
    pieces.push(buildPiece(p, ring, a, a + len, delta, prng, pieces.length));
    a += len + gapAng;
  }
  return pieces;
}

function buildPiece(p, ring, a, b, delta, rng, k) {
  const { rIn, rOut } = ring;
  const w = rOut - rIn;
  const mid = (rIn + rOut) / 2;
  const depth = Math.max(0, Math.min(p.notchDepth * w, w - p.minWeb));
  const c = Math.max(0, Math.min(p.edge, (w - depth) * 0.45, (b - a) * rIn * 0.25));

  // --- notches: stepped sections of the inner/outer edge with 45° transitions
  const notches = [];
  if (depth > 0.3 && p.notchDensity > 0) {
    const arcLen = (b - a) * mid;
    const target = Math.min(10, Math.round(((p.notchDensity * arcLen) / 70) * (0.4 + rng() * 1.2)));
    for (let tries = 0; notches.length < target && tries < target * 5 + 4; tries++) {
      const side = rng() < 0.5 ? 'out' : 'in';
      const r = side === 'out' ? rOut : rIn;
      const lo = side === 'out' ? a + delta : a;
      const hi = side === 'out' ? b + delta : b;
      const t = depth / r;
      const margin = (c + 2) / r + t;
      const len = (2 * depth + 6 + rng() * Math.max(10, arcLen * 0.25)) / r;
      let s;
      let e;
      if (rng() < 0.25) {
        // a step that runs off one end of the part
        if (len + margin > (hi - lo) * 0.7) continue;
        if (rng() < 0.5) [s, e] = [lo - 1, lo + margin + len];
        else [s, e] = [hi - margin - len, hi + 1];
      } else {
        const room = hi - lo - 2 * margin - len;
        if (room < 0) continue;
        s = lo + margin + rng() * room;
        e = s + len;
      }
      const pad = (depth + 3) / mid;
      if (notches.some((nn) => s < nn.e + pad && e > nn.s - pad)) continue;
      notches.push({ side, s, e, depth, t });
    }
  }

  const off = (side, th) => {
    let o = 0;
    for (const nn of notches) {
      if (nn.side !== side) continue;
      const kk = Math.min(1, (th - nn.s) / nn.t, (nn.e - th) / nn.t);
      if (kk > 0) o = Math.max(o, nn.depth * kk);
    }
    return o;
  };
  const rOutAt = (th) => rOut - off('out', th);
  const rInAt = (th) => rIn + off('in', th);

  const sampleEdge = (side, from, to) => {
    const rAt = side === 'out' ? rOutAt : rInAt;
    const steps = Math.max(1, Math.ceil(Math.abs(to - from) / (1.2 * DEG)));
    const angles = [];
    for (let i = 0; i <= steps; i++) angles.push(lerp(from, to, i / steps));
    const lo = Math.min(from, to);
    const hi = Math.max(from, to);
    for (const nn of notches) {
      if (nn.side !== side) continue;
      for (const th of [nn.s, nn.s + nn.t, nn.e - nn.t, nn.e]) if (th > lo && th < hi) angles.push(th);
    }
    angles.sort((x, y) => (from < to ? x - y : y - x));
    return angles.map((th) => polar(rAt(th), th));
  };

  // --- outline (clockwise on screen: outer edge forward, inner edge back)
  // Walls are swept (radius and angle interpolated together) so slanted ends
  // stay inside the band instead of cutting a chord across it.
  const ao = a + delta;
  const bo = b + delta;
  const wallLen = Math.hypot(w, delta * mid) || 1;
  const cu = Math.min(0.45, c / wallLen);
  const wallPts = (thIn, thOut, u0, u1) => {
    const steps = Math.abs(delta) > 1e-3 ? 10 : 1;
    const out = [];
    for (let i = 0; i <= steps; i++) {
      const u = lerp(u0, u1, i / steps);
      out.push(polar(lerp(rInAt(thIn), rOutAt(thOut), u), lerp(thIn, thOut, u)));
    }
    return out;
  };
  const pts = [
    ...sampleEdge('out', ao + c / rOut, bo - c / rOut),
    ...wallPts(b, bo, 1 - cu, cu),
    ...sampleEdge('in', b - c / rIn, a + c / rIn),
    ...wallPts(a, ao, cu, 1 - cu),
  ];
  const points = pts.filter((pt, i) => {
    const q = pts[(i + pts.length - 1) % pts.length];
    return Math.hypot(pt[0] - q[0], pt[1] - q[1]) > 1e-6;
  });

  // --- cutouts
  const holes = [];
  const safeLo = Math.max(a, ao);
  const safeHi = Math.min(b, bo);
  const localBand = (th, halfAng) => {
    let rI = -Infinity;
    let rO = Infinity;
    for (let i = 0; i <= 6; i++) {
      const x = th - halfAng + (2 * halfAng * i) / 6;
      rI = Math.max(rI, rInAt(x));
      rO = Math.min(rO, rOutAt(x));
    }
    return [rI, rO];
  };
  const placeRow = (spacing, rFor, endPad) => {
    const lo = safeLo + endPad / mid;
    const hi = safeHi - endPad / mid;
    if (hi <= lo) return;
    const f = 0.35 + 0.65 * rng();
    const runLen = (hi - lo) * f;
    const runStart = lo + rng() * (hi - lo - runLen);
    const step = spacing / mid;
    const count = Math.floor(runLen / step) + 1;
    const offset = (runLen - (count - 1) * step) / 2;
    for (let j = 0; j < count; j++) {
      const th = runStart + offset + j * step;
      const r = rFor(th);
      if (r) holes.push(r);
    }
  };

  if (rng() < p.bubbleDensity) {
    const scale = 1 - p.chaos * 0.35 * rng();
    const minR = p.minHole / 2;
    const maxR = Math.min((p.bubbleSize * w * scale) / 2, (p.bubbleSpacing - p.minWeb) / 2);
    if (maxR >= minR) {
      placeRow(
        p.bubbleSpacing,
        (th) => {
          const [rI, rO] = localBand(th, (maxR + 1.5) / mid);
          const lw = rO - rI;
          const r = Math.min(maxR, (p.bubbleSize * lw * scale) / 2, lw / 2 - p.minWeb);
          if (r < minR) return null;
          const [x, y] = polar((rI + rO) / 2, th);
          return { x, y, r, kind: 'bubble' };
        },
        Math.max(c, maxR) + p.minWeb + 1,
      );
    }
  } else if (rng() < p.viaDensity) {
    const vr = Math.max(p.minHole / 2, Math.min(2.2, Math.max(0.8, w * 0.06)));
    placeRow(
      Math.max(2 * vr + Math.max(p.minWeb, 2 * vr), p.bubbleSpacing * 0.55),
      (th) => {
        const [rI, rO] = localBand(th, (vr + 1.5) / mid);
        if (rO - rI < 2 * vr + 2 * p.minWeb) return null;
        const [x, y] = polar((rI + rO) / 2, th);
        return { x, y, r: vr, kind: 'via' };
      },
      Math.max(c, vr) + p.minWeb + 1,
    );
  }

  let minWidth = Infinity;
  for (let i = 0; i <= 120; i++) {
    const th = lerp(safeLo, safeHi, i / 120);
    minWidth = Math.min(minWidth, rOutAt(th + delta) - rInAt(th));
  }
  // Spot for an engraved part number: the point on the mid-line farthest from any hole.
  let label = polar(mid, lerp(safeLo, safeHi, 0.5));
  let best = -1;
  for (let i = 1; i < 24; i++) {
    const th = lerp(safeLo, safeHi, i / 24);
    const pt = polar((rInAt(th) + rOutAt(th + delta)) / 2, th);
    const clear = holes.reduce((m, h) => Math.min(m, Math.hypot(h.x - pt[0], h.y - pt[1]) - h.r), Infinity);
    if (clear > best) [best, label] = [clear, pt];
  }

  return { id: `${ring.index + 1}.${k + 1}`, ring: ring.index, t: ring.t, a, b, points, holes, minWidth, label };
}

function buildHairlines(p, rings) {
  const rng = subRng(p.seed, 'hair');
  const used = rings.map(() => []);
  const out = [];
  for (let h = 0; h < p.hairlines; h++) {
    for (let tries = 0; tries < 16; tries++) {
      const g = Math.floor(rng() * rings.length);
      const ring = rings[g];
      const gap = ring.rIn - ring.gapIn;
      if (gap < 2.5) continue;
      const r = ring.gapIn + gap * (0.5 + (rng() - 0.5) * 0.3 * p.chaos);
      const sweep = Math.min(340, p.traceSweep * (0.35 + rng() * 1.1)) * DEG;
      const start = rng() * TAU;
      if (used[g].some(([s, l]) => circOverlap(start, sweep, s, l, 6 * DEG))) continue;
      used[g].push([start, sweep]);
      const padR = Math.min(gap * 0.28, 2.2);
      const pads = [];
      for (const th of [start, start + sweep]) {
        if (rng() < p.tracePads) {
          const [x, y] = polar(r, th);
          pads.push({ x, y, r: padR });
        }
      }
      out.push({ ring: g, t: ring.t, r, a0: start, a1: start + sweep, pads });
      break;
    }
  }
  return out;
}

function polyArea(pts) {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    s += x1 * y2 - x2 * y1;
  }
  return Math.abs(s) / 2;
}

function polyLength(pts) {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    s += Math.hypot(x2 - x1, y2 - y1);
  }
  return s;
}

function computeStats(p, rings, parts, hairlines) {
  let cutouts = 0;
  let area = 0;
  let cut = 0;
  for (const part of parts) {
    cutouts += part.holes.length;
    area += polyArea(part.points);
    cut += polyLength(part.points);
    for (const h of part.holes) {
      area -= Math.PI * h.r * h.r;
      cut += TAU * h.r;
    }
  }
  const engrave = hairlines.reduce((s, h) => s + h.r * (h.a1 - h.a0), 0);
  const outer = rings.length ? rings[rings.length - 1].rOut * 2 : 0;
  return {
    parts: parts.length,
    cutouts,
    rings: rings.length,
    hairlines: hairlines.length,
    outerDiameter: Math.round(outer),
    areaMm2: area,
    cutLengthMm: cut,
    engraveLengthMm: engrave,
  };
}
