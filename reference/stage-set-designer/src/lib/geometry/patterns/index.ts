import type { PatternKind } from '../types'
import type { PatternGenerator } from './types'
import { generateVoronoiCells } from './voronoi'
import { generateHexCells } from './hexagon'
import { generateStampCells } from './stamp'
import { generateVeinCells } from './vein'
import { generateFlowCells } from './flow'
import { generateCircuitCells } from './circuit'
import { generateMantaCells } from './manta'
import { generateScaleCells } from './scales'
import { generateRungCells } from './rungs'
import { generateMazeCells } from './maze'
import { generateSierpinskiCells } from './sierpinski'
import { generateTruchetCells } from './truchet'
import { generateZebraCells } from './zebra'
import { generateStaggerCells } from './stagger'
import { generateMarbleCells } from './marble'
import { generateVesicaCells } from './vesica'
import { generatePhylloCells } from './phyllo'
import { generateRingCells } from './rings'
import { generateHilbertCells } from './hilbert'
import { generateLifeCells } from './life'

export const PATTERN_GENERATORS: Record<PatternKind, PatternGenerator> = {
  voronoi: generateVoronoiCells,
  hexagon: generateHexCells,
  stamp: generateStampCells,
  vein: generateVeinCells,
  flow: generateFlowCells,
  circuit: generateCircuitCells,
  manta: generateMantaCells,
  scales: generateScaleCells,
  rungs: generateRungCells,
  maze: generateMazeCells,
  sierpinski: generateSierpinskiCells,
  truchet: generateTruchetCells,
  zebra: generateZebraCells,
  stagger: generateStaggerCells,
  marble: generateMarbleCells,
  vesica: generateVesicaCells,
  phyllo: generatePhylloCells,
  rings: generateRingCells,
  hilbert: generateHilbertCells,
  life: generateLifeCells,
}

export type { PatternContext, PatternGenerator } from './types'
