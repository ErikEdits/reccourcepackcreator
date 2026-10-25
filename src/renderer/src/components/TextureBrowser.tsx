import { useMemo } from 'react'
import {
  COLOUR_BUCKETS,
  filterTextureEntries,
  TEXTURE_CATEGORIES,
  type TextureCategory,
  type TextureEntry,
} from '../../../shared/textures'
import { formatCount, formatMegabytes } from '../lib/format'
import { useProject } from '../store/project'
import { useSettings, type TextureView } from '../store/settings'
import { rowImageUrl, useTextureEntries, useTextureRows, useTextures } from '../store/textures'
import { EmptyState } from './Panel'
import { Button, inputClass } from './ui'

function entryLabel(entry: TextureEntry): string {
  const changed = entry.rows.some((row) => row.changed)
  const added = entry.rows.some((row) => row.added)
  const status = changed ? ', changed' : added ? ', added by pack' : ''
  const count = entry.rows.length > 1 ? `, ${entry.rows.length} textures` : ''
  return `${entry.name}${status}${count}`
}

const entryChanged = (entry: TextureEntry): boolean =>
  entry.rows.some((row) => row.changed || row.added)

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

function GroupToggle() {
  const groupByBlock = useSettings((state) => state.groupByBlock)
  const setGroupByBlock = useSettings((state) => state.setGroupByBlock)
  return (
    <button
      type="button"
      aria-pressed={groupByBlock}
      onClick={() => setGroupByBlock(!groupByBlock)}
      title="Show the textures of a block (top, side …) together"
      className="rounded-md border border-line px-2 text-xs leading-6 text-ink-muted aria-pressed:border-grass aria-pressed:text-ink"
    >
      Blocks
    </button>
  )
}

function Filters() {
  const filters = useTextures((state) => state.filters)
  const setFilters = useTextures((state) => state.setFilters)
  const hasBlocks = useTextures((state) => (state.index?.blocks.length ?? 0) > 0)

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
        {hasBlocks && <GroupToggle />}
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

/** How many textures a block entry holds. */
function CountBadge({ count }: { count: number }) {
  return (
    <span className="absolute right-0 bottom-0 rounded-tl bg-black/60 px-0.5 text-[9px] leading-tight text-white">
      {count}
    </span>
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
  const entries = useTextureEntries()
  const visible = useMemo(() => filterTextureEntries(entries, filters), [entries, filters])
  const visibleTextures = visible.reduce((sum, entry) => sum + entry.rows.length, 0)
  const isSelected = (entry: TextureEntry): boolean =>
    entry.rows.some((row) => row.path === selected)
  // A block keeps the texture that was picked inside it; otherwise its typical one opens.
  const open = (entry: TextureEntry): void => {
    if (!isSelected(entry)) select(entry.rows[0].path)
  }

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
        {formatCount(visibleTextures)} of {formatCount(rows.length)} textures
      </p>
      <div className="min-h-0 flex-1 overflow-auto px-2 pb-2">
        {visible.length === 0 ? (
          <EmptyState title="No matching textures">Try another search or filter.</EmptyState>
        ) : view === 'grid' ? (
          <ul
            aria-label="Textures"
            className="grid grid-cols-[repeat(auto-fill,minmax(44px,1fr))] gap-1"
          >
            {visible.map((entry) => (
              <li key={entry.key}>
                <button
                  type="button"
                  aria-label={entryLabel(entry)}
                  aria-pressed={isSelected(entry)}
                  title={`${entry.name}\n${entry.rows.map((row) => row.path).join('\n')}`}
                  onClick={() => open(entry)}
                  className="relative block aspect-square w-full overflow-hidden rounded border border-line/60 bg-canvas p-0.5 hover:border-ink-muted aria-pressed:border-grass aria-pressed:ring-1 aria-pressed:ring-grass"
                >
                  <Thumbnail url={rowImageUrl(entry.rows[0], version, revision)} />
                  {entryChanged(entry) && <ChangedDot />}
                  {entry.rows.length > 1 && <CountBadge count={entry.rows.length} />}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <ul aria-label="Textures" className="flex flex-col">
            {visible.map((entry) => (
              <li key={entry.key}>
                <button
                  type="button"
                  aria-label={entryLabel(entry)}
                  aria-pressed={isSelected(entry)}
                  onClick={() => open(entry)}
                  className="flex w-full items-center gap-2 rounded px-1 py-1 text-left hover:bg-raised aria-pressed:bg-grass/15"
                >
                  <span className="relative size-8 shrink-0 overflow-hidden rounded bg-canvas">
                    <Thumbnail url={rowImageUrl(entry.rows[0], version, revision)} />
                    {entryChanged(entry) && <ChangedDot />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{entry.name}</span>
                    <span className="block truncate text-[11px] text-ink-muted">
                      {entry.rows.length > 1 ? `${entry.rows.length} textures` : entry.rows[0].path}
                    </span>
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
