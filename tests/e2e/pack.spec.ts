import { expect, test, type Page } from '@playwright/test'
import { unzipSync } from 'fflate'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { groupByFormat, MINECRAFT_VERSIONS } from '../../src/shared/minecraft-versions'
import { launchApp, type LaunchedApp } from './launch'

// Smallest valid 1×1 PNG; the app scales it to a 128×128 pack.png.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
)

let launched: LaunchedApp
let page: Page
let packDir: string

test.describe.configure({ mode: 'serial' })

test.beforeAll(async () => {
  launched = await launchApp()
  page = launched.page
  packDir = join(launched.dirs.documents, 'Resource Pack Creator', 'E2E Pack')
})

test.afterAll(async () => {
  await launched?.close()
})

test('creates a pack with the wizard', async () => {
  await page.getByRole('button', { name: 'New pack' }).click()
  const wizard = page.getByRole('dialog', { name: 'New resource pack' })
  const next = wizard.getByRole('button', { name: 'Next' })

  await expect(next).toBeDisabled()
  await wizard.getByLabel('Pack name').fill('E2E Pack')
  await next.click()

  await wizard.getByLabel('Description').fill('Hello ')
  await wizard.getByRole('button', { name: 'Colour: Gold' }).click()
  await wizard.getByLabel('Description').press('End')
  await wizard.getByLabel('Description').pressSequentially('world')
  await expect(wizard.getByLabel('In-game preview')).toContainText('Hello world')
  await next.click()

  await wizard.getByLabel('Main Minecraft version').selectOption('1.21.4')
  await wizard.getByRole('radio', { name: '32×' }).click()
  await next.click()

  await wizard
    .getByLabel('Choose pack icon')
    .setInputFiles({ name: 'icon.png', mimeType: 'image/png', buffer: PNG })
  await expect(wizard.getByRole('button', { name: 'Remove icon' })).toBeVisible()
  await next.click()

  await wizard.getByRole('radio', { name: /CC BY 4\.0/ }).check()
  await next.click()

  await expect(wizard.getByText(packDir)).toBeVisible()
  await wizard.getByRole('button', { name: 'Create pack' }).click()

  await expect(wizard).toBeHidden()
  await expect(page.getByRole('heading', { name: 'E2E Pack' })).toBeVisible()

  const mcmeta = JSON.parse(readFileSync(join(packDir, 'pack.mcmeta'), 'utf8'))
  expect(mcmeta).toEqual({ pack: { pack_format: 46, description: 'Hello §6world' } })
  const icon = readFileSync(join(packDir, 'pack.png'))
  expect([icon.readUInt32BE(16), icon.readUInt32BE(20)]).toEqual([128, 128])
  const project = JSON.parse(readFileSync(join(packDir, '.rpc', 'project.json'), 'utf8'))
  expect(project).toMatchObject({ resolution: 32, license: 'CC-BY-4.0' })
})

test('exports one ZIP per pack format for all versions', async () => {
  await page.getByRole('button', { name: 'Export…' }).click()
  const dialog = page.getByRole('dialog', { name: 'Export pack' })
  await dialog.getByRole('button', { name: 'All versions' }).click()
  await dialog.getByLabel(/One ZIP per pack format/).check()
  await dialog.getByRole('button', { name: 'Export', exact: true }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByRole('status').filter({ hasText: 'Exported' })).toBeVisible()

  const files = readdirSync(launched.dirs.downloads)
  expect(files).toHaveLength(groupByFormat(MINECRAFT_VERSIONS).length)
  expect(files).toContain('E2E Pack_v1.0.0_MC1.6.1-1.8.9.zip')

  const oldest = unzipSync(
    readFileSync(join(launched.dirs.downloads, 'E2E Pack_v1.0.0_MC1.6.1-1.8.9.zip')),
  )
  expect(Object.keys(oldest).sort()).toEqual(['pack.mcmeta', 'pack.png'])
  expect(JSON.parse(Buffer.from(oldest['pack.mcmeta']).toString()).pack.pack_format).toBe(1)
})

test('reopens the pack from the recent list', async () => {
  await page.getByRole('button', { name: 'Close pack' }).click()
  const recent = page.getByRole('region', { name: 'Recent packs' })
  await recent.getByRole('button', { name: /E2E Pack/ }).click()
  await expect(page.getByRole('heading', { name: 'E2E Pack' })).toBeVisible()
})

test('refuses folders the user never chose', async () => {
  const result = await page.evaluate(() => window.api.project.open('/'))
  expect(result).toEqual({ ok: false, error: 'This folder has not been chosen in this app.' })

  const created = await page.evaluate(() =>
    window.api.project.create({
      name: 'Sneaky',
      description: '',
      minecraftVersion: '1.21.4',
      resolution: 16,
      license: 'MIT',
      parentDir: '/tmp',
      icon: null,
    }),
  )
  expect(created.ok).toBe(false)
  expect(existsSync('/tmp/Sneaky')).toBe(false)
})
