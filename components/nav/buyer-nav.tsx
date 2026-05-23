'use client'

import Link from 'next/link'
import { useTheme } from 'next-themes'
import { Moon, Sun, Home, Grid, MessageCircle, User, History, Menu, X, Store, ShieldAlert } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/lib/firebase'

const PROTECTED_PREFIXES = ['/creator', '/admin', '/chat', '/dashboard', '/disputes', '/transactions']

function isProtected(href: string) {
  return PROTECTED_PREFIXES.some((prefix) => href.startsWith(prefix))
}

function getIsCreatorCookie(): boolean {
  if (typeof document === 'undefined') return false
  const match = document.cookie.match(/(?:^|;\s*)__isCreator=([^;]*)/)
  return match?.[1] === 'true'
}

export function BuyerNav() {
  const { theme, setTheme } = useTheme()
  const [isOpen, setIsOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [isCreator, setIsCreator] = useState(false)
  const router = useRouter()

  useEffect(() => {
    setMounted(true)
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsLoggedIn(!!user)
      setIsCreator(getIsCreatorCookie())
    })
    return unsubscribe
  }, [])

  const toggleMenu = () => setIsOpen(!isOpen)

  const navItems = [
    { label: 'Home',        href: '/',             icon: Home },
    { label: 'Categories',  href: '/categories',   icon: Grid },
    { label: 'Chat',        href: '/chat',          icon: MessageCircle },
    { label: 'Profile',     href: '/profile',       icon: User },
    { label: 'History',     href: '/transactions',  icon: History },
    { label: 'Disputes',    href: '/disputes',      icon: ShieldAlert },
  ]

  const sellerItem = {
    label: isCreator ? 'Switch to Seller' : 'Sell with U Mart',
    href: isCreator ? '/creator/dashboard' : '/seller/upgrade',
  }

  function handleNavClick(e: React.MouseEvent<HTMLAnchorElement>, href: string) {
    if (isProtected(href) && !isLoggedIn) {
      e.preventDefault()
      router.push(`/auth/login?redirect=${encodeURIComponent(href)}`)
      setIsOpen(false)
    }
  }

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-primary flex items-center justify-center">
              <span className="text-sm font-bold text-primary-foreground">UM</span>
            </div>
            <span className="hidden sm:inline font-bold text-lg">U Mart</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-6 lg:gap-8">
            {navItems.map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={(e) => handleNavClick(e, item.href)}
                  className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary transition-colors"
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Link>
              )
            })}

            {mounted && (
              <Link
                href={sellerItem.href}
                onClick={(e) => handleNavClick(e, sellerItem.href)}
                className="flex items-center gap-2 text-sm font-medium px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <Store className="w-4 h-4" />
                <span>{sellerItem.label}</span>
              </Link>
            )}
          </div>

          {/* Right side controls */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2 rounded-lg hover:bg-muted transition-colors"
              aria-label="Toggle theme"
            >
              {mounted ? (
                theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />
              ) : (
                <span className="w-5 h-5 block" />
              )}
            </button>

            <button
              onClick={toggleMenu}
              className="md:hidden p-2 rounded-lg hover:bg-muted transition-colors"
              aria-label="Toggle menu"
            >
              {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isOpen && (
          <div className="md:hidden pb-4 space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={(e) => {
                    handleNavClick(e, item.href)
                    if (isLoggedIn) setIsOpen(false)
                  }}
                  className="flex items-center gap-3 px-4 py-2 rounded-lg text-foreground hover:bg-muted transition-colors"
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </Link>
              )
            })}

            {mounted && (
              <Link
                href={sellerItem.href}
                onClick={(e) => {
                  handleNavClick(e, sellerItem.href)
                  setIsOpen(false)
                }}
                className="flex items-center gap-3 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <Store className="w-5 h-5" />
                <span>{sellerItem.label}</span>
              </Link>
            )}
          </div>
        )}
      </div>
    </nav>
  )
}