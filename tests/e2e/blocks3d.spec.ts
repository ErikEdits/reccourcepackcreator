import { expect, test, type Page } from '@playwright/test'
import { PerspectiveCamera, Vector3 } from 'three'
import { CAMERA_DIRECTION, cameraDistance, FOV } from '../../src/renderer/src/preview/camera'
import { INSTALLED_VERSION, launchApp, type LaunchedApp } from './launch'

let launched: LaunchedApp
let page: Page

test.describe.configure({ mode: 'serial' })

test.beforeAll(async () => {
  // This time the fake game files have block models, like Minecraft 1.8 and later.
  launched = await launchApp({ models: true })
  page = launched.page

  const parentDir = await page.evaluate(() => window.api.project.defaultLocation())
  const created = await page.evaluate(
    ({ parentDir, version }) =>
      window.api.project.create({
        name: 'Block Pack',
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

  await page.reload()
  await page.getByRole('region', { name: 'Recent packs' }).getByRole('button').first().click()
  await expect(page.getByRole('heading', { name: 'Block Pack' })).toBeVisible()
})

test.afterAll(async () => {
  await launched?.close()
})

const tiles = () => page.getByRole('list', { name: 'Textures' }).getByRole('listitem')
const preview = () => page.getByLabel('3D preview')
const tab = (name: string) =>
  page
    .getByRole('tablist', { name: 'Textures of this block' })
    .getByRole('tab', { name, exact: true })

/** Where a point of the model (block units, centred on 0) appears on the screen. */
async function aim(kind: 'block' | 'item', point: [number, number, number]) {
  await expect(preview()).toHaveAttribute('data-ready', 'true')
  const box = (await preview().boundingBox())!
  const aspect = box.width / box.height
  const camera = new PerspectiveCamera(FOV, aspect, 0.05, 50)
  const [cx, cy, cz] = CAMERA_DIRECTION[kind]
  camera.position.set(cx, cy, cz).setLength(cameraDistance(kind, aspect))
  camera.lookAt(0, 0, 0)
  camera.updateMatrixWorld()
  const projected = new Vector3(...point).project(camera)
  return {
    x: box.x + ((projected.x + 1) / 2) * box.width,
    y: box.y + ((1 - projected.y) / 2) * box.height,
  }
}

/** The centre of texture pixel (x, y) on a face, in block units. */
const pixel = (x: number, y: number): [number, number] => [(x + 0.5) / 16 - 0.5, (y + 0.5) / 16]

async function clickAt(kind: 'block' | 'item', point: [number, number, number]) {
  const { x, y } = await aim(kind, point)
  await page.mouse.click(x, y)
}

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

async function saved() {
  const status = page.getByRole('status', { name: 'Save status' })
  await expect(status).toHaveText('Saving…')
  await expect(status).toHaveText('All changes saved')
}

const RED = [255, 0, 0, 255]

test('shows the textures of a block as one entry', async () => {
  await expect(page.getByText('9 of 9 textures')).toBeVisible()
  await expect(tiles()).toHaveCount(7)
  await expect(page.getByRole('button', { name: 'Grass Block, 3 textures' })).toBeVisible()

  await page.getByRole('button', { name: 'Blocks', exact: true }).click()
  await expect(tiles()).toHaveCount(9)
  await expect(page.getByRole('button', { name: 'Grass Block Top' })).toBeVisible()
  await page.getByRole('button', { name: 'Blocks', exact: true }).click()
  await expect(tiles()).toHaveCount(7)

  await page.getByLabel('Search textures').fill('grass block')
  await expect(tiles()).toHaveCount(1)
  await page.getByLabel('Search textures').fill('')
})

test('opens a block with a tab per texture and a 3D view', async () => {
  await page.getByRole('button', { name: 'Grass Block, 3 textures' }).click()
  await expect(page.getByRole('heading', { name: 'Grass Block' })).toBeVisible()
  await expect(tab('Side')).toHaveAttribute('aria-selected', 'true')
  await expect(tab('Top')).toBeVisible()
  await expect(tab('Side Overlay')).toBeVisible()
  await expect(preview()).toHaveAttribute('data-ready', 'true')
  await expect(preview().locator('canvas')).toBeVisible()
})

test('paints on the model in 3D', async () => {
  await page.getByLabel('Hex colour').fill('#ff0000')
  await page.getByLabel('Hex colour').blur()
  await page.keyboard.press('b')
  // The front (south) face, below the grass overlay: pixel (8, 12) of the side texture.
  const [x, y] = pixel(8, 12)
  await clickAt('block', [x, 0.5 - y, 0.5])
  await saved()
  expect(await packPixel('block/grass_block_side.png', 8, 12)).toEqual(RED)
  // The 2D editor shows the same texture.
  await expect(page.getByRole('list', { name: 'History' }).getByRole('button')).toHaveText([
    'Opened',
    'Pencil',
  ])
})

test('switches to the texture of a face that is clicked, then paints it', async () => {
  // The top face, pixel (8, 8): its texture runs from north (top) to south.
  const [x, v] = pixel(8, 8)
  const top: [number, number, number] = [x, 0.5, v - 0.5]
  await clickAt('block', top)
  await expect(tab('Top')).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('heading', { name: 'Grass Block' })).toBeVisible()
  await expect(page.getByRole('status', { name: 'Save status' })).toHaveText('All changes saved')
  await clickAt('block', top)
  await saved()
  expect(await packPixel('block/grass_block_top.png', 8, 8)).toEqual(RED)

  await page.keyboard.press('Control+z')
  await saved()
  expect(await packPixel('block/grass_block_top.png', 8, 8)).toEqual([150, 150, 150, 255])

  // Each texture keeps its own history while the block is open.
  await tab('Side').click()
  await expect(page.getByRole('list', { name: 'History' }).getByRole('button')).toHaveText([
    'Opened',
    'Pencil',
  ])
})

test('shows 2D, 3D or both', async () => {
  await page.getByRole('button', { name: '3D', exact: true }).click()
  await expect(page.getByLabel('Texture canvas')).toBeHidden()
  await expect(preview()).toBeVisible()
  await page.getByRole('button', { name: '2D', exact: true }).click()
  await expect(preview()).toBeHidden()
  await expect(page.getByLabel('Texture canvas')).toBeVisible()
  await page.getByRole('button', { name: '2D + 3D' }).click()
  await expect(preview()).toBeVisible()
})

test('paints items in 3D', async () => {
  await page.getByRole('button', { name: 'Diamond Sword' }).click()
  await expect(page.getByRole('heading', { name: 'Diamond Sword' })).toBeVisible()
  // A transparent pixel next to the blade: painting it adds to the item's shape.
  const [x, y] = pixel(5, 2)
  await clickAt('item', [x, 0.5 - y, 1 / 32])
  await saved()
  expect(await packPixel('item/diamond_sword.png', 5, 2)).toEqual(RED)
})
