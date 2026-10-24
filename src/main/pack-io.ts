// Reading, creating and exporting pack folders. Plain Node.js, no Electron, so it can be unit-tested.

import { strToU8, zipSync } from 'fflate'
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { basename, dirname, join, relative, sep } from 'node:path'
import { planExport } from '../shared/export-plan'
import { sanitizeFileName } from '../shared/file-names'
import { DEFAULT_LICENSE } from '../shared/licenses'
import {
  findVersion,
  LATEST_VERSION,
  MINECRAFT_VERSIONS,
  sameFormat,
  type MinecraftVersion,
} from '../shared/minecraft-versions'
import { buildPackMcmeta, parsePackMcmeta, readDescription, readFormat } from '../shared/pack-meta'
import {
  PROJECT_DIR,
  PROJECT_FILE,
  projectFileSchema,
  type ExportRequest,
  type ExportResult,
  type NewPackRequest,
  type ProjectFile,
  type ProjectSummary,
} from '../shared/project'
import { layersFileSchema } from '../shared/layers-file'
import { translatePackPath } from '../shared/texture-renames'
import { isTexturePath, PACK_TEXTURE_PREFIX } from '../shared/textures'

/** An expected problem whose message can be shown to the user as is. */
export class PackError extends Error {}

const JUNK_FILES = new Set(['.DS_Store', 'Thumbs.db', 'desktop.ini'])
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

/** Width and height of a PNG, or null if the bytes are not a PNG. */
export function pngSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 24 || PNG_SIGNATURE.some((byte, i) => bytes[i] !== byte)) return null
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  return { width: view.getUint32(16), height: view.getUint32(20) }
}

async function readOptional(path: string): Promise<Buffer | null> {
  try {
    return await readFile(path)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}

async function writeProjectFile(dir: string, project: ProjectFile): Promise<void> {
  await mkdir(join(dir, PROJECT_DIR), { recursive: true })
  await writeFile(join(dir, PROJECT_DIR, PROJECT_FILE), `${JSON.stringify(project, null, 2)}\n`)
}

/** Creates a new pack folder inside `parentDir` and returns its path. Never overwrites. */
export async function createPackFolder(request: NewPackRequest): Promise<string> {
  const version = findVersion(request.minecraftVersion)
  if (!version) throw new PackError(`Unknown Minecraft version ${request.minecraftVersion}.`)
  if (request.icon && !pngSize(request.icon))
    throw new PackError('The pack icon is not a PNG image.')

  const folderName = sanitizeFileName(request.name)
  const dir = join(request.parentDir, folderName)
  await mkdir(request.parentDir, { recursive: true })
  try {
    await mkdir(dir)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
      throw new PackError(`A folder named "${folderName}" already exists in this location.`)
    }
    throw error
  }

  const project: ProjectFile = {
    schemaVersion: 1,
    name: request.name.trim(),
    description: request.description,
    minecraftVersion: version.id,
    resolution: request.resolution,
    license: request.license,
    packVersion: '1.0.0',
  }
  await writeFile(join(dir, 'pack.mcmeta'), buildPackMcmeta(project.description, version.format))
  if (request.icon) await writeFile(join(dir, 'pack.png'), request.icon)
  await writeProjectFile(dir, project)
  return dir
}

/** Every regular file of the pack, as sorted '/'-separated paths. Skips .rpc, junk and symlinks. */
export async function collectPackFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true })
  return entries
    .filter((entry) => entry.isFile() && !JUNK_FILES.has(entry.name))
    .map((entry) => relative(dir, join(entry.parentPath, entry.name)).split(sep).join('/'))
    .filter((path) => path !== PROJECT_DIR && !path.startsWith(`${PROJECT_DIR}/`))
    .sort()
}

/** The newest release using the given pack format, for packs made outside the app. */
function versionForFormat(meta: Record<string, unknown>): MinecraftVersion {
  const format = readFormat(meta)
  if (!format) return LATEST_VERSION
  const matches = MINECRAFT_VERSIONS.filter((version) => sameFormat(version.format, format))
  return matches[matches.length - 1] ?? LATEST_VERSION
}

/** Reads a pack folder. Folders without .rpc/project.json get defaults derived from pack.mcmeta. */
export async function readPack(dir: string): Promise<ProjectSummary> {
  const mcmetaBytes = await readOptional(join(dir, 'pack.mcmeta'))
  if (!mcmetaBytes) {
    throw new PackError('This folder has no pack.mcmeta, so it is not a resource pack.')
  }
  const meta = parsePackMcmeta(mcmetaBytes.toString('utf8'))
  if (!meta) throw new PackError('pack.mcmeta in this folder is not valid JSON.')

  const stored = await readOptional(join(dir, PROJECT_DIR, PROJECT_FILE))
  const parsed = stored
    ? projectFileSchema.safeParse(parsePackMcmeta(stored.toString('utf8')))
    : null
  const project: ProjectFile = parsed?.success
    ? parsed.data
    : {
        schemaVersion: 1,
        name: basename(dir).slice(0, 64) || 'Resource Pack',
        description: readDescription(meta),
        minecraftVersion: versionForFormat(meta).id,
        resolution: 16,
        license: DEFAULT_LICENSE,
        packVersion: '1.0.0',
      }

  const icon = await readOptional(join(dir, 'pack.png'))
  const warnings: string[] = []
  const size = icon && pngSize(icon)
  if (!icon) warnings.push('The pack has no icon (pack.png).')
  else if (!size) warnings.push('pack.png is not a valid PNG image.')
  else if (size.width !== size.height) warnings.push('pack.png should be square.')

  return {
    dir,
    project,
    icon: icon ? new Uint8Array(icon) : null,
    files: await collectPackFiles(dir),
    warnings,
  }
}

/** Writes one ZIP per unit into `destination`, each with a pack.mcmeta for its versions. */
export async function exportPack(
  summary: ProjectSummary,
  request: ExportRequest,
  destination: string,
): Promise<ExportResult> {
  const { units, hasDuplicateNames } = planExport(summary.project, request)
  if (hasDuplicateNames) {
    throw new PackError('Several ZIPs would get the same name. Add {mc} to the file name.')
  }

  const contents: Record<string, Uint8Array> = {}
  for (const path of summary.files) {
    if (path === 'pack.mcmeta') continue
    contents[path] = await readFile(join(summary.dir, ...path.split('/')))
  }
  const existingMeta = parsePackMcmeta(
    (await readOptional(join(summary.dir, 'pack.mcmeta')))?.toString('utf8') ?? '{}',
  )
  const otherSections = { ...existingMeta }
  delete otherSections.pack

  await mkdir(destination, { recursive: true })
  const renamed = new Set<string>()
  for (const unit of units) {
    const target = unit.versions[0]
    const files = renameForVersion(contents, summary.project.minecraftVersion, target.id)
    for (const path of files.renamed) renamed.add(path)
    const mcmeta = buildPackMcmeta(summary.project.description, target.format, otherSections)
    const zip = zipSync({ ...files.contents, 'pack.mcmeta': strToU8(mcmeta) }, { level: 6 })
    await writeFile(join(destination, unit.fileName), zip)
  }
  return {
    directory: destination,
    files: units.map((unit) => unit.fileName),
    renamedFiles: renamed.size,
  }
}

/**
 * The pack's files under the texture names of another Minecraft version. If the pack has a
 * file under both the old and the new name, the one already at the target name wins.
 */
export function renameForVersion(
  contents: Readonly<Record<string, Uint8Array>>,
  from: string,
  to: string,
): { contents: Record<string, Uint8Array>; renamed: string[] } {
  const result: Record<string, Uint8Array> = {}
  const renamed: string[] = []
  for (const [path, bytes] of Object.entries(contents)) {
    const target = translatePackPath(path, from, to)
    if (target === path) {
      result[path] = bytes
    } else if (!(target in contents)) {
      result[target] = bytes
      renamed.push(path)
    }
  }
  return { contents: result, renamed }
}

/** Where a texture lives inside the pack; rejects paths that could leave the folder. */
export function packTextureFile(dir: string, path: string): string {
  if (!isTexturePath(path)) throw new PackError('This is not a valid texture path.')
  return join(dir, ...PACK_TEXTURE_PREFIX.split('/').filter(Boolean), ...path.split('/'))
}

/**
 * Writes a texture into the pack. `animation` is the .png.mcmeta to write next to it,
 * 'keep' to leave an existing one alone, or null to remove it.
 */
export async function writePackTexture(
  dir: string,
  path: string,
  png: Uint8Array,
  animation: Uint8Array | 'keep' | null,
): Promise<void> {
  if (!pngSize(png)) throw new PackError('The new texture is not a PNG image.')
  const file = packTextureFile(dir, path)
  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, png)
  if (animation === null) await rm(`${file}.mcmeta`, { force: true })
  else if (animation !== 'keep') await writeFile(`${file}.mcmeta`, animation)
}

/** Removes the pack's version of a texture, so Minecraft falls back to the original. */
export async function removePackTexture(dir: string, path: string): Promise<void> {
  const file = packTextureFile(dir, path)
  await rm(file, { force: true })
  await rm(`${file}.mcmeta`, { force: true })
  await writeLayersFile(dir, path, null)
}

/** Where the editor keeps a texture's layers: .rpc/layers/<path>.json, outside every export. */
export function layersFile(dir: string, path: string): string {
  if (!isTexturePath(path)) throw new PackError('This is not a valid texture path.')
  return `${join(dir, PROJECT_DIR, 'layers', ...path.split('/'))}.json`
}

export async function readLayersFile(dir: string, path: string): Promise<string | null> {
  return (await readOptional(layersFile(dir, path)))?.toString('utf8') ?? null
}

/** Writes a texture's layers, or removes them (null) when the PNG alone describes it. */
export async function writeLayersFile(
  dir: string,
  path: string,
  json: string | null,
): Promise<void> {
  const file = layersFile(dir, path)
  if (json === null) {
    await rm(file, { force: true })
    return
  }
  const parsed = layersFileSchema.safeParse(JSON.parse(json))
  if (!parsed.success) throw new PackError('The layers could not be saved.')
  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, json)
}
