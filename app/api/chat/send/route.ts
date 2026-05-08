import { NextRequest, NextResponse } from 'next/server'
import { adminDb, adminAuth } from '@/lib/firebase-admin'
import { Timestamp } from 'firebase-admin/firestore'

export async function POST(req: NextRequest) {
  try {
    const { chatId, text } = await req.json()
    const authHeader = req.headers.get('authorization')

    if (!authHeader || !chatId || !text) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const decodedToken = await adminAuth.verifyIdToken(token)
    const userId = decodedToken.uid

    const chatSnapshot = await adminDb.collection('chats').doc(chatId).get()

    if (!chatSnapshot.exists) {
      return NextResponse.json(
        { success: false, error: 'Chat not found' },
        { status: 404 }
      )
    }

    const chatData = chatSnapshot.data()
    if (!chatData?.participantIds.includes(userId)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      )
    }

    const senderDoc = await adminDb.collection('users').doc(userId).get()
    const senderName = senderDoc.data()?.fullname || 'User'
    const senderRoles = senderDoc.data()?.roles || {}
    const isCreator = senderRoles.isCreator || false

    const messageRef = adminDb
      .collection('chats')
      .doc(chatId)
      .collection('messages')
      .doc()

    const batch = adminDb.batch()

    batch.set(messageRef, {
      senderId: userId,
      senderName: senderName,
      text: text.trim(),
      createdAt: Timestamp.now(),
      isSystemAdmin: senderRoles.isAdmin || false,
      isCreator,
      isAI: false,
    })

    batch.update(adminDb.collection('chats').doc(chatId), {
      lastMessage: text.trim(),
      lastMessageTime: Timestamp.now(),
      lastMessageSenderName: senderName,
      updatedAt: Timestamp.now(),
    })

    await batch.commit()

    // Fire AI reply for buyer messages (non-blocking)
    // Only trigger if the sender is NOT the creator and NOT an admin
    if (!isCreator && !senderRoles.isAdmin) {
      const aiEnabled = chatData?.aiEnabled ?? false
      const humanTookOver = chatData?.humanTookOver ?? false

      if (aiEnabled && !humanTookOver) {
        // Fire and forget — don't await so buyer gets instant ack
        fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/chat/ai-reply`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chatId, buyerMessage: text.trim() }),
        }).catch((err) => console.error('AI reply trigger failed:', err))
      }
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          id: messageRef.id,
          senderId: userId,
          text: text.trim(),
          createdAt: new Date(),
        },
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('Error sending message:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to send message' },
      { status: 500 }
    )
  }
}
