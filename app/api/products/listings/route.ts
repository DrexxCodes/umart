// app/api/products/listing/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'

// Hardcoded categories — update to match your Firestore category IDs
const CATEGORIES = [
  'phones',
  'laptops',
  'tablets',
  'cameras',
  'audio',
  'gaming',
  'appliances',
  'fashion',
  'furniture',
  'vehicles',
]

const PRODUCTS_PER_CATEGORY = 3

export async function GET(request: NextRequest) {
  try {
    // Fetch 3 active products from each category in parallel
    const categoryFetches = CATEGORIES.map(async (categoryId) => {
      try {
        const snapshot = await adminDb
          .collection('productCategories')
          .doc(categoryId)
          .collection('products')
          .where('status', '==', 'active')
          .limit(PRODUCTS_PER_CATEGORY)
          .get()

        return snapshot.docs.map((doc) => {
          const data = doc.data()
          return {
            id: doc.id,
            title: data.title || '',
            // Only return what the listing needs — keep payload lean
            image: Array.isArray(data.images) && data.images[0] ? data.images[0] : null,
            price: data.price || 0,
            location: data.location || '',
            condition: data.condition || '',
            category: categoryId,
          }
        })
      } catch {
        // If a category collection doesn't exist yet, silently skip
        return []
      }
    })

    const results = await Promise.all(categoryFetches)
    const products = results.flat()

    return NextResponse.json(
      { success: true, data: products, total: products.length },
      {
        status: 200,
        headers: {
          // Cache for 2 minutes; serve stale for another 2 minutes while
          // revalidating in the background (stale-while-revalidate pattern)
          'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=120',
        },
      }
    )
  } catch (error: any) {
    console.error('Listing fetch error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch listings' },
      { status: 500 }
    )
  }
}