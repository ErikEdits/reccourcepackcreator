// Minecraft block models (assets/minecraft/blockstates and models/ in the client JAR), resolved
// into plain boxes for the 3D preview (docs/DECISIONS.md #37), and the grouping of textures by
// the block they belong to.

export type Vec3 = [number, number, number]
export type FaceName = 'down' | 'up' | 'north' | 'south' | 'west' | 'east'
export const FACE_NAMES: readonly FaceName[] = ['down', 'up', 'north', 'south', 'west', 'east']

export interface ModelFace {
  /** u1, v1, u2, v2 in 0..16 texture units, v from the top. */
  uv: [number, number, number, number]
  /** Texture path below assets/minecraft/textures, e.g. "block/stone.png"; null if missing. */
  texture: string | null
  /** Clockwise rotation of the texture on the face. */
  rotation: 0 | 90 | 180 | 270
  /** Coloured by the biome (grass, leaves, water …). */
  tinted: boolean
}

export interface ModelElement {
  /** Corners in 0..16 block units: x east, y up, z south. */
  from: Vec3
  to: Vec3
  rotation: { origin: Vec3; axis: 'x' | 'y' | 'z'; angle: number; rescale: boolean } | null
  shade: boolean
  faces: Partial<Record<FaceName, ModelFace>>
}

/** One model of a block, turned in 90° steps as the blockstate says. */
export interface BlockPart {
  x: number
  y: number
  elements: ModelElement[]
}

export interface BlockModel {
  id: string
  parts: BlockPart[]
}

/** A block of the texture list: the textures that belong to it, the most typical one first. */
export interface BlockInfo {
  id: string
  textures: string[]
  /** Its model has boxes that can be shown in 3D (not chests, beds, signs …). */
  has3d: boolean
}

type Json = Record<string, unknown>
export type ModelLookup = (name: string) => unknown

const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const stripNamespace = (ref: string): string => ref.replace(/^minecraft:/, '')

/** "minecraft:block/stone" or (1.8) "stone" → "block/stone". */
export function modelName(ref: string): string {
  const name = stripNamespace(ref)
  return name.includes('/') ? name : `block/${name}`
}

/** "minecraft:block/stone" → "block/stone.png"; null for other namespaces. */
export function texturePath(ref: string): string | null {
  if (ref.includes(':') && !ref.startsWith('minecraft:')) return null
  return `${stripNamespace(ref)}.png`
}

function vec3(value: unknown): Vec3 | null {
  return Array.isArray(value) && value.length === 3 && value.every((n) => typeof n === 'number')
    ? [value[0], value[1], value[2]]
    : null
}

/** The texture area a face shows when the model does not say (as Minecraft computes it). */
export function defaultUv(face: FaceName, from: Vec3, to: Vec3): [number, number, number, number] {
  switch (face) {
    case 'down':
      return [from[0], 16 - to[2], to[0], 16 - from[2]]
    case 'up':
      return [from[0], from[2], to[0], to[2]]
    case 'north':
      return [16 - to[0], 16 - to[1], 16 - from[0], 16 - from[1]]
    case 'south':
      return [from[0], 16 - to[1], to[0], 16 - from[1]]
    case 'west':
      return [from[2], 16 - to[1], to[2], 16 - from[1]]
    case 'east':
      return [16 - to[2], 16 - to[1], 16 - from[2], 16 - from[1]]
  }
}

interface RawModel {
  textures: Record<string, string>
  elements: unknown[] | null
}

/** Follows the parent chain: textures merge (child wins), the nearest elements win. */
function flattenModel(name: string, lookup: ModelLookup): RawModel | null {
  const textures: Record<string, string> = {}
  let elements: unknown[] | null = null
  let current: string | null = name
  let found = false
  for (let depth = 0; current && depth < 32; depth++) {
    const model = lookup(current)
    if (!isObject(model)) break
    found = true
    if (isObject(model.textures)) {
      for (const [key, value] of Object.entries(model.textures)) {
        if (typeof value === 'string' && !(key in textures)) textures[key] = value
      }
    }
    if (!elements && Array.isArray(model.elements)) elements = model.elements
    current = typeof model.parent === 'string' ? modelName(model.parent) : null
  }
  return found ? { textures, elements } : null
}

/** Follows "#side" → "#all" → "block/stone"; null if it leads nowhere. */
function resolveTexture(ref: string, textures: Record<string, string>): string | null {
  let value = ref
  for (let depth = 0; value.startsWith('#') && depth < 16; depth++) {
    const next = textures[value.slice(1)]
    if (next === undefined) return null
    value = next
  }
  return value.startsWith('#') ? null : texturePath(value)
}

function parseElement(raw: unknown, textures: Record<string, string>): ModelElement | null {
  if (!isObject(raw)) return null
  const from = vec3(raw.from)
  const to = vec3(raw.to)
  if (!from || !to || !isObject(raw.faces)) return null

  let rotation: ModelElement['rotation'] = null
  if (isObject(raw.rotation)) {
    const origin = vec3(raw.rotation.origin) ?? [8, 8, 8]
    const axis = raw.rotation.axis
    const angle = raw.rotation.angle
    if ((axis === 'x' || axis === 'y' || axis === 'z') && typeof angle === 'number') {
      rotation = { origin, axis, angle, rescale: raw.rotation.rescale === true }
    }
  }

  const faces: ModelElement['faces'] = {}
  for (const name of FACE_NAMES) {
    const face = raw.faces[name]
    if (!isObject(face) || typeof face.texture !== 'string') continue
    const uv =
      Array.isArray(face.uv) && face.uv.length === 4 && face.uv.every((n) => typeof n === 'number')
        ? (face.uv as [number, number, number, number])
        : defaultUv(name, from, to)
    const turn = typeof face.rotation === 'number' ? ((face.rotation % 360) + 360) % 360 : 0
    faces[name] = {
      uv,
      texture: resolveTexture(face.texture, textures),
      rotation: (turn === 90 || turn === 180 || turn === 270 ? turn : 0) as ModelFace['rotation'],
      tinted: typeof face.tintindex === 'number',
    }
  }
  return { from, to, rotation, shade: raw.shade !== false, faces }
}

/** A model with its boxes and every texture reference resolved to a texture path. */
export function resolveModel(
  name: string,
  lookup: ModelLookup,
): { elements: ModelElement[]; textures: string[] } | null {
  const raw = flattenModel(modelName(name), lookup)
  if (!raw) return null
  const elements = (raw.elements ?? [])
    .map((element) => parseElement(element, raw.textures))
    .filter((element): element is ModelElement => element !== null)
  const textures = new Set<string>()
  for (const element of elements) {
    for (const face of Object.values(element.faces)) if (face?.texture) textures.add(face.texture)
  }
  // Models without boxes (water, chests …) still name their texture as "particle".
  if (textures.size === 0) {
    for (const value of Object.values(raw.textures)) {
      const path = value.startsWith('#') ? resolveTexture(value, raw.textures) : texturePath(value)
      if (path) textures.add(path)
    }
  }
  return { elements, textures: [...textures] }
}

interface ModelRef {
  model: string
  x: number
  y: number
}

function modelRef(value: unknown): ModelRef | null {
  const entry = Array.isArray(value) ? value[0] : value
  if (!isObject(entry) || typeof entry.model !== 'string') return null
  return {
    model: entry.model,
    x: typeof entry.x === 'number' ? entry.x : 0,
    y: typeof entry.y === 'number' ? entry.y : 0,
  }
}

/**
 * Property values that make a typical-looking block for the preview: straight stairs, bottom
 * slabs, upright logs, unlit furnaces, closed doors, and the front facing the camera.
 */
const TYPICAL_STATE: Record<string, readonly string[]> = {
  facing: ['south', 'east'],
  shape: ['straight'],
  half: ['bottom', 'lower'],
  type: ['bottom', 'single'],
  axis: ['y'],
  lit: ['false'],
  powered: ['false'],
  open: ['false'],
  snowy: ['false'],
  waterlogged: ['false'],
  hinge: ['left'],
  attached: ['false'],
  in_wall: ['false'],
  part: ['foot'],
  face: ['floor', 'wall'],
}

/** How typical a variant such as "facing=east,half=bottom,shape=inner_left" looks. */
function variantScore(key: string): number {
  let score = 0
  for (const pair of key.split(',')) {
    const [name, value] = pair.split('=')
    const preferred = TYPICAL_STATE[name]
    if (!preferred) continue
    const index = preferred.indexOf(value)
    // Earlier preferences count a little more ("south" beats "east").
    if (index >= 0) score += 1 + (preferred.length - index) / 10
  }
  return score
}

/** Every model a blockstate can use, and the ones shown for its default look. */
export function blockstateModels(blockstate: unknown): { shown: ModelRef[]; all: string[] } {
  const all = new Set<string>()
  const shown: ModelRef[] = []
  if (!isObject(blockstate)) return { shown, all: [] }

  if (isObject(blockstate.variants)) {
    let best: { score: number; ref: ModelRef } | null = null
    for (const [key, value] of Object.entries(blockstate.variants)) {
      for (const option of Array.isArray(value) ? value : [value]) {
        const ref = modelRef(option)
        if (ref) all.add(ref.model)
      }
      const ref = modelRef(value)
      const score = variantScore(key)
      if (ref && (!best || score > best.score)) best = { score, ref }
    }
    if (best) shown.push(best.ref)
  } else if (Array.isArray(blockstate.multipart)) {
    for (const part of blockstate.multipart) {
      if (!isObject(part)) continue
      const options = Array.isArray(part.apply) ? part.apply : [part.apply]
      for (const option of options) {
        const ref = modelRef(option)
        if (ref) all.add(ref.model)
      }
      const ref = modelRef(part.apply)
      // Parts that always apply (a fence post, a wall's middle) make the default look.
      if (ref && part.when === undefined) shown.push(ref)
    }
    if (shown.length === 0) {
      const first = blockstate.multipart.find((part) => isObject(part) && modelRef(part.apply))
      const ref = isObject(first) ? modelRef(first.apply) : null
      if (ref) shown.push(ref)
    }
  }
  return { shown, all: [...all] }
}

/** Water and lava have no boxes in their models; Minecraft draws them in code. */
function liquidPart(id: string): BlockPart | null {
  if (id !== 'water' && id !== 'lava') return null
  const face = (v1: number): ModelFace => ({
    uv: [0, v1, 16, 16],
    texture: `block/${id}_still.png`,
    rotation: 0,
    tinted: id === 'water',
  })
  const sides = { north: face(2), south: face(2), west: face(2), east: face(2) }
  return {
    x: 0,
    y: 0,
    elements: [
      {
        from: [0, 0, 0],
        to: [16, 14, 16],
        rotation: null,
        shade: true,
        faces: { down: face(0), up: face(0), ...sides },
      },
    ],
  }
}

/** The 3D model of a block in its default state; null if it has no boxes. */
export function blockModel(
  id: string,
  blockstate: unknown,
  lookup: ModelLookup,
): BlockModel | null {
  const liquid = liquidPart(id)
  if (liquid) return { id, parts: [liquid] }
  const parts: BlockPart[] = []
  for (const ref of blockstateModels(blockstate).shown) {
    const model = resolveModel(ref.model, lookup)
    if (model && model.elements.length > 0) {
      parts.push({ x: ref.x, y: ref.y, elements: model.elements })
    }
  }
  return parts.length > 0 ? { id, parts } : null
}

const nameOf = (path: string): string => path.slice(path.lastIndexOf('/') + 1).replace(/\.png$/, '')

/** How well a texture's name fits a block: exact name > longest "block_…" prefix > nothing. */
function nameScore(blockId: string, texture: string): number {
  const name = nameOf(texture)
  if (name === blockId) return 1000
  if (name.startsWith(`${blockId}_`)) return blockId.length
  return -1
}

/**
 * Groups the textures by block, so the list can show "Grass Block" instead of its top, side
 * and overlay separately. A texture used by several blocks (dirt under grass) belongs to the
 * block it is named after; one used by a single block belongs to that block.
 */
export function groupTexturesByBlock(
  blockstates: ReadonlyMap<string, unknown>,
  lookup: ModelLookup,
  existing: ReadonlySet<string>,
): BlockInfo[] {
  const usedBy = new Map<string, string[]>()
  const has3d = new Map<string, boolean>()
  const cache = new Map<string, ReturnType<typeof resolveModel>>()
  const resolve = (name: string): ReturnType<typeof resolveModel> => {
    if (!cache.has(name)) cache.set(name, resolveModel(name, lookup))
    return cache.get(name)!
  }

  for (const [id, blockstate] of blockstates) {
    const { shown, all } = blockstateModels(blockstate)
    const textures = new Set<string>()
    for (const name of all) for (const path of resolve(name)?.textures ?? []) textures.add(path)
    for (const path of textures) {
      if (!existing.has(path)) continue
      usedBy.set(path, [...(usedBy.get(path) ?? []), id])
    }
    has3d.set(
      id,
      liquidPart(id) !== null ||
        shown.some((ref) => (resolve(ref.model)?.elements.length ?? 0) > 0),
    )
  }

  const owned = new Map<string, string[]>()
  for (const [path, blocks] of usedBy) {
    let owner: string | null = null
    let best = -1
    for (const block of blocks) {
      const score = nameScore(block, path)
      if (score > best) {
        best = score
        owner = block
      }
    }
    if (best < 0) owner = blocks.length === 1 ? blocks[0] : null
    if (owner) owned.set(owner, [...(owned.get(owner) ?? []), path])
  }

  const typical = (id: string, path: string): number => {
    const name = nameOf(path)
    const order = [id, `${id}_side`, `${id}_front`, `${id}_top`]
    const index = order.indexOf(name)
    return index < 0 ? order.length : index
  }
  return [...owned]
    .map(([id, textures]) => ({
      id,
      textures: textures.sort((a, b) => typical(id, a) - typical(id, b) || a.localeCompare(b)),
      has3d: has3d.get(id) ?? false,
    }))
    .sort((a, b) => a.id.localeCompare(b.id))
}
