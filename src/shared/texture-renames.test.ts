import { describe, expect, it } from 'vitest'
import { LATEST_VERSION, MINECRAFT_VERSIONS } from './minecraft-versions'
import { RENAME_STEPS, renameEra, translatePackPath, translateTexturePath } from './texture-renames'
import { RENAME_TABLE } from './texture-renames.data'

describe('rename table', () => {
  it('only names known versions, oldest first', () => {
    const ids = MINECRAFT_VERSIONS.map((version) => version.id)
    const positions = RENAME_TABLE.map((step) => ids.indexOf(step.version))
    expect(positions.every((position) => position > 0)).toBe(true)
    expect([...positions].sort((a, b) => a - b)).toEqual(positions)
  })

  it('maps every old name to a different, unique new name', () => {
    for (const step of RENAME_TABLE) {
      const targets = Object.values(step.renames)
      expect(new Set(targets).size, step.version).toBe(targets.length)
      for (const [from, to] of Object.entries(step.renames)) expect(from).not.toBe(to)
    }
  })

  it('covers the 1.13 flattening', () => {
    expect(
      Object.keys(RENAME_TABLE.find((step) => step.version === '1.13')!.renames).length,
    ).toBeGreaterThan(800)
  })
})

describe('translateTexturePath', () => {
  it('renames forwards across several steps', () => {
    expect(translateTexturePath('blocks/planks_oak.png', '1.12.2', '1.21.4')).toBe(
      'block/oak_planks.png',
    )
    expect(translateTexturePath('blocks/grass_path_top.png', '1.12.2', '1.17')).toBe(
      'block/dirt_path_top.png',
    )
    expect(translateTexturePath('blocks/tallgrass.png', '1.12.2', '1.21')).toBe(
      'block/short_grass.png',
    )
    expect(translateTexturePath('items/fish_cooked.png', '1.6.4', '1.21.4')).toBe(
      'item/cooked_cod.png',
    )
  })

  it('renames backwards', () => {
    expect(translateTexturePath('block/oak_planks.png', '1.21.4', '1.8.9')).toBe(
      'blocks/planks_oak.png',
    )
    expect(translateTexturePath('block/dirt_path_top.png', '1.21.4', '1.16.5')).toBe(
      'block/grass_path_top.png',
    )
    expect(translateTexturePath('item/cooked_cod.png', '1.21.4', '1.6.1')).toBe(
      'items/fish_cooked.png',
    )
  })

  it('leaves names alone within an era and for unknown textures', () => {
    expect(translateTexturePath('block/stone.png', '1.20.1', '1.20.1')).toBe('block/stone.png')
    expect(translateTexturePath('block/stone.png', '1.13', '1.21.4')).toBe('block/stone.png')
    expect(translateTexturePath('custom/logo.png', '1.21.4', '1.8.9')).toBe('custom/logo.png')
  })

  it('round-trips every renamed texture through the newest version and back', () => {
    const ids = MINECRAFT_VERSIONS.map((version) => version.id)
    for (const step of RENAME_STEPS) {
      const before = ids[step.index - 1]
      for (const path of step.forward.keys()) {
        const latest = translateTexturePath(path, before, LATEST_VERSION.id)
        expect(translateTexturePath(latest, LATEST_VERSION.id, before), path).toBe(path)
      }
    }
  })
})

describe('translatePackPath', () => {
  it('moves a texture together with its animation file', () => {
    const png = 'assets/minecraft/textures/block/water_still.png'
    expect(translatePackPath(png, '1.21.4', '1.12.2')).toBe(
      'assets/minecraft/textures/blocks/water_still.png',
    )
    expect(translatePackPath(`${png}.mcmeta`, '1.21.4', '1.12.2')).toBe(
      'assets/minecraft/textures/blocks/water_still.png.mcmeta',
    )
  })

  it('leaves files outside the textures folder alone', () => {
    expect(translatePackPath('pack.png', '1.21.4', '1.8.9')).toBe('pack.png')
    expect(
      translatePackPath('assets/minecraft/models/block/oak_planks.json', '1.21.4', '1.8.9'),
    ).toBe('assets/minecraft/models/block/oak_planks.json')
  })
})

describe('renameEra', () => {
  it('counts the rename steps up to a version', () => {
    expect(renameEra('1.6.4')).toBe(0)
    expect(renameEra('1.7.2')).toBe(1)
    expect(renameEra('1.12.2')).toBe(1)
    expect(renameEra('1.13')).toBe(2)
    expect(renameEra(LATEST_VERSION.id)).toBe(RENAME_STEPS.length)
  })
})
