// Finds the client JAR of a Minecraft version: the local installation first, then the
// app's download cache, then Mojang. Mojang's files are never shipped with the app.

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { TextureIndex } from '../../shared/textures'
import type { ProgressListener } from './mojang'

export function defaultMinecraftDir(platform: string, appData: string, home: string): string {
  if (platform === 'win32') return join(appData, '.minecraft')
  if (platform === 'darwin') return join(home, 'Library', 'Application Support', 'minecraft')
  return join(home, '.minecraft')
}

export function localClientJarPath(minecraftDir: string, version: string): string {
  return join(minecraftDir, 'versions', version, `${version}.jar`)
}

export function cachedClientJarPath(cacheDir: string, version: string): string {
  return join(cacheDir, version, 'client.jar')
}

async function readIfExists(path: string): Promise<Uint8Array | null> {
  try {
    return new Uint8Array(await readFile(path))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}

export interface ClientJar {
  bytes: Uint8Array
  source: TextureIndex['source']
}

export async function resolveClientJar(options: {
  version: string
  minecraftDir: string
  cacheDir: string
  download: (version: string, onProgress?: ProgressListener) => Promise<Uint8Array>
  onProgress?: ProgressListener
}): Promise<ClientJar> {
  const { version, minecraftDir, cacheDir } = options

  const local = await readIfExists(localClientJarPath(minecraftDir, version))
  if (local) return { bytes: local, source: 'local' }

  const cachedPath = cachedClientJarPath(cacheDir, version)
  const cached = await readIfExists(cachedPath)
  if (cached) return { bytes: cached, source: 'cache' }

  const bytes = await options.download(version, options.onProgress)
  // Write next to the target and rename, so an interrupted write never looks complete.
  await mkdir(join(cacheDir, version), { recursive: true })
  await writeFile(`${cachedPath}.part`, bytes)
  await rename(`${cachedPath}.part`, cachedPath)
  return { bytes, source: 'download' }
}
