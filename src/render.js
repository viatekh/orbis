// SVG rendering for the on-screen layers, thumbnails and art export.

export const PALETTES = {
  circuit: { label: 'Circuit', stops: ['#f4de3c', '#bcd65a', '#4cb3a8'] },
  neon: { label: 'Neon', stops: ['#ff4fd8', '#9a6bff', '#3fe0ff'] },
  ember: { label: 'Ember', stops: ['#ffe07a', '#ff8a3d', '#d8344f'] },
  glacier: { label: 'Glacier', stops: ['#f1fbff', '#86cfff', '#4d6bff'] },
  phosphor: { label: 'Phosphor', stops: ['#d4ff7a', '#3ddc84', '#12866a'] },
  mono: { label: 'Mono', stops: ['#f2f2f2', '#9ea4ab'] },
};

export const MODES = {
  material: { label: 'Material' },
  toolpath: { label: 'Toolpath' },
  line: { label: 'Line Work' },
  solid: { label: 'Solid' },
  neon: { label: 'Neon' },
  plot: { label: 'Plot' },
};

const hexToRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

export function paletteColor(paletteKey, t) {
  const stops = (PALETTES[paletteKey] || PALETTES.circuit).stops.map(hexToRgb);
  const x = Math.min(1, Math.max(0, t)) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(x));
  const f = x - i;
  const c = stops[i].map((v, k) => Math.round(v + (stops[i + 1][k] - v) * f));
  return `rgb(${c.join(',')})`;
}

const f2 = (n) => (Math.round(n * 100) / 100).toString();

export function partPath(part) {
  let d = 'M' + part.points.map(([x, y]) => `${f2(x)} ${f2(y)}`).join('L') + 'Z';
  for (const h of part.holes) d += circlePath(h.x, h.y, h.r);
  return d;
}

const circlePath = (cx, cy, r) =>
  `M${f2(cx + r)} ${f2(cy)}A${f2(r)} ${f2(r)} 0 1 0 ${f2(cx - r)} ${f2(cy)}A${f2(r)} ${f2(r)} 0 1 0 ${f2(cx + r)} ${f2(cy)}Z`;

export function hairPath(h) {
  const x0 = h.r * Math.cos(h.a0);
  const y0 = h.r * Math.sin(h.a0);
  const x1 = h.r * Math.cos(h.a1);
  const y1 = h.r * Math.sin(h.a1);
  const large = h.a1 - h.a0 > Math.PI ? 1 : 0;
  return `M${f2(x0)} ${f2(y0)}A${f2(h.r)} ${f2(h.r)} 0 ${large} 1 ${f2(x1)} ${f2(y1)}`;
}

export function viewBox(design, margin = 1.06) {
  const R = (design.stats.outerDiameter / 2) * margin;
  return `${f2(-R)} ${f2(-R)} ${f2(2 * R)} ${f2(2 * R)}`;
}

function styleFor(mode, color, material) {
  if (mode === 'plot') color = '#16181c';
  switch (mode) {
    case 'material': {
      const m = material || { fill: '#dcc196', edge: '#6b4a26', engrave: '#7d5631' };
      return {
        part: `fill="${m.fill}" stroke="${m.edge}" stroke-width="1"`,
        hair: `fill="none" stroke="${m.engrave}" stroke-width="1.1" stroke-opacity="0.9"`,
        pad: `fill="${m.engrave}"`,
      };
    }
    case 'toolpath':
      return {
        part: `fill="none" stroke="#ff3b30" stroke-width="1"`,
        hair: `fill="none" stroke="#3d7bff" stroke-width="1"`,
        pad: `fill="#3d7bff"`,
      };
    case 'solid':
      return {
        part: `fill="${color}" fill-opacity="0.88" stroke="${color}" stroke-width="0.6"`,
        hair: `fill="none" stroke="${color}" stroke-width="0.8" stroke-opacity="0.75"`,
        pad: `fill="${color}"`,
      };
    case 'neon':
      return {
        part: `fill="${color}" fill-opacity="0.07" stroke="${color}" stroke-width="1.6"`,
        hair: `fill="none" stroke="${color}" stroke-width="1" stroke-opacity="0.85"`,
        pad: `fill="${color}"`,
      };
    default:
      return {
        part: `fill="none" stroke="${color}" stroke-width="1.25"`,
        hair: `fill="none" stroke="${color}" stroke-width="0.7" stroke-opacity="0.7"`,
        pad: `fill="${color}" fill-opacity="0.85"`,
      };
  }
}

// Inner markup (no <svg> wrapper) for a subset of rings.
export function ringsMarkup(design, { palette = 'circuit', mode = 'line', rings = null, scaleStroke = 1, material = null } = {}) {
  const include = (i) => rings === null || rings.includes(i);
  let out = '';
  for (const part of design.parts) {
    if (!include(part.ring)) continue;
    const st = styleFor(mode, paletteColor(palette, part.t), material);
    out += `<path d="${partPath(part)}" fill-rule="evenodd" vector-effect="non-scaling-stroke" ${scaleAttr(st.part, scaleStroke)}/>`;
  }
  for (const h of design.hairlines) {
    if (!include(h.ring)) continue;
    const st = styleFor(mode, paletteColor(palette, h.t), material);
    out += `<path d="${hairPath(h)}" vector-effect="non-scaling-stroke" ${scaleAttr(st.hair, scaleStroke)}/>`;
    for (const pad of h.pads) out += `<circle cx="${f2(pad.x)}" cy="${f2(pad.y)}" r="${f2(pad.r)}" ${st.pad}/>`;
  }
  return out;
}

const scaleAttr = (attrs, k) =>
  k === 1 ? attrs : attrs.replace(/stroke-width="([\d.]+)"/, (_, w) => `stroke-width="${f2(Number(w) * k)}"`);

export function designSVG(design, opts = {}) {
  const { background = null, width = null, height = null } = opts;
  const vb = viewBox(design);
  const [x, y, w, h] = vb.split(' ');
  const bg = background ? `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${background}"/>` : '';
  const size = width ? ` width="${width}" height="${height ?? width}"` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}"${size}>${bg}${ringsMarkup(design, opts)}</svg>`;
}

// Cutting-mat grid in true millimetres (10 mm minor, 50 mm major), numbered outward from the centre.
export function matGridSVG(design) {
  const R = (design.stats.outerDiameter / 2) * 1.06;
  const E = Math.ceil((R * 1.9) / 50) * 50;
  let minor = '';
  let major = '';
  let nums = '';
  for (let v = -E; v <= E; v += 10) {
    const line = `M${v} ${-E}V${E}M${-E} ${v}H${E}`;
    if (v % 50 === 0) {
      major += line;
      if (v > -E && v < E) {
        nums += `<text x="${v}" y="${-R + 4}" text-anchor="middle">${Math.abs(v)}</text>`;
        if (v) nums += `<text x="${-R + 4}" y="${v}" dominant-baseline="central">${Math.abs(v)}</text>`;
      }
    } else minor += line;
  }
  const fs = Math.max(4, R / 40);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox(design)}" overflow="visible">
<path class="g-min" d="${minor}" vector-effect="non-scaling-stroke"/>
<path class="g-maj" d="${major}" vector-effect="non-scaling-stroke"/>
<g class="g-num" font-size="${fs}">${nums}</g></svg>`;
}
