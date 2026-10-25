// The stroke being drawn right now, shared between the 2D canvas and the 3D preview so both
// show it before it becomes a step in the history. Outside React state on purpose: it changes
// with every mouse move.

import type { EditorDocument } from './document'

let draft: EditorDocument | null = null
const listeners = new Set<() => void>()

export function getDraft(): EditorDocument | null {
  return draft
}

export function setDraft(next: EditorDocument | null): void {
  if (next === draft) return
  draft = next
  for (const listener of listeners) listener()
}

/** Returns a function that removes the listener. */
export function onDraft(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
