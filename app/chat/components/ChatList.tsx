'use client'

import { useEffect, useState, useCallback } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import {
  collection, query, orderBy, onSnapshot, doc,
  where, type Timestamp,
} from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { formatRelativeTime } from '@/lib/timestamp'
import { Card } from '@/components/ui/card'
import { Loader2, MessageCircle, Eye } from 'lucide-react'

interface ChatItem {
  chatId: string
  participantName: string
  participantId: string
  lastMessage: string
  lastMessageTime: Timestamp | null
  lastMessageSenderName?: string
  createdAt?: Timestamp | null
  unreadCount: number
}

interface ChatListProps {
  selectedChatId?: string
  onSelectChat: (chatId: string) => void
}

export function ChatList({ selectedChatId, onSelectChat }: ChatListProps) {
  const [chats,   setChats]   = useState<ChatItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  // ── Sort helper: most recent message first, fallback to createdAt ─────────
  const sortChats = useCallback((list: ChatItem[]) =>
    [...list].sort((a, b) => {
      const ta = a.lastMessageTime ?? a.createdAt
      const tb = b.lastMessageTime ?? b.createdAt
      if (!ta && !tb) return 0
      if (!ta) return 1
      if (!tb) return -1
      const tsA = typeof ta.toMillis === 'function' ? ta.toMillis() : 0
      const tsB = typeof tb.toMillis === 'function' ? tb.toMillis() : 0
      return tsB - tsA
    }), [])

  useEffect(() => {
    let unsubscribeSnapshot: (() => void) | null = null
    const chatUnsubscribers   = new Map<string, () => void>()
    const unreadUnsubscribers = new Map<string, () => void>()

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) { setLoading(false); return }

      const userChatsRef = collection(db, 'users', user.uid, 'chats')

      // NOTE: We intentionally do NOT orderBy here because:
      //  1. Some docs may not have lastMessageTime yet → Firestore composite index required
      //  2. We sort client-side in real-time via sortChats() so ordering is always correct
      //     and updates instantly whenever lastMessageTime changes on the main chat doc.
      const q = query(userChatsRef)

      unsubscribeSnapshot = onSnapshot(
        q,
        (snapshot) => {
          if (snapshot.empty) { setChats([]); setLoading(false); return }

          // Clean up old per-chat listeners before rebuilding
          chatUnsubscribers.forEach(u => u())
          chatUnsubscribers.clear()
          unreadUnsubscribers.forEach(u => u())
          unreadUnsubscribers.clear()

          const chatsMap = new Map<string, ChatItem>()

          snapshot.docs.forEach((chatRefDoc) => {
            const ref = chatRefDoc.data()
            const chatId = ref.chatId as string

            chatsMap.set(chatId, {
              chatId,
              participantName:       ref.participantName   || 'Unknown',
              participantId:         ref.participantId     || '',
              lastMessage:           '',
              lastMessageTime:       ref.lastMessageTime   ?? null,
              lastMessageSenderName: '',
              createdAt:             ref.createdAt         ?? null,
              unreadCount:           0,
            })

            // ── Listen to main chat doc for lastMessage / lastMessageTime ──
            // This is the source of truth for sorting — updates here trigger re-sort.
            const unsubChat = onSnapshot(
              doc(db, 'chats', chatId),
              (chatDoc) => {
                if (!chatDoc.exists()) return
                const d = chatDoc.data()!
                const existing = chatsMap.get(chatId)
                if (!existing) return
                chatsMap.set(chatId, {
                  ...existing,
                  lastMessage:           d.lastMessage          || '',
                  lastMessageTime:       d.lastMessageTime      ?? existing.lastMessageTime,
                  lastMessageSenderName: d.lastMessageSenderName || '',
                })
                setChats(sortChats(Array.from(chatsMap.values())))
              },
              (err) => console.error(`Error listening to chat ${chatId}:`, err)
            )
            chatUnsubscribers.set(chatId, unsubChat)

            // ── Listen to unseen messages (sent by others) for unread count ─
            const msgsRef = collection(db, 'chats', chatId, 'messages')
            const unseenQ = query(
              msgsRef,
              where('seen', '==', false),
              where('senderId', '!=', user.uid)
            )
            const unsubUnseen = onSnapshot(
              unseenQ,
              (unseenSnap) => {
                const existing = chatsMap.get(chatId)
                if (!existing) return
                chatsMap.set(chatId, { ...existing, unreadCount: unseenSnap.size })
                setChats(sortChats(Array.from(chatsMap.values())))
              },
              (err) => console.error(`Unread count error for ${chatId}:`, err)
            )
            unreadUnsubscribers.set(chatId, unsubUnseen)
          })

          setChats(sortChats(Array.from(chatsMap.values())))
          setLoading(false)
        },
        (err) => {
          console.error('Error listening to chats:', err)
          setError('Failed to load chats')
          setLoading(false)
        }
      )
    })

    return () => {
      unsubscribeAuth()
      unsubscribeSnapshot?.()
      chatUnsubscribers.forEach(u => u())
      unreadUnsubscribers.forEach(u => u())
    }
  }, [sortChats])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary mb-2" />
        <p className="text-muted-foreground">Loading chats...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-destructive">{error}</p>
      </div>
    )
  }

  if (chats.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <MessageCircle className="w-12 h-12 text-muted-foreground mb-3 opacity-50" />
        <p className="text-muted-foreground">No chats yet</p>
        <p className="text-sm text-muted-foreground mt-1">Start a conversation with a seller</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {chats.map((chat) => {
        const hasUnread = chat.unreadCount > 0
        return (
          <Card
            key={chat.chatId}
            className={`p-4 cursor-pointer transition-colors ${
              selectedChatId === chat.chatId
                ? 'bg-primary/10 border-primary'
                : hasUnread
                ? 'bg-primary/5 border-primary/30 hover:bg-primary/10'
                : 'hover:bg-muted/50'
            }`}
            onClick={() => onSelectChat(chat.chatId)}
          >
            <div className="flex justify-between items-start mb-1.5">
              {/* Name + unread badge */}
              <div className="flex items-center gap-2 min-w-0">
                <h3 className={`font-semibold text-sm truncate ${hasUnread ? 'text-foreground' : 'text-foreground/80'}`}>
                  {chat.participantName || `Chat: ${chat.chatId.slice(0, 8)}`}
                </h3>
                {hasUnread && (
                  <span className="shrink-0 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                    {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
                  </span>
                )}
              </div>

              {/* Timestamp */}
              {chat.lastMessageTime && (
                <span className="text-xs text-muted-foreground shrink-0 ml-2">
                  {formatRelativeTime(chat.lastMessageTime)}
                </span>
              )}
            </div>

            {/* Last message preview + seen eye */}
            <div className="flex items-center gap-1.5">
              <p className={`text-sm truncate flex-1 ${hasUnread ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                {chat.lastMessageSenderName ? (
                  <span>
                    <strong>{chat.lastMessageSenderName}:</strong>{' '}
                    {chat.lastMessage || 'No messages yet'}
                  </span>
                ) : (
                  chat.lastMessage || 'No messages yet'
                )}
              </p>
              {/* Eye icon when there are no unread messages and a last message exists */}
              {!hasUnread && chat.lastMessage && (
                <Eye className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
              )}
            </div>
          </Card>
        )
      })}
    </div>
  )
}
