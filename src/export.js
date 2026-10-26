// Fabrication + image exports: laser-ready SVG (mm), DXF R12, PNG, JSON.

import { partPath, hairPath, viewBox, designSVG } from './render.js';

const f3 = (n) => (Math.round(n * 1000) / 1000).toString();

export function cutSVG(design) {
  const vb = viewBox(design, 1.02);
  const size = vb.split(' ')[2];
  const cut = design.parts.map((p) => `<path d="${partPath(p)}"/>`).join('');
  const engrave = design.hairlines
    .map((h) => `<path d="${hairPath(h)}"/>` + h.pads.map((d) => `<circle cx="${f3(d.x)}" cy="${f3(d.y)}" r="${f3(d.r)}" fill="#0000ff"/>`).join(''))
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="${size}mm" height="${size}mm" viewBox="${vb}">
<!-- Orbis ${paramsComment(design.params)} -->
<g id="cut" inkscape:groupmode="layer" inkscape:label="CUT" fill="none" stroke="#ff0000" stroke-width="0.1" fill-rule="evenodd">${cut}</g>
<g id="engrave" inkscape:groupmode="layer" inkscape:label="ENGRAVE" fill="none" stroke="#0000ff" stroke-width="0.1">${engrave}</g>
</svg>`;
}

const paramsComment = (p) =>
  Object.entries(p)
    .map(([k, v]) => `${k}=${v}`)
    .join(' ');

export function artSVG(design, opts) {
  return designSVG(design, { ...opts, background: opts.background ?? '#0b0f14', width: 2048 });
}

// DXF R12 — widest compatibility (LightBurn, Fusion, Illustrator, LibreCAD).
// DXF is Y-up, so Y is negated and arc angles mirrored.
export function toDXF(design) {
  const L = [];
  const g = (code, value) => L.push(String(code), String(value));
  g(0, 'SECTION'); g(2, 'HEADER');
  g(9, '$ACADVER'); g(1, 'AC1009');
  g(9, '$INSUNITS'); g(70, 4);
  g(0, 'ENDSEC');
  g(0, 'SECTION'); g(2, 'TABLES');
  g(0, 'TABLE'); g(2, 'LAYER'); g(70, 2);
  for (const [name, color] of [['CUT', 1], ['ENGRAVE', 5]]) {
    g(0, 'LAYER'); g(2, name); g(70, 0); g(62, color); g(6, 'CONTINUOUS');
  }
  g(0, 'ENDTAB');
  g(0, 'ENDSEC');
  g(0, 'SECTION'); g(2, 'ENTITIES');
  for (const part of design.parts) {
    g(0, 'POLYLINE'); g(8, 'CUT'); g(66, 1); g(70, 1); g(10, 0); g(20, 0); g(30, 0);
    for (const [x, y] of part.points) {
      g(0, 'VERTEX'); g(8, 'CUT'); g(10, f3(x)); g(20, f3(-y)); g(30, 0);
    }
    g(0, 'SEQEND'); g(8, 'CUT');
    for (const h of part.holes) circle('CUT', h);
  }
  const deg = (a) => f3((((a * 180) / Math.PI) % 360 + 360) % 360);
  for (const h of design.hairlines) {
    g(0, 'ARC'); g(8, 'ENGRAVE'); g(10, 0); g(20, 0); g(30, 0); g(40, f3(h.r));
    g(50, deg(-h.a1)); g(51, deg(-h.a0));
    for (const d of h.pads) circle('ENGRAVE', d);
  }
  g(0, 'ENDSEC');
  g(0, 'EOF');
  return L.join('\n') + '\n';

  function circle(layer, c) {
    g(0, 'CIRCLE'); g(8, layer); g(10, f3(c.x)); g(20, f3(-c.y)); g(30, 0); g(40, f3(c.r));
  }
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
