import React from "react"
import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
// @ts-ignore: allow side-effect CSS import in Next.js app directory
import './globals.css'
import { FooterWrapper } from '@/components/footer-wrapper'
import { ThemeProvider } from '@/components/theme-provider'
import { AuthProvider } from '@/components/auth-provider'
import { IosInstallPrompt } from '@/components/ios-install-prompt'
import { ServiceWorkerRegistrar } from '@/components/service-worker-registrar'

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: 'U Mart',
  description: 'A marketplace for students and communities',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Umart',
  },
  icons: {
    icon: [
      { url: '/icon-light-32x32.png', media: '(prefers-color-scheme: light)' },
      { url: '/icon-dark-32x32.png',  media: '(prefers-color-scheme: dark)'  },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: 'oklch(0.5 0.17 240)' },
    { media: '(prefers-color-scheme: dark)',  color: 'oklch(0.6 0.17 240)' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head />
      <body className="font-sans antialiased flex flex-col min-h-screen">
        <ThemeProvider>
          <AuthProvider>
            <div className="flex flex-col min-h-screen">
              <main className="flex-1">
                {children}
              </main>
              <FooterWrapper />
            </div>
          </AuthProvider>
        </ThemeProvider>
        <Analytics />
        {/* Registers both the PWA sw.js and firebase-messaging-sw.js */}
        <ServiceWorkerRegistrar />
        <IosInstallPrompt />
      </body>
    </html>
  )
}
