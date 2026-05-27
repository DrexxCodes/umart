// app/api/products/categories/[id]/route.ts
//
// GET /api/products/categories/:id
//   - Lists products in a top-level category (or filtered by ?sub=subId)
//   - Loads 10 most-recent by default (?limit=10)
//   - Supports: q, sub, minPrice, maxPrice, location, maxAge, color, size,
//               gender, limit

import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'

type Params = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id: categoryId } = await params
    const sp = req.nextUrl.searchParams

    const subId     = sp.get('sub')     || ''
    const query     = sp.get('q')?.toLowerCase() || ''
    const minPrice  = sp.get('minPrice')  ? parseInt(sp.get('minPrice')!)  : 0
    const maxPrice  = sp.get('maxPrice')  ? parseInt(sp.get('maxPrice')!)  : Infinity
    const location  = sp.get('location') || ''
    const maxAge    = sp.get('maxAge')    ? parseInt(sp.get('maxAge')!)    : Infinity
    const color     = sp.get('color')    || ''
    const size      = sp.get('size')     || ''
    const gender    = sp.get('gender')   || ''
    const limit     = sp.get('limit')    ? parseInt(sp.get('limit')!)     : 10

    // ── Base collection ───────────────────────────────────────────────────────
    // When a sub is requested, pull from the sub's products mirror collection.
    // Otherwise pull from the parent category's products mirror collection.
    let baseRef: FirebaseFirestore.CollectionReference

    if (subId) {
      baseRef = adminDb
        .collection('productCategories')
        .doc(categoryId)
        .collection('sub')
        .doc(subId)
        .collection('products')
    } else {
      baseRef = adminDb
        .collection('productCategories')
        .doc(categoryId)
        .collection('products')
    }

    // ── Build Firestore query ─────────────────────────────────────────────────
    let fsQuery: FirebaseFirestore.Query = baseRef
      .where('status', '==', 'active')

    if (minPrice > 0)         fsQuery = fsQuery.where('price', '>=', minPrice)
    if (maxPrice !== Infinity) fsQuery = fsQuery.where('price', '<=', maxPrice)
    if (location)              fsQuery = fsQuery.where('location', '==', location)

    // Order by recency and fetch a reasonable ceiling before JS filtering
    fsQuery = fsQuery.orderBy('createdAt', 'desc').limit(200)

    const snapshot = await fsQuery.get()

    let products = snapshot.docs
      .map((doc) => {
        const d = doc.data()
        return {
          id: doc.id,
          ...d,
          createdAt: d.createdAt?.toDate?.() ?? d.createdAt,
        }
      })
      .filter((p: any) => {
        if (query) {
          const kw = (p.searchKeywords || []).some((k: string) =>
            k.toLowerCase().includes(query),
          )
          if (
            !kw &&
            !p.title?.toLowerCase().includes(query) &&
            !p.brand?.toLowerCase().includes(query) &&
            !p.model?.toLowerCase().includes(query) &&
            !p.description?.toLowerCase().includes(query)
          ) return false
        }

        if (maxAge !== Infinity && p.productAge) {
          if (convertAgeToYears(p.productAge) > maxAge) return false
        }

        if (color && p.additionalInfo?.color) {
          if (!String(p.additionalInfo.color).toLowerCase().includes(color.toLowerCase()))
            return false
        }

        if (size && p.additionalInfo?.size) {
          if (!String(p.additionalInfo.size).toLowerCase().includes(size.toLowerCase()))
            return false
        }

        if (gender && p.additionalInfo?.gender) {
          if (!String(p.additionalInfo.gender).toLowerCase().includes(gender.toLowerCase()))
            return false
        }

        return true
      })
      .slice(0, limit)

    const filterOptions = extractFilterOptions(products)

    return NextResponse.json({
      success: true,
      data: products,
      total: products.length,
      filterOptions,
    })
  } catch (error: any) {
    console.error('[GET /api/products/categories/:id] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch products' },
      { status: 500 },
    )
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function convertAgeToYears(productAge: { value: number; unit: string }): number {
  switch (productAge?.unit?.toLowerCase()) {
    case 'days':   return productAge.value / 365
    case 'months': return productAge.value / 12
    case 'years':  return productAge.value
    default:       return 0
  }
}

function extractFilterOptions(products: any[]) {
  const colors       = new Set<string>()
  const sizes        = new Set<string>()
  const genders      = new Set<string>()
  const repairCounts = new Set<number>()
  let priceMin = Infinity
  let priceMax = 0

  products.forEach((p) => {
    if (p.price) {
      priceMin = Math.min(priceMin, p.price)
      priceMax = Math.max(priceMax, p.price)
    }
    if (p.additionalInfo?.color)   colors.add(String(p.additionalInfo.color))
    if (p.additionalInfo?.size)    sizes.add(String(p.additionalInfo.size))
    if (p.additionalInfo?.gender)  genders.add(String(p.additionalInfo.gender))
    if (p.additionalInfo?.repairs !== undefined)
      repairCounts.add(Number(p.additionalInfo.repairs))
  })

  return {
    priceRange:   { min: priceMin === Infinity ? 0 : priceMin, max: priceMax || 1_000_000 },
    colors:       [...colors].sort(),
    sizes:        [...sizes].sort(),
    genders:      [...genders].sort(),
    repairCounts: [...repairCounts].sort((a, b) => a - b),
  }
}
