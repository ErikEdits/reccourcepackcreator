// Camera framing of the 3D preview (also used by the end-to-end tests to aim at faces).

export type PreviewKind = 'block' | 'item' | 'mob'

/** Where the camera looks from (a direction; the distance is fitted to the view). Mobs face -z. */
export const CAMERA_DIRECTION: Record<PreviewKind, readonly [number, number, number]> = {
  block: [2.1, 1.7, 2.6],
  item: [0.6, 0.3, 2.6],
  mob: [1.6, 1, -2.6],
}
export const FOV = 30

/** How far away the camera must be so a model of this radius fits, however narrow the view is. */
export function cameraDistance(radius: number, aspect: number): number {
  const vertical = (FOV * Math.PI) / 180
  const horizontal = 2 * Math.atan(Math.tan(vertical / 2) * aspect)
  return (radius / Math.sin(Math.min(vertical, horizontal) / 2)) * 1.08
}
