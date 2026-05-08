import { NextRequest, NextResponse } from 'next/server'
import { adminDb, adminAuth } from '@/lib/firebase-admin'
import { Timestamp, FieldValue } from 'firebase-admin/firestore'

export async function POST(req: NextRequest) {
  try {
    const { userId, sellerId, productId, productName } = await req.json()
    const authHeader = req.headers.get('authorization')

    if (!authHeader || !userId || !sellerId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const decodedToken = await adminAuth.verifyIdToken(token)

    if (decodedToken.uid !== userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 })
    }

    if (productId) {
      const productDoc = await adminDb.collection('products').doc(productId).get()
      if (productDoc.exists && productDoc.data()?.flagged === true) {
        return NextResponse.json(
          { success: false, error: 'This listing has been flagged by the platform and is currently unavailable.' },
          { status: 403 }
        )
      }
    }

    // Check if chat already exists
    const existingChat = await adminDb
      .collection('chats')
      .where('participantIds', 'array-contains', userId)
      .get()

    for (const doc of existingChat.docs) {
      const data = doc.data()
      if (data.participantIds.includes(sellerId)) {
        return NextResponse.json(
          { success: true, data: { chatId: doc.id }, message: 'Chat already exists' },
          { status: 200 }
        )
      }
    }

    // Resolve AI config from product if available
    let aiEnabled = false
    if (productId) {
      const productDoc = await adminDb.collection('products').doc(productId).get()
      if (productDoc.exists) {
        const productData = productDoc.data()
        aiEnabled = productData?.aiConfig?.enabled === true
      }
    }

    const chatRef = adminDb.collection('chats').doc()
    const batch = adminDb.batch()

    const userDoc = await adminDb.collection('users').doc(userId).get()
    const sellerDoc = await adminDb.collection('users').doc(sellerId).get()

    const userName = userDoc.data()?.fullname || 'User'
    const sellerName = sellerDoc.data()?.fullname || 'Seller'

    const chatData = {
      id: chatRef.id,
      participantIds: [userId, sellerId],
      creatorId: sellerId,           // seller is the creator/product owner
      aiEnabled,
      humanTookOver: false,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      lastMessage: '',
      lastMessageTime: null,
      productId: productId || null,
      productName: productName || null,
    }

    batch.set(chatRef, chatData)

    batch.set(chatRef.collection('participants').doc(userId), {
      userId, username: userName, joinedAt: Timestamp.now(),
    })
    batch.set(chatRef.collection('participants').doc(sellerId), {
      userId: sellerId, username: sellerName, joinedAt: Timestamp.now(),
    })

    batch.set(
      adminDb.collection('users').doc(userId).collection('chats').doc(chatRef.id),
      { chatId: chatRef.id, participantId: sellerId, participantName: sellerName, addedBy: 'setup', createdAt: Timestamp.now() }
    )
    batch.set(
      adminDb.collection('users').doc(sellerId).collection('chats').doc(chatRef.id),
      { chatId: chatRef.id, participantId: userId, participantName: userName, addedBy: userId, createdAt: Timestamp.now() }
    )

    await batch.commit()

    return NextResponse.json(
      { success: true, data: { chatId: chatRef.id }, message: 'Chat created successfully' },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('Error creating chat:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create chat' },
      { status: 500 }
    )
  }
}
