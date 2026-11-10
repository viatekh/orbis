import { useMemo, useState } from 'react'
import { Box, Download, FileDown, FileUp } from 'lucide-react'
import { buildSvgDocument } from '../../lib/export/svgDocument'
import { downloadSvg } from '../../lib/export/svgExport'
import { exportProject, importProject } from '../../lib/export/projectFile'
import { downloadComponentStl, estimateStlComplexity } from '../../lib/export/stlExport'
import { useDesignerStore } from '../../store/designerStore'
import { NumberField } from '../shared/NumberField'
import { CollapsibleSection } from '../shared/CollapsibleSection'
import type { GeometryResult } from '../../lib/geometry/types'
import type { StageComponent } from '../../types'

export function ExportPanel({ component, geometry }: { component: StageComponent; geometry: GeometryResult }) {
  const project = useDesignerStore((s) => s.project)
  const replaceProject = useDesignerStore((s) => s.replaceProject)
  const [embossHeight, setEmbossHeight] = useState(1.5)
  const [building, setBuilding] = useState(false)

  const slug = component.name.replace(/\s+/g, '-').toLowerCase()

  const handleExportSvg = () => {
    const doc = buildSvgDocument(geometry)
    downloadSvg(doc, `${slug}.svg`)
  }

  const complexity = useMemo(() => estimateStlComplexity(geometry), [geometry])

  const handleExportStl = () => {
    setBuilding(true)
    // Triangulation can take a noticeable moment on a dense pattern — defer
    // one tick so the "Building…" label actually paints before the main
    // thread gets busy with it.
    setTimeout(() => {
      try {
        downloadComponentStl(geometry, component.material.thicknessMm, embossHeight, `${slug}.stl`)
      } finally {
        setBuilding(false)
      }
    }, 20)
  }

  const handleImportProject = async () => {
    try {
      const imported = await importProject()
      replaceProject(imported)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not import project file.')
    }
  }

  return (
    <CollapsibleSection id="export" title="Export">
      <button
        type="button"
        onClick={handleExportSvg}
        className="flex items-center justify-center gap-2 rounded-md bg-purple-500 px-3 py-2 text-sm font-medium text-white hover:bg-purple-400"
      >
        <Download size={15} />
        Export SVG (mm)
      </button>

      <div className="h-px bg-neutral-800" />

      <h4 className="text-sm font-medium text-neutral-200">3D print (STL)</h4>
      <p className="-mt-1 text-xs text-neutral-500">
        A real solid, extruded to the material thickness — the pattern's cut cells and any center hole come through
        as actual through-holes, and etched/surface-detail regions rise as an embossed cap rather than a flat line.
      </p>

      <NumberField
        label="Emboss height"
        value={embossHeight}
        min={0.2}
        max={10}
        step={0.1}
        suffix="mm"
        onChange={setEmbossHeight}
      />

      {complexity.overBudget && (
        <p className="text-xs text-amber-400">
          This pattern is dense ({complexity.vertices.toLocaleString()} boundary points) — triangulating it for 3D
          may take a while or hang the tab. Consider a larger cell size for the STL export.
        </p>
      )}

      <button
        type="button"
        onClick={handleExportStl}
        disabled={building}
        className="flex items-center justify-center gap-2 rounded-md bg-purple-500 px-3 py-2 text-sm font-medium text-white hover:bg-purple-400 disabled:opacity-60"
      >
        <Box size={15} />
        {building ? 'Building…' : 'Export STL (3D print)'}
      </button>

      <div className="h-px bg-neutral-800" />

      <button
        type="button"
        onClick={() => exportProject(project)}
        className="flex items-center justify-center gap-2 rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-200 hover:bg-neutral-800"
      >
        <FileDown size={15} />
        Export project JSON
      </button>

      <button
        type="button"
        onClick={handleImportProject}
        className="flex items-center justify-center gap-2 rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-200 hover:bg-neutral-800"
      >
        <FileUp size={15} />
        Import project JSON
      </button>
    </CollapsibleSection>
  )
}
