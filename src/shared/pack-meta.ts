import { RANGED_FORMAT_SINCE, type PackFormat } from './minecraft-versions'

/**
 * Builds pack.mcmeta for exactly one pack format. Formats before 65 use `pack_format`;
 * 1.21.9 and later declare `min_format`/`max_format` as [major, minor] instead.
 * Other top-level sections of an existing pack.mcmeta (language, filter, overlays …) are kept.
 */
export function buildPackMcmeta(
  description: string,
  format: PackFormat,
  existing: Record<string, unknown> = {},
): string {
  const pack =
    format.major < RANGED_FORMAT_SINCE
      ? { pack_format: format.major, description }
      : {
          description,
          min_format: [format.major, format.minor],
          max_format: [format.major, format.minor],
        }
  return `${JSON.stringify({ ...existing, pack }, null, 2)}\n`
}

/** Parses pack.mcmeta leniently; returns null if it is not a JSON object. */
export function parsePackMcmeta(text: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(text.replace(/^\uFEFF/, ''))
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

/** Reads the description, flattening JSON text components to plain text. */
export function readDescription(meta: Record<string, unknown>): string {
  const pack = meta.pack as { description?: unknown } | undefined
  return flattenText(pack?.description)
}

function flattenText(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return value.map(flattenText).join('')
  if (value && typeof value === 'object') {
    const component = value as { text?: unknown; extra?: unknown }
    return flattenText(component.text ?? '') + flattenText(component.extra ?? '')
  }
  return ''
}

/** The single format a pack.mcmeta targets, if it states one. */
export function readFormat(meta: Record<string, unknown>): PackFormat | null {
  const pack = meta.pack as { pack_format?: unknown; min_format?: unknown } | undefined
  const min = pack?.min_format
  if (typeof min === 'number') return { major: min, minor: 0 }
  if (Array.isArray(min) && typeof min[0] === 'number') {
    return { major: min[0], minor: typeof min[1] === 'number' ? min[1] : 0 }
  }
  if (typeof pack?.pack_format === 'number') return { major: pack.pack_format, minor: 0 }
  return null
}
