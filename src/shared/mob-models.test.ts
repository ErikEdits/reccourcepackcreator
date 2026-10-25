import { describe, expect, it } from 'vitest'
import { mobModelFor, type MobModel, type MobPart } from './mob-models'

const PATHS = [
  'entity/zombie/zombie.png',
  'entity/zombie/husk.png',
  'entity/zombie/drowned.png',
  'entity/player/wide/steve.png',
  'entity/player/slim/alex.png',
  'entity/skeleton/skeleton.png',
  'entity/creeper/creeper.png',
  'entity/cow/cow.png',
  'entity/pig/pig.png',
  'entity/sheep/sheep.png',
  'entity/sheep/sheep_fur.png',
  'entity/chicken.png',
  'entity/spider/spider.png',
  'entity/enderman/enderman.png',
  'entity/slime/slime.png',
  'entity/wolf/wolf_tame.png',
  'entity/iron_golem/iron_golem.png',
]

/** The model as Minecraft 1.21.4's own texture sizes would find it. */
function vanillaModel(path: string): MobModel {
  for (const [width, height] of [
    [64, 32],
    [64, 64],
    [128, 128],
  ]) {
    const model = mobModelFor(path, width, height)
    if (model) return model
  }
  throw new Error(`No model for ${path}`)
}

function allParts(parts: readonly MobPart[]): MobPart[] {
  return parts.flatMap((part) => [part, ...allParts(part.children ?? [])])
}

describe('mob models', () => {
  it('finds the model for a texture by its path and shape', () => {
    expect(mobModelFor('entity/zombie/zombie.png', 64, 64)?.id).toBe('zombie')
    expect(mobModelFor('entity/steve.png', 64, 32)?.id).toBe('humanoid_legacy')
    expect(mobModelFor('entity/steve.png', 64, 64)?.id).toBe('player_wide')
    // A 32× pack keeps the layout.
    expect(mobModelFor('entity/cow/cow.png', 128, 64)?.id).toBe('cow')
    // Minecraft 1.21.5 redrew the cow on a 64×64 layout: not this model.
    expect(mobModelFor('entity/cow/cow.png', 64, 64)).toBeNull()
    expect(mobModelFor('entity/unknown/thing.png', 64, 32)).toBeNull()
  })

  it.each(PATHS)('keeps every box of %s inside its texture', (path) => {
    const model = vanillaModel(path)
    const [width, height] = model.textureSize
    for (const part of allParts(model.parts)) {
      for (const cube of part.cubes) {
        const [u, v] = cube.uv
        const [w, h, d] = cube.size
        // Box UV: two rows, d+w+d+w wide; the top row d high, the sides h high.
        expect(u + 2 * (d + w)).toBeLessThanOrEqual(width)
        expect(v + d + h).toBeLessThanOrEqual(height)
      }
    }
  })
})
