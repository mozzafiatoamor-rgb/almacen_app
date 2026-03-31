/**
 * LoadingOverlay — full-screen overlay shown while data is loading or refreshing.
 *
 * Displays:
 *  - Mozzafiato logo (pulsing animation)
 *  - Random motivational message for employees that cycles every 3 seconds
 *  - Animated loading dots
 *
 * Behavior:
 *  - Full opacity on first load (no cached data yet)
 *  - Slightly transparent on background refresh (so UI is still visible underneath)
 */
import { useEffect, useState } from 'react'
import { useIsFetching, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'

const MESSAGES = [
  { text: '¡Hoy es un gran día para dar lo mejor de ti!',         emoji: '🌟' },
  { text: 'Cada pequeño detalle que cuidas hace la diferencia',    emoji: '💪' },
  { text: 'Tu trabajo hace posible la magia de Mozzafiato',        emoji: '✨' },
  { text: 'El éxito es la suma de pequeños esfuerzos cada día',    emoji: '🚀' },
  { text: '¡Un equipo unido siempre llega más lejos!',             emoji: '🤝' },
  { text: 'La excelencia no es un acto, es un hábito',             emoji: '⭐' },
  { text: 'Cada cliente feliz es gracias a tu esfuerzo',           emoji: '🙏' },
  { text: '¡Eres parte de algo extraordinario!',                   emoji: '🌺' },
  { text: 'El orden de hoy construye el éxito de mañana',          emoji: '📦' },
  { text: 'Gracias por tu dedicación. ¡Mozzafiato eres tú!',       emoji: '☕' },
  { text: 'El trabajo en equipo es el secreto del éxito',          emoji: '🏆' },
  { text: '¡Tu esfuerzo no pasa desapercibido, gracias!',          emoji: '💯' },
  { text: 'Cada día es una oportunidad de ser mejor',              emoji: '🌅' },
  { text: '¡Attitude positiva, resultados extraordinarios!',       emoji: '💥' },
  { text: 'Lo que haces importa. ¡Sigue brillando!',               emoji: '🔥' },
]

// Pick a random starting message index
function randomIdx() {
  return Math.floor(Math.random() * MESSAGES.length)
}

export default function LoadingOverlay() {
  const isFetching    = useIsFetching()
  const qc            = useQueryClient()
  const [msgIdx, setMsgIdx] = useState(randomIdx)
  const [visible, setVisible] = useState(false)

  // Determine if any query has NO cached data (first load vs background refresh)
  const hasAnyData = Boolean(
    qc.getQueryData(['catalogo']) ||
    qc.getQueryData(['movimientos'])
  )
  const isFirstLoad = !hasAnyData && isFetching > 0

  // Delay showing by 150ms to avoid flicker on fast connections
  useEffect(() => {
    if (isFetching > 0) {
      const t = setTimeout(() => setVisible(true), 150)
      return () => clearTimeout(t)
    } else {
      // Small delay before hiding so the logo doesn't flicker away instantly
      const t = setTimeout(() => setVisible(false), 400)
      return () => clearTimeout(t)
    }
  }, [isFetching])

  // Cycle motivational messages every 3 seconds while visible
  useEffect(() => {
    if (!visible) return
    const interval = setInterval(() => {
      setMsgIdx(i => (i + 1) % MESSAGES.length)
    }, 3000)
    return () => clearInterval(interval)
  }, [visible])

  const msg   = MESSAGES[msgIdx]
  // Full opacity on first load, semi-transparent on background refresh
  const bgOpacity = isFirstLoad ? '0.97' : '0.82'

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="loading-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[500] flex flex-col items-center justify-center"
          style={{ background: `rgba(14, 23, 38, ${bgOpacity})`, backdropFilter: 'blur(6px)' }}
        >
          {/* Logo */}
          <motion.img
            src={`${import.meta.env.BASE_URL}logo.png`}
            alt="Mozzafiato"
            className="w-36 h-36 object-contain mb-6 select-none"
            animate={{ scale: [1, 1.06, 1], opacity: [0.9, 1, 0.9] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
            onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
          />

          {/* Animated loading dots */}
          <div className="flex gap-1.5 mb-8">
            {[0, 1, 2].map(i => (
              <motion.div
                key={i}
                className="w-2 h-2 rounded-full bg-accent"
                animate={{ y: [0, -6, 0], opacity: [0.4, 1, 0.4] }}
                transition={{
                  duration: 0.8,
                  repeat: Infinity,
                  delay: i * 0.18,
                  ease: 'easeInOut',
                }}
              />
            ))}
          </div>

          {/* Motivational message — cycles with fade */}
          <div className="px-8 text-center max-w-xs">
            <AnimatePresence mode="wait">
              <motion.div
                key={msgIdx}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.45 }}
                className="flex flex-col items-center gap-2"
              >
                <span className="text-3xl leading-none">{msg.emoji}</span>
                <p className="text-sm font-medium text-white/80 leading-snug text-center">
                  {msg.text}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* "Actualizando" label only on background refresh */}
          {!isFirstLoad && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              className="absolute bottom-16 text-[11px] text-white/50 font-medium tracking-wide"
            >
              Actualizando datos…
            </motion.p>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
