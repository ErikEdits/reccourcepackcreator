import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { makeClientJar } from '../helpers/png'

// Chromium's OS-level sandbox cannot start as root (containers) or on CI runners whose
// AppArmor policy blocks user namespaces. The renderer sandbox (webPreferences) stays on.
const chromiumArgs = process.env.CI || process.getuid?.() === 0 ? ['--no-sandbox'] : []

/** The fake installation only has this version, so tests never download from Mojang. */
export const INSTALLED_VERSION = '1.21.4'

export interface LaunchedApp {
  app: ElectronApplication
  page: Page
  /** Fresh home (with a fake .minecraft), profile, Documents and Downloads for this run. */
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
  const versionDir = join(root, '.minecraft', 'versions', INSTALLED_VERSION)
  mkdirSync(versionDir, { recursive: true })
  writeFileSync(join(versionDir, `${INSTALLED_VERSION}.jar`), makeClientJar())

  const app = await electron.launch({
    args: [...chromiumArgs, `--user-data-dir=${dirs.userData}`, resolve(__dirname, '../..')],
    // The app looks for ~/.minecraft, so a temporary home holds the fake installation.
    env: { ...process.env, HOME: root },
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
