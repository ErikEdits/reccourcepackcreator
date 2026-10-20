import { app, BrowserWindow, dialog, shell, type Session, type WebContents } from 'electron'
import { join, relative, isAbsolute } from 'node:path'
import { fileURLToPath } from 'node:url'
import { classifyExternalLink, isAllowedNetworkUrl } from '../shared/network-policy'

const rendererDir = join(__dirname, '../renderer')

/** Dev server URL injected by electron-vite. Never honoured in a packaged build. */
export const devServerUrl = app.isPackaged ? undefined : process.env['ELECTRON_RENDERER_URL']

function parseUrl(raw: string): URL | null {
  try {
    return new URL(raw)
  } catch {
    return null
  }
}

function isInsideRendererDir(url: URL): boolean {
  if (url.protocol !== 'file:') return false
  const rel = relative(rendererDir, fileURLToPath(url))
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel)
}

/** True if the URL is the app's own UI (the bundled page, or the dev server during development). */
export function isAppUrl(raw: string): boolean {
  const url = parseUrl(raw)
  if (!url) return false
  if (devServerUrl) return url.origin === new URL(devServerUrl).origin
  return isInsideRendererDir(url) && url.pathname.endsWith('/index.html')
}

function isPermittedRequest(raw: string): boolean {
  const url = parseUrl(raw)
  if (!url) return false
  switch (url.protocol) {
    case 'data:':
    case 'blob:':
      return true
    case 'devtools:':
      return !app.isPackaged
    case 'file:':
      return isInsideRendererDir(url)
    case 'http:':
    case 'ws:':
      return devServerUrl !== undefined && url.host === new URL(devServerUrl).host
    default:
      return isAllowedNetworkUrl(raw)
  }
}

/** Denies every web permission and blocks requests to anything outside the allow-list. */
export function applySessionSecurity(session: Session): void {
  session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false))
  session.setPermissionCheckHandler(() => false)
  session.webRequest.onBeforeRequest((details, callback) => {
    callback({ cancel: !isPermittedRequest(details.url) })
  })
}

/** Opens a link in the system browser, asking first for hosts the app does not know. */
export async function openExternalSafely(raw: string): Promise<boolean> {
  const verdict = classifyExternalLink(raw)
  if (verdict === 'block') return false

  const url = new URL(raw)
  if (verdict === 'confirm') {
    const options = {
      type: 'warning' as const,
      buttons: ['Open link', 'Cancel'],
      defaultId: 1,
      cancelId: 1,
      message: 'Open an external link?',
      detail: `This link leads to ${url.host}, a site Resource Pack Creator does not know.\n\n${url.href}`,
    }
    const parent = BrowserWindow.getFocusedWindow()
    const { response } = parent
      ? await dialog.showMessageBox(parent, options)
      : await dialog.showMessageBox(options)
    if (response !== 0) return false
  }

  await shell.openExternal(url.href)
  return true
}

/** Keeps every web contents on the app's own page: no navigation, popups or webviews. */
export function hardenWebContents(contents: WebContents): void {
  contents.on('will-navigate', (event, url) => {
    if (isAppUrl(url)) return
    event.preventDefault()
    void openExternalSafely(url)
  })
  contents.setWindowOpenHandler(({ url }) => {
    void openExternalSafely(url)
    return { action: 'deny' }
  })
  contents.on('will-attach-webview', (event) => event.preventDefault())
}
