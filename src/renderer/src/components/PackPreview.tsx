import { useEffect, useMemo, useState } from 'react'
import { parseFormattedText, type TextSegment } from '../../../shared/text-format'
import { pngUrl } from '../lib/images'
import { GrassBlockIcon } from './GrassBlockIcon'

const OBFUSCATED_CHARS = '!#$%&*+-0123456789<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ'

function scramble(text: string): string {
  return [...text]
    .map((char) =>
      char === ' ' ? char : OBFUSCATED_CHARS[Math.floor(Math.random() * OBFUSCATED_CHARS.length)],
    )
    .join('')
}

function segmentStyle(segment: TextSegment, defaultColour: string) {
  const lines = [segment.underline && 'underline', segment.strikethrough && 'line-through']
  return {
    color: segment.colour ?? defaultColour,
    fontWeight: segment.bold ? 700 : 400,
    fontStyle: segment.italic ? 'italic' : 'normal',
    textDecorationLine: lines.filter(Boolean).join(' ') || 'none',
  }
}

/** Text with § formatting codes, rendered like the game does. */
export function MinecraftText({ text, defaultColour }: { text: string; defaultColour: string }) {
  const segments = parseFormattedText(text)
  const hasObfuscated = segments.some((segment) => segment.obfuscated)
  const [, setTick] = useState(0)

  useEffect(() => {
    if (!hasObfuscated) return
    const timer = setInterval(() => setTick((tick) => tick + 1), 80)
    return () => clearInterval(timer)
  }, [hasObfuscated])

  return (
    <>
      {segments.map((segment, i) => (
        <span key={i} style={segmentStyle(segment, defaultColour)}>
          {segment.obfuscated ? scramble(segment.text) : segment.text}
        </span>
      ))}
    </>
  )
}

/** How the pack appears in Minecraft's resource pack list. */
export function PackPreview({
  name,
  description,
  icon,
}: {
  name: string
  description: string
  icon: Uint8Array | null
}) {
  const iconUrl = useMemo(() => (icon ? pngUrl(icon) : null), [icon])

  useEffect(() => {
    if (!iconUrl) return
    return () => URL.revokeObjectURL(iconUrl)
  }, [iconUrl])

  return (
    <div
      aria-label="In-game preview"
      className="flex gap-3 rounded-sm border border-black bg-[#1e1e1e] p-2 font-mono text-[13px] leading-[1.35] shadow-inner"
    >
      <div className="flex size-16 shrink-0 items-center justify-center bg-black/40">
        {iconUrl ? (
          <img src={iconUrl} alt="" className="size-16 [image-rendering:pixelated]" />
        ) : (
          <GrassBlockIcon size={48} />
        )}
      </div>
      <div className="min-w-0 py-0.5">
        <p className="truncate text-white">{name || 'Unnamed pack'}</p>
        <p className="line-clamp-2 whitespace-pre-wrap break-words">
          <MinecraftText text={description} defaultColour="#AAAAAA" />
        </p>
      </div>
    </div>
  )
}
