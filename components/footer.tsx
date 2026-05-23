import Link from 'next/link'
import { ShoppingBag } from 'lucide-react'

export function Footer() {
  return (
    <footer className="w-full border-t border-border bg-background mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10 lg:gap-16">

          {/* ── Column 1: About Umart ─────────────────────────────────────── */}
          <div className="space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-primary-foreground">UM</span>
              </div>
              <span className="font-bold text-lg tracking-tight">U Mart</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Umart is a trusted B2B and B2C escrow e-commerce platform built for the modern
              Nigerian marketplace. Every transaction is protected as buyers pay into a secure
              escrow hold, sellers receive funds only after delivery is confirmed, and disputes
              are mediated fairly. Whether you're an individual seller, a small business, or a
              large enterprise, Umart gives you the infrastructure to trade with confidence.
            </p>
            <p className="text-xs text-muted-foreground/70">
              © {new Date().getFullYear()} U Mart. All rights reserved.
            </p>
          </div>

          {/* ── Column 2: Products ────────────────────────────────────────── */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-widest text-foreground">
              Products
            </h3>
            <ul className="space-y-2.5">
              <li>
                <Link
                  href="https://uhomes.com.ng"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5 group"
                >
                  <ShoppingBag className="w-3.5 h-3.5 shrink-0 text-muted-foreground/50 group-hover:text-primary transition-colors" />
                  Uhomes
                </Link>
              </li>
            </ul>
          </div>

          {/* ── Column 3: Legal & Support ─────────────────────────────────── */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-widest text-foreground">
              Legal &amp; Support
            </h3>
            <ul className="space-y-2.5">
              {[
                'Contact Us',
                'Help Center',
                'Terms of Service',
                'Refund Policy',
                'Acceptable Use',
              ].map((item) => (
                <li key={item}>
                  <span className="text-sm text-muted-foreground hover:text-primary transition-colors cursor-pointer">
                    {item}
                  </span>
                </li>
              ))}
            </ul>
          </div>

        </div>
      </div>
    </footer>
  )
}
