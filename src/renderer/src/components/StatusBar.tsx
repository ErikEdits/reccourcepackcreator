import { useEffect, useState } from 'react'
import type { AppInfo } from '../../../shared/api'
import { formatCount } from '../lib/format'
import { useSettings } from '../store/settings'
import { useTextureRows, useTextures } from '../store/textures'

export function StatusBar() {
  const mode = useSettings((state) => state.mode)
  const index = useTextures((state) => state.index)
  const rows = useTextureRows()
  const changed = rows.filter((row) => row.changed).length
  const [info, setInfo] = useState<AppInfo | null>(null)

  useEffect(() => {
    void window.api.app.getInfo().then(setInfo)
  }, [])

  return (
    <footer className="flex h-6 shrink-0 items-center gap-4 border-t border-line bg-panel px-3 text-[11px] text-ink-muted">
      {index && (
        <span>
          {formatCount(changed)} / {formatCount(index.textures.length)} textures changed
        </span>
      )}
      <span className="ml-auto">{mode === 'expert' ? 'Expert mode' : 'Simple mode'}</span>
      {info && <span>v{info.version}</span>}
    </footer>
  )
}
