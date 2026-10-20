// Shape of the API the preload script exposes to the renderer as `window.api`.

export interface AppInfo {
  name: string
  version: string
  platform: string
  electronVersion: string
}

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
}
