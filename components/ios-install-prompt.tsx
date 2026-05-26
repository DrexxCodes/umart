'use client'
// Shows a bottom sheet on iOS Safari prompting the user to add Umart to their
// home screen. Appears only when:
//   1. Running on iOS (Safari or WKWebView)
//   2. NOT already installed as a standalone PWA
//   3. User hasn't dismissed it in the last 14 days (localStorage)

import { useEffect, useState } from 'react'
import { Share2, Plus, X } from 'lucide-react'

const DISMISSED_KEY = 'umart_ios_prompt_dismissed'
const DISMISS_TTL   = 14 * 24 * 60 * 60 * 1000  // 14 days in ms

function isIos(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

function isInStandaloneMode(): boolean {
  if (typeof window === 'undefined') return false
  return (
    ('standalone' in window.navigator && (window.navigator as any).standalone === true) ||
    window.matchMedia('(display-mode: standalone)').matches
  )
}

function wasRecentlyDismissed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY)
    if (!raw) return false
    return Date.now() - parseInt(raw, 10) < DISMISS_TTL
  } catch {
    return false
  }
}

export function IosInstallPrompt() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!isIos()) return
    if (isInStandaloneMode()) return
    if (wasRecentlyDismissed()) return

    // Small settle delay so the page loads first
    const t = setTimeout(() => setVisible(true), 2000)
    return () => clearTimeout(t)
  }, [])

  const handleDismiss = () => {
    try { localStorage.setItem(DISMISSED_KEY, String(Date.now())) } catch { /* ignore */ }
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      className="
        fixed bottom-0 left-0 right-0 z-[60]
        flex justify-center
        px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))]
        animate-in slide-in-from-bottom-4 fade-in duration-400
      "
    >
      <div className="w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div className="flex items-center gap-2.5">
            {/* App icon */}
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-sm shrink-0">
              <span className="text-xs font-black text-primary-foreground tracking-tight">UM</span>
            </div>
            <div>
              <p className="text-sm font-bold text-foreground leading-tight">Add to Home Screen</p>
              <p className="text-xs text-muted-foreground">Get the full app experience</p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
            aria-label="Dismiss"
          >
            <X size={14} />
          </button>
        </div>

        {/* Steps */}
        <div className="px-4 pb-4 space-y-2.5">
          <p className="text-xs text-muted-foreground">Install in two taps:</p>

          <div className="flex items-center gap-3 rounded-xl bg-muted/50 px-3 py-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500 text-white shadow-sm">
              <Share2 size={14} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-foreground">Tap the Share button</p>
              <p className="text-[10px] text-muted-foreground">The square with an arrow at the bottom of Safari</p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-xl bg-muted/50 px-3 py-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500 text-white shadow-sm">
              <Plus size={14} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-foreground">Tap "Add to Home Screen"</p>
              <p className="text-[10px] text-muted-foreground">Scroll down in the share sheet and tap Add</p>
            </div>
          </div>
        </div>

        {/* Bottom arrow indicator */}
        <div className="flex justify-center pb-2">
          <div className="flex gap-0.5">
            {[0,1,2].map(i => (
              <div
                key={i}
                className="w-1 h-1 rounded-full bg-muted-foreground/30"
                style={{ animationDelay: `${i * 150}ms` }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
