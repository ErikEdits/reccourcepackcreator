import type { ReactNode } from 'react'
import type { Tool } from '../../store/editor'

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

const TOOL_ICONS: Record<Tool, ReactNode> = {
  pencil: (
    <Icon>
      <path d="M2.5 13.5l1-3.5 7.5-7.5 2.5 2.5-7.5 7.5z" />
      <path d="M9.5 4l2.5 2.5" />
    </Icon>
  ),
  eraser: (
    <Icon>
      <path d="M6 13.5h7.5" />
      <path d="M2.5 10l6.5-6.5 4 4-6 6H5.5z" />
      <path d="M6 6.5l4 4" />
    </Icon>
  ),
  fill: (
    <Icon>
      <path d="M3 7.5l5-5 5 5-5 5z" />
      <path d="M3 7.5h10" />
      <path d="M13.5 10.5c.6 1 1 1.6 1 2.2a1 1 0 01-2 0c0-.6.4-1.2 1-2.2z" />
    </Icon>
  ),
  gradient: (
    <Icon>
      <rect x="2" y="2" width="12" height="12" rx="1" />
      <path d="M5 2v12M8 2v12" strokeDasharray="1 2" />
      <path d="M11 2v12" strokeDasharray="1 4" />
    </Icon>
  ),
  picker: (
    <Icon>
      <path d="M10 2.5l3.5 3.5-1.5 1.5-3.5-3.5z" />
      <path d="M9.5 6.5L4 12l-1.5 1.5M8 5l-5 5v3h3l5-5" />
    </Icon>
  ),
  line: (
    <Icon>
      <path d="M3 13L13 3" />
    </Icon>
  ),
  rectangle: (
    <Icon>
      <rect x="2.5" y="3.5" width="11" height="9" />
    </Icon>
  ),
  ellipse: (
    <Icon>
      <ellipse cx="8" cy="8" rx="5.5" ry="4.5" />
    </Icon>
  ),
  select: (
    <Icon>
      <rect x="2.5" y="2.5" width="11" height="11" strokeDasharray="2 2" />
    </Icon>
  ),
  move: (
    <Icon>
      <path d="M8 1.5v13M1.5 8h13" />
      <path d="M6 3.5l2-2 2 2M6 12.5l2 2 2-2M3.5 6l-2 2 2 2M12.5 6l2 2-2 2" />
    </Icon>
  ),
}

export function ToolIcon({ tool }: { tool: Tool }) {
  return TOOL_ICONS[tool]
}
