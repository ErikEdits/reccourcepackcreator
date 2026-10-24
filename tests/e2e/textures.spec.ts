import { expect, test, type Page } from '@playwright/test'
import { unzipSync } from 'fflate'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { solidPng, WATER_MCMETA } from '../helpers/png'
import { INSTALLED_VERSION, launchApp, type LaunchedApp } from './launch'

let launched: LaunchedApp
let page: Page
let textureDir: string

test.describe.configure({ mode: 'serial' })

const pngSize = (file: string): [number, number] => {
  const bytes = readFileSync(file)
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)]
}

test.beforeAll(async () => {
  launched = await launchApp()
  page = launched.page

  // Create a 32× pack for the installed version, then open it from the start screen.
  const parentDir = await page.evaluate(() => window.api.project.defaultLocation())
  const created = await page.evaluate(
    ({ parentDir, version }) =>
      window.api.project.create({
        name: 'Texture Pack',
        description: '',
        minecraftVersion: version,
        resolution: 32,
        license: 'MIT',
        parentDir,
        icon: null,
      }),
    { parentDir, version: INSTALLED_VERSION },
  )
  expect(created.ok).toBe(true)
  textureDir = join(parentDir, 'Texture Pack', 'assets', 'minecraft', 'textures')

  await page.reload()
  await page.getByRole('region', { name: 'Recent packs' }).getByRole('button').first().click()
  await expect(page.getByRole('heading', { name: 'Texture Pack' })).toBeVisible()
})

test.afterAll(async () => {
  await launched?.close()
})

const textures = () => page.getByRole('list', { name: 'Textures' }).getByRole('listitem')

test('lists the textures of the installed Minecraft version', async () => {
  await expect(page.getByText('5 of 5 textures')).toBeVisible()
  await expect(textures()).toHaveCount(5)
  await expect(page.getByText('0 / 5 textures changed')).toBeVisible()
})

test('filters by name, category and colour', async () => {
  const search = page.getByLabel('Search textures')
  await search.fill('wool')
  await expect(textures()).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Red Wool' })).toBeVisible()
  await search.fill('')

  await page.getByLabel('Category').selectOption('items')
  await expect(textures()).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Diamond Sword' })).toBeVisible()
  await page.getByLabel('Category').selectOption('all')

  await page.getByRole('radio', { name: 'Red', exact: true }).click()
  await expect(textures()).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Red Wool' })).toBeVisible()
  await page.getByRole('radio', { name: 'Blue' }).click()
  await expect(page.getByRole('button', { name: 'Water Still' })).toBeVisible()
  await page.getByRole('radio', { name: 'Any colour' }).click()
  await expect(textures()).toHaveCount(5)
})

test('switches between grid and list view', async () => {
  await page.getByRole('button', { name: 'List view' }).click()
  await expect(page.getByText('block/red_wool.png')).toBeVisible()
  await page.getByRole('button', { name: 'Grid view' }).click()
  await expect(page.getByText('block/red_wool.png')).toBeHidden()
})

test('replaces a texture, scaled to the pack resolution', async () => {
  await page.getByRole('button', { name: 'Stone', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Stone' })).toBeVisible()

  await page.getByLabel('Choose replacement image').setInputFiles({
    name: 'stone.png',
    mimeType: 'image/png',
    buffer: solidPng(8, 8, [20, 160, 40, 255]),
  })
  await expect(page.getByRole('status').filter({ hasText: 'Replaced “Stone”' })).toBeVisible()

  expect(pngSize(join(textureDir, 'block', 'stone.png'))).toEqual([32, 32])
  await expect(page.getByText('1 / 5 textures changed')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Stone, changed' })).toBeVisible()

  await page.getByRole('button', { name: 'Changed', exact: true }).click()
  await expect(textures()).toHaveCount(1)
  await page.getByRole('button', { name: 'Changed', exact: true }).click()
})

test('keeps animations when a strip is dropped onto an animated texture', async () => {
  await page.getByRole('button', { name: 'Water Still' }).click()
  const strip = [...solidPng(16, 48, [30, 60, 220, 255])]
  const dataTransfer = await page.evaluateHandle((bytes) => {
    const transfer = new DataTransfer()
    transfer.items.add(new File([new Uint8Array(bytes)], 'water.png', { type: 'image/png' }))
    return transfer
  }, strip)
  await page
    .getByLabel('Texture preview')
    .locator('xpath=..')
    .dispatchEvent('drop', { dataTransfer })
  await expect(page.getByRole('status').filter({ hasText: 'Replaced “Water Still”' })).toBeVisible()

  expect(pngSize(join(textureDir, 'block', 'water_still.png'))).toEqual([32, 96])
  expect(readFileSync(join(textureDir, 'block', 'water_still.png.mcmeta'), 'utf8')).toBe(
    WATER_MCMETA,
  )
})

test('exports textures under the names of older versions', async () => {
  await page.getByRole('button', { name: 'Back to pack' }).click()
  await page.getByRole('button', { name: 'Export…' }).click()
  const dialog = page.getByRole('dialog', { name: 'Export pack' })
  await dialog.getByRole('button', { name: 'None' }).click()
  await dialog.getByRole('checkbox', { name: '1.12.2', exact: true }).check()
  await dialog
    .getByRole('button', { name: 'Export', exact: true })
    // A short timeout: nothing (like a message) may cover the button.
    .click({ timeout: 2000 })
  await expect(
    page.getByRole('status').filter({ hasText: 'renamed to match older or newer versions' }),
  ).toBeVisible()

  const zip = unzipSync(
    readFileSync(join(launched.dirs.downloads, 'Texture Pack_v1.0.0_MC1.12.2.zip')),
  )
  expect(Object.keys(zip).sort()).toEqual([
    'assets/minecraft/textures/blocks/stone.png',
    'assets/minecraft/textures/blocks/water_still.png',
    'assets/minecraft/textures/blocks/water_still.png.mcmeta',
    'pack.mcmeta',
  ])
})

test('reverts a texture to the original', async () => {
  await page.getByRole('button', { name: 'Stone, changed' }).click()
  page.once('dialog', (dialog) => void dialog.accept())
  await page.getByRole('button', { name: 'Revert to original' }).click()

  await expect(page.getByRole('button', { name: 'Stone', exact: true })).toBeVisible()
  expect(existsSync(join(textureDir, 'block', 'stone.png'))).toBe(false)
  await expect(page.getByText('1 / 5 textures changed')).toBeVisible()
})

test('shows where the game files come from', async () => {
  await page.getByRole('button', { name: 'Settings' }).click()
  const dialog = page.getByRole('dialog', { name: 'Settings' })
  await expect(dialog.getByText(join(launched.dirs.root, '.minecraft'))).toBeVisible()
  await expect(dialog.getByText('Found. Installed versions are read from here.')).toBeVisible()
  await expect(dialog.getByText('0.0 MB')).toBeVisible()
  await dialog.getByRole('button', { name: 'Close' }).click()
})
