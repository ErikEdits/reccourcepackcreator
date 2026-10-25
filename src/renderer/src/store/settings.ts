import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { ShortcutAction } from '../editor/shortcuts'

export type ThemePreference = 'system' | 'light' | 'dark'
export type UiMode = 'simple' | 'expert'
export type TextureView = 'grid' | 'list'
/** What the editor shows: the flat texture, the 3D preview, or both side by side. */
export type EditorLayout = '2d' | '3d' | 'both'

export interface Palette {
  name: string
  /** "#rrggbb" or "#rrggbbaa" */
  colours: string[]
}

interface SettingsState {
  theme: ThemePreference
  mode: UiMode
  textureView: TextureView
  /** The texture list shows a block's textures (top, side …) as one entry. */
  groupByBlock: boolean
  editorLayout: EditorLayout
  /** Shown behind transparent pixels in the editor (docs/DECISIONS.md #112). */
  editorBackground: string
  /** The user's own and imported palettes (docs/DECISIONS.md #31). */
  palettes: Palette[]
  /** Editor shortcuts the user changed; the rest keep their defaults (docs/DECISIONS.md #63). */
  shortcuts: Partial<Record<ShortcutAction, string>>
  cycleTheme: () => void
  setMode: (mode: UiMode) => void
  setTextureView: (view: TextureView) => void
  setGroupByBlock: (groupByBlock: boolean) => void
  setEditorLayout: (layout: EditorLayout) => void
  setEditorBackground: (colour: string) => void
  setPalettes: (palettes: Palette[]) => void
  setShortcuts: (shortcuts: Partial<Record<ShortcutAction, string>>) => void
}

const themeOrder: readonly ThemePreference[] = ['system', 'light', 'dark']

export const DEFAULT_EDITOR_BACKGROUND = '#7a7a7a'

export function nextTheme(theme: ThemePreference): ThemePreference {
  return themeOrder[(themeOrder.indexOf(theme) + 1) % themeOrder.length]
}

export function resolveTheme(theme: ThemePreference, systemPrefersDark: boolean): 'light' | 'dark' {
  if (theme === 'system') return systemPrefersDark ? 'dark' : 'light'
  return theme
}

export const useSettings = create<SettingsState>()(
  persist(
    (set, get) => ({
      theme: 'system',
      mode: 'simple',
      textureView: 'grid',
      groupByBlock: true,
      editorLayout: 'both',
      editorBackground: DEFAULT_EDITOR_BACKGROUND,
      palettes: [{ name: 'My palette', colours: [] }],
      shortcuts: {},
      cycleTheme: () => set({ theme: nextTheme(get().theme) }),
      setMode: (mode) => set({ mode }),
      setTextureView: (textureView) => set({ textureView }),
      setGroupByBlock: (groupByBlock) => set({ groupByBlock }),
      setEditorLayout: (editorLayout) => set({ editorLayout }),
      setEditorBackground: (editorBackground) => set({ editorBackground }),
      setPalettes: (palettes) => set({ palettes }),
      setShortcuts: (shortcuts) => set({ shortcuts }),
    }),
    {
      name: 'resource-pack-creator:settings',
      storage: createJSONStorage(() => localStorage),
      partialize: ({
        theme,
        mode,
        textureView,
        groupByBlock,
        editorLayout,
        editorBackground,
        palettes,
        shortcuts,
      }) => ({
        theme,
        mode,
        textureView,
        groupByBlock,
        editorLayout,
        editorBackground,
        palettes,
        shortcuts,
      }),
    },
  ),
)
