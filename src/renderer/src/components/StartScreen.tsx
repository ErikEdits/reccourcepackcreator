import { useEffect, useState } from 'react'
import { useProject } from '../store/project'
import { GrassBlockIcon } from './GrassBlockIcon'
import { Button, ErrorText } from './ui'

const TIPS = [
  'Every pack is a normal folder — Minecraft can load it directly while you work on it.',
  'Export for several Minecraft versions at once; the app writes the right pack.mcmeta for each.',
  'Use the colour buttons in the description editor to style your pack in the in-game list.',
  'Switch to Expert mode in the title bar to see every file of your pack.',
]

export function StartScreen() {
  const recent = useProject((state) => state.recent)
  const loadRecent = useProject((state) => state.loadRecent)
  const openFolder = useProject((state) => state.openFolder)
  const setDialog = useProject((state) => state.setDialog)
  const [error, setError] = useState<string | null>(null)
  const [tip] = useState(() => TIPS[Math.floor(Math.random() * TIPS.length)])

  useEffect(() => {
    void loadRecent()
  }, [loadRecent])

  const open = async (dir: string | null): Promise<void> => {
    if (!dir) return
    setError(await openFolder(dir))
  }

  return (
    <div className="mx-auto flex h-full max-w-xl flex-col justify-center gap-6 p-8">
      <div className="flex items-center gap-4">
        <GrassBlockIcon size={56} />
        <div>
          <h1 className="text-xl font-semibold">Resource Pack Creator</h1>
          <p className="text-sm text-ink-muted">
            Create resource packs for Minecraft Java Edition.
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <Button variant="primary" onClick={() => setDialog('new-pack')}>
          New pack
        </Button>
        <Button onClick={() => void window.api.dialog.chooseFolder('open-project').then(open)}>
          Open pack folder…
        </Button>
      </div>
      {error && <ErrorText>{error}</ErrorText>}

      <section aria-label="Recent packs">
        <h2 className="mb-2 text-xs font-semibold tracking-wide text-ink-muted uppercase">
          Recent
        </h2>
        {recent.length === 0 ? (
          <p className="text-sm text-ink-muted">Packs you create or open appear here.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {recent.map((item) => (
              <li key={item.dir}>
                <button
                  type="button"
                  onClick={() => void open(item.dir)}
                  className="flex w-full flex-col rounded-md border border-line bg-raised px-3 py-2 text-left hover:border-grass"
                >
                  <span className="text-sm font-medium">{item.name}</span>
                  <span className="truncate text-xs text-ink-muted">
                    {item.minecraftVersion} · {item.dir}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="rounded-md bg-grass/10 px-3 py-2 text-xs text-ink-muted">
        <span className="font-semibold text-grass-strong dark:text-grass">Tip: </span>
        {tip}
      </p>
    </div>
  )
}
