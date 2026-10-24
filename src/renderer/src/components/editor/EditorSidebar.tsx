import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { TextureRow } from '../../../../shared/textures'
import { hsvToRgb, parsePaletteFile, rgbToHsv, type Hsv } from '../../editor/colour'
import {
  activeLayer,
  addLayer,
  duplicateLayer,
  mergeDown,
  moveLayer,
  removeLayer,
  setLayerProps,
  type EditorDocument,
} from '../../editor/document'
import { canRedo, canUndo, currentDoc } from '../../editor/history'
import { parseHex, sameColour, toHex, type Rgba } from '../../editor/pixels'
import { useEditor } from '../../store/editor'
import { useSettings, type Palette } from '../../store/settings'
import { TextureProperties } from '../TextureViews'
import { Swatch } from './EditorView'

function Section({
  title,
  children,
  padded = true,
}: {
  title: string
  children: ReactNode
  padded?: boolean
}) {
  return (
    <details open className="group border-b border-line">
      <summary className="flex cursor-pointer list-none items-center px-4 py-2 text-xs font-semibold tracking-wide text-ink-muted uppercase">
        <span className="mr-1.5 inline-block transition-transform group-open:rotate-90">›</span>
        {title}
      </summary>
      <div className={padded ? 'px-4 pb-3' : ''}>{children}</div>
    </details>
  )
}

const smallButton =
  'rounded border border-line bg-raised px-1.5 py-0.5 text-xs hover:border-ink-muted disabled:opacity-40 disabled:hover:border-line'

/** HSV square, hue and alpha sliders, RGB and hex fields for the left-button colour. */
function ColourPanel() {
  const primary = useEditor((state) => state.primary)
  const setPrimary = useEditor((state) => state.setPrimary)
  // Kept separately so the hue survives greys and black (where RGB has no hue).
  const [hsv, setHsv] = useState<Hsv>(() => rgbToHsv(primary[0], primary[1], primary[2]))
  const [hexText, setHexText] = useState(toHex(primary))
  const emitted = useRef<Rgba>(primary)
  const squareRef = useRef<HTMLDivElement>(null)

  // Follow colours picked elsewhere (palette, colour picker tool, swapping).
  useEffect(() => {
    if (sameColour(primary, emitted.current) && primary[3] === emitted.current[3]) return
    emitted.current = primary
    setHsv(rgbToHsv(primary[0], primary[1], primary[2]))
    setHexText(toHex(primary))
  }, [primary])

  const emit = (colour: Rgba, nextHsv = rgbToHsv(colour[0], colour[1], colour[2])): void => {
    emitted.current = colour
    setHsv(nextHsv)
    setHexText(toHex(colour))
    setPrimary(colour)
  }
  const fromHsv = (next: Hsv): void => emit([...hsvToRgb(next), primary[3]], next)

  const pickInSquare = (clientX: number, clientY: number): void => {
    const box = squareRef.current?.getBoundingClientRect()
    if (!box) return
    const s = Math.min(1, Math.max(0, (clientX - box.left) / box.width))
    const v = 1 - Math.min(1, Math.max(0, (clientY - box.top) / box.height))
    fromHsv({ ...hsv, s, v })
  }

  const channel = (index: number, label: string) => (
    <label className="flex flex-col items-center gap-0.5 text-[10px] text-ink-muted">
      <input
        type="number"
        min={0}
        max={255}
        aria-label={label}
        value={primary[index]}
        onChange={(event) => {
          const value = Math.max(0, Math.min(255, Math.round(Number(event.target.value) || 0)))
          const next = [...primary] as [number, number, number, number]
          next[index] = value
          emit(next)
        }}
        className="w-full [appearance:textfield] rounded border border-line bg-raised px-1 py-0.5 text-xs text-ink [&::-webkit-inner-spin-button]:appearance-none"
      />
      {label[0]}
    </label>
  )

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={squareRef}
        role="slider"
        aria-label="Saturation and brightness"
        aria-valuetext={`Saturation ${Math.round(hsv.s * 100)}%, brightness ${Math.round(hsv.v * 100)}%`}
        tabIndex={0}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId)
          pickInSquare(event.clientX, event.clientY)
        }}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            pickInSquare(event.clientX, event.clientY)
          }
        }}
        className="relative h-32 cursor-crosshair touch-none rounded border border-line"
        style={{
          background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${hsv.h} 100% 50%))`,
        }}
      >
        <span
          className="pointer-events-none absolute size-3 -translate-1/2 rounded-full border-2 border-white shadow"
          style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }}
        />
      </div>
      <input
        type="range"
        min={0}
        max={359}
        aria-label="Hue"
        value={Math.round(hsv.h)}
        onChange={(event) => fromHsv({ ...hsv, h: Number(event.target.value) })}
        className="h-3 w-full cursor-pointer appearance-none rounded"
        style={{
          background: 'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)',
        }}
      />
      <input
        type="range"
        min={0}
        max={255}
        aria-label="Opacity"
        value={primary[3]}
        onChange={(event) =>
          emit([primary[0], primary[1], primary[2], Number(event.target.value)], hsv)
        }
        className="h-3 w-full cursor-pointer appearance-none rounded"
        style={{
          background: `linear-gradient(to right, transparent, ${toHex([primary[0], primary[1], primary[2], 255])}), repeating-conic-gradient(#999 0 25%, #ddd 0 50%) 0 0 / 8px 8px`,
        }}
      />
      <div className="grid grid-cols-[1fr_1fr_1fr_1fr_2fr] items-start gap-1">
        {channel(0, 'Red')}
        {channel(1, 'Green')}
        {channel(2, 'Blue')}
        {channel(3, 'Alpha')}
        <label className="flex flex-col items-center gap-0.5 text-[10px] text-ink-muted">
          <input
            aria-label="Hex colour"
            value={hexText}
            spellCheck={false}
            onChange={(event) => {
              setHexText(event.target.value)
              const colour = parseHex(event.target.value)
              if (colour) {
                emitted.current = colour
                setHsv(rgbToHsv(colour[0], colour[1], colour[2]))
                setPrimary(colour)
              }
            }}
            onBlur={() => setHexText(toHex(primary))}
            className="w-full rounded border border-line bg-raised px-1 py-0.5 font-mono text-xs text-ink"
          />
          Hex
        </label>
      </div>
    </div>
  )
}

function Swatches({ colours, label }: { colours: readonly Rgba[]; label: string }) {
  const setPrimary = useEditor((state) => state.setPrimary)
  const setSecondary = useEditor((state) => state.setSecondary)
  if (colours.length === 0) return <p className="text-xs text-ink-muted">No colours yet.</p>
  return (
    <ul aria-label={label} className="flex flex-wrap gap-1">
      {colours.map((colour, index) => (
        <li key={`${toHex(colour)}-${index}`}>
          <button
            type="button"
            aria-label={toHex(colour)}
            onClick={() => setPrimary(colour)}
            onContextMenu={(event) => {
              event.preventDefault()
              setSecondary(colour)
            }}
            className="block rounded hover:ring-2 hover:ring-grass"
          >
            <Swatch colour={colour} className="size-5" />
          </button>
        </li>
      ))}
    </ul>
  )
}

/** The original's colours plus the user's own and imported palettes (docs/DECISIONS.md #31). */
function PalettePanel() {
  const originalPalette = useEditor((state) => state.originalPalette)
  const primary = useEditor((state) => state.primary)
  const palettes = useSettings((state) => state.palettes)
  const setPalettes = useSettings((state) => state.setPalettes)
  const [index, setIndex] = useState(0)
  const [message, setMessage] = useState<string | null>(null)
  const current: Palette | undefined = palettes[Math.min(index, palettes.length - 1)]
  const currentIndex = current ? palettes.indexOf(current) : -1
  const colours = (current?.colours ?? []).map(parseHex).filter((c): c is Rgba => c !== null)

  const update = (palette: Palette): void =>
    setPalettes(palettes.map((entry, i) => (i === currentIndex ? palette : entry)))

  const importFile = async (file: File | undefined): Promise<void> => {
    if (!file) return
    setMessage(null)
    const imported = parsePaletteFile(file.name, await file.text())
    if (imported.length === 0) {
      setMessage('No colours found in this file.')
      return
    }
    const name = file.name.replace(/\.[^.]+$/, '').slice(0, 64) || 'Imported'
    setPalettes([...palettes, { name, colours: imported.slice(0, 256).map(toHex) }])
    setIndex(palettes.length)
  }

  const primaryHex = toHex(primary)
  const hasPrimary = current?.colours.includes(primaryHex) ?? false

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-ink-muted">From the original</span>
        <Swatches colours={originalPalette} label="Colours of the original" />
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-1">
          <select
            aria-label="Palette"
            value={currentIndex}
            onChange={(event) => setIndex(Number(event.target.value))}
            className="min-w-0 flex-1 rounded border border-line bg-raised px-1 py-0.5 text-xs"
          >
            {palettes.map((palette, i) => (
              <option key={i} value={i}>
                {palette.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={smallButton}
            title="New palette"
            onClick={() => {
              setPalettes([...palettes, { name: `Palette ${palettes.length + 1}`, colours: [] }])
              setIndex(palettes.length)
            }}
          >
            New
          </button>
          <label className={`${smallButton} cursor-pointer`} title="Import .gpl, .pal or .hex">
            Import…
            <input
              type="file"
              accept=".gpl,.pal,.hex,.txt"
              aria-label="Import palette"
              className="sr-only"
              onChange={(event) => {
                void importFile(event.target.files?.[0])
                event.target.value = ''
              }}
            />
          </label>
        </div>
        {current && (
          <>
            <Swatches colours={colours} label={`Colours of ${current.name}`} />
            <div className="flex flex-wrap items-center gap-1">
              <button
                type="button"
                className={smallButton}
                disabled={hasPrimary}
                onClick={() => update({ ...current, colours: [...current.colours, primaryHex] })}
              >
                Add colour
              </button>
              <button
                type="button"
                className={smallButton}
                disabled={!hasPrimary}
                onClick={() =>
                  update({
                    ...current,
                    colours: current.colours.filter((colour) => colour !== primaryHex),
                  })
                }
              >
                Remove colour
              </button>
              <button
                type="button"
                className={`${smallButton} ml-auto`}
                onClick={() => {
                  const name = window.prompt('Palette name', current.name)?.trim()
                  if (name) update({ ...current, name: name.slice(0, 64) })
                }}
              >
                Rename
              </button>
              <button
                type="button"
                className={smallButton}
                disabled={palettes.length <= 1}
                onClick={() => {
                  if (!window.confirm(`Delete the palette “${current.name}”?`)) return
                  setPalettes(palettes.filter((_, i) => i !== currentIndex))
                  setIndex(0)
                }}
              >
                Delete
              </button>
            </div>
          </>
        )}
        {message && <p className="text-xs text-danger">{message}</p>}
      </div>
    </div>
  )
}

/** Layers, top first (docs/DECISIONS.md #28). */
function LayersPanel({ doc }: { doc: EditorDocument }) {
  const commit = useEditor((state) => state.commit)
  const setActiveLayer = useEditor((state) => state.setActiveLayer)
  const [renaming, setRenaming] = useState<number | null>(null)
  const active = activeLayer(doc)
  const index = doc.layers.indexOf(active)
  const top = [...doc.layers].reverse()

  return (
    <div className="flex flex-col gap-2">
      <ul aria-label="Layers" className="flex flex-col gap-0.5">
        {top.map((layer) => (
          <li
            key={layer.id}
            aria-current={layer.id === active.id}
            className="flex items-center gap-1.5 rounded px-1 py-0.5 aria-current:bg-grass/15"
          >
            <input
              type="checkbox"
              checked={layer.visible}
              aria-label={`Show ${layer.name}`}
              onChange={(event) =>
                commit(
                  event.target.checked ? 'Show layer' : 'Hide layer',
                  setLayerProps(doc, layer.id, { visible: event.target.checked }),
                )
              }
            />
            {renaming === layer.id ? (
              <input
                autoFocus
                aria-label="Layer name"
                defaultValue={layer.name}
                maxLength={64}
                onBlur={(event) => {
                  const name = event.target.value.trim()
                  setRenaming(null)
                  if (name && name !== layer.name) {
                    commit('Rename layer', setLayerProps(doc, layer.id, { name }))
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') event.currentTarget.blur()
                  if (event.key === 'Escape') setRenaming(null)
                }}
                className="min-w-0 flex-1 rounded border border-line bg-raised px-1 text-xs"
              />
            ) : (
              <button
                type="button"
                onClick={() => setActiveLayer(layer.id)}
                onDoubleClick={() => setRenaming(layer.id)}
                title="Double-click to rename"
                className="min-w-0 flex-1 truncate text-left text-xs"
              >
                {layer.name}
                {layer.opacity < 1 && (
                  <span className="text-ink-muted"> · {Math.round(layer.opacity * 100)}%</span>
                )}
              </button>
            )}
          </li>
        ))}
      </ul>
      <label className="flex items-center gap-2 text-xs text-ink-muted">
        Opacity
        <input
          type="range"
          min={0}
          max={100}
          aria-label="Layer opacity"
          value={Math.round(active.opacity * 100)}
          onChange={(event) =>
            commit(
              'Layer opacity',
              setLayerProps(doc, active.id, { opacity: Number(event.target.value) / 100 }),
              { coalesce: true },
            )
          }
          className="flex-1"
        />
      </label>
      <div className="flex flex-wrap gap-1">
        <button
          type="button"
          className={smallButton}
          onClick={() => commit('Add layer', addLayer(doc))}
        >
          Add
        </button>
        <button
          type="button"
          className={smallButton}
          onClick={() => commit('Duplicate layer', duplicateLayer(doc))}
        >
          Duplicate
        </button>
        <button
          type="button"
          className={smallButton}
          disabled={doc.layers.length <= 1}
          onClick={() => commit('Delete layer', removeLayer(doc))}
        >
          Delete
        </button>
        <button
          type="button"
          className={smallButton}
          aria-label="Move layer up"
          disabled={index >= doc.layers.length - 1}
          onClick={() => commit('Move layer', moveLayer(doc, 1))}
        >
          ↑
        </button>
        <button
          type="button"
          className={smallButton}
          aria-label="Move layer down"
          disabled={index <= 0}
          onClick={() => commit('Move layer', moveLayer(doc, -1))}
        >
          ↓
        </button>
        <button
          type="button"
          className={smallButton}
          disabled={index <= 0}
          onClick={() => commit('Merge down', mergeDown(doc))}
        >
          Merge down
        </button>
      </div>
      <p className="text-[11px] text-ink-muted">
        Layers are kept in the project only; the pack gets the combined picture.
      </p>
    </div>
  )
}

/** Every step since the texture was opened; click one to go back to it (docs/DECISIONS.md #30). */
function HistoryPanel() {
  const history = useEditor((state) => state.history)
  const undo = useEditor((state) => state.undo)
  const redo = useEditor((state) => state.redo)
  const jumpTo = useEditor((state) => state.jumpTo)
  const listRef = useRef<HTMLOListElement>(null)

  useEffect(() => {
    listRef.current?.querySelector('[aria-current="step"]')?.scrollIntoView({ block: 'nearest' })
  }, [history])

  if (!history) return null
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-1">
        <button type="button" className={smallButton} disabled={!canUndo(history)} onClick={undo}>
          Undo
        </button>
        <button type="button" className={smallButton} disabled={!canRedo(history)} onClick={redo}>
          Redo
        </button>
      </div>
      <ol ref={listRef} aria-label="History" className="flex max-h-48 flex-col overflow-auto">
        {history.entries.map((entry, i) => (
          <li key={i}>
            <button
              type="button"
              aria-current={i === history.index ? 'step' : undefined}
              onClick={() => jumpTo(i)}
              className={`w-full rounded px-1.5 py-0.5 text-left text-xs aria-[current=step]:bg-grass/15 ${
                i > history.index ? 'text-ink-muted line-through' : ''
              }`}
            >
              {entry.label}
            </button>
          </li>
        ))}
      </ol>
    </div>
  )
}

/** Right column while a texture is open in the editor. */
export function EditorSidebar({ row }: { row: TextureRow }) {
  const status = useEditor((state) => state.status)
  const history = useEditor((state) => state.history)
  const doc = history ? currentDoc(history) : null

  return (
    <div className="flex flex-col">
      {status === 'ready' && doc && (
        <>
          <Section title="Colour">
            <ColourPanel />
          </Section>
          <Section title="Palettes">
            <PalettePanel />
          </Section>
          <Section title="Layers">
            <LayersPanel doc={doc} />
          </Section>
          <Section title="History">
            <HistoryPanel />
          </Section>
        </>
      )}
      <Section title="Texture" padded={false}>
        <TextureProperties row={row} />
      </Section>
    </div>
  )
}
