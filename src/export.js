// File writers. Fabrication formats (SVG, DXF) consume a job from buildJob();
// all coordinates are millimetres.

import { designSVG } from './render.js';
import { buildJob } from './fabrication.js';
import { strokeText } from './strokefont.js';

const f3 = (n) => (Math.round(n * 1000) / 1000).toString();


// Inner cuts get their own colour so the machine can be told to run them before the outlines.
export const LAYER_COLORS = { inner: '#ff00ff', cut: '#ff0000', engrave: '#0000ff', labels: '#000000', guides: '#00a651' };

const lineD = (pts) => 'M' + pts.map(([x, y]) => `${f3(x)} ${f3(y)}`).join('L');
const polyD = (pts) => lineD(pts) + 'Z';
const arcD = ({ cx, cy, r, a0, a1 }) => {
  const [x0, y0] = [cx + r * Math.cos(a0), cy + r * Math.sin(a0)];
  const [x1, y1] = [cx + r * Math.cos(a1), cy + r * Math.sin(a1)];
  return `M${f3(x0)} ${f3(y0)}A${f3(r)} ${f3(r)} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${f3(x1)} ${f3(y1)}`;
};

// Laser/CNC/plotter SVG: true mm size, one Inkscape layer per operation, written in
// machining order: engrave, part numbers, inner cuts, then outlines last.
const LAYER_NAMES = { guides: 'GUIDES', engrave: '1-ENGRAVE', labels: '2-LABELS', inner: '3-CUT-INNER', cut: '4-CUT-OUTLINE' };

export function jobSVG(job, meta = '', { preview = false } = {}) {
  const { x, y, w, h } = job.bounds;
  const sw = preview ? 'vector-effect="non-scaling-stroke" stroke-width="1"' : 'stroke-width="0.1"';
  const layer = (id, body, attrs) =>
    body ? `<g id="${id}" inkscape:groupmode="layer" inkscape:label="${LAYER_NAMES[id]}" ${attrs}>${body}</g>\n` : '';
  const guides = job.guides
    .map((g) => `<rect x="${f3(g.x)}" y="${f3(g.y)}" width="${f3(g.w)}" height="${f3(g.h)}"${g.oversize ? ' stroke-dasharray="4 3"' : ''}/>`)
    .join('');
  const shapes = (g) =>
    g.polys.map((p) => `<path d="${polyD(p)}"/>`).join('') +
    g.circles.map((c) => `<circle cx="${f3(c.x)}" cy="${f3(c.y)}" r="${f3(c.r)}"/>`).join('');
  const engrave =
    job.engrave.arcs.map((a) => `<path d="${arcD(a)}"/>`).join('') +
    job.engrave.polys.map((p) => `<path d="${polyD(p)}"/>`).join('') +
    job.engrave.dots.map((d) => `<circle cx="${f3(d.x)}" cy="${f3(d.y)}" r="${f3(d.r)}" fill="${LAYER_COLORS.engrave}"/>`).join('');
  const labels = job.labels.map((l) => `<path d="${strokeText(l.text, l.x, l.y, l.size).map(lineD).join('')}"/>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="${f3(w)}mm" height="${f3(h)}mm" viewBox="${f3(x)} ${f3(y)} ${f3(w)} ${f3(h)}">
${meta ? `<!-- ${meta} -->\n` : ''}${layer('guides', guides, `fill="none" stroke="${LAYER_COLORS.guides}" ${sw}`)}${layer('engrave', engrave, `fill="none" stroke="${LAYER_COLORS.engrave}" ${sw}`)}${layer('labels', labels, `fill="none" stroke="${LAYER_COLORS.labels}" ${sw}`)}${layer('inner', shapes(job.inner), `fill="none" stroke="${LAYER_COLORS.inner}" ${sw}`)}${layer('cut', shapes(job.cut), `fill="none" stroke="${LAYER_COLORS.cut}" ${sw}`)}</svg>`;
}

export const paramsComment = (design, fab) =>
  'Orbis ' +
  Object.entries(design.params)
    .map(([k, v]) => `${k}=${v}`)
    .join(' ') +
  (fab ? ` | process=${fab.process} material=${fab.material} t=${fab.thickness}mm kerf=${fab.kerf} layout=${fab.layout}` : '');

export function fabSVG(design, fab) {
  return jobSVG(buildJob(design, fab), paramsComment(design, fab));
}

export function artSVG(design, opts) {
  return designSVG(design, { ...opts, background: opts.background ?? '#0b0f14', width: 2048 });
}

// DXF R12 — widest compatibility (LightBurn, Fusion, VCarve, Illustrator, LibreCAD).
// DXF is Y-up, so Y is negated and arc angles mirrored.
export function toDXF(design, fab) {
  const job = buildJob(design, fab);
  const L = [];
  const g = (code, value) => L.push(String(code), String(value));
  const deg = (a) => f3(((((a * 180) / Math.PI) % 360) + 360) % 360);
  const layers = [['ENGRAVE', 5], ['LABELS', 7], ['CUT_INNER', 6], ['CUT_OUTLINE', 1], ['GUIDES', 3]];

  g(0, 'SECTION'); g(2, 'HEADER');
  g(9, '$ACADVER'); g(1, 'AC1009');
  g(9, '$INSUNITS'); g(70, 4);
  g(0, 'ENDSEC');
  g(0, 'SECTION'); g(2, 'TABLES');
  g(0, 'TABLE'); g(2, 'LAYER'); g(70, layers.length);
  for (const [name, color] of layers) {
    g(0, 'LAYER'); g(2, name); g(70, 0); g(62, color); g(6, 'CONTINUOUS');
  }
  g(0, 'ENDTAB');
  g(0, 'ENDSEC');
  g(0, 'SECTION'); g(2, 'ENTITIES');

  const poly = (layer, pts, closed = true) => {
    g(0, 'POLYLINE'); g(8, layer); g(66, 1); g(70, closed ? 1 : 0); g(10, 0); g(20, 0); g(30, 0);
    for (const [x, y] of pts) {
      g(0, 'VERTEX'); g(8, layer); g(10, f3(x)); g(20, f3(-y)); g(30, 0);
    }
    g(0, 'SEQEND'); g(8, layer);
  };
  const circle = (layer, c) => {
    g(0, 'CIRCLE'); g(8, layer); g(10, f3(c.x)); g(20, f3(-c.y)); g(30, 0); g(40, f3(c.r));
  };

  for (const a of job.engrave.arcs) {
    g(0, 'ARC'); g(8, 'ENGRAVE'); g(10, f3(a.cx)); g(20, f3(-a.cy)); g(30, 0); g(40, f3(a.r));
    g(50, deg(-a.a1)); g(51, deg(-a.a0));
  }
  for (const p of job.engrave.polys) poly('ENGRAVE', p);
  for (const d of job.engrave.dots) circle('ENGRAVE', d);
  for (const l of job.labels) for (const line of strokeText(l.text, l.x, l.y, l.size)) poly('LABELS', line, false);
  for (const p of job.inner.polys) poly('CUT_INNER', p);
  for (const c of job.inner.circles) circle('CUT_INNER', c);
  for (const p of job.cut.polys) poly('CUT_OUTLINE', p);
  for (const c of job.cut.circles) circle('CUT_OUTLINE', c);
  for (const r of job.guides) {
    poly('GUIDES', [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]]);
  }
  g(0, 'ENDSEC');
  g(0, 'EOF');
  return L.join('\n') + '\n';
}

export function svgToPngBlob(svg, size = 2048) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      canvas.getContext('2d').drawImage(img, 0, 0, size, size);
      URL.revokeObjectURL(url);
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG encode failed'))), 'image/png');
    };
    img.onerror = () => reject(new Error('SVG rasterize failed'));
    img.src = url;
  });
}

export function download(filename, data, type) {
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

