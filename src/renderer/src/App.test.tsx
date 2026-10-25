// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RendererApi } from '../../shared/api'
import { App } from './App'
import { useSettings } from './store/settings'

function stubApi(): RendererApi {
  return {
    window: {
      minimize: vi.fn(async () => {}),
      toggleMaximize: vi.fn(async () => {}),
      close: vi.fn(async () => {}),
      isMaximized: vi.fn(async () => false),
      onMaximizedChange: vi.fn(() => () => {}),
    },
    app: {
      getInfo: vi.fn(async () => ({
        name: 'Resource Pack Creator',
        version: '0.1.0',
        platform: 'linux',
        electronVersion: '0.0.0',
      })),
    },
    shell: { openExternal: vi.fn(async () => true) },
    dialog: { chooseFolder: vi.fn(async () => null) },
    project: {
      defaultLocation: vi.fn(async () => '/home/test/Documents/Resource Pack Creator'),
      recent: vi.fn(async () => []),
      create: vi.fn(async () => ({ ok: false as const, error: 'not in unit tests' })),
      open: vi.fn(async () => ({ ok: false as const, error: 'not in unit tests' })),
      close: vi.fn(async () => {}),
      export: vi.fn(async () => ({ ok: false as const, error: 'not in unit tests' })),
    },
    textures: {
      load: vi.fn(async () => ({ ok: false as const, error: 'not in unit tests' })),
      revert: vi.fn(async () => ({ ok: false as const, error: 'not in unit tests' })),
      readImage: vi.fn(async () => null),
      readLayers: vi.fn(async () => null),
      saveEdit: vi.fn(async () => ({ ok: false as const, error: 'not in unit tests' })),
      blockModel: vi.fn(async () => null),
      onProgress: vi.fn(() => () => {}),
    },
    minecraft: {
      filesInfo: vi.fn(async () => ({
        minecraftDir: '/home/test/.minecraft',
        found: false,
        cacheBytes: 0,
      })),
      clearCache: vi.fn(async () => {}),
    },
  }
}

async function renderApp(): Promise<void> {
  render(<App />)
  // Let the IPC promises from the title bar and status bar settle.
  await act(async () => {})
}

beforeEach(() => {
  window.api = stubApi()
  window.matchMedia = vi.fn((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(() => false),
  }))
  useSettings.setState({ theme: 'system', mode: 'simple' })
})

afterEach(cleanup)

describe('App', () => {
  it('renders the three workspace columns', async () => {
    await renderApp()
    expect(screen.getByRole('region', { name: 'Pack contents' })).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Editor' })).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Properties' })).toBeTruthy()
    expect(screen.getByText('v0.1.0')).toBeTruthy()
  })

  it('shows the Files tab only in expert mode', async () => {
    await renderApp()
    expect(screen.queryByRole('tab', { name: 'Files' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Expert' }))
    expect(screen.getByRole('tab', { name: 'Files' })).toBeTruthy()
  })

  it('applies the dark class when the dark theme is chosen', async () => {
    await renderApp()
    const themeButton = screen.getByRole('button', { name: /^Theme:/ })
    fireEvent.click(themeButton) // light
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    fireEvent.click(themeButton) // dark
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('sends window controls over the preload API', async () => {
    await renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Minimize' }))
    fireEvent.click(screen.getByRole('button', { name: 'Maximize' }))
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(window.api.window.minimize).toHaveBeenCalledOnce()
    expect(window.api.window.toggleMaximize).toHaveBeenCalledOnce()
    // Closing waits for the editor to finish saving.
    await vi.waitFor(() => expect(window.api.window.close).toHaveBeenCalledOnce())
  })
})
