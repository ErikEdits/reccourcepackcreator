import { PACK_LICENSES } from '../../../shared/licenses'
import { findVersion, formatLabel } from '../../../shared/minecraft-versions'
import type { ProjectSummary } from '../../../shared/project'
import { useProject } from '../store/project'
import { PackPreview } from './PackPreview'
import { Button } from './ui'

/** Centre column while a pack is open. */
export function ProjectOverview({ summary }: { summary: ProjectSummary }) {
  const setDialog = useProject((state) => state.setDialog)
  const closeProject = useProject((state) => state.closeProject)
  const { project } = summary

  return (
    <div className="mx-auto flex h-full max-w-xl flex-col justify-center gap-5 p-8">
      <div>
        <h1 className="text-xl font-semibold">{project.name}</h1>
        <p className="truncate text-xs text-ink-muted">{summary.dir}</p>
      </div>
      <PackPreview name={project.name} description={project.description} icon={summary.icon} />
      <div className="flex gap-2">
        <Button variant="primary" onClick={() => setDialog('export')}>
          Export…
        </Button>
        <Button variant="ghost" onClick={() => void closeProject()}>
          Close pack
        </Button>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="text-sm break-words">{value}</dd>
    </div>
  )
}

/** Right column while a pack is open and no texture is selected. */
export function PackProperties({ summary }: { summary: ProjectSummary }) {
  const { project } = summary
  const version = findVersion(project.minecraftVersion)
  const license = PACK_LICENSES.find((option) => option.id === project.license)

  return (
    <dl className="flex flex-col gap-3 p-4">
      <Row label="Name" value={project.name} />
      <Row label="Pack version" value={project.packVersion} />
      <Row
        label="Main Minecraft version"
        value={`${project.minecraftVersion}${version ? ` (pack format ${formatLabel(version.format)})` : ''}`}
      />
      <Row label="Texture resolution" value={`${project.resolution}×`} />
      <Row label="Licence" value={license?.name ?? project.license} />
      <Row label="Files" value={String(summary.files.length)} />
    </dl>
  )
}

/** Expert-mode file list. */
export function FileList({ files }: { files: string[] }) {
  return (
    <ul aria-label="Pack files" className="p-2 font-mono text-xs">
      {files.map((file) => (
        <li key={file} className="truncate rounded px-2 py-0.5 hover:bg-raised">
          {file}
        </li>
      ))}
    </ul>
  )
}
