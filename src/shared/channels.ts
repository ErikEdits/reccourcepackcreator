// Channel names shared by the main process and the preload script.
// Kept free of dependencies: the sandboxed preload cannot load node_modules.

export const IpcChannel = {
  WindowMinimize: 'window:minimize',
  WindowToggleMaximize: 'window:toggle-maximize',
  WindowClose: 'window:close',
  WindowIsMaximized: 'window:is-maximized',
  AppGetInfo: 'app:get-info',
  ShellOpenExternal: 'shell:open-external',
  DialogChooseFolder: 'dialog:choose-folder',
  ProjectDefaultLocation: 'project:default-location',
  ProjectRecent: 'project:recent',
  ProjectCreate: 'project:create',
  ProjectOpen: 'project:open',
  ProjectClose: 'project:close',
  ProjectExport: 'project:export',
  TexturesLoad: 'textures:load',
  TexturesRevert: 'textures:revert',
  TexturesReadImage: 'textures:read-image',
  TexturesReadLayers: 'textures:read-layers',
  TexturesSaveEdit: 'textures:save-edit',
  MinecraftFilesInfo: 'minecraft:files-info',
  MinecraftClearCache: 'minecraft:clear-cache',
} as const

export type IpcChannelName = (typeof IpcChannel)[keyof typeof IpcChannel]

/** Events pushed from the main process to the renderer. */
export const IpcEvent = {
  WindowMaximizedChanged: 'window:maximized-changed',
  TexturesProgress: 'textures:progress',
} as const
