import { describe, expect, it } from 'vitest'
import type { BlockModel, ModelFace } from '../../../shared/block-models'
import { createBitmap, setPixel } from '../editor/pixels'
import { cameraDistance } from './camera'
import { alphaMask, blockGeometry, itemGeometry, tintColour } from './geometry'

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

describe('camera', () => {
  it('backs off in narrow views so the model still fits', () => {
    expect(cameraDistance('block', 0.5)).toBeGreaterThan(cameraDistance('block', 1))
    expect(cameraDistance('block', 2)).toBe(cameraDistance('block', 1))
  })
})
