'use client'

import { CheckCircle2, Clock, Zap, ExternalLink } from 'lucide-react'
import { convertToDate, formatDateTime } from '@/lib/timestamp'

export interface WithdrawStatusProps {
  status:       'pending' | 'processing' | 'completed'
  pendingAt?:   any   // Firestore Timestamp / ISO string / number
  completedAt?: any
  payoutAmount: number
}

const SUPPORT_URL = 'https://support.umart.com.ng'
const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000

const STEPS = [
  { key: 'pending',    label: 'Requested', Icon: Clock        },
  { key: 'processing', label: 'Processing', Icon: Zap         },
  { key: 'completed',  label: 'Completed',  Icon: CheckCircle2 },
] as const

const ORDER: Record<string, number> = { pending: 0, processing: 1, completed: 2 }

export function WithdrawStatus({
  status,
  pendingAt,
  completedAt,
  payoutAmount,
}: WithdrawStatusProps) {
  const pendingDate   = pendingAt   ? convertToDate(pendingAt)   : null
  const completedDate = completedAt ? convertToDate(completedAt) : null

  const currentOrder = ORDER[status] ?? 0

  const isStale =
    status === 'pending' &&
    pendingDate != null &&
    Date.now() - pendingDate.getTime() > TWO_DAYS_MS

  return (
    <div className="space-y-6">
      {/* Amount */}
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
          Withdrawal Amount
        </p>
        <p className="text-3xl font-extrabold tracking-tight text-primary">
          ₦{payoutAmount.toLocaleString()}
        </p>
      </div>

      {/* 3-step tracker */}
      <div className="relative flex items-start justify-between gap-2">
        {/* Connector line */}
        <div className="absolute top-4 left-[calc(16.66%)] right-[calc(16.66%)] h-0.5 bg-border z-0">
          <div
            className="h-full bg-primary transition-all duration-700 ease-out"
            style={{ width: currentOrder === 0 ? '0%' : currentOrder === 1 ? '50%' : '100%' }}
          />
        </div>

        {STEPS.map((step, i) => {
          const stepOrder = ORDER[step.key]
          const done      = stepOrder < currentOrder
          const active    = stepOrder === currentOrder
          const date      = step.key === 'pending' ? pendingDate : step.key === 'completed' ? completedDate : null

          return (
            <div key={step.key} className="flex flex-col items-center gap-2 z-10 flex-1">
              <div
                className={`
                  w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-500
                  ${done
                    ? 'bg-primary border-primary text-primary-foreground'
                    : active
                    ? 'bg-background border-primary text-primary'
                    : 'bg-background border-border text-muted-foreground'
                  }
                `}
              >
                {done
                  ? <CheckCircle2 className="w-4 h-4" />
                  : <step.Icon className="w-4 h-4" />
                }
              </div>
              <div className="text-center">
                <p className={`text-xs font-semibold ${active || done ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {step.label}
                </p>
                {date && (
                  <p className="text-[0.65rem] text-muted-foreground mt-0.5 leading-tight">
                    {formatDateTime(date)}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Status message */}
      <div className={`rounded-xl border px-4 py-3 text-center text-xs font-medium ${
        status === 'completed'
          ? 'border-emerald-500/20 bg-emerald-500/8 text-emerald-600 dark:text-emerald-400'
          : status === 'processing'
          ? 'border-blue-500/20 bg-blue-500/8 text-blue-600 dark:text-blue-400'
          : 'border-amber-500/20 bg-amber-500/8 text-amber-600 dark:text-amber-400'
      }`}>
        {status === 'completed'  && 'Your withdrawal has been completed successfully.'}
        {status === 'processing' && 'Your withdrawal is being processed. Funds will arrive soon.'}
        {status === 'pending'    && 'Your withdrawal request has been received and is in the queue.'}
      </div>

      {/* Stale warning */}
      {isStale && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/8 px-4 py-3 text-center space-y-1">
          <p className="text-sm text-amber-600 dark:text-amber-400 font-medium">
            This withdrawal has been pending for over 2 days.
          </p>
          <a
            href={SUPPORT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            Contact Support <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}
    </div>
  )
}
