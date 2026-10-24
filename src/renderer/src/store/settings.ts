import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

export type ThemePreference = 'system' | 'light' | 'dark'
export type UiMode = 'simple' | 'expert'
export type TextureView = 'grid' | 'list'

interface SettingsState {
  theme: ThemePreference
  mode: UiMode
  textureView: TextureView
  cycleTheme: () => void
  setMode: (mode: UiMode) => void
  setTextureView: (view: TextureView) => void
}

const themeOrder: readonly ThemePreference[] = ['system', 'light', 'dark']

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
      cycleTheme: () => set({ theme: nextTheme(get().theme) }),
      setMode: (mode) => set({ mode }),
      setTextureView: (textureView) => set({ textureView }),
    }),
    {
      name: 'resource-pack-creator:settings',
      storage: createJSONStorage(() => localStorage),
      partialize: ({ theme, mode, textureView }) => ({ theme, mode, textureView }),
    },
  ),
)
