'use client'

import Link from 'next/link'
import { useTheme } from 'next-themes'
import {
  Moon, Sun, LayoutDashboard, Plus, Package, MessageCircle,
  DollarSign, BadgeDollarSign, Menu, X, ShieldAlert, BookOpen,
} from 'lucide-react'
import { useState, useEffect } from 'react'

export function CreatorNav() {
  const { theme, setTheme } = useTheme()
  const [isOpen, setIsOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  const toggleMenu = () => setIsOpen(!isOpen)

  const navItems = [
    { label: 'Dashboard',      href: '/creator/dashboard',         icon: LayoutDashboard },
    { label: 'Create Product', href: '/creator/product/create',    icon: Plus },
    { label: 'My Products',    href: '/creator/product/my-products', icon: Package },
    { label: 'Chats',          href: '/creator/chat',              icon: MessageCircle },
    { label: 'Invoice',        href: '/creator/invoice',           icon: BadgeDollarSign },
    { label: 'Transactions',   href: '/creator/transactions',      icon: DollarSign },
    { label: 'Disputes',       href: '/creator/disputes',          icon: ShieldAlert },
    { label: 'Catalogue',      href: '/creator/catalogue',         icon: BookOpen },
  ]

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/creator/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-primary flex items-center justify-center">
              <span className="text-sm font-bold text-primary-foreground">UM</span>
            </div>
            <span className="hidden sm:inline font-bold text-lg">U Mart Seller</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-5 lg:gap-7">
            {navItems.map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary transition-colors"
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden lg:inline">{item.label}</span>
                </Link>
              )
            })}
          </div>

          {/* Right side controls */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2 rounded-lg hover:bg-muted transition-colors"
              aria-label="Toggle theme"
            >
              {!mounted ? (
                <div className="w-5 h-5" />
              ) : theme === 'dark' ? (
                <Sun className="w-5 h-5" />
              ) : (
                <Moon className="w-5 h-5" />
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
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-3 px-4 py-2 rounded-lg text-foreground hover:bg-muted transition-colors"
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </nav>
  )
}
