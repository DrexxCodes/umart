'use client'

import { useState, useEffect } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { useRouter } from 'next/navigation'
import { ChatList } from './components/ChatList'
import { ChatArea } from './components/ChatArea'
import { ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FcmPermissionPrompt } from '@/components/fcm-permission-prompt'

export function ChatClient() {
  const router = useRouter()
  const [selectedChatId, setSelectedChatId] = useState<string | undefined>()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showChatListMobile, setShowChatListMobile] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setIsAuthenticated(true)
      } else {
        router.push('/auth/login')
      }
      setLoading(false)
    })
    return () => unsubscribe()
  }, [router])

  const handleSelectChat = (chatId: string) => {
    setSelectedChatId(chatId)
    setShowChatListMobile(false)
  }

  const handleBackToList = () => {
    setShowChatListMobile(true)
    setSelectedChatId(undefined)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-60px)]">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (!isAuthenticated) return null

  return (
    <div className="h-[calc(100vh-60px)] bg-background">

      {/* ── Mobile ─────────────────────────────────────────────────────────── */}
      <div className="md:hidden h-full">
        {showChatListMobile ? (
          <div className="h-full border-r border-border bg-card flex flex-col">
            <div className="p-4 border-b border-border">
              <h2 className="font-bold">Conversations</h2>
            </div>
            <div className="flex-1 overflow-y-auto">
              <ChatList selectedChatId={selectedChatId} onSelectChat={handleSelectChat} />
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-border bg-card flex items-center gap-2 flex-shrink-0">
              <Button variant="ghost" size="sm" onClick={handleBackToList} className="p-0 h-auto">
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <h2 className="font-bold flex-1">Chat</h2>
            </div>

            {/*
              Messages area: fills remaining height and adds bottom padding equal
              to the ChatBox bar height (~72px) + safe area, so the last message
              is never obscured by the fixed input bar.
            */}
            <div className="flex-1 overflow-hidden pb-[72px]">
              <ChatArea chatId={selectedChatId} />
            </div>
          </div>
        )}
      </div>

      {/* ── Desktop ─────────────────────────────────────────────────────────── */}
      <div className="hidden md:flex h-full gap-4 p-4 max-w-7xl mx-auto">
        {/* Chat list */}
        <div className="w-1/3 border border-border rounded-lg p-4 bg-card flex flex-col">
          <h2 className="font-bold mb-4">Conversations</h2>
          <div className="flex-1 overflow-y-auto">
            <ChatList selectedChatId={selectedChatId} onSelectChat={handleSelectChat} />
          </div>
        </div>

        {/* Chat area — ChatBox stays in normal flow on desktop (mt-auto inside flex col) */}
        <div className="w-2/3 border border-border rounded-lg bg-card flex flex-col">
          <ChatArea chatId={selectedChatId} />
        </div>
      </div>

      <FcmPermissionPrompt />
    </div>
  )
}