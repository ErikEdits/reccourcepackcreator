import { createHash } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeClientJar, solidPng, WATER_MCMETA } from '../../../tests/helpers/png'
import { PackError } from '../pack-io'
import {
  cachedClientJarPath,
  defaultMinecraftDir,
  localClientJarPath,
  resolveClientJar,
} from './client-jar'
import { downloadClientJar, VERSION_MANIFEST_URL, type Fetcher } from './mojang'
import { averageColour, extractTextures, indexTextures, type ImageDecoder } from './texture-index'

const sha1 = (bytes: Uint8Array | string): string => createHash('sha1').update(bytes).digest('hex')

let root: string

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'rpc-vanilla-'))
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('defaultMinecraftDir', () => {
  it('follows the launcher locations', () => {
    expect(defaultMinecraftDir('win32', '/AppData/Roaming', '/home')).toBe(
      join('/AppData/Roaming', '.minecraft'),
    )
    expect(defaultMinecraftDir('linux', '/cfg', '/home/steve')).toBe('/home/steve/.minecraft')
  })
})

/** A fake Mojang: a manifest, one version file and one JAR. */
function fakeMojang(jar: Uint8Array, overrides: { jarSha1?: string; versionSha1?: string } = {}) {
  const versionJson = JSON.stringify({
    downloads: {
      client: {
        url: 'https://piston-data.mojang.com/v1/objects/abc/client.jar',
        sha1: overrides.jarSha1 ?? sha1(jar),
        size: jar.byteLength,
      },
    },
  })
  const manifest = JSON.stringify({
    versions: [
      {
        id: '1.21.4',
        url: 'https://piston-meta.mojang.com/v1/packages/def/1.21.4.json',
        sha1: overrides.versionSha1 ?? sha1(versionJson),
      },
    ],
  })
  const bodies: Record<string, string | Uint8Array<ArrayBuffer>> = {
    [VERSION_MANIFEST_URL]: manifest,
    'https://piston-meta.mojang.com/v1/packages/def/1.21.4.json': versionJson,
    'https://piston-data.mojang.com/v1/objects/abc/client.jar': jar as Uint8Array<ArrayBuffer>,
  }
  const fetcher: Fetcher = vi.fn(async (url: string) =>
    url in bodies ? new Response(bodies[url]) : new Response(null, { status: 404 }),
  )
  return fetcher
}

describe('downloadClientJar', () => {
  it('downloads the JAR after checking every checksum, reporting progress', async () => {
    const jar = makeClientJar()
    const progress = vi.fn()
    const bytes = await downloadClientJar('1.21.4', fakeMojang(jar), progress)
    expect(sha1(bytes)).toBe(sha1(jar))
    expect(progress).toHaveBeenLastCalledWith(jar.byteLength, jar.byteLength)
  })

  it('rejects a damaged download', async () => {
    const fetcher = fakeMojang(makeClientJar(), { jarSha1: '0'.repeat(40) })
    await expect(downloadClientJar('1.21.4', fetcher)).rejects.toThrow(/damaged/)
  })

  it('rejects tampered version data', async () => {
    const fetcher = fakeMojang(makeClientJar(), { versionSha1: '0'.repeat(40) })
    await expect(downloadClientJar('1.21.4', fetcher)).rejects.toThrow(/checksum/)
  })

  it('explains unknown versions and network failures', async () => {
    await expect(downloadClientJar('9.9', fakeMojang(makeClientJar()))).rejects.toThrow(
      'Mojang does not offer Minecraft 9.9',
    )
    const offline: Fetcher = async () => {
      throw new TypeError('fetch failed')
    }
    await expect(downloadClientJar('1.21.4', offline)).rejects.toThrow(PackError)
  })
})

describe('resolveClientJar', () => {
  const options = () => ({
    version: '1.21.4',
    minecraftDir: join(root, '.minecraft'),
    cacheDir: join(root, 'cache'),
    download: vi.fn(async () => makeClientJar()),
  })

  it('prefers the local Minecraft installation', async () => {
    const opts = options()
    const local = localClientJarPath(opts.minecraftDir, '1.21.4')
    await mkdir(join(opts.minecraftDir, 'versions', '1.21.4'), { recursive: true })
    await writeFile(local, makeClientJar())
    expect((await resolveClientJar(opts)).source).toBe('local')
    expect(opts.download).not.toHaveBeenCalled()
  })

  it('downloads once and then uses the cache', async () => {
    const opts = options()
    expect((await resolveClientJar(opts)).source).toBe('download')
    expect(await readFile(cachedClientJarPath(opts.cacheDir, '1.21.4'))).toBeTruthy()
    expect((await resolveClientJar(opts)).source).toBe('cache')
    expect(opts.download).toHaveBeenCalledOnce()
  })
})

describe('texture index', () => {
  it('extracts only textures and their .mcmeta files', () => {
    const files = extractTextures(makeClientJar())
    expect([...files.keys()].sort()).toEqual([
      'block/red_wool.png',
      'block/stone.png',
      'block/water_still.png',
      'block/water_still.png.mcmeta',
      'gui/widgets.png',
      'item/diamond_sword.png',
    ])
    expect(new TextDecoder().decode(files.get('block/water_still.png.mcmeta'))).toBe(WATER_MCMETA)
  })

  it('describes each texture', () => {
    const files = new Map<string, Uint8Array>([
      ['block/water_still.png', solidPng(16, 48, [40, 70, 200, 255])],
      ['block/water_still.png.mcmeta', new TextEncoder().encode(WATER_MCMETA)],
      ['block/broken.png', new Uint8Array([1, 2, 3])],
    ])
    const decode: ImageDecoder = (png) =>
      png.length > 3 ? { width: 16, height: 48, rgba: new Uint8Array([40, 70, 200, 255]) } : null
    expect(indexTextures(files, decode)).toEqual([
      { path: 'block/broken.png', width: 0, height: 0, animated: false, colour: null },
      { path: 'block/water_still.png', width: 16, height: 48, animated: true, colour: 'blue' },
    ])
  })

  it('averages only mostly opaque pixels', () => {
    const rgba = new Uint8Array([200, 30, 30, 255, 0, 0, 255, 10, 0, 255, 0, 0])
    expect(averageColour({ width: 3, height: 1, rgba })).toBe('red')
    expect(averageColour({ width: 1, height: 1, rgba: new Uint8Array([9, 9, 9, 0]) })).toBeNull()
  })
})
