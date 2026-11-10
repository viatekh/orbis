// Convex polygon helpers. Panels and cutouts are convex, which keeps clipping and insetting exact.

import { signedArea } from './fabrication.js';

export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const area = (pts) => Math.abs(signedArea(pts));
export const perimeter = (pts) => pts.reduce((s, p, i) => s + Math.hypot(p[0] - pts[(i + 1) % pts.length][0], p[1] - pts[(i + 1) % pts.length][1]), 0);
export const centroid = (pts) => [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];

// Keep the part of a convex polygon where nx*x + ny*y <= c.
export function clipHalf(poly, nx, ny, c) {
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
export function edgesOf(poly) {
  const sgn = Math.sign(signedArea(poly)) || 1;
  return poly.map((a, i) => {
    const b = poly[(i + 1) % poly.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const nx = (-sgn * (b[1] - a[1])) / len;
    const ny = (sgn * (b[0] - a[0])) / len;
    return { nx, ny, c: nx * a[0] + ny * a[1] };
  });
}
export const deeper = (poly, e, d) => clipHalf(poly, -e.nx, -e.ny, -(e.c + d)); // keep depth >= d
export const shallower = (poly, e, d) => clipHalf(poly, e.nx, e.ny, e.c + d); // keep depth <= d
export const solid = (poly) => (poly.length >= 3 && area(poly) > 1 ? poly : null);

export function insetConvex(poly, d) {
  let out = poly;
  for (const e of edgesOf(poly)) {
    out = deeper(out, e, d);
    if (out.length < 3) return null;
  }
  return solid(out);
}

// Depth of a point inside a convex polygon (negative outside).
export function insideBy(poly, x, y) {
  return edgesOf(poly).reduce((m, e) => Math.min(m, e.nx * x + e.ny * y - e.c), Infinity);
}
export const inradius = (poly) => insideBy(poly, ...centroid(poly));

export function segDist(x, y, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const t = clamp(((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  return Math.hypot(x - a[0] - dx * t, y - a[1] - dy * t);
}
