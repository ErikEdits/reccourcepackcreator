// Shape of the API the preload script exposes to the renderer as `window.api`.

import type {
  ExportRequest,
  ExportResult,
  FolderPurpose,
  NewPackRequest,
  ProjectSummary,
  RecentProject,
} from './project'
import type { TextureIndex, TextureProgress } from './textures'

export interface AppInfo {
  name: string
  version: string
  platform: string
  electronVersion: string
}

export interface MinecraftFilesInfo {
  /** Where the Minecraft launcher keeps its files on this computer. */
  minecraftDir: string
  /** That folder exists, so installed versions are read from it instead of downloaded. */
  found: boolean
  /** Bytes of game files the app downloaded itself. */
  cacheBytes: number
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
  textures: {
    /** Vanilla textures of the open pack's Minecraft version (may download the game files). */
    load(): Promise<Result<TextureIndex>>
    /** Writes a PNG over a texture in the open pack. */
    replace(path: string, png: Uint8Array): Promise<Result<ProjectSummary>>
    /** Removes the pack's version of a texture. */
    revert(path: string): Promise<Result<ProjectSummary>>
    /** Returns a function that removes the listener. */
    onProgress(listener: (progress: TextureProgress) => void): () => void
  }
  minecraft: {
    filesInfo(): Promise<MinecraftFilesInfo>
    clearCache(): Promise<void>
  }
}
