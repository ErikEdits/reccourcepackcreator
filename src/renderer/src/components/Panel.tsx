import type { ReactNode } from 'react'

export function Panel({
  title,
  header,
  children,
  className = 'bg-panel',
}: {
  title: string
  /** Replaces the plain title, e.g. with tabs. */
  header?: ReactNode
  children: ReactNode
  /** Background and borders; defaults to the panel background. */
  className?: string
}) {
  return (
    <section aria-label={title} className={`flex min-h-0 flex-col ${className}`}>
      <div className="flex h-9 shrink-0 items-center border-b border-line px-3">
        {header ?? (
          <h2 className="text-xs font-semibold tracking-wide text-ink-muted uppercase">{title}</h2>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-auto">{children}</div>
    </section>
  )
}

export function EmptyState({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-1 p-6 text-center">
      <p className="text-sm font-medium">{title}</p>
      <p className="max-w-64 text-xs text-ink-muted">{children}</p>
    </div>
  )
}
