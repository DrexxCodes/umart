import { Badge } from '@/components/ui/badge'
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
}: ChatRecipientBubbleProps) {
  const getRoleTag = () => {
    if (isAI) return <Badge className="ml-2 text-xs bg-violet-500 text-white">Clara</Badge>
    if (isSystemAdmin && isCreator) return <Badge className="ml-2 text-xs">Admin + Seller</Badge>
    if (isSystemAdmin) return <Badge className="ml-2 text-xs" variant="destructive">System Admin</Badge>
    if (isCreator) return <Badge className="ml-2 text-xs" variant="secondary">Seller</Badge>
    return <Badge className="ml-2 text-xs" variant="outline">Buyer</Badge>
  }

  // Payment invoice bubble
  if (type === 'payment' && paymentReferenceId) {
    return (
      <div className="flex justify-start">
        <div className="max-w-xs lg:max-w-md xl:max-w-lg">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-muted-foreground">{senderName}</span>
            {getRoleTag()}
          </div>
          <div className="bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 rounded-2xl rounded-tl-none px-4 py-3 space-y-2">
            <p className="text-sm font-semibold text-green-700 dark:text-green-300">
              🎉 Deal reached!
            </p>
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
              className="block w-full text-center bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg py-2 transition-colors"
            >
              Pay Now →
            </a>
          </div>
          <p className="text-xs text-muted-foreground mt-1">{formatTime(timestamp)}</p>
        </div>
      </div>
    )
  }

  // System error bubble
  if (type === 'system-error') {
    return (
      <div className="flex justify-start">
        <div className="max-w-xs lg:max-w-md xl:max-w-lg">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-muted-foreground">{senderName}</span>
            <Badge variant="destructive" className="ml-2 text-xs">System</Badge>
          </div>
          <div className="bg-destructive/10 border border-destructive/30 rounded-2xl rounded-tl-none px-4 py-2">
            <p className="text-sm text-destructive break-words">{text}</p>
          </div>
          <p className="text-xs text-muted-foreground mt-1">{formatTime(timestamp)}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-xs lg:max-w-md xl:max-w-lg">
        <div className="flex items-center gap-2 mb-1">
          {isAI && <Bot className="w-3 h-3 text-violet-500" />}
          <span className="text-xs font-medium text-muted-foreground">{senderName}</span>
          {getRoleTag()}
        </div>
        <div
          className={`rounded-2xl rounded-tl-none px-4 py-2 ${
            isAI
              ? 'bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800 text-foreground'
              : 'bg-muted text-foreground'
          }`}
        >
          <p className="break-words">{text}</p>
        </div>
        <p className="text-xs text-muted-foreground mt-1">{formatTime(timestamp)}</p>
      </div>
    </div>
  )
}
