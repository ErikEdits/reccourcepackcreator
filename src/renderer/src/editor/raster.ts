// Turning tool input into pixels: lines, shapes, brushes, flood fill, symmetry, gradients.

import {
  getPixel,
  inBounds,
  rectFromPoints,
  sameColour,
  setPixel,
  type Bitmap,
  type Rect,
  type Rgba,
} from './pixels'

export type Point = readonly [number, number]

/** Every pixel on the line between two points (Bresenham). */
export function linePoints(x0: number, y0: number, x1: number, y1: number): Point[] {
  const points: Point[] = []
  const dx = Math.abs(x1 - x0)
  const dy = -Math.abs(y1 - y0)
  const sx = x0 < x1 ? 1 : -1
  const sy = y0 < y1 ? 1 : -1
  let error = dx + dy
  let x = x0
  let y = y0
  for (;;) {
    points.push([x, y])
    if (x === x1 && y === y1) return points
    const e2 = 2 * error
    if (e2 >= dy) {
      error += dy
      x += sx
    }
    if (e2 <= dx) {
      error += dx
      y += sy
    }
  }
}

export function rectanglePoints(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  filled: boolean,
): Point[] {
  const { x, y, width, height } = rectFromPoints(x0, y0, x1, y1)
  const points: Point[] = []
  for (let py = y; py < y + height; py++) {
    for (let px = x; px < x + width; px++) {
      const edge = px === x || py === y || px === x + width - 1 || py === y + height - 1
      if (filled || edge) points.push([px, py])
    }
  }
  return points
}

/** The ellipse that fits the box spanned by two corners. */
export function ellipsePoints(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  filled: boolean,
): Point[] {
  const { x, y, width, height } = rectFromPoints(x0, y0, x1, y1)
  const cx = x + (width - 1) / 2
  const cy = y + (height - 1) / 2
  const rx = width / 2
  const ry = height / 2
  const inside = (px: number, py: number): boolean =>
    ((px - cx) / rx) ** 2 + ((py - cy) / ry) ** 2 <= 1

  const points: Point[] = []
  for (let py = y; py < y + height; py++) {
    for (let px = x; px < x + width; px++) {
      if (!inside(px, py)) continue
      const edge =
        !inside(px - 1, py) || !inside(px + 1, py) || !inside(px, py - 1) || !inside(px, py + 1)
      if (filled || edge) points.push([px, py])
    }
  }
  return points
}

/** A square brush of the given size centred on a point. */
export function brushPoints([x, y]: Point, size: number): Point[] {
  const offset = Math.floor((size - 1) / 2)
  const points: Point[] = []
  for (let dy = 0; dy < size; dy++) {
    for (let dx = 0; dx < size; dx++) points.push([x - offset + dx, y - offset + dy])
  }
  return points
}

export interface Symmetry {
  /** Mirror left ↔ right. */
  horizontal: boolean
  /** Mirror top ↔ bottom. */
  vertical: boolean
}

/** Adds the mirrored copies of every point (docs/DECISIONS.md #27). */
export function mirrorPoints(
  points: readonly Point[],
  width: number,
  height: number,
  symmetry: Symmetry,
): Point[] {
  const result = new Map<string, Point>()
  const add = (point: Point): void => void result.set(`${point[0]},${point[1]}`, point)
  for (const [x, y] of points) {
    add([x, y])
    if (symmetry.horizontal) add([width - 1 - x, y])
    if (symmetry.vertical) add([x, height - 1 - y])
    if (symmetry.horizontal && symmetry.vertical) add([width - 1 - x, height - 1 - y])
  }
  return [...result.values()]
}

export function paintPoints(bitmap: Bitmap, points: readonly Point[], colour: Rgba): void {
  for (const [x, y] of points) setPixel(bitmap, x, y, colour)
}

/**
 * Fills the area of same-coloured pixels around a point (4-way). Only pixels inside `limit`
 * (the selection) are touched. Returns false if nothing changed.
 */
export function floodFill(
  bitmap: Bitmap,
  x: number,
  y: number,
  colour: Rgba,
  limit: Rect | null = null,
): boolean {
  const allowed = (px: number, py: number): boolean =>
    inBounds(bitmap, px, py) &&
    (!limit ||
      (px >= limit.x && py >= limit.y && px < limit.x + limit.width && py < limit.y + limit.height))
  if (!allowed(x, y)) return false
  const target = getPixel(bitmap, x, y)
  if (sameColour(target, colour) && target[3] === colour[3]) return false

  const seen = new Uint8Array(bitmap.width * bitmap.height)
  const stack: Point[] = [[x, y]]
  while (stack.length > 0) {
    const [px, py] = stack.pop()!
    const index = py * bitmap.width + px
    if (seen[index] || !allowed(px, py) || !sameColour(getPixel(bitmap, px, py), target)) continue
    seen[index] = 1
    setPixel(bitmap, px, py, colour)
    stack.push([px + 1, py], [px - 1, py], [px, py + 1], [px, py - 1])
  }
  return true
}

// 4×4 Bayer matrix, scaled to 0..1, for ordered dithering.
const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
].map((row) => row.map((value) => (value + 0.5) / 16))

export type GradientMode = 'smooth' | 'dither'

/**
 * Fills a region with a linear gradient from `start` (colour a) to `end` (colour b).
 * "dither" uses only the two colours in an ordered pattern, the classic pixel-art look.
 */
export function gradientFill(
  bitmap: Bitmap,
  region: Rect,
  start: Point,
  end: Point,
  a: Rgba,
  b: Rgba,
  mode: GradientMode,
): void {
  const dx = end[0] - start[0]
  const dy = end[1] - start[1]
  const length = dx * dx + dy * dy
  for (let y = region.y; y < region.y + region.height; y++) {
    for (let x = region.x; x < region.x + region.width; x++) {
      const t =
        length === 0
          ? 0
          : Math.min(1, Math.max(0, ((x - start[0]) * dx + (y - start[1]) * dy) / length))
      if (mode === 'dither') {
        setPixel(bitmap, x, y, t > BAYER[y & 3][x & 3] ? b : a)
      } else {
        const mix = (i: number): number => Math.round(a[i] + (b[i] - a[i]) * t)
        setPixel(bitmap, x, y, [mix(0), mix(1), mix(2), mix(3)])
      }
    }
  }
}
