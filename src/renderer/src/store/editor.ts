// The pixel editor's state: the open texture with its history, the tool settings and the
// automatic saving (docs/DECISIONS.md #25–#36, #65).

import { create } from 'zustand'
import type { TextureRow } from '../../../shared/textures'
import { paletteFromBitmap } from '../editor/colour'
import {
  activeLayer,
  addLayer,
  compose,
  createDocument,
  isFlat,
  selectLayer,
  setLayerPixels,
  setLayerProps,
  type EditorDocument,
} from '../editor/document'
import { currentDoc, jumpTo, record, startHistory, type History } from '../editor/history'
import { deserializeLayers, serializeLayers } from '../editor/layers-io'
import {
  clipRect,
  cloneBitmap,
  extract,
  fillRect,
  paste,
  scaleNearest,
  TRANSPARENT,
  type Bitmap,
  type Rect,
  type Rgba,
} from '../editor/pixels'
import type { GradientMode, Point, Symmetry } from '../editor/raster'
import { canTransform, transformRegion, type Transform } from '../editor/transform'
import { decodeImage, encodePng } from '../lib/images'
import { registerFlusher } from './pending-saves'
import { useProject } from './project'
import { useTextures } from './textures'
import { useToasts } from './toasts'

export type Tool =
  | 'pencil'
  | 'eraser'
  | 'fill'
  | 'gradient'
  | 'picker'
  | 'line'
  | 'rectangle'
  | 'ellipse'
  | 'select'
  | 'move'

export type SaveState = 'saved' | 'unsaved' | 'saving' | 'failed'

/** Zoom steps (screen pixels per texture pixel) for the mouse wheel and the zoom keys. */
export const ZOOM_LEVELS = [1, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64, 96]

export const MAX_BRUSH_SIZE = 32

const TRANSFORM_LABELS: Record<Transform, string> = {
  'flip-horizontal': 'Flip horizontally',
  'flip-vertical': 'Flip vertically',
  rotate: 'Rotate',
}

interface EditorState {
  /** The texture being edited and the pack it belongs to. */
  path: string | null
  dir: string | null
  status: 'idle' | 'loading' | 'ready' | 'error'
  error: string | null
  history: History | null
  saveState: SaveState
  /** Colours of Minecraft's original texture (docs/DECISIONS.md #31). */
  originalPalette: Rgba[]

  tool: Tool
  /** Painted with the left mouse button. */
  primary: Rgba
  /** Painted with the right mouse button. */
  secondary: Rgba
  brushSize: number
  /** Rectangles and ellipses are filled instead of outlined. */
  filled: boolean
  symmetry: Symmetry
  gradientMode: GradientMode
  selection: Rect | null
  clipboard: Bitmap | null
  /** Requested zoom; null fits the texture into the window. */
  zoom: number | null
  /** The zoom that fits the texture into the window, reported by the canvas. */
  fitZoom: number
  /** How far the texture is moved from the centre of the canvas, in screen pixels. */
  pan: { x: number; y: number }
  showGrid: boolean
  /** The texture pixel under the mouse. */
  cursor: Point | null

  open: (row: TextureRow, resolution: number) => Promise<void>
  close: () => Promise<void>
  /** Saves now instead of after the short delay. */
  flush: () => Promise<void>
  /** Records a change of the document and saves it shortly after. */
  commit: (label: string, doc: EditorDocument, options?: { coalesce?: boolean }) => void
  /** Puts a new picture in place of the texture, e.g. an imported image. */
  replaceImage: (label: string, bitmap: Bitmap) => Promise<void>
  /** Throws away the pack's version and opens the original again. */
  revert: (row: TextureRow, resolution: number) => Promise<boolean>
  undo: () => void
  redo: () => void
  jumpTo: (index: number) => void
  /** Picks the layer to paint on; not a step in the history. */
  setActiveLayer: (id: number) => void

  setTool: (tool: Tool) => void
  setPrimary: (colour: Rgba) => void
  setSecondary: (colour: Rgba) => void
  swapColours: () => void
  setBrushSize: (size: number) => void
  setFilled: (filled: boolean) => void
  setSymmetry: (symmetry: Partial<Symmetry>) => void
  setGradientMode: (mode: GradientMode) => void
  setSelection: (selection: Rect | null) => void
  selectAll: () => void
  deleteSelection: () => void
  copy: () => void
  cut: () => void
  paste: () => void
  transform: (transform: Transform) => void
  canTransform: (transform: Transform) => boolean
  /** Changes the zoom; the texture is centred again unless a pan is given. */
  setZoom: (zoom: number | null, pan?: { x: number; y: number }) => void
  setPan: (pan: { x: number; y: number }) => void
  zoomStep: (direction: 1 | -1) => void
  setFitZoom: (zoom: number) => void
  toggleGrid: () => void
  setCursor: (cursor: Point | null) => void
}

/** Copies the active layer, lets `change` paint on the copy and returns the new document. */
export function editActiveLayer(
  doc: EditorDocument,
  change: (pixels: Bitmap) => void,
): EditorDocument {
  const layer = activeLayer(doc)
  const pixels = cloneBitmap(layer.pixels)
  change(pixels)
  return setLayerPixels(doc, layer.id, pixels)
}

/** The next zoom step from `zoom` in the given direction. */
export function nextZoom(zoom: number, direction: 1 | -1): number {
  if (direction > 0) return ZOOM_LEVELS.find((level) => level > zoom + 0.001) ?? zoom
  return [...ZOOM_LEVELS].reverse().find((level) => level < zoom - 0.001) ?? zoom
}

const READ_ERROR = 'This texture could not be read.'
const SAVE_DELAY_MS = 400

/** Lets a texture that finishes loading after another was opened be ignored. */
let openToken = 0
let saveTimer: ReturnType<typeof setTimeout> | undefined
let saving: Promise<void> | null = null
/** The document changed since the last save. */
let dirty = false

export const useEditor = create<EditorState>()((set, get) => {
  const save = async (): Promise<void> => {
    const { path, dir, history } = get()
    if (!path || !history) return
    const doc = currentDoc(history)
    set({ saveState: 'saving' })
    try {
      const png = await encodePng(compose(doc))
      const layers = isFlat(doc) ? null : await serializeLayers(doc)
      // Never write into another pack that was opened in the meantime.
      if (useProject.getState().summary?.dir !== dir) return
      const result = await window.api.textures.saveEdit(path, png, layers)
      if (!result.ok) {
        set({ saveState: 'failed' })
        useToasts.getState().push('error', result.error)
        return
      }
      useProject.getState().setSummary(result.value)
      useTextures.getState().bumpRevision()
      if (!dirty && get().path === path) set({ saveState: 'saved' })
    } catch {
      set({ saveState: 'failed' })
      useToasts.getState().push('error', 'The texture could not be saved.')
    }
  }

  const flush = async (): Promise<void> => {
    clearTimeout(saveTimer)
    while (saving) await saving
    if (!dirty) return
    dirty = false
    saving = save()
    try {
      await saving
    } finally {
      saving = null
    }
  }

  const scheduleSave = (): void => {
    dirty = true
    set({ saveState: 'unsaved' })
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => void flush(), SAVE_DELAY_MS)
  }

  /** Forgets changes that were not saved yet (the texture is about to be replaced anyway). */
  const discardPending = async (): Promise<void> => {
    clearTimeout(saveTimer)
    dirty = false
    while (saving) await saving
  }

  const showHistory = (history: History): void => {
    const doc = currentDoc(history)
    const selection = get().selection
    set({ history, selection: selection && clipRect(selection, doc.width, doc.height) })
    scheduleSave()
  }

  const doc = (): EditorDocument | null => {
    const history = get().history
    return history ? currentDoc(history) : null
  }

  const loadDocument = async (
    row: TextureRow,
    resolution: number,
    fromPack: boolean,
  ): Promise<{ doc: EditorDocument; original: Bitmap | null } | null> => {
    const vanillaBytes = row.vanilla
      ? await window.api.textures.readImage('vanilla', row.path)
      : null
    const original = vanillaBytes ? await decodeImage(vanillaBytes) : null

    if (fromPack) {
      const bytes = await window.api.textures.readImage('pack', row.path)
      if (bytes) {
        const png = await decodeImage(bytes)
        const layers = await window.api.textures.readLayers(row.path)
        const restored = layers ? await deserializeLayers(layers, png) : null
        return { doc: restored ?? createDocument(png), original }
      }
    }
    if (!original) return null
    // Originals start at the pack's resolution (docs/DECISIONS.md #33–#35).
    const scale = resolution / 16
    const scaled =
      scale === 1
        ? original
        : scaleNearest(
            original,
            Math.max(1, Math.round(original.width * scale)),
            Math.max(1, Math.round(original.height * scale)),
          )
    return { doc: createDocument(scaled), original }
  }

  const load = async (row: TextureRow, resolution: number, fromPack: boolean): Promise<void> => {
    const token = ++openToken
    set({
      path: row.path,
      dir: useProject.getState().summary?.dir ?? null,
      status: 'loading',
      error: null,
      history: null,
      saveState: 'saved',
      selection: null,
      zoom: null,
      pan: { x: 0, y: 0 },
      cursor: null,
    })
    try {
      const loaded = await loadDocument(row, resolution, fromPack)
      if (token !== openToken) return
      if (!loaded) return set({ status: 'error', error: READ_ERROR })
      set({
        status: 'ready',
        history: startHistory(loaded.doc),
        originalPalette: paletteFromBitmap(loaded.original ?? compose(loaded.doc)),
      })
    } catch {
      if (token === openToken) set({ status: 'error', error: READ_ERROR })
    }
  }

  return {
    path: null,
    dir: null,
    status: 'idle',
    error: null,
    history: null,
    saveState: 'saved',
    originalPalette: [],
    tool: 'pencil',
    primary: [0, 0, 0, 255],
    secondary: [255, 255, 255, 255],
    brushSize: 1,
    filled: false,
    symmetry: { horizontal: false, vertical: false },
    gradientMode: 'dither',
    selection: null,
    clipboard: null,
    zoom: null,
    fitZoom: 1,
    pan: { x: 0, y: 0 },
    showGrid: true,
    cursor: null,

    open: async (row, resolution) => {
      await flush()
      await load(row, resolution, row.changed || row.added)
    },
    close: async () => {
      const token = openToken
      await flush()
      // Another texture was opened while saving: that one stays.
      if (token !== openToken) return
      openToken++
      set({ path: null, dir: null, status: 'idle', history: null, selection: null, cursor: null })
    },
    flush,
    commit: (label, next, options) => {
      const history = get().history
      if (!history) return
      showHistory(record(history, label, next, options?.coalesce))
    },
    replaceImage: async (label, bitmap) => {
      const history = get().history
      if (!history) return
      set({ selection: null, zoom: null, pan: { x: 0, y: 0 } })
      showHistory(record(history, label, createDocument(bitmap)))
      await flush()
    },
    revert: async (row, resolution) => {
      await discardPending()
      const result = await window.api.textures.revert(row.path)
      if (!result.ok) {
        useToasts.getState().push('error', result.error)
        return false
      }
      useProject.getState().setSummary(result.value)
      useTextures.getState().bumpRevision()
      if (!row.added) await load(row, resolution, false)
      return true
    },
    undo: () => {
      const history = get().history
      if (history) showHistory(jumpTo(history, history.index - 1))
    },
    redo: () => {
      const history = get().history
      if (history) showHistory(jumpTo(history, history.index + 1))
    },
    jumpTo: (index) => {
      const history = get().history
      if (history && index !== history.index) showHistory(jumpTo(history, index))
    },

    setActiveLayer: (id) => {
      const history = get().history
      if (!history) return
      const entries = [...history.entries]
      const entry = entries[history.index]
      entries[history.index] = { ...entry, doc: selectLayer(entry.doc, id) }
      set({ history: { ...history, entries } })
    },

    setTool: (tool) => set({ tool }),
    setPrimary: (primary) => set({ primary }),
    setSecondary: (secondary) => set({ secondary }),
    swapColours: () => set({ primary: get().secondary, secondary: get().primary }),
    setBrushSize: (size) =>
      set({ brushSize: Math.max(1, Math.min(MAX_BRUSH_SIZE, Math.round(size))) }),
    setFilled: (filled) => set({ filled }),
    setSymmetry: (symmetry) => set({ symmetry: { ...get().symmetry, ...symmetry } }),
    setGradientMode: (gradientMode) => set({ gradientMode }),
    setSelection: (selection) => {
      const current = doc()
      set({ selection: selection && current && clipRect(selection, current.width, current.height) })
    },
    selectAll: () => {
      const current = doc()
      if (current) set({ selection: { x: 0, y: 0, width: current.width, height: current.height } })
    },
    deleteSelection: () => {
      const { selection, commit } = get()
      const current = doc()
      if (!selection || !current) return
      commit(
        'Delete',
        editActiveLayer(current, (pixels) => fillRect(pixels, selection, TRANSPARENT)),
      )
    },
    copy: () => {
      const current = doc()
      if (!current) return
      const region = get().selection ?? { x: 0, y: 0, width: current.width, height: current.height }
      set({ clipboard: extract(activeLayer(current).pixels, region) })
    },
    cut: () => {
      const { selection, copy, deleteSelection } = get()
      if (!selection) return
      copy()
      deleteSelection()
    },
    paste: () => {
      const { clipboard, selection, commit } = get()
      const current = doc()
      if (!clipboard || !current) return
      // Pasted pixels land on a new layer, ready to be moved.
      const x = selection?.x ?? 0
      const y = selection?.y ?? 0
      const withLayer = addLayer(current)
      const pasted = editActiveLayer(withLayer, (pixels) => paste(pixels, clipboard, x, y))
      commit('Paste', setLayerProps(pasted, pasted.activeLayerId, { name: 'Pasted' }))
      get().setSelection({ x, y, width: clipboard.width, height: clipboard.height })
      set({ tool: 'move' })
    },
    canTransform: (transform) => {
      const current = doc()
      if (!current) return false
      const region = get().selection ?? { x: 0, y: 0, width: current.width, height: current.height }
      return canTransform(transform, region)
    },
    transform: (transform) => {
      const { selection, commit } = get()
      const current = doc()
      if (!current || !get().canTransform(transform)) return
      const region = selection ?? { x: 0, y: 0, width: current.width, height: current.height }
      commit(
        TRANSFORM_LABELS[transform],
        editActiveLayer(current, (pixels) => transformRegion(pixels, region, transform)),
      )
    },
    setZoom: (zoom, pan = { x: 0, y: 0 }) => set({ zoom, pan }),
    setPan: (pan) => set({ pan }),
    zoomStep: (direction) => {
      const { zoom, fitZoom, pan } = get()
      const from = zoom ?? fitZoom
      const to = nextZoom(from, direction)
      // Zoom around the middle of the canvas.
      set({ zoom: to, pan: { x: (pan.x * to) / from, y: (pan.y * to) / from } })
    },
    setFitZoom: (fitZoom) => {
      if (fitZoom !== get().fitZoom) set({ fitZoom })
    },
    toggleGrid: () => set({ showGrid: !get().showGrid }),
    setCursor: (cursor) => {
      const current = get().cursor
      if (current?.[0] !== cursor?.[0] || current?.[1] !== cursor?.[1]) set({ cursor })
    },
  }
})

registerFlusher(() => useEditor.getState().flush())
