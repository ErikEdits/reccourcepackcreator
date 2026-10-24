// Loads and keeps the vanilla textures of the open pack's Minecraft version.

import { app, nativeImage, net } from 'electron'
import { readdir, rm, stat } from 'node:fs/promises'
import { join } from 'node:path'
import type { MinecraftFilesInfo } from '../../shared/api'
import { isAllowedNetworkUrl } from '../../shared/network-policy'
import type { TextureIndex } from '../../shared/textures'
import { defaultMinecraftDir, resolveClientJar } from './client-jar'
import { downloadClientJar, type ProgressListener } from './mojang'
import { extractTextures, indexTextures, type ImageDecoder } from './texture-index'

interface LoadedVersion {
  index: TextureIndex
  files: Map<string, Uint8Array>
}

/** At most this many versions stay in memory (switching packs back and forth stays fast). */
const KEEP_VERSIONS = 2
const loaded = new Map<string, Promise<LoadedVersion>>()

export function minecraftDir(): string {
  return defaultMinecraftDir(process.platform, app.getPath('appData'), app.getPath('home'))
}

function cacheDir(): string {
  return join(app.getPath('userData'), 'minecraft-cache')
}

/** All main-process downloads go through the network allow-list (docs/DECISIONS.md #130). */
function guardedFetch(url: string): Promise<Response> {
  if (!isAllowedNetworkUrl(url)) return Promise.reject(new Error(`Blocked request to ${url}`))
  return net.fetch(url)
}

// 1×1 opaque red PNG, used to learn the byte order of nativeImage bitmaps on this platform.
const RED_PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==',
  'base64',
)
let redFirst: boolean | null = null

const decodeWithNativeImage: ImageDecoder = (png) => {
  const image = nativeImage.createFromBuffer(Buffer.from(png))
  if (image.isEmpty()) return null
  redFirst ??= nativeImage.createFromBuffer(RED_PIXEL).toBitmap()[0] === 255

  const { width, height } = image.getSize()
  const bitmap = image.toBitmap()
  const rgba = new Uint8Array(width * height * 4)
  for (let i = 0; i < rgba.length; i += 4) {
    const alpha = bitmap[i + 3]
    // The bitmap is premultiplied; undo that so colours of soft edges are not darkened.
    const scale = alpha === 0 || alpha === 255 ? 1 : 255 / alpha
    const [r, b] = redFirst ? [bitmap[i], bitmap[i + 2]] : [bitmap[i + 2], bitmap[i]]
    rgba[i] = Math.min(255, Math.round(r * scale))
    rgba[i + 1] = Math.min(255, Math.round(bitmap[i + 1] * scale))
    rgba[i + 2] = Math.min(255, Math.round(b * scale))
    rgba[i + 3] = alpha
  }
  return { width, height, rgba }
}

async function load(version: string, onProgress?: ProgressListener): Promise<LoadedVersion> {
  const jar = await resolveClientJar({
    version,
    minecraftDir: minecraftDir(),
    cacheDir: cacheDir(),
    download: (id, progress) => downloadClientJar(id, guardedFetch, progress),
    onProgress,
  })
  const files = extractTextures(jar.bytes)
  return {
    index: { version, source: jar.source, textures: indexTextures(files, decodeWithNativeImage) },
    files,
  }
}

/** Loads a version once; concurrent and repeated calls share the result. Failures can be retried. */
export async function loadVanilla(
  version: string,
  onProgress?: ProgressListener,
): Promise<TextureIndex> {
  let pending = loaded.get(version)
  if (!pending) {
    pending = load(version, onProgress)
    loaded.set(version, pending)
    pending.catch(() => loaded.delete(version))
  }
  const result = await pending
  // Forget the least recently used versions.
  loaded.delete(version)
  loaded.set(version, pending)
  for (const key of [...loaded.keys()].slice(0, Math.max(0, loaded.size - KEEP_VERSIONS))) {
    loaded.delete(key)
  }
  return result.index
}

/** A loaded vanilla texture (or its .mcmeta), if that version has finished loading. */
export async function vanillaFile(version: string, path: string): Promise<Uint8Array | null> {
  const pending = loaded.get(version)
  if (!pending) return null
  try {
    return (await pending).files.get(path) ?? null
  } catch {
    return null
  }
}

async function folderSize(dir: string): Promise<number> {
  try {
    const entries = await readdir(dir, { recursive: true, withFileTypes: true })
    const sizes = await Promise.all(
      entries
        .filter((entry) => entry.isFile())
        .map(async (entry) => (await stat(join(entry.parentPath, entry.name))).size),
    )
    return sizes.reduce((sum, size) => sum + size, 0)
  } catch {
    return 0
  }
}

export async function minecraftFilesInfo(): Promise<MinecraftFilesInfo> {
  const dir = minecraftDir()
  const found = await stat(join(dir, 'versions')).then(
    (info) => info.isDirectory(),
    () => false,
  )
  return { minecraftDir: dir, found, cacheBytes: await folderSize(cacheDir()) }
}

export async function clearDownloadCache(): Promise<void> {
  await rm(cacheDir(), { recursive: true, force: true })
}
