export const PACK_ICON_SIZE = 128

/**
 * Turns any image into a square 128×128 pack.png: centre-cropped, scaled up with hard
 * pixel edges (pixel art stays crisp) or scaled down smoothly.
 */
export async function imageToPackIcon(file: Blob): Promise<Uint8Array<ArrayBuffer>> {
  const bitmap = await createImageBitmap(file)
  try {
    const side = Math.min(bitmap.width, bitmap.height)
    const canvas = document.createElement('canvas')
    canvas.width = PACK_ICON_SIZE
    canvas.height = PACK_ICON_SIZE
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas is not available')
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
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
    if (!blob) throw new Error('Could not encode the icon')
    return new Uint8Array(await blob.arrayBuffer())
  } finally {
    bitmap.close()
  }
}

/** Object URL for showing PNG bytes in an <img>; revoke it when done. */
export function pngUrl(bytes: Uint8Array): string {
  return URL.createObjectURL(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'image/png' }))
}
