import { app, BrowserWindow, ipcMain, type IpcMainInvokeEvent } from 'electron'
import type { AppInfo } from '../shared/api'
import { IpcChannel, type IpcChannelName } from '../shared/channels'
import { ipcArgs, type IpcArgs } from '../shared/ipc-schemas'
import { isAppUrl, openExternalSafely } from './security'

type Handler<C extends IpcChannelName> = (event: IpcMainInvokeEvent, ...args: IpcArgs<C>) => unknown

/** Registers a handler that only runs for the app's own page and schema-valid arguments. */
function handle<C extends IpcChannelName>(channel: C, handler: Handler<C>): void {
  ipcMain.handle(channel, (event, ...rawArgs: unknown[]) => {
    const senderUrl = event.senderFrame?.url
    if (!senderUrl || !isAppUrl(senderUrl)) {
      throw new Error(`Rejected ${channel}: untrusted sender`)
    }
    const parsed = ipcArgs[channel].safeParse(rawArgs)
    if (!parsed.success) {
      throw new Error(`Rejected ${channel}: invalid arguments`)
    }
    return handler(event, ...(parsed.data as IpcArgs<C>))
  })
}

function windowOf(event: IpcMainInvokeEvent): BrowserWindow | null {
  return BrowserWindow.fromWebContents(event.sender)
}

export function registerIpcHandlers(): void {
  handle(IpcChannel.WindowMinimize, (event) => {
    windowOf(event)?.minimize()
  })
  handle(IpcChannel.WindowToggleMaximize, (event) => {
    const window = windowOf(event)
    if (!window) return
    if (window.isMaximized()) window.unmaximize()
    else window.maximize()
  })
  handle(IpcChannel.WindowClose, (event) => {
    windowOf(event)?.close()
  })
  handle(IpcChannel.WindowIsMaximized, (event) => windowOf(event)?.isMaximized() ?? false)
  handle(IpcChannel.AppGetInfo, (): AppInfo => ({
    name: app.getName(),
    version: app.getVersion(),
    platform: process.platform,
    electronVersion: process.versions.electron,
  }))
  handle(IpcChannel.ShellOpenExternal, (_event, url) => openExternalSafely(url))
}
