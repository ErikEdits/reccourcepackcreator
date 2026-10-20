import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type { RendererApi } from '../shared/api'
import { IpcChannel, IpcEvent } from '../shared/channels'

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
}

contextBridge.exposeInMainWorld('api', api)
