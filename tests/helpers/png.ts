// Tiny PNG encoder and fake client JAR for tests (Node only).

import { zipSync } from 'fflate'
import { deflateSync } from 'node:zlib'

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc ^= byte
    for (let k = 0; k < 8; k++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1
  }
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type: string, data: Uint8Array): Buffer {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

export type Rgba = readonly [number, number, number, number]

/** A width×height RGBA PNG; `pixel` decides the colour of each pixel. */
export function makePng(
  width: number,
  height: number,
  pixel: (x: number, y: number) => Rgba,
): Buffer {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8 // bit depth
  header[9] = 6 // RGBA
  const raw = Buffer.alloc(height * (1 + width * 4))
  for (let y = 0; y < height; y++) {
    const row = y * (1 + width * 4)
    for (let x = 0; x < width; x++) raw.set(pixel(x, y), row + 1 + x * 4)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', new Uint8Array(0)),
  ])
}

export const solidPng = (width: number, height: number, rgba: Rgba): Buffer =>
  makePng(width, height, () => rgba)

export const WATER_MCMETA = '{\n  "animation": {\n    "frametime": 2\n  }\n}\n'

/** A miniature Minecraft client JAR with a handful of textures. */
const json = (value: unknown): Buffer => Buffer.from(JSON.stringify(value))

const cubeAll = (texture: string) => json({ parent: 'block/cube_all', textures: { all: texture } })

/** Block models like Minecraft's own (trimmed), for the grass block, stone, dirt and red wool. */
function blockModels(): Record<string, Uint8Array> {
  const faces = Object.fromEntries(
    ['down', 'up', 'north', 'south', 'west', 'east'].map((face) => [
      face,
      { texture: `#${face}`, cullface: face },
    ]),
  )
  const side = (texture: string, tint: boolean) =>
    Object.fromEntries(
      ['north', 'south', 'west', 'east'].map((face) => [
        face,
        { uv: [0, 0, 16, 16], texture, ...(tint ? { tintindex: 0 } : {}), cullface: face },
      ]),
    )
  const models = 'assets/minecraft/models/block/'
  const states = 'assets/minecraft/blockstates/'
  const simple = (model: string) =>
    json({ variants: { '': { model: `minecraft:block/${model}` } } })
  return {
    [`${models}block.json`]: json({}),
    [`${models}cube.json`]: json({
      parent: 'block/block',
      elements: [{ from: [0, 0, 0], to: [16, 16, 16], faces }],
    }),
    [`${models}cube_all.json`]: json({
      parent: 'block/cube',
      textures: Object.fromEntries(
        ['particle', 'down', 'up', 'north', 'south', 'west', 'east'].map((face) => [face, '#all']),
      ),
    }),
    [`${models}stone.json`]: cubeAll('minecraft:block/stone'),
    [`${models}dirt.json`]: cubeAll('minecraft:block/dirt'),
    [`${models}red_wool.json`]: cubeAll('minecraft:block/red_wool'),
    [`${models}grass_block.json`]: json({
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
            down: { uv: [0, 0, 16, 16], texture: '#bottom', cullface: 'down' },
            up: { uv: [0, 0, 16, 16], texture: '#top', cullface: 'up', tintindex: 0 },
            ...side('#side', false),
          },
        },
        { from: [0, 0, 0], to: [16, 16, 16], faces: side('#overlay', true) },
      ],
    }),
    [`${states}stone.json`]: simple('stone'),
    [`${states}dirt.json`]: simple('dirt'),
    [`${states}red_wool.json`]: simple('red_wool'),
    [`${states}grass_block.json`]: json({
      variants: { 'snowy=false': { model: 'minecraft:block/grass_block' } },
    }),
  }
}

export interface FakeJarOptions {
  /** Adds block models and the grass block's and dirt's textures (Minecraft 1.8+ style). */
  models?: boolean
}

export function makeClientJar({ models = false }: FakeJarOptions = {}): Uint8Array {
  const textures = 'assets/minecraft/textures/'
  const withModels: Record<string, Uint8Array> = models
    ? {
        ...blockModels(),
        [`${textures}block/dirt.png`]: solidPng(16, 16, [134, 96, 67, 255]),
        [`${textures}block/grass_block_top.png`]: solidPng(16, 16, [150, 150, 150, 255]),
        [`${textures}block/grass_block_side.png`]: solidPng(16, 16, [134, 96, 67, 255]),
        // A creeper in Minecraft's 64×32 layout: a green body and a dark face.
        [`${textures}entity/creeper/creeper.png`]: makePng(64, 32, (x, y) =>
          x >= 8 && x < 16 && y >= 8 && y < 16 ? [20, 40, 20, 255] : [70, 170, 60, 255],
        ),
        // Only the top rows are grass; the rest lets the side show through.
        [`${textures}block/grass_block_side_overlay.png`]: makePng(16, 16, (_x, y) =>
          y < 3 ? [150, 150, 150, 255] : [0, 0, 0, 0],
        ),
      }
    : {}
  return zipSync({
    ...withModels,
    [`${textures}block/stone.png`]: solidPng(16, 16, [128, 128, 128, 255]),
    [`${textures}block/red_wool.png`]: solidPng(16, 16, [200, 30, 30, 255]),
    [`${textures}block/water_still.png`]: solidPng(16, 48, [40, 70, 200, 255]),
    [`${textures}block/water_still.png.mcmeta`]: Buffer.from(WATER_MCMETA),
    [`${textures}item/diamond_sword.png`]: makePng(16, 16, (x, y) =>
      x === y ? [60, 220, 210, 255] : [0, 0, 0, 0],
    ),
    [`${textures}gui/widgets.png`]: solidPng(32, 32, [90, 90, 90, 255]),
    'assets/minecraft/lang/en_us.json': Buffer.from('{}'),
    'net/minecraft/client/Main.class': Buffer.from([0xca, 0xfe, 0xba, 0xbe]),
  })
}
