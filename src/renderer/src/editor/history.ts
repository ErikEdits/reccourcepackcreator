// Unlimited undo/redo with named steps (docs/DECISIONS.md #30).

import type { EditorDocument } from './document'

export interface HistoryEntry {
  label: string
  doc: EditorDocument
}

export interface History {
  entries: readonly HistoryEntry[]
  /** The entry currently shown. */
  index: number
}

export function startHistory(doc: EditorDocument, label = 'Opened'): History {
  return { entries: [{ label, doc }], index: 0 }
}

export function currentDoc(history: History): EditorDocument {
  return history.entries[history.index].doc
}

/**
 * Records a new state; anything that was undone is dropped. With `coalesce`, a change right
 * after one with the same label replaces it (dragging a slider makes one step, not hundreds).
 */
export function record(
  history: History,
  label: string,
  doc: EditorDocument,
  coalesce = false,
): History {
  const last = history.entries[history.index]
  const keep =
    coalesce && history.index > 0 && last.label === label ? history.index : history.index + 1
  const entries = [...history.entries.slice(0, keep), { label, doc }]
  return { entries, index: entries.length - 1 }
}

export function canUndo(history: History): boolean {
  return history.index > 0
}

export function canRedo(history: History): boolean {
  return history.index < history.entries.length - 1
}

export function jumpTo(history: History, index: number): History {
  return { ...history, index: Math.max(0, Math.min(history.entries.length - 1, index)) }
}

export const undo = (history: History): History => jumpTo(history, history.index - 1)
export const redo = (history: History): History => jumpTo(history, history.index + 1)
