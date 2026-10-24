import { z } from 'zod'
import { PACK_LICENSE_IDS } from './licenses'
import { MINECRAFT_VERSIONS } from './minecraft-versions'

export const RESOLUTIONS = [16, 32, 64, 128, 256, 512, 1024] as const

export const PROJECT_DIR = '.rpc'
export const PROJECT_FILE = 'project.json'

const versionId = z.enum(MINECRAFT_VERSIONS.map((version) => version.id) as [string, ...string[]])

export const packNameSchema = z.string().trim().min(1, 'Enter a name').max(64)

/** Stored in .rpc/project.json inside the pack folder. Minecraft ignores this folder. */
export const projectFileSchema = z.object({
  schemaVersion: z.literal(1),
  name: packNameSchema,
  description: z.string().max(1000),
  minecraftVersion: versionId,
  resolution: z.union(RESOLUTIONS.map((value) => z.literal(value))),
  license: z.enum(PACK_LICENSE_IDS),
  packVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
})

export type ProjectFile = z.infer<typeof projectFileSchema>

/** pack.png is generated in the renderer; keep the transfer small. */
const MAX_ICON_BYTES = 4 * 1024 * 1024

export const newPackRequestSchema = projectFileSchema
  .omit({ schemaVersion: true, packVersion: true })
  .extend({
    parentDir: z.string().min(1).max(4096),
    icon: z
      .instanceof(Uint8Array)
      .refine((bytes) => bytes.byteLength <= MAX_ICON_BYTES)
      .nullable(),
  })

export type NewPackRequest = z.infer<typeof newPackRequestSchema>

export const DEFAULT_FILE_NAME_TEMPLATE = '{name}_v{packVersion}_MC{mc}'

export const exportRequestSchema = z.object({
  versions: z.array(versionId).min(1).max(MINECRAFT_VERSIONS.length),
  /** One ZIP per pack format instead of one per version. */
  combineSameFormat: z.boolean(),
  /** null = the Downloads folder. */
  destination: z.string().min(1).max(4096).nullable(),
  fileNameTemplate: z.string().trim().min(1).max(200),
})

export type ExportRequest = z.infer<typeof exportRequestSchema>

export interface ProjectSummary {
  dir: string
  project: ProjectFile
  /** pack.png, if present. */
  icon: Uint8Array | null
  /** Pack files relative to the pack folder, '/'-separated, without the .rpc folder. */
  files: string[]
  /** Problems worth fixing before an export. */
  warnings: string[]
}

export interface RecentProject {
  dir: string
  name: string
  minecraftVersion: string
}

export interface ExportResult {
  directory: string
  files: string[]
  /** Pack files that got another name in at least one ZIP, to match its Minecraft version. */
  renamedFiles: number
}

export type FolderPurpose = 'project-location' | 'open-project' | 'export-destination'
