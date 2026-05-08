import { NextRequest, NextResponse } from 'next/server'
import { adminDb, adminAuth } from '@/lib/firebase-admin'
import { Timestamp, FieldValue } from 'firebase-admin/firestore'

// GET: Fetch a specific product
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
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
    const { productId } = await params

    const productDoc = await adminDb
      .collection('users')
      .doc(userId)
      .collection('products')
      .doc(productId)
      .get()

    if (!productDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { success: true, data: { id: productDoc.id, ...productDoc.data() } },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('Error fetching product:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch product' },
      { status: 500 }
    )
  }
}

// PATCH: Update a specific product
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
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
    const { productId } = await params
    const body = await req.json()

    // Fetch original to get old category
    const originalDoc = await adminDb
      .collection('users')
      .doc(userId)
      .collection('products')
      .doc(productId)
      .get()

    if (!originalDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      )
    }

    const originalData = originalDoc.data() as any
    const oldCategory = originalData.category
    const newCategory = body.category || oldCategory

    const title = body.model ? `${body.brand} ${body.model}` : body.brand

    // Validate and sanitize Clara's config if provided and enabled
    let aiConfigValue: any
    if (body.aiConfig && typeof body.aiConfig === 'object' && body.aiConfig.enabled === true) {
      const parsedPrice = parseFloat(body.price)
      const floorVal = typeof body.aiConfig.priceFloor === 'number'
        ? body.aiConfig.priceFloor
        : parseFloat(body.aiConfig.priceFloor) || 0

      aiConfigValue = {
        enabled: true,
        tone: ['friendly', 'professional', 'playful', 'firm'].includes(body.aiConfig.tone)
          ? body.aiConfig.tone
          : 'friendly',
        priceFloor:
          floorVal >= 0 && floorVal <= parsedPrice
            ? floorVal
            : Math.round(parsedPrice * 0.75),
        faqs: Array.isArray(body.aiConfig.faqs)
          ? body.aiConfig.faqs
              .filter(
                (f: any) =>
                  f &&
                  typeof f.question === 'string' &&
                  typeof f.answer === 'string'
              )
              .slice(0, 10)
          : [],
        customContext:
          typeof body.aiConfig.customContext === 'string'
            ? body.aiConfig.customContext.slice(0, 1000)
            : '',
      }
    } else {
      // Clara disabled or not provided — remove the field entirely
      aiConfigValue = FieldValue.delete()
    }

    const updateData: Record<string, any> = {
      title,
      category: newCategory,
      brand: body.brand,
      model: body.model || '',
      location: body.location,
      price: parseFloat(body.price),
      condition: body.condition,
      productAge: body.productAge,
      description: body.description || '',
      defects: body.defects || '',
      additionalInfo: body.additionalInfo || {},
      images: Array.isArray(body.images) ? body.images : [],
      aiConfig: aiConfigValue,
      updatedAt: Timestamp.now(),
    }

    const batch = adminDb.batch()

    // 1. Main products collection
    batch.update(adminDb.collection('products').doc(productId), updateData)

    // 2. User's products collection
    batch.update(
      adminDb.collection('users').doc(userId).collection('products').doc(productId),
      updateData
    )

    // 3. Category collection — handle category change
    if (oldCategory !== newCategory) {
      // Delete from old category
      batch.delete(
        adminDb
          .collection('productCategories')
          .doc(oldCategory)
          .collection('products')
          .doc(productId)
      )
      // Add to new category (set, not update — doc may not exist yet)
      batch.set(
        adminDb
          .collection('productCategories')
          .doc(newCategory)
          .collection('products')
          .doc(productId),
        { ...updateData, categoryId: newCategory }
      )
    } else {
      batch.update(
        adminDb
          .collection('productCategories')
          .doc(newCategory)
          .collection('products')
          .doc(productId),
        updateData
      )
    }

    await batch.commit()

    return NextResponse.json(
      { success: true, data: { productId, message: 'Product updated successfully' } },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('Error updating product:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update product' },
      { status: 500 }
    )
  }
}

// PUT: Update product status (active/inactive)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
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
    const { productId } = await params
    const { status } = await req.json()

    if (!['active', 'inactive'].includes(status)) {
      return NextResponse.json(
        { success: false, error: 'Invalid status' },
        { status: 400 }
      )
    }

    const productDoc = await adminDb
      .collection('users')
      .doc(userId)
      .collection('products')
      .doc(productId)
      .get()

    if (!productDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      )
    }

    const category = (productDoc.data() as any).category
    const updateData = { status, updatedAt: Timestamp.now() }

    const batch = adminDb.batch()
    batch.update(adminDb.collection('products').doc(productId), updateData)
    batch.update(
      adminDb.collection('users').doc(userId).collection('products').doc(productId),
      updateData
    )
    batch.update(
      adminDb
        .collection('productCategories')
        .doc(category)
        .collection('products')
        .doc(productId),
      updateData
    )

    await batch.commit()

    return NextResponse.json(
      { success: true, data: { productId, status, message: `Product marked as ${status}` } },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('Error updating product status:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update product status' },
      { status: 500 }
    )
  }
}