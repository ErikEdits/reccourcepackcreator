import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { displayName, type TextureRow } from '../../../../shared/textures'
import { currentDoc } from '../../editor/history'
import { toHex, type Rgba } from '../../editor/pixels'
import { DEFAULT_SHORTCUTS, type ShortcutAction } from '../../editor/shortcuts'
import { decodeImage, imageToTexture } from '../../lib/images'
import { MAX_BRUSH_SIZE, useEditor, type SaveState, type Tool } from '../../store/editor'
import { useProject } from '../../store/project'
import { useSettings } from '../../store/settings'
import { statusLabel, useTextures } from '../../store/textures'
import { useToasts } from '../../store/toasts'
import { Button, ErrorText } from '../ui'
import { ToolIcon } from './icons'
import { PixelCanvas } from './PixelCanvas'
import { useEditorShortcuts } from './useEditorShortcuts'

const TOOLS: { tool: Tool; label: string }[] = [
  { tool: 'pencil', label: 'Pencil' },
  { tool: 'eraser', label: 'Eraser' },
  { tool: 'fill', label: 'Fill' },
  { tool: 'gradient', label: 'Gradient' },
  { tool: 'picker', label: 'Colour picker' },
  { tool: 'line', label: 'Line' },
  { tool: 'rectangle', label: 'Rectangle' },
  { tool: 'ellipse', label: 'Ellipse' },
  { tool: 'select', label: 'Select' },
  { tool: 'move', label: 'Move' },
]

const SAVE_LABELS: Record<SaveState, string> = {
  saved: 'All changes saved',
  unsaved: 'Saving…',
  saving: 'Saving…',
  failed: 'Not saved',
}

function useShortcutLabel(): (action: ShortcutAction) => string {
  const overrides = useSettings((state) => state.shortcuts)
  return (action) => overrides[action] ?? DEFAULT_SHORTCUTS[action]
}

/** A checkerboard-free swatch: transparent colours show the editor background behind them. */
export function Swatch({
  colour,
  label,
  className = 'size-6',
}: {
  colour: Rgba
  label?: string
  className?: string
}) {
  const background = useSettings((state) => state.editorBackground)
  return (
    <span
      title={label ? `${label}: ${toHex(colour)}` : toHex(colour)}
      className={`block rounded border border-black/30 ${className}`}
      style={{
        background: `linear-gradient(${toHex(colour)}, ${toHex(colour)}), ${background}`,
      }}
    />
  )
}

function ToolButton({
  pressed,
  label,
  onClick,
  children,
}: {
  pressed: boolean
  label: string
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      onClick={onClick}
      className="flex size-8 items-center justify-center rounded-md text-ink-muted hover:bg-raised hover:text-ink aria-pressed:bg-grass aria-pressed:text-white"
    >
      {children}
    </button>
  )
}

function Toolbar() {
  const tool = useEditor((state) => state.tool)
  const setTool = useEditor((state) => state.setTool)
  const primary = useEditor((state) => state.primary)
  const secondary = useEditor((state) => state.secondary)
  const swapColours = useEditor((state) => state.swapColours)
  const shortcut = useShortcutLabel()

  return (
    <div
      role="toolbar"
      aria-label="Tools"
      aria-orientation="vertical"
      className="flex shrink-0 flex-col items-center gap-1 border-r border-line p-1.5"
    >
      {TOOLS.map(({ tool: value, label }) => (
        <ToolButton
          key={value}
          pressed={tool === value}
          label={`${label} (${shortcut(`tool.${value}`)})`}
          onClick={() => setTool(value)}
        >
          <ToolIcon tool={value} />
        </ToolButton>
      ))}
      <div className="relative mt-2 size-9" aria-label="Colours">
        <span className="absolute right-0 bottom-0">
          <Swatch colour={secondary} label="Right mouse button" className="size-6" />
        </span>
        <span className="absolute top-0 left-0">
          <Swatch colour={primary} label="Left mouse button" className="size-6" />
        </span>
      </div>
      <button
        type="button"
        onClick={swapColours}
        title={`Swap colours (${shortcut('colours.swap')})`}
        aria-label="Swap colours"
        className="text-xs text-ink-muted hover:text-ink"
      >
        ⇄
      </button>
    </div>
  )
}

function Toggle({
  pressed,
  onClick,
  children,
  title,
  disabled,
}: {
  pressed?: boolean
  onClick: () => void
  children: ReactNode
  title?: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      title={title}
      disabled={disabled}
      className="rounded-md border border-line px-2 py-0.5 text-xs text-ink-muted hover:text-ink disabled:opacity-40 aria-pressed:border-grass aria-pressed:bg-grass/15 aria-pressed:text-ink"
    >
      {children}
    </button>
  )
}

/** Settings of the current tool, symmetry and transforms, above the canvas. */
function ToolOptions() {
  const tool = useEditor((state) => state.tool)
  const brushSize = useEditor((state) => state.brushSize)
  const setBrushSize = useEditor((state) => state.setBrushSize)
  const filled = useEditor((state) => state.filled)
  const setFilled = useEditor((state) => state.setFilled)
  const symmetry = useEditor((state) => state.symmetry)
  const setSymmetry = useEditor((state) => state.setSymmetry)
  const gradientMode = useEditor((state) => state.gradientMode)
  const setGradientMode = useEditor((state) => state.setGradientMode)
  const selection = useEditor((state) => state.selection)
  const transform = useEditor((state) => state.transform)
  // Re-render when the document changes, so "Rotate" knows whether the region is square.
  useEditor((state) => state.history)
  const canTransform = useEditor((state) => state.canTransform)
  const shortcut = useShortcutLabel()
  const brushTool = ['pencil', 'eraser', 'line', 'rectangle', 'ellipse'].includes(tool)
  const target = selection ? 'selection' : 'layer'

  return (
    <div
      aria-label="Tool options"
      role="group"
      className="flex min-h-10 shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-b border-line px-3 py-1.5 text-xs"
    >
      {brushTool && (
        <label className="flex items-center gap-1.5">
          Brush size
          <input
            type="number"
            min={1}
            max={MAX_BRUSH_SIZE}
            value={brushSize}
            onChange={(event) => setBrushSize(Number(event.target.value) || 1)}
            className="w-12 rounded border border-line bg-raised px-1 py-0.5"
          />
        </label>
      )}
      {(tool === 'rectangle' || tool === 'ellipse') && (
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={filled}
            onChange={(event) => setFilled(event.target.checked)}
          />
          Filled
        </label>
      )}
      {tool === 'gradient' && (
        <label className="flex items-center gap-1.5">
          Gradient
          <select
            value={gradientMode}
            onChange={(event) => setGradientMode(event.target.value as 'smooth' | 'dither')}
            className="rounded border border-line bg-raised px-1 py-0.5"
          >
            <option value="dither">Dithered (2 colours)</option>
            <option value="smooth">Smooth</option>
          </select>
        </label>
      )}
      {(brushTool || tool === 'fill') && (
        <div className="flex items-center gap-1.5">
          <span>Mirror</span>
          <Toggle
            pressed={symmetry.horizontal}
            onClick={() => setSymmetry({ horizontal: !symmetry.horizontal })}
            title="Mirror left and right"
          >
            ↔
          </Toggle>
          <Toggle
            pressed={symmetry.vertical}
            onClick={() => setSymmetry({ vertical: !symmetry.vertical })}
            title="Mirror top and bottom"
          >
            ↕
          </Toggle>
        </div>
      )}
      <div className="ml-auto flex items-center gap-1.5">
        <span className="text-ink-muted">Transform {target}</span>
        <Toggle
          onClick={() => transform('flip-horizontal')}
          title={`Flip ${target} horizontally (${shortcut('transform.flipHorizontal')})`}
        >
          Flip ↔
        </Toggle>
        <Toggle
          onClick={() => transform('flip-vertical')}
          title={`Flip ${target} vertically (${shortcut('transform.flipVertical')})`}
        >
          Flip ↕
        </Toggle>
        <Toggle
          onClick={() => transform('rotate')}
          disabled={!canTransform('rotate')}
          title={`Rotate ${target} 90° clockwise (${shortcut('transform.rotate')}); needs a square`}
        >
          Rotate
        </Toggle>
      </div>
    </div>
  )
}

function EditorStatus() {
  const cursor = useEditor((state) => state.cursor)
  const history = useEditor((state) => state.history)
  const zoom = useEditor((state) => state.zoom)
  const fitZoom = useEditor((state) => state.fitZoom)
  const zoomStep = useEditor((state) => state.zoomStep)
  const setZoom = useEditor((state) => state.setZoom)
  const showGrid = useEditor((state) => state.showGrid)
  const toggleGrid = useEditor((state) => state.toggleGrid)
  const selection = useEditor((state) => state.selection)
  const doc = history ? currentDoc(history) : null
  const effective = zoom ?? fitZoom

  return (
    <div className="flex h-8 shrink-0 items-center gap-4 border-t border-line px-3 text-xs text-ink-muted">
      {doc && (
        <span>
          {doc.width} × {doc.height} px
        </span>
      )}
      <span className="w-16 tabular-nums">{cursor ? `${cursor[0]}, ${cursor[1]}` : ''}</span>
      {selection && (
        <span>
          Selection {selection.width} × {selection.height}
        </span>
      )}
      <div className="ml-auto flex items-center gap-1">
        <Toggle pressed={showGrid} onClick={toggleGrid} title="Show the pixel grid">
          Grid
        </Toggle>
        <Toggle onClick={() => zoomStep(-1)} title="Zoom out">
          −
        </Toggle>
        <span aria-label="Zoom" className="w-12 text-center tabular-nums">
          {Math.round(effective * 100)}%
        </span>
        <Toggle onClick={() => zoomStep(1)} title="Zoom in">
          +
        </Toggle>
        <Toggle pressed={zoom === null} onClick={() => setZoom(null)} title="Fit to window">
          Fit
        </Toggle>
      </div>
    </div>
  )
}

/** Centre column while a texture is selected: the pixel editor (docs/DECISIONS.md #25). */
export function EditorView({ row }: { row: TextureRow }) {
  const summary = useProject((state) => state.summary)
  const select = useTextures((state) => state.select)
  const pushToast = useToasts((state) => state.push)
  const status = useEditor((state) => state.status)
  const error = useEditor((state) => state.error)
  const saveState = useEditor((state) => state.saveState)
  const [importError, setImportError] = useState<string | null>(null)
  useEditorShortcuts()

  const dir = summary?.dir
  const resolution = summary?.project.resolution ?? 16
  const name = displayName(row.name)
  const rowRef = useRef(row)
  useLayoutEffect(() => {
    rowRef.current = row
  })

  useEffect(() => {
    if (dir) void useEditor.getState().open(rowRef.current, resolution)
  }, [row.path, dir, resolution])

  useEffect(() => () => void useEditor.getState().close(), [])

  const importImage = async (file: File | undefined): Promise<void> => {
    if (!file) return
    setImportError(null)
    const history = useEditor.getState().history
    if (!history) return
    // Imports keep the texture's size at the pack's resolution (docs/DECISIONS.md #35).
    const targetWidth = row.vanilla
      ? Math.max(1, Math.round((row.vanilla.width * resolution) / 16))
      : currentDoc(history).width
    try {
      const bitmap = await decodeImage(await imageToTexture(file, targetWidth))
      await useEditor.getState().replaceImage('Import image', bitmap)
      if (useEditor.getState().saveState === 'saved') pushToast('success', `Replaced “${name}”.`)
    } catch {
      setImportError('This file could not be read as an image.')
    }
  }

  const revert = async (): Promise<void> => {
    const question = row.added
      ? `Remove “${name}” from your pack?`
      : `Revert “${name}” to the original? Your version and its layers are deleted from the pack.`
    if (!window.confirm(question)) return
    const reverted = await useEditor.getState().revert(row, resolution)
    if (reverted && row.added) select(null)
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
        <span
          role="status"
          aria-label="Save status"
          className={`shrink-0 text-xs ${saveState === 'failed' ? 'text-danger' : 'text-ink-muted'}`}
        >
          {status === 'ready' ? SAVE_LABELS[saveState] : ''}
        </span>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <label className="cursor-pointer rounded-md border border-line bg-raised px-3 py-1.5 text-sm font-medium hover:border-ink-muted">
            Import image…
            <input
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp,image/bmp"
              aria-label="Import image"
              className="sr-only"
              disabled={status !== 'ready'}
              onChange={(event) => {
                void importImage(event.target.files?.[0])
                event.target.value = ''
              }}
            />
          </label>
          {(row.changed || row.added) && (
            <Button onClick={() => void revert()}>
              {row.added ? 'Remove from pack' : 'Revert to original'}
            </Button>
          )}
          <Button variant="ghost" onClick={() => select(null)}>
            Back to pack
          </Button>
        </div>
      </div>
      {importError && (
        <div className="border-b border-line px-4 py-2">
          <ErrorText>{importError}</ErrorText>
        </div>
      )}

      {status === 'error' && (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6">
          <ErrorText>{error}</ErrorText>
        </div>
      )}
      {status === 'loading' && (
        <p className="flex flex-1 items-center justify-center text-sm text-ink-muted">
          Loading texture…
        </p>
      )}
      {status === 'ready' && (
        <>
          <ToolOptions />
          <div className="flex min-h-0 flex-1">
            <Toolbar />
            <PixelCanvas onDropFile={(file) => void importImage(file)} />
          </div>
          <EditorStatus />
        </>
      )}
    </div>
  )
}
