import type { Bitmap } from '../editor/pixels'

export const PACK_ICON_SIZE = 128

/** Encodes a canvas as PNG bytes. */
export async function canvasToPng(canvas: HTMLCanvasElement): Promise<Uint8Array<ArrayBuffer>> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('Could not encode the image')
  return new Uint8Array(await blob.arrayBuffer())
}

function canvasOfSize(
  width: number,
  height: number,
): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas is not available')
  return [canvas, context]
}

/**
 * Turns any image into a square 128×128 pack.png: centre-cropped, scaled up with hard
 * pixel edges (pixel art stays crisp) or scaled down smoothly.
 */
export async function imageToPackIcon(file: Blob): Promise<Uint8Array<ArrayBuffer>> {
  const bitmap = await createImageBitmap(file)
  try {
    const side = Math.min(bitmap.width, bitmap.height)
    const [canvas, context] = canvasOfSize(PACK_ICON_SIZE, PACK_ICON_SIZE)
    context.imageSmoothingEnabled = side > PACK_ICON_SIZE
    context.imageSmoothingQuality = 'high'
    context.drawImage(
      bitmap,
      (bitmap.width - side) / 2,
      (bitmap.height - side) / 2,
      side,
      side,
      0,
      0,
      PACK_ICON_SIZE,
      PACK_ICON_SIZE,
    )
    return await canvasToPng(canvas)
  } finally {
    bitmap.close()
  }
}

/**
 * Turns any image into a texture PNG of the given width (null keeps the image's width). The
 * height follows the image's aspect ratio, so animation strips keep their frames. Scaling
 * keeps hard pixel edges (nearest neighbour, docs/DECISIONS.md #35).
 */
export async function imageToTexture(
  file: Blob,
  targetWidth: number | null,
): Promise<Uint8Array<ArrayBuffer>> {
  const bitmap = await createImageBitmap(file)
  try {
    const width = targetWidth ?? bitmap.width
    const height = Math.max(1, Math.round((bitmap.height * width) / bitmap.width))
    const [canvas, context] = canvasOfSize(width, height)
    context.imageSmoothingEnabled = false
    context.drawImage(bitmap, 0, 0, width, height)
    return await canvasToPng(canvas)
  } finally {
    bitmap.close()
  }
}

/** Object URL for showing PNG bytes in an <img>; revoke it when done. */
export function pngUrl(bytes: Uint8Array): string {
  return URL.createObjectURL(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'image/png' }))
}

/** Decodes PNG (or any image) bytes into straight RGBA pixels. */
export async function decodeImage(bytes: Uint8Array): Promise<Bitmap> {
  const bitmap = await createImageBitmap(
    new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'image/png' }),
    { premultiplyAlpha: 'none', colorSpaceConversion: 'none' },
  )
  try {
    const [, context] = canvasOfSize(bitmap.width, bitmap.height)
    context.drawImage(bitmap, 0, 0)
    const { data } = context.getImageData(0, 0, bitmap.width, bitmap.height)
    return { width: bitmap.width, height: bitmap.height, data }
  } finally {
    bitmap.close()
  }
}

/** Encodes pixels as PNG bytes. */
export async function encodePng(bitmap: Bitmap): Promise<Uint8Array<ArrayBuffer>> {
  const [canvas, context] = canvasOfSize(bitmap.width, bitmap.height)
  context.putImageData(
    new ImageData(new Uint8ClampedArray(bitmap.data), bitmap.width, bitmap.height),
    0,
    0,
  )
  return canvasToPng(canvas)
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(binary)
}

export function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}
