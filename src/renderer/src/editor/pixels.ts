// RGBA bitmaps and colours. Pixels are replaced, never blended: transparency is painted as is
// (docs/DECISIONS.md #32).

export type Rgba = readonly [number, number, number, number]

export interface Bitmap {
  width: number
  height: number
  /** RGBA, 4 bytes per pixel, row by row. */
  data: Uint8ClampedArray
}

export const TRANSPARENT: Rgba = [0, 0, 0, 0]

export function createBitmap(width: number, height: number): Bitmap {
  return { width, height, data: new Uint8ClampedArray(width * height * 4) }
}

export function cloneBitmap(bitmap: Bitmap): Bitmap {
  return { width: bitmap.width, height: bitmap.height, data: bitmap.data.slice() }
}

export function inBounds(bitmap: Bitmap, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < bitmap.width && y < bitmap.height
}

export function getPixel(bitmap: Bitmap, x: number, y: number): Rgba {
  const i = (y * bitmap.width + x) * 4
  const d = bitmap.data
  return [d[i], d[i + 1], d[i + 2], d[i + 3]]
}

/** Sets a pixel; points outside the bitmap are ignored. */
export function setPixel(bitmap: Bitmap, x: number, y: number, colour: Rgba): void {
  if (!inBounds(bitmap, x, y)) return
  bitmap.data.set(colour, (y * bitmap.width + x) * 4)
}

export function sameColour(a: Rgba, b: Rgba): boolean {
  // All fully transparent pixels count as the same colour.
  if (a[3] === 0 && b[3] === 0) return true
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3]
}

const hex2 = (value: number): string => value.toString(16).padStart(2, '0')

/** "#rrggbb", or "#rrggbbaa" when not fully opaque. */
export function toHex([r, g, b, a]: Rgba): string {
  return `#${hex2(r)}${hex2(g)}${hex2(b)}${a === 255 ? '' : hex2(a)}`
}

/** Parses "#rgb", "#rrggbb" or "#rrggbbaa" (the # is optional); null if invalid. */
export function parseHex(input: string): Rgba | null {
  let hex = input.trim().replace(/^#/, '')
  if (/^[0-9a-f]{3}$/i.test(hex)) hex = [...hex].map((c) => c + c).join('')
  if (!/^([0-9a-f]{6}|[0-9a-f]{8})$/i.test(hex)) return null
  const value = (i: number): number => parseInt(hex.slice(i, i + 2), 16)
  return [value(0), value(2), value(4), hex.length === 8 ? value(6) : 255]
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/** The rectangle spanned by two corner points, inclusive. */
export function rectFromPoints(x0: number, y0: number, x1: number, y1: number): Rect {
  return {
    x: Math.min(x0, x1),
    y: Math.min(y0, y1),
    width: Math.abs(x1 - x0) + 1,
    height: Math.abs(y1 - y0) + 1,
  }
}

/** Clips a rectangle to the bitmap; null if nothing is left. */
export function clipRect(rect: Rect, width: number, height: number): Rect | null {
  const x = Math.max(0, rect.x)
  const y = Math.max(0, rect.y)
  const right = Math.min(width, rect.x + rect.width)
  const bottom = Math.min(height, rect.y + rect.height)
  return right > x && bottom > y ? { x, y, width: right - x, height: bottom - y } : null
}

/** Copies a region into a new bitmap. */
export function extract(bitmap: Bitmap, rect: Rect): Bitmap {
  const out = createBitmap(rect.width, rect.height)
  for (let y = 0; y < rect.height; y++) {
    const start = ((rect.y + y) * bitmap.width + rect.x) * 4
    out.data.set(bitmap.data.subarray(start, start + rect.width * 4), y * rect.width * 4)
  }
  return out
}

/** Sets every pixel of a region to one colour. */
export function fillRect(bitmap: Bitmap, rect: Rect, colour: Rgba): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) setPixel(bitmap, x, y, colour)
  }
}

/** Copies `source` onto `target` at (x, y); transparent source pixels overwrite too. */
export function paste(target: Bitmap, source: Bitmap, x: number, y: number): void {
  for (let sy = 0; sy < source.height; sy++) {
    for (let sx = 0; sx < source.width; sx++) {
      setPixel(target, x + sx, y + sy, getPixel(source, sx, sy))
    }
  }
}

/** Like paste, but transparent source pixels leave the target alone (for moving selections). */
export function pasteOpaque(target: Bitmap, source: Bitmap, x: number, y: number): void {
  for (let sy = 0; sy < source.height; sy++) {
    for (let sx = 0; sx < source.width; sx++) {
      const colour = getPixel(source, sx, sy)
      if (colour[3] > 0) setPixel(target, x + sx, y + sy, colour)
    }
  }
}

/** Scales with nearest neighbour (docs/DECISIONS.md #35). */
export function scaleNearest(bitmap: Bitmap, width: number, height: number): Bitmap {
  const out = createBitmap(width, height)
  for (let y = 0; y < height; y++) {
    const sy = Math.floor((y * bitmap.height) / height)
    for (let x = 0; x < width; x++) {
      const sx = Math.floor((x * bitmap.width) / width)
      setPixel(out, x, y, getPixel(bitmap, sx, sy))
    }
  }
  return out
}
