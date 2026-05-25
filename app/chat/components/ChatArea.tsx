'use client'

import { useEffect, useState, useRef } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { collection, query, orderBy, onSnapshot, doc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { convertToDate } from '@/lib/timestamp'
import { Loader2 } from 'lucide-react'
import { ChatSenderBubble } from './ChatSenderBubble'
import { ChatRecipientBubble } from './ChatRecipientBubble'
import { ChatBox } from './ChatBox'
import { ChatParticipantEmails, type ParticipantInfo } from '@/components/chat-participant-emails'

interface Message {
  id: string
  senderId: string
  senderName: string
  text: string
  createdAt: any
  isSystemAdmin: boolean
  isCreator: boolean
  isAI?: boolean
  type?: string
  paymentReferenceId?: string
  agreedAmount?: number
  grandPrice?: number
}

interface ChatAreaProps {
  chatId?: string
  showTakeoverButton?: boolean
}

interface ChatInfo {
  productId?: string
  productName?: string
  aiEnabled?: boolean
  humanTookOver?: boolean
  creatorId?: string
}

export function ChatArea({ chatId, showTakeoverButton = false }: ChatAreaProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [messageSending, setMessageSending] = useState(false)
  const [chatInfo, setChatInfo] = useState<ChatInfo | null>(null)
  const [participants, setParticipants] = useState<ParticipantInfo[]>([])
  const [takeoverLoading, setTakeoverLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const lastMessageCountRef = useRef(0)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) setCurrentUserId(user.uid)
    })
    return () => unsubscribe()
  }, [])

  // Fetch participants (emails) once when chatId changes
  useEffect(() => {
    if (!chatId) { setParticipants([]); return }

    const fetchParticipants = async () => {
      try {
        const user = auth.currentUser
        if (!user) return
        const token = await user.getIdToken()
        const res = await fetch(`/api/chat/${chatId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const result = await res.json()
        if (result.success && result.data.participants) {
          setParticipants(result.data.participants)
        }
      } catch {
        // Non-critical — emails just won't show
      }
    }

    fetchParticipants()
  }, [chatId])

  useEffect(() => {
    if (!chatId) {
      setMessages([])
      setChatInfo(null)
      setLoading(false)
      setError('')
      return
    }

    let unsubscribeMessages: (() => void) | null = null
    let unsubscribeChat: (() => void) | null = null

    const setupRealtimeListeners = async () => {
      try {
        setLoading(true)
        setError('')

        const user = auth.currentUser
        if (!user) { setError('You must be logged in'); setLoading(false); return }

        const chatDocRef = doc(db, 'chats', chatId)
        unsubscribeChat = onSnapshot(
          chatDocRef,
          (chatDoc) => {
            if (chatDoc.exists()) {
              const data = chatDoc.data()
              setChatInfo({
                productId: data?.productId,
                productName: data?.productName,
                aiEnabled: data?.aiEnabled ?? false,
                humanTookOver: data?.humanTookOver ?? false,
                creatorId: data?.creatorId,
              })
            } else {
              setError('Chat not found')
            }
          },
          (err) => {
            console.error('Error listening to chat info:', err)
            setError('Failed to load chat info')
          }
        )

        const messagesRef = collection(db, 'chats', chatId, 'messages')
        const messagesQuery = query(messagesRef, orderBy('createdAt', 'asc'))

        unsubscribeMessages = onSnapshot(
          messagesQuery,
          (snapshot) => {
            const newMessages: Message[] = snapshot.docs.map((doc) => {
              const data = doc.data()
              return {
                id: doc.id,
                senderId: data.senderId,
                senderName: data.senderName || 'User',
                text: data.text,
                createdAt: data.createdAt,
                isSystemAdmin: data.isSystemAdmin || false,
                isCreator: data.isCreator || false,
                isAI: data.isAI || false,
                type: data.type,
                paymentReferenceId: data.paymentReferenceId,
                agreedAmount: data.agreedAmount,
                grandPrice: data.grandPrice,
              }
            })

            setMessages(newMessages)
            setLoading(false)

            if (newMessages.length > lastMessageCountRef.current) {
              lastMessageCountRef.current = newMessages.length
              setTimeout(scrollToBottom, 100)
            }
          },
          (err) => {
            console.error('Error listening to messages:', err)
            setError('Failed to load messages: ' + err.message)
            setLoading(false)
          }
        )
      } catch (err: any) {
        console.error('Error setting up listeners:', err)
        setError(err.message || 'Failed to load messages')
        setLoading(false)
      }
    }

    setupRealtimeListeners()

    return () => {
      if (unsubscribeMessages) unsubscribeMessages()
      if (unsubscribeChat) unsubscribeChat()
      lastMessageCountRef.current = 0
    }
  }, [chatId])

  const handleSendMessage = async (text: string) => {
    if (!chatId || !text.trim()) return
    try {
      setMessageSending(true)
      const user = auth.currentUser
      if (!user) return
      const token = await user.getIdToken()
      const response = await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ chatId, text }),
      })
      const result = await response.json()
      if (!result.success) { console.error('Failed to send:', result.error); setError('Failed to send message') }
    } catch (error) {
      console.error('Error sending message:', error)
      setError('Failed to send message')
    } finally {
      setMessageSending(false)
    }
  }

  const handleTakeover = async () => {
    if (!chatId) return
    try {
      setTakeoverLoading(true)
      const user = auth.currentUser
      if (!user) return
      const token = await user.getIdToken()
      const response = await fetch('/api/chat/takeover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ chatId }),
      })
      const result = await response.json()
      if (!result.success) setError(result.error || 'Failed to take over chat')
    } catch (err) {
      console.error('Takeover error:', err)
      setError('Failed to take over chat')
    } finally {
      setTakeoverLoading(false)
    }
  }

  const handleHandBackToAI = async () => {
    if (!chatId) return
    try {
      setTakeoverLoading(true)
      const user = auth.currentUser
      if (!user) return
      const token = await user.getIdToken()
      const response = await fetch('/api/chat/takeover', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ chatId }),
      })
      const result = await response.json()
      if (!result.success) setError(result.error || 'Failed to hand back to AI')
    } catch (err) {
      console.error('Hand back error:', err)
    } finally {
      setTakeoverLoading(false)
    }
  }

  if (!chatId) {
    return (
      <div className="flex items-center justify-center h-full bg-muted/50">
        <div className="text-center">
          <p className="text-lg font-medium text-muted-foreground">Select a Chat to start chatting</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading messages...</p>
        </div>
      </div>
    )
  }

  const isAIActive   = chatInfo?.aiEnabled && !chatInfo?.humanTookOver
  const isHumanActive = chatInfo?.aiEnabled && chatInfo?.humanTookOver

  return (
    <div className="flex flex-col h-full">
      {/* ── Top bar: AI takeover + View Emails ─────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border gap-2 shrink-0">
        {/* AI banner */}
        {showTakeoverButton && chatInfo?.aiEnabled ? (
          <div className={`flex items-center gap-2 text-sm rounded-lg px-3 py-1.5 flex-1 ${
            isAIActive
              ? 'bg-violet-50 dark:bg-violet-950/30'
              : 'bg-amber-50 dark:bg-amber-950/30'
          }`}>
            <span className={`font-medium text-xs ${isAIActive ? 'text-violet-700 dark:text-violet-300' : 'text-amber-700 dark:text-amber-300'}`}>
              {isAIActive ? '🤖 Clara is negotiating for you' : '👤 You are in control'}
            </span>
            {isAIActive ? (
              <button
                onClick={handleTakeover}
                disabled={takeoverLoading}
                className="ml-auto text-xs bg-violet-600 hover:bg-violet-700 text-white px-2 py-0.5 rounded-full transition-colors disabled:opacity-50"
              >
                {takeoverLoading ? 'Taking over...' : 'Take Over'}
              </button>
            ) : (
              <button
                onClick={handleHandBackToAI}
                disabled={takeoverLoading}
                className="ml-auto text-xs bg-amber-600 hover:bg-amber-700 text-white px-2 py-0.5 rounded-full transition-colors disabled:opacity-50"
              >
                {takeoverLoading ? 'Handing back...' : 'Hand Back to AI'}
              </button>
            )}
          </div>
        ) : (
          <div className="flex-1" />
        )}

        {/* View Emails button — always shown when participants are loaded */}
        {participants.length > 0 && (
          <ChatParticipantEmails
            participants={participants}
            currentUserId={currentUserId}
          />
        )}
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 p-4">
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 mb-4">
          <p className="text-sm text-destructive font-medium">
            Chats are stored and we can review at any time. Buyers ensure to NOT MAKE PAYMENTS DIRECTLY IN SELLER ACCOUNT. Report any seller that asks you to make direct payment.
          </p>
        </div>

        {chatInfo?.productId && (
          <div className="bg-primary/10 border border-primary/30 rounded-lg p-3 mb-4">
            <p className="text-sm text-foreground">
              This chat started from this product:{' '}
              <a href={`/product/${chatInfo.productId}`} className="text-primary hover:underline font-medium">
                {chatInfo.productName || 'View Product'}
              </a>
            </p>
          </div>
        )}

        {error && <div className="text-center text-destructive text-sm mb-4">{error}</div>}

        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messages.map((message) => {
            const messageDate = convertToDate(message.createdAt)
            return (
              <div key={message.id}>
                {message.senderId === currentUserId ? (
                  <ChatSenderBubble
                    text={message.text}
                    senderName={message.senderName}
                    timestamp={messageDate}
                    isSystemAdmin={message.isSystemAdmin}
                    isCreator={message.isCreator}
                  />
                ) : (
                  <ChatRecipientBubble
                    text={message.text}
                    senderName={message.senderName}
                    timestamp={messageDate}
                    isSystemAdmin={message.isSystemAdmin}
                    isCreator={message.isCreator}
                    isAI={message.isAI}
                    type={message.type}
                    paymentReferenceId={message.paymentReferenceId}
                    agreedAmount={message.agreedAmount}
                    grandPrice={message.grandPrice}
                  />
                )}
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <ChatBox
        chatId={chatId}
        onSendMessage={handleSendMessage}
        disabled={!chatId}
        isLoading={messageSending}
      />
    </div>
  )
}
