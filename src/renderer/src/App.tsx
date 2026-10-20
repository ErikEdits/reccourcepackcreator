import { useState } from 'react'
import { EmptyState, Panel } from './components/Panel'
import { StatusBar } from './components/StatusBar'
import { TitleBar } from './components/TitleBar'
import { GrassBlockIcon } from './components/GrassBlockIcon'
import { useApplyTheme } from './hooks/useApplyTheme'
import { useSettings } from './store/settings'

type LeftTab = 'textures' | 'files'

function LeftPanel() {
  const expert = useSettings((state) => state.mode === 'expert')
  const [tab, setTab] = useState<LeftTab>('textures')
  // The file tree is an expert-mode feature (docs/DECISIONS.md #61).
  const activeTab = expert ? tab : 'textures'

  const tabs = (
    <div role="tablist" aria-label="Pack contents" className="flex h-full gap-3">
      {(['textures', 'files'] as const)
        .filter((value) => expert || value === 'textures')
        .map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={activeTab === value}
            onClick={() => setTab(value)}
            className="border-b-2 border-transparent text-xs font-semibold tracking-wide text-ink-muted uppercase aria-selected:border-grass aria-selected:text-ink"
          >
            {value === 'textures' ? 'Textures' : 'Files'}
          </button>
        ))}
    </div>
  )

  return (
    <Panel title="Pack contents" header={tabs} className="border-r border-line bg-panel">
      {activeTab === 'textures' ? (
        <EmptyState title="No pack open">
          Create a new pack or import a .zip to browse its textures.
        </EmptyState>
      ) : (
        <EmptyState title="No pack open">The pack&apos;s files will be listed here.</EmptyState>
      )}
    </Panel>
  )
}

export function App() {
  useApplyTheme()

  return (
    <div className="flex h-full flex-col">
      <TitleBar />
      <main className="grid min-h-0 flex-1 grid-cols-[280px_minmax(0,1fr)_300px]">
        <LeftPanel />
        <Panel title="Editor" className="bg-canvas">
          <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
            <GrassBlockIcon size={64} />
            <p className="text-base font-semibold">Start a resource pack</p>
            <p className="max-w-80 text-xs text-ink-muted">
              Open or create a pack to start editing its textures.
            </p>
          </div>
        </Panel>
        <Panel title="Properties" className="border-l border-line bg-panel">
          <EmptyState title="Nothing selected">Select a texture to see its properties.</EmptyState>
        </Panel>
      </main>
      <StatusBar />
    </div>
  )
}
