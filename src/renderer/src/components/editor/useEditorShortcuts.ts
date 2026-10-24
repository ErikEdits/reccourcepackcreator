import { useEffect, useMemo } from 'react'
import { shortcutFromEvent, shortcutMap, type ShortcutAction } from '../../editor/shortcuts'
import { useEditor, type Tool } from '../../store/editor'
import { useProject } from '../../store/project'
import { useSettings } from '../../store/settings'

function run(action: ShortcutAction): void {
  const editor = useEditor.getState()
  if (action.startsWith('tool.')) return editor.setTool(action.slice(5) as Tool)
  switch (action) {
    case 'colours.swap':
      return editor.swapColours()
    case 'brush.smaller':
      return editor.setBrushSize(editor.brushSize - 1)
    case 'brush.bigger':
      return editor.setBrushSize(editor.brushSize + 1)
    case 'history.undo':
      return editor.undo()
    case 'history.redo':
    case 'history.redoAlt':
      return editor.redo()
    case 'selection.all':
      return editor.selectAll()
    case 'selection.none':
      return editor.setSelection(null)
    case 'selection.delete':
      return editor.deleteSelection()
    case 'clipboard.copy':
      return editor.copy()
    case 'clipboard.cut':
      return editor.cut()
    case 'clipboard.paste':
      return editor.paste()
    case 'transform.flipHorizontal':
      return editor.transform('flip-horizontal')
    case 'transform.flipVertical':
      return editor.transform('flip-vertical')
    case 'transform.rotate':
      return editor.transform('rotate')
    case 'view.zoomIn':
      return editor.zoomStep(1)
    case 'view.zoomOut':
      return editor.zoomStep(-1)
    case 'view.fit':
      return editor.setZoom(null)
    case 'view.grid':
      return editor.toggleGrid()
  }
}

/** Editor keyboard shortcuts, active while the editor is shown and nothing else has focus. */
export function useEditorShortcuts(): void {
  const overrides = useSettings((state) => state.shortcuts)
  const map = useMemo(() => shortcutMap(overrides), [overrides])

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.defaultPrevented || useProject.getState().dialog) return
      const target = event.target
      if (
        target instanceof HTMLElement &&
        target.closest('input, textarea, select, [contenteditable], [role="dialog"]')
      ) {
        return
      }
      const shortcut = shortcutFromEvent(event)
      const action = shortcut && map.get(shortcut)
      if (!action) return
      event.preventDefault()
      run(action)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [map])
}
