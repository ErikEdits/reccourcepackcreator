// Turning an editor document into the layers file and back.

import { layersFileSchema, type LayersFile } from '../../../shared/layers-file'
import { base64ToBytes, bytesToBase64, decodeImage, encodePng } from '../lib/images'
import { compose, documentFromLayers, type EditorDocument } from './document'
import type { Bitmap } from './pixels'

export async function serializeLayers(doc: EditorDocument): Promise<string> {
  const file: LayersFile = {
    version: 1,
    width: doc.width,
    height: doc.height,
    layers: await Promise.all(
      doc.layers.map(async (layer) => ({
        name: layer.name,
        visible: layer.visible,
        opacity: layer.opacity,
        png: bytesToBase64(await encodePng(layer.pixels)),
      })),
    ),
  }
  return JSON.stringify(file)
}

/** Allows for rounding in the browser's PNG encoding of semi-transparent pixels. */
function nearlyEqual(a: Bitmap, b: Bitmap): boolean {
  if (a.width !== b.width || a.height !== b.height) return false
  for (let i = 0; i < a.data.length; i++) {
    if (Math.abs(a.data[i] - b.data[i]) > 2) return false
  }
  return true
}

/**
 * Restores the layers of a texture. Returns null if they no longer match the pack's PNG
 * (it was changed outside the app): the PNG then wins.
 */
export async function deserializeLayers(json: string, png: Bitmap): Promise<EditorDocument | null> {
  let parsed
  try {
    parsed = layersFileSchema.safeParse(JSON.parse(json))
  } catch {
    return null
  }
  if (!parsed.success) return null
  const file = parsed.data
  if (file.width !== png.width || file.height !== png.height) return null

  const layers = await Promise.all(
    file.layers.map(async (layer) => ({
      name: layer.name,
      visible: layer.visible,
      opacity: layer.opacity,
      pixels: await decodeImage(base64ToBytes(layer.png)),
    })),
  )
  if (
    layers.some((layer) => layer.pixels.width !== png.width || layer.pixels.height !== png.height)
  ) {
    return null
  }
  const doc = documentFromLayers(file.width, file.height, layers)
  return nearlyEqual(compose(doc), png) ? doc : null
}
