import { useEffect, useState, type DragEvent } from 'react'
import { sanitizeFileName } from '../../../shared/file-names'
import { DEFAULT_LICENSE, PACK_LICENSES, type PackLicenseId } from '../../../shared/licenses'
import { formatLabel, LATEST_VERSION, MINECRAFT_VERSIONS } from '../../../shared/minecraft-versions'
import { packNameSchema, RESOLUTIONS } from '../../../shared/project'
import { imageToPackIcon } from '../lib/pack-icon'
import { useProject } from '../store/project'
import { useToasts } from '../store/toasts'
import { DescriptionEditor } from './DescriptionEditor'
import { PackPreview } from './PackPreview'
import { Button, ErrorText, Field, inputClass, Modal } from './ui'

const STEPS = ['Name', 'Description', 'Version', 'Icon', 'Licence', 'Location'] as const
type Resolution = (typeof RESOLUTIONS)[number]

const newestFirst = [...MINECRAFT_VERSIONS].reverse()

export function NewPackWizard() {
  const setDialog = useProject((state) => state.setDialog)
  const setSummary = useProject((state) => state.setSummary)
  const pushToast = useToasts((state) => state.push)

  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [minecraftVersion, setMinecraftVersion] = useState(LATEST_VERSION.id)
  const [resolution, setResolution] = useState<Resolution>(16)
  const [icon, setIcon] = useState<Uint8Array<ArrayBuffer> | null>(null)
  const [license, setLicense] = useState<PackLicenseId>(DEFAULT_LICENSE)
  const [parentDir, setParentDir] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void window.api.project.defaultLocation().then(setParentDir)
  }, [])

  const nameCheck = packNameSchema.safeParse(name)
  const canContinue = step !== 0 || nameCheck.success
  const isLast = step === STEPS.length - 1
  const close = (): void => setDialog(null)

  const loadIcon = async (file: File | undefined): Promise<void> => {
    if (!file) return
    setError(null)
    try {
      setIcon(await imageToPackIcon(file))
    } catch {
      setError('This file could not be read as an image.')
    }
  }

  const onDrop = (event: DragEvent): void => {
    event.preventDefault()
    void loadIcon(event.dataTransfer.files[0])
  }

  const chooseLocation = async (): Promise<void> => {
    const folder = await window.api.dialog.chooseFolder('project-location')
    if (folder) setParentDir(folder)
  }

  const create = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    const result = await window.api.project.create({
      name: name.trim(),
      description,
      minecraftVersion,
      resolution,
      license,
      parentDir,
      icon,
    })
    setBusy(false)
    if (!result.ok) return setError(result.error)
    setSummary(result.value)
    setDialog(null)
    pushToast('success', `Created “${result.value.project.name}”.`)
  }

  const next = (): void => {
    if (!canContinue) return
    if (isLast) void create()
    else setStep(step + 1)
  }

  const separator = parentDir.includes('\\') ? '\\' : '/'

  return (
    <Modal
      title="New resource pack"
      onClose={close}
      footer={
        <>
          <span className="text-xs text-ink-muted">
            Step {step + 1} of {STEPS.length}
          </span>
          <Button className="ml-auto" disabled={step === 0} onClick={() => setStep(step - 1)}>
            Back
          </Button>
          <Button variant="primary" disabled={!canContinue || busy} onClick={next}>
            {isLast ? (busy ? 'Creating…' : 'Create pack') : 'Next'}
          </Button>
        </>
      }
    >
      <ol className="mb-5 flex gap-1" aria-label="Steps">
        {STEPS.map((label, i) => (
          <li
            key={label}
            aria-current={i === step ? 'step' : undefined}
            className={`flex-1 border-t-4 pt-1 text-xs ${
              i <= step ? 'border-grass text-ink' : 'border-line text-ink-muted'
            }`}
          >
            {label}
          </li>
        ))}
      </ol>

      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault()
          next()
        }}
      >
        {step === 0 && (
          <Field label="Pack name" htmlFor="pack-name" hint="Shown in Minecraft's pack list.">
            <input
              id="pack-name"
              autoFocus
              value={name}
              maxLength={64}
              onChange={(event) => setName(event.target.value)}
              className={inputClass}
              placeholder="My Resource Pack"
            />
          </Field>
        )}

        {step === 1 && (
          <Field
            label="Description"
            htmlFor="pack-description"
            hint="Use the buttons to add colours and styles. Minecraft shows about two lines."
          >
            <DescriptionEditor
              id="pack-description"
              value={description}
              onChange={setDescription}
            />
          </Field>
        )}

        {step === 2 && (
          <>
            <Field
              label="Main Minecraft version"
              htmlFor="pack-version"
              hint="The version you design for. You can still export for every other version."
            >
              <select
                id="pack-version"
                autoFocus
                value={minecraftVersion}
                onChange={(event) => setMinecraftVersion(event.target.value)}
                className={inputClass}
              >
                {newestFirst.map((version) => (
                  <option key={version.id} value={version.id}>
                    {version.id} (pack format {formatLabel(version.format)})
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label="Texture resolution"
              hint="16× is the vanilla look. Single textures can differ later."
            >
              <div
                role="radiogroup"
                aria-label="Texture resolution"
                className="flex flex-wrap gap-1"
              >
                {RESOLUTIONS.map((value) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={resolution === value}
                    onClick={() => setResolution(value)}
                    className="rounded-md border border-line px-3 py-1 text-sm aria-checked:border-grass aria-checked:bg-grass aria-checked:text-white"
                  >
                    {value}×
                  </button>
                ))}
              </div>
            </Field>
          </>
        )}

        {step === 3 && (
          <Field
            label="Pack icon"
            hint="Optional. Any image works; it is cropped to a square and saved as pack.png."
          >
            <label
              onDragOver={(event) => event.preventDefault()}
              onDrop={onDrop}
              className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-line p-6 text-center text-sm text-ink-muted hover:border-grass"
            >
              <span>Drop an image here or click to choose one</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp,image/bmp"
                className="sr-only"
                aria-label="Choose pack icon"
                onChange={(event) => void loadIcon(event.target.files?.[0])}
              />
            </label>
            {icon && (
              <Button variant="ghost" className="self-start" onClick={() => setIcon(null)}>
                Remove icon
              </Button>
            )}
          </Field>
        )}

        {step === 4 && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">Licence</legend>
            {PACK_LICENSES.map((option) => (
              <label
                key={option.id}
                className="flex cursor-pointer gap-3 rounded-md border border-line p-2 has-checked:border-grass"
              >
                <input
                  type="radio"
                  name="license"
                  value={option.id}
                  checked={license === option.id}
                  onChange={() => setLicense(option.id)}
                  className="mt-1 accent-grass"
                />
                <span>
                  <span className="block text-sm font-medium">{option.name}</span>
                  <span className="block text-xs text-ink-muted">{option.summary}</span>
                </span>
              </label>
            ))}
          </fieldset>
        )}

        {step === 5 && (
          <Field
            label="Location"
            hint="The pack is created as a folder that Minecraft can load directly."
          >
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-md border border-line bg-raised px-3 py-1.5 text-xs">
                {parentDir}
                {separator}
                {sanitizeFileName(name)}
              </code>
              <Button onClick={() => void chooseLocation()}>Change…</Button>
            </div>
          </Field>
        )}

        {step > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Preview</span>
            <PackPreview name={name} description={description} icon={icon} />
          </div>
        )}

        {step === 0 && name.length > 0 && !nameCheck.success && (
          <ErrorText>{nameCheck.error.issues[0]?.message}</ErrorText>
        )}
        {error && <ErrorText>{error}</ErrorText>}
      </form>
    </Modal>
  )
}
