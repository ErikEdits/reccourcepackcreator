import { z } from 'zod'
import { IpcChannel, type IpcChannelName } from './channels'

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
} satisfies Record<IpcChannelName, z.ZodTuple>

export type IpcArgs<C extends IpcChannelName> = z.infer<(typeof ipcArgs)[C]>
