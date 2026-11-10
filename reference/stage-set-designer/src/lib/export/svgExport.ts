import { downloadBlob } from '../utils'
import type { SvgDocument } from './svgDocument'

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
}

export function serializeSvg(doc: SvgDocument): string {
  const layerXml = doc.layers
    .map(
      (l) =>
        `  <g id="${l.id}" data-role="${l.role}" data-label="${escapeAttr(l.label)}">\n` +
        `    <path d="${l.d}" fill="none" stroke="${l.stroke}" stroke-width="${l.strokeWidthMm}" vector-effect="non-scaling-stroke"/>\n` +
        `  </g>`,
    )
    .join('\n')

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" width="${doc.widthMm}mm" height="${doc.heightMm}mm" viewBox="${doc.viewBox}" data-units="mm">\n` +
    `${layerXml}\n` +
    `</svg>\n`
  )
}

export function downloadSvg(doc: SvgDocument, filename: string) {
  const svg = serializeSvg(doc)
  downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), filename)
}
