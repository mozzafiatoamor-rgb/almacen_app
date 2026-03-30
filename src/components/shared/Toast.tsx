import { useContext } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ToastContext } from '../../hooks/useToast'

export default function ToastContainer() {
  const ctx = useContext(ToastContext)
  if (!ctx) return null

  return (
    <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[999] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {ctx.toasts.map(t => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: -12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0,   scale: 1 }}
            exit={{   opacity: 0, y: -8,   scale: 0.95 }}
            className={`
              px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-lg
              ${t.type === 'error' ? 'bg-red' : 'bg-green'}
            `}
          >
            {t.type === 'error' ? '⚠️ ' : '✅ '}{t.message}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
