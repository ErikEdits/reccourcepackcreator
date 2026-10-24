// Talks to Mojang's real servers. Runs only with RPC_LIVE_TESTS=1 (set in CI).

import { describe, expect, it } from 'vitest'
import { downloadClientJar } from './mojang'
import { extractTextures } from './texture-index'

describe.skipIf(!process.env.RPC_LIVE_TESTS)("Mojang's servers", () => {
  it('serve a verified client JAR with the expected textures', { timeout: 180_000 }, async () => {
    const jar = await downloadClientJar('1.21.4', (url) => fetch(url))
    const files = extractTextures(jar)
    expect(files.has('block/stone.png')).toBe(true)
    expect(files.has('block/water_still.png.mcmeta')).toBe(true)
    expect([...files.keys()].filter((path) => path.endsWith('.png')).length).toBeGreaterThan(1000)
  })
})
