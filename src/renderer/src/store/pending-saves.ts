// Lets the editor finish its automatic save before the pack is switched, exported or closed,
// without the project store having to know about the editor.

const flushers = new Set<() => Promise<void>>()

/** Returns a function that removes the flusher again. */
export function registerFlusher(flush: () => Promise<void>): () => void {
  flushers.add(flush)
  return () => flushers.delete(flush)
}

export async function flushPendingSaves(): Promise<void> {
  await Promise.all([...flushers].map((flush) => flush()))
}
