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
export function makeClientJar(): Uint8Array {
  const textures = 'assets/minecraft/textures/'
  return zipSync({
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
