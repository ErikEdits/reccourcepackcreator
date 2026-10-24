import { useToasts } from '../store/toasts'

export function Toasts() {
  const toasts = useToasts((state) => state.toasts)
  const dismiss = useToasts((state) => state.dismiss)

  // Bottom left, away from the dialogs' buttons, and click-through apart from the dismiss
  // button, so a message never blocks what is underneath it.
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-10 left-4 z-50 flex w-80 flex-col gap-2"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          className={`flex items-start gap-2 rounded-md border px-3 py-2 text-sm shadow-lg ${
            toast.kind === 'success'
              ? 'border-grass/60 bg-raised text-ink'
              : 'border-danger/60 bg-raised text-danger'
          }`}
        >
          <span className="min-w-0 flex-1 break-words">{toast.message}</span>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => dismiss(toast.id)}
            className="pointer-events-auto text-ink-muted hover:text-ink"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
