import { useEffect } from 'react'
import { resolveTheme, useSettings } from '../store/settings'

/** Keeps the `dark` class on <html> in sync with the chosen theme and the OS setting. */
export function useApplyTheme(): void {
  const theme = useSettings((state) => state.theme)

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = (): void => {
      const dark = resolveTheme(theme, media.matches) === 'dark'
      document.documentElement.classList.toggle('dark', dark)
    }
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [theme])
}
