import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type { RendererApi } from '../shared/api'
import { IpcChannel, IpcEvent } from '../shared/channels'
import type { TextureProgress } from '../shared/textures'

// The renderer only ever sees these functions; it never gets ipcRenderer or Node.js.
const api: RendererApi = {
  window: {
    minimize: () => ipcRenderer.invoke(IpcChannel.WindowMinimize),
    toggleMaximize: () => ipcRenderer.invoke(IpcChannel.WindowToggleMaximize),
    close: () => ipcRenderer.invoke(IpcChannel.WindowClose),
    isMaximized: () => ipcRenderer.invoke(IpcChannel.WindowIsMaximized),
    onMaximizedChange: (listener) => {
      const forward = (_event: IpcRendererEvent, maximized: boolean): void => listener(maximized)
      ipcRenderer.on(IpcEvent.WindowMaximizedChanged, forward)
      return () => ipcRenderer.removeListener(IpcEvent.WindowMaximizedChanged, forward)
    },
  },
  app: {
    getInfo: () => ipcRenderer.invoke(IpcChannel.AppGetInfo),
  },
  shell: {
    openExternal: (url) => ipcRenderer.invoke(IpcChannel.ShellOpenExternal, url),
  },
  dialog: {
    chooseFolder: (purpose) => ipcRenderer.invoke(IpcChannel.DialogChooseFolder, purpose),
  },
  project: {
    defaultLocation: () => ipcRenderer.invoke(IpcChannel.ProjectDefaultLocation),
    recent: () => ipcRenderer.invoke(IpcChannel.ProjectRecent),
    create: (request) => ipcRenderer.invoke(IpcChannel.ProjectCreate, request),
    open: (dir) => ipcRenderer.invoke(IpcChannel.ProjectOpen, dir),
    close: () => ipcRenderer.invoke(IpcChannel.ProjectClose),
    export: (request) => ipcRenderer.invoke(IpcChannel.ProjectExport, request),
  },
  textures: {
    load: () => ipcRenderer.invoke(IpcChannel.TexturesLoad),
    revert: (path) => ipcRenderer.invoke(IpcChannel.TexturesRevert, path),
    readImage: (source, path) => ipcRenderer.invoke(IpcChannel.TexturesReadImage, source, path),
    readLayers: (path) => ipcRenderer.invoke(IpcChannel.TexturesReadLayers, path),
    saveEdit: (path, png, layers) =>
      ipcRenderer.invoke(IpcChannel.TexturesSaveEdit, path, png, layers),
    onProgress: (listener) => {
      const forward = (_event: IpcRendererEvent, progress: TextureProgress): void =>
        listener(progress)
      ipcRenderer.on(IpcEvent.TexturesProgress, forward)
      return () => ipcRenderer.removeListener(IpcEvent.TexturesProgress, forward)
    },
  },
  minecraft: {
    filesInfo: () => ipcRenderer.invoke(IpcChannel.MinecraftFilesInfo),
    clearCache: () => ipcRenderer.invoke(IpcChannel.MinecraftClearCache),
  },
}

contextBridge.exposeInMainWorld('api', api)
