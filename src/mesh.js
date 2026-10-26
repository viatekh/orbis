// 3D-print output: polygon-with-holes triangulation and a binary STL relief.

import { signedArea, withPins, alignmentHoles } from './fabrication.js';

const TAU = Math.PI * 2;
const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
const same = (a, b) => a[0] === b[0] && a[1] === b[1];

function segmentsCross(p1, p2, q1, q2) {
  if (same(p1, q1) || same(p1, q2) || same(p2, q1) || same(p2, q2)) return false;
  const d1 = cross(q1, q2, p1);
  const d2 = cross(q1, q2, p2);
  const d3 = cross(p1, p2, q1);
  const d4 = cross(p1, p2, q2);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

// Splice each hole into the outer ring through a bridge to the nearest visible vertex.
function mergeHoles(outer, holes) {
  let ring = outer.slice();
  const pending = holes.slice().sort((a, b) => Math.max(...b.map((p) => p[0])) - Math.max(...a.map((p) => p[0])));
  while (pending.length) {
    const hole = pending.shift();
    let mi = 0;
    for (let i = 1; i < hole.length; i++) if (hole[i][0] > hole[mi][0]) mi = i;
    const M = hole[mi];
    const order = ring.map((p, i) => [Math.hypot(p[0] - M[0], p[1] - M[1]), i]).sort((a, b) => a[0] - b[0]);
    let bridge = order[0][1];
    for (const [, i] of order) {
      const P = ring[i];
      let ok = true;
      const edgesOf = (poly) => {
        for (let j = 0; j < poly.length && ok; j++) if (segmentsCross(M, P, poly[j], poly[(j + 1) % poly.length])) ok = false;
      };
      edgesOf(ring);
      edgesOf(hole);
      for (const h of pending) edgesOf(h);
      if (ok) {
        bridge = i;
        break;
      }
    }
    const rotated = hole.slice(mi).concat(hole.slice(0, mi));
    ring = ring.slice(0, bridge + 1).concat(rotated, [M], ring.slice(bridge));
  }
  return ring;
}

// Ear clipping. Returns triangles as index triples into the returned points.
export function triangulate(outer, holes = []) {
  const o = signedArea(outer) < 0 ? outer.slice().reverse() : outer;
  const hs = holes.map((h) => (signedArea(h) > 0 ? h.slice().reverse() : h));
  const pts = mergeHoles(o, hs);
  const n = pts.length;
  const prev = new Int32Array(n);
  const next = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    prev[i] = (i + n - 1) % n;
    next[i] = (i + 1) % n;
  }
  const tris = [];
  const convex = (i) => cross(pts[prev[i]], pts[i], pts[next[i]]) > 1e-12;
  const isEar = (i) => {
    const a = pts[prev[i]];
    const b = pts[i];
    const c = pts[next[i]];
    if (cross(a, b, c) <= 1e-12) return false;
    for (let j = next[next[i]]; j !== prev[i]; j = next[j]) {
      const p = pts[j];
      if (same(p, a) || same(p, b) || same(p, c) || convex(j)) continue;
      if (cross(a, b, p) >= 0 && cross(b, c, p) >= 0 && cross(c, a, p) >= 0) return false;
    }
    return true;
  };
  let count = n;
  let i = 0;
  let fails = 0;
  while (count > 3) {
    if (isEar(i) || fails > count) {
      if (cross(pts[prev[i]], pts[i], pts[next[i]]) > 0) tris.push(prev[i], i, next[i]);
      next[prev[i]] = next[i];
      prev[next[i]] = prev[i];
      count--;
      fails = 0;
      i = prev[i];
    } else {
      i = next[i];
      fails++;
    }
  }
  if (cross(pts[prev[i]], pts[i], pts[next[i]]) > 0) tris.push(prev[i], i, next[i]);
  return { pts, tris };
}

const circle = (cx, cy, r) => {
  const n = Math.max(12, Math.min(64, Math.round((TAU * r) / 0.6)));
  return Array.from({ length: n }, (_, i) => [cx + r * Math.cos((i / n) * TAU), cy + r * Math.sin((i / n) * TAU)]);
};

function arcBand(r, w, a0, a1) {
  const n = Math.max(8, Math.ceil(((a1 - a0) * r) / 1.5));
  const outer = [];
  const inner = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    outer.push([(r + w / 2) * Math.cos(a), (r + w / 2) * Math.sin(a)]);
    inner.push([(r - w / 2) * Math.cos(a), (r - w / 2) * Math.sin(a)]);
  }
  return outer.concat(inner.reverse());
}

// Closed prism between z0 and z1 for a polygon with holes; pushes [a, b, c] vertex triples.
function extrude(out, outer, holes, z0, z1) {
  const o = signedArea(outer) < 0 ? outer.slice().reverse() : outer;
  const hs = holes.map((h) => (signedArea(h) > 0 ? h.slice().reverse() : h));
  const { pts, tris } = triangulate(o, hs);
  for (let i = 0; i < tris.length; i += 3) {
    const [a, b, c] = [pts[tris[i]], pts[tris[i + 1]], pts[tris[i + 2]]];
    out.push([[...a, z1], [...b, z1], [...c, z1]]);
    out.push([[...a, z0], [...c, z0], [...b, z0]]);
  }
  for (const ring of [o, ...hs]) {
    for (let i = 0; i < ring.length; i++) {
      const p = ring[i];
      const q = ring[(i + 1) % ring.length];
      out.push([[...p, z0], [...q, z0], [...q, z1]]);
      out.push([[...p, z0], [...q, z1], [...p, z1]]);
    }
  }
}

// Y is flipped so the print matches the on-screen view from above. Bodies share one
// origin, so loading them together in a slicer keeps them registered (multi-colour).
export function buildBodies(rawDesign, fab) {
  const design = withPins(rawDesign, fab);
  const bodies = { base: [], rings: [], traces: [] };
  const flip = (pts) => pts.map(([x, y]) => [x, -y]);
  const base = fab.stlBase ? Math.max(0.6, fab.thickness) : 0;
  const R = design.stats.outerDiameter / 2;

  if (fab.stlBase) {
    const holes = fab.mounting ? alignmentHoles(design, fab).map((h) => circle(h.x, -h.y, h.r)) : [];
    extrude(bodies.base, circle(0, 0, R + fab.border), holes, 0, base);
    // pegs under every pin hole so separately printed rings snap into place
    for (const part of design.parts) {
      for (const h of part.holes) {
        if (h.kind === 'pin') extrude(bodies.base, circle(h.x, -h.y, h.r - 0.15), [], base, base + Math.max(0.8, fab.relief * 0.8));
      }
    }
  }
  for (const part of design.parts) {
    const h = Math.max(0.4, fab.relief + fab.ringStep * part.ring);
    extrude(bodies.rings, flip(part.points), part.holes.map((c) => circle(c.x, -c.y, c.r)), base, base + h);
  }
  if (fab.engrave) {
    const w = Math.max(0.8, fab.tool * 2.5);
    const h = Math.max(0.4, fab.relief * 0.35);
    for (const hl of design.hairlines) {
      extrude(bodies.traces, flip(arcBand(hl.r, w, hl.a0, hl.a1)), [], base, base + h);
      for (const d of hl.pads) extrude(bodies.traces, circle(d.x, -d.y, Math.max(d.r, w)), [], base, base + h);
    }
  }
  return bodies;
}

export function buildMesh(design, fab) {
  const b = buildBodies(design, fab);
  return [...b.base, ...b.rings, ...b.traces];
}

export function toSTL(design, fab, body = null) {
  const tris = body ? buildBodies(design, fab)[body] : buildMesh(design, fab);
  const buf = new ArrayBuffer(84 + tris.length * 50);
  const dv = new DataView(buf);
  const header = 'Orbis circular circuit relief (mm)';
  for (let i = 0; i < header.length; i++) dv.setUint8(i, header.charCodeAt(i));
  dv.setUint32(80, tris.length, true);
  let off = 84;
  for (const [a, b, c] of tris) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len; ny /= len; nz /= len;
    for (const v of [nx, ny, nz, ...a, ...b, ...c]) {
      dv.setFloat32(off, v, true);
      off += 4;
    }
    dv.setUint16(off, 0, true);
    off += 2;
  }
  return { buffer: buf, triangles: tris.length };
}
