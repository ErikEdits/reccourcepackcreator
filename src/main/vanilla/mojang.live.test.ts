// Talks to Mojang's real servers. Runs only with RPC_LIVE_TESTS=1 (set in CI).

import { describe, expect, it } from 'vitest'
import { blockModel, groupTexturesByBlock } from '../../shared/block-models'
import { downloadClientJar } from './mojang'
import { extractModels, extractTextures } from './texture-index'

describe.skipIf(!process.env.RPC_LIVE_TESTS)("Mojang's servers", () => {
  it('serve a verified client JAR with the expected textures', { timeout: 180_000 }, async () => {
    const jar = await downloadClientJar('1.21.4', (url) => fetch(url))
    const files = extractTextures(jar)
    expect(files.has('block/stone.png')).toBe(true)
    expect(files.has('block/water_still.png.mcmeta')).toBe(true)
    expect([...files.keys()].filter((path) => path.endsWith('.png')).length).toBeGreaterThan(1000)

    // Real block models: the grass block's textures are grouped, stairs have their boxes.
    const { models, blockstates } = extractModels(jar)
    const lookup = (name: string): unknown => models.get(name)
    const blocks = groupTexturesByBlock(blockstates, lookup, new Set(files.keys()))
    expect(blocks.find((block) => block.id === 'grass_block')?.textures).toEqual(
      expect.arrayContaining([
        'block/grass_block_side.png',
        'block/grass_block_top.png',
        'block/grass_block_side_overlay.png',
      ]),
    )
    expect(blocks.filter((block) => block.textures.length > 1).length).toBeGreaterThan(150)
    const stairs = blockModel('oak_stairs', blockstates.get('oak_stairs'), lookup)
    expect(stairs?.parts[0].elements.length).toBe(2)
  })
})
