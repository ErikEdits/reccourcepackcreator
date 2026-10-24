import { useMemo } from 'react'
import {
  COLOUR_BUCKETS,
  displayName,
  filterTextureRows,
  TEXTURE_CATEGORIES,
  type TextureCategory,
  type TextureRow,
} from '../../../shared/textures'
import { formatCount, formatMegabytes } from '../lib/format'
import { useProject } from '../store/project'
import { useSettings, type TextureView } from '../store/settings'
import { rowImageUrl, useTextureRows, useTextures } from '../store/textures'
import { EmptyState } from './Panel'
import { Button, inputClass } from './ui'

function rowLabel(row: TextureRow): string {
  const status = row.changed ? ', changed' : row.added ? ', added by pack' : ''
  return `${displayName(row.name)}${status}`
}

function Loading() {
  const version = useProject((state) => state.summary?.project.minecraftVersion)
  const progress = useTextures((state) => state.progress)
  const percent = progress && progress.total > 0 ? (progress.received / progress.total) * 100 : 0

  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
      <p className="text-sm font-medium">Loading Minecraft {version} textures…</p>
      {progress ? (
        <>
          <div
            role="progressbar"
            aria-label="Download progress"
            aria-valuenow={Math.round(percent)}
            className="h-1.5 w-full overflow-hidden rounded-full bg-line"
          >
            <div className="h-full bg-grass" style={{ width: `${percent}%` }} />
          </div>
          <p className="text-xs text-ink-muted">
            Downloading the game files from Mojang: {formatMegabytes(progress.received)} of{' '}
            {formatMegabytes(progress.total)}
          </p>
        </>
      ) : (
        <p className="text-xs text-ink-muted">Reading the game files…</p>
      )}
    </div>
  )
}

function ViewToggle() {
  const view = useSettings((state) => state.textureView)
  const setView = useSettings((state) => state.setTextureView)
  const options: { value: TextureView; label: string; icon: string }[] = [
    { value: 'grid', label: 'Grid view', icon: '▦' },
    { value: 'list', label: 'List view', icon: '☰' },
  ]
  return (
    <div role="group" aria-label="View" className="flex rounded-md border border-line">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-label={option.label}
          title={option.label}
          aria-pressed={view === option.value}
          onClick={() => setView(option.value)}
          className="px-1.5 text-sm leading-6 text-ink-muted aria-pressed:bg-raised aria-pressed:text-ink"
        >
          {option.icon}
        </button>
      ))}
    </div>
  )
}

function Filters() {
  const filters = useTextures((state) => state.filters)
  const setFilters = useTextures((state) => state.setFilters)

  return (
    <div className="flex flex-col gap-2 border-b border-line p-2">
      <input
        type="search"
        aria-label="Search textures"
        placeholder="Search textures"
        value={filters.query}
        onChange={(event) => setFilters({ query: event.target.value })}
        className={`${inputClass} py-1`}
      />
      <div className="flex items-center gap-1">
        <select
          aria-label="Category"
          value={filters.category}
          onChange={(event) =>
            setFilters({ category: event.target.value as TextureCategory | 'all' })
          }
          className={`${inputClass} min-w-0 flex-1 px-2 py-1 text-xs`}
        >
          <option value="all">All categories</option>
          {TEXTURE_CATEGORIES.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          aria-pressed={filters.changedOnly}
          onClick={() => setFilters({ changedOnly: !filters.changedOnly })}
          title="Show only textures your pack changes or adds"
          className="rounded-md border border-line px-2 text-xs leading-6 text-ink-muted aria-pressed:border-grass aria-pressed:bg-grass aria-pressed:text-white"
        >
          Changed
        </button>
        <ViewToggle />
      </div>
      <div role="radiogroup" aria-label="Colour" className="flex flex-wrap items-center gap-1">
        <button
          type="button"
          role="radio"
          aria-checked={filters.colour === 'any'}
          aria-label="Any colour"
          title="Any colour"
          onClick={() => setFilters({ colour: 'any' })}
          className="h-4 rounded-full border border-line px-1.5 text-[10px] leading-none text-ink-muted aria-checked:border-grass aria-checked:text-ink"
        >
          Any
        </button>
        {COLOUR_BUCKETS.map((colour) => (
          <button
            key={colour.id}
            type="button"
            role="radio"
            aria-checked={filters.colour === colour.id}
            aria-label={colour.name}
            title={colour.name}
            onClick={() => setFilters({ colour: colour.id })}
            className="size-4 rounded-full border border-black/25 aria-checked:ring-2 aria-checked:ring-grass aria-checked:ring-offset-1 aria-checked:ring-offset-panel"
            style={{ backgroundColor: colour.swatch }}
          />
        ))}
      </div>
    </div>
  )
}

function Thumbnail({ url, className = '' }: { url: string; className?: string }) {
  // object-top shows the first frame of animation strips.
  return (
    <img
      src={url}
      alt=""
      loading="lazy"
      decoding="async"
      draggable={false}
      className={`size-full object-cover object-top [image-rendering:pixelated] ${className}`}
    />
  )
}

function ChangedDot() {
  return (
    <span className="absolute top-0.5 right-0.5 size-2 rounded-full bg-grass ring-1 ring-panel" />
  )
}

export function TextureBrowser() {
  const status = useTextures((state) => state.status)
  const error = useTextures((state) => state.error)
  const filters = useTextures((state) => state.filters)
  const selected = useTextures((state) => state.selected)
  const select = useTextures((state) => state.select)
  const revision = useTextures((state) => state.revision)
  const version = useTextures((state) => state.index?.version ?? '')
  const load = useTextures((state) => state.load)
  const view = useSettings((state) => state.textureView)
  const rows = useTextureRows()
  const visible = useMemo(() => filterTextureRows(rows, filters), [rows, filters])

  if (status === 'loading' || status === 'idle') return <Loading />
  if (status === 'error') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm font-medium">The textures could not be loaded</p>
        <p role="alert" className="text-xs text-ink-muted">
          {error}
        </p>
        <Button onClick={() => void load()}>Try again</Button>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <Filters />
      <p aria-live="polite" className="px-2 py-1 text-[11px] text-ink-muted">
        {formatCount(visible.length)} of {formatCount(rows.length)} textures
      </p>
      <div className="min-h-0 flex-1 overflow-auto px-2 pb-2">
        {visible.length === 0 ? (
          <EmptyState title="No matching textures">Try another search or filter.</EmptyState>
        ) : view === 'grid' ? (
          <ul
            aria-label="Textures"
            className="grid grid-cols-[repeat(auto-fill,minmax(44px,1fr))] gap-1"
          >
            {visible.map((row) => (
              <li key={row.path}>
                <button
                  type="button"
                  aria-label={rowLabel(row)}
                  aria-pressed={selected === row.path}
                  title={`${displayName(row.name)}\n${row.path}`}
                  onClick={() => select(row.path)}
                  className="relative block aspect-square w-full overflow-hidden rounded border border-line/60 bg-canvas p-0.5 hover:border-ink-muted aria-pressed:border-grass aria-pressed:ring-1 aria-pressed:ring-grass"
                >
                  <Thumbnail url={rowImageUrl(row, version, revision)} />
                  {(row.changed || row.added) && <ChangedDot />}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <ul aria-label="Textures" className="flex flex-col">
            {visible.map((row) => (
              <li key={row.path}>
                <button
                  type="button"
                  aria-label={rowLabel(row)}
                  aria-pressed={selected === row.path}
                  onClick={() => select(row.path)}
                  className="flex w-full items-center gap-2 rounded px-1 py-1 text-left hover:bg-raised aria-pressed:bg-grass/15"
                >
                  <span className="relative size-8 shrink-0 overflow-hidden rounded bg-canvas">
                    <Thumbnail url={rowImageUrl(row, version, revision)} />
                    {(row.changed || row.added) && <ChangedDot />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{displayName(row.name)}</span>
                    <span className="block truncate text-[11px] text-ink-muted">{row.path}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
