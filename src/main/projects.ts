// The open project, recent projects and which folders the app may touch (docs/DECISIONS.md #122).

import { app, BrowserWindow, dialog, Notification, type OpenDialogOptions } from 'electron'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import type {
  ExportRequest,
  ExportResult,
  FolderPurpose,
  NewPackRequest,
  ProjectSummary,
  RecentProject,
} from '../shared/project'
import {
  createPackFolder,
  exportPack,
  PackError,
  readPack,
  removePackTexture,
  writePackTexture,
} from './pack-io'
import { isInside } from './paths'

const MAX_RECENT = 10

/** Folders the user picked in a dialog during this session, or opened earlier. */
const approvedFolders = new Set<string>()
let current: ProjectSummary | null = null

export function defaultProjectsDir(): string {
  return join(app.getPath('documents'), 'Resource Pack Creator')
}

function isApproved(path: string): boolean {
  const roots = [...approvedFolders, defaultProjectsDir(), app.getPath('downloads')]
  return roots.some((root) => isInside(root, path))
}

function assertApproved(path: string): void {
  if (!isApproved(path)) throw new PackError('This folder has not been chosen in this app.')
}

const recentFile = (): string => join(app.getPath('userData'), 'recent-projects.json')

async function readRecent(): Promise<RecentProject[]> {
  try {
    const list = JSON.parse(await readFile(recentFile(), 'utf8')) as RecentProject[]
    return Array.isArray(list) ? list.slice(0, MAX_RECENT) : []
  } catch {
    return []
  }
}

async function remember(summary: ProjectSummary): Promise<void> {
  const entry: RecentProject = {
    dir: summary.dir,
    name: summary.project.name,
    minecraftVersion: summary.project.minecraftVersion,
  }
  const others = (await readRecent()).filter((item) => resolve(item.dir) !== resolve(entry.dir))
  await mkdir(app.getPath('userData'), { recursive: true })
  await writeFile(recentFile(), JSON.stringify([entry, ...others].slice(0, MAX_RECENT), null, 2))
}

/** Recent projects that still exist. Their folders count as approved. */
export async function listRecent(): Promise<RecentProject[]> {
  const list = (await readRecent()).filter((item) => existsSync(join(item.dir, 'pack.mcmeta')))
  for (const item of list) approvedFolders.add(resolve(item.dir))
  return list
}

const dialogTitles: Record<FolderPurpose, string> = {
  'project-location': 'Choose where to create the pack',
  'open-project': 'Open a resource pack folder',
  'export-destination': 'Choose where to save the ZIP files',
}

export async function chooseFolder(
  window: BrowserWindow | null,
  purpose: FolderPurpose,
): Promise<string | null> {
  const options: OpenDialogOptions = {
    title: dialogTitles[purpose],
    defaultPath: purpose === 'export-destination' ? app.getPath('downloads') : defaultProjectsDir(),
    properties: ['openDirectory', 'createDirectory'],
  }
  const result = window
    ? await dialog.showOpenDialog(window, options)
    : await dialog.showOpenDialog(options)
  const [path] = result.filePaths
  if (result.canceled || !path) return null
  approvedFolders.add(resolve(path))
  return path
}

export async function openProject(dir: string): Promise<ProjectSummary> {
  assertApproved(dir)
  current = await readPack(dir)
  await remember(current)
  return current
}

export async function createProject(request: NewPackRequest): Promise<ProjectSummary> {
  assertApproved(request.parentDir)
  const dir = await createPackFolder(request)
  approvedFolders.add(resolve(dir))
  return openProject(dir)
}

/** The open pack folder, or null. */
export function currentProject(): ProjectSummary | null {
  return current
}

function requireCurrent(): ProjectSummary {
  if (!current) throw new PackError('No pack is open.')
  return current
}

/** Replaces a texture in the open pack and returns the updated pack. */
export async function replaceTexture(
  path: string,
  png: Uint8Array,
  animation: Uint8Array | 'keep' | null,
): Promise<ProjectSummary> {
  const { dir } = requireCurrent()
  await writePackTexture(dir, path, png, animation)
  current = await readPack(dir)
  return current
}

/** Removes the open pack's version of a texture and returns the updated pack. */
export async function revertTexture(path: string): Promise<ProjectSummary> {
  const { dir } = requireCurrent()
  await removePackTexture(dir, path)
  current = await readPack(dir)
  return current
}

export function closeProject(): void {
  current = null
}

export async function exportCurrentProject(request: ExportRequest): Promise<ExportResult> {
  const { dir } = requireCurrent()
  const destination = request.destination ?? app.getPath('downloads')
  assertApproved(destination)
  // Re-read so files added outside the app since opening are included.
  current = await readPack(dir)
  const result = await exportPack(current, request, destination)

  if (Notification.isSupported()) {
    const count = result.files.length
    new Notification({
      title: 'Export finished',
      body: `${count} ZIP ${count === 1 ? 'file' : 'files'} saved to ${destination}`,
      silent: true,
    }).show()
  }
  return result
}
