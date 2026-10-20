// Channel names shared by the main process and the preload script.
// Kept free of dependencies: the sandboxed preload cannot load node_modules.

export const IpcChannel = {
  WindowMinimize: 'window:minimize',
  WindowToggleMaximize: 'window:toggle-maximize',
  WindowClose: 'window:close',
  WindowIsMaximized: 'window:is-maximized',
  AppGetInfo: 'app:get-info',
  ShellOpenExternal: 'shell:open-external',
} as const

export type IpcChannelName = (typeof IpcChannel)[keyof typeof IpcChannel]

/** Events pushed from the main process to the renderer. */
export const IpcEvent = {
  WindowMaximizedChanged: 'window:maximized-changed',
} as const
