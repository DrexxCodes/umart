'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import {
  LayoutDashboard, FileText, Package, Tag, Users,
  Sun, Moon, ChevronRight, ShieldCheck, X, Menu,
  LayoutList, ShieldAlert, Gift,
} from 'lucide-react'

const NAV_ITEMS = [
  { label: 'Dashboard',  href: '/admin',             icon: LayoutDashboard, exact: true  },
  { label: 'References', href: '/admin/references',  icon: FileText,        exact: false },
  { label: 'Pay Queue',  href: '/admin/pay-queue',   icon: LayoutList,      exact: false },
  { label: 'Disputes',   href: '/admin/disputes',    icon: ShieldAlert,     exact: false },
  { label: 'Inventory',  href: '/admin/inventory',   icon: Package,         exact: false },
  { label: 'Categories', href: '/admin/categories',  icon: Tag,             exact: false },
  { label: 'Referrals',  href: '/admin/referrals',   icon: Gift,            exact: false },
  { label: 'Users',      href: '/admin/users',       icon: Users,           exact: false },
]

export function AdminNav() {
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()
  const [mounted,    setMounted]    = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => { setMounted(true) }, [])
  useEffect(() => { setMobileOpen(false) }, [pathname])
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  const isActive = (href: string, exact: boolean) => {
    if (exact) return pathname === href
    return pathname === href || pathname.startsWith(href + '/')
  }

  const NavLinks = ({ onClick }: { onClick?: () => void }) => (
    <>
      {NAV_ITEMS.map(({ label, href, icon: Icon, exact }) => {
        const active = isActive(href, exact)
        return (
          <Link
            key={href}
            href={href}
            onClick={onClick}
            className={`
              group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
              transition-all duration-150
              ${active
                ? 'bg-primary/10 text-primary border border-primary/20'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }
            `}
          >
            <Icon className={`w-4 h-4 flex-shrink-0 transition-colors ${
              active
                ? 'text-primary'
                : 'text-muted-foreground/60 group-hover:text-foreground'
            }`} />
            <span className="flex-1">{label}</span>
            {active && <ChevronRight className="w-3 h-3 text-primary/60" />}
          </Link>
        )
      })}
    </>
  )

  const ThemeToggle = () => (
    <button
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
        text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
    >
      {mounted ? (
        theme === 'dark'
          ? <><Sun  className="w-4 h-4 shrink-0" /><span>Light mode</span></>
          : <><Moon className="w-4 h-4 shrink-0" /><span>Dark mode</span></>
      ) : (
        <span className="w-4 h-4 block" />
      )}
    </button>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-56 xl:w-60 shrink-0 h-screen sticky top-0
        border-r border-border bg-background z-30"
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 py-5 border-b border-border">
          <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <p className="text-xs font-bold tracking-widest uppercase text-foreground">U Mart</p>
            <p className="text-[0.6rem] text-muted-foreground tracking-widest uppercase">Admin</p>
          </div>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
          <NavLinks />
        </nav>

        {/* Theme toggle */}
        <div className="px-2 py-4 border-t border-border">
          <ThemeToggle />
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between
        px-4 py-3 bg-background/95 backdrop-blur-sm border-b border-border"
      >
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-primary flex items-center justify-center shrink-0">
            <ShieldCheck className="w-3.5 h-3.5 text-primary-foreground" />
          </div>
          <span className="text-sm font-bold tracking-widest uppercase text-foreground">U Mart Admin</span>
        </div>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div
            className="lg:hidden fixed inset-0 z-30 bg-black/60 backdrop-blur-[2px]"
            onClick={() => setMobileOpen(false)}
          />
          <div className="lg:hidden fixed top-[53px] left-0 bottom-0 z-40 w-64 max-w-[80vw]
            bg-background border-r border-border flex flex-col
            animate-in slide-in-from-left-2 duration-200"
          >
            <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
              <NavLinks onClick={() => setMobileOpen(false)} />
            </nav>
            <div className="px-2 py-4 border-t border-border">
              <ThemeToggle />
            </div>
          </div>
        </>
      )}
    </>
  )
}
