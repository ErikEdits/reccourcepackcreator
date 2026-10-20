import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

// Chromium's OS-level sandbox cannot start as root (containers) or on CI runners whose
// AppArmor policy blocks user namespaces. The renderer sandbox (webPreferences) stays on.
const chromiumArgs = process.env.CI || process.getuid?.() === 0 ? ['--no-sandbox'] : []

export interface LaunchedApp {
  app: ElectronApplication
  page: Page
  /** Fresh profile, Documents and Downloads folders for this run. */
  dirs: { root: string; userData: string; documents: string; downloads: string }
  close: () => Promise<void>
}

export async function launchApp(): Promise<LaunchedApp> {
  const root = mkdtempSync(join(tmpdir(), 'rpc-e2e-'))
  const dirs = {
    root,
    userData: join(root, 'user-data'),
    documents: join(root, 'Documents'),
    downloads: join(root, 'Downloads'),
  }
  const app = await electron.launch({
    args: [...chromiumArgs, `--user-data-dir=${dirs.userData}`, resolve(__dirname, '../..')],
  })
  await app.evaluate(({ app }, { documents, downloads }) => {
    app.setPath('documents', documents)
    app.setPath('downloads', downloads)
  }, dirs)
  const page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')

  return {
    app,
    page,
    dirs,
    close: async () => {
      await app.close()
      rmSync(root, { recursive: true, force: true })
    },
  }
}
