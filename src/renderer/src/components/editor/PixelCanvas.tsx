import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type DragEvent,
  type PointerEvent,
} from 'react'
import { activeLayer, compose, setLayerPixels, type EditorDocument } from '../../editor/document'
import { currentDoc } from '../../editor/history'
import {
  clipRect,
  cloneBitmap,
  extract,
  fillRect,
  getPixel,
  pasteOpaque,
  rectFromPoints,
  TRANSPARENT,
  type Bitmap,
  type Rect,
  type Rgba,
} from '../../editor/pixels'
import {
  brushPoints,
  ellipsePoints,
  floodFill,
  gradientFill,
  linePoints,
  mirrorPoints,
  paintPoints,
  rectanglePoints,
  type Point,
} from '../../editor/raster'
import { editActiveLayer, nextZoom, useEditor, type Tool } from '../../store/editor'
import { useSettings } from '../../store/settings'

const PAINT_TOOLS: ReadonlySet<Tool> = new Set(['pencil', 'eraser', 'line', 'rectangle', 'ellipse'])

const TOOL_LABELS: Record<Tool, string> = {
  pencil: 'Pencil',
  eraser: 'Eraser',
  fill: 'Fill',
  gradient: 'Gradient',
  picker: 'Pick colour',
  line: 'Line',
  rectangle: 'Rectangle',
  ellipse: 'Ellipse',
  select: 'Select',
  move: 'Move',
}

/** A drag with a tool, painted into a copy of the active layer until the button is let go. */
interface Stroke {
  tool: Tool
  pointerId: number
  colour: Rgba
  secondary: boolean
  start: Point
  last: Point
  base: EditorDocument
  layerId: number
  basePixels: Bitmap
  working: Bitmap
  changed: boolean
  /** Move tool: the region being moved, its pixels and the layer without them. */
  region?: Rect
  floating?: Bitmap
  hole?: Bitmap
  movedSelection?: Rect | null
}

interface Pan {
  pointerId: number
  startX: number
  startY: number
  panX: number
  panY: number
}

/** The largest zoom that fits a texture into the visible area: whole numbers from 1 up. */
function fitZoomFor(textureWidth: number, textureHeight: number, width: number, height: number) {
  const fit = Math.min((width - 32) / textureWidth, (height - 32) / textureHeight)
  if (!(fit > 0)) return 1
  return fit >= 1 ? Math.floor(fit) : fit
}

const insideDoc = (doc: EditorDocument, [x, y]: Point): boolean =>
  x >= 0 && y >= 0 && x < doc.width && y < doc.height

function inRect(rect: Rect | null, [x, y]: Point): boolean {
  return (
    !rect || (x >= rect.x && y >= rect.y && x < rect.x + rect.width && y < rect.y + rect.height)
  )
}

/** The centre of the editor: shows the texture and turns mouse, pen and touch into edits. */
export function PixelCanvas({ onDropFile }: { onDropFile: (file: File) => void }) {
  const history = useEditor((state) => state.history)
  const zoomSetting = useEditor((state) => state.zoom)
  const fitZoom = useEditor((state) => state.fitZoom)
  const tool = useEditor((state) => state.tool)
  const selection = useEditor((state) => state.selection)
  const showGrid = useEditor((state) => state.showGrid)
  const pan = useEditor((state) => state.pan)
  const background = useSettings((state) => state.editorBackground)
  const doc = history ? currentDoc(history) : null

  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [dragging, setDragging] = useState(false)
  const [spaceHeld, setSpaceHeld] = useState(false)
  const strokeRef = useRef<Stroke | null>(null)
  const panRef = useRef<Pan | null>(null)
  /** The document with the stroke in progress, shown instead of the committed one. */
  const draftRef = useRef<EditorDocument | null>(null)
  const draftSelectionRef = useRef<Rect | null | undefined>(undefined)
  const frameRef = useRef(0)

  const zoom = zoomSetting ?? fitZoom
  const originX = doc ? Math.round((size.width - doc.width * zoom) / 2 + pan.x) : 0
  const originY = doc ? Math.round((size.height - doc.height * zoom) / 2 + pan.y) : 0

  // Everything the drawing and pointer code needs, kept current without re-creating callbacks.
  const view = useRef({ doc, zoom, originX, originY, background, showGrid, selection, tool })
  useLayoutEffect(() => {
    view.current = { doc, zoom, originX, originY, background, showGrid, selection, tool }
  })
  const composed = useRef<{ doc: EditorDocument | null; canvas: HTMLCanvasElement | null }>({
    doc: null,
    canvas: null,
  })
  const hoverRef = useRef<Point | null>(null)

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return
    const observer = new ResizeObserver(([entry]) => {
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  // Report the fitting zoom, and centre the texture again whenever it is fitted.
  const docWidth = doc?.width ?? 0
  const docHeight = doc?.height ?? 0
  useEffect(() => {
    if (!docWidth || !size.width) return
    useEditor.getState().setFitZoom(fitZoomFor(docWidth, docHeight, size.width, size.height))
  }, [docWidth, docHeight, size.width, size.height])

  const draw = useCallback(() => {
    frameRef.current = 0
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return
    const { zoom, originX, originY, background, showGrid, tool } = view.current
    const doc = draftRef.current ?? view.current.doc
    const selection =
      draftSelectionRef.current === undefined ? view.current.selection : draftSelectionRef.current
    const ratio = window.devicePixelRatio || 1
    context.setTransform(ratio, 0, 0, ratio, 0, 0)
    context.clearRect(0, 0, canvas.width, canvas.height)
    if (!doc) return

    const width = doc.width * zoom
    const height = doc.height * zoom
    context.fillStyle = background
    context.fillRect(originX, originY, width, height)

    if (composed.current.doc !== doc) {
      const image = compose(doc)
      const offscreen = composed.current.canvas ?? document.createElement('canvas')
      offscreen.width = image.width
      offscreen.height = image.height
      offscreen
        .getContext('2d')
        ?.putImageData(
          new ImageData(image.data as Uint8ClampedArray<ArrayBuffer>, image.width, image.height),
          0,
          0,
        )
      composed.current = { doc, canvas: offscreen }
    }
    context.imageSmoothingEnabled = false
    if (composed.current.canvas)
      context.drawImage(composed.current.canvas, originX, originY, width, height)

    // Pixel grid (docs/DECISIONS.md #36), only once the pixels are big enough to see it.
    if (showGrid && zoom >= 6) {
      const left = Math.max(0, Math.floor(-originX / zoom))
      const right = Math.min(doc.width, Math.ceil((canvas.width / ratio - originX) / zoom))
      const top = Math.max(0, Math.floor(-originY / zoom))
      const bottom = Math.min(doc.height, Math.ceil((canvas.height / ratio - originY) / zoom))
      context.beginPath()
      for (let x = left; x <= right; x++) {
        context.moveTo(originX + x * zoom + 0.5 / ratio, originY + top * zoom)
        context.lineTo(originX + x * zoom + 0.5 / ratio, originY + bottom * zoom)
      }
      for (let y = top; y <= bottom; y++) {
        context.moveTo(originX + left * zoom, originY + y * zoom + 0.5 / ratio)
        context.lineTo(originX + right * zoom, originY + y * zoom + 0.5 / ratio)
      }
      context.lineWidth = 1 / ratio
      context.strokeStyle = 'rgba(0, 0, 0, 0.22)'
      context.stroke()
    }

    // The brush outline under the mouse.
    const hover = hoverRef.current
    if (hover && PAINT_TOOLS.has(tool) && insideDoc(doc, hover)) {
      const brush = useEditor.getState().brushSize
      const offset = Math.floor((brush - 1) / 2)
      context.lineWidth = 1
      context.strokeStyle = 'rgba(255, 255, 255, 0.8)'
      context.strokeRect(
        originX + (hover[0] - offset) * zoom + 0.5,
        originY + (hover[1] - offset) * zoom + 0.5,
        brush * zoom - 1,
        brush * zoom - 1,
      )
    }

    if (selection) {
      const x = originX + selection.x * zoom + 0.5
      const y = originY + selection.y * zoom + 0.5
      context.lineWidth = 1
      context.setLineDash([4, 4])
      context.strokeStyle = '#000'
      context.strokeRect(x, y, selection.width * zoom - 1, selection.height * zoom - 1)
      context.lineDashOffset = 4
      context.strokeStyle = '#fff'
      context.strokeRect(x, y, selection.width * zoom - 1, selection.height * zoom - 1)
      context.setLineDash([])
      context.lineDashOffset = 0
    }
  }, [])

  const redraw = useCallback(() => {
    if (!frameRef.current) frameRef.current = requestAnimationFrame(draw)
  }, [draw])

  useEffect(() => () => cancelAnimationFrame(frameRef.current), [])

  // Size the canvas for sharp pixels on high-DPI screens, then draw.
  useLayoutEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ratio = window.devicePixelRatio || 1
    canvas.width = Math.round(size.width * ratio)
    canvas.height = Math.round(size.height * ratio)
    draw()
  }, [size, draw])

  useEffect(() => {
    redraw()
  }, [redraw, doc, zoom, originX, originY, background, showGrid, selection, tool])

  // Space + drag pans, like in most image editors.
  useEffect(() => {
    const typing = (target: EventTarget | null): boolean =>
      target instanceof HTMLElement &&
      !!target.closest('input, textarea, select, button, [role="slider"], [contenteditable]')
    const down = (event: KeyboardEvent): void => {
      if (event.code === 'Space' && !typing(event.target)) {
        event.preventDefault()
        setSpaceHeld(true)
      }
    }
    const up = (event: KeyboardEvent): void => {
      if (event.code === 'Space') setSpaceHeld(false)
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])

  // Mouse-wheel zoom around the pointer (docs/DECISIONS.md #36). Not passive, to stop scrolling.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const onWheel = (event: WheelEvent): void => {
      const { doc, zoom, originX, originY } = view.current
      if (!doc || event.deltaY === 0) return
      event.preventDefault()
      const next = nextZoom(zoom, event.deltaY < 0 ? 1 : -1)
      if (next === zoom) return
      const box = canvas.getBoundingClientRect()
      const pointerX = event.clientX - box.left
      const pointerY = event.clientY - box.top
      // Keep the texture pixel under the pointer where it is.
      const textureX = (pointerX - originX) / zoom
      const textureY = (pointerY - originY) / zoom
      const width = box.width
      const height = box.height
      useEditor.getState().setZoom(next, {
        x: pointerX - textureX * next - (width - doc.width * next) / 2,
        y: pointerY - textureY * next - (height - doc.height * next) / 2,
      })
    }
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  }, [])

  const pixelAt = (event: { clientX: number; clientY: number }): Point => {
    const box = canvasRef.current!.getBoundingClientRect()
    const { zoom, originX, originY } = view.current
    return [
      Math.floor((event.clientX - box.left - originX) / zoom),
      Math.floor((event.clientY - box.top - originY) / zoom),
    ]
  }

  const pickColour = (point: Point, secondary: boolean): void => {
    const doc = view.current.doc
    if (!doc || !insideDoc(doc, point)) return
    const colour = getPixel(compose(doc), point[0], point[1])
    const editor = useEditor.getState()
    if (secondary) editor.setSecondary(colour)
    else editor.setPrimary(colour)
  }

  /** Points painted by the brush, mirrored and kept inside the selection. */
  const shapePoints = (points: readonly Point[], brush: number): Point[] => {
    const doc = view.current.doc!
    const { symmetry, selection } = useEditor.getState()
    const widened = brush > 1 ? points.flatMap((point) => brushPoints(point, brush)) : [...points]
    return mirrorPoints(widened, doc.width, doc.height, symmetry).filter((point) =>
      inRect(selection, point),
    )
  }

  const updateStroke = (stroke: Stroke, point: Point, pressure: number | null): void => {
    const editor = useEditor.getState()
    const brush =
      pressure === null ? editor.brushSize : Math.max(1, Math.round(editor.brushSize * pressure))
    const [x0, y0] = stroke.start
    const [x1, y1] = point
    switch (stroke.tool) {
      case 'pencil':
      case 'eraser': {
        const points = shapePoints(linePoints(stroke.last[0], stroke.last[1], x1, y1), brush)
        paintPoints(stroke.working, points, stroke.tool === 'eraser' ? TRANSPARENT : stroke.colour)
        stroke.changed ||= points.length > 0
        break
      }
      case 'line':
      case 'rectangle':
      case 'ellipse': {
        stroke.working = cloneBitmap(stroke.basePixels)
        const outline =
          stroke.tool === 'line'
            ? linePoints(x0, y0, x1, y1)
            : stroke.tool === 'rectangle'
              ? rectanglePoints(x0, y0, x1, y1, editor.filled)
              : ellipsePoints(x0, y0, x1, y1, editor.filled)
        const points = shapePoints(outline, editor.filled && stroke.tool !== 'line' ? 1 : brush)
        paintPoints(stroke.working, points, stroke.colour)
        stroke.changed = points.length > 0
        break
      }
      case 'gradient': {
        stroke.working = cloneBitmap(stroke.basePixels)
        const doc = stroke.base
        const region = editor.selection ?? { x: 0, y: 0, width: doc.width, height: doc.height }
        const [a, b] = stroke.secondary
          ? [editor.secondary, editor.primary]
          : [editor.primary, editor.secondary]
        gradientFill(stroke.working, region, stroke.start, point, a, b, editor.gradientMode)
        stroke.changed = true
        break
      }
      case 'select':
        draftSelectionRef.current = clipRect(
          rectFromPoints(x0, y0, x1, y1),
          stroke.base.width,
          stroke.base.height,
        )
        break
      case 'move': {
        const dx = x1 - x0
        const dy = y1 - y0
        stroke.working = cloneBitmap(stroke.hole!)
        pasteOpaque(stroke.working, stroke.floating!, stroke.region!.x + dx, stroke.region!.y + dy)
        stroke.changed = dx !== 0 || dy !== 0
        if (stroke.movedSelection !== undefined && editor.selection) {
          stroke.movedSelection = {
            ...editor.selection,
            x: editor.selection.x + dx,
            y: editor.selection.y + dy,
          }
          draftSelectionRef.current = stroke.movedSelection
        }
        break
      }
      case 'picker':
        pickColour(point, stroke.secondary)
        break
      case 'fill':
        break
    }
    stroke.last = point
    if (stroke.tool !== 'select' && stroke.tool !== 'picker') {
      draftRef.current = setLayerPixels(stroke.base, stroke.layerId, stroke.working)
    }
    redraw()
  }

  const onPointerDown = (event: PointerEvent<HTMLCanvasElement>): void => {
    const doc = view.current.doc
    if (!doc || strokeRef.current || panRef.current) return
    const canvas = event.currentTarget
    // Keyboard focus moves to the canvas, so Space pans instead of pressing the last button.
    canvas.focus({ preventScroll: true })

    if (event.button === 1 || spaceHeld) {
      canvas.setPointerCapture(event.pointerId)
      panRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        panX: pan.x,
        panY: pan.y,
      }
      return
    }
    if (event.button !== 0 && event.button !== 2) return

    const editor = useEditor.getState()
    const point = pixelAt(event)
    const secondary = event.button === 2
    let activeTool = editor.tool
    // Alt picks a colour with any painting tool.
    if (event.altKey && activeTool !== 'select' && activeTool !== 'move') activeTool = 'picker'

    if (activeTool === 'fill') {
      if (!insideDoc(doc, point)) return
      const colour = secondary ? editor.secondary : editor.primary
      let changed = false
      const next = editActiveLayer(doc, (pixels) => {
        for (const [x, y] of mirrorPoints([point], doc.width, doc.height, editor.symmetry)) {
          changed = floodFill(pixels, x, y, colour, editor.selection) || changed
        }
      })
      if (changed) editor.commit('Fill', next)
      return
    }

    const layer = activeLayer(doc)
    const stroke: Stroke = {
      tool: activeTool,
      pointerId: event.pointerId,
      colour: secondary ? editor.secondary : editor.primary,
      secondary,
      start: point,
      last: point,
      base: doc,
      layerId: layer.id,
      basePixels: layer.pixels,
      working: cloneBitmap(layer.pixels),
      changed: false,
    }
    if (activeTool === 'move') {
      const region = editor.selection ?? { x: 0, y: 0, width: doc.width, height: doc.height }
      stroke.region = region
      stroke.floating = extract(layer.pixels, region)
      stroke.hole = cloneBitmap(layer.pixels)
      fillRect(stroke.hole, region, TRANSPARENT)
      stroke.movedSelection = editor.selection
    }
    canvas.setPointerCapture(event.pointerId)
    strokeRef.current = stroke
    updateStroke(stroke, point, event.pointerType === 'pen' ? event.pressure : null)
  }

  const onPointerMove = (event: PointerEvent<HTMLCanvasElement>): void => {
    const doc = view.current.doc
    const point = pixelAt(event)
    const inside = !!doc && insideDoc(doc, point)
    useEditor.getState().setCursor(inside ? point : null)
    const hover = hoverRef.current
    if (hover?.[0] !== point[0] || hover?.[1] !== point[1]) {
      hoverRef.current = inside ? point : null
      redraw()
    }

    const panning = panRef.current
    if (panning && panning.pointerId === event.pointerId) {
      useEditor.getState().setPan({
        x: panning.panX + event.clientX - panning.startX,
        y: panning.panY + event.clientY - panning.startY,
      })
      return
    }
    const stroke = strokeRef.current
    if (!stroke || stroke.pointerId !== event.pointerId) return
    if (point[0] === stroke.last[0] && point[1] === stroke.last[1]) return
    updateStroke(stroke, point, event.pointerType === 'pen' ? event.pressure : null)
  }

  const finish = (event: PointerEvent<HTMLCanvasElement>, keep: boolean): void => {
    if (panRef.current?.pointerId === event.pointerId) {
      panRef.current = null
      return
    }
    const stroke = strokeRef.current
    if (!stroke || stroke.pointerId !== event.pointerId) return
    strokeRef.current = null
    const editor = useEditor.getState()
    const draft = draftRef.current
    const draftSelection = draftSelectionRef.current
    draftRef.current = null
    draftSelectionRef.current = undefined

    if (keep) {
      if (stroke.tool === 'select') {
        const clicked = stroke.start[0] === stroke.last[0] && stroke.start[1] === stroke.last[1]
        editor.setSelection(clicked ? null : (draftSelection ?? null))
      } else if (stroke.changed && draft) {
        editor.commit(TOOL_LABELS[stroke.tool], draft)
        if (stroke.tool === 'move' && stroke.movedSelection)
          editor.setSelection(stroke.movedSelection)
      }
    }
    redraw()
  }

  const onDrop = (event: DragEvent): void => {
    event.preventDefault()
    setDragging(false)
    const file = event.dataTransfer.files[0]
    if (file) onDropFile(file)
  }

  const cursor = spaceHeld
    ? 'grab'
    : tool === 'move'
      ? 'move'
      : tool === 'picker'
        ? 'copy'
        : 'crosshair'

  return (
    <div
      ref={containerRef}
      onDragOver={(event) => {
        event.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={`relative min-h-0 min-w-0 flex-1 overflow-hidden ${
        dragging ? 'bg-grass/10 outline-2 -outline-offset-8 outline-grass outline-dashed' : ''
      }`}
    >
      <canvas
        ref={canvasRef}
        aria-label="Texture canvas"
        tabIndex={0}
        data-zoom={zoom}
        data-origin-x={originX}
        data-origin-y={originY}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(event) => finish(event, true)}
        onPointerCancel={(event) => finish(event, false)}
        onPointerLeave={() => {
          useEditor.getState().setCursor(null)
          hoverRef.current = null
          redraw()
        }}
        onContextMenu={(event) => event.preventDefault()}
        style={{ cursor, width: size.width, height: size.height }}
        className="absolute inset-0 touch-none outline-none"
      />
    </div>
  )
}
