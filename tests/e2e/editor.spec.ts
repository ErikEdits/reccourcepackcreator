import { expect, test, type Page } from '@playwright/test'
import { unzipSync } from 'fflate'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { INSTALLED_VERSION, launchApp, type LaunchedApp } from './launch'

let launched: LaunchedApp
let page: Page
let packDir: string

test.describe.configure({ mode: 'serial' })

test.beforeAll(async () => {
  launched = await launchApp()
  page = launched.page

  const parentDir = await page.evaluate(() => window.api.project.defaultLocation())
  const created = await page.evaluate(
    ({ parentDir, version }) =>
      window.api.project.create({
        name: 'Editor Pack',
        description: '',
        minecraftVersion: version,
        resolution: 16,
        license: 'MIT',
        parentDir,
        icon: null,
      }),
    { parentDir, version: INSTALLED_VERSION },
  )
  expect(created.ok).toBe(true)
  packDir = join(parentDir, 'Editor Pack')

  await page.reload()
  await page.getByRole('region', { name: 'Recent packs' }).getByRole('button').first().click()
  await expect(page.getByRole('heading', { name: 'Editor Pack' })).toBeVisible()
  await expect(page.getByText('5 of 5 textures')).toBeVisible()
})

test.afterAll(async () => {
  await launched?.close()
})

const canvas = () => page.getByLabel('Texture canvas')
const editor = () => page.getByRole('region', { name: 'Editor' })

/** Where a texture pixel is on the screen, from the zoom and origin the canvas reports. */
async function pixelPosition(x: number, y: number): Promise<{ x: number; y: number }> {
  const box = (await canvas().boundingBox())!
  const zoom = Number(await canvas().getAttribute('data-zoom'))
  const originX = Number(await canvas().getAttribute('data-origin-x'))
  const originY = Number(await canvas().getAttribute('data-origin-y'))
  return { x: box.x + originX + (x + 0.5) * zoom, y: box.y + originY + (y + 0.5) * zoom }
}

async function clickPixel(x: number, y: number, button: 'left' | 'right' = 'left') {
  const point = await pixelPosition(x, y)
  await page.mouse.click(point.x, point.y, { button })
}

async function dragPixels(from: [number, number], to: [number, number]) {
  const start = await pixelPosition(...from)
  const end = await pixelPosition(...to)
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(end.x, end.y, { steps: 8 })
  await page.mouse.up()
}

/** RGBA of a pixel of the PNG in the pack, decoded by the browser. */
function packPixel(path: string, x: number, y: number): Promise<number[] | null> {
  return page.evaluate(
    async ({ path, x, y }) => {
      const bytes = await window.api.textures.readImage('pack', path)
      if (!bytes) return null
      const bitmap = await createImageBitmap(new Blob([bytes as Uint8Array<ArrayBuffer>]), {
        premultiplyAlpha: 'none',
        colorSpaceConversion: 'none',
      })
      const context = new OffscreenCanvas(bitmap.width, bitmap.height).getContext('2d')!
      context.drawImage(bitmap, 0, 0)
      return [...context.getImageData(x, y, 1, 1).data]
    },
    { path, x, y },
  )
}

/** Waits for the automatic save that the last action started (it waits 400 ms for more). */
async function saved() {
  const status = page.getByRole('status', { name: 'Save status' })
  await expect(status).toHaveText('Saving…')
  await expect(status).toHaveText('All changes saved')
}

async function setColour(hex: string) {
  await page.getByLabel('Hex colour').fill(hex)
  await page.getByLabel('Hex colour').blur()
}

test('opens a texture in the editor without changing the pack', async () => {
  await page.getByRole('button', { name: 'Red Wool' }).click()
  await expect(page.getByRole('heading', { name: 'Red Wool' })).toBeVisible()
  await expect(canvas()).toBeVisible()
  await expect(editor().getByText('16 × 16 px')).toBeVisible()
  await expect(page.getByRole('toolbar', { name: 'Tools' })).toBeVisible()
  // The original's colours are offered as a palette.
  await expect(
    page.getByRole('list', { name: 'Colours of the original' }).getByRole('button'),
  ).toHaveCount(1)
  expect(await packPixel('block/red_wool.png', 0, 0)).toBeNull()
})

test('draws with the pencil and saves the texture into the pack', async () => {
  await setColour('#00ff00')
  await clickPixel(2, 3)
  await saved()
  expect(await packPixel('block/red_wool.png', 2, 3)).toEqual([0, 255, 0, 255])
  expect(await packPixel('block/red_wool.png', 0, 0)).toEqual([200, 30, 30, 255])
  await expect(editor().getByText('Changed in your pack')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Red Wool, changed' })).toBeVisible()
})

test('paints the second colour with the right mouse button and draws lines', async () => {
  await page.keyboard.press('x') // swap: green is now the second colour
  await clickPixel(5, 5, 'right')
  await page.keyboard.press('l')
  await expect(page.getByRole('button', { name: 'Line (L)' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await dragPixels([0, 10], [6, 10])
  await saved()
  expect(await packPixel('block/red_wool.png', 5, 5)).toEqual([0, 255, 0, 255])
  // The first colour is the old second one: white.
  expect(await packPixel('block/red_wool.png', 3, 10)).toEqual([255, 255, 255, 255])
  expect(await packPixel('block/red_wool.png', 7, 10)).toEqual([200, 30, 30, 255])
})

test('undoes and redoes with the keyboard and the history panel', async () => {
  const history = page.getByRole('list', { name: 'History' })
  await expect(history.getByRole('button')).toHaveText(['Opened', 'Pencil', 'Pencil', 'Line'])
  await page.keyboard.press('Control+z')
  await saved()
  expect(await packPixel('block/red_wool.png', 3, 10)).toEqual([200, 30, 30, 255])
  await page.keyboard.press('Control+Shift+z')
  await saved()
  expect(await packPixel('block/red_wool.png', 3, 10)).toEqual([255, 255, 255, 255])
  await history.getByRole('button', { name: 'Opened' }).click()
  await saved()
  expect(await packPixel('block/red_wool.png', 2, 3)).toEqual([200, 30, 30, 255])
  await history.getByRole('button', { name: 'Line' }).click()
  await saved()
  expect(await packPixel('block/red_wool.png', 2, 3)).toEqual([0, 255, 0, 255])
})

test('fills only the connected area', async () => {
  await page.getByRole('button', { name: 'Diamond Sword' }).click()
  await expect(page.getByRole('heading', { name: 'Diamond Sword' })).toBeVisible()
  await page.keyboard.press('g')
  await setColour('#ff00ff')
  await clickPixel(0, 15)
  await saved()
  expect(await packPixel('item/diamond_sword.png', 0, 15)).toEqual([255, 0, 255, 255])
  // The diagonal blade separates the two transparent halves.
  expect((await packPixel('item/diamond_sword.png', 15, 0))?.[3]).toBe(0)
  expect(await packPixel('item/diamond_sword.png', 4, 4)).toEqual([60, 220, 210, 255])
})

test('keeps layers in the project but only the picture in exports', async () => {
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(page.getByRole('list', { name: 'Layers' }).getByRole('listitem')).toHaveCount(2)
  await page.keyboard.press('b')
  await setColour('#0000ff')
  await clickPixel(15, 0)
  await saved()
  expect(await packPixel('item/diamond_sword.png', 15, 0)).toEqual([0, 0, 255, 255])
  const layersFile = join(packDir, '.rpc', 'layers', 'item', 'diamond_sword.png.json')
  expect(JSON.parse(readFileSync(layersFile, 'utf8')).layers).toHaveLength(2)

  // Reopening the texture brings the layers back.
  await page.getByRole('button', { name: 'Back to pack' }).click()
  await page.getByRole('button', { name: 'Diamond Sword, changed' }).click()
  await expect(page.getByRole('list', { name: 'Layers' }).getByRole('listitem')).toHaveCount(2)

  await page.getByRole('button', { name: 'Back to pack' }).click()
  await page.getByRole('button', { name: 'Export…' }).click()
  const dialog = page.getByRole('dialog', { name: 'Export pack' })
  await dialog.getByRole('button', { name: 'None' }).click()
  await dialog.getByRole('checkbox', { name: INSTALLED_VERSION, exact: true }).check()
  await dialog.getByRole('button', { name: 'Export', exact: true }).click({ timeout: 2000 })
  await expect(page.getByRole('status').filter({ hasText: 'Exported 1 ZIP file' })).toBeVisible()
  const zipName = `Editor Pack_v1.0.0_MC${INSTALLED_VERSION}.zip`
  const zip = unzipSync(readFileSync(join(launched.dirs.downloads, zipName)))
  expect(Object.keys(zip).sort()).toEqual([
    'assets/minecraft/textures/block/red_wool.png',
    'assets/minecraft/textures/item/diamond_sword.png',
    'pack.mcmeta',
  ])
})

test('selects, moves and flips pixels', async () => {
  await page.getByRole('button', { name: 'Red Wool, changed' }).click()
  await page.keyboard.press('m')
  await dragPixels([2, 3], [2, 3])
  await page.keyboard.press('Control+a')
  await expect(editor().getByText('Selection 16 × 16')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(editor().getByText(/^Selection/)).toBeHidden()

  await dragPixels([2, 3], [3, 4])
  await expect(editor().getByText('Selection 2 × 2')).toBeVisible()
  await page.keyboard.press('v')
  await dragPixels([2, 3], [12, 3])
  await saved()
  expect(await packPixel('block/red_wool.png', 12, 3)).toEqual([0, 255, 0, 255])
  expect((await packPixel('block/red_wool.png', 2, 3))?.[3]).toBe(0)

  await page.keyboard.press('Shift+h')
  await saved()
  expect(await packPixel('block/red_wool.png', 13, 3)).toEqual([0, 255, 0, 255])
})

test('reverts to the original and removes the layers', async () => {
  await page.getByRole('button', { name: 'Diamond Sword, changed' }).click()
  page.once('dialog', (dialog) => void dialog.accept())
  await page.getByRole('button', { name: 'Revert to original' }).click()
  await expect(editor().getByText('Original', { exact: true })).toBeVisible()
  expect(
    existsSync(join(packDir, 'assets', 'minecraft', 'textures', 'item', 'diamond_sword.png')),
  ).toBe(false)
  expect(existsSync(join(packDir, '.rpc', 'layers', 'item', 'diamond_sword.png.json'))).toBe(false)
  await expect(page.getByRole('list', { name: 'Layers' }).getByRole('listitem')).toHaveCount(1)
})

test('lets shortcuts be changed in the settings', async () => {
  await page.getByRole('button', { name: 'Settings' }).click()
  const dialog = page.getByRole('dialog', { name: 'Settings' })
  await dialog.getByRole('button', { name: 'Shortcut for Pencil' }).click()
  await page.keyboard.press('p')
  await expect(dialog.getByRole('button', { name: 'Shortcut for Pencil' })).toHaveText('P')
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()

  await page.keyboard.press('g')
  await page.keyboard.press('p')
  await expect(page.getByRole('button', { name: 'Pencil (P)' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
})
