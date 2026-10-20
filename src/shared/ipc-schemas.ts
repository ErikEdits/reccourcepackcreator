import { z } from 'zod'
import { IpcChannel, type IpcChannelName } from './channels'
import { exportRequestSchema, newPackRequestSchema } from './project'

const folderPurpose = z.enum(['project-location', 'open-project', 'export-destination'])
const path = z.string().min(1).max(4096)

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
} satisfies Record<IpcChannelName, z.ZodTuple>

export type IpcArgs<C extends IpcChannelName> = z.infer<(typeof ipcArgs)[C]>
