import { describe, expect, it } from 'vitest'
import { renderFileNameTemplate, sanitizeFileName } from './file-names'

describe('sanitizeFileName', () => {
  it('removes characters Windows does not allow', () => {
    expect(sanitizeFileName('My: "Best" <Pack>?')).toBe('My Best Pack')
  })

  it('drops trailing dots and spaces', () => {
    expect(sanitizeFileName('Pack... ')).toBe('Pack')
  })

  it('falls back for empty or reserved names', () => {
    expect(sanitizeFileName('???')).toBe('Resource Pack')
    expect(sanitizeFileName('CON')).toBe('Resource Pack')
  })

  it('cannot be used to leave the folder', () => {
    expect(sanitizeFileName('../../etc')).toBe('....etc')
  })
})

describe('renderFileNameTemplate', () => {
  const values = { name: 'Cool Pack', packVersion: '1.2.0', mc: '1.21.4', format: '46' }

  it('fills the placeholders and adds .zip', () => {
    expect(renderFileNameTemplate('{name}_v{packVersion}_MC{mc}', values)).toBe(
      'Cool Pack_v1.2.0_MC1.21.4.zip',
    )
  })

  it('does not double the extension', () => {
    expect(renderFileNameTemplate('{name}.zip', values)).toBe('Cool Pack.zip')
  })

  it('leaves unknown placeholders and strips path separators', () => {
    expect(renderFileNameTemplate('a/{nope}\\{format}', values)).toBe('a{nope}46.zip')
  })
})
