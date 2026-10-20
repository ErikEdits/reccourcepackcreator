import { RELEASES } from './minecraft-versions.data'

export interface PackFormat {
  major: number
  minor: number
}

export interface MinecraftVersion {
  id: string
  format: PackFormat
}

/** Every Java Edition release with resource packs (1.6.1 and later), oldest first. */
export const MINECRAFT_VERSIONS: readonly MinecraftVersion[] = RELEASES.map(
  ([id, major, minor]) => ({
    id,
    format: { major, minor },
  }),
)

export const LATEST_VERSION: MinecraftVersion = MINECRAFT_VERSIONS[MINECRAFT_VERSIONS.length - 1]

/** From this format on, pack.mcmeta declares min_format/max_format (Minecraft 1.21.9). */
export const RANGED_FORMAT_SINCE = 65

export function findVersion(id: string): MinecraftVersion | undefined {
  return MINECRAFT_VERSIONS.find((version) => version.id === id)
}

export function formatLabel({ major, minor }: PackFormat): string {
  return minor === 0 ? String(major) : `${major}.${minor}`
}

export function sameFormat(a: PackFormat, b: PackFormat): boolean {
  return a.major === b.major && a.minor === b.minor
}

export interface FormatGroup {
  format: PackFormat
  /** Oldest first. */
  versions: MinecraftVersion[]
}

/** Groups versions that share a pack format, keeping release order. */
export function groupByFormat(versions: readonly MinecraftVersion[]): FormatGroup[] {
  const groups: FormatGroup[] = []
  for (const version of versions) {
    const last = groups[groups.length - 1]
    if (last && sameFormat(last.format, version.format)) last.versions.push(version)
    else groups.push({ format: version.format, versions: [version] })
  }
  return groups
}

/** "1.20.3" or "1.20.3-1.20.4" for a run of versions. */
export function versionRangeLabel(versions: readonly MinecraftVersion[]): string {
  const first = versions[0].id
  const last = versions[versions.length - 1].id
  return first === last ? first : `${first}-${last}`
}
