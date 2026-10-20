import { useEffect, useState, type ReactNode } from 'react'
import { useSettings, type ThemePreference, type UiMode } from '../store/settings'
import { GrassBlockIcon } from './GrassBlockIcon'

const themeLabels: Record<ThemePreference, string> = {
  system: 'System',
  light: 'Light',
  dark: 'Dark',
}

const modes: { value: UiMode; label: string }[] = [
  { value: 'simple', label: 'Simple' },
  { value: 'expert', label: 'Expert' },
]

function ModeSwitch() {
  const mode = useSettings((state) => state.mode)
  const setMode = useSettings((state) => state.setMode)

  return (
    <div
      role="group"
      aria-label="Interface mode"
      className="flex rounded-md border border-line p-0.5"
    >
      {modes.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          aria-pressed={mode === value}
          onClick={() => setMode(value)}
          className="rounded px-2 py-0.5 text-xs text-ink-muted aria-pressed:bg-grass aria-pressed:text-white"
        >
          {label}
        </button>
      ))}
    </div>
  )
}

function ThemeButton() {
  const theme = useSettings((state) => state.theme)
  const cycleTheme = useSettings((state) => state.cycleTheme)

  return (
    <button
      type="button"
      onClick={cycleTheme}
      title="Switch theme"
      className="rounded-md border border-line px-2 py-0.5 text-xs text-ink-muted hover:text-ink"
    >
      Theme: {themeLabels[theme]}
    </button>
  )
}

function WindowButton({
  label,
  onClick,
  danger = false,
  children,
}: {
  label: string
  onClick: () => void
  danger?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`flex h-10 w-11 items-center justify-center text-ink-muted hover:text-ink ${
        danger ? 'hover:bg-danger hover:text-white' : 'hover:bg-raised'
      }`}
    >
      <svg
        width="10"
        height="10"
        viewBox="0 0 10 10"
        fill="none"
        stroke="currentColor"
        aria-hidden="true"
      >
        {children}
      </svg>
    </button>
  )
}

export function TitleBar() {
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    void window.api.window.isMaximized().then(setMaximized)
    return window.api.window.onMaximizedChange(setMaximized)
  }, [])

  return (
    <header className="app-drag flex h-10 shrink-0 items-center border-b border-line bg-panel">
      <div className="flex items-center gap-2 pl-3">
        <GrassBlockIcon />
        <span className="text-sm font-semibold">Resource Pack Creator</span>
      </div>
      <span className="ml-4 text-xs text-ink-muted">No pack open</span>

      <div className="app-no-drag ml-auto flex items-center gap-2 pl-2">
        <ModeSwitch />
        <ThemeButton />
        <div className="flex">
          <WindowButton label="Minimize" onClick={() => void window.api.window.minimize()}>
            <path d="M0 5.5h10" />
          </WindowButton>
          <WindowButton
            label={maximized ? 'Restore' : 'Maximize'}
            onClick={() => void window.api.window.toggleMaximize()}
          >
            {maximized ? (
              <path d="M2.5 2.5V0.5h7v7h-2M0.5 2.5h7v7h-7z" />
            ) : (
              <path d="M0.5 0.5h9v9h-9z" />
            )}
          </WindowButton>
          <WindowButton label="Close" danger onClick={() => void window.api.window.close()}>
            <path d="M0.5 0.5l9 9M9.5 0.5l-9 9" />
          </WindowButton>
        </div>
      </div>
    </header>
  )
}
