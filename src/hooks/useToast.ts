// NOTE: This file uses .ts extension but contains a React component (ToastProvider).
// Rename to useToast.tsx if your bundler requires it, but Vite handles this fine.
import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { createElement } from 'react'

interface Toast {
  id:      number
  message: string
  type:    'success' | 'error'
}

interface ToastContextValue {
  toasts:  Toast[]
  toast:   (msg: string, type?: 'success' | 'error') => void
}

export const ToastContext = createContext<ToastContextValue | null>(null)

let _nextId = 1

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    const id = _nextId++
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 2800)
  }, [])

  return createElement(ToastContext.Provider, { value: { toasts, toast } }, children)
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be inside ToastProvider')
  return ctx.toast
}
