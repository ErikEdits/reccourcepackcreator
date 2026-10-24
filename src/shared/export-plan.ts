import { renderFileNameTemplate } from './file-names'
import {
  formatLabel,
  groupByFormat,
  MINECRAFT_VERSIONS,
  versionRangeLabel,
  type MinecraftVersion,
} from './minecraft-versions'
import type { ExportRequest, ProjectFile } from './project'
import { renameEra } from './texture-renames'

export interface ExportUnit {
  /** Oldest first; all share one pack format and the same texture names. */
  versions: MinecraftVersion[]
  fileName: string
}

export interface ExportPlan {
  units: ExportUnit[]
  /** True if two ZIPs would get the same file name. */
  hasDuplicateNames: boolean
}

/** Splits a run of same-format versions where texture names change (1.6.4 → 1.7.2). */
function splitByRenameEra(versions: MinecraftVersion[]): MinecraftVersion[][] {
  const runs: MinecraftVersion[][] = []
  for (const version of versions) {
    const last = runs[runs.length - 1]
    if (last && renameEra(last[0].id) === renameEra(version.id)) last.push(version)
    else runs.push([version])
  }
  return runs
}

/** Works out which ZIPs an export produces. Shared so the dialog can preview the file names. */
export function planExport(
  project: Pick<ProjectFile, 'name' | 'packVersion'>,
  request: Pick<ExportRequest, 'versions' | 'combineSameFormat' | 'fileNameTemplate'>,
): ExportPlan {
  const wanted = new Set(request.versions)
  const selected = MINECRAFT_VERSIONS.filter((version) => wanted.has(version.id))
  const groups = request.combineSameFormat
    ? groupByFormat(selected).flatMap((group) => splitByRenameEra(group.versions))
    : selected.map((version) => [version])

  const units = groups.map((versions) => ({
    versions,
    fileName: renderFileNameTemplate(request.fileNameTemplate, {
      name: project.name,
      packVersion: project.packVersion,
      mc: versionRangeLabel(versions),
      format: formatLabel(versions[0].format),
    }),
  }))

  const names = new Set(units.map((unit) => unit.fileName.toLowerCase()))
  return { units, hasDuplicateNames: names.size !== units.length }
}
