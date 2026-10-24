// A texture being edited: a stack of layers (docs/DECISIONS.md #28). Documents are immutable;
// every change makes a new document that shares the untouched layers, so the undo history is
// cheap to keep (docs/DECISIONS.md #30).

import { cloneBitmap, createBitmap, type Bitmap } from './pixels'

export interface Layer {
  id: number
  name: string
  visible: boolean
  /** 0..1 */
  opacity: number
  /** Never changed after the layer is created; edits produce a new layer. */
  pixels: Bitmap
}

export interface EditorDocument {
  width: number
  height: number
  /** Bottom first. */
  layers: readonly Layer[]
  activeLayerId: number
}

let nextLayerId = 1
const newLayerId = (): number => nextLayerId++

export function createDocument(base: Bitmap): EditorDocument {
  const layer: Layer = {
    id: newLayerId(),
    name: 'Layer 1',
    visible: true,
    opacity: 1,
    pixels: cloneBitmap(base),
  }
  return { width: base.width, height: base.height, layers: [layer], activeLayerId: layer.id }
}

export function documentFromLayers(
  width: number,
  height: number,
  layers: readonly Omit<Layer, 'id'>[],
): EditorDocument {
  const withIds = layers.map((layer) => ({ ...layer, id: newLayerId() }))
  return { width, height, layers: withIds, activeLayerId: withIds[withIds.length - 1].id }
}

export function activeLayer(doc: EditorDocument): Layer {
  return doc.layers.find((layer) => layer.id === doc.activeLayerId) ?? doc.layers[0]
}

function updateLayer(
  doc: EditorDocument,
  id: number,
  change: Partial<Omit<Layer, 'id'>>,
): EditorDocument {
  return {
    ...doc,
    layers: doc.layers.map((layer) => (layer.id === id ? { ...layer, ...change } : layer)),
  }
}

export function setLayerPixels(doc: EditorDocument, id: number, pixels: Bitmap): EditorDocument {
  return updateLayer(doc, id, { pixels })
}

export function setLayerProps(
  doc: EditorDocument,
  id: number,
  props: Partial<Pick<Layer, 'name' | 'visible' | 'opacity'>>,
): EditorDocument {
  return updateLayer(doc, id, props)
}

export function selectLayer(doc: EditorDocument, id: number): EditorDocument {
  return doc.layers.some((layer) => layer.id === id) ? { ...doc, activeLayerId: id } : doc
}

/** Adds an empty layer above the active one and makes it active. */
export function addLayer(doc: EditorDocument): EditorDocument {
  const index = doc.layers.findIndex((layer) => layer.id === doc.activeLayerId)
  const layer: Layer = {
    id: newLayerId(),
    name: `Layer ${doc.layers.length + 1}`,
    visible: true,
    opacity: 1,
    pixels: createBitmap(doc.width, doc.height),
  }
  const layers = [...doc.layers]
  layers.splice(index + 1, 0, layer)
  return { ...doc, layers, activeLayerId: layer.id }
}

export function duplicateLayer(doc: EditorDocument): EditorDocument {
  const source = activeLayer(doc)
  const index = doc.layers.indexOf(source)
  const copy: Layer = { ...source, id: newLayerId(), name: `${source.name} copy` }
  const layers = [...doc.layers]
  layers.splice(index + 1, 0, copy)
  return { ...doc, layers, activeLayerId: copy.id }
}

/** Removes the active layer; the last layer cannot be removed. */
export function removeLayer(doc: EditorDocument): EditorDocument {
  if (doc.layers.length <= 1) return doc
  const index = doc.layers.findIndex((layer) => layer.id === doc.activeLayerId)
  const layers = doc.layers.filter((layer) => layer.id !== doc.activeLayerId)
  return { ...doc, layers, activeLayerId: layers[Math.max(0, index - 1)].id }
}

/** Moves the active layer up (+1) or down (-1) in the stack. */
export function moveLayer(doc: EditorDocument, direction: 1 | -1): EditorDocument {
  const index = doc.layers.findIndex((layer) => layer.id === doc.activeLayerId)
  const target = index + direction
  if (target < 0 || target >= doc.layers.length) return doc
  const layers = [...doc.layers]
  ;[layers[index], layers[target]] = [layers[target], layers[index]]
  return { ...doc, layers }
}

/** Merges the active layer into the one below it. */
export function mergeDown(doc: EditorDocument): EditorDocument {
  const index = doc.layers.findIndex((layer) => layer.id === doc.activeLayerId)
  if (index <= 0) return doc
  const below = doc.layers[index - 1]
  const merged = compose({
    ...doc,
    layers: [{ ...below, opacity: 1, visible: true }, doc.layers[index]],
  })
  const layers = [...doc.layers]
  layers.splice(index - 1, 2, { ...below, pixels: merged })
  return { ...doc, layers, activeLayerId: below.id }
}

/** Flattens the visible layers ("source over" with each layer's opacity). */
export function compose(doc: EditorDocument): Bitmap {
  const out = createBitmap(doc.width, doc.height)
  const d = out.data
  for (const layer of doc.layers) {
    if (!layer.visible || layer.opacity <= 0) continue
    const s = layer.pixels.data
    for (let i = 0; i < d.length; i += 4) {
      const sa = (s[i + 3] / 255) * layer.opacity
      if (sa === 0) continue
      const da = d[i + 3] / 255
      const oa = sa + da * (1 - sa)
      for (let c = 0; c < 3; c++) {
        d[i + c] = Math.round((s[i + c] * sa + d[i + c] * da * (1 - sa)) / oa)
      }
      d[i + 3] = Math.round(oa * 255)
    }
  }
  return out
}

/** True if the document is just one plain layer, so the PNG alone describes it. */
export function isFlat(doc: EditorDocument): boolean {
  return doc.layers.length === 1 && doc.layers[0].visible && doc.layers[0].opacity === 1
}
