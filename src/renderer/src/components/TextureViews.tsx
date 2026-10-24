import type { ReactNode } from 'react'
import {
  COLOUR_BUCKETS,
  displayName,
  TEXTURE_CATEGORIES,
  wikiUrl,
  type TextureRow,
} from '../../../shared/textures'
import { statusLabel, useTextures, vanillaTextureUrl } from '../store/textures'
import { Button } from './ui'

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="text-sm break-words">{children}</dd>
    </div>
  )
}

/** Facts about a texture, shown below the editor's panels. */
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
