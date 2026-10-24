// Editor keyboard shortcuts: sensible defaults that the user can remap (docs/DECISIONS.md #63).

export const SHORTCUT_ACTIONS = {
  'tool.pencil': 'Pencil',
  'tool.eraser': 'Eraser',
  'tool.fill': 'Fill',
  'tool.gradient': 'Gradient',
  'tool.picker': 'Colour picker',
  'tool.line': 'Line',
  'tool.rectangle': 'Rectangle',
  'tool.ellipse': 'Ellipse',
  'tool.select': 'Select',
  'tool.move': 'Move',
  'colours.swap': 'Swap colours',
  'brush.smaller': 'Smaller brush',
  'brush.bigger': 'Bigger brush',
  'history.undo': 'Undo',
  'history.redo': 'Redo',
  'history.redoAlt': 'Redo (alternative)',
  'selection.all': 'Select all',
  'selection.none': 'Deselect',
  'selection.delete': 'Delete selection',
  'clipboard.copy': 'Copy',
  'clipboard.cut': 'Cut',
  'clipboard.paste': 'Paste as new layer',
  'transform.flipHorizontal': 'Flip horizontally',
  'transform.flipVertical': 'Flip vertically',
  'transform.rotate': 'Rotate 90°',
  'view.zoomIn': 'Zoom in',
  'view.zoomOut': 'Zoom out',
  'view.fit': 'Fit to window',
  'view.grid': 'Pixel grid',
} as const

export type ShortcutAction = keyof typeof SHORTCUT_ACTIONS

export const DEFAULT_SHORTCUTS: Record<ShortcutAction, string> = {
  'tool.pencil': 'B',
  'tool.eraser': 'E',
  'tool.fill': 'G',
  'tool.gradient': 'Shift+G',
  'tool.picker': 'I',
  'tool.line': 'L',
  'tool.rectangle': 'R',
  'tool.ellipse': 'O',
  'tool.select': 'M',
  'tool.move': 'V',
  'colours.swap': 'X',
  'brush.smaller': '[',
  'brush.bigger': ']',
  'history.undo': 'Ctrl+Z',
  'history.redo': 'Ctrl+Shift+Z',
  'history.redoAlt': 'Ctrl+Y',
  'selection.all': 'Ctrl+A',
  'selection.none': 'Escape',
  'selection.delete': 'Delete',
  'clipboard.copy': 'Ctrl+C',
  'clipboard.cut': 'Ctrl+X',
  'clipboard.paste': 'Ctrl+V',
  'transform.flipHorizontal': 'Shift+H',
  'transform.flipVertical': 'Shift+V',
  'transform.rotate': 'Shift+R',
  'view.zoomIn': '+',
  'view.zoomOut': '-',
  'view.fit': '0',
  'view.grid': '#',
}

const MODIFIER_KEYS = new Set(['Control', 'Shift', 'Alt', 'Meta', 'AltGraph', 'CapsLock'])

/**
 * The shortcut a key press stands for, like "Ctrl+Shift+Z", or null for a lone modifier.
 * Shift is left out for symbols because it is needed to type them on many keyboards ("+", "#").
 */
export function shortcutFromEvent(event: {
  key: string
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
  altKey: boolean
}): string | null {
  if (MODIFIER_KEYS.has(event.key)) return null
  const letter = /^[a-z]$/i.test(event.key)
  const key = letter ? event.key.toUpperCase() : event.key === ' ' ? 'Space' : event.key
  const parts: string[] = []
  if (event.ctrlKey || event.metaKey) parts.push('Ctrl')
  if (event.altKey) parts.push('Alt')
  if (event.shiftKey && (letter || key.length > 1)) parts.push('Shift')
  parts.push(key)
  return parts.join('+')
}

/** The defaults with the user's changes applied, as shortcut → action. */
export function shortcutMap(
  overrides: Partial<Record<ShortcutAction, string>>,
): Map<string, ShortcutAction> {
  const map = new Map<string, ShortcutAction>()
  for (const action of Object.keys(DEFAULT_SHORTCUTS) as ShortcutAction[]) {
    const shortcut = overrides[action] ?? DEFAULT_SHORTCUTS[action]
    if (shortcut) map.set(shortcut, action)
  }
  // "=" sits under "+" on US keyboards.
  if (!map.has('=') && map.get('+') === 'view.zoomIn') map.set('=', 'view.zoomIn')
  return map
}
