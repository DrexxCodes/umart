'use client'

import { CheckCircle2 } from 'lucide-react'

interface SectionShellProps {
  icon:      React.ReactNode
  title:     string
  complete:  boolean
  children:  React.ReactNode
}

export function SectionShell({ icon, title, complete, children }: SectionShellProps) {
  return (
    <div className={`overflow-hidden rounded-2xl border transition-colors ${
      complete ? 'border-emerald-500/30 bg-card' : 'border-border bg-card'
    }`}>
      <div className={`flex items-center gap-2.5 border-b px-4 py-3 ${
        complete ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-border bg-muted/40'
      }`}>
        <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${
          complete ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-primary/10 text-primary'
        }`}>
          {complete ? <CheckCircle2 size={15} /> : icon}
        </span>
        <span className="flex-1 text-sm font-semibold text-foreground">{title}</span>
        {complete && (
          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
            Complete
          </span>
        )}
      </div>
      <div className="space-y-3 p-4">{children}</div>
    </div>
  )
}