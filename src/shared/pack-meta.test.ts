import { describe, expect, it } from 'vitest'
import { buildPackMcmeta, parsePackMcmeta, readDescription, readFormat } from './pack-meta'

describe('buildPackMcmeta', () => {
  it('uses pack_format before Minecraft 1.21.9', () => {
    expect(JSON.parse(buildPackMcmeta('§aHello', { major: 46, minor: 0 }))).toEqual({
      pack: { pack_format: 46, description: '§aHello' },
    })
  })

  it('uses min_format and max_format from format 65 on', () => {
    expect(JSON.parse(buildPackMcmeta('Hi', { major: 97, minor: 1 }))).toEqual({
      pack: { description: 'Hi', min_format: [97, 1], max_format: [97, 1] },
    })
  })

  it('keeps other sections of an existing pack.mcmeta', () => {
    const language = { xx_xx: { name: 'Test', region: 'Test', bidirectional: false } }
    const meta = JSON.parse(buildPackMcmeta('Hi', { major: 15, minor: 0 }, { language }))
    expect(meta.language).toEqual(language)
    expect(meta.pack.pack_format).toBe(15)
  })
})

describe('reading pack.mcmeta', () => {
  it('tolerates a byte order mark and rejects non-objects', () => {
    expect(parsePackMcmeta('﻿{"pack":{}}')).toEqual({ pack: {} })
    expect(parsePackMcmeta('[1,2]')).toBeNull()
    expect(parsePackMcmeta('not json')).toBeNull()
  })

  it('flattens JSON text component descriptions', () => {
    const meta = { pack: { description: [{ text: 'Red ', color: 'red' }, { text: 'pack' }] } }
    expect(readDescription(meta)).toBe('Red pack')
  })

  it('reads old and new format declarations', () => {
    expect(readFormat({ pack: { pack_format: 34 } })).toEqual({ major: 34, minor: 0 })
    expect(readFormat({ pack: { min_format: [69, 0], max_format: 75 } })).toEqual({
      major: 69,
      minor: 0,
    })
    expect(readFormat({ pack: {} })).toBeNull()
  })
})
