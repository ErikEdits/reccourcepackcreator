import { describe, expect, it } from 'vitest'
import { parseFormattedText, stripFormatting } from './text-format'

describe('parseFormattedText', () => {
  it('returns plain text as one unstyled segment', () => {
    expect(parseFormattedText('Hello')).toEqual([
      {
        text: 'Hello',
        colour: null,
        bold: false,
        italic: false,
        underline: false,
        strikethrough: false,
        obfuscated: false,
      },
    ])
  })

  it('applies colours and styles', () => {
    const [segment] = parseFormattedText('§c§lRed bold')
    expect(segment).toMatchObject({ text: 'Red bold', colour: '#FF5555', bold: true })
  })

  it('clears styles on a colour code, like the game', () => {
    const segments = parseFormattedText('§lBold§9Blue')
    expect(segments[1]).toMatchObject({ text: 'Blue', colour: '#5555FF', bold: false })
  })

  it('resets everything on §r', () => {
    const segments = parseFormattedText('§a§oGreen§rPlain')
    expect(segments[1]).toMatchObject({ text: 'Plain', colour: null, italic: false })
  })

  it('keeps a trailing § as text', () => {
    expect(stripFormatting('Price: 5§')).toBe('Price: 5§')
  })
})

describe('stripFormatting', () => {
  it('removes every code', () => {
    expect(stripFormatting('§6Gold §kx§r and §zunknown')).toBe('Gold x and unknown')
  })
})
