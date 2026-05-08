import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

// Initialize Firebase Admin SDK
let db: any

if (!getApps().length) {
  try {
    initializeApp({
      credential: cert(JSON.parse(process.env.FIREBASE_ADMIN_SDK_KEY || '{}')),
    })
  } catch {
    console.error('Firebase Admin initialization failed')
  }
}

db = getFirestore()

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const query       = searchParams.get('q')?.toLowerCase().trim() || ''
    const minPrice    = searchParams.get('minPrice')  ? parseInt(searchParams.get('minPrice')!)  : 0
    const maxPrice    = searchParams.get('maxPrice')  ? parseInt(searchParams.get('maxPrice')!)  : Infinity
    const location    = searchParams.get('location')  || ''
    const maxAgeYears = searchParams.get('maxAge')    ? parseInt(searchParams.get('maxAge')!)    : Infinity
    const limit       = searchParams.get('limit')     ? parseInt(searchParams.get('limit')!)     : 20

    // ── Suggest mode — lightweight typeahead, skips age filter, smaller limit ──
    // Triggered when ?suggest=true is passed. Returns only the fields the
    // dropdown needs so the payload stays tiny.
    const isSuggest = searchParams.get('suggest') === 'true'

    if (isSuggest) {
      if (!query || query.length < 3) {
        return NextResponse.json({ success: true, data: [] })
      }

      const snapshot = await db
        .collection('products')
        .where('status', '==', 'active')
        .limit(60) // fetch more than needed to filter in memory
        .get()

      const suggestions = snapshot.docs
        .map((doc: any) => {
          const d = doc.data()
          return {
            id:       doc.id,
            title:    d.title    || '',
            location: d.location || '',
            price:    d.price    || 0,
            image:    Array.isArray(d.images) && d.images[0] ? d.images[0] : null,
            brand:    d.brand    || '',
            model:    d.model    || '',
            searchKeywords: d.searchKeywords || [],
          }
        })
        .filter((p: any) => {
          const kw = (p.searchKeywords as string[]).some((k) => k.toLowerCase().includes(query))
          return (
            kw ||
            p.title.toLowerCase().includes(query) ||
            p.brand.toLowerCase().includes(query) ||
            p.model.toLowerCase().includes(query)
          )
        })
        .slice(0, 6) // cap at 6 suggestions
        .map((p: any) => ({
          id:       p.id,
          title:    p.title,
          location: p.location,
          price:    p.price,
          image:    p.image,
        }))

      return NextResponse.json({ success: true, data: suggestions })
    }

    // ── Full search mode ───────────────────────────────────────────────────────
    let productsQuery = db.collection('products').where('status', '==', 'active')

    if (minPrice > 0)          productsQuery = productsQuery.where('price', '>=', minPrice)
    if (maxPrice !== Infinity)  productsQuery = productsQuery.where('price', '<=', maxPrice)
    if (location)               productsQuery = productsQuery.where('location', '==', location)

    const snapshot = await productsQuery.limit(100).get()

    const products = snapshot.docs
      .map((doc: any) => {
        const data = doc.data()
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate?.() || data.createdAt,
        }
      })
      .filter((product: any) => {
        if (query) {
          const keywords = product.searchKeywords || []
          const matchesKeywords    = keywords.some((k: string) => k.toLowerCase().includes(query))
          const matchesTitle       = product.title?.toLowerCase().includes(query)
          const matchesBrand       = product.brand?.toLowerCase().includes(query)
          const matchesModel       = product.model?.toLowerCase().includes(query)
          const matchesDescription = product.description?.toLowerCase().includes(query)
          if (!matchesKeywords && !matchesTitle && !matchesBrand && !matchesModel && !matchesDescription) {
            return false
          }
        }

        if (maxAgeYears !== Infinity && product.productAge) {
          if (convertAgeToYears(product.productAge) > maxAgeYears) return false
        }

        return true
      })
      .sort((a: any, b: any) => {
        const dateA = new Date(a.createdAt).getTime()
        const dateB = new Date(b.createdAt).getTime()
        return dateB - dateA
      })
      .slice(0, limit)

    return NextResponse.json({ success: true, data: products, total: products.length })
  } catch (error: any) {
    console.error('Products search error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to search products' },
      { status: 500 }
    )
  }
}

function convertAgeToYears(productAge: { value: number; unit: string }): number {
  if (!productAge?.unit) return 0
  switch (productAge.unit.toLowerCase()) {
    case 'days':   return productAge.value / 365
    case 'months': return productAge.value / 12
    case 'years':  return productAge.value
    default:       return 0
  }
}