import { expect, test, type Page } from '@playwright/test'
import { PerspectiveCamera, Vector3 } from 'three'
import {
  CAMERA_DIRECTION,
  cameraDistance,
  FOV,
  type PreviewKind,
} from '../../src/renderer/src/preview/camera'
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
const history = () => page.getByRole('list', { name: 'History' }).getByRole('button')
const tab = (name: string) =>
  page
    .getByRole('tablist', { name: 'Textures of this block' })
    .getByRole('tab', { name, exact: true })

/** Where a point of the model (block units, centred on 0) appears on the screen. */
async function aim(kind: PreviewKind, point: [number, number, number]) {
  await expect(preview()).toHaveAttribute('data-ready', 'true')
  const box = (await preview().boundingBox())!
  const aspect = box.width / box.height
  const radius = Number(await preview().getAttribute('data-radius'))
  const camera = new PerspectiveCamera(FOV, aspect, 0.05, 50)
  const [cx, cy, cz] = CAMERA_DIRECTION[kind]
  camera.position.set(cx, cy, cz).setLength(cameraDistance(radius, aspect))
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

async function clickAt(kind: PreviewKind, point: [number, number, number]) {
  const { x, y } = await aim(kind, point)
  await page.mouse.click(x, y)
}

/**
 * Paints at a point of the model and returns the texture pixel that the app showed under the
 * mouse. The aim may be off by a pixel (the app's camera, not the test's, decides), but the
 * painted pixel must be the one the app pointed at.
 */
async function paintAt(
  kind: PreviewKind,
  point: [number, number, number],
  near: [number, number],
): Promise<[number, number]> {
  const { x, y } = await aim(kind, point)
  await page.mouse.move(x, y)
  const cursor = page.getByLabel('Cursor position')
  await expect(cursor).toHaveText(/^\d+, \d+$/)
  const [px, py] = (await cursor.textContent())!.split(', ').map(Number)
  expect(Math.abs(px - near[0])).toBeLessThanOrEqual(1)
  expect(Math.abs(py - near[1])).toBeLessThanOrEqual(1)
  await page.mouse.click(x, y)
  return [px, py]
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
  await expect(status).toHaveText('Saved')
}

const RED = [255, 0, 0, 255]

test('shows the textures of a block as one entry', async () => {
  await expect(page.getByText('10 of 10 textures')).toBeVisible()
  await expect(tiles()).toHaveCount(8)
  await expect(page.getByRole('button', { name: 'Grass Block, 3 textures' })).toBeVisible()

  await page.getByRole('button', { name: 'Blocks', exact: true }).click()
  await expect(tiles()).toHaveCount(10)
  await expect(page.getByRole('button', { name: 'Grass Block Top' })).toBeVisible()
  await page.getByRole('button', { name: 'Blocks', exact: true }).click()
  await expect(tiles()).toHaveCount(8)

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
  const [px, py] = await paintAt('block', [x, 0.5 - y, 0.5], [8, 12])
  await saved()
  expect(await packPixel('block/grass_block_side.png', px, py)).toEqual(RED)
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
  // The top texture is open: its own, fresh history.
  await expect(history()).toHaveText(['Opened'])
  await expect(page.getByRole('status', { name: 'Save status' })).toHaveText('Saved')
  const [px, py] = await paintAt('block', top, [8, 8])
  await saved()
  await expect(history()).toHaveText(['Opened', 'Pencil'])
  expect(await packPixel('block/grass_block_top.png', px, py)).toEqual(RED)

  await page.keyboard.press('Control+z')
  await saved()
  expect(await packPixel('block/grass_block_top.png', px, py)).toEqual([150, 150, 150, 255])

  // Each texture keeps its own history while the block is open.
  await tab('Side').click()
  await expect(history()).toHaveText(['Opened', 'Pencil'])
  await expect(tab('Side')).toHaveAttribute('aria-selected', 'true')
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
  const [px, py] = await paintAt('item', [x, 0.5 - y, 1 / 32], [5, 2])
  await saved()
  expect(await packPixel('item/diamond_sword.png', px, py)).toEqual(RED)
})

test('shows mobs with their model and paints them', async () => {
  await page.getByRole('button', { name: 'Creeper', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Creeper' })).toBeVisible()
  await expect(preview()).toHaveAttribute('data-ready', 'true')
  // The middle of the view is the creeper's body.
  const box = (await preview().boundingBox())!
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  await saved()
  await expect(history()).toHaveText(['Opened', 'Pencil'])

  const red = await page.evaluate(async () => {
    const bytes = await window.api.textures.readImage('pack', 'entity/creeper/creeper.png')
    const bitmap = await createImageBitmap(new Blob([bytes as Uint8Array<ArrayBuffer>]), {
      premultiplyAlpha: 'none',
      colorSpaceConversion: 'none',
    })
    const context = new OffscreenCanvas(bitmap.width, bitmap.height).getContext('2d')!
    context.drawImage(bitmap, 0, 0)
    const { data } = context.getImageData(0, 0, bitmap.width, bitmap.height)
    const found: [number, number][] = []
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] === 255 && data[i + 1] === 0 && data[i + 2] === 0) {
        found.push([(i / 4) % bitmap.width, Math.floor(i / 4 / bitmap.width)])
      }
    }
    return found
  })
  // One pixel, in the body's part of the creeper's texture (16, 16 to 40, 32).
  expect(red).toHaveLength(1)
  const [[x, y]] = red
  expect(x >= 16 && x < 40 && y >= 16 && y < 32).toBe(true)
})
