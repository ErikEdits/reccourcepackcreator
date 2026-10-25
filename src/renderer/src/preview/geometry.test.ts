import { describe, expect, it } from 'vitest'
import type { BlockModel, ModelFace } from '../../../shared/block-models'
import { createBitmap, setPixel } from '../editor/pixels'
import { cameraDistance } from './camera'
import type { MobModel } from '../../../shared/mob-models'
import { alphaMask, blockGeometry, itemGeometry, mobGeometry, tintColour } from './geometry'

const face = (texture: string, extra: Partial<ModelFace> = {}): ModelFace => ({
  uv: [0, 0, 16, 16],
  texture,
  rotation: 0,
  tinted: false,
  ...extra,
})

const cube = (id: string, faces: BlockModel['parts'][0]['elements'][0]['faces']): BlockModel => ({
  id,
  parts: [
    {
      x: 0,
      y: 0,
      elements: [{ from: [0, 0, 0], to: [16, 16, 16], rotation: null, shade: true, faces }],
    },
  ],
})

/** The vertex data of one face (6 vertices) as plain arrays. */
function faceData(geometry: ReturnType<typeof blockGeometry>['geometry'], index: number) {
  const read = (name: string, size: number) => {
    const attribute = geometry.getAttribute(name)
    return Array.from({ length: 6 }, (_, i) =>
      Array.from({ length: size }, (_, c) =>
        Number(attribute.array[(index * 6 + i) * size + c].toFixed(3)),
      ),
    )
  }
  return { position: read('position', 3), uv: read('uv', 2), colour: read('color', 3) }
}

describe('block geometry', () => {
  it('builds a cube with one material slot per texture and Minecraft shading', () => {
    const { geometry, textures } = blockGeometry(
      cube('stone', {
        up: face('block/stone.png'),
        down: face('block/stone.png'),
        north: face('block/stone_side.png'),
      }),
    )
    expect(textures).toEqual(['block/stone.png', 'block/stone_side.png'])
    expect(geometry.getAttribute('position').count).toBe(18)
    expect(geometry.groups.map((group) => group.materialIndex)).toEqual([0, 0, 1])

    const north = faceData(geometry, 2)
    // Top left of the texture sits at the top east corner, seen from the north.
    expect(north.position[0]).toEqual([0.5, 0.5, -0.5])
    expect(north.uv[0]).toEqual([0, 0])
    expect(north.colour[0]).toEqual([0.8, 0.8, 0.8])
    expect(faceData(geometry, 0).colour[0]).toEqual([1, 1, 1])
    expect(faceData(geometry, 1).colour[0]).toEqual([0.5, 0.5, 0.5])
  })

  it('tints faces with the biome colour and turns textures and models', () => {
    const { geometry } = blockGeometry(
      cube('oak_leaves', { up: face('block/oak_leaves.png', { tinted: true, rotation: 90 }) }),
    )
    const up = faceData(geometry, 0)
    const [r, g, b] = tintColour('oak_leaves')
    expect(up.colour[0]).toEqual([r, g, b].map((c) => Number(c.toFixed(3))))
    // Turned 90°: the top left corner shows the texture's bottom left.
    expect(up.uv[0]).toEqual([0, 1])

    const furnace = cube('furnace', { north: face('block/furnace_front.png') })
    const turned = blockGeometry({ ...furnace, parts: [{ ...furnace.parts[0], y: 90 }] })
    // y: 90 turns the front from north to east.
    const front = faceData(turned.geometry, 0).position
    expect(front.every(([x]) => x === 0.5)).toBe(true)
  })
})

describe('item geometry', () => {
  it('gives opaque pixels walls and leaves transparent ones open', () => {
    const image = createBitmap(2, 2)
    setPixel(image, 0, 0, [255, 0, 0, 255])
    const { geometry, textures } = itemGeometry('item/apple.png', image)
    expect(textures).toEqual(['item/apple.png'])
    // Front + back + 4 walls around the single pixel.
    expect(geometry.getAttribute('position').count).toBe(6 * 6)
    expect(alphaMask(image)).toBe('2x2:1000')
  })
})

describe('mob geometry', () => {
  const cube = (mirror: boolean): MobModel => ({
    id: 'test',
    textureSize: [64, 32],
    parts: [
      { pivot: [0, 0, 0], cubes: [{ uv: [0, 0], from: [-4, -8, -4], size: [8, 8, 8], mirror }] },
    ],
  })
  const faceUv = (model: MobModel, face: number) => {
    const uv = mobGeometry(model, 'entity/test.png').geometry.getAttribute('uv')
    return [0, 2].map((i) => [uv.getX(face * 6 + i) * 64, uv.getY(face * 6 + i) * 32])
  }

  it('takes each face from the box UV layout, front face looking towards -z', () => {
    const { geometry } = mobGeometry(cube(false), 'entity/test.png')
    expect(geometry.getAttribute('position').count).toBe(36)
    // Front: (8, 8) to (16, 16) in the texture, like a skin's face (top left, bottom right).
    expect(faceUv(cube(false), 0)).toEqual([
      [8, 8],
      [16, 16],
    ])
    const z = geometry.getAttribute('position').getZ(0)
    expect(z).toBeCloseTo(-0.25)
    // Right side (seen from the front: on the left) from (0, 8); left side from (16, 8).
    expect(faceUv(cube(false), 2)[0]).toEqual([0, 8])
    expect(faceUv(cube(false), 3)[0]).toEqual([16, 8])
  })

  it('repeats the model for each texture under an overlay, bottom first', () => {
    const { geometry, textures } = mobGeometry(cube(false), 'entity/top.png', ['entity/base.png'])
    expect(textures).toEqual(['entity/base.png', 'entity/top.png'])
    expect(geometry.groups).toEqual([
      { start: 0, count: 36, materialIndex: 0 },
      { start: 36, count: 36, materialIndex: 1 },
    ])
  })

  it('mirrors left limbs: sides swap and every face flips', () => {
    expect(faceUv(cube(true), 0)).toEqual([
      [16, 8],
      [8, 16],
    ])
    expect(faceUv(cube(true), 2)[0]).toEqual([24, 8])
  })
})

describe('camera', () => {
  it('backs off in narrow views so the model still fits', () => {
    expect(cameraDistance(1, 0.5)).toBeGreaterThan(cameraDistance(1, 1))
    expect(cameraDistance(1, 2)).toBe(cameraDistance(1, 1))
    expect(cameraDistance(2, 1)).toBeCloseTo(cameraDistance(1, 1) * 2)
  })
})
