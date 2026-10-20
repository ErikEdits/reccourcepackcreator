import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost'

const variants: Record<Variant, string> = {
  primary: 'bg-grass text-white hover:bg-grass-strong disabled:opacity-50',
  secondary: 'border border-line bg-raised text-ink hover:border-ink-muted disabled:opacity-50',
  ghost: 'text-ink-muted hover:text-ink disabled:opacity-50',
}

export function Button({
  variant = 'secondary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      className={`rounded-md px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed ${variants[variant]} ${className}`}
      {...props}
    />
  )
}

export function Modal({
  title,
  onClose,
  children,
  footer,
  width = 'max-w-2xl',
}: {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  width?: string
}) {
  const bodyRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  // Only on open: re-running this on every render would steal focus while typing.
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onCloseRef.current()
    }
    window.addEventListener('keydown', onKey)
    bodyRef.current?.querySelector<HTMLElement>('input, textarea, select, button')?.focus()
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`flex max-h-full w-full ${width} flex-col overflow-hidden rounded-lg border border-line bg-panel shadow-2xl select-text`}
      >
        <div className="flex items-center border-b border-line px-5 py-3">
          <h2 className="text-base font-semibold">{title}</h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="ml-auto rounded px-2 text-lg leading-none text-ink-muted hover:text-ink"
          >
            ×
          </button>
        </div>
        <div ref={bodyRef} className="min-h-0 flex-1 overflow-auto px-5 py-4">
          {children}
        </div>
        {footer && (
          <div className="flex items-center gap-2 border-t border-line px-5 py-3">{footer}</div>
        )}
      </div>
    </div>
  )
}

export function Field({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string
  hint?: ReactNode
  htmlFor?: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-ink-muted">{hint}</p>}
    </div>
  )
}

export const inputClass =
  'w-full rounded-md border border-line bg-raised px-3 py-1.5 text-sm text-ink outline-none focus:border-grass'

export function ErrorText({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="text-sm text-danger">
      {children}
    </p>
  )
}
