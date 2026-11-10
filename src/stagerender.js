// Stage drawing. Every panel is a flat shape placed in 3D, so one painter's-order
// projection gives the front elevation (yaw = pitch = 0) and the orbit view alike.
// Units are mm; ground is y = 0, y points down, z points at the audience.

import { paletteColor } from './render.js';
import { world } from './stage.js';

export const STAGE_MODES = { night: 'Night', day: 'Day', setout: 'Setting-out' };

const f0 = (n) => Math.round(n).toString();
const m1 = (mm) => (Math.round(mm / 100) / 10).toFixed(1);
const DEG = Math.PI / 180;

const THEMES = {
  night: { sky: '#07090d', ground: '#0d1014', deck: '#14181d', deckLine: '#262c33', ink: '#aab4bd', truss: '#2a3037', figure: '#1f252b' },
  day: { sky: '#dfe7ea', ground: '#b9c2bd', deck: '#2b2f33', deckLine: '#4a5056', ink: '#39424a', truss: '#7f8890', figure: '#3c444b' },
  setout: { sky: '#fbfbf8', ground: '#e9e9e2', deck: '#ffffff', deckLine: '#9aa0a6', ink: '#16181c', truss: '#b4bac0', figure: '#c9ced3' },
};
export const skyColor = (mode) => (THEMES[mode] || THEMES.night).sky;

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const shade = (hex, k) => `rgb(${rgb(hex).map((v) => Math.round(Math.min(255, v * k))).join(',')})`;

// Rotate about a pivot: yaw around the vertical axis, then pitch (positive looks down from above).
function camera(yaw, pitch, pivotY) {
  const cy = Math.cos(yaw * DEG);
  const sy = Math.sin(yaw * DEG);
  const cp = Math.cos(pitch * DEG);
  const sp = Math.sin(pitch * DEG);
  const spin = ([x, y, z]) => {
    const x1 = x * cy + z * sy;
    const z1 = -x * sy + z * cy;
    return [x1, y * cp + z1 * sp, -y * sp + z1 * cp];
  };
  return {
    point: ([x, y, z]) => {
      const [a, b, c] = spin([x, y - pivotY, z]);
      return [a, b + pivotY, c];
    },
    dir: spin,
  };
}

const pathOf = (pts) => 'M' + pts.map(([x, y]) => `${f0(x)} ${f0(y)}`).join('L') + 'Z';
const circle = (h, n = 14) => Array.from({ length: n }, (_, i) => [h.x + h.r * Math.cos((i * 2 * Math.PI) / n), h.y + h.r * Math.sin((i * 2 * Math.PI) / n)]);
const LIGHT = [-0.35, -0.55, 0.76];

// Depth-sorted SVG for a set of panels (shared by the stage view and the source preview).
export function panelsMarkup(parts, cam, { mode, palette, mat, backlit, draft = false }) {
  const ns = 'vector-effect="non-scaling-stroke"';
  const items = parts.map((pt) => {
    const place = (q) => cam.point(world(pt, q));
    const outline = pt.points.map(place);
    const { u, v } = pt.frame;
    const n = cam.dir([u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]);
    const lit = 0.62 + 0.38 * Math.abs(n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]);
    let d = pathOf(outline);
    if (!draft) {
      for (const c of pt.cuts || []) d += pathOf(c.map(place));
      for (const h of pt.holes) d += pathOf(circle(h).map(place));
    }
    const etch = draft ? '' : (pt.etch || []).map((e) => pathOf(e.map(place))).join('');
    return { pt, d, etch, glow: pathOf(outline), lit, depth: outline.reduce((s, q) => s + q[2], 0) / outline.length };
  });
  items.sort((a, b) => a.depth - b.depth);
  let out = '';
  for (const { pt, d, etch, glow, lit } of items) {
    const k = lit * (1 + 0.07 * (pt.layer || 0));
    const color = paletteColor(palette, pt.t);
    if (mode === 'night') {
      if (backlit && !draft) out += `<path d="${glow}" fill="${color}" fill-opacity="0.55"/>`;
      out += `<path d="${d}" fill-rule="evenodd" fill="${shade('#141a21', k)}" stroke="${color}" stroke-width="1" ${ns}/>`;
    } else if (mode === 'day') {
      if (backlit && !draft) out += `<path d="${glow}" fill="#f6f2e6"/>`;
      out += `<path d="${d}" fill-rule="evenodd" fill="${shade(mat.fill, k * 0.92)}" stroke="${mat.edge}" stroke-width="0.8" ${ns}/>`;
    } else {
      out += `<path d="${d}" fill-rule="evenodd" fill="${shade('#f2f4f6', Math.min(1.05, k))}" stroke="#16181c" stroke-width="0.8" ${ns}/>`;
    }
    if (etch) out += `<path d="${etch}" fill="none" stroke="${mode === 'night' ? color : mode === 'day' ? mat.edge : '#8a9098'}" stroke-opacity="0.45" stroke-width="0.6" ${ns}/>`;
  }
  return out;
}

export function elevationBox(stage) {
  const { truss, extent } = stage;
  const halfW = Math.max(extent.half, truss ? truss.w / 2 : 0) + 1900;
  const topY = Math.max(extent.top, truss ? truss.h : 0) + 1500;
  return { x: -halfW, y: -topY, w: 2 * halfW, h: topY + 1500 };
}

// 1.75 m standing figure with feet at screen point (x, y).
const figure = (x, y, fill) =>
  `<g fill="${fill}"><circle cx="${f0(x)}" cy="${f0(y - 1630)}" r="120"/><path d="M${f0(x - 230)} ${f0(y - 1450)}q230 -90 460 0l-40 700h-90l-30 750h-140l-30 -750h-90z"/></g>`;

function trussLines(x, y, w, h) {
  const horizontal = w >= h;
  const len = horizontal ? w : h;
  const d = horizontal ? h : w;
  const n = Math.max(1, Math.round(len / d));
  const lines = [[[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]]];
  for (let i = 0; i < n; i++) {
    const a = (len * i) / n;
    const b = (len * (i + 1)) / n;
    lines.push(horizontal ? [[x + a, y + (i % 2 ? 0 : h)], [x + b, y + (i % 2 ? h : 0)]] : [[x + (i % 2 ? 0 : w), y + a], [x + (i % 2 ? w : 0), y + b]]);
  }
  return lines;
}

export function elevationSVG(stage, { mode = 'night', palette = 'neon', material = null, yaw = 0, pitch = 0, draft = false, view = null } = {}) {
  if (mode === 'setout') yaw = pitch = 0;
  const th = THEMES[mode] || THEMES.night;
  const mat = material || { fill: '#dcc196', edge: '#6b4a26' };
  const { deck, truss, extent, params: p } = stage;
  const front = !yaw && !pitch;
  const cam = camera(yaw, pitch, -extent.top / 2);
  const vb = elevationBox(stage);
  const ns = 'vector-effect="non-scaling-stroke"';
  const line = (pts3) => 'M' + pts3.map((q) => cam.point(q)).map(([x, y]) => `${f0(x)} ${f0(y)}`).join('L');
  const quad = (pts3, attrs) => `<path d="${line(pts3)}Z" ${attrs} ${ns}/>`;

  const shown = view || vb;
  let out = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${f0(shown.x)} ${f0(shown.y)} ${f0(shown.w)} ${f0(shown.h)}" preserveAspectRatio="xMidYMax meet">`;
  out += `<defs><filter id="glow" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="26" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
  out += `<radialGradient id="haze" cx="50%" cy="55%" r="60%"><stop offset="0" stop-color="${paletteColor(palette, 0.5)}" stop-opacity="0.16"/><stop offset="1" stop-color="${paletteColor(palette, 0.5)}" stop-opacity="0"/></radialGradient></defs>`;
  out += `<rect x="${f0(vb.x)}" y="${f0(vb.y)}" width="${f0(vb.w)}" height="${f0(vb.h)}" fill="${th.sky}"/>`;
  if (mode === 'night') out += `<rect x="${f0(vb.x)}" y="${f0(vb.y)}" width="${f0(vb.w)}" height="${f0(vb.h)}" fill="url(#haze)"/>`;
  if (mode === 'setout') {
    let grid = '';
    for (let x = Math.ceil(vb.x / 1000) * 1000; x < vb.x + vb.w; x += 1000) grid += `M${x} ${f0(vb.y)}V0`;
    for (let y = 0; y > vb.y; y -= 1000) grid += `M${f0(vb.x)} ${y}H${f0(vb.x + vb.w)}`;
    out += `<path d="${grid}" fill="none" stroke="#dcdcd4" stroke-width="1" ${ns}/>`;
  }
  const far = 40000;
  if (front) out += `<rect x="${f0(vb.x)}" y="0" width="${f0(vb.w)}" height="1500" fill="${th.ground}"/>`;
  else out += quad([[-far, 0, -6000], [far, 0, -6000], [far, 0, far], [-far, 0, far]], `fill="${th.ground}"`);

  const zBack = -1500;
  const zFront = zBack + deck.d;
  if (truss) {
    const t = 300;
    const lines = [...trussLines(-truss.w / 2, -truss.h, t, truss.h), ...trussLines(truss.w / 2 - t, -truss.h, t, truss.h), ...trussLines(-truss.w / 2, -truss.h, truss.w, t)];
    out += `<path d="${lines.map((l) => line(l.map(([x, y]) => [x, y, -400]))).join('')}" fill="none" stroke="${th.truss}" stroke-width="1.1" ${ns}/>`;
  }

  // deck: top, sides, then the front face with its 2 m module joints
  const hw = deck.w / 2;
  const deckAttrs = `fill="${th.deck}" stroke="${th.deckLine}" stroke-width="1"`;
  const deckTop = quad([[-hw, -deck.h, zBack], [hw, -deck.h, zBack], [hw, -deck.h, zFront], [-hw, -deck.h, zFront]], `fill="${shade(th.deck.length === 7 ? th.deck : '#14181d', mode === 'setout' ? 0.97 : 1.35)}" stroke="${th.deckLine}" stroke-width="1"`);
  let deckFront = '';
  for (const sx of [-1, 1]) deckFront += quad([[sx * hw, -deck.h, zBack], [sx * hw, -deck.h, zFront], [sx * hw, 0, zFront], [sx * hw, 0, zBack]], deckAttrs);
  deckFront += quad([[-hw, -deck.h, zFront], [hw, -deck.h, zFront], [hw, 0, zFront], [-hw, 0, zFront]], deckAttrs);
  let joints = '';
  for (let x = -hw + 2000; x < hw - 1; x += 2000) joints += line([[x, -deck.h, zFront], [x, 0, zFront]]);
  deckFront += `<path d="${joints}" fill="none" stroke="${th.deckLine}" stroke-width="1" ${ns}/>`;

  // LED traces behind each medallion
  let traces = '';
  if (mode !== 'setout' && !draft) {
    for (const tr of stage.traces) {
      for (const h of tr.hairlines) {
        const steps = Math.max(4, Math.ceil((h.a1 - h.a0) / 0.12));
        const pts = Array.from({ length: steps + 1 }, (_, i) => {
          const a = h.a0 + ((h.a1 - h.a0) * i) / steps;
          return [(tr.flip ? -1 : 1) * (tr.cx + h.r * Math.cos(a)), tr.cy + h.r * Math.sin(a), tr.z];
        });
        traces += `<path d="${line(pts)}" fill="none" stroke="${mode === 'day' ? mat.edge : paletteColor(palette, h.t)}" stroke-width="1.3" ${mode === 'day' ? 'stroke-opacity="0.5"' : ''} ${ns}/>`;
      }
    }
  }

  const style = { mode, palette, mat, backlit: p.backlit, draft };
  const behind = stage.parts.filter((pt) => pt.el !== 'booth');
  const booth = stage.parts.filter((pt) => pt.el === 'booth');
  const glow = mode === 'night' && !draft ? ' filter="url(#glow)"' : '';
  // from above the deck top sits in front of nothing; from the front it is edge-on
  out += deckTop;
  out += `<g${glow}>${traces}${panelsMarkup(behind, cam, style)}</g>`;
  const dj = cam.point([0, -deck.h, 700]);
  if (booth.length) out += figure(dj[0], dj[1], th.figure);
  out += `<g${glow}>${panelsMarkup(booth, cam, style)}</g>`;
  out += deckFront;
  for (const sx of [-1, 1]) {
    const [fx, fy] = cam.point([sx * (extent.half + 800), 0, zFront + 600]);
    out += figure(fx, fy, th.figure);
  }

  if (mode === 'setout') {
    const fs = Math.max(70, vb.w / 230);
    out += `<g font-family="monospace" font-size="${f0(fs)}" fill="${th.ink}" text-anchor="middle" dominant-baseline="central">`;
    for (const pt of stage.parts) {
      const [x, y] = cam.point(world(pt, pt.label));
      out += `<text x="${f0(x)}" y="${f0(y)}">${pt.id}</text>`;
    }
    out += '</g>';
  }

  if (front) {
    const fs = Math.max(220, vb.w / 70);
    const dimY = 650;
    const dimX = extent.half + 1350;
    out += `<path d="M${f0(-extent.half)} ${dimY}H${f0(extent.half)}M${f0(-extent.half)} ${dimY - 120}v240M${f0(extent.half)} ${dimY - 120}v240M${f0(dimX)} 0V${f0(-extent.top)}M${f0(dimX - 120)} 0h240M${f0(dimX - 120)} ${f0(-extent.top)}h240" stroke="${th.ink}" stroke-width="1" fill="none" ${ns}/>`;
    out += `<g font-family="monospace" font-size="${f0(fs)}" fill="${th.ink}" text-anchor="middle"><text x="0" y="${f0(dimY + fs * 1.25)}">${m1(2 * extent.half)} m</text>`;
    out += `<text transform="translate(${f0(dimX + fs * 1.1)} ${f0(-extent.top / 2)}) rotate(90)">${m1(extent.top)} m</text></g>`;
  }
  return out + '</svg>';
}

// The origin cell (and petal) on their own, tilted so the relief reads.
export function sourceSVG(parts, { mode = 'night', palette = 'neon', material = null, backlit = true, simple = false } = {}) {
  const th = THEMES[mode] || THEMES.night;
  const mat = material || { fill: '#dcc196', edge: '#6b4a26' };
  if (!parts.length) return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="${th.sky}"/></svg>`;
  const cam = camera(-32, 24, 0);
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const pt of parts) {
    for (const q of pt.points) {
      const [x, y] = cam.point(world(pt, q));
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
  }
  const pad = Math.max(x1 - x0, y1 - y0) * 0.08;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${f0(x0 - pad)} ${f0(y0 - pad)} ${f0(x1 - x0 + 2 * pad)} ${f0(y1 - y0 + 2 * pad)}"><rect x="${f0(x0 - pad)}" y="${f0(y0 - pad)}" width="${f0(x1 - x0 + 2 * pad)}" height="${f0(y1 - y0 + 2 * pad)}" fill="${th.sky}"/>${panelsMarkup(simple ? parts.map((pt) => ({ ...pt, etch: [] })) : parts, cam, { mode: mode === 'setout' ? 'day' : mode, palette, mat, backlit })}</svg>`;
}
