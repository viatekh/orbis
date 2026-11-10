import { useMemo, useState } from 'react'
import { Bug } from 'lucide-react'
import { useDesignerStore } from '../store/designerStore'
import { useUiSettingsStore } from '../store/uiSettingsStore'
import { cn } from '../lib/utils'
import { useComponentGeometry } from '../hooks/useComponentGeometry'
import { useArrangementGeometry } from '../hooks/useArrangementGeometry'
import { useArrangementMesh } from '../hooks/useArrangementMesh'
import { DesignCanvas } from '../components/canvas/DesignCanvas'
import { ArrangementCanvas } from '../components/canvas/ArrangementCanvas'
import { Arrangement3DView } from '../components/canvas3d/Arrangement3DView'
import { CanvasOverlay } from '../components/canvas/CanvasOverlay'
import { ComponentListPanel } from '../components/panels/ComponentListPanel'
import { ArrangementListPanel } from '../components/panels/ArrangementListPanel'
import { LayersPanel } from '../components/panels/LayersPanel'
import { GeneratorPanel } from '../components/panels/GeneratorPanel'
import { ShapePanel } from '../components/panels/ShapePanel'
import { CenterHolePanel } from '../components/panels/CenterHolePanel'
import { PatternPanel } from '../components/panels/PatternPanel'
import { FabricationPanel } from '../components/panels/FabricationPanel'
import { ExportPanel } from '../components/panels/ExportPanel'
import { ArrangementExportPanel } from '../components/panels/ArrangementExportPanel'
import { RandomizeAllButton } from '../components/panels/RandomizeAllButton'
import { RatingPanel } from '../components/panels/RatingPanel'
import { InsightsPanel } from '../components/panels/InsightsPanel'
import { SegmentedControl } from '../components/shared/SegmentedControl'

type PageMode = 'components' | 'arrangements'

function EmptyState({ text, error }: { text: string; error?: boolean }) {
  return (
    <div className={cn('flex h-full items-center justify-center px-8 text-center', error ? 'text-red-400' : 'text-neutral-500')}>
      {text}
    </div>
  )
}

export function DesignerPage() {
  const [pageMode, setPageMode] = useState<PageMode>('components')

  const debugMode = useUiSettingsStore((s) => s.debugMode)
  const toggleDebugMode = useUiSettingsStore((s) => s.toggleDebugMode)

  const components = useDesignerStore((s) => s.project.components)
  const updateShape = useDesignerStore((s) => s.updateShape)
  const activeComponentId = useDesignerStore((s) => s.activeComponentId)
  const arrangements = useDesignerStore((s) => s.project.arrangements)
  const activeArrangementId = useDesignerStore((s) => s.activeArrangementId)
  const activeLayerId = useDesignerStore((s) => s.activeLayerId)
  const canvasViewMode = useDesignerStore((s) => s.canvasViewMode)
  const setCanvasViewMode = useDesignerStore((s) => s.setCanvasViewMode)

  const activeComponent = useMemo(
    () => components.find((c) => c.id === activeComponentId) ?? components[0] ?? null,
    [components, activeComponentId],
  )
  const { geometry: activeComponentGeometry, error: activeComponentError } = useComponentGeometry(activeComponent)

  const activeArrangement = useMemo(
    () => arrangements.find((a) => a.id === activeArrangementId) ?? null,
    [arrangements, activeArrangementId],
  )
  const { geometry: arrangementGeometry, error: arrangementError } = useArrangementGeometry(activeArrangement, components)
  const { mesh: arrangementMesh, error: arrangementMeshError } = useArrangementMesh(
    canvasViewMode === '3d' ? activeArrangement : null,
    components,
  )

  const activeLayer = useMemo(
    () => activeArrangement?.layers.find((l) => l.id === activeLayerId) ?? null,
    [activeArrangement, activeLayerId],
  )
  const layerComponent = useMemo(
    () => (activeLayer ? (components.find((c) => c.id === activeLayer.componentId) ?? null) : null),
    [activeLayer, components],
  )
  const { geometry: layerComponentGeometry, error: layerComponentError } = useComponentGeometry(layerComponent)

  return (
    <div className="flex h-full w-full text-neutral-100">
      <aside className="flex w-64 flex-col gap-4 overflow-y-auto border-r border-neutral-800 bg-neutral-900 p-4">
        <div>
          <h1 className="text-base font-semibold">Stage Set Designer</h1>
          <p className="text-xs text-neutral-500">Parametric panel components</p>
        </div>

        <button
          type="button"
          onClick={toggleDebugMode}
          className={cn(
            'flex items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-xs transition-colors',
            debugMode
              ? 'border-amber-500 bg-amber-500/10 text-amber-300'
              : 'border-neutral-700 text-neutral-400 hover:bg-neutral-800',
          )}
          title="Reveal a hide/show toggle on every control, so you can declutter which ones stay visible"
        >
          <Bug size={12} />
          Debug mode: {debugMode ? 'on' : 'off'}
        </button>

        <SegmentedControl
          value={pageMode}
          options={[
            { value: 'components', label: 'Components' },
            { value: 'arrangements', label: 'Arrangements' },
          ]}
          onChange={setPageMode}
        />

        {pageMode === 'components' ? (
          <ComponentListPanel />
        ) : (
          <>
            <ArrangementListPanel />
            {activeArrangement && (
              <>
                <div className="h-px bg-neutral-800" />
                <LayersPanel arrangement={activeArrangement} />
              </>
            )}
          </>
        )}

        {debugMode && (
          <>
            <div className="h-px bg-neutral-800" />
            <InsightsPanel />
          </>
        )}
      </aside>

      <main className="relative flex-1 bg-neutral-950">
        {pageMode === 'components' &&
          (activeComponent && activeComponentGeometry ? (
            <>
              <DesignCanvas
                geometry={activeComponentGeometry}
                mode={activeComponent.pattern.mode}
                recenterKey={activeComponent.id}
                shape={activeComponent.shape}
                onShapeChange={(shape) => updateShape(activeComponent.id, shape)}
              />
              <CanvasOverlay geometry={activeComponentGeometry} />
            </>
          ) : activeComponent && activeComponentError ? (
            <EmptyState text={activeComponentError} error />
          ) : (
            <EmptyState text="No component selected" />
          ))}

        {pageMode === 'arrangements' &&
          (activeArrangement ? (
            <>
              <div className="pointer-events-none absolute left-3 top-3 z-10">
                <div className="pointer-events-auto">
                  <SegmentedControl
                    value={canvasViewMode}
                    options={[
                      { value: '3d', label: '3D' },
                      { value: 'flat', label: 'Flat layers' },
                      { value: 'closeup', label: 'Close-up' },
                    ]}
                    onChange={setCanvasViewMode}
                  />
                </div>
              </div>

              {canvasViewMode === '3d' &&
                (arrangementMesh ? (
                  <Arrangement3DView arrangementId={activeArrangement.id} mesh={arrangementMesh} />
                ) : arrangementMeshError ? (
                  <EmptyState text={arrangementMeshError} error />
                ) : (
                  <EmptyState text="Building 3D preview…" />
                ))}

              {canvasViewMode === 'flat' &&
                (arrangementGeometry ? (
                  <ArrangementCanvas geometry={arrangementGeometry} recenterKey={activeArrangement.id} />
                ) : (
                  arrangementError && <EmptyState text={arrangementError} error />
                ))}

              {canvasViewMode === 'closeup' &&
                (layerComponent && layerComponentGeometry ? (
                  <>
                    <DesignCanvas
                      geometry={layerComponentGeometry}
                      mode={layerComponent.pattern.mode}
                      recenterKey={layerComponent.id}
                      shape={layerComponent.shape}
                      onShapeChange={(shape) => updateShape(layerComponent.id, shape)}
                    />
                    <CanvasOverlay geometry={layerComponentGeometry} />
                  </>
                ) : layerComponent && layerComponentError ? (
                  <EmptyState text={layerComponentError} error />
                ) : (
                  <EmptyState text="Select a layer to see its component up close" />
                ))}
            </>
          ) : (
            <EmptyState text="Create an arrangement to get started" />
          ))}
      </main>

      <aside className="flex w-80 flex-col gap-6 overflow-y-auto border-l border-neutral-800 bg-neutral-900 p-4">
        {pageMode === 'components' &&
          activeComponent &&
          activeComponentGeometry && (
            <>
              <RandomizeAllButton component={activeComponent} />
              <RatingPanel component={activeComponent} geometry={activeComponentGeometry} />
              <ShapePanel component={activeComponent} />
              <div className="h-px bg-neutral-800" />
              <CenterHolePanel component={activeComponent} />
              <div className="h-px bg-neutral-800" />
              <PatternPanel component={activeComponent} />
              <div className="h-px bg-neutral-800" />
              <FabricationPanel component={activeComponent} />
              <div className="h-px bg-neutral-800" />
              <ExportPanel component={activeComponent} geometry={activeComponentGeometry} />
            </>
          )}

        {pageMode === 'arrangements' && activeArrangement && arrangementGeometry && (
          <>
            {activeLayer && (
              <>
                <GeneratorPanel arrangement={activeArrangement} layer={activeLayer} />
                {layerComponent && (
                  <>
                    <div className="h-px bg-neutral-800" />
                    <RandomizeAllButton component={layerComponent} />
                    <RatingPanel component={layerComponent} geometry={layerComponentGeometry} />
                    <ShapePanel component={layerComponent} />
                    <div className="h-px bg-neutral-800" />
                    <CenterHolePanel component={layerComponent} />
                    <div className="h-px bg-neutral-800" />
                    <PatternPanel component={layerComponent} />
                    <div className="h-px bg-neutral-800" />
                    <FabricationPanel component={layerComponent} />
                  </>
                )}
                <div className="h-px bg-neutral-800" />
              </>
            )}
            <ArrangementExportPanel arrangement={activeArrangement} geometry={arrangementGeometry} />
          </>
        )}
      </aside>
    </div>
  )
}
