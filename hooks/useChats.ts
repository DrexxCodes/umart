'use client'

import { useState, useEffect, useCallback } from 'react'
import { auth } from '@/lib/firebase'
import { onAuthStateChanged } from 'firebase/auth'

export interface Message {
  id: string
  senderId: string
  senderName: string
  text: string
  createdAt: any
  isAI?: boolean
  isCreator?: boolean
  isSystemAdmin?: boolean
  seen?: boolean
  type?: string
  paymentReferenceId?: string
  agreedAmount?: number
  grandPrice?: number
}

export interface ChatListItem {
  chatId: string
  participantName: string
  participantId: string
  lastMessage: string
  lastMessageTime: any
  lastMessageSenderName?: string
  createdAt: any
  unreadCount: number
}

interface UseChatsResult {
  chats: ChatListItem[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

// Helper — get a Bearer token for the current user (throws if not authed)
async function getBearerToken(): Promise<string> {
  const user = auth.currentUser
  if (!user) throw new Error('Not authenticated')
  return user.getIdToken()
}

export function useChats(): UseChatsResult {
  const [chats, setChats] = useState<ChatListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  // Watch auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUserId(u ? u.uid : null)
    })
    return () => unsub()
  }, [])

  const fetchChats = useCallback(async () => {
    if (!userId) return
    try {
      setLoading(true)
      setError(null)
      const token = await getBearerToken()
      const res = await fetch('/api/chat/list', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const result = await res.json()
      if (!result.success) throw new Error(result.error || 'Failed to fetch chats')
      setChats(result.data ?? [])
    } catch (err: any) {
      setError(err.message || 'Failed to fetch chats')
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    if (userId) fetchChats()
  }, [userId, fetchChats])

  return { chats, loading, error, refresh: fetchChats }
}

export function useChat(chatId: string) {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchMessages = useCallback(async () => {
    if (!chatId) return
    try {
      setLoading(true)
      setError(null)
      const token = await getBearerToken()
      const res = await fetch(`/api/chat/${chatId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const result = await res.json()
      if (!result.success) throw new Error(result.error || 'Failed to fetch messages')
      setMessages(result.data?.messages ?? [])
    } catch (err: any) {
      setError(err.message || 'Failed to fetch messages')
    } finally {
      setLoading(false)
    }
  }, [chatId])

  useEffect(() => {
    fetchMessages()
  }, [fetchMessages])

  const sendMessage = async (text: string) => {
    try {
      const token = await getBearerToken()
      const res = await fetch('/api/chat/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ chatId, text }),
      })
      const result = await res.json()
      if (!result.success) throw new Error(result.error || 'Failed to send message')
      // Re-fetch messages after sending
      await fetchMessages()
    } catch (err: any) {
      setError(err.message || 'Failed to send message')
      throw err
    }
  }

  const markAsSeen = async () => {
    try {
      const token = await getBearerToken()
      await fetch('/api/chat/seen', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ chatId }),
      })
    } catch {
      // Non-critical
    }
  }

  return { messages, loading, error, sendMessage, markAsSeen, refresh: fetchMessages }
}

export function useCreateChat() {
  const createChat = async (params: {
    userId: string
    sellerId: string
    productId?: string
    productName?: string
  }) => {
    const token = await getBearerToken()
    const res = await fetch('/api/chat/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(params),
    })
    const result = await res.json()
    if (!result.success) throw new Error(result.error || 'Failed to create chat')
    return result.data as { chatId: string }
  }

  return { createChat }
}
