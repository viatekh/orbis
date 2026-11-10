// Front-elevation drawing of a stage: day (material), night (LED-lit) and
// setting-out (numbered line drawing). Units are mm; ground is y = 0.

import { partPath, hairPath, paletteColor } from './render.js';

export const STAGE_MODES = { night: 'Night', day: 'Day', setout: 'Setting-out' };

const f0 = (n) => Math.round(n).toString();
const m1 = (mm) => (Math.round(mm / 100) / 10).toFixed(1);

const THEMES = {
  night: { sky: '#07090d', ground: '#0d1014', deck: '#14181d', deckLine: '#262c33', ink: '#aab4bd', truss: '#2a3037', figure: '#1f252b' },
  day: { sky: '#dfe7ea', ground: '#b9c2bd', deck: '#2b2f33', deckLine: '#4a5056', ink: '#39424a', truss: '#7f8890', figure: '#3c444b' },
  setout: { sky: '#fbfbf8', ground: '#e9e9e2', deck: '#ffffff', deckLine: '#9aa0a6', ink: '#16181c', truss: '#b4bac0', figure: '#c9ced3' },
};

// 1.75 m standing figure with feet at (x, y).
const figure = (x, y, fill) =>
  `<g fill="${fill}"><circle cx="${f0(x)}" cy="${f0(y - 1630)}" r="120"/><path d="M${f0(x - 230)} ${f0(y - 1450)}q230 -90 460 0l-40 700h-90l-30 750h-140l-30 -750h-90z"/></g>`;

function trussPath(x, y, w, h) {
  // a boxed run with diagonal bracing, along whichever side is longer
  const horizontal = w >= h;
  const len = horizontal ? w : h;
  const d = horizontal ? h : w;
  const n = Math.max(1, Math.round(len / d));
  let path = `M${f0(x)} ${f0(y)}h${f0(w)}v${f0(h)}h${f0(-w)}z`;
  for (let i = 0; i < n; i++) {
    const a = (len * i) / n;
    const b = (len * (i + 1)) / n;
    path += horizontal
      ? `M${f0(x + a)} ${f0(y + (i % 2 ? 0 : h))}L${f0(x + b)} ${f0(y + (i % 2 ? h : 0))}`
      : `M${f0(x + (i % 2 ? 0 : w))} ${f0(y + a)}L${f0(x + (i % 2 ? w : 0))} ${f0(y + b)}`;
  }
  return path;
}

export function elevationBox(stage) {
  const { truss, extent } = stage;
  const halfW = Math.max(extent.half, truss ? truss.w / 2 : 0) + 1900;
  const topY = Math.max(extent.top, truss ? truss.h : 0) + 1500;
  return { x: -halfW, y: -topY, w: 2 * halfW, h: topY + 1500 };
}

export const skyColor = (mode) => (THEMES[mode] || THEMES.night).sky;

export function elevationSVG(stage, { mode = 'night', palette = 'neon', material = null } = {}) {
  const th = THEMES[mode] || THEMES.night;
  const mat = material || { fill: '#dcc196', edge: '#6b4a26' };
  const { deck, truss, extent, params: p } = stage;
  const vb = elevationBox(stage);
  const topY = -vb.y;
  const ns = 'vector-effect="non-scaling-stroke"';
  let out = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${f0(vb.x)} ${f0(vb.y)} ${f0(vb.w)} ${f0(vb.h)}" preserveAspectRatio="xMidYMax meet">`;
  out += `<defs><filter id="glow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="28" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
  out += `<radialGradient id="haze" cx="50%" cy="60%" r="60%"><stop offset="0" stop-color="${paletteColor(palette, 0.5)}" stop-opacity="0.16"/><stop offset="1" stop-color="${paletteColor(palette, 0.5)}" stop-opacity="0"/></radialGradient></defs>`;
  out += `<rect x="${f0(vb.x)}" y="${f0(vb.y)}" width="${f0(vb.w)}" height="${f0(vb.h)}" fill="${th.sky}"/>`;
  if (mode === 'night') out += `<rect x="${f0(vb.x)}" y="${f0(vb.y)}" width="${f0(vb.w)}" height="${f0(topY)}" fill="url(#haze)"/>`;
  if (mode === 'setout') {
    let grid = '';
    for (let x = Math.ceil(vb.x / 1000) * 1000; x < vb.x + vb.w; x += 1000) grid += `M${x} ${f0(vb.y)}V0`;
    for (let y = 0; y > vb.y; y -= 1000) grid += `M${f0(vb.x)} ${y}H${f0(vb.x + vb.w)}`;
    out += `<path d="${grid}" fill="none" stroke="#dcdcd4" stroke-width="1" ${ns}/>`;
  }
  out += `<rect x="${f0(vb.x)}" y="0" width="${f0(vb.w)}" height="1500" fill="${th.ground}"/>`;

  if (truss) {
    const t = 300;
    const d = trussPath(-truss.w / 2, -truss.h, t, truss.h) + trussPath(truss.w / 2 - t, -truss.h, t, truss.h) + trussPath(-truss.w / 2, -truss.h, truss.w, t);
    out += `<path d="${d}" fill="none" stroke="${th.truss}" stroke-width="1.2" ${ns}/>`;
  }

  const style = (pt) => {
    const raised = pt.z === 1;
    if (mode === 'day') return `fill="${mat.fill}" ${raised ? '' : 'fill-opacity="0.8" '}stroke="${mat.edge}" stroke-width="${raised ? 1.3 : 0.8}"`;
    if (mode === 'setout') return `fill="${raised ? '#eef1f4' : '#ffffff'}" stroke="${th.ink}" stroke-width="${raised ? 1.2 : 0.8}"`;
    return `fill="${raised ? '#182028' : '#0c1014'}" stroke="${paletteColor(palette, pt.t)}" stroke-width="${raised ? 1.5 : 1}"`;
  };
  const group = (el, z = null) => {
    const parts = stage.parts.filter((pt) => pt.el === el && (z === null || pt.z === z));
    if (!parts.length) return '';
    let g = `<g${mode === 'night' ? ' filter="url(#glow)"' : ''}>`;
    if (el === 'centre' && mode !== 'setout') {
      const [cx, cy] = stage.centre;
      g += `<g transform="translate(${f0(cx)} ${f0(cy)})" fill="none" stroke-width="1.4" ${mode === 'day' ? `stroke="${mat.edge}" stroke-opacity="0.55"` : ''}>`;
      for (const h of stage.disc.hairlines) {
        const c = mode === 'day' ? '' : ` stroke="${paletteColor(palette, h.t)}"`;
        g += `<path d="${hairPath(h)}"${c} ${ns}/>`;
      }
      g += '</g>';
    }
    for (const pt of parts) g += `<path d="${partPath(pt)}" fill-rule="evenodd" ${style(pt)} ${ns}/>`;
    return g + '</g>';
  };

  out += group('facade', 0) + group('facade', 1) + group('centre');
  // the DJ stands behind the booth, on the deck
  if (p.boothWidth >= 0.5) out += figure(0, -deck.h, th.figure);
  out += group('booth');

  // deck with 2 m module joints
  let joints = '';
  for (let x = -deck.w / 2 + 2000; x < deck.w / 2 - 1; x += 2000) joints += `M${f0(x)} ${f0(-deck.h)}V0`;
  out += `<rect x="${f0(-deck.w / 2)}" y="${f0(-deck.h)}" width="${f0(deck.w)}" height="${f0(deck.h)}" fill="${th.deck}" stroke="${th.deckLine}" stroke-width="1" ${ns}/>`;
  out += `<path d="${joints}" fill="none" stroke="${th.deckLine}" stroke-width="1" ${ns}/>`;
  out += figure(-extent.half - 900, 0, th.figure) + figure(extent.half + 700, 0, th.figure);

  if (mode === 'setout') {
    const fs = Math.max(70, vb.w / 230);
    out += `<g font-family="monospace" font-size="${f0(fs)}" fill="${th.ink}" text-anchor="middle" dominant-baseline="central">`;
    for (const pt of stage.parts) out += `<text x="${f0(pt.label[0])}" y="${f0(pt.label[1])}">${pt.id}</text>`;
    out += '</g>';
  }

  // overall dimensions
  const fs = Math.max(220, vb.w / 70);
  const dimY = 650;
  const dimX = extent.half + 1350;
  out += `<g stroke="${th.ink}" stroke-width="1" fill="none" ${ns}><path d="M${f0(-extent.half)} ${dimY}H${f0(extent.half)}M${f0(-extent.half)} ${dimY - 120}v240M${f0(extent.half)} ${dimY - 120}v240M${f0(dimX)} 0V${f0(-extent.top)}M${f0(dimX - 120)} 0h240M${f0(dimX - 120)} ${f0(-extent.top)}h240" ${ns}/></g>`;
  out += `<g font-family="monospace" font-size="${f0(fs)}" fill="${th.ink}" text-anchor="middle"><text x="0" y="${f0(dimY + fs * 1.25)}">${m1(2 * extent.half)} m</text>`;
  out += `<text transform="translate(${f0(dimX + fs * 1.1)} ${f0(-extent.top / 2)}) rotate(90)">${m1(extent.top)} m</text></g>`;
  return out + '</svg>';
}
