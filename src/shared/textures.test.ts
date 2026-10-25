import { describe, expect, it } from 'vitest'
import {
  buildTextureRows,
  categoryFor,
  classifyColour,
  DEFAULT_TEXTURE_FILTERS,
  displayName,
  filterTextureEntries,
  filterTextureRows,
  isTexturePath,
  textureEntries,
  textureName,
  wikiUrl,
  type VanillaTexture,
} from './textures'

const texture = (path: string, colour: VanillaTexture['colour'] = null): VanillaTexture => ({
  path,
  width: 16,
  height: 16,
  animated: false,
  colour,
})

describe('isTexturePath', () => {
  it('accepts normal texture paths', () => {
    expect(isTexturePath('block/stone.png')).toBe(true)
    expect(isTexturePath('entity/chest/normal.png')).toBe(true)
  })

  it.each(['../pack.png', 'block/../../x.png', '/etc/x.png', 'block\\stone.png', 'block//a.png'])(
    'rejects %s',
    (path) => {
      expect(isTexturePath(path)).toBe(false)
    },
  )

  it('only accepts PNGs', () => {
    expect(isTexturePath('block/stone.png.mcmeta')).toBe(false)
    expect(isTexturePath('')).toBe(false)
  })
})

describe('names and categories', () => {
  it('derives categories from the folder, old and new layouts alike', () => {
    expect(categoryFor('block/stone.png')).toBe('blocks')
    expect(categoryFor('blocks/stone.png')).toBe('blocks')
    expect(categoryFor('items/diamond_sword.png')).toBe('items')
    expect(categoryFor('entity/creeper/creeper.png')).toBe('entities')
    expect(categoryFor('models/armor/iron_layer_1.png')).toBe('armor')
    expect(categoryFor('something/new.png')).toBe('other')
  })

  it('turns file names into readable names', () => {
    expect(textureName('block/oak_planks.png')).toBe('oak_planks')
    expect(displayName('oak_planks')).toBe('Oak Planks')
  })

  it('links to the Minecraft Wiki', () => {
    expect(wikiUrl('oak_planks')).toBe('https://minecraft.wiki/w/Oak_Planks')
  })
})

describe('classifyColour', () => {
  it.each([
    [200, 30, 30, 'red'],
    [230, 120, 20, 'orange'],
    [230, 210, 40, 'yellow'],
    [60, 170, 50, 'green'],
    [60, 210, 200, 'aqua'],
    [40, 70, 200, 'blue'],
    [130, 60, 200, 'purple'],
    [230, 110, 190, 'pink'],
    [110, 75, 45, 'brown'],
    [240, 240, 240, 'white'],
    [128, 128, 128, 'grey'],
    [15, 15, 20, 'black'],
  ] as const)('sorts rgb(%i, %i, %i) into %s', (r, g, b, expected) => {
    expect(classifyColour(r, g, b)).toBe(expected)
  })
})

describe('buildTextureRows', () => {
  it('marks vanilla textures the pack replaces and lists textures only the pack has', () => {
    const rows = buildTextureRows(
      [texture('block/stone.png'), texture('block/dirt.png')],
      [
        'pack.mcmeta',
        'assets/minecraft/textures/block/stone.png',
        'assets/minecraft/textures/block/stone.png.mcmeta',
        'assets/minecraft/textures/custom/logo.png',
      ],
    )
    expect(rows.map(({ path, changed, added }) => ({ path, changed, added }))).toEqual([
      { path: 'block/stone.png', changed: true, added: false },
      { path: 'block/dirt.png', changed: false, added: false },
      { path: 'custom/logo.png', changed: false, added: true },
    ])
  })
})

describe('filterTextureRows', () => {
  const rows = buildTextureRows(
    [
      texture('block/red_wool.png', 'red'),
      texture('block/stone.png', 'grey'),
      texture('item/diamond_sword.png', 'aqua'),
    ],
    ['assets/minecraft/textures/block/stone.png'],
  )
  const names = (filters: Partial<typeof DEFAULT_TEXTURE_FILTERS>) =>
    filterTextureRows(rows, { ...DEFAULT_TEXTURE_FILTERS, ...filters }).map((row) => row.name)

  it('searches every word in the path, ignoring case and underscores', () => {
    expect(names({ query: 'WOOL' })).toEqual(['red_wool'])
    expect(names({ query: 'diamond sword' })).toEqual(['diamond_sword'])
    expect(names({ query: 'block' })).toEqual(['red_wool', 'stone'])
  })

  it('filters by category, colour and changed state', () => {
    expect(names({ category: 'items' })).toEqual(['diamond_sword'])
    expect(names({ colour: 'red' })).toEqual(['red_wool'])
    expect(names({ changedOnly: true })).toEqual(['stone'])
  })
})

describe('textureEntries', () => {
  const blocks = [
    {
      id: 'grass_block',
      textures: ['block/grass_block_side.png', 'block/grass_block_top.png'],
      has3d: true,
    },
  ]
  const rows = buildTextureRows(
    [
      texture('block/grass_block_side.png', 'green'),
      texture('block/grass_block_top.png', 'grey'),
      texture('block/stone.png', 'grey'),
    ],
    ['assets/minecraft/textures/block/grass_block_top.png'],
    blocks,
  )

  it('shows the textures of a block as one entry', () => {
    const entries = textureEntries(rows, blocks, true)
    expect(entries.map((entry) => [entry.key, entry.name, entry.rows.length])).toEqual([
      ['block:grass_block', 'Grass Block', 2],
      ['block/stone.png', 'Stone', 1],
    ])
    expect(rows[1].block).toBe('grass_block')
    expect(textureEntries(rows, blocks, false)).toHaveLength(3)
  })

  it('keeps a block when any of its textures or its name matches', () => {
    const entries = textureEntries(rows, blocks, true)
    const keys = (filters: Partial<typeof DEFAULT_TEXTURE_FILTERS>) =>
      filterTextureEntries(entries, { ...DEFAULT_TEXTURE_FILTERS, ...filters }).map(
        (entry) => entry.key,
      )
    expect(keys({ changedOnly: true })).toEqual(['block:grass_block'])
    expect(keys({ colour: 'green' })).toEqual(['block:grass_block'])
    expect(keys({ query: 'grass block' })).toEqual(['block:grass_block'])
    expect(keys({ query: 'top' })).toEqual(['block:grass_block'])
    expect(keys({ colour: 'grey' })).toEqual(['block:grass_block', 'block/stone.png'])
  })
})
