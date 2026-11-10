// Ribbons: organic parts with truly curved outlines. A ribbon is a spine curve with a
// width either side of it; horns, flames, feathers, vines and curled petals are all ribbons.
// Nothing here needs polygon booleans: the outline is the two offset edges of the spine,
// and every cutout is laid out in ribbon coordinates (s along the spine, d across it),
// so it follows the curve and keeps its distance from the edges by construction.

import { fitsSheet } from './convex.js';

const TAU = Math.PI * 2;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export const RIBBON_MOTIFS = { vein: 'Feather vein', lanes: 'Flowing slots', ribs: 'Ribs', eyes: 'Eyes', window: 'Frame', solid: 'Solid' };

// Width profiles along a ribbon (0 = root, 1 = tip), each peaking at 1.
export const RIBBON_PROFILES = {
  horn: (u) => (1 - u) ** 0.8,
  flame: (u) => Math.min(1, u / 0.12) ** 0.6 * (1 - u) ** 0.9 * 1.12,
  leaf: (u) => Math.sin(Math.PI * clamp(u, 0, 1)) ** 0.8,
  feather: (u) => Math.min(1, u / 0.1) ** 0.5 * (1 - u ** 3) ** 0.7,
  blade: (u) => Math.min(1, u / 0.06) * (1 - u) ** 0.55,
  teardrop: (u) => (Math.sqrt(clamp(u, 0, 1)) * (1 - u)) / 0.3849,
  eye: (u) => (4 * u * (1 - u)) ** 0.9,
  diamond: (u) => (u < 0.35 ? u / 0.35 : (1 - u) / 0.65),
  stem: () => 1,
};

// A spine: points every `step` mm from `start`, heading `heading` + turn(u) (radians, u = 0..1).
export function makeSpine({ start, heading, length, turn = () => 0, step = 40 }) {
  const n = Math.max(4, Math.round(length / step));
  const ds = length / n;
  const pts = [];
  let [x, y] = start;
  for (let k = 0; k <= n; k++) {
    const u = k / n;
    pts.push({ x, y, h: heading + turn(u), u, s: k * ds });
    const hm = heading + turn((k + 0.5) / n);
    x += Math.cos(hm) * ds;
    y += Math.sin(hm) * ds;
  }
  return pts;
}

// Build the flat parts of one ribbon. `half(u)` gives [left, right] half-widths in mm.
// o: { L, S, web, rim, minSlot, minHoleR, motif, detail, etch, clipY, tip }
export function ribbonParts(spine, half, o) {
  const tip = o.tip ?? 28; // tips are blunted to this half-width so they survive handling
  const n = spine.length - 1;
  const ds = spine[1].s - spine[0].s;
  const wl = [];
  const wr = [];
  const kap = [];
  for (let i = 0; i <= n; i++) {
    const k = (spine[Math.min(n, i + 1)].h - spine[Math.max(0, i - 1)].h) / ((Math.min(n, i + 1) - Math.max(0, i - 1)) * ds);
    let [a, b] = half(spine[i].u);
    a = Math.max(tip, a);
    b = Math.max(tip, b);
    // on the inside of a bend the edge must stay clear of the centre of curvature
    if (k > 1e-6) a = Math.min(a, 0.8 / k);
    if (k < -1e-6) b = Math.min(b, 0.8 / -k);
    wl.push(a);
    wr.push(b);
    kap.push(k);
  }
  const at = (i, d) => [spine[i].x - Math.sin(spine[i].h) * d, spine[i].y + Math.cos(spine[i].h) * d];
  // stop at the deck
  let end = n;
  if (o.clipY !== undefined) {
    for (let i = 0; i <= n; i++) {
      if (at(i, wl[i])[1] > o.clipY || at(i, -wr[i])[1] > o.clipY) { end = i - 1; break; }
    }
  }
  if (end < 4) return [];
  const outline = (a, b) => {
    const pts = [];
    for (let i = a; i <= b; i++) pts.push(at(i, wl[i]));
    for (let i = b; i >= a; i--) pts.push(at(i, -wr[i]));
    return pts;
  };
  // split along the spine into pieces that each fit a sheet, as evenly as possible
  const fits = (a, b) => fitsSheet(outline(a, b), o.L, o.S);
  let count = 1;
  let cutsAt = null;
  for (; count <= 12 && !cutsAt; count++) {
    const marks = Array.from({ length: count + 1 }, (_, k) => Math.round((end * k) / count));
    if (marks.every((m, k) => !k || fits(marks[k - 1] + (k > 1 ? 1 : 0), m))) cutsAt = marks;
  }
  if (!cutsAt) return [];

  // ribbon coordinates -> flat coordinates
  const P = (s, d) => {
    const f = clamp(s / ds, 0, n);
    const i = Math.min(n - 1, Math.floor(f));
    const t = f - i;
    const h = lerp(spine[i].h, spine[i + 1].h, t);
    return [lerp(spine[i].x, spine[i + 1].x, t) - Math.sin(h) * d, lerp(spine[i].y, spine[i + 1].y, t) + Math.cos(h) * d];
  };
  const W = (arr, s) => {
    const f = clamp(s / ds, 0, n);
    const i = Math.min(n - 1, Math.floor(f));
    return lerp(arr[i], arr[i + 1], f - i);
  };
  // a shape given in ribbon coordinates, with each edge followed along the curve
  const shape = (corners, side = 1) => corners.flatMap(([sA, dA], i) => {
    const [sB, dB] = corners[(i + 1) % corners.length];
    return [0, 1, 2, 3].map((j) => P(lerp(sA, sB, j / 4), side * lerp(dA, dB, j / 4)));
  });
  const rim = Math.max(o.rim, o.web);
  const motif = o.motif || 'vein';
  const out = [];

  cutsAt.slice(1).forEach((b, k) => {
    const a = cutsAt[k] + (k ? 1 : 0);
    const points = outline(a, b);
    const cuts = [];
    const holes = [];
    const etchLines = [];
    const sa = a * ds;
    const sb = b * ds;
    const endM = Math.max(rim, 90); // each end stays solid: strength, and room for the part number
    const s0 = sa + endM;
    const s1 = sb - endM;
    let widest = 0;
    let kMax = 0;
    let narrow = Infinity;
    for (let i = a; i <= b; i++) {
      widest = Math.max(widest, wl[i], wr[i]);
      kMax = Math.max(kMax, Math.abs(kap[i]));
      narrow = Math.min(narrow, wl[i] + wr[i]);
    }
    // on the inside of a bend, distances along the ribbon shrink: widen the webs to compensate
    const squeeze = Math.max(0.2, 1 - kMax * widest);
    const webS = o.web / squeeze;
    const room = (s, side) => W(side > 0 ? wl : wr, s) - rim; // how far a cut may reach on that side

    if (motif !== 'solid' && s1 - s0 > o.minSlot * 2) {
      if (motif === 'window') {
        const lo = [];
        const hi = [];
        for (let s = s0; s <= s1 + 1e-6; s += Math.min(ds, (s1 - s0) / 6)) {
          if (room(s, 1) + room(s, -1) < o.minSlot) continue;
          hi.push(P(s, Math.max(0, room(s, 1))));
          lo.push(P(s, -Math.max(0, room(s, -1))));
        }
        if (hi.length >= 3) cuts.push([...hi, ...lo.reverse()]);
      } else if (motif === 'eyes') {
        let s = s0;
        while (s < s1) {
          let r = Math.min(room(s, 1), room(s, -1), 260);
          // the hole must clear the rim along its whole length, not just where it starts
          for (let it = 0; it < 4; it++) r = Math.min(r, room(s + r, 1), room(s + r, -1), room(s + 2 * r, 1) + r * 0.5, room(s + 2 * r, -1) + r * 0.5);
          r *= 0.92;
          if (r < o.minHoleR) { s += ds; continue; }
          const c = P(s + r, 0);
          if (s + 2 * r <= s1) holes.push({ x: c[0], y: c[1], r: r * Math.min(1, squeeze + 0.25), kind: 'bubble' });
          s += 2 * r + webS;
        }
      } else if (motif === 'ribs') {
        const slot = Math.max(o.minSlot, lerp(110, 46, o.detail));
        for (let s = s0; s + slot <= s1; s += slot + webS) {
          const q = [[s, 1], [s + slot, 1], [s + slot, -1], [s, -1]].map(([ss, side]) => [ss, side * Math.max(0, room(ss, side))]);
          if (Math.min(q[0][1] - q[3][1], q[1][1] - q[2][1]) >= o.minSlot) cuts.push(shape(q));
        }
      } else if (motif === 'lanes') {
        // long lens-shaped slots that follow the curve, staggered lane to lane
        const span = (s) => Math.max(0, room(s, 1)) + Math.max(0, room(s, -1));
        const mid = (s0 + s1) / 2;
        const lanes = clamp(Math.floor((span(mid) + o.web) / (Math.max(o.minSlot, 60) + o.web)), 1, 1 + Math.round(o.detail * 2));
        const len = clamp(widest * 2.6, 260, 760);
        for (let l = 0; l < lanes; l++) {
          for (let s = s0 + (l % 2 ? len / 2 : 0); s + len * 0.6 <= s1; s += len + webS) {
            let e = Math.min(s + len, s1);
            // only run the slot where the ribbon is wide enough to hold it
            let b0 = s;
            while (b0 < e && span(b0) < o.minSlot * 1.5) b0 += ds / 2;
            while (e > b0 && span(e) < o.minSlot * 1.5) e -= ds / 2;
            if (e - b0 < o.minSlot * 3) continue;
            const hi = [];
            const lo = [];
            const steps = Math.max(6, Math.round((e - b0) / ds));
            let wide = 0;
            for (let j = 0; j <= steps; j++) {
              const ss = lerp(b0, e, j / steps);
              const full = span(ss);
              const lane = Math.max(0, (full - (lanes - 1) * o.web) / lanes);
              const base = -Math.max(0, room(ss, -1)) + l * (lane + o.web);
              const bulge = Math.sin((Math.PI * j) / steps) ** 0.6; // pointed ends
              const c = base + lane / 2;
              const hw = Math.max(0, (lane / 2) * bulge);
              wide = Math.max(wide, 2 * hw);
              hi.push(P(ss, c + hw));
              lo.push(P(ss, c - hw));
            }
            if (wide >= o.minSlot) cuts.push([...hi, ...lo.reverse().slice(1, -1)]);
          }
        }
      } else {
        // vein: a solid midrib with barbs raking toward the tip, like a feather or a leaf
        const rib = Math.max(o.web / 2, widest * 0.07);
        const slot = Math.max(o.minSlot, lerp(120, 50, o.detail));
        const rake = 0.75;
        const pitch = slot + webS * 1.3;
        for (const side of [1, -1]) {
          for (let s = s0; s <= s1; s += pitch) {
            let reach = room(s, side);
            for (let it = 0; it < 4; it++) reach = Math.min(reach, room(s + rake * Math.max(0, reach - rib), side), room(s + slot + rake * Math.max(0, reach - rib), side));
            if (reach - rib < o.minSlot) continue;
            const q = [[s, rib], [s + slot, rib], [s + slot + rake * (reach - rib), reach], [s + rake * (reach - rib), reach]];
            // the raked outer end must still be inside the rim where it lands
            const ok = q.every(([ss, d]) => ss >= s0 - 1 && ss <= s1 + 1 && d <= room(ss, side) + 0.5);
            if (ok) cuts.push(shape(q, side));
          }
        }
      }
    }

    // etch: lines that run with the edges, and along the midrib
    if (o.etch) {
      const run = (dOf) => {
        let prev = null;
        for (let s = sa + 30; s <= sb - 30; s += ds) {
          const d = dOf(s);
          const q = d === null ? null : P(s, d);
          if (prev && q) etchLines.push([prev, q]);
          prev = q;
        }
      };
      for (const side of [1, -1]) run((s) => (W(side > 0 ? wl : wr, s) > rim * 1.3 ? side * (W(side > 0 ? wl : wr, s) - rim * 0.45) : null));
      if (motif === 'vein' || motif === 'solid') run(() => 0);
    }

    out.push({ points, cuts, holes, etch: [], etchLines, label: P(sa + endM * 0.5, 0), minWidth: narrow, rim, u: spine[Math.round((a + b) / 2)].u });
  });
  return out;
}
