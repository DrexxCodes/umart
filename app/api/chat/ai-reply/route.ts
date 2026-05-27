import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { Timestamp } from 'firebase-admin/firestore'
import { upsertPendingChatNotification } from '@/lib/fcm'
import { tasks } from '@trigger.dev/sdk/v3'
import type { ChatNotifyPayload } from '@/trigger/chat-notify'

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
const AI_BOT_SENDER_ID = 'ai-negotiator'
const AI_BOT_NAME = 'Umart Assistant'

interface Message {
  senderId: string
  senderName: string
  text: string
  isAI?: boolean
}

function buildSystemPrompt(product: any, aiConfig: any): string {
  const listedPrice = product?.price ?? 0
  const priceFloor = aiConfig?.priceFloor ?? Math.round(listedPrice * 0.75)
  const tone = aiConfig?.tone ?? 'friendly'
  const faqs: Array<{ question: string; answer: string }> = aiConfig?.faqs ?? []
  const customContext = aiConfig?.customContext ?? ''

  const faqBlock =
    faqs.length > 0
      ? '\n\nFREQUENTLY ASKED QUESTIONS (answer these exactly as written):\n' +
        faqs.map((f, i) => `Q${i + 1}: ${f.question}\nA${i + 1}: ${f.answer}`).join('\n\n')
      : ''

  const toneGuide: Record<string, string> = {
    friendly: 'Be warm, approachable, and conversational. Use light informal language.',
    professional: 'Be polite and formal. Use clear, business-appropriate language. Avoid slang.',
    playful: 'Be fun and energetic. Use emojis sparingly. Light banter is welcome but stay on-topic.',
    firm: 'Be respectful but direct. Minimal small talk. Focus on closing the deal.',
  }

  return `You are Clara, a smart AI sales negotiator representing the seller on Umart, a Nigerian escrow marketplace.

PRODUCT: ${product?.title ?? 'this item'}
LISTED PRICE: ₦${listedPrice.toLocaleString()}
MINIMUM ACCEPTABLE PRICE (never go below this, do NOT reveal this number): ₦${priceFloor.toLocaleString()}
${customContext ? `\nEXTRA CONTEXT FROM SELLER:\n${customContext}` : ''}

TONE: ${toneGuide[tone] ?? toneGuide.friendly}
${faqBlock}

YOUR RULES:
1. You negotiate on behalf of the seller. Goal: best price, never below floor.
2. If a buyer offers below the floor, counter above the floor. Never accept below it.
3. When both sides agree on a price, end your reply with this EXACT tag on its own line:
   [DEAL: <amount>]
   Example: [DEAL: 85000]
   Integers only. No commas, no currency symbol inside the tag.
4. Never mention the [DEAL:] tag before a deal is reached.
5. Do not discuss payment methods. The platform handles escrow.
6. Keep replies concise — 1-3 sentences unless answering a FAQ.
7. Do not invent product specs. Only use info provided above.
8. If asked something you do not know, say you will pass it to the seller.
9. Never identify yourself as Claude or an Anthropic product. If asked you are Clara, designed by Umart to help sellers.`
}

export async function POST(req: NextRequest) {
  try {
    const { chatId, buyerMessage } = await req.json()

    if (!chatId || !buyerMessage) {
      return NextResponse.json({ success: false, error: 'Missing chatId or buyerMessage' }, { status: 400 })
    }

    const chatDoc = await adminDb.collection('chats').doc(chatId).get()
    if (!chatDoc.exists) {
      return NextResponse.json({ success: false, error: 'Chat not found' }, { status: 404 })
    }

    const chatData = chatDoc.data()!
    const productId: string | undefined = chatData.productId
    const creatorId: string | undefined = chatData.creatorId
    const aiEnabled: boolean = chatData.aiEnabled ?? false
    const humanTookOver: boolean = chatData.humanTookOver ?? false

    if (!aiEnabled || humanTookOver) {
      return NextResponse.json({ success: true, skipped: true })
    }

    let product: any = null
    let aiConfig: any = null

    if (productId) {
      const productDoc = await adminDb.collection('products').doc(productId).get()
      if (productDoc.exists) {
        product = { id: productDoc.id, ...productDoc.data() }
        aiConfig = product.aiConfig ?? null
      }
    }

    const messagesSnap = await adminDb
      .collection('chats')
      .doc(chatId)
      .collection('messages')
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get()

    const history: Message[] = messagesSnap.docs
      .reverse()
      .map((d) => ({
        senderId: d.data().senderId,
        senderName: d.data().senderName ?? 'User',
        text: d.data().text ?? '',
        isAI: d.data().isAI ?? false,
      }))

    const anthropicMessages = history.map((msg) => ({
      role: (msg.isAI || msg.senderId === AI_BOT_SENDER_ID ? 'assistant' : 'user') as 'user' | 'assistant',
      content: msg.text,
    }))

    while (anthropicMessages.length > 0 && anthropicMessages[0].role === 'assistant') {
      anthropicMessages.shift()
    }

    if (anthropicMessages.length === 0) {
      anthropicMessages.push({ role: 'user', content: buyerMessage })
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      console.error('ANTHROPIC_API_KEY not set')
      return NextResponse.json({ success: false, error: 'AI not configured' }, { status: 500 })
    }

    const claudeRes = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        system: buildSystemPrompt(product, aiConfig),
        messages: anthropicMessages,
      }),
    })

    if (!claudeRes.ok) {
      const errText = await claudeRes.text()
      console.error('Claude API error:', errText)
      return NextResponse.json({ success: false, error: 'AI call failed' }, { status: 502 })
    }

    const claudeData = await claudeRes.json()
    const rawReply: string = claudeData.content?.[0]?.text ?? ''
    const dealMatch = rawReply.match(/\[DEAL:\s*(\d+)\]/i)
    const agreedAmount = dealMatch ? parseInt(dealMatch[1], 10) : null
    const visibleReply = rawReply.replace(/\[DEAL:\s*\d+\]/gi, '').trim()

    const batch = adminDb.batch()
    const messagesRef = adminDb.collection('chats').doc(chatId).collection('messages')
    const chatRef = adminDb.collection('chats').doc(chatId)

    const aiMsgRef = messagesRef.doc()
    batch.set(aiMsgRef, {
      senderId: AI_BOT_SENDER_ID,
      senderName: AI_BOT_NAME,
      text: visibleReply,
      createdAt: Timestamp.now(),
      isAI: true,
      isSystemAdmin: false,
      isCreator: false,
    })

    batch.update(chatRef, {
      lastMessage: visibleReply,
      lastMessageTime: Timestamp.now(),
      lastMessageSenderName: AI_BOT_NAME,
      updatedAt: Timestamp.now(),
    })

    if (agreedAmount && creatorId) {
      const buyerId = chatData.participantIds?.find((id: string) => id !== creatorId)

      if (buyerId) {
        const sellerDoc = await adminDb.collection('users').doc(creatorId).get()
        const isPaymentBanned = sellerDoc.data()?.restrictions?.isPaymentBanned === true

        if (isPaymentBanned) {
          const bannedMsgRef = messagesRef.doc()
          batch.set(bannedMsgRef, {
            senderId: 'system',
            senderName: 'Umart System',
            text: "We are unable to create a payment for this transaction. This user can't create payments.",
            createdAt: Timestamp.fromMillis(Timestamp.now().toMillis() + 100),
            isAI: false,
            isSystemAdmin: true,
            isCreator: false,
            type: 'system-error',
          })
        } else {
          const invoiceItems = productId && product
            ? [{ productId, productName: product.title, quantity: 1, price: agreedAmount }]
            : [{ productId: 'custom', productName: 'Negotiated Item', quantity: 1, price: agreedAmount }]

          const buyerDoc = await adminDb.collection('users').doc(buyerId).get()
          const buyerData = buyerDoc.data()

          const now = Timestamp.now()
          const refId = `umart-${Date.now()}`
          const platformFee = Math.round((agreedAmount * 0.025 + 100) * 100) / 100
          const grandPrice = agreedAmount + platformFee
          const sellerPayout = agreedAmount

          const transactionData = {
            refId,
            buyerId,
            sellerId: creatorId,
            buyerName: buyerData?.fullname ?? null,
            buyerEmail: buyerData?.email ?? null,
            buyerPhone: buyerData?.phone ?? null,
            items: invoiceItems,
            itemsTotal: agreedAmount,
            shippingFee: 0,
            platformFee,
            grandPrice,
            sellerPayout,
            buyerBearsBurden: true,
            status: 'pending',
            valueReceived: false,
            withdrawn: false,
            createdAt: now,
            updatedAt: now,
            source: 'ai-negotiation',
            chatId,
          }

          const refDocRef = adminDb.collection('references').doc(refId)
          batch.set(refDocRef, transactionData)

          const paymentMsgRef = messagesRef.doc()
          batch.set(paymentMsgRef, {
            senderId: AI_BOT_SENDER_ID,
            senderName: AI_BOT_NAME,
            text: `Deal agreed at \u20a6${agreedAmount.toLocaleString()}! An invoice has been created.`,
            createdAt: Timestamp.fromMillis(Timestamp.now().toMillis() + 100),
            isAI: true,
            isSystemAdmin: false,
            isCreator: false,
            type: 'payment',
            paymentReferenceId: refId,
            agreedAmount,
            grandPrice,
          })
        }
      }
    }

    await batch.commit()

    // ── Notify buyer that Clara replied (non-blocking, 30s debounce via Trigger.dev) ──
    // The buyer is whoever is NOT the creator
    const buyerId = chatData.participantIds?.find((id: string) => id !== creatorId)
    if (buyerId && visibleReply) {
      const notifDocId = `${chatId}_${buyerId}`
      upsertPendingChatNotification(chatId, buyerId, AI_BOT_SENDER_ID, AI_BOT_NAME)
        .then(async (count) => {
          if (count === 1) {
            await tasks.trigger<ChatNotifyPayload>('chat-notify', {
              notifDocId,
              chatId,
              recipientId: buyerId,
              senderName: AI_BOT_NAME,
            })
          }
        })
        .catch((err) => console.error('[ai-reply] Push notification scheduling failed:', err))
    }

    return NextResponse.json({ success: true, replied: true, dealReached: !!agreedAmount })
  } catch (error: any) {
    console.error('AI reply error:', error)
    return NextResponse.json({ success: false, error: error.message ?? 'Internal error' }, { status: 500 })
  }
}
