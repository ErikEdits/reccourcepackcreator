import { describe, expect, it } from 'vitest'
import {
  blockModel,
  blockstateModels,
  defaultUv,
  groupTexturesByBlock,
  modelName,
  resolveModel,
  texturePath,
} from './block-models'

// Trimmed copies of Minecraft's own models.
const MODELS: Record<string, unknown> = {
  'block/block': { textures: { particle: '#all' } },
  'block/cube': {
    parent: 'block/block',
    elements: [
      {
        from: [0, 0, 0],
        to: [16, 16, 16],
        faces: {
          down: { texture: '#down', cullface: 'down' },
          up: { texture: '#up', cullface: 'up' },
          north: { texture: '#north', cullface: 'north' },
          south: { texture: '#south', cullface: 'south' },
          west: { texture: '#west', cullface: 'west' },
          east: { texture: '#east', cullface: 'east' },
        },
      },
    ],
  },
  'block/cube_all': {
    parent: 'block/cube',
    textures: {
      particle: '#all',
      down: '#all',
      up: '#all',
      north: '#all',
      south: '#all',
      west: '#all',
      east: '#all',
    },
  },
  'block/stone': { parent: 'minecraft:block/cube_all', textures: { all: 'minecraft:block/stone' } },
  'block/dirt': { parent: 'block/cube_all', textures: { all: 'block/dirt' } },
  'block/grass_block': {
    parent: 'block/block',
    textures: {
      particle: 'block/dirt',
      bottom: 'block/dirt',
      top: 'block/grass_block_top',
      side: 'block/grass_block_side',
      overlay: 'block/grass_block_side_overlay',
    },
    elements: [
      {
        from: [0, 0, 0],
        to: [16, 16, 16],
        faces: {
          down: { uv: [0, 0, 16, 16], texture: '#bottom' },
          up: { uv: [0, 0, 16, 16], texture: '#top', tintindex: 0 },
          north: { uv: [0, 0, 16, 16], texture: '#side' },
        },
      },
      {
        from: [0, 0, 0],
        to: [16, 16, 16],
        faces: { north: { uv: [0, 0, 16, 16], texture: '#overlay', tintindex: 0 } },
      },
    ],
  },
  'block/grass_block_snow': {
    parent: 'block/cube_all',
    textures: { all: 'block/grass_block_snow' },
  },
  'block/oak_log': {
    parent: 'block/cube',
    textures: {
      down: 'block/oak_log_top',
      up: 'block/oak_log_top',
      north: 'block/oak_log',
      south: 'block/oak_log',
      west: 'block/oak_log',
      east: 'block/oak_log',
    },
  },
  'block/water': { textures: { particle: 'block/water_still' } },
  'block/torch': {
    textures: { torch: 'block/torch' },
    elements: [
      {
        from: [7, 0, 7],
        to: [9, 10, 9],
        rotation: { origin: [8, 0, 8], axis: 'y', angle: 45 },
        shade: false,
        faces: { up: { uv: [7, 6, 9, 8], texture: '#torch', rotation: 90 } },
      },
    ],
  },
}

const BLOCKSTATES = new Map<string, unknown>([
  ['stone', { variants: { '': { model: 'minecraft:block/stone' } } }],
  ['dirt', { variants: { '': [{ model: 'block/dirt' }, { model: 'block/dirt', y: 90 }] } }],
  [
    'grass_block',
    {
      variants: {
        'snowy=false': { model: 'block/grass_block' },
        'snowy=true': { model: 'block/grass_block_snow' },
      },
    },
  ],
  [
    'oak_log',
    {
      variants: {
        'axis=x': { model: 'block/oak_log', x: 90, y: 90 },
        'axis=y': { model: 'block/oak_log' },
      },
    },
  ],
  ['water', { variants: { '': { model: 'block/water' } } }],
  [
    'torch',
    {
      multipart: [
        { apply: { model: 'block/torch' } },
        { when: { lit: 'true' }, apply: { model: 'block/stone' } },
      ],
    },
  ],
])

const lookup = (name: string): unknown => MODELS[name]

describe('block models', () => {
  it('normalises model and texture names of every era', () => {
    expect(modelName('minecraft:block/stone')).toBe('block/stone')
    expect(modelName('stone')).toBe('block/stone')
    expect(texturePath('minecraft:block/stone')).toBe('block/stone.png')
    expect(texturePath('blocks/stone')).toBe('blocks/stone.png')
    expect(texturePath('somemod:block/stone')).toBeNull()
  })

  it('computes the default texture area of each face', () => {
    expect(defaultUv('up', [0, 0, 0], [16, 16, 16])).toEqual([0, 0, 16, 16])
    expect(defaultUv('north', [7, 0, 7], [9, 10, 9])).toEqual([7, 6, 9, 16])
  })

  it('follows parents and texture variables', () => {
    const stone = resolveModel('block/stone', lookup)!
    expect(stone.textures).toEqual(['block/stone.png'])
    expect(stone.elements).toHaveLength(1)
    expect(Object.keys(stone.elements[0].faces)).toHaveLength(6)
    expect(stone.elements[0].faces.north).toEqual({
      uv: [0, 0, 16, 16],
      texture: 'block/stone.png',
      rotation: 0,
      tinted: false,
    })
  })

  it('keeps rotations, tints and shading', () => {
    const grass = resolveModel('block/grass_block', lookup)!
    expect(grass.elements[0].faces.up?.tinted).toBe(true)
    expect(grass.elements[1].faces.north?.texture).toBe('block/grass_block_side_overlay.png')
    const torch = resolveModel('block/torch', lookup)!
    expect(torch.elements[0].rotation).toEqual({
      origin: [8, 0, 8],
      axis: 'y',
      angle: 45,
      rescale: false,
    })
    expect(torch.elements[0].shade).toBe(false)
    expect(torch.elements[0].faces.up?.rotation).toBe(90)
  })

  it('names the texture of models without boxes', () => {
    expect(resolveModel('block/water', lookup)).toEqual({
      elements: [],
      textures: ['block/water_still.png'],
    })
  })

  it('picks the default look of a blockstate', () => {
    // Upright logs, not the first variant (lying along x).
    expect(blockstateModels(BLOCKSTATES.get('oak_log')).shown).toEqual([
      { model: 'block/oak_log', x: 0, y: 0 },
    ])
    expect(
      blockstateModels({
        variants: {
          'facing=east,half=bottom,shape=inner_left': { model: 'block/oak_stairs_inner', y: 270 },
          'facing=north,half=bottom,shape=straight': { model: 'block/oak_stairs', y: 270 },
          'facing=south,half=bottom,shape=straight': { model: 'block/oak_stairs', y: 90 },
          'facing=south,half=top,shape=straight': { model: 'block/oak_stairs', x: 180, y: 90 },
        },
      }).shown,
    ).toEqual([{ model: 'block/oak_stairs', x: 0, y: 90 }])
    expect(blockstateModels(BLOCKSTATES.get('torch'))).toEqual({
      shown: [{ model: 'block/torch', x: 0, y: 0 }],
      all: ['block/torch', 'block/stone'],
    })
    expect(blockModel('water', BLOCKSTATES.get('water'), lookup)?.parts[0].elements[0].to).toEqual([
      16, 14, 16,
    ])
    expect(blockModel('dirt', { variants: {} }, lookup)).toBeNull()
    expect(blockModel('stone', BLOCKSTATES.get('stone'), lookup)?.parts).toHaveLength(1)
  })

  it('groups textures by the block they belong to', () => {
    const existing = new Set(
      [
        'stone',
        'dirt',
        'grass_block_top',
        'grass_block_side',
        'grass_block_side_overlay',
        'grass_block_snow',
        'oak_log',
        'oak_log_top',
        'water_still',
        'torch',
      ].map((name) => `block/${name}.png`),
    )
    const blocks = groupTexturesByBlock(BLOCKSTATES, lookup, existing)
    expect(Object.fromEntries(blocks.map((block) => [block.id, block.textures]))).toEqual({
      dirt: ['block/dirt.png'],
      grass_block: [
        'block/grass_block_side.png',
        'block/grass_block_top.png',
        'block/grass_block_side_overlay.png',
        'block/grass_block_snow.png',
      ],
      oak_log: ['block/oak_log.png', 'block/oak_log_top.png'],
      // stone.png is also used by the torch's lit part, but it is named after the stone.
      stone: ['block/stone.png'],
      torch: ['block/torch.png'],
      water: ['block/water_still.png'],
    })
    expect(blocks.find((block) => block.id === 'water')?.has3d).toBe(true)
    expect(blocks.find((block) => block.id === 'grass_block')?.has3d).toBe(true)
  })
})
