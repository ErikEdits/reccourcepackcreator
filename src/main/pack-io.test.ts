import { strToU8, unzipSync, zipSync } from 'fflate'
import { mkdtempSync, rmSync } from 'node:fs'
import { mkdir, readFile, readdir, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { NewPackRequest } from '../shared/project'
import {
  collectPackFiles,
  createPackFolder,
  exportPack,
  PackError,
  pngSize,
  readPack,
  removePackTexture,
  renameForVersion,
  writePackTexture,
} from './pack-io'
import { isInside } from './paths'

// Smallest valid 1×1 PNG.
const PNG = Uint8Array.from(
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64',
  ),
)

let root: string

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'rpc-test-'))
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

function request(overrides: Partial<NewPackRequest> = {}): NewPackRequest {
  return {
    name: 'Test Pack',
    description: '§aGreen',
    minecraftVersion: '1.21.4',
    resolution: 16,
    license: 'CC-BY-4.0',
    parentDir: root,
    icon: PNG,
    ...overrides,
  }
}

describe('pngSize', () => {
  it('reads the dimensions and rejects other data', () => {
    expect(pngSize(PNG)).toEqual({ width: 1, height: 1 })
    expect(pngSize(strToU8('GIF89a not a png at all'))).toBeNull()
  })
})

describe('createPackFolder', () => {
  it('writes pack.mcmeta, pack.png and the project file', async () => {
    const dir = await createPackFolder(request())
    expect(dir).toBe(join(root, 'Test Pack'))
    expect(JSON.parse(await readFile(join(dir, 'pack.mcmeta'), 'utf8'))).toEqual({
      pack: { pack_format: 46, description: '§aGreen' },
    })
    expect(new Uint8Array(await readFile(join(dir, 'pack.png')))).toEqual(PNG)
    const project = JSON.parse(await readFile(join(dir, '.rpc', 'project.json'), 'utf8'))
    expect(project).toMatchObject({ name: 'Test Pack', packVersion: '1.0.0', license: 'CC-BY-4.0' })
  })

  it('never overwrites an existing folder', async () => {
    await mkdir(join(root, 'Test Pack'))
    await expect(createPackFolder(request())).rejects.toThrow(PackError)
  })

  it('rejects icons that are not PNGs', async () => {
    await expect(createPackFolder(request({ icon: strToU8('nope') }))).rejects.toThrow(PackError)
  })
})

describe('readPack', () => {
  it('reads a pack created by the app', async () => {
    const summary = await readPack(await createPackFolder(request()))
    expect(summary.project.name).toBe('Test Pack')
    expect(summary.files).toEqual(['pack.mcmeta', 'pack.png'])
    expect(summary.warnings).toEqual([])
  })

  it('derives settings for packs made elsewhere', async () => {
    const dir = join(root, 'Foreign')
    await mkdir(dir)
    await writeFile(join(dir, 'pack.mcmeta'), '{"pack":{"pack_format":15,"description":"Old"}}')
    const summary = await readPack(dir)
    expect(summary.project).toMatchObject({
      name: 'Foreign',
      description: 'Old',
      minecraftVersion: '1.20.1',
    })
    expect(summary.warnings).toEqual(['The pack has no icon (pack.png).'])
  })

  it('explains folders that are not packs', async () => {
    await expect(readPack(root)).rejects.toThrow('no pack.mcmeta')
  })
})

describe('collectPackFiles', () => {
  it('skips the .rpc folder, junk files and symlinks', async () => {
    const dir = await createPackFolder(request())
    await mkdir(join(dir, 'assets', 'minecraft', 'textures', 'block'), { recursive: true })
    await writeFile(join(dir, 'assets', 'minecraft', 'textures', 'block', 'stone.png'), PNG)
    await writeFile(join(dir, 'Thumbs.db'), 'x')
    await symlink(join(root, 'outside.txt'), join(dir, 'link.txt'))
    expect(await collectPackFiles(dir)).toEqual([
      'assets/minecraft/textures/block/stone.png',
      'pack.mcmeta',
      'pack.png',
    ])
  })
})

describe('exportPack', () => {
  it('writes one ZIP per version with a matching pack.mcmeta', async () => {
    const dir = await createPackFolder(request())
    const out = join(root, 'out')
    const result = await exportPack(
      await readPack(dir),
      {
        versions: ['1.8.9', '26.3'],
        combineSameFormat: false,
        destination: out,
        fileNameTemplate: '{name}_MC{mc}',
      },
      out,
    )
    expect(result.files).toEqual(['Test Pack_MC1.8.9.zip', 'Test Pack_MC26.3.zip'])
    expect((await readdir(out)).sort()).toEqual(result.files)

    const old = unzipSync(await readFile(join(out, 'Test Pack_MC1.8.9.zip')))
    expect(Object.keys(old).sort()).toEqual(['pack.mcmeta', 'pack.png'])
    expect(JSON.parse(Buffer.from(old['pack.mcmeta']).toString()).pack.pack_format).toBe(1)

    const latest = unzipSync(await readFile(join(out, 'Test Pack_MC26.3.zip')))
    expect(JSON.parse(Buffer.from(latest['pack.mcmeta']).toString()).pack).toEqual({
      description: '§aGreen',
      min_format: [97, 1],
      max_format: [97, 1],
    })
  })

  it('refuses templates that would overwrite its own ZIPs', async () => {
    const summary = await readPack(await createPackFolder(request()))
    await expect(
      exportPack(
        summary,
        {
          versions: ['1.20.3', '1.20.4'],
          combineSameFormat: false,
          destination: root,
          fileNameTemplate: 'same',
        },
        root,
      ),
    ).rejects.toThrow(PackError)
  })

  it('round-trips files through fflate', () => {
    const zipped = zipSync({ 'a.txt': strToU8('hi') })
    expect(Buffer.from(unzipSync(zipped)['a.txt']).toString()).toBe('hi')
  })
})

describe('isInside', () => {
  it('accepts the folder itself and anything below it', () => {
    expect(isInside('/a/b', '/a/b')).toBe(true)
    expect(isInside('/a/b', '/a/b/c/d')).toBe(true)
  })

  it('rejects siblings and escapes', () => {
    expect(isInside('/a/b', '/a/bc')).toBe(false)
    expect(isInside('/a/b', '/a/b/../c')).toBe(false)
  })
})

describe('pack textures', () => {
  const stone = (dir: string) => join(dir, 'assets', 'minecraft', 'textures', 'block', 'stone.png')

  it('writes a texture into the right folder and lists it', async () => {
    const dir = await createPackFolder(request())
    await writePackTexture(dir, 'block/stone.png', PNG, null)
    expect(new Uint8Array(await readFile(stone(dir)))).toEqual(PNG)
    expect((await readPack(dir)).files).toContain('assets/minecraft/textures/block/stone.png')
  })

  it('writes, keeps or removes the animation file as asked', async () => {
    const dir = await createPackFolder(request())
    const meta = strToU8('{"animation":{}}')
    await writePackTexture(dir, 'block/stone.png', PNG, meta)
    expect(await readFile(`${stone(dir)}.mcmeta`, 'utf8')).toBe('{"animation":{}}')
    await writePackTexture(dir, 'block/stone.png', PNG, 'keep')
    expect(await readFile(`${stone(dir)}.mcmeta`, 'utf8')).toBe('{"animation":{}}')
    await writePackTexture(dir, 'block/stone.png', PNG, null)
    await expect(readFile(`${stone(dir)}.mcmeta`)).rejects.toThrow()
  })

  it('refuses paths outside the textures folder and non-PNG data', async () => {
    const dir = await createPackFolder(request())
    await expect(writePackTexture(dir, '../../pack.png', PNG, null)).rejects.toThrow(PackError)
    await expect(writePackTexture(dir, 'block/stone.png', strToU8('nope'), null)).rejects.toThrow(
      PackError,
    )
  })

  it('removes a texture together with its animation file', async () => {
    const dir = await createPackFolder(request())
    await writePackTexture(dir, 'block/stone.png', PNG, strToU8('{}'))
    await removePackTexture(dir, 'block/stone.png')
    expect((await readPack(dir)).files).toEqual(['pack.mcmeta', 'pack.png'])
  })
})

describe('exporting for other versions', () => {
  it("renames textures and their animation files to each version's names", async () => {
    const dir = await createPackFolder(request())
    await writePackTexture(dir, 'block/oak_planks.png', PNG, null)
    await writePackTexture(dir, 'block/water_still.png', PNG, strToU8('{"animation":{}}'))
    const out = join(root, 'out')
    const result = await exportPack(
      await readPack(dir),
      {
        versions: ['1.12.2', '1.21.4'],
        combineSameFormat: false,
        destination: out,
        fileNameTemplate: 'MC{mc}',
      },
      out,
    )
    expect(result.renamedFiles).toBe(3)

    const old = unzipSync(await readFile(join(out, 'MC1.12.2.zip')))
    expect(Object.keys(old).sort()).toEqual([
      'assets/minecraft/textures/blocks/planks_oak.png',
      'assets/minecraft/textures/blocks/water_still.png',
      'assets/minecraft/textures/blocks/water_still.png.mcmeta',
      'pack.mcmeta',
      'pack.png',
    ])
    const current = unzipSync(await readFile(join(out, 'MC1.21.4.zip')))
    expect(Object.keys(current)).toContain('assets/minecraft/textures/block/oak_planks.png')
  })

  it('prefers a file that already has the target name', () => {
    const own = strToU8('own')
    const other = strToU8('other')
    const result = renameForVersion(
      {
        'assets/minecraft/textures/block/oak_planks.png': other,
        'assets/minecraft/textures/blocks/planks_oak.png': own,
      },
      '1.21.4',
      '1.12.2',
    )
    expect(result.contents).toEqual({ 'assets/minecraft/textures/blocks/planks_oak.png': own })
    expect(result.renamed).toEqual([])
  })
})
