import { useEffect, useState } from 'react'
import type { MinecraftFilesInfo } from '../../../shared/api'
import {
  DEFAULT_SHORTCUTS,
  SHORTCUT_ACTIONS,
  shortcutFromEvent,
  type ShortcutAction,
} from '../editor/shortcuts'
import { formatMegabytes } from '../lib/format'
import { useProject } from '../store/project'
import { DEFAULT_EDITOR_BACKGROUND, useSettings } from '../store/settings'
import { Button, Modal } from './ui'

function EditorSettings() {
  const background = useSettings((state) => state.editorBackground)
  const setBackground = useSettings((state) => state.setEditorBackground)

  return (
    <section aria-label="Editor" className="flex flex-col gap-3 text-sm">
      <h3 className="font-medium">Editor</h3>
      <label className="flex items-center gap-3">
        <span className="flex-1">Background behind transparent pixels</span>
        <input
          type="color"
          aria-label="Editor background colour"
          value={background}
          onChange={(event) => setBackground(event.target.value)}
          className="h-7 w-12 cursor-pointer rounded border border-line bg-raised"
        />
        <Button
          variant="ghost"
          disabled={background === DEFAULT_EDITOR_BACKGROUND}
          onClick={() => setBackground(DEFAULT_EDITOR_BACKGROUND)}
        >
          Reset
        </Button>
      </label>
    </section>
  )
}

/** Every editor shortcut, each one changeable by pressing the new keys (docs/DECISIONS.md #63). */
function ShortcutSettings() {
  const overrides = useSettings((state) => state.shortcuts)
  const setShortcuts = useSettings((state) => state.setShortcuts)
  const [recording, setRecording] = useState<ShortcutAction | null>(null)
  const actions = Object.keys(SHORTCUT_ACTIONS) as ShortcutAction[]
  const current = (action: ShortcutAction): string => overrides[action] ?? DEFAULT_SHORTCUTS[action]

  const assign = (action: ShortcutAction, shortcut: string): void => {
    const next = { ...overrides }
    // A shortcut can only do one thing: whatever had it before loses it.
    for (const other of actions) {
      if (other !== action && current(other) === shortcut) next[other] = ''
    }
    next[action] = shortcut
    for (const key of actions) if (next[key] === DEFAULT_SHORTCUTS[key]) delete next[key]
    setShortcuts(next)
  }

  return (
    <section aria-label="Keyboard shortcuts" className="flex flex-col gap-2 text-sm">
      <div className="flex items-center">
        <h3 className="flex-1 font-medium">Keyboard shortcuts</h3>
        <Button
          variant="ghost"
          disabled={Object.keys(overrides).length === 0}
          onClick={() => setShortcuts({})}
        >
          Reset all
        </Button>
      </div>
      <table className="w-full text-xs">
        <tbody>
          {actions.map((action) => (
            <tr key={action} className="border-t border-line">
              <td className="py-1">{SHORTCUT_ACTIONS[action]}</td>
              <td className="py-1 text-right">
                <button
                  type="button"
                  aria-label={`Shortcut for ${SHORTCUT_ACTIONS[action]}`}
                  onClick={() => setRecording(action)}
                  onBlur={() => setRecording(null)}
                  onKeyDown={(event) => {
                    if (recording !== action) return
                    // Tab keeps moving the focus, as everywhere else.
                    if (event.key === 'Tab') return
                    event.preventDefault()
                    event.stopPropagation()
                    if (event.key === 'Escape') return setRecording(null)
                    const shortcut = shortcutFromEvent(event)
                    if (!shortcut) return
                    assign(action, event.key === 'Backspace' ? '' : shortcut)
                    setRecording(null)
                  }}
                  className="min-w-24 rounded border border-line bg-raised px-2 py-0.5 font-mono"
                >
                  {recording === action ? 'Press keys…' : current(action) || '—'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-ink-muted">
        Click a shortcut and press the new keys. Backspace removes it, Escape keeps it.
      </p>
    </section>
  )
}

export function SettingsDialog() {
  const setDialog = useProject((state) => state.setDialog)
  const [info, setInfo] = useState<MinecraftFilesInfo | null>(null)

  useEffect(() => {
    void window.api.minecraft.filesInfo().then(setInfo)
  }, [])

  const clearCache = async (): Promise<void> => {
    await window.api.minecraft.clearCache()
    setInfo(await window.api.minecraft.filesInfo())
  }

  return (
    <Modal title="Settings" onClose={() => setDialog(null)} width="max-w-xl">
      <div className="flex flex-col gap-6">
        <section aria-label="Minecraft files" className="flex flex-col gap-3 text-sm">
          <h3 className="font-medium">Minecraft files</h3>
          {info && (
            <>
              <div>
                <p>Minecraft installation</p>
                <code className="block truncate text-xs text-ink-muted">{info.minecraftDir}</code>
                <p className="text-xs text-ink-muted">
                  {info.found
                    ? 'Found. Installed versions are read from here.'
                    : 'Not found. Game files are downloaded from Mojang when a pack needs them.'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <p className="flex-1">
                  Downloaded game files: <strong>{formatMegabytes(info.cacheBytes)}</strong>
                </p>
                <Button disabled={info.cacheBytes === 0} onClick={() => void clearCache()}>
                  Delete downloads
                </Button>
              </div>
            </>
          )}
          <p className="text-xs text-ink-muted">
            Minecraft&apos;s own textures are read from this computer or from Mojang. Only the
            textures you change end up in your packs and exports.
          </p>
        </section>
        <EditorSettings />
        <ShortcutSettings />
      </div>
    </Modal>
  )
}
