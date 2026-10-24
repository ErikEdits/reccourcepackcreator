import { useState, type DragEvent, type ReactNode } from 'react'
import {
  COLOUR_BUCKETS,
  displayName,
  TEXTURE_CATEGORIES,
  wikiUrl,
  type TextureRow,
} from '../../../shared/textures'
import { imageToTexture } from '../lib/images'
import { useProject } from '../store/project'
import { rowImageUrl, useTextures, vanillaTextureUrl } from '../store/textures'
import { useToasts } from '../store/toasts'
import { Button, ErrorText } from './ui'

function statusLabel(row: TextureRow): string {
  if (row.added) return 'Added by your pack'
  return row.changed ? 'Changed in your pack' : 'Original'
}

/** A vertical strip of square frames; only the first frame is shown. */
function isStrip(row: TextureRow): boolean {
  const texture = row.vanilla
  return !!texture && (texture.animated || texture.height >= texture.width * 2)
}

/** Centre column while a texture is selected. */
export function TextureDetail({ row }: { row: TextureRow }) {
  const summary = useProject((state) => state.summary)
  const setSummary = useProject((state) => state.setSummary)
  const select = useTextures((state) => state.select)
  const revision = useTextures((state) => state.revision)
  const bumpRevision = useTextures((state) => state.bumpRevision)
  const pushToast = useToasts((state) => state.push)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)

  const version = summary?.project.minecraftVersion ?? ''
  const resolution = summary?.project.resolution ?? 16
  const targetWidth = row.vanilla
    ? Math.max(1, Math.round((row.vanilla.width * resolution) / 16))
    : null
  const name = displayName(row.name)

  const replace = async (file: File | undefined): Promise<void> => {
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      const png = await imageToTexture(file, targetWidth)
      const result = await window.api.textures.replace(row.path, png)
      if (!result.ok) return setError(result.error)
      setSummary(result.value)
      bumpRevision()
      pushToast('success', `Replaced “${name}”.`)
    } catch {
      setError('This file could not be read as an image.')
    } finally {
      setBusy(false)
    }
  }

  const revert = async (): Promise<void> => {
    const question = row.added
      ? `Remove “${name}” from your pack?`
      : `Revert “${name}” to the original? Your version is deleted from the pack.`
    if (!window.confirm(question)) return
    setError(null)
    const result = await window.api.textures.revert(row.path)
    if (!result.ok) return setError(result.error)
    setSummary(result.value)
    bumpRevision()
    if (row.added) select(null)
  }

  const onDrop = (event: DragEvent): void => {
    event.preventDefault()
    setDragging(false)
    void replace(event.dataTransfer.files[0])
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-line px-4 py-2">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold">{name}</h1>
          <p className="truncate font-mono text-xs text-ink-muted">{row.path}</p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${
            row.changed || row.added ? 'bg-grass/15 text-grass-strong dark:text-grass' : 'bg-line'
          }`}
        >
          {statusLabel(row)}
        </span>
        <Button variant="ghost" className="ml-auto shrink-0" onClick={() => select(null)}>
          Back to pack
        </Button>
      </div>

      <div
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`flex min-h-0 flex-1 flex-col items-center justify-center gap-4 p-6 ${
          dragging ? 'bg-grass/10 outline-2 -outline-offset-8 outline-grass outline-dashed' : ''
        }`}
      >
        <div
          aria-label="Texture preview"
          className="flex size-72 items-center justify-center overflow-hidden rounded-md border border-line bg-raised"
        >
          <img
            src={rowImageUrl(row, version, revision)}
            alt={name}
            draggable={false}
            className={`[image-rendering:pixelated] ${
              isStrip(row) ? 'w-full self-start' : 'size-full object-contain'
            }`}
          />
        </div>
        <p className="text-sm text-ink-muted">
          {busy ? 'Saving…' : 'Drop an image here to replace this texture.'}
        </p>
        {targetWidth && (
          <p className="-mt-3 text-xs text-ink-muted">
            It is scaled to {targetWidth} px wide to match the pack&apos;s {resolution}× resolution.
          </p>
        )}
        <div className="flex gap-2">
          <label className="cursor-pointer rounded-md border border-line bg-raised px-3 py-1.5 text-sm font-medium hover:border-ink-muted">
            Choose image…
            <input
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp,image/bmp"
              aria-label="Choose replacement image"
              className="sr-only"
              onChange={(event) => {
                void replace(event.target.files?.[0])
                event.target.value = ''
              }}
            />
          </label>
          {(row.changed || row.added) && (
            <Button onClick={() => void revert()}>
              {row.added ? 'Remove from pack' : 'Revert to original'}
            </Button>
          )}
        </div>
        {error && <ErrorText>{error}</ErrorText>}
      </div>
    </div>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="text-sm break-words">{children}</dd>
    </div>
  )
}

/** Right column while a texture is selected. */
export function TextureProperties({ row }: { row: TextureRow }) {
  const version = useTextures((state) => state.index?.version ?? '')
  const texture = row.vanilla
  const colour = COLOUR_BUCKETS.find((bucket) => bucket.id === texture?.colour)
  const category = TEXTURE_CATEGORIES.find((entry) => entry.id === row.category)
  const frames = texture?.animated ? Math.floor(texture.height / texture.width) : 0

  return (
    <div className="flex flex-col gap-4 p-4">
      <dl className="flex flex-col gap-3">
        <Row label="Name">{displayName(row.name)}</Row>
        <Row label="File">
          <span className="font-mono text-xs">{row.path}</span>
        </Row>
        <Row label="Category">{category?.name ?? 'Other'}</Row>
        <Row label="Status">{statusLabel(row)}</Row>
        {texture && (
          <Row label="Original size">
            {texture.width} × {texture.height} px
            {frames > 1 && ` (animated, ${frames} frames)`}
          </Row>
        )}
        {colour && (
          <Row label="Colour">
            <span className="inline-flex items-center gap-1.5">
              <span
                className="size-3 rounded-full border border-black/25"
                style={{ backgroundColor: colour.swatch }}
              />
              {colour.name}
            </span>
          </Row>
        )}
      </dl>
      {texture && row.changed && (
        <div className="flex flex-col gap-1">
          <span className="text-xs text-ink-muted">Original</span>
          <div className="size-16 overflow-hidden rounded border border-line bg-canvas">
            <img
              src={vanillaTextureUrl(row.path, version)}
              alt={`Original ${displayName(row.name)}`}
              className="w-full [image-rendering:pixelated]"
            />
          </div>
        </div>
      )}
      <Button
        variant="ghost"
        className="self-start px-0"
        onClick={() => void window.api.shell.openExternal(wikiUrl(row.name))}
      >
        Look it up in the Minecraft Wiki ↗
      </Button>
    </div>
  )
}
