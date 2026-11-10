// Pattern library: fills a convex region with convex cutouts (and round holes).
// The same patterns serve as fretwork (cut through, with a web of material kept
// between every opening) and as etch detail (outlines only).
//
// Every generator works in a local frame: origin at the region's centre, rotated
// by `ang`, and returns shapes that are at least `gap` apart by construction.

import { lerp, clipHalf, edgesOf, deeper, insetConvex, centroid, area } from './convex.js';

const TAU = Math.PI * 2;

export const PATTERNS = {
  voronoi: 'Voronoi',
  honeycomb: 'Honeycomb',
  crackle: 'Crackle',
  triangles: 'Sierpinski',
  truchet: 'Truchet',
  diamonds: 'Diamonds',
  bricks: 'Bricks',
  maze: 'Maze',
  pixels: 'Pixels',
  waves: 'Waves',
  arcs: 'Ring slots',
  bloom: 'Bloom',
  lens: 'Lens weave',
  scales: 'Fish scales',
  sunflower: 'Sunflower',
};

const arc = (cx, cy, r, a0, a1, n) => Array.from({ length: n + 1 }, (_, i) => [cx + r * Math.cos(lerp(a0, a1, i / n)), cy + r * Math.sin(lerp(a0, a1, i / n))]);

// A pointed lens centred on (cx, cy): half-length h along direction `dir`, half-width b.
function lensShape(cx, cy, h, b, dir) {
  const R = (h * h + b * b) / (2 * b);
  const half = Math.asin(Math.min(1, h / R));
  const pts = [...arc(0, -(R - b), R, Math.PI / 2 + half, Math.PI / 2 - half, 6), ...arc(0, R - b, R, -Math.PI / 2 + half, -Math.PI / 2 - half, 6).slice(1, -1)];
  const c = Math.cos(dir);
  const s = Math.sin(dir);
  return pts.map(([x, y]) => [cx + x * c - y * s, cy + x * s + y * c]);
}

const GEN = {
  honeycomb({ pitch, inset, reach }, out) {
    const n = Math.ceil(reach / pitch) + 1;
    for (let a = -n; a <= n; a++) {
      for (let b = -n; b <= n; b++) {
        const x = (a + (b % 2 ? 0.5 : 0)) * pitch;
        const y = b * pitch * 0.866;
        out.cell(arc(x, y, pitch / Math.sqrt(3), Math.PI / 6, Math.PI / 6 + TAU, 6).slice(0, 6), inset);
      }
    }
  },

  bricks({ pitch, inset, reach }, out) {
    const w = pitch * 1.5;
    const h = pitch * 0.62;
    const n = Math.ceil(reach / h) + 1;
    for (let b = -n; b <= n; b++) {
      for (let a = -n; a <= n; a++) {
        const x = (a + (b % 2 ? 0.5 : 0)) * w;
        out.cell([[x, b * h], [x + w, b * h], [x + w, b * h + h], [x, b * h + h]], inset);
      }
    }
  },

  diamonds({ pitch, inset, reach }, out) {
    const w = pitch;
    const h = pitch * 1.6;
    const n = Math.ceil(reach / w) + 1;
    for (let b = -2 * n; b <= 2 * n; b++) {
      for (let a = -n; a <= n; a++) {
        const x = (a + (b % 2 ? 0.5 : 0)) * w;
        const y = (b * h) / 2;
        out.cell([[x - w / 2, y], [x, y - h / 2], [x + w / 2, y], [x, y + h / 2]], inset);
      }
    }
  },

  // Each big triangle has its middle cut out, then the three corners repeat the idea.
  triangles({ pitch, inset, reach }, out) {
    const T = pitch * 4;
    const H = T * 0.866;
    const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const rec = (A, B, C) => {
      const [ab, bc, ca] = [mid(A, B), mid(B, C), mid(C, A)];
      out.cell([ab, bc, ca], inset);
      if (Math.hypot(ab[0] - bc[0], ab[1] - bc[1]) < pitch * 1.5) return;
      rec(A, ab, ca);
      rec(ab, B, bc);
      rec(ca, bc, C);
    };
    const n = Math.ceil(reach / H) + 1;
    for (let b = -n; b <= n; b++) {
      for (let a = -n; a <= n; a++) {
        const x = (a + (b % 2 ? 0.5 : 0)) * T;
        const y = b * H;
        rec([x, y], [x + T, y], [x + T / 2, y + H]);
        rec([x + T / 2, y + H], [x + T, y], [x + (T * 3) / 2, y + H]);
      }
    }
  },

  // Square tiles, each split along one of its two diagonals.
  truchet({ pitch, inset, reach, rng }, out) {
    const n = Math.ceil(reach / pitch) + 1;
    for (let a = -n; a < n; a++) {
      for (let b = -n; b < n; b++) {
        const [x0, y0, x1, y1] = [a * pitch, b * pitch, (a + 1) * pitch, (b + 1) * pitch];
        if (rng() < 0.5) {
          out.cell([[x0, y0], [x1, y0], [x0, y1]], inset);
          out.cell([[x1, y0], [x1, y1], [x0, y1]], inset);
        } else {
          out.cell([[x0, y0], [x1, y0], [x1, y1]], inset);
          out.cell([[x0, y0], [x1, y1], [x0, y1]], inset);
        }
      }
    }
  },

  // Random straight breaks, like shattered glass.
  crackle({ pitch, inset, rng, region }, out) {
    const rec = (poly, depth) => {
      if (poly.length < 3) return;
      if (area(poly) < pitch * pitch * 1.3 || depth > 9) return out.cell(poly, inset);
      const c = centroid(poly);
      const far = poly.reduce((m, q) => (Math.hypot(q[0] - c[0], q[1] - c[1]) > Math.hypot(m[0] - c[0], m[1] - c[1]) ? q : m));
      // break roughly across the longest direction
      const ang = Math.atan2(far[1] - c[1], far[0] - c[0]) + (rng() - 0.5) * 1.1;
      const [nx, ny] = [Math.cos(ang), Math.sin(ang)];
      const k = nx * c[0] + ny * c[1] + (rng() - 0.5) * pitch * 0.5;
      rec(clipHalf(poly, nx, ny, k), depth + 1);
      rec(clipHalf(poly, -nx, -ny, -k), depth + 1);
    };
    rec(region, 0);
  },

  voronoi({ pitch, inset, reach, rng }, out) {
    const n = Math.min(7, Math.ceil(reach / pitch) + 1);
    const sites = [];
    for (let a = -n; a <= n; a++) {
      for (let b = -n; b <= n; b++) sites.push([(a + (b % 2 ? 0.5 : 0) + (rng() - 0.5) * 0.75) * pitch, (b * 0.866 + (rng() - 0.5) * 0.75) * pitch]);
    }
    for (const s of sites) {
      if (Math.hypot(s[0], s[1]) > reach + pitch) continue;
      const d = pitch * 2.2;
      let cell = [[s[0] - d, s[1] - d], [s[0] + d, s[1] - d], [s[0] + d, s[1] + d], [s[0] - d, s[1] + d]];
      for (const t of sites) {
        if (t === s || cell.length < 3) continue;
        const [nx, ny] = [t[0] - s[0], t[1] - s[1]];
        if (Math.hypot(nx, ny) > pitch * 4.5) continue;
        cell = clipHalf(cell, nx, ny, (nx * (s[0] + t[0]) + ny * (s[1] + t[1])) / 2);
      }
      out.cell(cell, inset);
    }
  },

  // Walls of a random maze, each wall a slot that stops short of the junctions.
  maze({ pitch, gap, reach, rng }, out) {
    pitch = Math.max(pitch * 1.15, gap * 4);
    const n = Math.min(9, Math.ceil(reach / pitch) + 1);
    const N = 2 * n;
    const sw = pitch * 0.26;
    const len = pitch - sw - gap * 1.5;
    if (len < sw * 0.8) return;
    const seen = new Set([0]);
    const open = new Set();
    const stack = [0];
    while (stack.length) {
      const cur = stack[stack.length - 1];
      const [i, j] = [cur % N, Math.floor(cur / N)];
      const next = [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]].filter(([a, b]) => a >= 0 && b >= 0 && a < N && b < N && !seen.has(b * N + a));
      if (!next.length) { stack.pop(); continue; }
      const [a, b] = next[Math.floor(rng() * next.length)];
      seen.add(b * N + a);
      open.add(`${Math.min(cur, b * N + a)}:${Math.max(cur, b * N + a)}`);
      stack.push(b * N + a);
    }
    const rect = (cx, cy, w, h) => out.cell([[cx - w / 2, cy - h / 2], [cx + w / 2, cy - h / 2], [cx + w / 2, cy + h / 2], [cx - w / 2, cy + h / 2]], 0);
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const id = j * N + i;
        const [x, y] = [(i - n) * pitch, (j - n) * pitch];
        if (i + 1 < N && !open.has(`${id}:${id + 1}`)) rect(x + pitch, y + pitch / 2, sw, len);
        if (j + 1 < N && !open.has(`${id}:${id + N}`)) rect(x + pitch / 2, y + pitch, len, sw);
      }
    }
  },

  // A few generations of Conway's Life, each live cell a square opening.
  pixels({ pitch, inset, reach, rng }, out) {
    const s = pitch * 0.62;
    const n = Math.min(14, Math.ceil(reach / s) + 1);
    const N = 2 * n;
    let grid = Array.from({ length: N * N }, () => rng() < 0.42);
    const at = (g, i, j) => (i >= 0 && j >= 0 && i < N && j < N && g[j * N + i] ? 1 : 0);
    for (let gen = 0; gen < 2; gen++) {
      grid = grid.map((alive, id) => {
        const [i, j] = [id % N, Math.floor(id / N)];
        let k = 0;
        for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) if (a || b) k += at(grid, i + a, j + b);
        return alive ? k === 2 || k === 3 : k === 3;
      });
    }
    grid.forEach((alive, id) => {
      if (!alive) return;
      const [x, y] = [((id % N) - n) * s, (Math.floor(id / N) - n) * s];
      out.cell([[x, y], [x + s, y], [x + s, y + s], [x, y + s]], inset);
    });
  },

  // Parallel wavy bands, cut as runs of slanted slots.
  waves({ pitch, gap, reach, rng }, out) {
    const amp = pitch * 0.5;
    const wave = pitch * 4.6; // keeps the slope gentle, so bands stay a web apart
    const phase = rng() * TAU;
    const f = (x) => amp * Math.sin((x / wave) * TAU + phase);
    const slot = pitch * 0.5;
    const bar = Math.max(gap / 0.82, pitch * 0.42);
    const seg = wave / 6;
    const rows = Math.ceil((reach + amp) / (slot + bar)) + 1;
    const cols = Math.ceil(reach / seg) + 1;
    for (let r = -rows; r <= rows; r++) {
      const y = r * (slot + bar);
      for (let k = -cols; k < cols; k++) {
        const x0 = k * seg + gap / 2;
        const x1 = (k + 1) * seg - gap / 2;
        if (x1 - x0 < slot * 0.6) continue;
        out.cell([[x0, y + f(x0)], [x1, y + f(x1)], [x1, y + f(x1) + slot], [x0, y + f(x0) + slot]], 0);
      }
    }
  },

  // Concentric rings of curved slots, bridged between segments.
  arcs({ pitch, gap, reach, minR }, out) {
    const slot = pitch * 0.45;
    const bar = Math.max(gap, pitch * 0.3);
    const r0 = Math.max(minR, pitch * 0.32);
    out.hole(0, 0, r0);
    let ring = 0;
    for (let rIn = r0 + bar; rIn < reach; rIn += slot + bar, ring++) {
      const n = Math.max(6, Math.round((TAU * rIn) / (pitch * 1.8)));
      const step = TAU / n;
      const pad = gap / rIn / 2;
      if (step - 2 * pad < 0.05) continue;
      for (let k = 0; k < n; k++) {
        const a0 = (k + (ring % 2) / 2) * step + pad;
        const a1 = a0 + step - 2 * pad;
        const ri = rIn / Math.cos((a1 - a0) / 2); // inner chord just touches the inner radius
        if (ri > rIn + slot * 0.6) continue;
        out.cell([[ri * Math.cos(a0), ri * Math.sin(a0)], ...arc(0, 0, rIn + slot, a0, a1, 5), [ri * Math.cos(a1), ri * Math.sin(a1)]], 0);
      }
    }
  },

  // Rings of radial lens-shaped petals around a centre hole.
  bloom({ pitch, gap, reach, minR }, out) {
    const r0 = Math.max(minR, pitch * 0.3);
    out.hole(0, 0, r0);
    const len = pitch * 1.15;
    let ring = 0;
    for (let rIn = r0 + gap; rIn < reach; rIn += len + gap, ring++) {
      const rm = rIn + len / 2;
      const n = Math.max(5, Math.floor((TAU * rm) / (pitch * 0.62 + gap)));
      const s = Math.sin(Math.PI / n);
      let b = Math.min(len * 0.36, rm * s - gap / 2);
      if (b > 4) b -= (s * s * len * len) / (16 * b); // the rays converge inward faster than the lens narrows
      if (b < 6) continue;
      for (let k = 0; k < n; k++) {
        const a = ((k + (ring % 2) / 2) / n) * TAU;
        out.cell(lensShape(rm * Math.cos(a), rm * Math.sin(a), len / 2, b, a), 0);
      }
    }
  },

  // Lenses alternating across and along, like a basket weave.
  lens({ pitch, gap, reach }, out) {
    const p = pitch * 0.85;
    const l = Math.min(1.3 * p, (p - gap) / 0.69);
    if (l < p * 0.4) return;
    const n = Math.ceil(reach / p) + 1;
    for (let a = -n; a <= n; a++) {
      for (let b = -n; b <= n; b++) out.cell(lensShape(a * p, b * p, l / 2, l * 0.19, (a + b) % 2 ? Math.PI / 2 : 0), 0);
    }
  },

  // Rows of half-rounds, each row offset over the gaps of the last.
  scales({ pitch, gap, reach }, out) {
    const r = (pitch - gap) / 2;
    if (r < 8) return;
    const dy = Math.sqrt((r + gap) ** 2 - (gap / 2) ** 2);
    const n = Math.ceil(reach / dy) + 1;
    for (let b = -n; b <= n; b++) {
      for (let a = -n; a <= n; a++) out.cell(arc((a + (b % 2 ? 0.5 : 0)) * pitch, b * dy, r, Math.PI, TAU, 8), 0);
    }
  },

  // Round holes on a sunflower spiral, growing outward.
  sunflower({ pitch, gap, reach, minR }, out) {
    const rMax = Math.max(minR, pitch * 0.3);
    const c = (2 * rMax + gap) / 1.9;
    const placed = [];
    for (let i = 0; i < 900; i++) {
      const d = c * Math.sqrt(i + 0.5);
      if (d > reach) break;
      const a = i * 2.39996323;
      const r = Math.max(minR, rMax * lerp(0.55, 1, Math.min(1, d / (reach * 0.8))));
      const [x, y] = [d * Math.cos(a), d * Math.sin(a)];
      if (placed.some((h) => Math.hypot(h.x - x, h.y - y) < h.r + r + gap)) continue;
      placed.push({ x, y, r });
      out.hole(x, y, r);
    }
  },
};

// Fill convex region R. o: { pitch, gap, inset (default gap/2), minR, rng, ang }.
// Returns { polys, holes } in R's own coordinates.
export function patternCells(kind, R, o) {
  const gen = GEN[kind];
  const res = { polys: [], holes: [] };
  if (!gen || R.length < 3) return res;
  const c = centroid(R);
  const [ca, sa] = [Math.cos(o.ang || 0), Math.sin(o.ang || 0)];
  const toLocal = ([x, y]) => [(x - c[0]) * ca + (y - c[1]) * sa, -(x - c[0]) * sa + (y - c[1]) * ca];
  const toWorld = ([x, y]) => [c[0] + x * ca - y * sa, c[1] + x * sa + y * ca];
  const region = R.map(toLocal);
  const edges = edgesOf(region);
  const reach = Math.max(...region.map((q) => Math.hypot(q[0], q[1])));
  const minR = o.minR || 0;
  const out = {
    cell(poly, inset) {
      if (poly.length < 3) return;
      const m = centroid(poly);
      const far = Math.max(...poly.map((q) => Math.hypot(q[0] - m[0], q[1] - m[1])));
      const depth = edges.reduce((d, e) => Math.min(d, e.nx * m[0] + e.ny * m[1] - e.c), Infinity);
      if (depth < -far) return; // wholly outside
      let q = inset > 0 ? insetConvex(poly, inset) : poly;
      if (!q) return;
      if (depth < far) {
        for (const e of edges) {
          q = deeper(q, e, 0);
          if (q.length < 3) return;
        }
      }
      if (area(q) > 1) res.polys.push(q.map(toWorld));
    },
    hole(x, y, r) {
      if (r >= minR && r > 0 && edges.every((e) => e.nx * x + e.ny * y - e.c >= r)) {
        const [wx, wy] = toWorld([x, y]);
        res.holes.push({ x: wx, y: wy, r });
      }
    },
  };
  gen({ pitch: o.pitch, gap: o.gap, inset: o.inset ?? o.gap / 2, minR, rng: o.rng, reach, region }, out);
  return res;
}
