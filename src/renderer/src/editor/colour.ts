// Colour conversions and palettes (docs/DECISIONS.md #31).

import { getPixel, parseHex, toHex, type Bitmap, type Rgba } from './pixels'

export interface Hsv {
  /** 0..360 */
  h: number
  /** 0..1 */
  s: number
  /** 0..1 */
  v: number
}

export function rgbToHsv(r: number, g: number, b: number): Hsv {
  const max = Math.max(r, g, b) / 255
  const min = Math.min(r, g, b) / 255
  const delta = max - min
  let h = 0
  if (delta > 0) {
    if (max === r / 255) h = (((g - b) / 255 / delta) % 6) * 60
    else if (max === g / 255) h = ((b - r) / 255 / delta + 2) * 60
    else h = ((r - g) / 255 / delta + 4) * 60
  }
  return { h: (h + 360) % 360, s: max === 0 ? 0 : delta / max, v: max }
}

export function hsvToRgb({ h, s, v }: Hsv): [number, number, number] {
  const c = v * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = v - c
  const [r, g, b] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x]
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)]
}

/** The colours used in a bitmap, most frequent first (fully transparent pixels skipped). */
export function paletteFromBitmap(bitmap: Bitmap, max = 32): Rgba[] {
  const counts = new Map<string, number>()
  for (let y = 0; y < bitmap.height; y++) {
    for (let x = 0; x < bitmap.width; x++) {
      const colour = getPixel(bitmap, x, y)
      if (colour[3] === 0) continue
      const key = toHex(colour)
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
  }
  return [...counts]
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([hex]) => parseHex(hex)!)
}

const clampByte = (value: number): number => Math.max(0, Math.min(255, Math.round(value)))

/**
 * Reads a palette file: Lospec/Paint.NET ".hex" (one colour per line), GIMP ".gpl"
 * ("R G B name" lines) or JASC ".pal" ("JASC-PAL", version, count, then "R G B").
 */
export function parsePaletteFile(fileName: string, text: string): Rgba[] {
  const lines = text.split(/\r?\n/).map((line) => line.trim())
  const extension = fileName.toLowerCase().split('.').pop()
  const colours: Rgba[] = []

  if (extension === 'hex' || extension === 'txt') {
    for (const line of lines) {
      const colour = parseHex(line.replace(/^ff(?=[0-9a-f]{6}$)/i, ''))
      if (colour) colours.push(colour)
    }
    return colours
  }

  const rgbLines =
    extension === 'pal'
      ? lines[0] === 'JASC-PAL'
        ? lines.slice(3)
        : []
      : lines.filter((line) => line && !/^(GIMP Palette|Name:|Columns:|#)/i.test(line))
  for (const line of rgbLines) {
    const match = /^(\d+)\s+(\d+)\s+(\d+)/.exec(line)
    if (match) {
      colours.push([clampByte(+match[1]), clampByte(+match[2]), clampByte(+match[3]), 255])
    }
  }
  return colours
}
