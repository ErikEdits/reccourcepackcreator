import {
  _electron as electron,
  expect,
  test,
  type ElectronApplication,
  type Page,
} from '@playwright/test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

// Chromium's OS-level sandbox cannot start as root (containers) or on CI runners whose
// AppArmor policy blocks user namespaces. The renderer sandbox (webPreferences) stays on.
const chromiumArgs = process.env.CI || process.getuid?.() === 0 ? ['--no-sandbox'] : []

let app: ElectronApplication
let page: Page
let userDataDir: string

test.beforeAll(async () => {
  // A fresh profile per run, so saved settings never leak between runs.
  userDataDir = mkdtempSync(join(tmpdir(), 'rpc-e2e-'))
  app = await electron.launch({
    args: [...chromiumArgs, `--user-data-dir=${userDataDir}`, resolve(__dirname, '../..')],
  })
  page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')
})

test.afterAll(async () => {
  await app?.close()
  rmSync(userDataDir, { recursive: true, force: true })
})

test('starts with a fresh profile', async () => {
  const path = await app.evaluate(({ app }) => app.getPath('userData'))
  expect(path).toBe(userDataDir)
})

test('shows the three-column workspace', async () => {
  await expect(page).toHaveTitle('Resource Pack Creator')
  await expect(page.getByRole('region', { name: 'Pack contents' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Editor' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Properties' })).toBeVisible()
})

test('runs the renderer with hardened web preferences', async () => {
  const prefs = await app.evaluate(({ BrowserWindow }) => {
    const [window] = BrowserWindow.getAllWindows()
    // Undocumented but stable getter; there is no public API to read these back.
    const contents = window.webContents as unknown as {
      getLastWebPreferences(): Record<string, unknown> | null
    }
    const web = contents.getLastWebPreferences()
    return {
      sandbox: web?.sandbox,
      contextIsolation: web?.contextIsolation,
      nodeIntegration: web?.nodeIntegration,
    }
  })
  expect(prefs).toEqual({ sandbox: true, contextIsolation: true, nodeIntegration: false })
})

test('gives the renderer no access to Node.js', async () => {
  const globals = await page.evaluate(() => ({
    require: typeof (window as unknown as { require?: unknown }).require,
    process: typeof (window as unknown as { process?: unknown }).process,
    api: typeof window.api,
  }))
  expect(globals).toEqual({ require: 'undefined', process: 'undefined', api: 'object' })
})

test('rejects IPC calls with invalid arguments', async () => {
  const error = await page.evaluate(() =>
    window.api.shell.openExternal(42 as unknown as string).then(
      () => null,
      (reason: Error) => reason.message,
    ),
  )
  expect(error).toContain('invalid arguments')
})

test('refuses to open non-web links', async () => {
  const opened = await page.evaluate(() => window.api.shell.openExternal('file:///etc/passwd'))
  expect(opened).toBe(false)
})

test('reports app info over IPC', async () => {
  const info = await page.evaluate(() => window.api.app.getInfo())
  expect(info.name).toBe('Resource Pack Creator')
  expect(info.version).toMatch(/^\d+\.\d+\.\d+/)
})

test('switches between simple and expert mode', async () => {
  const filesTab = page.getByRole('tab', { name: 'Files' })
  await expect(filesTab).toHaveCount(0)
  await page.getByRole('button', { name: 'Expert' }).click()
  await expect(filesTab).toBeVisible()
  await page.getByRole('button', { name: 'Simple' }).click()
  await expect(filesTab).toHaveCount(0)
})

test('cycles the theme through system, light and dark', async () => {
  const themeButton = page.getByRole('button', { name: /^Theme:/ })
  const isDark = () => page.evaluate(() => document.documentElement.classList.contains('dark'))

  await expect(themeButton).toHaveText('Theme: System')
  await themeButton.click()
  await expect(themeButton).toHaveText('Theme: Light')
  expect(await isDark()).toBe(false)
  await themeButton.click()
  await expect(themeButton).toHaveText('Theme: Dark')
  expect(await isDark()).toBe(true)
  await themeButton.click()
  await expect(themeButton).toHaveText('Theme: System')
})
