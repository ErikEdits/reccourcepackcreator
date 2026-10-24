// Flipping and rotating a whole bitmap or a selected region of it.

import { createBitmap, extract, getPixel, paste, setPixel, type Bitmap, type Rect } from './pixels'

function flipped(source: Bitmap, horizontal: boolean): Bitmap {
  const out = createBitmap(source.width, source.height)
  for (let y = 0; y < source.height; y++) {
    for (let x = 0; x < source.width; x++) {
      const sx = horizontal ? source.width - 1 - x : x
      const sy = horizontal ? y : source.height - 1 - y
      setPixel(out, x, y, getPixel(source, sx, sy))
    }
  }
  return out
}

/** Rotates 90° clockwise; the region must be square so the result fits in place. */
function rotated(source: Bitmap): Bitmap {
  const out = createBitmap(source.height, source.width)
  for (let y = 0; y < source.height; y++) {
    for (let x = 0; x < source.width; x++) {
      setPixel(out, source.height - 1 - y, x, getPixel(source, x, y))
    }
  }
  return out
}

export type Transform = 'flip-horizontal' | 'flip-vertical' | 'rotate'

export function canTransform(transform: Transform, region: Rect): boolean {
  return transform !== 'rotate' || region.width === region.height
}

/** Applies a transform to a region of the bitmap, in place. */
export function transformRegion(bitmap: Bitmap, region: Rect, transform: Transform): void {
  if (!canTransform(transform, region)) return
  const part = extract(bitmap, region)
  const result =
    transform === 'rotate' ? rotated(part) : flipped(part, transform === 'flip-horizontal')
  paste(bitmap, result, region.x, region.y)
}
