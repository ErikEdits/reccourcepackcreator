import { useState } from 'react'
import { ExportDialog } from './components/ExportDialog'
import { NewPackWizard } from './components/NewPackWizard'
import { EmptyState, Panel } from './components/Panel'
import { FileList, PackProperties, ProjectOverview } from './components/ProjectViews'
import { StartScreen } from './components/StartScreen'
import { StatusBar } from './components/StatusBar'
import { TitleBar } from './components/TitleBar'
import { Toasts } from './components/Toasts'
import { useApplyTheme } from './hooks/useApplyTheme'
import { useProject } from './store/project'
import { useSettings } from './store/settings'

type LeftTab = 'textures' | 'files'

function LeftPanel() {
  const expert = useSettings((state) => state.mode === 'expert')
  const summary = useProject((state) => state.summary)
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

  let content
  if (!summary) {
    content = <EmptyState title="No pack open">Create a new pack or open a pack folder.</EmptyState>
  } else if (activeTab === 'files') {
    content = <FileList files={summary.files} />
  } else {
    content = (
      <EmptyState title="No textures yet">
        Textures you add to this pack will appear here.
      </EmptyState>
    )
  }

  return (
    <Panel title="Pack contents" header={tabs} className="border-r border-line bg-panel">
      {content}
    </Panel>
  )
}

export function App() {
  useApplyTheme()
  const summary = useProject((state) => state.summary)
  const dialog = useProject((state) => state.dialog)

  return (
    <div className="flex h-full flex-col">
      <TitleBar />
      <main className="grid min-h-0 flex-1 grid-cols-[280px_minmax(0,1fr)_300px]">
        <LeftPanel />
        <Panel title="Editor" className="bg-canvas">
          {summary ? <ProjectOverview summary={summary} /> : <StartScreen />}
        </Panel>
        <Panel title="Properties" className="border-l border-line bg-panel">
          {summary ? (
            <PackProperties summary={summary} />
          ) : (
            <EmptyState title="Nothing selected">Open a pack to see its properties.</EmptyState>
          )}
        </Panel>
      </main>
      <StatusBar />
      {dialog === 'new-pack' && <NewPackWizard />}
      {dialog === 'export' && summary && <ExportDialog summary={summary} />}
      <Toasts />
    </div>
  )
}
