import { app, BrowserWindow, nativeTheme, session } from 'electron'
import { join } from 'node:path'
import { IpcEvent } from '../shared/channels'
import { registerIpcHandlers } from './ipc'
import { applySessionSecurity, devServerUrl, hardenWebContents } from './security'

function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    frame: false,
    title: 'Resource Pack Creator',
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#121410' : '#eceee8',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      spellcheck: false,
    },
  })

  window.once('ready-to-show', () => window.show())
  window.on('maximize', () => window.webContents.send(IpcEvent.WindowMaximizedChanged, true))
  window.on('unmaximize', () => window.webContents.send(IpcEvent.WindowMaximizedChanged, false))

  if (devServerUrl) void window.loadURL(devServerUrl)
  else void window.loadFile(join(__dirname, '../renderer/index.html'))

  return window
}

// One project at a time (docs/DECISIONS.md #68): a second launch focuses the running app.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const [window] = BrowserWindow.getAllWindows()
    if (!window) return
    if (window.isMinimized()) window.restore()
    window.focus()
  })

  app.on('web-contents-created', (_event, contents) => hardenWebContents(contents))

  void app.whenReady().then(() => {
    applySessionSecurity(session.defaultSession)
    registerIpcHandlers()
    createMainWindow()
  })

  app.on('window-all-closed', () => app.quit())
}
