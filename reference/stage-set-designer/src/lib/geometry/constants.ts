import type {
  DispersionConfig,
  EdgeDetailConfig,
  PatternConfig,
  RadialModulationConfig,
  RecursionConfig,
  ShapePrimitive,
  StampConfig,
  SurfaceDetailConfig,
  SurfaceDetailPatternConfig,
} from './types'

// Clipper2 decimal precision (4 = 0.1 micron at mm scale) and arc tessellation
// tolerance — well under laser kerf (~0.15mm), so polygon approximation of
// rounded corners never becomes the visible bottleneck.
export const PRECISION = 4
export const ARC_TOLERANCE = 0.05

// A boundary smaller than this (mm^2) is treated as degenerate and recursion
// stops rather than churning on slivers.
export const MIN_BOUNDARY_AREA = 1

// Segment count used to tessellate smooth shape outlines (superellipse,
// blob) into polygons — high enough that the facets are invisible at
// fabrication scale, without bloating exported path data.
export const CURVE_SEGMENTS = 128

export const DEFAULT_SHAPE: ShapePrimitive = {
  kind: 'rect',
  width: 300,
  height: 200,
  cornerRadius: 0,
}

export const DEFAULT_CENTER_HOLE_SHAPE: ShapePrimitive = {
  kind: 'regularPolygon',
  sides: 32,
  radius: 40,
  rotation: 0,
  cornerRadius: 0,
}

export const DEFAULT_RECURSION_CONFIG: RecursionConfig = {
  depth: 0,
  childScale: 0.4,
  strutFalloff: 0.7,
  minCellArea: 40,
  maxLeafCells: 6000,
}

export const DEFAULT_RADIAL_MODULATION: RadialModulationConfig = {
  enabled: false,
  sizeStart: 1,
  sizeEnd: 1,
  orientToCenter: false,
  swirlAmount: 0,
  pinchAmount: 0,
  stretchAmount: 0,
}

export const DEFAULT_DISPERSION: DispersionConfig = {
  enabled: false,
  sizeVariance: 0.3,
  distanceVariance: 0.3,
}

export const DEFAULT_STAMP_CONFIG: StampConfig = {
  shape: { kind: 'regularPolygon', sides: 6, radius: 10, rotation: 0, cornerRadius: 0 },
  ringSpacing: 0,
  autoOrient: true,
  ringStagger: 0,
}

// Smaller cell size and thinner lines than the main pattern defaults — a
// detail layer is meant to read as fine decorative trace-work, not another
// structural lattice.
export const DEFAULT_SURFACE_DETAIL_PATTERN: SurfaceDetailPatternConfig = {
  kind: 'voronoi',
  cellSize: 8,
  jitter: 0.6,
  seed: 1,
  symmetryCount: 1,
  mirrorSymmetry: false,
  mirrorHorizontal: true,
  mirrorVertical: false,
  hexOrientation: 'flat',
  edgeMargin: 5,
  strutWidth: 1,
  minStrutWidth: 0.5,
  kerf: 0,
  cornerStyle: 'round',
  recursion: { ...DEFAULT_RECURSION_CONFIG, minCellArea: 10, maxLeafCells: 3000 },
  trimSlivers: true,
  sliverAreaRatio: 0.25,
  radialModulation: { ...DEFAULT_RADIAL_MODULATION },
  dispersion: { ...DEFAULT_DISPERSION },
  stamp: { ...DEFAULT_STAMP_CONFIG },
}

export const DEFAULT_SURFACE_DETAIL: SurfaceDetailConfig = {
  enabled: false,
  pattern: { ...DEFAULT_SURFACE_DETAIL_PATTERN },
}

export const DEFAULT_EDGE_DETAIL: EdgeDetailConfig = {
  enabled: false,
  kind: 'dots',
  mode: 'cut',
  spacing: 15,
  size: 6,
  offset: 3,
}

export const DEFAULT_PATTERN_CONFIG: PatternConfig = {
  kind: 'voronoi',
  mode: 'cut',
  cellSize: 25,
  jitter: 0.6,
  seed: 1,
  symmetryCount: 1,
  mirrorSymmetry: false,
  mirrorHorizontal: true,
  mirrorVertical: false,
  hexOrientation: 'flat',
  edgeMargin: 10,
  strutWidth: 3,
  minStrutWidth: 1.5,
  kerf: 0,
  cornerStyle: 'round',
  recursion: { ...DEFAULT_RECURSION_CONFIG },
  trimSlivers: true,
  sliverAreaRatio: 0.25,
  keepAllLevelsInCut: false,
  radialModulation: { ...DEFAULT_RADIAL_MODULATION },
  dispersion: { ...DEFAULT_DISPERSION },
  stamp: { ...DEFAULT_STAMP_CONFIG },
  nullShape: false,
  explodeAmount: 0,
  surfaceDetail: { enabled: false, pattern: { ...DEFAULT_SURFACE_DETAIL_PATTERN } },
  edgeDetail: { ...DEFAULT_EDGE_DETAIL },
}
