import { app, BrowserWindow, ipcMain, type IpcMainInvokeEvent } from 'electron'
import type { AppInfo, Result } from '../shared/api'
import { IpcChannel, type IpcChannelName } from '../shared/channels'
import { ipcArgs, type IpcArgs } from '../shared/ipc-schemas'
import { PackError } from './pack-io'
import {
  chooseFolder,
  closeProject,
  createProject,
  defaultProjectsDir,
  exportCurrentProject,
  listRecent,
  openProject,
} from './projects'
import { isAppUrl, openExternalSafely } from './security'
import {
  loadTexturesForCurrentProject,
  readBlockModel,
  readTextureImage,
  readTextureLayers,
  replaceTextureInCurrentProject,
  revertTextureInCurrentProject,
} from './textures'
import { clearDownloadCache, minecraftFilesInfo } from './vanilla/vanilla'

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

const fileSystemMessages: Record<string, string> = {
  EACCES: 'The app is not allowed to write to this folder.',
  EPERM: 'The app is not allowed to write to this folder.',
  ENOSPC: 'The disk is full.',
  ENOENT: 'A file or folder could not be found.',
  EROFS: 'This folder is read-only.',
}

/** Turns expected failures into a message for the user; anything else stays an error. */
async function asResult<T>(operation: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, value: await operation() }
  } catch (error) {
    if (error instanceof PackError) return { ok: false, error: error.message }
    const message = fileSystemMessages[(error as NodeJS.ErrnoException).code ?? '']
    if (message) return { ok: false, error: message }
    throw error
  }
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

  handle(IpcChannel.DialogChooseFolder, (event, purpose) => chooseFolder(windowOf(event), purpose))
  handle(IpcChannel.ProjectDefaultLocation, () => defaultProjectsDir())
  handle(IpcChannel.ProjectRecent, () => listRecent())
  handle(IpcChannel.ProjectCreate, (_event, request) => asResult(() => createProject(request)))
  handle(IpcChannel.ProjectOpen, (_event, dir) => asResult(() => openProject(dir)))
  handle(IpcChannel.ProjectClose, () => closeProject())
  handle(IpcChannel.ProjectExport, (_event, request) =>
    asResult(() => exportCurrentProject(request)),
  )

  handle(IpcChannel.TexturesLoad, (event) =>
    asResult(() => loadTexturesForCurrentProject(event.sender)),
  )
  handle(IpcChannel.TexturesRevert, (_event, path) =>
    asResult(() => revertTextureInCurrentProject(path)),
  )
  handle(IpcChannel.TexturesReadImage, (_event, source, path) => readTextureImage(source, path))
  handle(IpcChannel.TexturesReadLayers, (_event, path) => readTextureLayers(path))
  handle(IpcChannel.TexturesSaveEdit, (_event, path, png, layers) =>
    asResult(() => replaceTextureInCurrentProject(path, png, layers)),
  )
  handle(IpcChannel.TexturesBlockModel, (_event, id) => readBlockModel(id))
  handle(IpcChannel.MinecraftFilesInfo, () => minecraftFilesInfo())
  handle(IpcChannel.MinecraftClearCache, () => clearDownloadCache())
}
