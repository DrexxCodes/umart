'use client'

// Hides the footer on chat routes where it would interfere with the fixed
// message input bar: /chat and /creator/chat (and any sub-paths like /creator/chat/*)

import { usePathname } from 'next/navigation'
import { Footer } from './footer'

const HIDDEN_PATHS = ['/chat', '/creator/chat']

export function FooterWrapper() {
  const pathname = usePathname()
  const hide = HIDDEN_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + '/')
  )
  if (hide) return null
  return <Footer />
}
