// Texture list model shared by the main process and the UI (docs/DECISIONS.md #22–#24).

/** Pack files below this folder are textures. */
export const PACK_TEXTURE_PREFIX = 'assets/minecraft/textures/'

/** Custom protocol that serves vanilla and pack textures to the UI. */
export const TEXTURE_PROTOCOL = 'rpc-texture'

export const TEXTURE_CATEGORIES = [
  { id: 'blocks', name: 'Blocks' },
  { id: 'items', name: 'Items' },
  { id: 'entities', name: 'Mobs & entities' },
  { id: 'gui', name: 'GUI' },
  { id: 'environment', name: 'Environment' },
  { id: 'particles', name: 'Particles' },
  { id: 'effects', name: 'Effects' },
  { id: 'armor', name: 'Armour' },
  { id: 'paintings', name: 'Paintings' },
  { id: 'colormaps', name: 'Colour maps' },
  { id: 'fonts', name: 'Fonts' },
  { id: 'maps', name: 'Maps' },
  { id: 'misc', name: 'Misc' },
  { id: 'other', name: 'Other' },
] as const

export type TextureCategory = (typeof TEXTURE_CATEGORIES)[number]['id']

const FOLDER_CATEGORIES: Record<string, TextureCategory> = {
  block: 'blocks',
  blocks: 'blocks',
  item: 'items',
  items: 'items',
  entity: 'entities',
  gui: 'gui',
  environment: 'environment',
  particle: 'particles',
  mob_effect: 'effects',
  effect: 'effects',
  models: 'armor',
  trims: 'armor',
  painting: 'paintings',
  colormap: 'colormaps',
  font: 'fonts',
  map: 'maps',
  misc: 'misc',
}

export const COLOUR_BUCKETS = [
  { id: 'red', name: 'Red', swatch: '#d13b3b' },
  { id: 'orange', name: 'Orange', swatch: '#e8862a' },
  { id: 'yellow', name: 'Yellow', swatch: '#e6cf3a' },
  { id: 'green', name: 'Green', swatch: '#4fa83d' },
  { id: 'aqua', name: 'Aqua', swatch: '#3cb8b2' },
  { id: 'blue', name: 'Blue', swatch: '#3d63d1' },
  { id: 'purple', name: 'Purple', swatch: '#8a46c7' },
  { id: 'pink', name: 'Pink', swatch: '#e070b8' },
  { id: 'brown', name: 'Brown', swatch: '#7a5232' },
  { id: 'white', name: 'White', swatch: '#f2f2f2' },
  { id: 'grey', name: 'Grey', swatch: '#8c8c8c' },
  { id: 'black', name: 'Black', swatch: '#1f1f1f' },
] as const

export type ColourBucket = (typeof COLOUR_BUCKETS)[number]['id']

/** One texture of the vanilla game, as listed in the texture browser. */
export interface VanillaTexture {
  /** Relative to assets/minecraft/textures, e.g. "block/stone.png". */
  path: string
  width: number
  height: number
  /** Has a .png.mcmeta, i.e. is animated (water, lava, portal …). */
  animated: boolean
  /** Dominant colour group, null for fully transparent textures. */
  colour: ColourBucket | null
}

export interface TextureIndex {
  version: string
  /** Where the vanilla files came from. */
  source: 'local' | 'cache' | 'download'
  textures: VanillaTexture[]
}

export interface TextureProgress {
  version: string
  received: number
  total: number
}

/** Safe relative texture path: no "..", no backslashes, ends in .png. */
export function isTexturePath(path: string): boolean {
  return (
    path.length > 0 &&
    path.length < 512 &&
    path.endsWith('.png') &&
    !path.includes('\\') &&
    !path.startsWith('/') &&
    path.split('/').every((part) => part !== '' && part !== '.' && part !== '..')
  )
}

export function categoryFor(path: string): TextureCategory {
  return FOLDER_CATEGORIES[path.split('/')[0]] ?? 'other'
}

/** "block/oak_planks.png" → "oak_planks" */
export function textureName(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1).replace(/\.png$/, '')
}

/** "oak_planks" → "Oak Planks" */
export function displayName(name: string): string {
  return name
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(' ')
}

/** Minecraft Wiki page for a texture name (a best guess from the file name). */
export function wikiUrl(name: string): string {
  const title = displayName(name).replace(/ /g, '_')
  return `https://minecraft.wiki/w/${encodeURIComponent(title)}`
}

/** Sorts an average colour into one of the filter groups. */
export function classifyColour(r: number, g: number, b: number): ColourBucket {
  const max = Math.max(r, g, b) / 255
  const min = Math.min(r, g, b) / 255
  const lightness = (max + min) / 2
  const delta = max - min
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1))

  if (lightness < 0.13) return 'black'
  if (saturation < 0.15 || delta < 0.06) {
    if (lightness > 0.8) return 'white'
    return lightness < 0.2 ? 'black' : 'grey'
  }

  let hue: number
  const [rn, gn, bn] = [r / 255, g / 255, b / 255]
  if (max === rn) hue = ((gn - bn) / delta) % 6
  else if (max === gn) hue = (bn - rn) / delta + 2
  else hue = (rn - gn) / delta + 4
  hue = (hue * 60 + 360) % 360

  if (hue >= 15 && hue < 50 && lightness < 0.42) return 'brown'
  if (hue < 15 || hue >= 345) return 'red'
  if (hue < 40) return 'orange'
  if (hue < 70) return 'yellow'
  if (hue < 165) return 'green'
  if (hue < 200) return 'aqua'
  if (hue < 255) return 'blue'
  if (hue < 290) return 'purple'
  return 'pink'
}

/** A texture as shown in the list: vanilla, possibly replaced by the pack, or added by the pack. */
export interface TextureRow {
  path: string
  name: string
  category: TextureCategory
  /** The pack has its own version of this vanilla texture. */
  changed: boolean
  /** The pack has this texture but the vanilla game does not. */
  added: boolean
  vanilla: VanillaTexture | null
}

/** Combines the vanilla index with the pack's files. */
export function buildTextureRows(
  textures: readonly VanillaTexture[],
  packFiles: readonly string[],
): TextureRow[] {
  const packTextures = new Set(
    packFiles
      .filter((file) => file.startsWith(PACK_TEXTURE_PREFIX) && file.endsWith('.png'))
      .map((file) => file.slice(PACK_TEXTURE_PREFIX.length)),
  )
  const rows: TextureRow[] = textures.map((texture) => ({
    path: texture.path,
    name: textureName(texture.path),
    category: categoryFor(texture.path),
    changed: packTextures.delete(texture.path),
    added: false,
    vanilla: texture,
  }))
  for (const path of packTextures) {
    rows.push({
      path,
      name: textureName(path),
      category: categoryFor(path),
      changed: false,
      added: true,
      vanilla: null,
    })
  }
  return rows
}

export interface TextureFilters {
  query: string
  category: TextureCategory | 'all'
  colour: ColourBucket | 'any'
  changedOnly: boolean
}

export const DEFAULT_TEXTURE_FILTERS: TextureFilters = {
  query: '',
  category: 'all',
  colour: 'any',
  changedOnly: false,
}

export function filterTextureRows(
  rows: readonly TextureRow[],
  filters: TextureFilters,
): TextureRow[] {
  const words = filters.query
    .toLowerCase()
    .split(/[\s_]+/)
    .filter(Boolean)
  return rows.filter((row) => {
    if (filters.changedOnly && !row.changed && !row.added) return false
    if (filters.category !== 'all' && row.category !== filters.category) return false
    if (filters.colour !== 'any' && row.vanilla?.colour !== filters.colour) return false
    const haystack = row.path.toLowerCase()
    return words.every((word) => haystack.includes(word))
  })
}
