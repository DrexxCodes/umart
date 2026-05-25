'use client'

import { useState, useEffect } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { useRouter } from 'next/navigation'
import { ChatList } from '@/app/chat/components/ChatList'
import { ChatArea } from '@/app/chat/components/ChatArea'
import { ChevronLeft, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FcmPermissionPrompt } from '@/components/fcm-permission-prompt'
import { Card } from '@/components/ui/card'

export function CreatorChatClient() {
  const router = useRouter()
  const [selectedChatId, setSelectedChatId] = useState<string | undefined>()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showChatListMobile, setShowChatListMobile] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        if (user) {
          setIsAuthenticated(true)
          setError(null)
        } else {
          router.push('/auth/login')
        }
        setLoading(false)
      },
      (err) => {
        setError(err.message)
        setLoading(false)
      }
    )
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
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-muted-foreground">Loading chat...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-60px)] p-4">
        <Card className="p-6 max-w-md">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-destructive mb-1">Error Loading Chat</h3>
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button onClick={() => window.location.reload()} className="mt-4" size="sm">
                Reload Page
              </Button>
            </div>
          </div>
        </Card>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-60px)]">
        <p className="text-muted-foreground">Redirecting to login...</p>
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-60px)] bg-background">
      {/* Mobile View */}
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
            <div className="p-4 border-b border-border bg-card flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={handleBackToList} className="p-0 h-auto">
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <h2 className="font-bold flex-1">Chat</h2>
            </div>
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* showTakeoverButton=true so creators see the AI takeover banner */}
              <ChatArea chatId={selectedChatId} showTakeoverButton />
            </div>
          </div>
        )}
      </div>

      {/* Desktop View */}
      <div className="hidden md:flex h-full gap-4 p-4 max-w-7xl mx-auto">
        <div className="w-1/3 border border-border rounded-lg p-4 bg-card flex flex-col overflow-hidden">
          <h2 className="font-bold mb-4">Conversations</h2>
          <div className="flex-1 overflow-y-auto">
            <ChatList selectedChatId={selectedChatId} onSelectChat={handleSelectChat} />
          </div>
        </div>
        <div className="w-2/3 border border-border rounded-lg bg-card flex flex-col overflow-hidden">
          {/* showTakeoverButton=true for creator-side chat */}
          <ChatArea chatId={selectedChatId} showTakeoverButton />
        </div>
      </div>
      <FcmPermissionPrompt />
    </div>
  )
}
