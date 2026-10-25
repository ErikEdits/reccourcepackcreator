// Camera framing of the 3D preview (also used by the end-to-end tests to aim at faces).

/** Where the camera looks from (a direction; the distance is fitted to the view). */
export const CAMERA_DIRECTION = { block: [2.1, 1.7, 2.6], item: [0.6, 0.3, 2.6] } as const
const MODEL_RADIUS = { block: Math.sqrt(3) / 2, item: Math.SQRT1_2 }
export const FOV = 30

/** How far away the camera must be so the whole model fits, however narrow the view is. */
export function cameraDistance(kind: 'block' | 'item', aspect: number): number {
  const vertical = (FOV * Math.PI) / 180
  const horizontal = 2 * Math.atan(Math.tan(vertical / 2) * aspect)
  return (MODEL_RADIUS[kind] / Math.sin(Math.min(vertical, horizontal) / 2)) * 1.08
}
