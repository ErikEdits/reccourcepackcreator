import { describe, expect, it } from 'vitest'
import { paletteFromBitmap, parsePaletteFile, rgbToHsv, hsvToRgb } from './colour'
import {
  addLayer,
  compose,
  createDocument,
  isFlat,
  mergeDown,
  moveLayer,
  removeLayer,
  setLayerPixels,
  setLayerProps,
} from './document'
import { canRedo, canUndo, currentDoc, jumpTo, record, redo, startHistory, undo } from './history'
import {
  clipRect,
  createBitmap,
  extract,
  getPixel,
  parseHex,
  pasteOpaque,
  scaleNearest,
  setPixel,
  toHex,
  type Bitmap,
  type Rgba,
} from './pixels'
import {
  brushPoints,
  ellipsePoints,
  floodFill,
  gradientFill,
  linePoints,
  mirrorPoints,
  rectanglePoints,
} from './raster'
import { canTransform, transformRegion } from './transform'

const RED: Rgba = [255, 0, 0, 255]
const BLUE: Rgba = [0, 0, 255, 255]
const CLEAR: Rgba = [0, 0, 0, 0]

/** Draws a bitmap as text: "R" red, "B" blue, "." transparent, "?" anything else. */
function draw(bitmap: Bitmap): string[] {
  const rows: string[] = []
  for (let y = 0; y < bitmap.height; y++) {
    let row = ''
    for (let x = 0; x < bitmap.width; x++) {
      const hex = toHex(getPixel(bitmap, x, y))
      row += hex === '#ff0000' ? 'R' : hex === '#0000ff' ? 'B' : hex === '#00000000' ? '.' : '?'
    }
    rows.push(row)
  }
  return rows
}

function bitmapOf(rows: string[]): Bitmap {
  const bitmap = createBitmap(rows[0].length, rows.length)
  rows.forEach((row, y) =>
    [...row].forEach((char, x) =>
      setPixel(bitmap, x, y, char === 'R' ? RED : char === 'B' ? BLUE : CLEAR),
    ),
  )
  return bitmap
}

describe('pixels', () => {
  it('converts hex colours both ways', () => {
    expect(parseHex('#f00')).toEqual(RED)
    expect(parseHex('0000ff80')).toEqual([0, 0, 255, 128])
    expect(parseHex('nope')).toBeNull()
    expect(toHex([255, 0, 0, 255])).toBe('#ff0000')
    expect(toHex([0, 0, 255, 128])).toBe('#0000ff80')
  })

  it('clips rectangles to the bitmap', () => {
    expect(clipRect({ x: -2, y: 1, width: 5, height: 9 }, 4, 4)).toEqual({
      x: 0,
      y: 1,
      width: 3,
      height: 3,
    })
    expect(clipRect({ x: 5, y: 5, width: 2, height: 2 }, 4, 4)).toBeNull()
  })

  it('scales with hard pixel edges', () => {
    expect(draw(scaleNearest(bitmapOf(['RB']), 4, 2))).toEqual(['RRBB', 'RRBB'])
  })

  it('pastes only opaque pixels when moving a selection', () => {
    const target = bitmapOf(['BBB'])
    pasteOpaque(target, bitmapOf(['R.']), 1, 0)
    expect(draw(target)).toEqual(['BRB'])
  })
})

describe('raster', () => {
  it('draws lines without gaps', () => {
    expect(linePoints(0, 0, 3, 1)).toEqual([
      [0, 0],
      [1, 0],
      [2, 1],
      [3, 1],
    ])
  })

  it('draws outlined and filled rectangles', () => {
    const outline = createBitmap(4, 3)
    for (const [x, y] of rectanglePoints(3, 2, 0, 0, false)) setPixel(outline, x, y, RED)
    expect(draw(outline)).toEqual(['RRRR', 'R..R', 'RRRR'])
    expect(rectanglePoints(0, 0, 3, 2, true)).toHaveLength(12)
  })

  it('draws ellipses inside their box', () => {
    const bitmap = createBitmap(5, 5)
    for (const [x, y] of ellipsePoints(0, 0, 4, 4, false)) setPixel(bitmap, x, y, RED)
    expect(draw(bitmap)).toEqual(['.RRR.', 'R...R', 'R...R', 'R...R', '.RRR.'])
  })

  it('makes square brushes', () => {
    expect(brushPoints([5, 5], 1)).toEqual([[5, 5]])
    expect(brushPoints([5, 5], 2)).toHaveLength(4)
  })

  it('mirrors points for symmetry', () => {
    expect(mirrorPoints([[0, 0]], 4, 4, { horizontal: true, vertical: true }).sort()).toEqual([
      [0, 0],
      [0, 3],
      [3, 0],
      [3, 3],
    ])
  })

  it('flood fills only the connected area', () => {
    const bitmap = bitmapOf(['..B.', '..B.', 'BBB.'])
    expect(floodFill(bitmap, 0, 0, RED)).toBe(true)
    expect(draw(bitmap)).toEqual(['RRB.', 'RRB.', 'BBB.'])
    expect(floodFill(bitmap, 0, 0, RED)).toBe(false)
  })

  it('keeps flood fills inside the selection', () => {
    const bitmap = createBitmap(4, 1)
    floodFill(bitmap, 0, 0, RED, { x: 0, y: 0, width: 2, height: 1 })
    expect(draw(bitmap)).toEqual(['RR..'])
  })

  it('dithers gradients with only the two colours', () => {
    const bitmap = createBitmap(8, 1)
    gradientFill(bitmap, { x: 0, y: 0, width: 8, height: 1 }, [0, 0], [7, 0], RED, BLUE, 'dither')
    const row = draw(bitmap)[0]
    expect(row[0]).toBe('R')
    expect(row[7]).toBe('B')
    expect(row).toMatch(/^[RB]+$/)
  })

  it('blends smooth gradients', () => {
    const bitmap = createBitmap(3, 1)
    gradientFill(bitmap, { x: 0, y: 0, width: 3, height: 1 }, [0, 0], [2, 0], RED, BLUE, 'smooth')
    expect(getPixel(bitmap, 1, 0)).toEqual([128, 0, 128, 255])
  })
})

describe('transform', () => {
  it('flips and rotates a region in place', () => {
    const bitmap = bitmapOf(['RB', '..'])
    transformRegion(bitmap, { x: 0, y: 0, width: 2, height: 2 }, 'flip-horizontal')
    expect(draw(bitmap)).toEqual(['BR', '..'])
    transformRegion(bitmap, { x: 0, y: 0, width: 2, height: 2 }, 'flip-vertical')
    expect(draw(bitmap)).toEqual(['..', 'BR'])
    transformRegion(bitmap, { x: 0, y: 0, width: 2, height: 2 }, 'rotate')
    expect(draw(bitmap)).toEqual(['B.', 'R.'])
  })

  it('only rotates square regions', () => {
    expect(canTransform('rotate', { x: 0, y: 0, width: 2, height: 3 })).toBe(false)
    expect(extract(bitmapOf(['RB']), { x: 1, y: 0, width: 1, height: 1 }).data[2]).toBe(255)
  })
})

describe('document', () => {
  it('composes visible layers with opacity', () => {
    let doc = createDocument(bitmapOf(['R']))
    doc = addLayer(doc)
    doc = setLayerPixels(doc, doc.activeLayerId, bitmapOf(['B']))
    expect(toHex(getPixel(compose(doc), 0, 0))).toBe('#0000ff')
    doc = setLayerProps(doc, doc.activeLayerId, { opacity: 0.5 })
    expect(getPixel(compose(doc), 0, 0)).toEqual([128, 0, 128, 255])
    doc = setLayerProps(doc, doc.activeLayerId, { visible: false })
    expect(toHex(getPixel(compose(doc), 0, 0))).toBe('#ff0000')
  })

  it('adds, moves, merges and removes layers', () => {
    let doc = createDocument(bitmapOf(['R.']))
    expect(isFlat(doc)).toBe(true)
    doc = addLayer(doc)
    doc = setLayerPixels(doc, doc.activeLayerId, bitmapOf(['.B']))
    expect(doc.layers).toHaveLength(2)
    expect(isFlat(doc)).toBe(false)
    expect(moveLayer(doc, 1)).toBe(doc)
    doc = mergeDown(doc)
    expect(doc.layers).toHaveLength(1)
    expect(draw(doc.layers[0].pixels)).toEqual(['RB'])
    expect(removeLayer(doc)).toBe(doc)
  })
})

describe('history', () => {
  it('undoes, redoes and jumps, dropping undone steps on a new change', () => {
    const a = createDocument(createBitmap(1, 1))
    const b = setLayerPixels(a, a.activeLayerId, bitmapOf(['R']))
    const c = setLayerPixels(a, a.activeLayerId, bitmapOf(['B']))
    let history = record(startHistory(a), 'Pencil', b)
    expect(canUndo(history)).toBe(true)
    history = undo(history)
    expect(currentDoc(history)).toBe(a)
    expect(canRedo(history)).toBe(true)
    expect(currentDoc(redo(history))).toBe(b)
    history = record(history, 'Fill', c)
    expect(history.entries.map((entry) => entry.label)).toEqual(['Opened', 'Fill'])
    expect(currentDoc(jumpTo(history, 0))).toBe(a)
  })

  it('merges repeated changes of the same kind into one step when asked', () => {
    const a = createDocument(createBitmap(1, 1))
    const b = setLayerProps(a, a.activeLayerId, { opacity: 0.5 })
    const c = setLayerProps(a, a.activeLayerId, { opacity: 0.4 })
    let history = record(startHistory(a), 'Layer opacity', b, true)
    history = record(history, 'Layer opacity', c, true)
    expect(history.entries.map((entry) => entry.label)).toEqual(['Opened', 'Layer opacity'])
    expect(currentDoc(history)).toBe(c)
    expect(record(history, 'Pencil', a, true).entries).toHaveLength(3)
  })
})

describe('colour', () => {
  it('converts between RGB and HSV', () => {
    expect(rgbToHsv(255, 0, 0)).toEqual({ h: 0, s: 1, v: 1 })
    expect(hsvToRgb({ h: 240, s: 1, v: 1 })).toEqual([0, 0, 255])
    expect(hsvToRgb(rgbToHsv(46, 139, 87))).toEqual([46, 139, 87])
  })

  it('takes the palette from a texture, most used colour first', () => {
    expect(paletteFromBitmap(bitmapOf(['RRB.'])).map(toHex)).toEqual(['#ff0000', '#0000ff'])
  })

  it('reads .hex, .gpl and .pal palette files', () => {
    expect(parsePaletteFile('a.hex', 'ff0000\n0000ff\n').map(toHex)).toEqual(['#ff0000', '#0000ff'])
    expect(
      parsePaletteFile('b.gpl', 'GIMP Palette\nName: Test\n#\n255   0   0\tRed\n0 0 255 Blue').map(
        toHex,
      ),
    ).toEqual(['#ff0000', '#0000ff'])
    expect(parsePaletteFile('c.pal', 'JASC-PAL\n0100\n2\n255 0 0\n0 0 255').map(toHex)).toEqual([
      '#ff0000',
      '#0000ff',
    ])
  })
})
