// Turns block models and item sprites into three.js geometry for the 3D preview
// (docs/DECISIONS.md #37, #40). Units: one block is 1 × 1 × 1, centred on the origin.

import { BufferGeometry, Float32BufferAttribute, Matrix4, Vector3 } from 'three'
import type { BlockModel, FaceName, ModelElement, ModelFace } from '../../../shared/block-models'
import type { MobCube, MobModel, MobPart } from '../../../shared/mob-models'
import type { Bitmap } from '../editor/pixels'

/** Which texture each geometry group shows, by index into the material list. */
export interface PreviewGeometry {
  geometry: BufferGeometry
  /** Texture path of each material slot. */
  textures: string[]
}

type Corner = [number, number, number]

/** The four corners of a face as seen from outside: top left, top right, bottom right, bottom left. */
function faceCorners(face: FaceName, [x0, y0, z0]: Corner, [x1, y1, z1]: Corner): Corner[] {
  switch (face) {
    case 'north':
      return [
        [x1, y1, z0],
        [x0, y1, z0],
        [x0, y0, z0],
        [x1, y0, z0],
      ]
    case 'south':
      return [
        [x0, y1, z1],
        [x1, y1, z1],
        [x1, y0, z1],
        [x0, y0, z1],
      ]
    case 'west':
      return [
        [x0, y1, z0],
        [x0, y1, z1],
        [x0, y0, z1],
        [x0, y0, z0],
      ]
    case 'east':
      return [
        [x1, y1, z1],
        [x1, y1, z0],
        [x1, y0, z0],
        [x1, y0, z1],
      ]
    case 'up':
      return [
        [x0, y1, z0],
        [x1, y1, z0],
        [x1, y1, z1],
        [x0, y1, z1],
      ]
    case 'down':
      return [
        [x0, y0, z1],
        [x1, y0, z1],
        [x1, y0, z0],
        [x0, y0, z0],
      ]
  }
}

/** Texture coordinates (0..1, v from the top) of the face corners, turned as the model says. */
function faceUvs({ uv: [u1, v1, u2, v2], rotation }: ModelFace): [number, number][] {
  const corners: [number, number][] = [
    [u1 / 16, v1 / 16],
    [u2 / 16, v1 / 16],
    [u2 / 16, v2 / 16],
    [u1 / 16, v2 / 16],
  ]
  const steps = rotation / 90
  return corners.map((_, i) => corners[(i - steps + 4) % 4])
}

function elementMatrix(element: ModelElement): Matrix4 {
  const matrix = new Matrix4()
  const rotation = element.rotation
  if (!rotation || rotation.angle === 0) return matrix
  const radians = (rotation.angle * Math.PI) / 180
  const [ox, oy, oz] = rotation.origin
  const turn =
    rotation.axis === 'x'
      ? new Matrix4().makeRotationX(radians)
      : rotation.axis === 'y'
        ? new Matrix4().makeRotationY(radians)
        : new Matrix4().makeRotationZ(radians)
  // Rescaling stretches the turned element so it still spans the block (plants' crosses).
  const scale = rotation.rescale ? 1 / Math.cos(Math.abs(radians)) : 1
  const stretch = new Matrix4().makeScale(
    rotation.axis === 'x' ? 1 : scale,
    rotation.axis === 'y' ? 1 : scale,
    rotation.axis === 'z' ? 1 : scale,
  )
  return matrix
    .makeTranslation(ox, oy, oz)
    .multiply(stretch)
    .multiply(turn)
    .multiply(new Matrix4().makeTranslation(-ox, -oy, -oz))
}

/** Minecraft's fixed shading: tops are brightest, bottoms darkest. */
function shade(normal: Vector3): number {
  const { x, y, z } = normal
  return x * x * 0.6 + z * z * 0.8 + (y > 0 ? y * y : y * y * 0.5)
}

const GRASS = [0x91 / 255, 0xbd / 255, 0x59 / 255]
const FOLIAGE = [0x77 / 255, 0xab / 255, 0x2f / 255]

/** The colour Minecraft gives tinted faces of a block in a plains biome. */
export function tintColour(blockId: string): [number, number, number] {
  const hex = (value: number): [number, number, number] => [
    ((value >> 16) & 255) / 255,
    ((value >> 8) & 255) / 255,
    (value & 255) / 255,
  ]
  if (blockId === 'water' || blockId.includes('water_cauldron')) return hex(0x3f76e4)
  if (blockId === 'spruce_leaves') return hex(0x619961)
  if (blockId === 'birch_leaves') return hex(0x80a755)
  if (blockId.includes('leaves') || blockId === 'vine') return FOLIAGE as [number, number, number]
  if (blockId === 'lily_pad') return hex(0x208030)
  if (blockId === 'redstone_wire') return hex(0xfc3100)
  if (blockId.endsWith('_stem')) return hex(0xe0c71c)
  return GRASS as [number, number, number]
}

/** Geometry of a block model; faces that share a texture share a material slot. */
export function blockGeometry(model: BlockModel): PreviewGeometry {
  const positions: number[] = []
  const uvs: number[] = []
  const colours: number[] = []
  const normals: number[] = []
  const textures: string[] = []
  const geometry = new BufferGeometry()
  const tint = tintColour(model.id)

  let vertexCount = 0
  for (const part of model.parts) {
    // Blockstate rotations turn the whole model around the block's centre, clockwise.
    const partMatrix = new Matrix4()
      .makeTranslation(8, 8, 8)
      .multiply(new Matrix4().makeRotationY((-part.y * Math.PI) / 180))
      .multiply(new Matrix4().makeRotationX((-part.x * Math.PI) / 180))
      .multiply(new Matrix4().makeTranslation(-8, -8, -8))

    for (const element of part.elements) {
      const matrix = partMatrix.clone().multiply(elementMatrix(element))
      for (const [name, face] of Object.entries(element.faces) as [FaceName, ModelFace][]) {
        if (!face.texture) continue
        let slot = textures.indexOf(face.texture)
        if (slot < 0) slot = textures.push(face.texture) - 1

        const corners = faceCorners(name, element.from, element.to).map((corner) =>
          new Vector3(...corner).applyMatrix4(matrix),
        )
        // Down the face × across it points outwards (the corners are already turned).
        const normal = new Vector3()
          .subVectors(corners[3], corners[0])
          .cross(new Vector3().subVectors(corners[1], corners[0]))
          .normalize()
        const light = element.shade ? shade(normal) : 1
        const colour = face.tinted ? tint.map((c) => c * light) : [light, light, light]
        const faceUv = faceUvs(face)

        // Two triangles, counter-clockwise from outside: TL-BL-BR and TL-BR-TR.
        for (const i of [0, 3, 2, 0, 2, 1]) {
          const corner = corners[i]
          positions.push(corner.x / 16 - 0.5, corner.y / 16 - 0.5, corner.z / 16 - 0.5)
          uvs.push(faceUv[i][0], faceUv[i][1])
          colours.push(...colour)
          normals.push(normal.x, normal.y, normal.z)
        }
        geometry.addGroup(vertexCount, 6, slot)
        vertexCount += 6
      }
    }
  }

  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
  geometry.setAttribute('color', new Float32BufferAttribute(colours, 3))
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3))
  return { geometry, textures }
}

/**
 * An item sprite with thickness, like Minecraft's held items: the picture on the front and
 * (mirrored) on the back, and a one-pixel wall around every opaque pixel.
 */
export function itemGeometry(path: string, image: Bitmap): PreviewGeometry {
  const { width, height } = image
  const opaque = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < width && y < height && image.data[(y * width + x) * 4 + 3] > 0
  const size = Math.max(width, height)
  const depth = 1 / 32
  const positions: number[] = []
  const uvs: number[] = []
  const colours: number[] = []

  const quad = (corners: Corner[], uv: [number, number][], light: number): void => {
    for (const i of [0, 3, 2, 0, 2, 1]) {
      positions.push(...corners[i])
      uvs.push(...uv[i])
      colours.push(light, light, light)
    }
  }
  const px = (x: number): number => x / size - width / size / 2
  const py = (y: number): number => height / size / 2 - y / size

  const full: [number, number][] = [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
  ]
  const left = px(0)
  const right = px(width)
  const top = py(0)
  const bottom = py(height)
  quad(
    [
      [left, top, depth],
      [right, top, depth],
      [right, bottom, depth],
      [left, bottom, depth],
    ],
    full,
    1,
  )
  quad(
    [
      [right, top, -depth],
      [left, top, -depth],
      [left, bottom, -depth],
      [right, bottom, -depth],
    ],
    [
      [1, 0],
      [0, 0],
      [0, 1],
      [1, 1],
    ],
    0.8,
  )

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!opaque(x, y)) continue
      // The wall shows the pixel's own colour: its texture area is the pixel's centre.
      const u = (x + 0.5) / width
      const v = (y + 0.5) / height
      const uv: [number, number][] = [
        [u, v],
        [u, v],
        [u, v],
        [u, v],
      ]
      const [x0, x1, y0, y1] = [px(x), px(x + 1), py(y), py(y + 1)]
      if (!opaque(x, y - 1)) {
        quad(
          [
            [x0, y0, -depth],
            [x1, y0, -depth],
            [x1, y0, depth],
            [x0, y0, depth],
          ],
          uv,
          1,
        )
      }
      if (!opaque(x, y + 1)) {
        quad(
          [
            [x0, y1, depth],
            [x1, y1, depth],
            [x1, y1, -depth],
            [x0, y1, -depth],
          ],
          uv,
          0.5,
        )
      }
      if (!opaque(x - 1, y)) {
        quad(
          [
            [x0, y0, -depth],
            [x0, y0, depth],
            [x0, y1, depth],
            [x0, y1, -depth],
          ],
          uv,
          0.6,
        )
      }
      if (!opaque(x + 1, y)) {
        quad(
          [
            [x1, y0, depth],
            [x1, y0, -depth],
            [x1, y1, -depth],
            [x1, y1, depth],
          ],
          uv,
          0.6,
        )
      }
    }
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
  geometry.setAttribute('color', new Float32BufferAttribute(colours, 3))
  geometry.computeVertexNormals()
  geometry.addGroup(0, positions.length / 3, 0)
  return { geometry, textures: [path] }
}

type Region = [left: number, top: number, width: number, height: number]

/**
 * Geometry of a mob model. Each box takes its six faces from Minecraft's "box UV" layout: top
 * and bottom in the first row, then right side, front, left side and back. The model is turned
 * from Minecraft's y-down model space into the preview's y-up space and centred. Overlay
 * textures get the whole model once per texture, the ones `under` them drawn first.
 */
export function mobGeometry(model: MobModel, path: string, under: string[] = []): PreviewGeometry {
  const positions: number[] = []
  const uvs: number[] = []
  const colours: number[] = []
  const [textureWidth, textureHeight] = model.textureSize

  const addCube = (cube: MobCube, matrix: Matrix4): void => {
    const g = cube.inflate ?? 0
    const [x, y, z] = cube.from
    const [w, h, d] = cube.size
    const [x0, x1, y0, y1, z0, z1] = [x - g, x + w + g, y - g, y + h + g, z - g, z + d + g]
    const [u, v] = cube.uv
    let right: Region = [u, v + d, d, h]
    let left: Region = [u + d + w, v + d, d, h]
    if (cube.mirror) [right, left] = [left, right]
    // Corners seen from outside (top left, top right, bottom right, bottom left), y down.
    const faces: [Region, Corner[]][] = [
      [
        [u + d, v + d, w, h],
        [
          [x0, y0, z0],
          [x1, y0, z0],
          [x1, y1, z0],
          [x0, y1, z0],
        ],
      ],
      [
        [u + 2 * d + w, v + d, w, h],
        [
          [x1, y0, z1],
          [x0, y0, z1],
          [x0, y1, z1],
          [x1, y1, z1],
        ],
      ],
      [
        right,
        [
          [x0, y0, z1],
          [x0, y0, z0],
          [x0, y1, z0],
          [x0, y1, z1],
        ],
      ],
      [
        left,
        [
          [x1, y0, z0],
          [x1, y0, z1],
          [x1, y1, z1],
          [x1, y1, z0],
        ],
      ],
      [
        [u + d, v, w, d],
        [
          [x0, y0, z1],
          [x1, y0, z1],
          [x1, y0, z0],
          [x0, y0, z0],
        ],
      ],
      [
        [u + d + w, v, w, d],
        [
          [x0, y1, z0],
          [x1, y1, z0],
          [x1, y1, z1],
          [x0, y1, z1],
        ],
      ],
    ]
    for (const [[left0, top, width, height], corners] of faces) {
      if (width === 0 || height === 0) continue
      const [l, r] = cube.mirror ? [left0 + width, left0] : [left0, left0 + width]
      const faceUv: [number, number][] = [
        [l / textureWidth, top / textureHeight],
        [r / textureWidth, top / textureHeight],
        [r / textureWidth, (top + height) / textureHeight],
        [l / textureWidth, (top + height) / textureHeight],
      ]
      const points = corners.map((corner) => new Vector3(...corner).applyMatrix4(matrix))
      const normal = new Vector3()
        .subVectors(points[3], points[0])
        .cross(new Vector3().subVectors(points[1], points[0]))
        .normalize()
      const light = shade(normal)
      for (const i of [0, 3, 2, 0, 2, 1]) {
        positions.push(points[i].x, points[i].y, points[i].z)
        uvs.push(...faceUv[i])
        colours.push(light, light, light)
      }
    }
  }

  const addPart = (part: MobPart, parent: Matrix4): void => {
    const [rx, ry, rz] = part.rotation ?? [0, 0, 0]
    const matrix = parent
      .clone()
      .multiply(new Matrix4().makeTranslation(...part.pivot))
      .multiply(new Matrix4().makeRotationZ(rz))
      .multiply(new Matrix4().makeRotationY(ry))
      .multiply(new Matrix4().makeRotationX(rx))
    for (const cube of part.cubes) addCube(cube, matrix)
    for (const child of part.children ?? []) addPart(child, matrix)
  }
  // Turning half way around z makes y point up (as Minecraft draws mobs); 16 pixels per block.
  const root = new Matrix4().makeScale(-1 / 16, -1 / 16, 1 / 16)
  const textures = [...under, path]
  const geometry = new BufferGeometry()
  textures.forEach((_, slot) => {
    const start = positions.length / 3
    for (const part of model.parts) addPart(part, root)
    geometry.addGroup(start, positions.length / 3 - start, slot)
  })

  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
  geometry.setAttribute('color', new Float32BufferAttribute(colours, 3))
  geometry.center()
  return { geometry, textures }
}

/** Which pixels are opaque; the item's 3D shape only changes when this does. */
export function alphaMask(image: Bitmap): string {
  let mask = `${image.width}x${image.height}:`
  for (let i = 3; i < image.data.length; i += 4) mask += image.data[i] > 0 ? '1' : '0'
  return mask
}
