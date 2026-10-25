// Pulls the textures out of a client JAR and describes each one for the texture browser.

import { unzipSync } from 'fflate'
import {
  classifyColour,
  PACK_TEXTURE_PREFIX,
  type ColourBucket,
  type VanillaTexture,
} from '../../shared/textures'

export interface DecodedImage {
  width: number
  height: number
  /** Straight (not premultiplied) RGBA, 4 bytes per pixel. */
  rgba: Uint8Array
}

export type ImageDecoder = (png: Uint8Array) => DecodedImage | null

/** Texture PNGs and their .mcmeta files, keyed by path below assets/minecraft/textures/. */
export function extractTextures(jar: Uint8Array): Map<string, Uint8Array> {
  const entries = unzipSync(jar, {
    filter: (file) =>
      file.name.startsWith(PACK_TEXTURE_PREFIX) &&
      (file.name.endsWith('.png') || file.name.endsWith('.png.mcmeta')),
  })
  const files = new Map<string, Uint8Array>()
  for (const [name, bytes] of Object.entries(entries)) {
    files.set(name.slice(PACK_TEXTURE_PREFIX.length), bytes)
  }
  return files
}

const MODELS_PREFIX = 'assets/minecraft/models/'
const BLOCKSTATES_PREFIX = 'assets/minecraft/blockstates/'

export interface GameModels {
  /** Parsed model JSON by name, e.g. "block/stone" or "item/stick". */
  models: Map<string, unknown>
  /** Parsed blockstate JSON by block id, e.g. "grass_block". */
  blockstates: Map<string, unknown>
}

/** Block and item models and blockstates (Minecraft 1.8 and later; empty before). */
export function extractModels(jar: Uint8Array): GameModels {
  const entries = unzipSync(jar, {
    filter: (file) =>
      file.name.endsWith('.json') &&
      (file.name.startsWith(MODELS_PREFIX) || file.name.startsWith(BLOCKSTATES_PREFIX)),
  })
  const decoder = new TextDecoder()
  const models = new Map<string, unknown>()
  const blockstates = new Map<string, unknown>()
  for (const [name, bytes] of Object.entries(entries)) {
    let json: unknown
    try {
      json = JSON.parse(decoder.decode(bytes))
    } catch {
      continue
    }
    if (name.startsWith(MODELS_PREFIX)) {
      models.set(name.slice(MODELS_PREFIX.length, -'.json'.length), json)
    } else {
      blockstates.set(name.slice(BLOCKSTATES_PREFIX.length, -'.json'.length), json)
    }
  }
  return { models, blockstates }
}

/** Colour group of the average of all mostly-opaque pixels; null if there are none. */
export function averageColour(image: DecodedImage): ColourBucket | null {
  let r = 0
  let g = 0
  let b = 0
  let count = 0
  for (let i = 0; i < image.rgba.length; i += 4) {
    if (image.rgba[i + 3] < 128) continue
    r += image.rgba[i]
    g += image.rgba[i + 1]
    b += image.rgba[i + 2]
    count++
  }
  return count === 0 ? null : classifyColour(r / count, g / count, b / count)
}

export function indexTextures(
  files: ReadonlyMap<string, Uint8Array>,
  decode: ImageDecoder,
): VanillaTexture[] {
  const textures: VanillaTexture[] = []
  for (const [path, bytes] of files) {
    if (!path.endsWith('.png')) continue
    const image = decode(bytes)
    textures.push({
      path,
      width: image?.width ?? 0,
      height: image?.height ?? 0,
      animated: files.has(`${path}.mcmeta`),
      colour: image ? averageColour(image) : null,
    })
  }
  return textures.sort((a, b) => a.path.localeCompare(b.path))
}
