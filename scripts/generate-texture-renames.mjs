// Regenerates src/shared/texture-renames.data.ts (docs/DECISIONS.md #89).
//
// Compares the texture file lists of consecutive Minecraft releases, taken from the
// InventivetalentDev/minecraft-assets mirror of the game files. Only the git trees are
// fetched (no images): every file comes with its git blob hash, so a texture that kept its
// exact bytes under a new name is recognised as renamed. Remaining cases come from
// scripts/texture-renames.manual.json.
//
// Usage: node scripts/generate-texture-renames.mjs [--report]

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const MIRROR = 'https://github.com/InventivetalentDev/minecraft-assets'
const TEXTURES = 'assets/minecraft/textures/'
const root = fileURLToPath(new URL('..', import.meta.url))
const OUTPUT = join(root, 'src/shared/texture-renames.data.ts')
const MANUAL = join(root, 'scripts/texture-renames.manual.json')
const report = process.argv.includes('--report')

const versions = [
  ...readFileSync(join(root, 'src/shared/minecraft-versions.data.ts'), 'utf8').matchAll(
    /\['([^']+)', \d+, \d+\]/g,
  ),
].map((match) => match[1])

const repo = join(tmpdir(), 'rpc-minecraft-assets.git')
const git = (...args) =>
  execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
if (!existsSync(repo)) {
  mkdirSync(repo, { recursive: true })
  git('init', '--quiet', '--bare')
  git('remote', 'add', 'origin', MIRROR)
}

const branches = new Set(
  git('ls-remote', '--heads', 'origin')
    .split('\n')
    .map((line) => line.split('refs/heads/')[1])
    .filter(Boolean),
)

/** Width×height of a texture in a version, read from the PNG header (fetches just that blob). */
function pngSize(version, path) {
  const bytes = execFileSync('git', [
    '-C',
    repo,
    'cat-file',
    'blob',
    `refs/versions/${version}:${TEXTURES}${path}`,
  ])
  return `${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`
}

/** path below textures/ → blob hash, for the PNGs of one version. */
function textures(version) {
  const ref = `refs/versions/${version}`
  git('fetch', '--quiet', '--depth', '1', '--filter=blob:none', 'origin', `+${version}:${ref}`)
  const tree = git('ls-tree', '-r', '--format=%(objectname) %(path)', ref, '--', TEXTURES)
  const files = new Map()
  for (const line of tree.split('\n')) {
    const [hash, path] = [line.slice(0, 40), line.slice(41)]
    if (path.endsWith('.png')) files.set(path.slice(TEXTURES.length), hash)
  }
  return files
}

/** Renames between two releases: same bytes under a new path, unique on both sides. */
function findRenames(before, after, sameSize) {
  const removed = [...before.keys()].filter((path) => !after.has(path))
  const added = [...after.keys()].filter((path) => !before.has(path))
  const byHash = (paths, files) => {
    const map = new Map()
    for (const path of paths) {
      const hash = files.get(path)
      map.set(hash, map.has(hash) ? null : path)
    }
    return map
  }
  const addedByHash = byHash(added, after)
  const removedByHash = byHash(removed, before)

  const renames = {}
  for (const path of removed) {
    const hash = before.get(path)
    if (removedByHash.get(hash) === path && addedByHash.get(hash)) {
      renames[path] = addedByHash.get(hash)
    }
  }
  // Moved to another folder and redrawn at the same time (blocks/ice.png → block/ice.png):
  // the same file name, if it is unique among the remaining files on both sides.
  const fileName = (path) => path.slice(path.lastIndexOf('/') + 1)
  const remainingAdded = added.filter((path) => !Object.values(renames).includes(path))
  const remainingRemoved = removed.filter((path) => !(path in renames))
  for (const path of remainingRemoved) {
    const name = fileName(path)
    const targets = remainingAdded.filter((candidate) => fileName(candidate) === name)
    const sources = remainingRemoved.filter((candidate) => fileName(candidate) === name)
    // A changed size means a new layout; renaming would distort the pack's image.
    if (targets.length === 1 && sources.length === 1 && sameSize(path, targets[0])) {
      renames[path] = targets[0]
    }
  }
  const matched = new Set(Object.values(renames))
  return {
    renames,
    unmatchedRemoved: removed.filter((path) => !(path in renames)),
    unmatchedAdded: added.filter((path) => !matched.has(path)),
  }
}

const manual = existsSync(MANUAL) ? JSON.parse(readFileSync(MANUAL, 'utf8')) : {}
const steps = []
let previous = null
for (const version of versions) {
  if (!branches.has(version)) {
    console.warn(`(mirror has no ${version}; its changes count towards the next release)`)
    continue
  }
  const current = textures(version)
  if (previous) {
    const sameSize = (from, to) => pngSize(previous.version, from) === pngSize(version, to)
    const { renames, unmatchedRemoved, unmatchedAdded } = findRenames(
      previous.files,
      current,
      sameSize,
    )
    // Hand-written entries fill gaps where a texture was renamed and redrawn at once.
    for (const [from, to] of Object.entries(manual[version] ?? {})) {
      if (!previous.files.has(from)) throw new Error(`${version}: ${from} did not exist before`)
      if (!current.has(to)) throw new Error(`${version}: ${to} does not exist`)
      if (!sameSize(from, to)) throw new Error(`${version}: ${from} and ${to} differ in size`)
      renames[from] = to
    }
    const count = Object.keys(renames).length
    if (count > 0) {
      steps.push({ version, renames: Object.fromEntries(Object.entries(renames).sort()) })
    }
    const left = unmatchedRemoved.filter((path) => !(path in renames))
    console.log(
      `${previous.version} → ${version}: ${count} renamed, ${left.length} removed, ${unmatchedAdded.length} added`,
    )
    if (report && (left.length || unmatchedAdded.length)) {
      for (const path of left) console.log(`   - ${path}`)
      for (const path of unmatchedAdded) console.log(`   + ${path}`)
    }
  }
  previous = { version, files: current }
}

const entries = steps.map(
  ({ version, renames }) =>
    `  {\n    version: '${version}',\n    renames: {\n${Object.entries(renames)
      .map(([from, to]) => `      '${from}': '${to}',`)
      .join('\n')}\n    },\n  },`,
)
const source = `// Generated by scripts/generate-texture-renames.mjs — do not edit by hand.
// Paths are below assets/minecraft/textures/. Each step lists the renames that take effect
// in that version, oldest step first.

export const RENAME_TABLE: readonly {
  version: string
  renames: Readonly<Record<string, string>>
}[] = [
${entries.join('\n')}
]
`
const prettier = await import('prettier')
const options = (await prettier.resolveConfig(OUTPUT)) ?? {}
writeFileSync(OUTPUT, await prettier.format(source, { ...options, filepath: OUTPUT }))
console.log(`Wrote ${steps.length} steps to ${OUTPUT}`)
