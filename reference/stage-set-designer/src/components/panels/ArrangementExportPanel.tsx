import { Layers, Combine } from 'lucide-react'
import { buildArrangementSvgDocument, buildLayerSvgDocument } from '../../lib/export/svgDocument'
import { downloadSvg } from '../../lib/export/svgExport'
import { CollapsibleSection } from '../shared/CollapsibleSection'
import type { ArrangementGeometry } from '../../lib/geometry/arrangement'
import type { Arrangement } from '../../types'

function slug(name: string): string {
  return name.trim().replace(/\s+/g, '-').toLowerCase() || 'untitled'
}

export function ArrangementExportPanel({
  arrangement,
  geometry,
}: {
  arrangement: Arrangement
  geometry: ArrangementGeometry
}) {
  const handleExportSeparate = () => {
    for (const layer of geometry.layers) {
      if (!layer.visible || layer.outline.length === 0) continue
      const layerName = arrangement.layers.find((l) => l.id === layer.layerId)?.name ?? layer.layerId
      const doc = buildLayerSvgDocument(layer)
      downloadSvg(doc, `${slug(arrangement.name)}-${slug(layerName)}.svg`)
    }
  }

  const handleExportCombined = () => {
    const doc = buildArrangementSvgDocument(geometry)
    downloadSvg(doc, `${slug(arrangement.name)}-combined.svg`)
  }

  const hasVisibleGeometry = geometry.layers.some((l) => l.visible && l.outline.length > 0)

  return (
    <CollapsibleSection id="arrangement-export" title="Export">
      <button
        type="button"
        onClick={handleExportSeparate}
        disabled={!hasVisibleGeometry}
        className="flex items-center justify-center gap-2 rounded-md bg-purple-500 px-3 py-2 text-sm font-medium text-white hover:bg-purple-400 disabled:opacity-40"
      >
        <Layers size={15} />
        Export layers separately
      </button>
      <p className="-mt-1 text-xs text-neutral-500">One SVG per visible layer — each is a separate physical sheet.</p>

      <button
        type="button"
        onClick={handleExportCombined}
        disabled={!hasVisibleGeometry}
        className="flex items-center justify-center gap-2 rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-200 hover:bg-neutral-800 disabled:opacity-40"
      >
        <Combine size={15} />
        Export combined preview SVG
      </button>
      <p className="-mt-1 text-xs text-neutral-500">All visible layers in one file, for reference — not for cutting.</p>
    </CollapsibleSection>
  )
}
