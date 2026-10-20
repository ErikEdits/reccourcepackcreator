// File and folder names derived from user input; safe on Windows and Linux.

// Control characters are invalid in Windows file names, hence the range.
// eslint-disable-next-line no-control-regex
const FORBIDDEN = /[<>:"/\\|?*\u0000-\u001f]/g
const RESERVED_WINDOWS = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i

export function sanitizeFileName(input: string, fallback = 'Resource Pack'): string {
  const cleaned = input
    .replace(FORBIDDEN, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/, '')
    .slice(0, 120)
  if (!cleaned || RESERVED_WINDOWS.test(cleaned)) return fallback
  return cleaned
}

export interface TemplateValues {
  name: string
  packVersion: string
  /** Minecraft version or range, e.g. "1.21.4" or "1.20.3-1.20.4". */
  mc: string
  format: string
}

/** Fills {name}, {packVersion}, {mc} and {format}; unknown placeholders are left as typed. */
export function renderFileNameTemplate(template: string, values: TemplateValues): string {
  const filled = template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? values[key as keyof TemplateValues] : match,
  )
  return `${sanitizeFileName(filled.replace(/\.zip$/i, ''), 'resource-pack')}.zip`
}
