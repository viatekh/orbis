import { useMemo, useState } from 'react'
import * as THREE from 'three'
import { Canvas, type ThreeEvent } from '@react-three/fiber'
import { Bounds, Line, OrbitControls } from '@react-three/drei'
import { trianglesToBufferGeometry } from './meshGeometry'
import { CalibratePanel } from './CalibratePanel'
import { useDesignerStore } from '../../store/designerStore'
import type { ArrangementMeshResult, LayerMesh } from '../../lib/geometry/arrangementMesh'

const DEG_TO_RAD = Math.PI / 180
const MARKER_COLOR = '#ef4444'

/** One color per layer, cycling if there are more layers than colors —
 * distinct enough to tell layers apart at a glance in the 3D preview
 * without needing to hide/solo them. Not tied to material/finish (that's
 * still deferred); purely a "which layer is this" cue. */
const LAYER_COLORS = ['#d9b98f', '#8b5cf6', '#34d399', '#f59e0b', '#60a5fa', '#f472b6', '#facc15', '#fb7185']

function LayerMeshes({
  layerMesh,
  color,
  calibrating,
  onPick,
}: {
  layerMesh: LayerMesh
  color: string
  calibrating: boolean
  onPick: (point: THREE.Vector3) => void
}) {
  const geometry = useMemo(() => trianglesToBufferGeometry(layerMesh.mesh), [layerMesh.mesh])
  const material = useMemo(
    () => new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.05, side: THREE.DoubleSide }),
    [color],
  )

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    if (!calibrating) return
    e.stopPropagation()
    onPick(e.point.clone())
  }

  return (
    <>
      {layerMesh.instances.map((instance, i) => (
        <mesh
          key={i}
          geometry={geometry}
          material={material}
          position={[instance.x, instance.y, instance.z]}
          // 'ZXY' order matches Instance3D's documented composition
          // (rotationZ/facing applied first, then rotationX/tilt, then
          // rotationY) — see its doc comment in lib/geometry/types.ts.
          // Three's default 'XYZ' order would apply them in the wrong
          // sequence.
          rotation={
            new THREE.Euler(instance.rotationX * DEG_TO_RAD, instance.rotationY * DEG_TO_RAD, instance.rotationZ * DEG_TO_RAD, 'ZXY')
          }
          scale={instance.mirrored ? [-1, 1, 1] : [1, 1, 1]}
          onClick={handleClick}
        />
      ))}
    </>
  )
}

function CalibrationMarker({ point }: { point: THREE.Vector3 }) {
  return (
    <mesh position={point}>
      <sphereGeometry args={[8, 16, 16]} />
      <meshBasicMaterial color={MARKER_COLOR} />
    </mesh>
  )
}

/** The 3D counterpart to ArrangementCanvas — renders every layer's real
 * extruded solid, positioned with its full 3D transform (see
 * arrangementMesh.ts), instead of a flat top-down projection. mm is used
 * directly as the world unit — which is also what makes "calibrate scale"
 * possible: a picked point's distance to another, in this same world-unit
 * space, already reads as a real mm measurement with no separate unit
 * conversion. */
export function Arrangement3DView({ arrangementId, mesh }: { arrangementId: string; mesh: ArrangementMeshResult }) {
  const scaleArrangement = useDesignerStore((s) => s.scaleArrangement)
  const [calibrating, setCalibrating] = useState(false)
  const [pointA, setPointA] = useState<THREE.Vector3 | null>(null)
  const [pointB, setPointB] = useState<THREE.Vector3 | null>(null)

  const handlePick = (point: THREE.Vector3) => {
    if (!pointA) setPointA(point)
    else if (!pointB) setPointB(point)
    else {
      // Both already set — a further click starts over from a fresh first
      // point, rather than being ignored (no "reset" step required to
      // re-measure something else).
      setPointA(point)
      setPointB(null)
    }
  }

  const handleToggle = () => {
    setCalibrating((c) => !c)
    setPointA(null)
    setPointB(null)
  }

  const handleApply = (desiredMm: number) => {
    if (!pointA || !pointB) return
    const measuredMm = pointA.distanceTo(pointB)
    if (measuredMm <= 0) return
    scaleArrangement(arrangementId, desiredMm / measuredMm)
    setPointA(null)
    setPointB(null)
    setCalibrating(false)
  }

  const handleCancel = () => {
    setPointA(null)
    setPointB(null)
  }

  return (
    <div className="relative h-full w-full">
      <Canvas
        className="h-full w-full bg-neutral-950"
        camera={{ fov: 50, near: 1, far: 100000, position: [800, -800, 600], up: [0, 0, 1] }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[500, -300, 800]} intensity={1.2} />
        <directionalLight position={[-500, 400, -400]} intensity={0.4} />
        <Bounds fit clip observe margin={1.3}>
          {mesh.layers.map((layerMesh, i) => (
            <LayerMeshes
              key={layerMesh.layerId}
              layerMesh={layerMesh}
              color={LAYER_COLORS[i % LAYER_COLORS.length]}
              calibrating={calibrating}
              onPick={handlePick}
            />
          ))}
        </Bounds>
        {pointA && <CalibrationMarker point={pointA} />}
        {pointB && <CalibrationMarker point={pointB} />}
        {pointA && pointB && <Line points={[pointA, pointB]} color={MARKER_COLOR} lineWidth={2} />}
        <OrbitControls makeDefault />
      </Canvas>
      <CalibratePanel
        calibrating={calibrating}
        onToggle={handleToggle}
        pointA={pointA}
        pointB={pointB}
        onApply={handleApply}
        onCancel={handleCancel}
      />
    </div>
  )
}
