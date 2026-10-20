import { useRef } from 'react'
import { COLOURS, SECTION, STYLES } from '../../../shared/text-format'
import { inputClass } from './ui'

const styleLabels: Record<string, string> = { l: 'B', o: 'I', n: 'U', m: 'S', k: '?', r: '⟲' }

/** Description input with buttons that insert Minecraft's § colour and style codes. */
export function DescriptionEditor({
  id,
  value,
  onChange,
}: {
  id: string
  value: string
  onChange: (value: string) => void
}) {
  const textarea = useRef<HTMLTextAreaElement>(null)

  const insert = (code: string): void => {
    const element = textarea.current
    const start = element?.selectionStart ?? value.length
    const end = element?.selectionEnd ?? value.length
    const token = `${SECTION}${code}`
    onChange(value.slice(0, start) + token + value.slice(end))
    requestAnimationFrame(() => {
      element?.focus()
      element?.setSelectionRange(start + token.length, start + token.length)
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        role="toolbar"
        aria-label="Text formatting"
        className="flex flex-wrap items-center gap-1"
      >
        {COLOURS.map((colour) => (
          <button
            key={colour.code}
            type="button"
            title={colour.name}
            aria-label={`Colour: ${colour.name}`}
            onClick={() => insert(colour.code)}
            className="size-5 rounded-sm border border-black/30"
            style={{ backgroundColor: colour.hex }}
          />
        ))}
        <span className="mx-1 h-5 w-px bg-line" />
        {STYLES.map((style) => (
          <button
            key={style.code}
            type="button"
            title={style.name}
            aria-label={`Style: ${style.name}`}
            onClick={() => insert(style.code)}
            className="h-5 min-w-5 rounded-sm border border-line bg-raised px-1 text-xs font-semibold text-ink"
          >
            {styleLabels[style.code]}
          </button>
        ))}
      </div>
      <textarea
        id={id}
        ref={textarea}
        autoFocus
        value={value}
        rows={3}
        maxLength={1000}
        onChange={(event) => onChange(event.target.value)}
        className={`${inputClass} resize-none font-mono`}
        placeholder="A short description shown under the pack name"
      />
    </div>
  )
}
