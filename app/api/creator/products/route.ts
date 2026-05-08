import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { adminAuth, adminDb } from '@/lib/firebase-admin'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { randomUUID } from 'crypto'

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  const rl = rateLimit(`${req.nextUrl.pathname}:${ip}`, { limit: 30, windowSeconds: 60 })
  if (!rl.success) return NextResponse.json({ success: false, error: "Too many requests." }, { status: 429 })
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const token = authHeader.substring(7)
    let decodedToken

    try {
      decodedToken = await adminAuth.verifyIdToken(token)
    } catch (error: any) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired token' },
        { status: 401 }
      )
    }

    const userId = decodedToken.uid
    const body = await req.json()

    const {
      category,
      brand,
      model,
      searchKeywords,
      location,
      price,
      condition,
      productAge,
      description,
      defects,
      additionalInfo,
      images,
      aiConfig,
    } = body

    if (!category || !brand || !location || !price || !condition || !productAge) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const productId = `prod_${randomUUID()}`
    const title = model ? `${brand} ${model}` : brand

    // Validate and sanitize aiConfig if present
    let sanitizedAiConfig: any = null
    if (aiConfig && typeof aiConfig === 'object') {
      const parsedPrice = parseFloat(price)
      const floorVal = typeof aiConfig.priceFloor === 'number' ? aiConfig.priceFloor : null
      sanitizedAiConfig = {
        enabled: aiConfig.enabled === true,
        tone: ['friendly', 'professional', 'playful', 'firm'].includes(aiConfig.tone)
          ? aiConfig.tone
          : 'friendly',
        priceFloor:
          floorVal !== null && floorVal >= 0 && floorVal <= parsedPrice
            ? floorVal
            : Math.round(parsedPrice * 0.75),
        faqs: Array.isArray(aiConfig.faqs)
          ? aiConfig.faqs
              .filter(
                (f: any) =>
                  f && typeof f.question === 'string' && typeof f.answer === 'string'
              )
              .slice(0, 10)
          : [],
        customContext:
          typeof aiConfig.customContext === 'string'
            ? aiConfig.customContext.slice(0, 1000)
            : '',
      }
    }

    const productData: any = {
      id: productId,
      userId,
      title,
      category,
      brand,
      model: model || '',
      searchKeywords: Array.isArray(searchKeywords) ? searchKeywords : [],
      location,
      price: parseFloat(price),
      condition,
      productAge: {
        value: productAge.value,
        unit: productAge.unit,
      },
      description: description || '',
      defects: defects || '',
      additionalInfo: additionalInfo || {},
      images: Array.isArray(images) ? images : [],
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      status: 'active',
    }

    if (sanitizedAiConfig !== null) {
      productData.aiConfig = sanitizedAiConfig
    }

    const batch = adminDb.batch()

    const productRef = adminDb.collection('products').doc(productId)
    batch.set(productRef, productData)

    const categoryProductRef = adminDb
      .collection('productCategories')
      .doc(category)
      .collection('products')
      .doc(productId)
    batch.set(categoryProductRef, { ...productData, categoryId: category })

    const userProductRef = adminDb
      .collection('users')
      .doc(userId)
      .collection('products')
      .doc(productId)
    batch.set(userProductRef, productData)

    const userRef = adminDb.collection('users').doc(userId)
    batch.update(userRef, { productsUploaded: FieldValue.increment(1) })

    const now = new Date()
    const nigerianTime = new Date(now.getTime() + 60 * 60 * 1000)
    const year = nigerianTime.getUTCFullYear().toString()
    const month = `${nigerianTime.getUTCFullYear()}-${String(nigerianTime.getUTCMonth() + 1).padStart(2, '0')}`
    const day = `${nigerianTime.getUTCFullYear()}-${String(nigerianTime.getUTCMonth() + 1).padStart(2, '0')}-${String(nigerianTime.getUTCDate()).padStart(2, '0')}`

    const analyticsUpdateData = {
      productsCreated: FieldValue.increment(1),
      lastUpdated: FieldValue.serverTimestamp(),
    }

    batch.set(
      adminDb.collection('admin').doc('analytics').collection('daily').doc(day),
      analyticsUpdateData,
      { merge: true }
    )
    batch.set(
      adminDb.collection('admin').doc('analytics').collection('monthly').doc(month),
      analyticsUpdateData,
      { merge: true }
    )
    batch.set(
      adminDb.collection('admin').doc('analytics').collection('yearly').doc(year),
      analyticsUpdateData,
      { merge: true }
    )

    await batch.commit()

    return NextResponse.json(
      { success: true, data: { productId, message: 'Product created successfully' } },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('Error creating product:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create product' },
      { status: 500 }
    )
  }
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    let decodedToken
    try {
      decodedToken = await adminAuth.verifyIdToken(token)
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid or expired token' }, { status: 401 })
    }

    const userId = decodedToken.uid
    const productsSnapshot = await adminDb
      .collection('users')
      .doc(userId)
      .collection('products')
      .orderBy('createdAt', 'desc')
      .get()

    const products = productsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))

    return NextResponse.json({ success: true, data: products }, { status: 200 })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch products' },
      { status: 500 }
    )
  }
}
