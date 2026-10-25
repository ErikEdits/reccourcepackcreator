// The 3D preview (docs/DECISIONS.md #37, #40): a block with its real model or an item sprite with
// thickness, shown with the textures being edited and painted on directly.

import { Canvas, useThree } from '@react-three/fiber'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from 'react'
import {
  DataTexture,
  FrontSide,
  MeshBasicMaterial,
  MOUSE,
  NearestFilter,
  NoColorSpace,
  Raycaster,
  RGBAFormat,
  Vector2,
  type Camera,
  type Mesh,
} from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { BlockModel } from '../../../shared/block-models'
import { mobModelFor, mobTexturesUnder } from '../../../shared/mob-models'
import type { TextureRow } from '../../../shared/textures'
import { activeLayer, compose, setLayerPixels, type EditorDocument } from '../editor/document'
import { currentDoc } from '../editor/history'
import { getDraft, onDraft, setDraft } from '../editor/live'
import { cloneBitmap, getPixel, TRANSPARENT, type Bitmap, type Rgba } from '../editor/pixels'
import {
  brushPoints,
  floodFill,
  linePoints,
  mirrorPoints,
  paintPoints,
  type Point,
} from '../editor/raster'
import { decodeImage } from '../lib/images'
import { editActiveLayer, editedDocument, useEditor } from '../store/editor'
import { useTextureRows, useTextures } from '../store/textures'
import { CAMERA_DIRECTION, cameraDistance, FOV, type PreviewKind } from './camera'
import {
  alphaMask,
  blockGeometry,
  itemGeometry,
  mobGeometry,
  type PreviewGeometry,
} from './geometry'

/** Tools that work on the 3D model; with the others, dragging turns the model. */
const PAINT_TOOLS = new Set(['pencil', 'eraser', 'fill', 'picker'])

const blockModels = new Map<string, Promise<BlockModel | null>>()

function useBlockModel(version: string, id: string | null): BlockModel | null | undefined {
  const [result, setResult] = useState<{ key: string; model: BlockModel | null } | null>(null)
  const key = `${version}:${id}`
  useEffect(() => {
    if (!id) return
    let cancelled = false
    let pending = blockModels.get(key)
    if (!pending) {
      pending = window.api.textures.blockModel(id).catch(() => null)
      blockModels.set(key, pending)
    }
    void pending.then((model) => {
      if (!cancelled) setResult({ key, model })
    })
    return () => {
      cancelled = true
    }
  }, [key, id])
  if (!id) return null
  return result?.key === key ? result.model : undefined
}

/** The picture of a texture as it should look now: being drawn, edited, saved or original. */
async function loadBitmap(row: TextureRow | undefined, path: string): Promise<Bitmap | null> {
  const edited = editedDocument(path)
  if (edited) return compose(edited)
  const source = row && (row.changed || row.added) ? 'pack' : 'vanilla'
  const bytes = await window.api.textures.readImage(source, path)
  return bytes ? decodeImage(bytes) : null
}

interface Slot {
  texture: DataTexture
  bitmap: Bitmap
}

function makeTexture(bitmap: Bitmap, animated: boolean): DataTexture {
  const texture = new DataTexture(
    new Uint8ClampedArray(bitmap.data),
    bitmap.width,
    bitmap.height,
    RGBAFormat,
  )
  texture.magFilter = NearestFilter
  texture.minFilter = NearestFilter
  texture.generateMipmaps = false
  texture.colorSpace = NoColorSpace
  // Animation strips show their first frame.
  if (animated && bitmap.height > bitmap.width) texture.repeat.set(1, bitmap.width / bitmap.height)
  texture.needsUpdate = true
  return texture
}

/** Hands the camera, mesh and redraw function to the pointer code outside the canvas. */
interface Bridge {
  camera: Camera
  invalidate: () => void
  element: HTMLCanvasElement
}

function Scene({
  geometry,
  materials,
  meshRef,
  bridgeRef,
  kind,
  radius,
  resetKey,
  onReady,
}: {
  geometry: PreviewGeometry | null
  materials: MeshBasicMaterial[]
  meshRef: RefObject<Mesh | null>
  bridgeRef: RefObject<Bridge | null>
  kind: PreviewKind
  /** Size of the model, so the camera can back off far enough to show all of it. */
  radius: number
  resetKey: number
  /** Called once the model is on screen and can be clicked. */
  onReady: (geometry: PreviewGeometry | null) => void
}) {
  const { camera, gl, invalidate, size } = useThree()
  const aspect = size.height > 0 ? size.width / size.height : 1

  useEffect(() => {
    bridgeRef.current = { camera, invalidate, element: gl.domElement }
  }, [bridgeRef, camera, gl, invalidate])

  // After this commit the mesh (if any) is in the scene.
  useEffect(() => onReady(geometry), [geometry, onReady])

  const controlsRef = useRef<OrbitControls | null>(null)
  /** The user turned or zoomed the view; resizing the window then keeps their view. */
  const turnedRef = useRef(false)

  useEffect(() => {
    const controls = new OrbitControls(camera, gl.domElement)
    controls.mouseButtons = { LEFT: MOUSE.ROTATE, MIDDLE: MOUSE.PAN, RIGHT: MOUSE.ROTATE }
    const redraw = (): void => invalidate()
    const turned = (): void => {
      turnedRef.current = true
    }
    controls.addEventListener('change', redraw)
    controls.addEventListener('start', turned)
    controlsRef.current = controls
    return () => {
      controls.removeEventListener('change', redraw)
      controls.removeEventListener('start', turned)
      controls.dispose()
      controlsRef.current = null
    }
  }, [camera, gl, invalidate])

  // Frames the whole model: for a new model, on "Reset view", and when the view changes size
  // as long as the user has not turned it themselves.
  const framedRef = useRef('')
  useEffect(() => {
    const controls = controlsRef.current
    if (!controls) return
    const key = `${kind}:${radius}:${resetKey}`
    if (key === framedRef.current && turnedRef.current) return
    framedRef.current = key
    turnedRef.current = false
    const [x, y, z] = CAMERA_DIRECTION[kind]
    camera.position.set(x, y, z).setLength(cameraDistance(radius, aspect))
    controls.target.set(0, 0, 0)
    controls.minDistance = radius
    controls.maxDistance = Math.max(8, radius * 12)
    controls.update()
    invalidate()
  }, [camera, invalidate, kind, radius, resetKey, aspect])

  useEffect(() => invalidate(), [geometry, materials, invalidate])

  return geometry ? <mesh ref={meshRef} geometry={geometry.geometry} material={materials} /> : null
}

interface Stroke {
  pointerId: number
  tool: 'pencil' | 'eraser'
  base: EditorDocument
  layerId: number
  working: Bitmap
  last: Point
  quad: number
  changed: boolean
}

export interface Preview3DProps {
  /** The texture open in the editor. */
  row: TextureRow
  /** All textures of its block. */
  blockRows: TextureRow[]
  /** Opens another texture of the block (a face of another texture was clicked). */
  onSelectTexture: (path: string) => void
}

export default function Preview3D({ row, blockRows, onSelectTexture }: Preview3DProps) {
  const version = useTextures((state) => state.index?.version ?? '')
  const blocks = useTextures((state) => state.index?.blocks)
  const revision = useTextures((state) => state.revision)
  const history = useEditor((state) => state.history)
  const editorPath = useEditor((state) => state.path)
  const status = useEditor((state) => state.status)
  const tool = useEditor((state) => state.tool)
  const block = row.block ? blocks?.find((entry) => entry.id === row.block) : undefined
  const mob = row.vanilla ? mobModelFor(row.path, row.vanilla.width, row.vanilla.height) : null
  const kind: PreviewKind | null = block?.has3d
    ? 'block'
    : row.path.startsWith('item/')
      ? 'item'
      : mob
        ? 'mob'
        : null
  const model = useBlockModel(version, kind === 'block' ? (row.block ?? null) : null)
  const [webgl] = useState(() => {
    try {
      return !!document.createElement('canvas').getContext('webgl2')
    } catch {
      return false
    }
  })
  const [resetKey, setResetKey] = useState(0)

  // The open texture as it looks right now, including a stroke being drawn.
  const draft = useSyncExternalStore(onDraft, getDraft)
  const live = useMemo(() => {
    const doc = draft ?? (history ? currentDoc(history) : null)
    return doc && editorPath === row.path && status === 'ready' ? compose(doc) : null
  }, [draft, history, editorPath, row.path, status])

  const itemMask = kind === 'item' && live ? alphaMask(live) : null
  // A pack's picture may be bigger than the original, but must keep the mob's layout.
  const mobFits = !mob || !live || mobModelFor(row.path, live.width, live.height) === mob
  const geometry = useMemo<PreviewGeometry | null>(() => {
    if (kind === 'block') return model ? blockGeometry(model) : null
    if (kind === 'item' && live && itemMask) return itemGeometry(row.path, live)
    if (kind === 'mob' && mob && mobFits) {
      return mobGeometry(mob, row.path, mobTexturesUnder(row.path))
    }
    return null
    // The item's shape only changes with its outline, not with every colour.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, model, itemMask, mob, mobFits, row.path])
  const radius = useMemo(() => {
    if (!geometry) return 1
    geometry.geometry.computeBoundingSphere()
    return Math.round((geometry.geometry.boundingSphere?.radius ?? 1) * 1000) / 1000
  }, [geometry])
  useEffect(() => () => geometry?.geometry.dispose(), [geometry])

  const materials = useMemo(
    () =>
      (geometry?.textures ?? []).map(
        () =>
          new MeshBasicMaterial({
            vertexColors: true,
            transparent: true,
            alphaTest: 0.05,
            side: FrontSide,
          }),
      ),
    [geometry],
  )
  useEffect(() => () => materials.forEach((material) => material.dispose()), [materials])

  // Pictures of every texture the model uses; the open one follows the editor live.
  const slots = useRef(new Map<string, Slot>())
  // Every texture of the pack, so textures under an overlay show the pack's version too.
  const allRows = useTextureRows()
  const rowsByPath = useMemo(
    () => new Map([...allRows, ...blockRows].map((entry) => [entry.path, entry])),
    [allRows, blockRows],
  )
  const animated = useCallback(
    (path: string) => !!rowsByPath.get(path)?.vanilla?.animated,
    [rowsByPath],
  )

  const putBitmap = useCallback(
    (path: string, bitmap: Bitmap): void => {
      const slot = slots.current.get(path)
      if (slot && slot.bitmap.width === bitmap.width && slot.bitmap.height === bitmap.height) {
        ;(slot.texture.image.data as Uint8ClampedArray).set(bitmap.data)
        slot.texture.needsUpdate = true
        slot.bitmap = bitmap
      } else {
        slot?.texture.dispose()
        slots.current.set(path, { texture: makeTexture(bitmap, animated(path)), bitmap })
      }
    },
    [animated],
  )

  // Points each material at its texture once the pictures are there, then redraws.
  const bridgeRef = useRef<Bridge | null>(null)
  const syncMaterials = useCallback(() => {
    geometry?.textures.forEach((path, index) => {
      const material = materials[index]
      const texture = slots.current.get(path)?.texture ?? null
      if (material && material.map !== texture) {
        material.map = texture
        material.visible = texture !== null
        material.needsUpdate = true
      }
    })
    bridgeRef.current?.invalidate()
  }, [geometry, materials])

  /** The geometry whose other textures have all arrived (for the "ready" mark tests wait on). */
  const [loadedFor, setLoadedFor] = useState<PreviewGeometry | null>(null)
  /** The geometry the 3D scene has mounted. */
  const [shown, setShown] = useState<PreviewGeometry | null>(null)
  useEffect(() => {
    let cancelled = false
    const others = (geometry?.textures ?? []).filter((path) => path !== editorPath)
    void Promise.all(
      others.map(async (path) => {
        const bitmap = await loadBitmap(rowsByPath.get(path), path).catch(() => null)
        if (!cancelled && bitmap) putBitmap(path, bitmap)
      }),
    ).then(() => {
      if (cancelled) return
      syncMaterials()
      setLoadedFor(geometry)
    })
    return () => {
      cancelled = true
    }
  }, [geometry, editorPath, revision, rowsByPath, putBitmap, syncMaterials])

  useEffect(() => {
    if (live && editorPath) putBitmap(editorPath, live)
    syncMaterials()
  }, [live, editorPath, putBitmap, syncMaterials])

  useEffect(() => {
    const current = slots.current
    return () => {
      for (const slot of current.values()) slot.texture.dispose()
      current.clear()
    }
  }, [])

  // ——— Painting on the model ———
  const meshRef = useRef<Mesh | null>(null)
  const strokeRef = useRef<Stroke | null>(null)
  const raycaster = useMemo(() => new Raycaster(), [])

  /**
   * The texture and pixel under the pointer, if it is over the model. Clicks go through
   * transparent pixels (a player's empty hat layer) to the first visible one. Where two faces lie
   * on top of each other (grass and its overlay), the texture being edited wins; and where only
   * empty pixels are hit, those of the texture being edited can be painted.
   */
  const hitAt = (event: ReactPointerEvent): { path: string; point: Point; quad: number } | null => {
    const bridge = bridgeRef.current
    const mesh = meshRef.current
    if (!bridge || !mesh || !geometry) return null
    const box = bridge.element.getBoundingClientRect()
    const pointer = new Vector2(
      ((event.clientX - box.left) / box.width) * 2 - 1,
      -((event.clientY - box.top) / box.height) * 2 + 1,
    )
    bridge.camera.updateMatrixWorld()
    raycaster.setFromCamera(pointer, bridge.camera)
    const active = useEditor.getState().path
    const hits: { path: string; point: Point; quad: number; distance: number; seen: boolean }[] = []
    for (const entry of raycaster.intersectObject(mesh, false)) {
      const slotIndex = entry.face?.materialIndex ?? 0
      const path = geometry.textures[slotIndex]
      const bitmap = path ? slots.current.get(path)?.bitmap : undefined
      if (!bitmap || !entry.uv || entry.faceIndex == null || !materials[slotIndex]?.visible)
        continue
      const frameHeight =
        animated(path) && bitmap.height > bitmap.width ? bitmap.width : bitmap.height
      const x = Math.min(bitmap.width - 1, Math.max(0, Math.floor(entry.uv.x * bitmap.width)))
      const y = Math.min(frameHeight - 1, Math.max(0, Math.floor(entry.uv.y * frameHeight)))
      hits.push({
        path,
        point: [x, y],
        quad: Math.floor(entry.faceIndex / 2),
        distance: entry.distance,
        seen: getPixel(bitmap, x, y)[3] > 0,
      })
    }
    const visible = hits.find((hit) => hit.seen)
    if (!visible) return hits.find((hit) => hit.path === active) ?? null
    return (
      hits.find((hit) => hit.path === active && Math.abs(hit.distance - visible.distance) < 1e-4) ??
      visible
    )
  }

  const paintStroke = (stroke: Stroke, point: Point, quad: number): void => {
    const editor = useEditor.getState()
    const { width, height } = stroke.working
    // Only connect points on the same face; a line across two faces would cut the texture.
    const line =
      quad === stroke.quad
        ? linePoints(stroke.last[0], stroke.last[1], point[0], point[1])
        : [point]
    const widened = line.flatMap((p) => brushPoints(p, editor.brushSize))
    const selection = editor.selection
    const points = mirrorPoints(widened, width, height, editor.symmetry).filter(
      ([x, y]) =>
        !selection ||
        (x >= selection.x &&
          y >= selection.y &&
          x < selection.x + selection.width &&
          y < selection.y + selection.height),
    )
    paintPoints(stroke.working, points, stroke.tool === 'eraser' ? TRANSPARENT : editor.primary)
    stroke.changed ||= points.length > 0
    stroke.last = point
    stroke.quad = quad
    setDraft(setLayerPixels(stroke.base, stroke.layerId, stroke.working))
  }

  const onPointerDownCapture = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0 || event.shiftKey || strokeRef.current) return
    const editor = useEditor.getState()
    const activeTool = event.altKey ? 'picker' : editor.tool
    if (!PAINT_TOOLS.has(activeTool)) return
    const hit = hitAt(event)
    if (!hit) return
    // Over the model: paint instead of turning it.
    event.stopPropagation()
    event.preventDefault()

    if (activeTool === 'picker') {
      const bitmap = slots.current.get(hit.path)?.bitmap
      if (bitmap) editor.setPrimary(getPixel(bitmap, hit.point[0], hit.point[1]) as Rgba)
      return
    }
    if (hit.path !== editor.path || editor.status !== 'ready' || !editor.history) {
      onSelectTexture(hit.path)
      return
    }
    const doc = currentDoc(editor.history)
    if (activeTool === 'fill') {
      let changed = false
      const next = editActiveLayer(doc, (pixels) => {
        for (const [x, y] of mirrorPoints([hit.point], doc.width, doc.height, editor.symmetry)) {
          changed = floodFill(pixels, x, y, editor.primary, editor.selection) || changed
        }
      })
      if (changed) editor.commit('Fill', next)
      return
    }
    const layer = activeLayer(doc)
    const stroke: Stroke = {
      pointerId: event.pointerId,
      tool: activeTool === 'eraser' ? 'eraser' : 'pencil',
      base: doc,
      layerId: layer.id,
      working: cloneBitmap(layer.pixels),
      last: hit.point,
      quad: hit.quad,
      changed: false,
    }
    strokeRef.current = stroke
    event.currentTarget.setPointerCapture(event.pointerId)
    paintStroke(stroke, hit.point, hit.quad)
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const stroke = strokeRef.current
    const hit = hitAt(event)
    const editor = useEditor.getState()
    editor.setCursor(hit && hit.path === editor.path ? hit.point : null)
    if (!stroke || stroke.pointerId !== event.pointerId) return
    if (!hit || hit.path !== editor.path) {
      stroke.quad = -1
      return
    }
    if (hit.point[0] === stroke.last[0] && hit.point[1] === stroke.last[1]) return
    paintStroke(stroke, hit.point, hit.quad)
  }

  const finish = (event: ReactPointerEvent<HTMLDivElement>, keep: boolean): void => {
    const stroke = strokeRef.current
    if (!stroke || stroke.pointerId !== event.pointerId) return
    strokeRef.current = null
    const draft = getDraft()
    if (keep && stroke.changed && draft) {
      useEditor.getState().commit(stroke.tool === 'eraser' ? 'Eraser' : 'Pencil', draft)
    }
    setDraft(null)
  }

  const hint = PAINT_TOOLS.has(tool)
    ? 'Paint on the model; a face with another texture opens that texture first. Drag beside the model, with the right button or with Shift to turn it.'
    : 'Choose the pencil, eraser, fill or colour picker to paint here.'

  if (!kind) {
    return (
      <Message>
        There is no 3D view for this texture yet. Blocks, items and the common mobs can be seen and
        painted in 3D.
      </Message>
    )
  }
  if (!webgl) {
    return <Message>3D needs graphics acceleration (WebGL), which is not available here.</Message>
  }
  if (!mobFits) {
    return (
      <Message>
        This picture no longer has the shape of the {mob?.id.replace(/_/g, ' ')} model (
        {mob?.textureSize.join(' × ')} pixels, or larger in the same proportions).
      </Message>
    )
  }
  if (kind === 'block' && model === null) {
    return (
      <Message>
        This block has no 3D model of its own (it is drawn by the game&apos;s code).
      </Message>
    )
  }

  return (
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
      <div
        aria-label="3D preview"
        role="img"
        data-ready={
          // Not while the editor is still switching to the selected texture.
          editorPath === row.path &&
          status === 'ready' &&
          shown === geometry &&
          !!geometry &&
          loadedFor === geometry &&
          !!live
        }
        data-radius={radius}
        onPointerDownCapture={onPointerDownCapture}
        onPointerMove={onPointerMove}
        onPointerUp={(event) => finish(event, true)}
        onPointerCancel={(event) => finish(event, false)}
        onPointerLeave={() => useEditor.getState().setCursor(null)}
        onContextMenu={(event) => event.preventDefault()}
        className="relative min-h-0 flex-1 touch-none"
        style={{ cursor: PAINT_TOOLS.has(tool) ? 'crosshair' : 'grab' }}
      >
        <Canvas
          flat
          linear
          frameloop="demand"
          camera={{ fov: FOV, near: 0.05, far: 50, position: [...CAMERA_DIRECTION[kind]] }}
          gl={{ antialias: false }}
        >
          <Scene
            geometry={geometry}
            materials={materials}
            meshRef={meshRef}
            bridgeRef={bridgeRef}
            kind={kind}
            radius={radius}
            resetKey={resetKey}
            onReady={setShown}
          />
        </Canvas>
      </div>
      <div className="pointer-events-none absolute inset-x-2 bottom-2 flex items-end gap-2 text-[11px] text-ink-muted">
        <p className="flex-1">{hint}</p>
        <button
          type="button"
          onClick={() => setResetKey((key) => key + 1)}
          className="pointer-events-auto rounded border border-line bg-raised px-1.5 py-0.5 text-ink hover:border-ink-muted"
        >
          Reset view
        </button>
      </div>
    </div>
  )
}

function Message({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center p-6 text-center text-sm text-ink-muted">
      <p className="max-w-64">{children}</p>
    </div>
  )
}
