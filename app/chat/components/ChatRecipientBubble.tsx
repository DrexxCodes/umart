import { formatTime } from '@/lib/timestamp'
import { Bot } from 'lucide-react'

interface ChatRecipientBubbleProps {
  text: string
  senderName: string
  timestamp: Date
  isSystemAdmin: boolean
  isCreator: boolean
  isAI?: boolean
  type?: string
  paymentReferenceId?: string
  agreedAmount?: number
  grandPrice?: number
  /** Show sender name above bubble (first in a run from this sender) */
  showName?: boolean
}

export function ChatRecipientBubble({
  text,
  senderName,
  timestamp,
  isSystemAdmin,
  isCreator,
  isAI,
  type,
  paymentReferenceId,
  agreedAmount,
  grandPrice,
  showName = false,
}: ChatRecipientBubbleProps) {

  const displayName = isAI
    ? 'Clara (AI)'
    : senderName

  const roleColour = isAI
    ? 'text-violet-600 dark:text-violet-400'
    : isSystemAdmin ? 'text-destructive'
    : isCreator ? 'text-blue-600 dark:text-blue-400'
    : 'text-muted-foreground'

  // ── Payment invoice bubble ──────────────────────────────────────────────
  if (type === 'payment' && paymentReferenceId) {
    return (
      <div className="flex justify-start px-1">
        <div className="max-w-[78%] sm:max-w-sm lg:max-w-md space-y-0.5">
          {showName && (
            <p className={`text-[10px] font-semibold pl-1 mb-0.5 ${roleColour}`}>{displayName}</p>
          )}
          <div className="flex items-end gap-1.5">
            <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl rounded-bl-md px-4 py-3 space-y-2 shadow-sm">
              <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">🎉 Deal reached!</p>
              {agreedAmount && (
                <p className="text-sm text-foreground">
                  Agreed price: <strong>₦{agreedAmount.toLocaleString()}</strong>
                </p>
              )}
              {grandPrice && (
                <p className="text-xs text-muted-foreground">
                  Total (incl. platform fee): ₦{grandPrice.toLocaleString()}
                </p>
              )}
              <a
                href={`/payment/${paymentReferenceId}`}
                className="block w-full text-center bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl py-2 transition-colors"
              >
                Pay Now →
              </a>
            </div>
            <span className="text-[10px] text-muted-foreground/70 shrink-0 pb-0.5">
              {formatTime(timestamp)}
            </span>
          </div>
        </div>
      </div>
    )
  }

  // ── System error bubble ─────────────────────────────────────────────────
  if (type === 'system-error') {
    return (
      <div className="flex justify-start px-1">
        <div className="max-w-[78%] sm:max-w-sm">
          <div className="flex items-end gap-1.5">
            <div className="bg-destructive/10 border border-destructive/30 rounded-2xl rounded-bl-md px-3.5 py-2 shadow-sm">
              <p className="text-sm text-destructive break-words whitespace-pre-wrap leading-relaxed">{text}</p>
            </div>
            <span className="text-[10px] text-muted-foreground/70 shrink-0 pb-0.5">
              {formatTime(timestamp)}
            </span>
          </div>
        </div>
      </div>
    )
  }

  // ── Standard bubble ─────────────────────────────────────────────────────
  return (
    <div className="flex justify-start px-1">
      <div className="max-w-[78%] sm:max-w-sm lg:max-w-md space-y-0.5">
        {showName && (
          <p className={`text-[10px] font-semibold pl-1 mb-0.5 flex items-center gap-1 ${roleColour}`}>
            {isAI && <Bot className="w-3 h-3" />}
            {displayName}
          </p>
        )}
        <div className="flex items-end gap-1.5">
          <div
            className={`rounded-2xl rounded-bl-md px-3.5 py-2 shadow-sm ${
              isAI
                ? 'bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800'
                : isSystemAdmin
                ? 'bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800'
                : 'bg-muted'
            }`}
          >
            <p className="text-sm text-foreground leading-relaxed break-words whitespace-pre-wrap">{text}</p>
          </div>
          <span className="text-[10px] text-muted-foreground/70 shrink-0 pb-0.5">
            {formatTime(timestamp)}
          </span>
        </div>
      </div>
    </div>
  )
}
