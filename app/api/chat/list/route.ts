import { NextRequest, NextResponse } from 'next/server'
import { adminDb, adminAuth } from '@/lib/firebase-admin'

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')

    if (!authHeader) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Verify token
    const token = authHeader.replace('Bearer ', '')
    const decodedToken = await adminAuth.verifyIdToken(token)
    const userId = decodedToken.uid

    // Get all chat IDs from user's chats subcollection.
    // Order by lastMessageTime desc so recently-active chats bubble to the top.
    // Fall back to createdAt for chats that haven't had any messages yet.
    const userChatsSnapshot = await adminDb
      .collection('users')
      .doc(userId)
      .collection('chats')
      .get()

    if (userChatsSnapshot.empty) {
      return NextResponse.json(
        { success: true, data: [] },
        { status: 200 }
      )
    }

    const chats = []

    for (const chatDoc of userChatsSnapshot.docs) {
      const chatRef = chatDoc.data()
      const chatSnapshot = await adminDb.collection('chats').doc(chatRef.chatId).get()

      if (chatSnapshot.exists) {
        const chatData = chatSnapshot.data()!

        // Count unseen messages sent by others (unread count for this user)
        const unseenSnap = await adminDb
          .collection('chats')
          .doc(chatRef.chatId)
          .collection('messages')
          .where('seen', '==', false)
          .where('senderId', '!=', userId)
          .get()

        chats.push({
          chatId: chatRef.chatId,
          participantName: chatRef.participantName,
          participantId: chatRef.participantId,
          lastMessage: chatData.lastMessage || '',
          lastMessageTime: chatData.lastMessageTime ?? null,
          lastMessageSenderName: chatData.lastMessageSenderName ?? '',
          createdAt: chatRef.createdAt ?? null,
          unreadCount: unseenSnap.size,
        })
      }
    }

    // Sort by lastMessageTime desc (most recently active first),
    // falling back to createdAt for chats with no messages yet.
    chats.sort((a, b) => {
      const ta = a.lastMessageTime ?? a.createdAt
      const tb = b.lastMessageTime ?? b.createdAt
      if (!ta && !tb) return 0
      if (!ta) return 1
      if (!tb) return -1
      const msA = typeof ta.toMillis === 'function' ? ta.toMillis() : 0
      const msB = typeof tb.toMillis === 'function' ? tb.toMillis() : 0
      return msB - msA
    })

    return NextResponse.json(
      { success: true, data: chats },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('Error fetching chats:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch chats' },
      { status: 500 }
    )
  }
}
