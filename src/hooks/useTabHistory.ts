/**
 * useTabHistory — tab navigation with back-gesture and Android back button.
 *
 * Features:
 *  - Maintains a stack of visited tabs so "back" always goes somewhere logical.
 *  - On every tab change, pushes a state into browser history so the Android
 *    hardware/software back button (popstate event) triggers goBack().
 *  - Detects a left-edge swipe-right touch gesture and calls goBack() — works
 *    the same way as the Android system navigation gesture.
 *
 * Usage in App.tsx:
 *   const { tab, navigate, canGoBack } = useTabHistory()
 *   // pass `navigate` wherever `setTab` was used
 */
import { useState, useEffect, useRef } from 'react'
import type { Tab } from '../api/types'

export function useTabHistory(initial: Tab = 'home') {
  const [tab,    setTab]    = useState<Tab>(initial)
  // stackRef never becomes stale in event listeners because it's a ref
  const stackRef = useRef<Tab[]>([initial])

  // ── Navigate to a new tab ──────────────────────────────────────────────────
  function navigate(next: Tab) {
    if (next === stackRef.current[stackRef.current.length - 1]) return
    stackRef.current = [...stackRef.current, next]
    // Push an entry so popstate fires when Android back is pressed
    window.history.pushState({ mozzTab: next }, '')
    setTab(next)
  }

  // ── Go back one step in our stack ─────────────────────────────────────────
  function goBack(): boolean {
    const stack = stackRef.current
    if (stack.length <= 1) return false
    const newStack = stack.slice(0, -1)
    stackRef.current = newStack
    const prev = newStack[newStack.length - 1]
    setTab(prev)
    return true
  }

  // ── Android hardware/software back button ─────────────────────────────────
  useEffect(() => {
    function onPopState() {
      const went = goBack()
      if (!went) {
        // Nothing in our stack — let the browser handle it naturally
      } else {
        // Re-push so future back presses still work
        window.history.pushState({ mozzTab: stackRef.current[stackRef.current.length - 1] }, '')
      }
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, []) // goBack only uses stackRef + setTab (both stable)

  // ── Swipe-right from left edge → go back ─────────────────────────────────
  useEffect(() => {
    let startX = 0
    let startY = 0

    function onTouchStart(e: TouchEvent) {
      startX = e.touches[0].clientX
      startY = e.touches[0].clientY
    }

    function onTouchEnd(e: TouchEvent) {
      const dx = e.changedTouches[0].clientX - startX
      const dy = Math.abs(e.changedTouches[0].clientY - startY)
      // Only trigger if:
      //  - Start was within 50px of the left edge (matches Android edge gesture zone)
      //  - Horizontal distance > 75px
      //  - Not primarily a vertical scroll
      if (startX < 50 && dx > 75 && dy < 80) {
        goBack()
      }
    }

    document.addEventListener('touchstart', onTouchStart, { passive: true })
    document.addEventListener('touchend',   onTouchEnd,   { passive: true })
    return () => {
      document.removeEventListener('touchstart', onTouchStart)
      document.removeEventListener('touchend',   onTouchEnd)
    }
  }, []) // goBack only uses refs

  return {
    tab,
    navigate,
    goBack,
    canGoBack: stackRef.current.length > 1,
  }
}
