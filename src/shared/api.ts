// Shape of the API the preload script exposes to the renderer as `window.api`.

import type {
  ExportRequest,
  ExportResult,
  FolderPurpose,
  NewPackRequest,
  ProjectSummary,
  RecentProject,
} from './project'

export interface AppInfo {
  name: string
  version: string
  platform: string
  electronVersion: string
}

/** Outcome of an operation that can fail for reasons worth showing to the user. */
export type Result<T> = { ok: true; value: T } | { ok: false; error: string }

export interface RendererApi {
  window: {
    minimize(): Promise<void>
    toggleMaximize(): Promise<void>
    close(): Promise<void>
    isMaximized(): Promise<boolean>
    /** Returns a function that removes the listener. */
    onMaximizedChange(listener: (maximized: boolean) => void): () => void
  }
  app: {
    getInfo(): Promise<AppInfo>
  }
  shell: {
    /** Opens an http(s) link in the system browser. Resolves to false if it was blocked or declined. */
    openExternal(url: string): Promise<boolean>
  }
  dialog: {
    /** Shows a folder picker. The chosen folder may then be used by the project functions. */
    chooseFolder(purpose: FolderPurpose): Promise<string | null>
  }
  project: {
    defaultLocation(): Promise<string>
    recent(): Promise<RecentProject[]>
    create(request: NewPackRequest): Promise<Result<ProjectSummary>>
    open(dir: string): Promise<Result<ProjectSummary>>
    close(): Promise<void>
    export(request: ExportRequest): Promise<Result<ExportResult>>
  }
}
