import { NextRequest, NextResponse } from 'next/server'
import { adminDb, adminAuth } from '@/lib/firebase-admin'
import { Timestamp } from 'firebase-admin/firestore'

async function getCreatorIdFromChat(chatId: string, userId: string): Promise<string | null> {
  const chatDoc = await adminDb.collection('chats').doc(chatId).get()
  if (!chatDoc.exists) return null
  const chatData = chatDoc.data()!
  // Verify caller is the creator of this chat
  if (chatData.creatorId !== userId) return null
  return chatData.creatorId
}

// POST — creator takes over from AI
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const decodedToken = await adminAuth.verifyIdToken(token)
    const userId = decodedToken.uid

    const { chatId } = await req.json()
    if (!chatId) {
      return NextResponse.json({ success: false, error: 'Missing chatId' }, { status: 400 })
    }

    const creatorId = await getCreatorIdFromChat(chatId, userId)
    if (!creatorId) {
      return NextResponse.json({ success: false, error: 'Not authorised for this chat' }, { status: 403 })
    }

    const batch = adminDb.batch()
    const chatRef = adminDb.collection('chats').doc(chatId)
    batch.update(chatRef, {
      humanTookOver: true,
      humanTookOverAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    })

    // Post a system message so buyer knows
    const msgRef = adminDb.collection('chats').doc(chatId).collection('messages').doc()
    batch.set(msgRef, {
      senderId: 'system',
      senderName: 'Umart System',
      text: 'The seller has joined the conversation.',
      createdAt: Timestamp.now(),
      isAI: false,
      isSystemAdmin: true,
      isCreator: false,
      type: 'system-info',
    })

    await batch.commit()

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Takeover error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

// DELETE — creator hands back to AI
export async function DELETE(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const decodedToken = await adminAuth.verifyIdToken(token)
    const userId = decodedToken.uid

    const { chatId } = await req.json()
    if (!chatId) {
      return NextResponse.json({ success: false, error: 'Missing chatId' }, { status: 400 })
    }

    const creatorId = await getCreatorIdFromChat(chatId, userId)
    if (!creatorId) {
      return NextResponse.json({ success: false, error: 'Not authorised for this chat' }, { status: 403 })
    }

    const batch = adminDb.batch()
    const chatRef = adminDb.collection('chats').doc(chatId)
    batch.update(chatRef, {
      humanTookOver: false,
      updatedAt: Timestamp.now(),
    })

    const msgRef = adminDb.collection('chats').doc(chatId).collection('messages').doc()
    batch.set(msgRef, {
      senderId: 'system',
      senderName: 'Umart System',
      text: 'AI Assistant has resumed negotiation on behalf of the seller.',
      createdAt: Timestamp.now(),
      isAI: false,
      isSystemAdmin: true,
      isCreator: false,
      type: 'system-info',
    })

    await batch.commit()

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Hand back error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
