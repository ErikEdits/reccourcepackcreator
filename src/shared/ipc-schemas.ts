import { z } from 'zod'
import { IpcChannel, type IpcChannelName } from './channels'
import { exportRequestSchema, newPackRequestSchema } from './project'
import { isTexturePath } from './textures'

const folderPurpose = z.enum(['project-location', 'open-project', 'export-destination'])
const path = z.string().min(1).max(4096)
const texturePath = z.string().max(512).refine(isTexturePath)
/** Upper bound for one texture image sent from the UI. */
const MAX_TEXTURE_BYTES = 64 * 1024 * 1024
const png = z.instanceof(Uint8Array).refine((bytes) => bytes.byteLength <= MAX_TEXTURE_BYTES)
/** A block id like "grass_block" (lowercase letters, digits and _). */
const blockId = z.string().regex(/^[a-z0-9_]{1,128}$/)

/**
 * Argument schemas for every invokable channel. The main process rejects any
 * call whose arguments do not match, so the renderer can never pass anything
 * the handler did not expect.
 */
export const ipcArgs = {
  [IpcChannel.WindowMinimize]: z.tuple([]),
  [IpcChannel.WindowToggleMaximize]: z.tuple([]),
  [IpcChannel.WindowClose]: z.tuple([]),
  [IpcChannel.WindowIsMaximized]: z.tuple([]),
  [IpcChannel.AppGetInfo]: z.tuple([]),
  [IpcChannel.ShellOpenExternal]: z.tuple([z.string().max(2048)]),
  [IpcChannel.DialogChooseFolder]: z.tuple([folderPurpose]),
  [IpcChannel.ProjectDefaultLocation]: z.tuple([]),
  [IpcChannel.ProjectRecent]: z.tuple([]),
  [IpcChannel.ProjectCreate]: z.tuple([newPackRequestSchema]),
  [IpcChannel.ProjectOpen]: z.tuple([path]),
  [IpcChannel.ProjectClose]: z.tuple([]),
  [IpcChannel.ProjectExport]: z.tuple([exportRequestSchema]),
  [IpcChannel.TexturesLoad]: z.tuple([]),
  [IpcChannel.TexturesRevert]: z.tuple([texturePath]),
  [IpcChannel.TexturesReadImage]: z.tuple([z.enum(['vanilla', 'pack']), texturePath]),
  [IpcChannel.TexturesReadLayers]: z.tuple([texturePath]),
  [IpcChannel.TexturesSaveEdit]: z.tuple([
    texturePath,
    png,
    z
      .string()
      .max(MAX_TEXTURE_BYTES * 2)
      .nullable(),
  ]),
  [IpcChannel.TexturesBlockModel]: z.tuple([blockId]),
  [IpcChannel.MinecraftFilesInfo]: z.tuple([]),
  [IpcChannel.MinecraftClearCache]: z.tuple([]),
} satisfies Record<IpcChannelName, z.ZodTuple>

export type IpcArgs<C extends IpcChannelName> = z.infer<(typeof ipcArgs)[C]>
