'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/firebase'
import { onAuthStateChanged, User } from 'firebase/auth'
import { BuyerNav } from '@/components/nav/buyer-nav'
import { ImageGallery } from './components/ImageGallery'
import { Thumbnails } from './components/Thumbnails'
import { ProductDetails } from './components/ProductDetails'
import { AdditionalInfo } from './components/AdditionalInfo'
import { ActionButtons } from './components/ActionButtons'
import { MoreProducts } from './components/MoreProducts'
import { ReportDialog } from './components/ReportDialog'
import { AboutTheSeller } from '@/components/catalogue/AboutTheSeller'
import { ChevronLeft } from 'lucide-react'

interface Product {
  id: string
  title: string
  brand?: string
  model?: string
  images: string[]
  location: string
  price: number
  condition: string
  description?: string
  defects?: string
  productAge?: { value: number; unit: string }
  category?: string
  userId: string
  additionalInfo?: Record<string, string>
}

interface Props {
  product: Product
}

export function ProductDetailClient({ product }: Props) {
  const router       = useRouter()
  const pathname     = usePathname()
  const searchParams = useSearchParams()

  const [currentUser, setCurrentUser]             = useState<User | null>(null)
  const [authReady, setAuthReady]                 = useState(false)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [reportOpen, setReportOpen]               = useState(false)
  const [contactingLoading, setContactingLoading] = useState(false)
  const [contactError,      setContactError]      = useState<string | null>(null)

  // ── Guard: ensures auto-contact fires at most once per page load ──────────
  // useRef so it survives re-renders without triggering effects, and isn't
  // reset if onAuthStateChanged fires a second time (e.g. token refresh).
  const autoContactFired = useRef(false)

  const images = (product.images || []).filter((img) => img?.trim())

  // ── Core chat creation ────────────────────────────────────────────────────
  const createChat = useCallback(async (user: User) => {
    if (user.uid === product.userId) {
      alert("You can't contact yourself!")
      return
    }
    try {
      setContactingLoading(true)
      setContactError(null)
      const token = await user.getIdToken()
      const res = await fetch('/api/chat/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          userId:      user.uid,
          sellerId:    product.userId,
          productId:   product.id,
          productName: product.title,
        }),
      })
      const result = await res.json()
      if (result.success) {
        const chatId = result.data?.chatId
        router.push(chatId ? `/chat?open=${chatId}` : '/chat')
      } else {
        setContactError(result.error ?? 'Failed to create chat. Please try again.')
      }
    } catch {
      setContactError('Error creating chat. Please try again.')
    } finally {
      setContactingLoading(false)
    }
  }, [product, router])

  // ── Auth listener ─────────────────────────────────────────────────────────
  // Reading searchParams directly here (not from a stale closure) by checking
  // the live URL via window.location.search, which is always current regardless
  // of how many times onAuthStateChanged fires.
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user)
      setAuthReady(true)

      if (user && !autoContactFired.current) {
        // Read from the actual live URL — not from the React searchParams
        // closure which can be stale if router.replace hasn't committed yet
        const liveParams = new URLSearchParams(window.location.search)

        if (liveParams.get('contact') === 'true') {
          // Mark as fired immediately — before any async work —
          // so a second onAuthStateChanged call (token refresh) can't re-enter
          autoContactFired.current = true

          // Clean the URL synchronously before firing chat so a refresh won't re-trigger
          router.replace(pathname)

          createChat(user)
        }
      }
    })
    return () => unsub()
  }, [pathname, router, createChat])

  // ── Contact button handler ────────────────────────────────────────────────
  const handleContactSeller = () => {
    if (!currentUser) {
      const loginUrl = new URL('/auth/login', window.location.href)
      loginUrl.searchParams.set('redirect', `${pathname}?contact=true`)
      router.push(loginUrl.pathname + loginUrl.search)
      return
    }
    createChat(currentUser)
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <BuyerNav />

      <main className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">

        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6 group"
        >
          <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          Back to listings
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-8 xl:gap-12">

          {/* LEFT — Images */}
          <div className="space-y-4">
            <div className="flex gap-3">
              {images.length > 1 && (
                <div className="hidden lg:block">
                  <Thumbnails
                    images={images}
                    currentIndex={currentImageIndex}
                    onSelect={setCurrentImageIndex}
                    orientation="vertical"
                  />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <ImageGallery
                  images={images}
                  title={product.title}
                  currentIndex={currentImageIndex}
                  onChange={setCurrentImageIndex}
                />
              </div>
            </div>

            {images.length > 1 && (
              <div className="lg:hidden">
                <Thumbnails
                  images={images}
                  currentIndex={currentImageIndex}
                  onSelect={setCurrentImageIndex}
                  orientation="horizontal"
                />
              </div>
            )}

            {product.additionalInfo && Object.keys(product.additionalInfo).length > 0 && (
              <AdditionalInfo info={product.additionalInfo} />
            )}
          </div>

          {/* RIGHT — Details sidebar */}
          <div className="space-y-5">
            <ProductDetails product={product} />

            <ActionButtons
              onContactSeller={handleContactSeller}
              onReport={() => setReportOpen(true)}
              contactingLoading={contactingLoading}
              isOwner={authReady && currentUser?.uid === product.userId}
              contactError={contactError}
            />

            {product.userId && currentUser?.uid !== product.userId && (
              <AboutTheSeller sellerId={product.userId} />
            )}
          </div>
        </div>

        {product.category && (
          <div className="mt-14">
            <MoreProducts category={product.category} excludeId={product.id} />
          </div>
        )}
      </main>

      <ReportDialog
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        productId={product.id}
        currentUser={currentUser}
      />
    </div>
  )
}