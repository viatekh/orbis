import { downloadJSON, loadJSONFile } from '../utils'
import { backfillProject } from '../migration/backfillProject'
import type { Project } from '../../types'

export function exportProject(project: Project) {
  downloadJSON({ ...project, schemaVersion: 2 }, `${project.name || 'stage-project'}.json`)
}

export async function importProject(): Promise<Project> {
  const data = (await loadJSONFile()) as Partial<Project>
  if ((data.schemaVersion !== 1 && data.schemaVersion !== 2) || !Array.isArray(data.components)) {
    throw new Error('Unrecognized project file format.')
  }
  // Runs the same field backfill localStorage projects get via the store's
  // persist `migrate` hook — a v1 file predates ArrangementLayer's
  // `generator` field (and 16 earlier rounds of backfill), so without this
  // an old export would crash downstream on `undefined` fields.
  return backfillProject(data)
}
