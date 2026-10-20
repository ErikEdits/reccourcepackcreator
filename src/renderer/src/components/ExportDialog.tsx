import { useState } from 'react'
import { planExport } from '../../../shared/export-plan'
import {
  formatLabel,
  groupByFormat,
  MINECRAFT_VERSIONS,
  versionRangeLabel,
} from '../../../shared/minecraft-versions'
import { DEFAULT_FILE_NAME_TEMPLATE, type ProjectSummary } from '../../../shared/project'
import { playChime } from '../lib/chime'
import { useProject } from '../store/project'
import { useToasts } from '../store/toasts'
import { Button, ErrorText, Field, inputClass, Modal } from './ui'

const groupsNewestFirst = groupByFormat(MINECRAFT_VERSIONS).reverse()
const ALL_IDS = MINECRAFT_VERSIONS.map((version) => version.id)

export function ExportDialog({ summary }: { summary: ProjectSummary }) {
  const setDialog = useProject((state) => state.setDialog)
  const pushToast = useToasts((state) => state.push)

  const [selected, setSelected] = useState<Set<string>>(
    () => new Set([summary.project.minecraftVersion]),
  )
  const [combineSameFormat, setCombineSameFormat] = useState(false)
  const [destination, setDestination] = useState<string | null>(null)
  const [fileNameTemplate, setFileNameTemplate] = useState(DEFAULT_FILE_NAME_TEMPLATE)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const versions = ALL_IDS.filter((id) => selected.has(id))
  const plan = planExport(summary.project, { versions, combineSameFormat, fileNameTemplate })
  const canExport = versions.length > 0 && fileNameTemplate.trim() !== '' && !plan.hasDuplicateNames

  const toggle = (ids: string[], on: boolean): void => {
    const next = new Set(selected)
    for (const id of ids) {
      if (on) next.add(id)
      else next.delete(id)
    }
    setSelected(next)
  }

  const chooseDestination = async (): Promise<void> => {
    const folder = await window.api.dialog.chooseFolder('export-destination')
    if (folder) setDestination(folder)
  }

  const runExport = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    const result = await window.api.project.export({
      versions,
      combineSameFormat,
      destination,
      fileNameTemplate,
    })
    setBusy(false)
    if (!result.ok) return setError(result.error)
    const count = result.value.files.length
    playChime()
    pushToast(
      'success',
      `Exported ${count} ZIP ${count === 1 ? 'file' : 'files'} to ${result.value.directory}.`,
    )
    setDialog(null)
  }

  return (
    <Modal
      title="Export pack"
      width="max-w-3xl"
      onClose={() => setDialog(null)}
      footer={
        <>
          <span className="text-xs text-ink-muted">
            {plan.units.length} ZIP {plan.units.length === 1 ? 'file' : 'files'}
          </span>
          <Button className="ml-auto" onClick={() => setDialog(null)}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!canExport || busy} onClick={() => void runExport()}>
            {busy ? 'Exporting…' : 'Export'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {summary.warnings.length > 0 && (
          <ul
            aria-label="Warnings"
            className="rounded-md border border-dirt/50 bg-dirt/10 p-3 text-sm"
          >
            {summary.warnings.map((warning) => (
              <li key={warning}>⚠ {warning}</li>
            ))}
          </ul>
        )}

        <section aria-label="Minecraft versions" className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="mr-auto text-sm font-medium">Minecraft versions</h3>
            <Button onClick={() => setSelected(new Set([summary.project.minecraftVersion]))}>
              Only {summary.project.minecraftVersion}
            </Button>
            <Button onClick={() => setSelected(new Set(ALL_IDS))}>All versions</Button>
            <Button onClick={() => setSelected(new Set())}>None</Button>
          </div>
          <div className="max-h-64 overflow-auto rounded-md border border-line">
            {groupsNewestFirst.map((group) => {
              const ids = group.versions.map((version) => version.id)
              const all = ids.every((id) => selected.has(id))
              return (
                <div
                  key={formatLabel(group.format)}
                  className="flex gap-3 border-b border-line px-3 py-2 last:border-b-0"
                >
                  <label className="flex w-40 shrink-0 items-start gap-2 text-xs text-ink-muted">
                    <input
                      type="checkbox"
                      checked={all}
                      onChange={(event) => toggle(ids, event.target.checked)}
                      aria-label={`All versions with pack format ${formatLabel(group.format)}`}
                      className="mt-0.5 accent-grass"
                    />
                    <span>
                      Format {formatLabel(group.format)}
                      <br />
                      {versionRangeLabel(group.versions)}
                    </span>
                  </label>
                  <div className="flex flex-wrap gap-1">
                    {[...group.versions].reverse().map((version) => (
                      <label
                        key={version.id}
                        className="flex cursor-pointer items-center gap-1 rounded border border-line px-1.5 py-0.5 text-xs has-checked:border-grass has-checked:bg-grass/15"
                      >
                        <input
                          type="checkbox"
                          checked={selected.has(version.id)}
                          onChange={(event) => toggle([version.id], event.target.checked)}
                          className="accent-grass"
                        />
                        {version.id}
                      </label>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={combineSameFormat}
              onChange={(event) => setCombineSameFormat(event.target.checked)}
              className="accent-grass"
            />
            One ZIP per pack format instead of one per version (fewer, identical files)
          </label>
        </section>

        <Field label="Save to">
          <div className="flex flex-col gap-1.5 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="destination"
                checked={destination === null}
                onChange={() => setDestination(null)}
                className="accent-grass"
              />
              Downloads folder
            </label>
            <div className="flex items-center gap-2">
              <input
                type="radio"
                name="destination"
                aria-label="Other folder"
                checked={destination !== null}
                onChange={() => void chooseDestination()}
                className="accent-grass"
              />
              <code className="min-w-0 flex-1 truncate text-xs text-ink-muted">
                {destination ?? 'Other folder'}
              </code>
              <Button onClick={() => void chooseDestination()}>Choose…</Button>
            </div>
          </div>
        </Field>

        <Field
          label="File name"
          htmlFor="export-file-name"
          hint={
            <>
              Placeholders: <code>{'{name}'}</code>, <code>{'{packVersion}'}</code>,{' '}
              <code>{'{mc}'}</code> (Minecraft version), <code>{'{format}'}</code>.
            </>
          }
        >
          <input
            id="export-file-name"
            value={fileNameTemplate}
            onChange={(event) => setFileNameTemplate(event.target.value)}
            className={`${inputClass} font-mono`}
          />
        </Field>

        {plan.units.length > 0 && (
          <div className="text-xs text-ink-muted">
            <p className="mb-1 font-medium text-ink">Files</p>
            <ul aria-label="Files to create" className="font-mono">
              {plan.units.slice(0, 4).map((unit) => (
                <li key={unit.fileName}>{unit.fileName}</li>
              ))}
              {plan.units.length > 4 && <li>… and {plan.units.length - 4} more</li>}
            </ul>
          </div>
        )}

        {plan.hasDuplicateNames && (
          <ErrorText>
            Several ZIPs would get the same name. Add {'{mc}'} to the file name.
          </ErrorText>
        )}
        {error && <ErrorText>{error}</ErrorText>}
      </div>
    </Modal>
  )
}
