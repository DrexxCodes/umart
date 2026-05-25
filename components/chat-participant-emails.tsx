'use client'
// components/chat-participant-emails.tsx
//
// A button + dialog that shows both participants' emails in a chat.
// Used in both /chat and /creator/chat so both sides can easily
// copy each other's email (seller needs buyer's email for invoicing,
// buyer needs seller's email for reporting).

import { useState } from 'react'
import { Copy, Mail, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

export interface ParticipantInfo {
  uid: string
  fullname: string
  email: string | null
}

interface ChatParticipantEmailsProps {
  participants: ParticipantInfo[]
  currentUserId: string | null
}

export function ChatParticipantEmails({ participants, currentUserId }: ChatParticipantEmailsProps) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  if (!participants || participants.length === 0) return null

  const handleCopy = async (email: string, uid: string) => {
    try {
      await navigator.clipboard.writeText(email)
      setCopied(uid)
      toast.success('Email copied!')
      setTimeout(() => setCopied(null), 2000)
    } catch {
      toast.error('Could not copy — please copy manually.')
    }
  }

  const me    = participants.find((p) => p.uid === currentUserId)
  const other = participants.find((p) => p.uid !== currentUserId)

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="gap-1.5 text-xs"
        onClick={() => setOpen(true)}
      >
        <Mail className="w-3.5 h-3.5" />
        View Emails
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false) }}
        >
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Mail className="w-4 h-4 text-primary" />
                Chat Emails
              </h2>
              <button
                onClick={() => setOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-5 py-5 space-y-4">
              <p className="text-xs text-muted-foreground">
                Use these emails to create invoices or file reports. Tap the copy button next to any email.
              </p>

              {/* Other participant (shown first — most useful) */}
              {other && (
                <EmailRow
                  label={other.uid === currentUserId ? 'You' : other.fullname}
                  sublabel="Other participant"
                  email={other.email}
                  uid={other.uid}
                  copied={copied}
                  onCopy={handleCopy}
                />
              )}

              {/* Current user */}
              {me && (
                <EmailRow
                  label="You"
                  sublabel={me.fullname}
                  email={me.email}
                  uid={me.uid}
                  copied={copied}
                  onCopy={handleCopy}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function EmailRow({
  label,
  sublabel,
  email,
  uid,
  copied,
  onCopy,
}: {
  label: string
  sublabel: string
  email: string | null
  uid: string
  copied: string | null
  onCopy: (email: string, uid: string) => void
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3">
      <div className="min-w-0">
        <p className="text-xs font-semibold text-foreground truncate">{label}</p>
        <p className="text-[11px] text-muted-foreground truncate">{sublabel}</p>
        <p className="text-xs text-primary font-mono truncate mt-0.5">
          {email ?? 'No email available'}
        </p>
      </div>
      {email && (
        <button
          onClick={() => onCopy(email, uid)}
          className="flex-shrink-0 flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
        >
          {copied === uid
            ? <Check className="w-3.5 h-3.5" />
            : <Copy className="w-3.5 h-3.5" />
          }
        </button>
      )}
    </div>
  )
}
