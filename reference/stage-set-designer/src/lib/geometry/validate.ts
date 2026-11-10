import type { GeometryWarning, PatternConfig } from './types'

export function validateFabrication(config: PatternConfig, truncated: boolean, leafCount: number): GeometryWarning[] {
  const warnings: GeometryWarning[] = []

  if (truncated) {
    warnings.push({
      code: 'budget-truncated',
      message: 'Cell budget reached — reduce depth or increase cell size.',
    })
  }

  if (leafCount === 0) {
    warnings.push({
      code: 'no-cells-generated',
      message: 'No pattern cells were generated for this configuration.',
    })
  }

  if (config.edgeMargin < config.strutWidth / 2) {
    warnings.push({
      code: 'edge-margin-too-small',
      message: 'Edge margin is smaller than half the strut width — cells may touch the outline.',
    })
  }

  if (config.strutWidth < config.minStrutWidth) {
    warnings.push({
      code: 'strut-below-minimum',
      message: 'Strut width is below the configured material minimum.',
    })
  }

  return warnings
}
