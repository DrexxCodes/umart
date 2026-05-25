import { NextRequest, NextResponse } from 'next/server'
import { adminDb, adminAuth } from '@/lib/firebase-admin'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const decodedToken = await adminAuth.verifyIdToken(token)
    const userId = decodedToken.uid

    const { chatId } = await params

    const chatSnapshot = await adminDb.collection('chats').doc(chatId).get()
    if (!chatSnapshot.exists) {
      return NextResponse.json({ success: false, error: 'Chat not found' }, { status: 404 })
    }

    const chatData = chatSnapshot.data()!
    if (!chatData.participantIds.includes(userId)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 })
    }

    // ── Participant emails ─────────────────────────────────────────────────
    // Fetch both participants' user docs to get their emails
    const participantDocs = await Promise.all(
      chatData.participantIds.map((uid: string) =>
        adminDb.collection('users').doc(uid).get()
      )
    )

    const participants = participantDocs.map((doc) => ({
      uid: doc.id,
      fullname: doc.data()?.fullname ?? 'Unknown',
      email: doc.data()?.email ?? null,
    }))

    // ── Messages ───────────────────────────────────────────────────────────
    const messagesSnapshot = await adminDb
      .collection('chats')
      .doc(chatId)
      .collection('messages')
      .orderBy('createdAt', 'asc')
      .get()

    const messages = []
    for (const messageDoc of messagesSnapshot.docs) {
      const messageData = messageDoc.data()
      const senderDoc = await adminDb.collection('users').doc(messageData.senderId).get()
      const senderData = senderDoc.data()

      messages.push({
        id: messageDoc.id,
        senderId: messageData.senderId,
        senderName: messageData.senderName || senderData?.fullname || 'User',
        text: messageData.text,
        createdAt: messageData.createdAt,
        isSystemAdmin: messageData.isSystemAdmin || senderData?.roles?.isAdmin || false,
        isCreator: messageData.isCreator || senderData?.roles?.isCreator || false,
        isAI: messageData.isAI || false,
        type: messageData.type,
        paymentReferenceId: messageData.paymentReferenceId,
        agreedAmount: messageData.agreedAmount,
        grandPrice: messageData.grandPrice,
      })
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          messages,
          participants,   // [{ uid, fullname, email }, ...]
          chatInfo: {
            productId: chatData.productId,
            productName: chatData.productName,
          },
        },
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('Error fetching messages:', error)
    return NextResponse.json({ success: false, error: error.message || 'Failed to fetch messages' }, { status: 500 })
  }
}
