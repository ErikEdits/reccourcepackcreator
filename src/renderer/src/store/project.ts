import { create } from 'zustand'
import type { ProjectSummary, RecentProject } from '../../../shared/project'

type Dialog = 'new-pack' | 'export' | null

interface ProjectState {
  summary: ProjectSummary | null
  recent: RecentProject[]
  dialog: Dialog
  setSummary: (summary: ProjectSummary | null) => void
  setDialog: (dialog: Dialog) => void
  loadRecent: () => Promise<void>
  /** Opens a pack folder; resolves to an error message, or null on success. */
  openFolder: (dir: string) => Promise<string | null>
  closeProject: () => Promise<void>
}

export const useProject = create<ProjectState>()((set, get) => ({
  summary: null,
  recent: [],
  dialog: null,
  setSummary: (summary) => set({ summary }),
  setDialog: (dialog) => set({ dialog }),
  loadRecent: async () => set({ recent: await window.api.project.recent() }),
  openFolder: async (dir) => {
    const result = await window.api.project.open(dir)
    if (!result.ok) return result.error
    set({ summary: result.value })
    return null
  },
  closeProject: async () => {
    await window.api.project.close()
    set({ summary: null, dialog: null })
    await get().loadRecent()
  },
}))
