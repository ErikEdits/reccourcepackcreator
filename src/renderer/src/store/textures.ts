import { useMemo } from 'react'
import { create } from 'zustand'
import {
  buildTextureRows,
  DEFAULT_TEXTURE_FILTERS,
  TEXTURE_PROTOCOL,
  type TextureFilters,
  type TextureIndex,
  type TextureProgress,
  type TextureEntry,
  type TextureRow,
  textureEntries,
} from '../../../shared/textures'
import { mobModelFor } from '../../../shared/mob-models'
import { useProject } from './project'
import { useSettings } from './settings'

type Status = 'idle' | 'loading' | 'ready' | 'error'

interface TextureState {
  status: Status
  index: TextureIndex | null
  error: string | null
  progress: TextureProgress | null
  filters: TextureFilters
  selected: string | null
  /** Bumped whenever the pack's textures change, so their images are fetched again. */
  revision: number
  load: () => Promise<void>
  reset: () => void
  setProgress: (progress: TextureProgress) => void
  setFilters: (filters: Partial<TextureFilters>) => void
  select: (path: string | null) => void
  bumpRevision: () => void
}

/** Lets a load that finishes after the pack was switched be ignored. */
let loadToken = 0

export const useTextures = create<TextureState>()((set, get) => ({
  status: 'idle',
  index: null,
  error: null,
  progress: null,
  filters: DEFAULT_TEXTURE_FILTERS,
  selected: null,
  revision: 0,
  load: async () => {
    const token = ++loadToken
    set({ status: 'loading', error: null, progress: null })
    const result = await window.api.textures.load()
    if (token !== loadToken) return
    if (result.ok) set({ status: 'ready', index: result.value, progress: null })
    else set({ status: 'error', error: result.error, progress: null })
  },
  reset: () => {
    loadToken++
    set({
      status: 'idle',
      index: null,
      error: null,
      progress: null,
      selected: null,
      filters: DEFAULT_TEXTURE_FILTERS,
    })
  },
  setProgress: (progress) => {
    if (get().status === 'loading') set({ progress })
  },
  setFilters: (filters) => set({ filters: { ...get().filters, ...filters } }),
  select: (selected) => set({ selected }),
  bumpRevision: () => set({ revision: get().revision + 1 }),
}))

/** Vanilla textures merged with the open pack's files. */
export function useTextureRows(): TextureRow[] {
  const index = useTextures((state) => state.index)
  const files = useProject((state) => state.summary?.files)
  return useMemo(
    () => (index && files ? buildTextureRows(index.textures, files, index.blocks) : []),
    [index, files],
  )
}

/** The list's tiles: single textures, and blocks with all their textures. */
export function useTextureEntries(): TextureEntry[] {
  const rows = useTextureRows()
  const blocks = useTextures((state) => state.index?.blocks)
  const byBlock = useSettings((state) => state.groupByBlock)
  return useMemo(() => textureEntries(rows, blocks ?? [], byBlock), [rows, blocks, byBlock])
}

/** All textures of the selected texture's block (just the texture itself if it has none). */
export function useBlockRows(row: TextureRow | null): TextureRow[] {
  const rows = useTextureRows()
  const blocks = useTextures((state) => state.index?.blocks)
  return useMemo(() => {
    if (!row) return []
    const block = row.block && blocks?.find((entry) => entry.id === row.block)
    if (!block) return [row]
    const byPath = new Map(rows.map((entry) => [entry.path, entry]))
    return block.textures
      .map((path) => byPath.get(path))
      .filter((entry): entry is TextureRow => entry !== undefined)
  }, [row, rows, blocks])
}

/** Whether a texture can be shown in 3D: blocks with a model, items and known mobs. */
export function useHas3d(row: TextureRow): boolean {
  const blocks = useTextures((state) => state.index?.blocks)
  if (row.path.startsWith('item/')) return true
  if (row.vanilla && mobModelFor(row.path, row.vanilla.width, row.vanilla.height)) return true
  return !!row.block && !!blocks?.some((block) => block.id === row.block && block.has3d)
}

export function useSelectedRow(): TextureRow | null {
  const rows = useTextureRows()
  const selected = useTextures((state) => state.selected)
  return useMemo(() => rows.find((row) => row.path === selected) ?? null, [rows, selected])
}

const encodePath = (path: string): string => path.split('/').map(encodeURIComponent).join('/')

export function vanillaTextureUrl(path: string, version: string): string {
  return `${TEXTURE_PROTOCOL}://vanilla/${encodePath(path)}?mc=${encodeURIComponent(version)}`
}

export function packTextureUrl(path: string, revision: number): string {
  return `${TEXTURE_PROTOCOL}://pack/${encodePath(path)}?r=${revision}`
}

/** What the list shows: the pack's version if it has one, else the original. */
export function rowImageUrl(row: TextureRow, version: string, revision: number): string {
  return row.changed || row.added
    ? packTextureUrl(row.path, revision)
    : vanillaTextureUrl(row.path, version)
}

export function statusLabel(row: TextureRow): string {
  if (row.added) return 'Added by your pack'
  return row.changed ? 'Changed in your pack' : 'Original'
}
