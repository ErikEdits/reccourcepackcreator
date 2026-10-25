// Texture browser backend: loading the vanilla textures, serving images to the UI through the
// rpc-texture:// protocol, and replacing or reverting textures in the open pack.

import { protocol, type WebContents } from 'electron'
import { readFile } from 'node:fs/promises'
import type { BlockModel } from '../shared/block-models'
import { IpcEvent } from '../shared/channels'
import type { ProjectSummary } from '../shared/project'
import {
  isTexturePath,
  TEXTURE_PROTOCOL,
  type TextureIndex,
  type TextureProgress,
} from '../shared/textures'
import { packTextureFile, PackError, pngSize, readLayersFile, writeLayersFile } from './pack-io'
import { currentProject, replaceTexture, revertTexture } from './projects'
import { loadVanilla, vanillaBlockModel, vanillaFile } from './vanilla/vanilla'

/** Must run before the app is ready. */
export function registerTextureScheme(): void {
  protocol.registerSchemesAsPrivileged([
    { scheme: TEXTURE_PROTOCOL, privileges: { standard: true, secure: true } },
  ])
}

async function readPackTexture(path: string): Promise<Uint8Array | null> {
  const project = currentProject()
  if (!project) return null
  try {
    return await readFile(packTextureFile(project.dir, path))
  } catch {
    return null
  }
}

/**
 * Serves rpc-texture://vanilla/<path>?mc=<version> from the loaded game files and
 * rpc-texture://pack/<path> from the open pack. Nothing else is reachable through it.
 */
export function handleTextureProtocol(): void {
  protocol.handle(TEXTURE_PROTOCOL, async (request) => {
    const url = new URL(request.url)
    const path = decodeURIComponent(url.pathname.slice(1))
    let bytes: Uint8Array | null = null
    if (isTexturePath(path) && url.hostname === 'vanilla') {
      bytes = await vanillaFile(url.searchParams.get('mc') ?? '', path)
    } else if (isTexturePath(path) && url.hostname === 'pack') {
      bytes = await readPackTexture(path)
    }
    if (!bytes) return new Response(null, { status: 404 })
    return new Response(bytes as Uint8Array<ArrayBuffer>, {
      headers: { 'content-type': 'image/png', 'cache-control': 'no-store' },
    })
  })
}

function requireProject(): ProjectSummary {
  const project = currentProject()
  if (!project) throw new PackError('No pack is open.')
  return project
}

/** Loads the vanilla textures for the open pack's Minecraft version, reporting download progress. */
export function loadTexturesForCurrentProject(sender: WebContents): Promise<TextureIndex> {
  const version = requireProject().project.minecraftVersion
  let lastSent = 0
  return loadVanilla(version, (received, total) => {
    // At most one update per percent, so the UI is not flooded.
    if (total > 0 && received < total && received - lastSent < total / 100) return
    lastSent = received
    const progress: TextureProgress = { version, received, total }
    if (!sender.isDestroyed()) sender.send(IpcEvent.TexturesProgress, progress)
  })
}

/**
 * Puts a new image in place of a texture. A vertical strip of square frames stays animated:
 * an existing .mcmeta in the pack is kept, otherwise the vanilla one (or a default) is added.
 */
export async function replaceTextureInCurrentProject(
  path: string,
  png: Uint8Array,
  layers: string | null = null,
): Promise<ProjectSummary> {
  const project = requireProject()
  const size = pngSize(png)
  if (!size) throw new PackError('The new texture is not a PNG image.')

  const isStrip = size.height > size.width && size.height % size.width === 0
  let animation: Uint8Array | 'keep' | null = null
  if (isStrip) {
    const hasOwn = project.files.includes(`assets/minecraft/textures/${path}.mcmeta`)
    animation = hasOwn
      ? 'keep'
      : ((await vanillaFile(project.project.minecraftVersion, `${path}.mcmeta`)) ??
        new TextEncoder().encode('{\n  "animation": {}\n}\n'))
  }
  // Layers first: if they are invalid, nothing is written.
  await writeLayersFile(project.dir, path, layers)
  return replaceTexture(path, png, animation)
}

export function revertTextureInCurrentProject(path: string): Promise<ProjectSummary> {
  return revertTexture(path)
}

/** PNG bytes of a vanilla texture (the open pack's version) or of the pack's own version. */
export async function readTextureImage(
  source: 'vanilla' | 'pack',
  path: string,
): Promise<Uint8Array | null> {
  const project = requireProject()
  return source === 'vanilla'
    ? vanillaFile(project.project.minecraftVersion, path)
    : readPackTexture(path)
}

/** The 3D model of a block of the open pack's Minecraft version. */
export function readBlockModel(id: string): Promise<BlockModel | null> {
  return vanillaBlockModel(requireProject().project.minecraftVersion, id)
}

/** The editor's saved layers of a texture, if it has any. */
export function readTextureLayers(path: string): Promise<string | null> {
  return readLayersFile(requireProject().dir, path)
}
