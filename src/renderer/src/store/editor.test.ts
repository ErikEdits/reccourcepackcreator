import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RendererApi } from '../../../shared/api'
import type { ProjectSummary } from '../../../shared/project'
import type { TextureRow } from '../../../shared/textures'
import { activeLayer, addLayer, compose } from '../editor/document'
import { currentDoc } from '../editor/history'
import { createBitmap, getPixel, setPixel, toHex, type Bitmap } from '../editor/pixels'
import { shortcutFromEvent, shortcutMap } from '../editor/shortcuts'
import { editActiveLayer, nextZoom, useEditor } from './editor'
import { flushPendingSaves } from './pending-saves'
import { useProject } from './project'

// The canvas is not available in Node: images are passed around as bitmaps instead.
const images = new Map<number, Bitmap>()
vi.mock('../lib/images', () => ({
  decodeImage: async (bytes: Uint8Array) => images.get(bytes[0])!,
  encodePng: async () => new Uint8Array([0]),
  bytesToBase64: () => 'AA==',
  base64ToBytes: () => new Uint8Array([0]),
}))

const RED = [255, 0, 0, 255] as const
const summary = { dir: '/packs/test', files: [] } as unknown as ProjectSummary

const row: TextureRow = {
  path: 'block/stone.png',
  name: 'stone',
  category: 'blocks',
  changed: false,
  added: false,
  vanilla: { path: 'block/stone.png', width: 2, height: 2, animated: false, colour: 'grey' },
}

function stubApi() {
  const original = createBitmap(2, 2)
  setPixel(original, 0, 0, RED)
  images.set(1, original)
  const api = {
    readImage: vi.fn(async (source: string) => (source === 'vanilla' ? new Uint8Array([1]) : null)),
    readLayers: vi.fn(async () => null),
    saveEdit: vi.fn<RendererApi['textures']['saveEdit']>(async () => ({
      ok: true as const,
      value: summary,
    })),
    revert: vi.fn(async () => ({ ok: true as const, value: summary })),
  }
  window.api = { textures: api } as unknown as typeof window.api
  return api
}

const doc = () => currentDoc(useEditor.getState().history!)

beforeEach(() => {
  vi.stubGlobal('window', {})
  useProject.setState({ summary })
})

afterEach(async () => {
  await useEditor.getState().close()
  vi.unstubAllGlobals()
})

describe('editor store', () => {
  it('opens an original texture at the pack resolution without saving it', async () => {
    const api = stubApi()
    await useEditor.getState().open(row, 32)
    expect(useEditor.getState().status).toBe('ready')
    expect(doc().width).toBe(4)
    expect(toHex(getPixel(compose(doc()), 1, 1))).toBe('#ff0000')
    expect(useEditor.getState().originalPalette.map(toHex)).toEqual(['#ff0000'])
    await flushPendingSaves()
    expect(api.saveEdit).not.toHaveBeenCalled()
  })

  it('saves changes, with layers only when there is more than one', async () => {
    const api = stubApi()
    const editor = useEditor.getState()
    await editor.open(row, 16)
    editor.commit(
      'Pencil',
      editActiveLayer(doc(), (pixels) => setPixel(pixels, 1, 1, RED)),
    )
    expect(useEditor.getState().saveState).toBe('unsaved')
    await flushPendingSaves()
    expect(api.saveEdit).toHaveBeenLastCalledWith('block/stone.png', expect.any(Uint8Array), null)
    expect(useEditor.getState().saveState).toBe('saved')

    editor.commit('Add layer', addLayer(doc()))
    await flushPendingSaves()
    const layers = JSON.parse(api.saveEdit.mock.lastCall![2]!)
    expect(layers.layers).toHaveLength(2)
  })

  it('never saves into a pack that was switched in the meantime', async () => {
    const api = stubApi()
    await useEditor.getState().open(row, 16)
    useEditor.getState().commit('Add layer', addLayer(doc()))
    useProject.setState({ summary: { ...summary, dir: '/packs/other' } })
    await flushPendingSaves()
    expect(api.saveEdit).not.toHaveBeenCalled()
  })

  it('undoes, redoes and keeps the selection inside the texture', async () => {
    stubApi()
    const editor = useEditor.getState()
    await editor.open(row, 16)
    editor.commit('Add layer', addLayer(doc()))
    expect(doc().layers).toHaveLength(2)
    editor.undo()
    expect(doc().layers).toHaveLength(1)
    editor.redo()
    expect(doc().layers).toHaveLength(2)
    editor.setSelection({ x: 1, y: 1, width: 5, height: 5 })
    expect(useEditor.getState().selection).toEqual({ x: 1, y: 1, width: 1, height: 1 })
  })

  it('copies, pastes onto a new layer and transforms', async () => {
    stubApi()
    const editor = useEditor.getState()
    await editor.open(row, 16)
    editor.setSelection({ x: 0, y: 0, width: 1, height: 1 })
    editor.copy()
    editor.setSelection({ x: 1, y: 0, width: 1, height: 1 })
    editor.paste()
    expect(doc().layers).toHaveLength(2)
    expect(activeLayer(doc()).name).toBe('Pasted')
    expect(toHex(getPixel(activeLayer(doc()).pixels, 1, 0))).toBe('#ff0000')
    expect(useEditor.getState().tool).toBe('move')

    editor.setSelection(null)
    editor.transform('flip-vertical')
    expect(toHex(getPixel(activeLayer(doc()).pixels, 1, 1))).toBe('#ff0000')
    expect(doc().layers.length).toBe(2)
    expect(useEditor.getState().history!.entries.map((entry) => entry.label)).toEqual([
      'Opened',
      'Paste',
      'Flip vertically',
    ])
  })

  it('picks the active layer without adding a history step', async () => {
    stubApi()
    const editor = useEditor.getState()
    await editor.open(row, 16)
    editor.commit('Add layer', addLayer(doc()))
    editor.setActiveLayer(doc().layers[0].id)
    expect(doc().activeLayerId).toBe(doc().layers[0].id)
    expect(useEditor.getState().history!.entries).toHaveLength(2)
  })

  it('reverts to the original', async () => {
    const api = stubApi()
    const editor = useEditor.getState()
    await editor.open({ ...row, changed: true }, 16)
    editor.commit('Add layer', addLayer(doc()))
    expect(await editor.revert({ ...row, changed: true }, 16)).toBe(true)
    expect(api.revert).toHaveBeenCalledWith('block/stone.png')
    expect(api.saveEdit).not.toHaveBeenCalled()
    expect(doc().layers).toHaveLength(1)
  })

  it('steps through the zoom levels', () => {
    expect(nextZoom(4, 1)).toBe(6)
    expect(nextZoom(4, -1)).toBe(3)
    expect(nextZoom(5, -1)).toBe(4)
    expect(nextZoom(1, -1)).toBe(1)
  })
})

describe('shortcuts', () => {
  const key = (key: string, modifiers: Partial<Record<'ctrl' | 'shift' | 'alt', boolean>> = {}) =>
    shortcutFromEvent({
      key,
      ctrlKey: !!modifiers.ctrl,
      metaKey: false,
      shiftKey: !!modifiers.shift,
      altKey: !!modifiers.alt,
    })

  it('names key presses', () => {
    expect(key('b')).toBe('B')
    expect(key('Z', { ctrl: true, shift: true })).toBe('Ctrl+Shift+Z')
    expect(key('+', { shift: true })).toBe('+')
    expect(key('Delete', { shift: true })).toBe('Shift+Delete')
    expect(key('Shift', { shift: true })).toBeNull()
  })

  it('applies the user’s changes on top of the defaults', () => {
    const map = shortcutMap({ 'tool.pencil': 'P', 'tool.eraser': '' })
    expect(map.get('P')).toBe('tool.pencil')
    expect(map.has('B')).toBe(false)
    expect(map.has('E')).toBe(false)
    expect(map.get('=')).toBe('view.zoomIn')
  })
})
