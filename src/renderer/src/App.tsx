import { useEffect, useState } from 'react'
import { ExportDialog } from './components/ExportDialog'
import { NewPackWizard } from './components/NewPackWizard'
import { EmptyState, Panel } from './components/Panel'
import { FileList, PackProperties, ProjectOverview } from './components/ProjectViews'
import { SettingsDialog } from './components/SettingsDialog'
import { StartScreen } from './components/StartScreen'
import { StatusBar } from './components/StatusBar'
import { TextureBrowser } from './components/TextureBrowser'
import { TextureDetail, TextureProperties } from './components/TextureViews'
import { TitleBar } from './components/TitleBar'
import { Toasts } from './components/Toasts'
import { useApplyTheme } from './hooks/useApplyTheme'
import { useProject } from './store/project'
import { useSettings } from './store/settings'
import { useSelectedRow, useTextures } from './store/textures'

type LeftTab = 'textures' | 'files'

/** Loads the vanilla textures whenever another pack (or Minecraft version) is opened. */
function useTextureLoader(): void {
  const dir = useProject((state) => state.summary?.dir)
  const version = useProject((state) => state.summary?.project.minecraftVersion)
  const load = useTextures((state) => state.load)
  const reset = useTextures((state) => state.reset)
  const setProgress = useTextures((state) => state.setProgress)

  useEffect(() => window.api.textures.onProgress(setProgress), [setProgress])

  useEffect(() => {
    reset()
    if (dir && version) void load()
  }, [dir, version, load, reset])
}

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
    content = <TextureBrowser />
  }

  return (
    <Panel title="Pack contents" header={tabs} className="border-r border-line bg-panel">
      {content}
    </Panel>
  )
}

export function App() {
  useApplyTheme()
  useTextureLoader()
  const summary = useProject((state) => state.summary)
  const dialog = useProject((state) => state.dialog)
  const selectedRow = useSelectedRow()

  let centre
  let properties
  if (!summary) {
    centre = <StartScreen />
    properties = (
      <EmptyState title="Nothing selected">Open a pack to see its properties.</EmptyState>
    )
  } else if (selectedRow) {
    centre = <TextureDetail row={selectedRow} />
    properties = <TextureProperties row={selectedRow} />
  } else {
    centre = <ProjectOverview summary={summary} />
    properties = <PackProperties summary={summary} />
  }

  return (
    <div className="flex h-full flex-col">
      <TitleBar />
      <main className="grid min-h-0 flex-1 grid-cols-[300px_minmax(0,1fr)_300px]">
        <LeftPanel />
        <Panel title="Editor" className="bg-canvas">
          {centre}
        </Panel>
        <Panel title="Properties" className="border-l border-line bg-panel">
          {properties}
        </Panel>
      </main>
      <StatusBar />
      {dialog === 'new-pack' && <NewPackWizard />}
      {dialog === 'export' && summary && <ExportDialog summary={summary} />}
      {dialog === 'settings' && <SettingsDialog />}
      <Toasts />
    </div>
  )
}
