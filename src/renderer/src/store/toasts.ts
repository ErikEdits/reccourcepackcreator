import { create } from 'zustand'

export interface Toast {
  id: number
  kind: 'success' | 'error'
  message: string
}

interface ToastState {
  toasts: Toast[]
  push: (kind: Toast['kind'], message: string) => void
  dismiss: (id: number) => void
}

const VISIBLE_MS = 6000
let nextId = 1

export const useToasts = create<ToastState>()((set, get) => ({
  toasts: [],
  push: (kind, message) => {
    const id = nextId++
    set({ toasts: [...get().toasts, { id, kind, message }] })
    setTimeout(() => get().dismiss(id), VISIBLE_MS)
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((toast) => toast.id !== id) }),
}))
