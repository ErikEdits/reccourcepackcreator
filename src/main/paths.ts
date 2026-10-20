import { isAbsolute, relative, resolve } from 'node:path'

/** True if `target` is `root` itself or somewhere below it. */
export function isInside(root: string, target: string): boolean {
  const rel = relative(resolve(root), resolve(target))
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}
