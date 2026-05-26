'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import {
  collection, query, orderBy, onSnapshot, doc,
} from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { convertToDate, getChatDayLabel, getDayKey } from '@/lib/timestamp'
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
  seen?: boolean
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

// ── Day separator ────────────────────────────────────────────────────────────
function DaySeparator({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 my-3 px-2">
      <div className="flex-1 h-px bg-border/60" />
      <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70 px-2 py-0.5 rounded-full bg-muted/60 select-none">
        {label}
      </span>
      <div className="flex-1 h-px bg-border/60" />
    </div>
  )
}

// ── Message cache helpers ────────────────────────────────────────────────────
const CACHE_VERSION = 2   // bump when Message shape changes

function getCacheKey(chatId: string) {
  return `umart_chat_msgs_v${CACHE_VERSION}_${chatId}`
}

function loadCachedMessages(chatId: string): Message[] {
  try {
    const raw = sessionStorage.getItem(getCacheKey(chatId))
    if (!raw) return []
    return JSON.parse(raw) as Message[]
  } catch {
    return []
  }
}

function saveMessagesToCache(chatId: string, messages: Message[]) {
  try {
    sessionStorage.setItem(getCacheKey(chatId), JSON.stringify(messages.slice(-200)))
  } catch {
    // storage full — ignore
  }
}

// ── Group messages by day ────────────────────────────────────────────────────
function groupByDay(messages: Message[]): Array<{ dayKey: string; label: string; messages: Message[] }> {
  const groups: Map<string, Message[]> = new Map()
  for (const msg of messages) {
    const date = convertToDate(msg.createdAt)
    const key  = getDayKey(date)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(msg)
  }
  return Array.from(groups.entries()).map(([dayKey, msgs]) => ({
    dayKey,
    label:    getChatDayLabel(convertToDate(msgs[0].createdAt)),
    messages: msgs,
  }))
}

export function ChatArea({ chatId, showTakeoverButton = false }: ChatAreaProps) {
  const [messages,        setMessages]        = useState<Message[]>([])
  const [loading,         setLoading]         = useState(true)
  const [error,           setError]           = useState('')
  const [currentUserId,   setCurrentUserId]   = useState<string | null>(null)
  const [messageSending,  setMessageSending]  = useState(false)
  const [chatInfo,        setChatInfo]        = useState<ChatInfo | null>(null)
  const [participants,    setParticipants]    = useState<ParticipantInfo[]>([])
  const [takeoverLoading, setTakeoverLoading] = useState(false)

  const messagesEndRef      = useRef<HTMLDivElement>(null)
  const scrollContainerRef  = useRef<HTMLDivElement>(null)
  const initialScrollDone   = useRef(false)
  const isFirstLoad         = useRef(true)
  // Track last chatId we called seen for to avoid duplicate calls
  const seenMarkedForRef    = useRef<string | null>(null)

  // ── Auth ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) setCurrentUserId(u.uid)
    })
    return () => unsub()
  }, [])

  // ── Scroll to bottom ──────────────────────────────────────────────────────
  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior, block: 'end' })
  }, [])

  // ── Mark messages as seen when chat is opened ─────────────────────────────
  const markAsSeen = useCallback(async (cId: string) => {
    if (seenMarkedForRef.current === cId) return
    seenMarkedForRef.current = cId
    try {
      const user = auth.currentUser
      if (!user) return
      const token = await user.getIdToken()
      await fetch('/api/chat/seen', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ chatId: cId }),
      })
    } catch (err) {
      console.error('[ChatArea] markAsSeen error:', err)
    }
  }, [])

  // ── Fetch participants ────────────────────────────────────────────────────
  useEffect(() => {
    if (!chatId) { setParticipants([]); return }
    ;(async () => {
      try {
        const user = auth.currentUser
        if (!user) return
        const token = await user.getIdToken()
        const res   = await fetch(`/api/chat/${chatId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const result = await res.json()
        if (result.success && result.data.participants) {
          setParticipants(result.data.participants)
        }
      } catch { /* non-critical */ }
    })()
  }, [chatId])

  // ── Real-time message listener + cache + seen mark ────────────────────────
  useEffect(() => {
    if (!chatId) {
      setMessages([])
      setChatInfo(null)
      setLoading(false)
      setError('')
      initialScrollDone.current = false
      isFirstLoad.current = true
      seenMarkedForRef.current = null
      return
    }

    // Pre-populate from cache
    const cached = loadCachedMessages(chatId)
    if (cached.length > 0) {
      setMessages(cached)
      setLoading(false)
    }

    let unsubMessages: (() => void) | null = null
    let unsubChat: (() => void) | null     = null

    const setup = async () => {
      try {
        if (!cached.length) setLoading(true)
        setError('')

        const user = auth.currentUser
        if (!user) { setError('You must be logged in'); setLoading(false); return }

        // Chat info listener
        unsubChat = onSnapshot(
          doc(db, 'chats', chatId),
          (snap) => {
            if (snap.exists()) {
              const d = snap.data()
              setChatInfo({
                productId:     d?.productId,
                productName:   d?.productName,
                aiEnabled:     d?.aiEnabled     ?? false,
                humanTookOver: d?.humanTookOver ?? false,
                creatorId:     d?.creatorId,
              })
            } else {
              setError('Chat not found')
            }
          },
          (err) => { console.error('Chat info error:', err); setError('Failed to load chat info') }
        )

        // Messages listener
        const msgsRef   = collection(db, 'chats', chatId, 'messages')
        const msgsQuery = query(msgsRef, orderBy('createdAt', 'asc'))

        unsubMessages = onSnapshot(
          msgsQuery,
          (snap) => {
            const incoming: Message[] = snap.docs.map((d) => {
              const data = d.data()
              return {
                id:                 d.id,
                senderId:           data.senderId,
                senderName:         data.senderName || 'User',
                text:               data.text,
                createdAt:          data.createdAt,
                isSystemAdmin:      data.isSystemAdmin  || false,
                isCreator:          data.isCreator      || false,
                isAI:               data.isAI           || false,
                type:               data.type,
                paymentReferenceId: data.paymentReferenceId,
                agreedAmount:       data.agreedAmount,
                grandPrice:         data.grandPrice,
                seen:               data.seen           ?? false,
              }
            })

            setMessages(incoming)
            saveMessagesToCache(chatId, incoming)
            setLoading(false)

            // Mark incoming messages as seen (non-blocking)
            markAsSeen(chatId)

            if (isFirstLoad.current) {
              isFirstLoad.current = false
              setTimeout(() => {
                scrollToBottom('instant')
                initialScrollDone.current = true
              }, 60)
            } else {
              const el = scrollContainerRef.current
              if (el) {
                const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
                if (distanceFromBottom < 200) setTimeout(() => scrollToBottom('smooth'), 60)
              }
            }
          },
          (err) => {
            console.error('Messages error:', err)
            setError('Failed to load messages: ' + err.message)
            setLoading(false)
          }
        )
      } catch (err: any) {
        console.error('Setup error:', err)
        setError(err.message || 'Failed to load messages')
        setLoading(false)
      }
    }

    setup()

    return () => {
      unsubMessages?.()
      unsubChat?.()
      initialScrollDone.current = false
      isFirstLoad.current = true
    }
  }, [chatId, scrollToBottom, markAsSeen])

  // ── Send message ──────────────────────────────────────────────────────────
  const handleSendMessage = async (text: string) => {
    if (!chatId || !text.trim()) return
    try {
      setMessageSending(true)
      const user = auth.currentUser
      if (!user) return
      const token = await user.getIdToken()
      const res   = await fetch('/api/chat/send', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ chatId, text }),
      })
      const result = await res.json()
      if (!result.success) setError('Failed to send message')
    } catch {
      setError('Failed to send message')
    } finally {
      setMessageSending(false)
    }
  }

  // ── Takeover / hand back ──────────────────────────────────────────────────
  const handleTakeover = async () => {
    if (!chatId) return
    try {
      setTakeoverLoading(true)
      const user = auth.currentUser
      if (!user) return
      const token = await user.getIdToken()
      const res = await fetch('/api/chat/takeover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ chatId }),
      })
      const result = await res.json()
      if (!result.success) setError(result.error || 'Failed to take over chat')
    } catch { setError('Failed to take over chat') }
    finally { setTakeoverLoading(false) }
  }

  const handleHandBackToAI = async () => {
    if (!chatId) return
    try {
      setTakeoverLoading(true)
      const user = auth.currentUser
      if (!user) return
      const token = await user.getIdToken()
      await fetch('/api/chat/takeover', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ chatId }),
      })
    } catch { /* ignore */ }
    finally { setTakeoverLoading(false) }
  }

  // ── Empty state ───────────────────────────────────────────────────────────
  if (!chatId) {
    return (
      <div className="flex items-center justify-center h-full bg-muted/20">
        <p className="text-sm text-muted-foreground">Select a conversation to start chatting</p>
      </div>
    )
  }

  if (loading && messages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-7 h-7 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading messages…</p>
        </div>
      </div>
    )
  }

  const isAIActive    = chatInfo?.aiEnabled && !chatInfo?.humanTookOver
  const isHumanActive = chatInfo?.aiEnabled && chatInfo?.humanTookOver
  const dayGroups     = groupByDay(messages)

  return (
    <div className="flex flex-col h-full">

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border gap-2 shrink-0">
        {showTakeoverButton && chatInfo?.aiEnabled ? (
          <div className={`flex items-center gap-2 text-sm rounded-lg px-3 py-1.5 flex-1 ${
            isAIActive ? 'bg-violet-50 dark:bg-violet-950/30' : 'bg-amber-50 dark:bg-amber-950/30'
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
                {takeoverLoading ? 'Taking over…' : 'Take Over'}
              </button>
            ) : (
              <button
                onClick={handleHandBackToAI}
                disabled={takeoverLoading}
                className="ml-auto text-xs bg-amber-600 hover:bg-amber-700 text-white px-2 py-0.5 rounded-full transition-colors disabled:opacity-50"
              >
                {takeoverLoading ? 'Handing back…' : 'Hand Back to AI'}
              </button>
            )}
          </div>
        ) : (
          <div className="flex-1" />
        )}

        {participants.length > 0 && (
          <ChatParticipantEmails participants={participants} currentUserId={currentUserId} />
        )}
      </div>

      {/* ── Messages ── */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5
          pb-[calc(4.5rem+env(safe-area-inset-bottom))]
          md:pb-4"
      >
        <div className="mx-2 mb-3 bg-destructive/8 border border-destructive/20 rounded-xl p-3">
          <p className="text-xs text-destructive/80 leading-relaxed">
            ⚠️ Never make direct payments to sellers. Report anyone who asks.
          </p>
        </div>

        {chatInfo?.productId && (
          <div className="mx-2 mb-3 bg-primary/8 border border-primary/20 rounded-xl p-3">
            <p className="text-xs text-foreground">
              Chat about:{' '}
              <a href={`/product/${chatInfo.productId}`} className="text-primary font-semibold hover:underline">
                {chatInfo.productName || 'View Product'}
              </a>
            </p>
          </div>
        )}

        {error && (
          <div className="mx-2 mb-2 text-center text-xs text-destructive">{error}</div>
        )}

        {messages.length === 0 && (
          <div className="flex items-center justify-center py-16">
            <p className="text-sm text-muted-foreground">No messages yet. Say hello! 👋</p>
          </div>
        )}

        {dayGroups.map((group) => (
          <div key={group.dayKey}>
            <DaySeparator label={group.label} />

            {group.messages.map((message, idx) => {
              const prevMsg  = group.messages[idx - 1]
              const showName = !prevMsg || prevMsg.senderId !== message.senderId
              const msgDate  = convertToDate(message.createdAt)
              const isMine   = message.senderId === currentUserId

              return (
                <div
                  key={message.id}
                  className={idx > 0 && group.messages[idx - 1].senderId === message.senderId ? 'mt-0.5' : 'mt-2'}
                >
                  {isMine ? (
                    <ChatSenderBubble
                      text={message.text}
                      senderName={message.senderName}
                      timestamp={msgDate}
                      isSystemAdmin={message.isSystemAdmin}
                      isCreator={message.isCreator}
                      showName={showName}
                      seen={message.seen ?? false}
                    />
                  ) : (
                    <ChatRecipientBubble
                      text={message.text}
                      senderName={message.senderName}
                      timestamp={msgDate}
                      isSystemAdmin={message.isSystemAdmin}
                      isCreator={message.isCreator}
                      isAI={message.isAI}
                      type={message.type}
                      paymentReferenceId={message.paymentReferenceId}
                      agreedAmount={message.agreedAmount}
                      grandPrice={message.grandPrice}
                      showName={showName}
                    />
                  )}
                </div>
              )
            })}
          </div>
        ))}

        <div ref={messagesEndRef} className="h-1" />
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
