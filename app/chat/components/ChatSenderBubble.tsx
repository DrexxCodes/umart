import { formatTime } from '@/lib/timestamp'
import { Eye } from 'lucide-react'

interface ChatSenderBubbleProps {
  text: string
  senderName: string
  timestamp: Date
  isSystemAdmin: boolean
  isCreator: boolean
  /** Show sender name above bubble (first in a run) */
  showName?: boolean
  /** Whether the recipient has seen this message */
  seen?: boolean
}

export function ChatSenderBubble({
  text,
  timestamp,
  isCreator,
  isSystemAdmin,
  showName = false,
  seen = false,
}: ChatSenderBubbleProps) {
  const roleLabel = isSystemAdmin && isCreator
    ? 'Admin · Seller'
    : isSystemAdmin ? 'Admin'
    : isCreator ? 'Seller'
    : null

  return (
    <div className="flex justify-end px-1">
      <div className="max-w-[78%] sm:max-w-sm lg:max-w-md space-y-0.5">
        {showName && roleLabel && (
          <p className="text-right text-[10px] font-semibold text-muted-foreground pr-1 mb-0.5">
            {roleLabel}
          </p>
        )}
        <div className="flex items-end justify-end gap-1.5">
          <div className="flex flex-col items-end gap-0.5">
            <span className="text-[10px] text-muted-foreground/70 shrink-0">
              {formatTime(timestamp)}
            </span>
            {/* Seen indicator — eye icon below timestamp for sender's own messages */}
            <span className="flex items-center gap-0.5">
              <Eye
                className={`w-3 h-3 transition-colors ${
                  seen ? 'text-primary' : 'text-muted-foreground/30'
                }`}
              />
              <span className={`text-[9px] leading-none ${seen ? 'text-primary' : 'text-muted-foreground/30'}`}>
                {seen ? 'Seen' : 'Sent'}
              </span>
            </span>
          </div>
          <div className="bg-primary text-primary-foreground rounded-2xl rounded-br-md px-3.5 py-2 shadow-sm">
            <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">{text}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
