// Minecraft's § formatting codes, used in pack descriptions (docs/DECISIONS.md #102).

export const SECTION = '§'

export const COLOURS = [
  { code: '0', name: 'Black', hex: '#000000' },
  { code: '1', name: 'Dark Blue', hex: '#0000AA' },
  { code: '2', name: 'Dark Green', hex: '#00AA00' },
  { code: '3', name: 'Dark Aqua', hex: '#00AAAA' },
  { code: '4', name: 'Dark Red', hex: '#AA0000' },
  { code: '5', name: 'Dark Purple', hex: '#AA00AA' },
  { code: '6', name: 'Gold', hex: '#FFAA00' },
  { code: '7', name: 'Gray', hex: '#AAAAAA' },
  { code: '8', name: 'Dark Gray', hex: '#555555' },
  { code: '9', name: 'Blue', hex: '#5555FF' },
  { code: 'a', name: 'Green', hex: '#55FF55' },
  { code: 'b', name: 'Aqua', hex: '#55FFFF' },
  { code: 'c', name: 'Red', hex: '#FF5555' },
  { code: 'd', name: 'Light Purple', hex: '#FF55FF' },
  { code: 'e', name: 'Yellow', hex: '#FFFF55' },
  { code: 'f', name: 'White', hex: '#FFFFFF' },
] as const

export const STYLES = [
  { code: 'l', name: 'Bold' },
  { code: 'o', name: 'Italic' },
  { code: 'n', name: 'Underline' },
  { code: 'm', name: 'Strikethrough' },
  { code: 'k', name: 'Obfuscated' },
  { code: 'r', name: 'Reset' },
] as const

export interface TextSegment {
  text: string
  /** Hex colour, or null for the default colour. */
  colour: string | null
  bold: boolean
  italic: boolean
  underline: boolean
  strikethrough: boolean
  obfuscated: boolean
}

const plain = {
  colour: null,
  bold: false,
  italic: false,
  underline: false,
  strikethrough: false,
  obfuscated: false,
}

/** Splits text into styled runs the way the game does: a colour code also clears styles. */
export function parseFormattedText(input: string): TextSegment[] {
  const segments: TextSegment[] = []
  let style: Omit<TextSegment, 'text'> = { ...plain }
  let text = ''

  const flush = (): void => {
    if (text) segments.push({ ...style, text })
    text = ''
  }

  for (let i = 0; i < input.length; i++) {
    const char = input[i]
    if (char !== SECTION || i === input.length - 1) {
      text += char
      continue
    }
    const code = input[++i].toLowerCase()
    const colour = COLOURS.find((entry) => entry.code === code)
    flush()
    if (colour) style = { ...plain, colour: colour.hex }
    else if (code === 'r') style = { ...plain }
    else if (code === 'l') style = { ...style, bold: true }
    else if (code === 'o') style = { ...style, italic: true }
    else if (code === 'n') style = { ...style, underline: true }
    else if (code === 'm') style = { ...style, strikethrough: true }
    else if (code === 'k') style = { ...style, obfuscated: true }
    // Unknown codes are swallowed, as in the game.
  }
  flush()
  return segments
}

/** The description without any formatting codes. */
export function stripFormatting(input: string): string {
  return parseFormattedText(input)
    .map((segment) => segment.text)
    .join('')
}
